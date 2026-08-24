import pg from "pg";

import { deserializeSession, serializeSession } from "./session.js";
import { SessionNotFoundError } from "./store.js";

const { Pool } = pg;

export class PostgresSessionStore {
  constructor(connectionString) {
    if (typeof connectionString !== "string" || !connectionString.trim()) {
      throw new TypeError("DATABASE_URL jest wymagany dla magazynu sesji PostgreSQL.");
    }

    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    this.ready = this.#initialize();
  }

  async #initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_game_sessions (
        game_id VARCHAR(128) PRIMARY KEY,
        state TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`ALTER TABLE gracz_game_sessions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`);
    await this.pool.query(`
      UPDATE gracz_game_sessions
      SET version = GREATEST(1, jsonb_array_length((state::jsonb)->'events'))
      WHERE version = 1
        AND jsonb_typeof((state::jsonb)->'events') = 'array'
        AND jsonb_array_length((state::jsonb)->'events') > 1
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS gracz_game_sessions_updated_idx
      ON gracz_game_sessions(updated_at DESC)
    `);
    await this.#clearStaleConnections();
  }

  async #clearStaleConnections() {
    const { rows } = await this.pool.query(`SELECT game_id, state FROM gracz_game_sessions`);
    for (const row of rows) {
      let session;
      try {
        session = deserializeSession(row.state);
      } catch {
        continue;
      }
      if (!session.players?.white?.connected && !session.players?.black?.connected) continue;
      const restartedSession = {
        ...session,
        players: {
          white: { ...session.players.white, connected: false },
          black: { ...session.players.black, connected: false },
        },
      };
      await this.pool.query(
        `UPDATE gracz_game_sessions
         SET state = $2, updated_at = NOW()
         WHERE game_id = $1 AND state = $3`,
        [row.game_id, serializeSession(restartedSession), row.state],
      );
    }
  }

  async create(session) {
    await this.ready;
    assertGameId(session?.gameId);
    try {
      await this.pool.query(
        `INSERT INTO gracz_game_sessions (game_id, state, version)
         VALUES ($1, $2, $3)`,
        [session.gameId, serializeSession(session), sessionVersion(session)],
      );
    } catch (error) {
      if (error?.code === "23505") {
        const duplicate = new Error(`Sesja ${session.gameId} już istnieje.`);
        duplicate.code = "SESSION_EXISTS";
        throw duplicate;
      }
      throw error;
    }
    return session;
  }

  async get(gameId) {
    await this.ready;
    assertGameId(gameId);
    const { rows } = await this.pool.query(
      `SELECT state FROM gracz_game_sessions WHERE game_id = $1`,
      [gameId],
    );
    if (!rows[0]) throw new SessionNotFoundError(gameId);
    return deserializeSession(rows[0].state);
  }

  async save(session) {
    await this.ready;
    assertGameId(session?.gameId);
    const serialized = serializeSession(session);
    const nextVersion = sessionVersion(session);
    const expectedVersion = Math.max(1, nextVersion - 1);
    const { rowCount } = await this.pool.query(
      `UPDATE gracz_game_sessions
       SET state = $2, version = $3, updated_at = NOW()
       WHERE game_id = $1
         AND (version = $4 OR (version = $3 AND state = $2))`,
      [session.gameId, serialized, nextVersion, expectedVersion],
    );
    if (!rowCount) {
      const conflict = new Error("Stan partii zmienił się w międzyczasie. Pobierz aktualny stan i ponów operację.");
      conflict.code = "SESSION_EXISTS";
      throw conflict;
    }
    return session;
  }

  async close() {
    await this.pool.end();
  }
}

function sessionVersion(session) {
  const version = Array.isArray(session?.events) ? session.events.length : 0;
  if (!Number.isInteger(version) || version < 1) throw new TypeError("Sesja nie zawiera prawidłowej wersji zdarzeń.");
  return version;
}

function assertGameId(gameId) {
  if (typeof gameId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(gameId)) {
    throw new TypeError("Nieprawidłowy identyfikator sesji.");
  }
}

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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS gracz_game_sessions_updated_idx
      ON gracz_game_sessions(updated_at DESC)
    `);
  }

  async create(session) {
    await this.ready;
    assertGameId(session?.gameId);
    try {
      await this.pool.query(
        `INSERT INTO gracz_game_sessions (game_id, state)
         VALUES ($1, $2)`,
        [session.gameId, serializeSession(session)],
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
    await this.pool.query(
      `INSERT INTO gracz_game_sessions (game_id, state)
       VALUES ($1, $2)
       ON CONFLICT (game_id)
       DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
      [session.gameId, serializeSession(session)],
    );
    return session;
  }

  async close() {
    await this.pool.end();
  }
}

function assertGameId(gameId) {
  if (typeof gameId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(gameId)) {
    throw new TypeError("Nieprawidłowy identyfikator sesji.");
  }
}

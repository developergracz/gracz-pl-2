import pg from "pg";

import { deserializeSession, serializeSession } from "./session.js";
import { SessionNotFoundError } from "./store.js";

const { Pool } = pg;
const SESSION_VERSION = Symbol("gracz.session.version");
const INIT_LOCK_ID = 731_004_201;

export class SessionConcurrencyConflictError extends Error {
  constructor(gameId, expectedVersion) {
    super(`Konflikt zapisu sesji ${gameId}: oczekiwana wersja ${expectedVersion} jest nieaktualna.`);
    this.name = "SessionConcurrencyConflictError";
    this.code = "SESSION_CONCURRENCY_CONFLICT";
    this.status = 409;
  }
}

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
    const client = await this.pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock($1)", [INIT_LOCK_ID]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS gracz_game_sessions (
          game_id VARCHAR(128) PRIMARY KEY,
          state TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`
        ALTER TABLE gracz_game_sessions
        ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS gracz_game_sessions_updated_idx
        ON gracz_game_sessions(updated_at DESC)
      `);
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [INIT_LOCK_ID]).catch(() => {});
      client.release();
    }
  }

  async create(session) {
    await this.ready;
    assertGameId(session?.gameId);
    try {
      await this.pool.query(
        `INSERT INTO gracz_game_sessions (game_id, state, version)
         VALUES ($1, $2, 1)`,
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
    return withVersion(session, 1);
  }

  async getVersioned(gameId) {
    await this.ready;
    assertGameId(gameId);
    const { rows } = await this.pool.query(
      `SELECT state, version FROM gracz_game_sessions WHERE game_id = $1`,
      [gameId],
    );
    if (!rows[0]) throw new SessionNotFoundError(gameId);
    const version = Number(rows[0].version);
    const session = withVersion(deserializeSession(rows[0].state), version);
    return { session, version };
  }

  async get(gameId) {
    return (await this.getVersioned(gameId)).session;
  }

  async save(session, expectedVersion = session?.[SESSION_VERSION]) {
    await this.ready;
    assertGameId(session?.gameId);
    assertVersion(expectedVersion);
    const serialized = serializeSession(session);

    const { rows } = await this.pool.query(
      `UPDATE gracz_game_sessions
       SET state = $2, version = version + 1, updated_at = NOW()
       WHERE game_id = $1 AND version = $3 AND state IS DISTINCT FROM $2
       RETURNING version`,
      [session.gameId, serialized, expectedVersion],
    );

    if (!rows[0]) {
      const current = await this.pool.query(
        `SELECT state, version FROM gracz_game_sessions WHERE game_id = $1`,
        [session.gameId],
      );
      if (!current.rows[0]) throw new SessionNotFoundError(session.gameId);
      const currentVersion = Number(current.rows[0].version);
      if (currentVersion === expectedVersion && current.rows[0].state === serialized) {
        return withVersion(session, currentVersion);
      }
      throw new SessionConcurrencyConflictError(session.gameId, expectedVersion);
    }

    return withVersion(session, Number(rows[0].version));
  }

  async close() {
    await this.pool.end();
  }
}

function withVersion(session, version) {
  return Object.freeze({ ...session, [SESSION_VERSION]: version });
}

function assertVersion(version) {
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeError("Oczekiwana wersja sesji jest wymagana dla zapisu CAS.");
  }
}

function assertGameId(gameId) {
  if (typeof gameId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(gameId)) {
    throw new TypeError("Nieprawidłowy identyfikator sesji.");
  }
}

import pg from "pg";

import { deserializeSession, serializeSession } from "./session.js";
import { SessionNotFoundError } from "./store.js";
import {
  MatchRuntimeIdempotencyConflictError,
  MatchRuntimeOwnershipError,
  MatchRuntimeVersionConflictError,
} from "./match-runtime.js";

const { Pool } = pg;
const SESSION_VERSION = Symbol("gracz.session.version");
const INIT_LOCK_ID = 731_004_201;
const HEALTH_TIMEOUT_MS = 1_000;

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
    let initializationError;
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
      await client.query(`
        CREATE TABLE IF NOT EXISTS gracz_match_runtime_ownership (
          match_id VARCHAR(128) PRIMARY KEY REFERENCES gracz_game_sessions(game_id) ON DELETE CASCADE,
          owner_id VARCHAR(128) NOT NULL,
          ownership_epoch BIGINT NOT NULL CHECK (ownership_epoch > 0),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS gracz_match_runtime_commands (
          match_id VARCHAR(128) NOT NULL REFERENCES gracz_game_sessions(game_id) ON DELETE CASCADE,
          idempotency_key VARCHAR(128) NOT NULL,
          command_hash CHAR(64) NOT NULL,
          expected_version INTEGER NOT NULL,
          result_version INTEGER NOT NULL,
          ownership_epoch BIGINT NOT NULL,
          result_state TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (match_id, idempotency_key)
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS gracz_match_runtime_commands_created_idx
        ON gracz_match_runtime_commands(created_at DESC)
      `);
    } catch (error) {
      initializationError = error;
      throw error;
    } finally {
      let unlockError;
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [INIT_LOCK_ID]);
      } catch (error) {
        unlockError = error;
      }
      client.release(unlockError);
      if (!initializationError && unlockError) throw unlockError;
    }
  }

  async healthCheck() {
    const deadlineAt = Date.now() + HEALTH_TIMEOUT_MS;
    await waitForHealthDeadline(
      this.ready,
      deadlineAt,
      "PostgreSQL readiness initialization timed out.",
    );

    const client = await acquireHealthClient(this.pool, deadlineAt);

    let destroyClient = false;
    try {
      const { rows } = await boundedHealthQuery(
        client,
        "SELECT 1 AS ready",
        remainingHealthBudget(deadlineAt),
      );
      if (Number(rows?.[0]?.ready) !== 1) {
        throw new Error("PostgreSQL readiness query returned an unexpected result.");
      }
      return { ok: true, dependency: "postgresql" };
    } catch (error) {
      destroyClient = true;
      throw error;
    } finally {
      client.release(destroyClient);
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

  async loadMatchRuntime(matchId) {
    await this.ready;
    assertGameId(matchId);
    const { rows } = await this.pool.query(
      `SELECT s.state, s.version, o.ownership_epoch
       FROM gracz_game_sessions s
       LEFT JOIN gracz_match_runtime_ownership o ON o.match_id = s.game_id
       WHERE s.game_id = $1`,
      [matchId],
    );
    if (!rows[0]) throw new SessionNotFoundError(matchId);
    return {
      state: deserializeSession(rows[0].state),
      version: Number(rows[0].version),
      ownershipEpoch: rows[0].ownership_epoch == null ? 0 : Number(rows[0].ownership_epoch),
    };
  }

  async claimMatchOwnership(matchId, ownerId) {
    await this.ready;
    assertGameId(matchId);
    assertRuntimeToken(ownerId, "ownerId");
    const { rows } = await this.pool.query(
      `INSERT INTO gracz_match_runtime_ownership(match_id, owner_id, ownership_epoch)
       SELECT game_id, $2, 1 FROM gracz_game_sessions WHERE game_id = $1
       ON CONFLICT (match_id)
       DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         ownership_epoch = gracz_match_runtime_ownership.ownership_epoch + 1,
         updated_at = NOW()
       RETURNING ownership_epoch`,
      [matchId, ownerId],
    );
    if (!rows[0]) throw new SessionNotFoundError(matchId);
    return { ownershipEpoch: Number(rows[0].ownership_epoch) };
  }

  async executeMatchRuntimeCommand({
    matchId,
    ownerId,
    ownershipEpoch,
    expectedVersion,
    idempotencyKey,
    commandHash,
    execute,
  }) {
    await this.ready;
    assertGameId(matchId);
    assertRuntimeToken(ownerId, "ownerId");
    assertRuntimeToken(idempotencyKey, "idempotencyKey");
    assertHash(commandHash);
    assertEpoch(ownershipEpoch);
    assertVersion(expectedVersion);
    if (typeof execute !== "function") throw new TypeError("execute musi być funkcją.");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const sessionResult = await client.query(
        `SELECT state, version FROM gracz_game_sessions WHERE game_id = $1 FOR UPDATE`,
        [matchId],
      );
      if (!sessionResult.rows[0]) throw new SessionNotFoundError(matchId);

      const ownershipResult = await client.query(
        `SELECT owner_id, ownership_epoch
         FROM gracz_match_runtime_ownership
         WHERE match_id = $1
         FOR UPDATE`,
        [matchId],
      );
      const ownership = ownershipResult.rows[0];
      if (!ownership
        || ownership.owner_id !== ownerId
        || Number(ownership.ownership_epoch) !== ownershipEpoch) {
        throw new MatchRuntimeOwnershipError(matchId, ownershipEpoch);
      }

      const replay = await client.query(
        `SELECT command_hash, result_state, result_version
         FROM gracz_match_runtime_commands
         WHERE match_id = $1 AND idempotency_key = $2`,
        [matchId, idempotencyKey],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].command_hash !== commandHash) {
          throw new MatchRuntimeIdempotencyConflictError(matchId, idempotencyKey);
        }
        await client.query("COMMIT");
        return {
          state: deserializeSession(replay.rows[0].result_state),
          version: Number(replay.rows[0].result_version),
          replayed: true,
        };
      }

      const currentVersion = Number(sessionResult.rows[0].version);
      if (currentVersion !== expectedVersion) {
        throw new MatchRuntimeVersionConflictError(matchId, expectedVersion, currentVersion);
      }

      const currentState = deserializeSession(sessionResult.rows[0].state);
      const nextState = await execute(currentState);
      if (!nextState || nextState.gameId !== matchId) throw new TypeError("Silnik zwrócił nieprawidłowy stan meczu.");
      const serialized = serializeSession(nextState);
      const nextVersion = currentVersion + 1;

      await client.query(
        `UPDATE gracz_game_sessions
         SET state = $2, version = $3, updated_at = NOW()
         WHERE game_id = $1`,
        [matchId, serialized, nextVersion],
      );
      await client.query(
        `INSERT INTO gracz_match_runtime_commands(
           match_id, idempotency_key, command_hash, expected_version,
           result_version, ownership_epoch, result_state
         ) VALUES($1, $2, $3, $4, $5, $6, $7)`,
        [matchId, idempotencyKey, commandHash, expectedVersion, nextVersion, ownershipEpoch, serialized],
      );
      await client.query("COMMIT");
      return { state: deserializeSession(serialized), version: nextVersion, replayed: false };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

async function waitForHealthDeadline(work, deadlineAt, timeoutMessage) {
  const timeoutMs = remainingHealthBudget(deadlineAt);
  if (timeoutMs <= 0) throw dependencyUnavailable(timeoutMessage);

  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(dependencyUnavailable(timeoutMessage)), timeoutMs);
    timer.unref?.();
  });

  try {
    await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function acquireHealthClient(pool, deadlineAt) {
  const timeoutMs = remainingHealthBudget(deadlineAt);
  if (timeoutMs <= 0) {
    throw dependencyUnavailable("PostgreSQL readiness client acquisition timed out.");
  }

  let acquisitionTimedOut = false;
  let timer;

  const acquisition = pool.connect().then(
    (client) => {
      if (!acquisitionTimedOut) return client;
      client.release(true);
      return null;
    },
    (error) => {
      if (acquisitionTimedOut) return null;
      throw error;
    },
  );

  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => {
      acquisitionTimedOut = true;
      resolve(null);
    }, timeoutMs);
    timer.unref?.();
  });

  const client = await Promise.race([acquisition, deadline]);
  clearTimeout(timer);

  if (!client) {
    throw dependencyUnavailable("PostgreSQL readiness client acquisition timed out.");
  }
  return client;
}

function boundedHealthQuery(client, text, timeoutMs) {
  if (timeoutMs <= 0) {
    return Promise.reject(dependencyUnavailable("PostgreSQL readiness query timed out."));
  }
  return client.query({ text, query_timeout: timeoutMs });
}

function remainingHealthBudget(deadlineAt) {
  return Math.max(0, deadlineAt - Date.now());
}

function dependencyUnavailable(message) {
  const error = new Error(message);
  error.code = "DEPENDENCY_UNAVAILABLE";
  return error;
}

function withVersion(session, version) {
  return Object.freeze({ ...session, [SESSION_VERSION]: version });
}

function assertVersion(version) {
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeError("Oczekiwana wersja sesji jest wymagana dla zapisu CAS.");
  }
}

function assertEpoch(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError("Nieprawidłowy ownershipEpoch.");
}

function assertRuntimeToken(value, name) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) throw new TypeError(`Nieprawidłowy ${name}.`);
}

function assertHash(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new TypeError("Nieprawidłowy commandHash.");
}

function assertGameId(gameId) {
  if (typeof gameId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(gameId)) {
    throw new TypeError("Nieprawidłowy identyfikator sesji.");
  }
}

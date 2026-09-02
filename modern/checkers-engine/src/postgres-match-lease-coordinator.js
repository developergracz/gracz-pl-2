import { randomUUID } from "node:crypto";
import pg from "pg";

import { MatchRuntimeError } from "./match-runtime.js";

const { Pool } = pg;

export class PostgresMatchLeaseCoordinator {
  constructor(connectionString, { ownerId = `runtime-${randomUUID()}`, leaseMs = 15_000 } = {}) {
    if (typeof connectionString !== "string" || !connectionString.trim()) {
      throw new TypeError("DATABASE_URL jest wymagany dla koordynatora Match Runtime.");
    }
    this.ownerId = requireIdentity(ownerId, "ownerId");
    if (!Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 300_000) {
      throw new TypeError("leaseMs musi mieścić się w zakresie 1000..300000 ms.");
    }
    this.leaseMs = leaseMs;
    this.pool = new Pool({
      connectionString,
      ssl: isLocal(connectionString) ? false : { rejectUnauthorized: false },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    this.ready = this.#initialize();
  }

  async #initialize() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS match_actor_leases (
      game_type VARCHAR(64) NOT NULL,
      match_id VARCHAR(128) NOT NULL,
      owner_id VARCHAR(128) NOT NULL,
      fencing_token BIGINT NOT NULL,
      lease_expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(game_type, match_id)
    )`);
  }

  async withOwnership({ gameType, matchId }, operation) {
    await this.ready;
    if (typeof operation !== "function") throw new TypeError("Operacja Match Runtime jest wymagana.");
    const key = normalizeKey(gameType, matchId);
    const client = await this.pool.connect();
    let locked = false;
    let ownership = null;
    try {
      await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [key.lockKey]);
      locked = true;
      ownership = await this.#takeOwnership(client, key);
      const result = await operation(Object.freeze({ ...ownership }));
      await this.#assertFenceWith(client, ownership);
      return result;
    } catch (error) {
      if (isConnectionError(error)) {
        throw new MatchRuntimeError("Utracono koordynację właściciela meczu.", "MATCH_OWNERSHIP_LOST", 503);
      }
      throw error;
    } finally {
      if (ownership) await this.#releaseOwnership(client, ownership).catch(() => {});
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key.lockKey]).catch(() => {});
      client.release();
    }
  }

  async assertFence(ownership) {
    await this.ready;
    const normalized = normalizeOwnership(ownership);
    const client = await this.pool.connect();
    try {
      return await this.#assertFenceWith(client, normalized);
    } finally {
      client.release();
    }
  }

  async getLease({ gameType, matchId }) {
    await this.ready;
    const key = normalizeKey(gameType, matchId);
    const { rows } = await this.pool.query(
      `SELECT game_type, match_id, owner_id, fencing_token, lease_expires_at
       FROM match_actor_leases WHERE game_type=$1 AND match_id=$2`,
      [key.gameType, key.matchId],
    );
    if (!rows[0]) return null;
    return mapLease(rows[0]);
  }

  async close() {
    await this.pool.end();
  }

  async #takeOwnership(client, key) {
    const { rows } = await client.query(
      `INSERT INTO match_actor_leases(game_type,match_id,owner_id,fencing_token,lease_expires_at,updated_at)
       VALUES($1,$2,$3,1,NOW()+($4::int * INTERVAL '1 millisecond'),NOW())
       ON CONFLICT(game_type,match_id) DO UPDATE SET
         owner_id=EXCLUDED.owner_id,
         fencing_token=match_actor_leases.fencing_token+1,
         lease_expires_at=EXCLUDED.lease_expires_at,
         updated_at=NOW()
       RETURNING game_type,match_id,owner_id,fencing_token,lease_expires_at`,
      [key.gameType, key.matchId, this.ownerId, this.leaseMs],
    );
    return mapLease(rows[0]);
  }

  async #assertFenceWith(client, ownership) {
    const { rows } = await client.query(
      `SELECT owner_id,fencing_token FROM match_actor_leases
       WHERE game_type=$1 AND match_id=$2`,
      [ownership.gameType, ownership.matchId],
    );
    const current = rows[0];
    if (!current || current.owner_id !== ownership.ownerId || Number(current.fencing_token) !== ownership.fencingToken) {
      throw new MatchRuntimeError("Właściciel meczu jest nieaktualny; komenda została odrzucona przez fencing.", "MATCH_STALE_OWNER", 409);
    }
    return true;
  }

  async #releaseOwnership(client, ownership) {
    await client.query(
      `UPDATE match_actor_leases SET lease_expires_at=NOW(),updated_at=NOW()
       WHERE game_type=$1 AND match_id=$2 AND owner_id=$3 AND fencing_token=$4`,
      [ownership.gameType, ownership.matchId, ownership.ownerId, ownership.fencingToken],
    );
  }
}

function normalizeKey(gameType, matchId) {
  const normalizedGameType = requireIdentity(gameType, "gameType").toLowerCase();
  const normalizedMatchId = requireIdentity(matchId, "matchId");
  return { gameType: normalizedGameType, matchId: normalizedMatchId, lockKey: `${normalizedGameType}:${normalizedMatchId}` };
}

function normalizeOwnership(value) {
  if (!value || typeof value !== "object") throw new TypeError("ownership jest wymagane.");
  const key = normalizeKey(value.gameType, value.matchId);
  const ownerId = requireIdentity(value.ownerId, "ownerId");
  const fencingToken = Number(value.fencingToken);
  if (!Number.isSafeInteger(fencingToken) || fencingToken < 1) throw new TypeError("Nieprawidłowy fencingToken.");
  return { ...key, ownerId, fencingToken };
}

function mapLease(row) {
  const fencingToken = Number(row.fencing_token);
  if (!Number.isSafeInteger(fencingToken) || fencingToken < 1) {
    throw new MatchRuntimeError("Fencing token przekroczył bezpieczny zakres runtime.", "MATCH_INVALID_FENCING_TOKEN", 500);
  }
  return Object.freeze({
    gameType: row.game_type,
    matchId: row.match_id,
    ownerId: row.owner_id,
    fencingToken,
    leaseExpiresAt: new Date(row.lease_expires_at).toISOString(),
  });
}

function requireIdentity(value, field) {
  const text = String(value ?? "").trim();
  if (!text || text.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(text)) throw new TypeError(`Nieprawidłowe ${field}.`);
  return text;
}

function isLocal(url) {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function isConnectionError(error) {
  return ["57P01", "57P02", "57P03", "08000", "08003", "08006", "08001"].includes(error?.code);
}

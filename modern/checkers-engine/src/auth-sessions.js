import pg from "pg";
import { AuthError } from "./auth.js";

const { Pool } = pg;

export class MemoryAuthSessionStore {
  #sessions = new Map();

  async create({ tokenId, userId, expiresAt }) {
    validateSessionRecord({ tokenId, userId, expiresAt });
    this.#cleanup();
    this.#sessions.set(tokenId, { tokenId, userId, expiresAt, revokedAt: null });
  }

  async assertActive({ tokenId, userId, expiresAt }) {
    validateSessionRecord({ tokenId, userId, expiresAt });
    this.#cleanup();
    const session = this.#sessions.get(tokenId);
    if (!session || session.userId !== userId || session.revokedAt || session.expiresAt <= nowSeconds()) {
      throw new AuthError("Sesja logowania została zakończona.", "SESSION_REVOKED");
    }
  }

  async revoke(tokenId) {
    if (!tokenId) return;
    const session = this.#sessions.get(tokenId);
    if (session) session.revokedAt = nowSeconds();
  }

  async revokeAll(userId) {
    if (typeof userId !== "string" || !userId) return;
    const revokedAt = nowSeconds();
    for (const session of this.#sessions.values()) {
      if (session.userId === userId) session.revokedAt = revokedAt;
    }
  }

  #cleanup() {
    const now = nowSeconds();
    for (const [tokenId, session] of this.#sessions) {
      if (session.expiresAt <= now || (session.revokedAt && session.revokedAt < now - 86_400)) this.#sessions.delete(tokenId);
    }
  }
}

export class PostgresAuthSessionStore {
  constructor(connectionString) {
    if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany.");
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
      max: 3,
    });
    this.ready = this.#initialize();
  }

  async #initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_auth_sessions (
        token_id UUID PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      )
    `);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_auth_sessions_user_idx ON gracz_auth_sessions(user_id, expires_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_auth_sessions_expiry_idx ON gracz_auth_sessions(expires_at)`);
    await this.cleanup();
  }

  async create({ tokenId, userId, expiresAt }) {
    await this.ready;
    validateSessionRecord({ tokenId, userId, expiresAt });
    await this.pool.query(
      `INSERT INTO gracz_auth_sessions(token_id,user_id,expires_at)
       VALUES($1,$2,to_timestamp($3))
       ON CONFLICT (token_id) DO UPDATE SET user_id=EXCLUDED.user_id,expires_at=EXCLUDED.expires_at,revoked_at=NULL`,
      [tokenId, userId, expiresAt],
    );
  }

  async assertActive({ tokenId, userId, expiresAt }) {
    await this.ready;
    validateSessionRecord({ tokenId, userId, expiresAt });
    const { rows } = await this.pool.query(
      `SELECT 1 FROM gracz_auth_sessions
       WHERE token_id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>NOW()
       LIMIT 1`,
      [tokenId, userId],
    );
    if (!rows[0]) throw new AuthError("Sesja logowania została zakończona.", "SESSION_REVOKED");
  }

  async revoke(tokenId) {
    await this.ready;
    if (!tokenId) return;
    await this.pool.query(`UPDATE gracz_auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE token_id=$1`, [tokenId]);
  }

  async revokeAll(userId) {
    await this.ready;
    if (typeof userId !== "string" || !userId) return;
    await this.pool.query(`UPDATE gracz_auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1 AND revoked_at IS NULL`, [userId.toLowerCase()]);
  }

  async cleanup() {
    await this.pool.query(`DELETE FROM gracz_auth_sessions WHERE expires_at < NOW() - INTERVAL '1 day' OR revoked_at < NOW() - INTERVAL '7 days'`);
  }

  async close() { await this.pool.end(); }
}

function validateSessionRecord({ tokenId, userId, expiresAt }) {
  if (typeof tokenId !== "string" || !/^[0-9a-f-]{36}$/i.test(tokenId)) throw new TypeError("Nieprawidłowy identyfikator sesji logowania.");
  if (typeof userId !== "string" || userId.length < 1 || userId.length > 128) throw new TypeError("Nieprawidłowy użytkownik sesji logowania.");
  if (!Number.isInteger(expiresAt) || expiresAt <= nowSeconds()) throw new TypeError("Nieprawidłowy czas wygaśnięcia sesji logowania.");
}

function nowSeconds() { return Math.floor(Date.now() / 1000); }

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);

export class PostgresAccountService {
  constructor(connectionString) {
    if (typeof connectionString !== "string" || !connectionString.trim()) {
      throw new TypeError("DATABASE_URL jest wymagany dla PostgreSQL.");
    }
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
      max: 5,
    });
    this.ready = this.#initialize();
  }

  async #initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_accounts (
        user_id VARCHAR(32) PRIMARY KEY,
        display_name VARCHAR(40) NOT NULL,
        salt BYTEA NOT NULL,
        password_hash BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async register({ userId, displayName, password }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    validateDisplayName(displayName);
    validatePassword(password);
    const salt = randomBytes(16);
    const passwordHash = await hashPassword(password, salt);
    try {
      await this.pool.query(
        `INSERT INTO gracz_accounts (user_id, display_name, salt, password_hash)
         VALUES ($1, $2, $3, $4)`,
        [normalizedId, displayName.trim(), salt, passwordHash],
      );
    } catch (error) {
      if (error?.code === "23505") throw accountError("Takie konto już istnieje.", "ACCOUNT_EXISTS");
      throw error;
    }
    return Object.freeze({ userId: normalizedId, displayName: displayName.trim() });
  }

  async authenticate({ userId, password }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    const { rows } = await this.pool.query(
      "SELECT user_id, display_name, salt, password_hash FROM gracz_accounts WHERE user_id = $1",
      [normalizedId],
    );
    const record = rows[0];
    const salt = record?.salt ?? Buffer.alloc(16);
    const expected = record?.password_hash ?? Buffer.alloc(64);
    const actual = await hashPassword(typeof password === "string" ? password : "", salt);
    if (!record || expected.length !== actual.length || !timingSafeEqual(actual, expected)) {
      throw accountError("Nieprawidłowy login lub hasło.", "INVALID_CREDENTIALS");
    }
    return Object.freeze({ userId: record.user_id, displayName: record.display_name });
  }

  async close() {
    await this.pool.end();
  }
}

async function hashPassword(password, salt) {
  return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function normalizeUserId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{3,32}$/.test(value)) {
    throw accountError("Login musi mieć 3–32 znaki: litery, cyfry, _ lub -.", "INVALID_ACCOUNT");
  }
  return value.toLowerCase();
}

function validateDisplayName(value) {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 40) {
    throw accountError("Nazwa gracza musi mieć 2–40 znaków.", "INVALID_ACCOUNT");
  }
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    throw accountError("Hasło musi mieć co najmniej 10 znaków.", "WEAK_PASSWORD");
  }
}

function accountError(message, code) {
  const error = new Error(message);
  error.name = "AccountError";
  error.code = code;
  return error;
}

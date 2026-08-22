import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { AccountError } from "./accounts.js";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);

export class PostgresAccountService {
  constructor(connectionString) {
    if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany dla PostgreSQL.");
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
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
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS email VARCHAR(254)`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(254)`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}'::jsonb`);
  }

  async register({ userId, displayName, password, email = "", recoveryEmail = "", twoFactor = false }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    validateDisplayName(displayName);
    validatePassword(password);
    const salt = randomBytes(16);
    const passwordHash = await hashPassword(password, salt);
    const safeEmail = cleanEmail(email);
    const safeRecoveryEmail = cleanEmail(recoveryEmail);
    const profile = defaultProfile({ twoFactor });
    try {
      await this.pool.query(
        `INSERT INTO gracz_accounts (user_id, display_name, salt, password_hash, email, recovery_email, profile_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [normalizedId, displayName.trim(), salt, passwordHash, safeEmail || null, safeRecoveryEmail || null, JSON.stringify(profile)],
      );
    } catch (error) {
      if (error?.code === "23505") throw new AccountError("Takie konto już istnieje.", "ACCOUNT_EXISTS");
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
      throw new AccountError("Nieprawidłowy login lub hasło.", "INVALID_CREDENTIALS");
    }
    return Object.freeze({ userId: record.user_id, displayName: record.display_name });
  }

  async getProfile(userId) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    const { rows } = await this.pool.query(
      `SELECT user_id, display_name, email, recovery_email, created_at, profile_data
       FROM gracz_accounts WHERE user_id = $1`,
      [normalizedId],
    );
    if (!rows[0]) throw new AccountError("Nie znaleziono konta.", "ACCOUNT_NOT_FOUND");
    return publicProfile(rows[0]);
  }

  async updateProfile(userId, input = {}) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    const displayName = String(input.displayName ?? "").trim();
    validateDisplayName(displayName);
    const email = cleanEmail(input.email);
    const recoveryEmail = cleanEmail(input.recoveryEmail);
    if (email && !isEmail(email)) throw new AccountError("Podaj prawidłowy adres e-mail.", "INVALID_ACCOUNT");
    if (recoveryEmail && !isEmail(recoveryEmail)) throw new AccountError("Podaj prawidłowy e-mail odzyskiwania.", "INVALID_ACCOUNT");
    if (email && recoveryEmail && email === recoveryEmail) throw new AccountError("E-mail odzyskiwania musi być inny niż główny.", "INVALID_ACCOUNT");
    const profile = sanitizeProfile(input);
    const { rows } = await this.pool.query(
      `UPDATE gracz_accounts
       SET display_name=$2, email=$3, recovery_email=$4, profile_data=$5::jsonb
       WHERE user_id=$1
       RETURNING user_id, display_name, email, recovery_email, created_at, profile_data`,
      [normalizedId, displayName, email || null, recoveryEmail || null, JSON.stringify(profile)],
    );
    if (!rows[0]) throw new AccountError("Nie znaleziono konta.", "ACCOUNT_NOT_FOUND");
    return publicProfile(rows[0]);
  }

  async close() { await this.pool.end(); }
}

async function hashPassword(password, salt) {
  return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
function normalizeUserId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]{3,32}$/.test(value)) throw new AccountError("Login musi mieć 3–32 znaki: litery, cyfry, kropkę, _ lub -.", "INVALID_ACCOUNT");
  return value.toLowerCase();
}
function validateDisplayName(value) {
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 40) throw new AccountError("Nazwa gracza musi mieć 2–40 znaków.", "INVALID_ACCOUNT");
}
function validatePassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) throw new AccountError("Hasło musi mieć co najmniej 10 znaków.", "WEAK_PASSWORD");
}
function cleanEmail(value) { return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : ""; }
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value); }
function defaultProfile({ twoFactor = false } = {}) {
  return { bio: "", country: "PL", city: "", language: "pl", showOnline: true, allowInvites: true, allowMessages: true, newsletter: false, twoFactor: Boolean(twoFactor) };
}
function sanitizeProfile(input) {
  return {
    bio: String(input.bio ?? "").trim().slice(0, 280),
    country: String(input.country ?? "PL").trim().slice(0, 2).toUpperCase(),
    city: String(input.city ?? "").trim().slice(0, 60),
    language: ["pl", "en", "de"].includes(input.language) ? input.language : "pl",
    showOnline: input.showOnline !== false,
    allowInvites: input.allowInvites !== false,
    allowMessages: input.allowMessages !== false,
    newsletter: input.newsletter === true,
    twoFactor: input.twoFactor === true,
  };
}
function publicProfile(row) {
  return Object.freeze({
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email ?? "",
    recoveryEmail: row.recovery_email ?? "",
    createdAt: row.created_at,
    ...defaultProfile(),
    ...(row.profile_data ?? {}),
  });
}

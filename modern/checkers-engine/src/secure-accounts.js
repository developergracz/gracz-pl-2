import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { AccountError } from "./accounts.js";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const HASH_VERSION = 2;
const LEGACY_SCRYPT = Object.freeze({ N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const CURRENT_SCRYPT = Object.freeze({ N: 131_072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "qwerty", "qwerty123", "qwertyuiop",
  "1234567890", "123456789", "12345678", "1111111111", "administrator", "admin123",
  "letmein123", "welcome123", "iloveyou123", "zaq12wsx", "qazwsx123", "polska123",
]);

export class SecureAccountService {
  constructor(baseService, connectionString) {
    if (!baseService) throw new TypeError("Bazowy serwis kont jest wymagany.");
    if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany.");
    this.base = baseService;
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
      max: 3,
    });
    this.ready = this.#initialize();
  }

  async #initialize() {
    if (this.base.ready) await this.base.ready;
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS password_hash_version SMALLINT NOT NULL DEFAULT 1`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS phone VARCHAR(24)`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS verification_channel VARCHAR(10) NOT NULL DEFAULT 'email'`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN NOT NULL DEFAULT FALSE`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_password_reset_tokens (
        token_hash BYTEA PRIMARY KEY,
        user_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_password_reset_user_idx ON gracz_password_reset_tokens(user_id, created_at DESC)`);
  }

  async register(input) {
    await this.ready;
    assertRegistrationLooksHuman(input);
    validatePassword(input?.password);
    const phone = cleanPhone(input?.phone);
    const verificationChannel = normalizeVerificationChannel(input?.verificationChannel);
    if (verificationChannel === "sms" && !phone) {
      throw new AccountError("Aby otrzymać kod SMS, wpisz prawidłowy numer telefonu.", "INVALID_PHONE");
    }
    const account = await this.base.register(input);
    await this.#setCurrentPassword(account.userId, input.password);
    await this.pool.query(
      `UPDATE gracz_accounts SET phone=$2, verification_channel=$3, contact_verified=FALSE WHERE user_id=$1`,
      [account.userId, phone || null, verificationChannel],
    );
    return account;
  }

  async authenticate({ userId, password }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    const { rows } = await this.pool.query(
      `SELECT user_id, display_name, salt, password_hash, password_hash_version
       FROM gracz_accounts WHERE user_id=$1`,
      [normalizedId],
    );
    const record = rows[0];
    const salt = record?.salt ?? Buffer.alloc(16);
    const expected = record?.password_hash ?? Buffer.alloc(64);
    const version = Number(record?.password_hash_version ?? 1);
    const params = version >= HASH_VERSION ? CURRENT_SCRYPT : LEGACY_SCRYPT;
    const actual = await hashPassword(typeof password === "string" ? password : "", salt, params);
    if (!record || expected.length !== actual.length || !timingSafeEqual(actual, expected)) {
      throw new AccountError("Nieprawidłowy login lub hasło.", "INVALID_CREDENTIALS");
    }
    if (version < HASH_VERSION) await this.#setCurrentPassword(record.user_id, password);
    return Object.freeze({ userId: record.user_id, displayName: record.display_name });
  }

  async createPasswordResetToken({ userId, email, phone, verificationChannel = "email" }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    const channel = normalizeVerificationChannel(verificationChannel);
    const safeEmail = cleanEmail(email);
    const safePhone = cleanPhone(phone);
    const { rows } = await this.pool.query(
      `SELECT user_id FROM gracz_accounts
       WHERE user_id=$1 AND (
         ($2='email' AND (lower(email)=lower($3) OR lower(recovery_email)=lower($3)))
         OR ($2='sms' AND phone=$4)
       )`,
      [normalizedId, channel, safeEmail, safePhone],
    );
    if (!rows[0]) return { ok: true, token: null, channel };
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    await this.pool.query(`DELETE FROM gracz_password_reset_tokens WHERE user_id=$1 OR expires_at < NOW()`, [normalizedId]);
    await this.pool.query(
      `INSERT INTO gracz_password_reset_tokens(token_hash,user_id,expires_at)
       VALUES($1,$2,NOW()+INTERVAL '15 minutes')`,
      [tokenHash, normalizedId],
    );
    return { ok: true, token, channel };
  }

  async resetPasswordWithEmail({ userId, email, phone, verificationChannel = "email", newPassword, token }) {
    await this.ready;
    if (typeof token !== "string" || token.length < 32) {
      throw new AccountError("Reset hasła wymaga jednorazowego kodu lub tokenu weryfikacyjnego.", "RECOVERY_TOKEN_REQUIRED");
    }
    validatePassword(newPassword);
    const normalizedId = normalizeUserId(userId);
    const channel = normalizeVerificationChannel(verificationChannel);
    const safeEmail = cleanEmail(email);
    const safePhone = cleanPhone(phone);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT t.user_id
         FROM gracz_password_reset_tokens t
         JOIN gracz_accounts a ON a.user_id=t.user_id
         WHERE t.token_hash=$1 AND t.user_id=$2 AND t.used_at IS NULL AND t.expires_at>NOW()
           AND (( $3='email' AND (lower(a.email)=lower($4) OR lower(a.recovery_email)=lower($4)) )
             OR ( $3='sms' AND a.phone=$5 ))
         FOR UPDATE`,
        [hashToken(token), normalizedId, channel, safeEmail, safePhone],
      );
      if (!rows[0]) throw new AccountError("Kod resetu jest nieprawidłowy albo wygasł.", "RECOVERY_FAILED");
      const salt = randomBytes(16);
      const passwordHash = await hashPassword(newPassword, salt, CURRENT_SCRYPT);
      await client.query(
        `UPDATE gracz_accounts SET salt=$2,password_hash=$3,password_hash_version=$4 WHERE user_id=$1`,
        [normalizedId, salt, passwordHash, HASH_VERSION],
      );
      await client.query(`UPDATE gracz_password_reset_tokens SET used_at=NOW() WHERE token_hash=$1`, [hashToken(token)]);
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async #setCurrentPassword(userId, password) {
    validatePassword(password);
    const salt = randomBytes(16);
    const passwordHash = await hashPassword(password, salt, CURRENT_SCRYPT);
    await this.pool.query(
      `UPDATE gracz_accounts SET salt=$2,password_hash=$3,password_hash_version=$4 WHERE user_id=$1`,
      [userId, salt, passwordHash, HASH_VERSION],
    );
  }

  getProfile(...args) { return this.base.getProfile(...args); }
  updateProfile(...args) { return this.base.updateProfile(...args); }
  searchPlayers(...args) { return this.base.searchPlayers(...args); }
  sendPrivateMessage(...args) { return this.base.sendPrivateMessage(...args); }
  listPrivateMessages(...args) { return this.base.listPrivateMessages(...args); }
  updatePrivateMessage(...args) { return this.base.updatePrivateMessage(...args); }
  deletePrivateMessage(...args) { return this.base.deletePrivateMessage(...args); }

  async close() {
    await Promise.allSettled([
      typeof this.base.close === "function" ? this.base.close() : Promise.resolve(),
      this.pool.end(),
    ]);
  }
}

export async function hashPasswordV2(password, salt) {
  return hashPassword(password, salt, CURRENT_SCRYPT);
}

async function hashPassword(password, salt, params) {
  return scrypt(password, salt, 64, params);
}

function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest();
}

function normalizeUserId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]{3,32}$/.test(value)) {
    throw new AccountError("Nieprawidłowy login.", "INVALID_ACCOUNT");
  }
  return value.toLowerCase();
}

function cleanEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

function cleanPhone(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/[\s()-]/g, "");
  if (!normalized) return "";
  return /^\+?[0-9]{7,15}$/.test(normalized) ? normalized : "";
}

function normalizeVerificationChannel(value) {
  return value === "sms" ? "sms" : "email";
}

function assertRegistrationLooksHuman(input) {
  if (!input || typeof input !== "object") throw new AccountError("Nieprawidłowe dane rejestracji.", "INVALID_ACCOUNT");
  if (typeof input.website === "string" && input.website.trim()) {
    throw new AccountError("Nie można utworzyć konta.", "AUTOMATION_REJECTED");
  }
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 15 || value.length > 128) {
    throw new AccountError("Hasło musi mieć 15–128 znaków.", "WEAK_PASSWORD");
  }
  const normalized = value.normalize("NFKC").toLowerCase();
  if (COMMON_PASSWORDS.has(normalized) || /^(.)\1{14,}$/.test(normalized) || /^123456/.test(normalized)) {
    throw new AccountError("To hasło jest zbyt popularne lub łatwe do odgadnięcia. Wybierz inne.", "WEAK_PASSWORD");
  }
}

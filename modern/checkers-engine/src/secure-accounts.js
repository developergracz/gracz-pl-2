import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { AccountError } from "./accounts.js";
import { SecureMailService } from "./secure-mail-service.js";

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
const systemMail = new SecureMailService();

export class SecureAccountService {
  constructor(baseService, connectionString) {
    if (!baseService) throw new TypeError("Bazowy serwis kont jest wymagany.");
    if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany.");
    this.base = baseService;
    this.pool = new Pool({ connectionString, ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }, max: 3 });
    this.ready = this.#initialize();
  }

  async #initialize() {
    if (this.base.ready) await this.base.ready;
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS password_hash_version SMALLINT NOT NULL DEFAULT 1`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS phone VARCHAR(24)`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS verification_channel VARCHAR(10) NOT NULL DEFAULT 'email'`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN NOT NULL DEFAULT FALSE`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS gracz_registration_codes (
      user_id VARCHAR(32) PRIMARY KEY REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
      code_hash BYTEA NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts SMALLINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await this.pool.query(`UPDATE gracz_accounts SET contact_verified=TRUE WHERE contact_verified=FALSE AND NOT EXISTS (SELECT 1 FROM gracz_registration_codes c WHERE c.user_id=gracz_accounts.user_id)`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS gracz_password_reset_tokens (
      token_hash BYTEA PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_password_reset_user_idx ON gracz_password_reset_tokens(user_id, created_at DESC)`);
  }

  async checkAvailability({ userId, displayName } = {}) {
    await this.ready;
    const normalizedId = typeof userId === "string" && /^[a-zA-Z0-9._-]{3,32}$/.test(userId.trim())
      ? userId.trim().toLowerCase()
      : null;
    const safeDisplayName = typeof displayName === "string" && displayName.trim().length >= 2 && displayName.trim().length <= 40
      ? displayName.trim().replace(/\s+/g, " ")
      : null;
    const { rows } = await this.pool.query(`SELECT
      CASE WHEN $1::text IS NULL THEN NULL ELSE EXISTS(SELECT 1 FROM gracz_accounts WHERE user_id=$1) END AS user_taken,
      CASE WHEN $2::text IS NULL THEN NULL ELSE EXISTS(SELECT 1 FROM gracz_accounts WHERE lower(display_name)=lower($2)) END AS display_taken`,
      [normalizedId, safeDisplayName]);
    return Object.freeze({
      userId: normalizedId === null ? null : !rows[0].user_taken,
      displayName: safeDisplayName === null ? null : !rows[0].display_taken,
    });
  }

  async register(input) {
    await this.ready;
    assertRegistrationLooksHuman(input);
    validatePassword(input?.password);
    const phone = cleanPhone(input?.phone);
    const verificationChannel = normalizeVerificationChannel(input?.verificationChannel);
    if (verificationChannel === "sms" && !phone) throw new AccountError("Aby otrzymać kod SMS, wpisz prawidłowy numer telefonu.", "INVALID_PHONE");
    const account = await this.base.register(input);
    try {
      await this.#setCurrentPassword(account.userId, input.password);
      await this.pool.query(`UPDATE gracz_accounts SET phone=$2, verification_channel=$3, contact_verified=FALSE WHERE user_id=$1`, [account.userId, phone || null, verificationChannel]);
      await this.#sendRegistrationCode(account.userId);
      const destination = verificationChannel === "sms" ? "SMS na podany numer telefonu" : "wiadomości e-mail na podany adres";
      throw new AccountError(`Kod aktywacyjny został wysłany w ${destination}. Wpisz 6 cyfr, aby aktywować konto.`, "VERIFICATION_REQUIRED");
    } catch (error) {
      if (error?.code !== "VERIFICATION_REQUIRED") await this.pool.query(`DELETE FROM gracz_accounts WHERE user_id=$1 AND contact_verified=FALSE`, [account.userId]).catch(() => {});
      throw error;
    }
  }

  async #sendRegistrationCode(userId) {
    const { rows } = await this.pool.query(`SELECT user_id,display_name,email,phone,verification_channel,contact_verified FROM gracz_accounts WHERE user_id=$1`, [userId]);
    const account = rows[0];
    if (!account || account.contact_verified) return { ok: true };
    const code = String(randomInt(100000, 1000000));
    await this.pool.query(`INSERT INTO gracz_registration_codes(user_id,code_hash,expires_at,attempts,created_at)
      VALUES($1,$2,NOW()+INTERVAL '10 minutes',0,NOW())
      ON CONFLICT(user_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,created_at=NOW()`, [userId, hashToken(code)]);
    if (account.verification_channel === "sms") {
      const phone = cleanPhone(account.phone);
      if (!phone) throw new AccountError("Do aktywacji SMS wymagany jest prawidłowy numer telefonu.", "INVALID_PHONE");
      await sendVerificationSms({ to: phone, displayName: account.display_name, code });
    } else {
      const email = cleanEmail(account.email);
      if (!email) throw new AccountError("Do aktywacji konta wymagany jest prawidłowy adres e-mail.", "EMAIL_REQUIRED");
      await sendVerificationEmail({ to: email, displayName: account.display_name, code });
    }
    return { ok: true };
  }

  async verifyRegistrationCode({ userId, code }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    const safeCode = String(code ?? "").trim();
    if (!/^\d{6}$/.test(safeCode)) throw new AccountError("Kod aktywacyjny musi mieć 6 cyfr.", "INVALID_VERIFICATION_CODE");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(`SELECT a.user_id,a.display_name,c.code_hash,c.expires_at,c.attempts
        FROM gracz_accounts a JOIN gracz_registration_codes c ON c.user_id=a.user_id
        WHERE a.user_id=$1 FOR UPDATE OF c`, [normalizedId]);
      const record = rows[0];
      if (!record || new Date(record.expires_at).getTime() <= Date.now() || Number(record.attempts) >= 5) throw new AccountError("Kod aktywacyjny wygasł. Załóż konto ponownie, aby otrzymać nowy kod.", "VERIFICATION_EXPIRED");
      const actual = hashToken(safeCode);
      if (record.code_hash.length !== actual.length || !timingSafeEqual(record.code_hash, actual)) {
        await client.query(`UPDATE gracz_registration_codes SET attempts=attempts+1 WHERE user_id=$1`, [normalizedId]);
        throw new AccountError("Nieprawidłowy kod aktywacyjny.", "INVALID_VERIFICATION_CODE");
      }
      await client.query(`UPDATE gracz_accounts SET contact_verified=TRUE WHERE user_id=$1`, [normalizedId]);
      await client.query(`DELETE FROM gracz_registration_codes WHERE user_id=$1`, [normalizedId]);
      await client.query("COMMIT");
      return Object.freeze({ userId: record.user_id, displayName: record.display_name });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async authenticate({ userId, password, verificationCode }) {
    await this.ready;
    if (verificationCode !== undefined) return this.verifyRegistrationCode({ userId, code: verificationCode });
    const normalizedId = normalizeUserId(userId);
    const { rows } = await this.pool.query(`SELECT user_id,display_name,salt,password_hash,password_hash_version,contact_verified FROM gracz_accounts WHERE user_id=$1`, [normalizedId]);
    const record = rows[0];
    const salt = record?.salt ?? Buffer.alloc(16), expected = record?.password_hash ?? Buffer.alloc(64);
    const version = Number(record?.password_hash_version ?? 1), params = version >= HASH_VERSION ? CURRENT_SCRYPT : LEGACY_SCRYPT;
    const actual = await hashPassword(typeof password === "string" ? password : "", salt, params);
    if (!record || expected.length !== actual.length || !timingSafeEqual(actual, expected)) throw new AccountError("Nieprawidłowy login lub hasło.", "INVALID_CREDENTIALS");
    if (!record.contact_verified) throw new AccountError("Konto oczekuje na potwierdzenie kodem aktywacyjnym.", "ACCOUNT_NOT_VERIFIED");
    if (version < HASH_VERSION) await this.#setCurrentPassword(record.user_id, password);
    return Object.freeze({ userId: record.user_id, displayName: record.display_name });
  }

  async requestPasswordReset({ userId, email } = {}) {
    await this.ready;
    let normalizedId;
    try { normalizedId = normalizeUserId(userId); } catch { return { ok: true }; }
    const safeEmail = cleanEmail(email);
    if (!safeEmail) return { ok: true };
    const { rows } = await this.pool.query(
      `SELECT user_id,display_name,email,recovery_email FROM gracz_accounts
       WHERE user_id=$1 AND (lower(email)=lower($2) OR lower(recovery_email)=lower($2))`,
      [normalizedId, safeEmail],
    );
    const account = rows[0];
    if (!account) return { ok: true };
    const code = String(randomInt(100000, 1000000));
    await this.pool.query(`DELETE FROM gracz_password_reset_tokens WHERE user_id=$1 OR expires_at<NOW()`, [normalizedId]);
    await this.pool.query(
      `INSERT INTO gracz_password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '10 minutes')`,
      [hashToken(code), normalizedId],
    );
    await sendPasswordResetEmail({ to: safeEmail, displayName: account.display_name, code });
    return { ok: true };
  }

  async createPasswordResetToken({ userId, email, phone, verificationChannel = "email" }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId), channel = normalizeVerificationChannel(verificationChannel), safeEmail = cleanEmail(email), safePhone = cleanPhone(phone);
    const { rows } = await this.pool.query(`SELECT user_id FROM gracz_accounts WHERE user_id=$1 AND (($2='email' AND (lower(email)=lower($3) OR lower(recovery_email)=lower($3))) OR ($2='sms' AND phone=$4))`, [normalizedId, channel, safeEmail, safePhone]);
    if (!rows[0]) return { ok: true, token: null, channel };
    const token = randomBytes(32).toString("base64url"), tokenHash = hashToken(token);
    await this.pool.query(`DELETE FROM gracz_password_reset_tokens WHERE user_id=$1 OR expires_at < NOW()`, [normalizedId]);
    await this.pool.query(`INSERT INTO gracz_password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '15 minutes')`, [tokenHash, normalizedId]);
    return { ok: true, token, channel };
  }

  async resetPasswordWithEmail({ userId, email, phone, verificationChannel = "email", newPassword, token }) {
    await this.ready;
    if (typeof token !== "string" || (!/^\\d{6}$/.test(token.trim()) && token.length < 32)) throw new AccountError("Wpisz prawidłowy 6-cyfrowy kod odzyskiwania.", "RECOVERY_TOKEN_REQUIRED");
    validatePassword(newPassword);
    const normalizedId = normalizeUserId(userId), channel = normalizeVerificationChannel(verificationChannel), safeEmail = cleanEmail(email), safePhone = cleanPhone(phone);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(`SELECT t.user_id FROM gracz_password_reset_tokens t JOIN gracz_accounts a ON a.user_id=t.user_id WHERE t.token_hash=$1 AND t.user_id=$2 AND t.used_at IS NULL AND t.expires_at>NOW() AND (($3='email' AND (lower(a.email)=lower($4) OR lower(a.recovery_email)=lower($4))) OR ($3='sms' AND a.phone=$5)) FOR UPDATE`, [hashToken(token), normalizedId, channel, safeEmail, safePhone]);
      if (!rows[0]) throw new AccountError("Kod resetu jest nieprawidłowy albo wygasł.", "RECOVERY_FAILED");
      const salt = randomBytes(16), passwordHash = await hashPassword(newPassword, salt, CURRENT_SCRYPT);
      await client.query(`UPDATE gracz_accounts SET salt=$2,password_hash=$3,password_hash_version=$4 WHERE user_id=$1`, [normalizedId, salt, passwordHash, HASH_VERSION]);
      await client.query(`UPDATE gracz_password_reset_tokens SET used_at=NOW() WHERE token_hash=$1`, [hashToken(token)]);
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; } finally { client.release(); }
  }

  async #setCurrentPassword(userId, password) {
    validatePassword(password);
    const salt = randomBytes(16), passwordHash = await hashPassword(password, salt, CURRENT_SCRYPT);
    await this.pool.query(`UPDATE gracz_accounts SET salt=$2,password_hash=$3,password_hash_version=$4 WHERE user_id=$1`, [userId, salt, passwordHash, HASH_VERSION]);
  }

  getProfile(...args) { return this.base.getProfile(...args); }
  updateProfile(...args) { return this.base.updateProfile(...args); }
  searchPlayers(...args) { return this.base.searchPlayers(...args); }
  sendPrivateMessage(...args) { return this.base.sendPrivateMessage(...args); }
  listPrivateMessages(...args) { return this.base.listPrivateMessages(...args); }
  updatePrivateMessage(...args) { return this.base.updatePrivateMessage(...args); }
  deletePrivateMessage(...args) { return this.base.deletePrivateMessage(...args); }
  async close() { await Promise.allSettled([typeof this.base.close === "function" ? this.base.close() : Promise.resolve(), this.pool.end()]); }
}

async function sendPasswordResetEmail({ to, displayName, code }) {
  const name = String(displayName || "Graczu").trim().slice(0, 40) || "Graczu";
  const text = `Witaj ${name}!\n\nKod odzyskiwania hasła w serwisie gracz.pl: ${code}\n\nKod jest ważny przez 10 minut. Jeśli nie prosiłeś o zmianę hasła, zignoruj tę wiadomość.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>Odzyskiwanie hasła</h1><p>Witaj, ${escapeHtml(name)}. Twój kod odzyskiwania:</p><p style="font-size:34px;font-weight:900;letter-spacing:8px">${escapeHtml(code)}</p><p>Kod jest ważny przez 10 minut. Nigdy nie przekazuj go innej osobie.</p></div>`;
  const result = await systemMail.send({ to, subject: "gracz.pl — kod odzyskiwania hasła", text, html, purpose: "password-reset" });
  if (!result.sent) throw new AccountError("Nie udało się wysłać kodu odzyskiwania. Spróbuj ponownie później.", "EMAIL_SEND_FAILED");
}

async function sendVerificationEmail({ to, displayName, code }) {
  const name = String(displayName || "Graczu").trim().slice(0, 40) || "Graczu";
  const text = `Witaj ${name}!\n\nTwój kod aktywacyjny Gracz.pl: ${code}\n\nKod jest ważny przez 10 minut. Nigdy nie przekazuj go innej osobie. Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h1>Witaj, ${escapeHtml(name)}!</h1><p>Aby aktywować konto Gracz.pl, wpisz poniższy kod:</p><p style="font-size:34px;font-weight:900;letter-spacing:8px">${escapeHtml(code)}</p><p>Kod jest ważny przez 10 minut. Administracja Gracz.pl nigdy nie prosi o hasło ani kod aktywacyjny.</p></div>`;
  try {
    const result = await systemMail.send({ to, subject: "Witaj w Gracz.pl — Twój kod aktywacyjny", text, html, purpose: "account-verify" });
    if (!result.sent) throw new Error(result.reason || "EMAIL_NOT_CONFIGURED");
  } catch {
    throw new AccountError("Nie udało się wysłać kodu aktywacyjnego. Spróbuj ponownie później.", "EMAIL_SEND_FAILED");
  }
}

async function sendVerificationSms({ to, displayName, code }) {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID ?? "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN ?? "").trim();
  const from = String(process.env.TWILIO_FROM_NUMBER ?? "").trim();
  if (!accountSid || !authToken || !from) throw new AccountError("Wysyłka SMS nie jest jeszcze skonfigurowana na serwerze.", "SMS_NOT_CONFIGURED");
  const name = String(displayName || "Graczu").trim().slice(0, 40);
  const body = `Gracz.pl: Witaj ${name}! Twój kod aktywacyjny to ${code}. Kod jest ważny 10 minut. Nie udostępniaj go nikomu.`;
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`, "utf8").toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new AccountError("Nie udało się wysłać kodu SMS. Spróbuj ponownie później.", "SMS_SEND_FAILED");
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); }
export async function hashPasswordV2(password, salt) { return hashPassword(password, salt, CURRENT_SCRYPT); }
async function hashPassword(password, salt, params) { return scrypt(password, salt, 64, params); }
function hashToken(token) { return createHash("sha256").update(token, "utf8").digest(); }
function normalizeUserId(value) { if (typeof value !== "string" || !/^[a-zA-Z0-9._-]{3,32}$/.test(value)) throw new AccountError("Nieprawidłowy login.", "INVALID_ACCOUNT"); return value.toLowerCase(); }
function cleanEmail(value) { return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : ""; }
function cleanPhone(value) { if (typeof value !== "string") return ""; const normalized = value.trim().replace(/[\s()-]/g, ""); if (!normalized) return ""; return /^\+?[0-9]{7,15}$/.test(normalized) ? normalized : ""; }
function normalizeVerificationChannel(value) { return value === "sms" ? "sms" : "email"; }
function assertRegistrationLooksHuman(input) { if (!input || typeof input !== "object") throw new AccountError("Nieprawidłowe dane rejestracji.", "INVALID_ACCOUNT"); if (typeof input.website === "string" && input.website.trim()) throw new AccountError("Nie można utworzyć konta.", "AUTOMATION_REJECTED"); }
function validatePassword(value) { if (typeof value !== "string" || value.length < 15 || value.length > 128) throw new AccountError("Hasło musi mieć 15–128 znaków.", "WEAK_PASSWORD"); const normalized = value.normalize("NFKC").toLowerCase(); if (COMMON_PASSWORDS.has(normalized) || /^(.)\1{14,}$/.test(normalized) || /^123456/.test(normalized)) throw new AccountError("To hasło jest zbyt popularne lub łatwe do odgadnięcia. Wybierz inne.", "WEAK_PASSWORD"); }

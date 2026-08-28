import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { AccountError } from "./accounts.js";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const MESSAGE_PREFIX = "enc:v1:";

export class PostgresAccountService {
  constructor(connectionString, encryptionSecret) {
    if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany dla PostgreSQL.");
    if (typeof encryptionSecret !== "string" || encryptionSecret.length < 32) throw new TypeError("Sekret szyfrowania wiadomości musi mieć co najmniej 32 znaki.");
    this.messageKey = Buffer.from(hkdfSync(
      "sha256",
      Buffer.from(encryptionSecret, "utf8"),
      Buffer.from("gracz.pl/messages/v1", "utf8"),
      Buffer.from("private-message-encryption", "utf8"),
      32,
    ));
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_messages (
        message_id UUID PRIMARY KEY,
        sender_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
        recipient_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
        subject VARCHAR(120) NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ,
        recipient_archived BOOLEAN NOT NULL DEFAULT FALSE,
        sender_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        recipient_deleted BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await this.pool.query(`ALTER TABLE gracz_messages ALTER COLUMN subject TYPE TEXT`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_messages_recipient_idx ON gracz_messages(recipient_id, created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_messages_sender_idx ON gracz_messages(sender_id, created_at DESC)`);
  }

  async register({ userId, displayName, password, email = "", recoveryEmail = "", twoFactor = false }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    const safeDisplayName = normalizeDisplayName(displayName);
    validatePassword(password);
    const salt = randomBytes(16);
    const passwordHash = await hashPassword(password, salt);
    const safeEmail = cleanEmail(email);
    const safeRecoveryEmail = cleanEmail(recoveryEmail);
    const profile = defaultProfile({ twoFactor });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext(lower($1)))", [safeDisplayName]);
      const duplicateName = await client.query("SELECT 1 FROM gracz_accounts WHERE lower(display_name)=lower($1) LIMIT 1", [safeDisplayName]);
      if (duplicateName.rowCount) throw new AccountError("Ta nazwa gracza jest już zajęta. Wybierz inną nazwę.", "DISPLAY_NAME_EXISTS");
      if (safeEmail) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`email:${safeEmail}`]);
        const duplicateEmail = await client.query("SELECT 1 FROM gracz_accounts WHERE lower(email)=lower($1) LIMIT 1", [safeEmail]);
        if (duplicateEmail.rowCount) throw new AccountError("Ten adres e-mail jest już przypisany do innego konta.", "EMAIL_EXISTS");
      }
      await client.query(
        `INSERT INTO gracz_accounts (user_id, display_name, salt, password_hash, email, recovery_email, profile_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [normalizedId, safeDisplayName, salt, passwordHash, safeEmail || null, safeRecoveryEmail || null, JSON.stringify(profile)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error?.code === "23505") throw new AccountError("Takie konto już istnieje.", "ACCOUNT_EXISTS");
      throw error;
    } finally {
      client.release();
    }
    return Object.freeze({ userId: normalizedId, displayName: safeDisplayName });
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

  async resetPasswordWithEmail({ userId, email, newPassword }) {
    await this.ready;
    const normalizedId = normalizeUserId(userId);
    const safeEmail = cleanEmail(email);
    if (!safeEmail || !isEmail(safeEmail)) throw new AccountError("Podaj prawidłowy adres e-mail.", "INVALID_ACCOUNT");
    validatePassword(newPassword);
    const { rows } = await this.pool.query(
      `SELECT user_id, email, recovery_email FROM gracz_accounts WHERE user_id=$1`,
      [normalizedId],
    );
    const account = rows[0];
    const matches = account && [account.email, account.recovery_email].filter(Boolean).some((value) => String(value).toLowerCase() === safeEmail);
    if (!matches) throw new AccountError("Nie udało się potwierdzić danych konta.", "RECOVERY_FAILED");
    const salt = randomBytes(16);
    const passwordHash = await hashPassword(newPassword, salt);
    await this.pool.query(`UPDATE gracz_accounts SET salt=$2, password_hash=$3 WHERE user_id=$1`, [normalizedId, salt, passwordHash]);
    return { ok: true };
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
    const displayName = normalizeDisplayName(input.displayName);
    const email = cleanEmail(input.email);
    const recoveryEmail = cleanEmail(input.recoveryEmail);
    if (email && !isEmail(email)) throw new AccountError("Podaj prawidłowy adres e-mail.", "INVALID_ACCOUNT");
    if (recoveryEmail && !isEmail(recoveryEmail)) throw new AccountError("Podaj prawidłowy e-mail odzyskiwania.", "INVALID_ACCOUNT");
    if (email && recoveryEmail && email === recoveryEmail) throw new AccountError("E-mail odzyskiwania musi być inny niż główny.", "INVALID_ACCOUNT");
    const profile = sanitizeProfile(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext(lower($1)))", [displayName]);
      const duplicateName = await client.query(
        "SELECT 1 FROM gracz_accounts WHERE lower(display_name)=lower($1) AND user_id<>$2 LIMIT 1",
        [displayName, normalizedId],
      );
      if (duplicateName.rowCount) throw new AccountError("Ta nazwa gracza jest już zajęta. Wybierz inną nazwę.", "DISPLAY_NAME_EXISTS");
      if (email) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`email:${email}`]);
        const duplicateEmail = await client.query(
          "SELECT 1 FROM gracz_accounts WHERE lower(email)=lower($1) AND user_id<>$2 LIMIT 1",
          [email, normalizedId],
        );
        if (duplicateEmail.rowCount) throw new AccountError("Ten adres e-mail jest już przypisany do innego konta.", "EMAIL_EXISTS");
      }
      const { rows } = await client.query(
        `UPDATE gracz_accounts
         SET display_name=$2, email=$3, recovery_email=$4, profile_data=$5::jsonb
         WHERE user_id=$1
         RETURNING user_id, display_name, email, recovery_email, created_at, profile_data`,
        [normalizedId, displayName, email || null, recoveryEmail || null, JSON.stringify(profile)],
      );
      if (!rows[0]) throw new AccountError("Nie znaleziono konta.", "ACCOUNT_NOT_FOUND");
      await client.query("COMMIT");
      return publicProfile(rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async searchPlayers(currentUserId, query = "") {
    await this.ready;
    const current = normalizeUserId(currentUserId);
    const q = String(query ?? "").trim().slice(0, 40);
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const { rows } = await this.pool.query(
      `SELECT DISTINCT ON (lower(display_name)) user_id, display_name, profile_data, created_at
       FROM gracz_accounts
       WHERE user_id <> $1
         AND (user_id ILIKE $2 ESCAPE '\\' OR display_name ILIKE $2 ESCAPE '\\')
       ORDER BY lower(display_name), created_at ASC, user_id ASC
       LIMIT 20`,
      [current, pattern],
    );
    return rows.map((row) => ({ userId: row.user_id, displayName: row.display_name, allowMessages: row.profile_data?.allowMessages !== false }));
  }

  async sendPrivateMessage(senderId, input = {}) {
    await this.ready;
    const sender = normalizeUserId(senderId);
    const recipient = normalizeUserId(input.recipientId);
    if (sender === recipient) throw new AccountError("Nie możesz wysłać wiadomości do samego siebie.", "INVALID_MESSAGE");
    const subject = String(input.subject ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
    const body = String(input.body ?? "").trim().slice(0, 5000);
    if (!subject) throw new AccountError("Wpisz temat wiadomości.", "INVALID_MESSAGE");
    if (!body) throw new AccountError("Wpisz treść wiadomości.", "INVALID_MESSAGE");
    const { rows: recipients } = await this.pool.query(`SELECT user_id, display_name, profile_data FROM gracz_accounts WHERE user_id=$1`, [recipient]);
    const target = recipients[0];
    if (!target) throw new AccountError("Nie znaleziono odbiorcy.", "ACCOUNT_NOT_FOUND");
    if (target.profile_data?.allowMessages === false) throw new AccountError("Ten gracz nie przyjmuje prywatnych wiadomości.", "MESSAGES_DISABLED");
    const messageId = randomUUID();
    const encryptedSubject = encryptMessageText(subject, this.messageKey, messageId, "subject");
    const encryptedBody = encryptMessageText(body, this.messageKey, messageId, "body");
    const { rows } = await this.pool.query(
      `INSERT INTO gracz_messages (message_id, sender_id, recipient_id, subject, body)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING message_id, sender_id, recipient_id, subject, body, created_at, read_at`,
      [messageId, sender, recipient, encryptedSubject, encryptedBody],
    );
    return messageRow(rows[0], { senderName: null, recipientName: target.display_name }, this.messageKey);
  }

  async listPrivateMessages(userId, folder = "inbox") {
    await this.ready;
    const id = normalizeUserId(userId);
    const safeFolder = ["inbox", "unread", "sent", "archive"].includes(folder) ? folder : "inbox";
    let where = "m.recipient_id=$1 AND m.recipient_deleted=FALSE AND m.recipient_archived=FALSE";
    if (safeFolder === "unread") where += " AND m.read_at IS NULL";
    if (safeFolder === "archive") where = "m.recipient_id=$1 AND m.recipient_deleted=FALSE AND m.recipient_archived=TRUE";
    if (safeFolder === "sent") where = "m.sender_id=$1 AND m.sender_deleted=FALSE";
    const { rows } = await this.pool.query(
      `SELECT m.message_id, m.sender_id, m.recipient_id, m.subject, m.body, m.created_at, m.read_at,
              s.display_name AS sender_name, r.display_name AS recipient_name
       FROM gracz_messages m
       JOIN gracz_accounts s ON s.user_id=m.sender_id
       JOIN gracz_accounts r ON r.user_id=m.recipient_id
       WHERE ${where}
       ORDER BY m.created_at DESC LIMIT 100`,
      [id],
    );
    const unread = await this.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_messages WHERE recipient_id=$1 AND recipient_deleted=FALSE AND read_at IS NULL`, [id]);
    return { folder: safeFolder, unreadCount: unread.rows[0]?.count ?? 0, messages: rows.map((row) => messageRow(row, {}, this.messageKey)) };
  }

  async updatePrivateMessage(userId, messageId, action) {
    await this.ready;
    const id = normalizeUserId(userId);
    if (!/^[0-9a-f-]{36}$/i.test(String(messageId))) throw new AccountError("Nieprawidłowy identyfikator wiadomości.", "INVALID_MESSAGE");
    if (action === "read") {
      const { rowCount } = await this.pool.query(`UPDATE gracz_messages SET read_at=COALESCE(read_at,NOW()) WHERE message_id=$1 AND recipient_id=$2 AND recipient_deleted=FALSE`, [messageId, id]);
      if (!rowCount) throw new AccountError("Nie znaleziono wiadomości.", "MESSAGE_NOT_FOUND");
      return { ok: true };
    }
    if (action === "archive" || action === "unarchive") {
      const { rowCount } = await this.pool.query(`UPDATE gracz_messages SET recipient_archived=$3 WHERE message_id=$1 AND recipient_id=$2 AND recipient_deleted=FALSE`, [messageId, id, action === "archive"]);
      if (!rowCount) throw new AccountError("Nie znaleziono wiadomości.", "MESSAGE_NOT_FOUND");
      return { ok: true };
    }
    throw new AccountError("Nieprawidłowa operacja na wiadomości.", "INVALID_MESSAGE");
  }

  async deletePrivateMessage(userId, messageId) {
    await this.ready;
    const id = normalizeUserId(userId);
    if (!/^[0-9a-f-]{36}$/i.test(String(messageId))) throw new AccountError("Nieprawidłowy identyfikator wiadomości.", "INVALID_MESSAGE");
    const { rows } = await this.pool.query(`SELECT sender_id, recipient_id FROM gracz_messages WHERE message_id=$1`, [messageId]);
    const message = rows[0];
    if (!message || (message.sender_id !== id && message.recipient_id !== id)) throw new AccountError("Nie znaleziono wiadomości.", "MESSAGE_NOT_FOUND");
    if (message.sender_id === id) await this.pool.query(`UPDATE gracz_messages SET sender_deleted=TRUE WHERE message_id=$1`, [messageId]);
    if (message.recipient_id === id) await this.pool.query(`UPDATE gracz_messages SET recipient_deleted=TRUE WHERE message_id=$1`, [messageId]);
    await this.pool.query(`DELETE FROM gracz_messages WHERE message_id=$1 AND sender_deleted=TRUE AND recipient_deleted=TRUE`, [messageId]);
    return { ok: true };
  }

  async close() { await this.pool.end(); }
}

const BLOCKED_PASSWORDS = new Set([
  "password", "password1", "password123", "qwerty", "qwerty123", "1234567890", "123456789", "12345678",
  "admin", "administrator", "letmein", "welcome", "welcome123", "iloveyou", "abc123", "zaq12wsx",
  "haslo", "haslo123", "haslo1234", "haslo2026", "gracz", "gracz123", "gracz1234", "gracz2026",
  "graczpl", "gracz.pl", "test123456", "testtest", "socharomario2010", "socharomario2010@"
]);

function encryptMessageText(value, key, messageId, field) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${messageId}:${field}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${MESSAGE_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptMessageText(value, key, messageId, field) {
  const text = String(value ?? "");
  if (!text.startsWith(MESSAGE_PREFIX)) return text;
  try {
    const payload = text.slice(MESSAGE_PREFIX.length);
    const [ivPart, tagPart, cipherPart] = payload.split(".");
    if (!ivPart || !tagPart || cipherPart === undefined) throw new Error("invalid encrypted payload");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAAD(Buffer.from(`${messageId}:${field}`, "utf8"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "[Nie można odszyfrować tej wiadomości]";
  }
}

async function hashPassword(password, salt) { return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }); }
function normalizeUserId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]{3,32}$/.test(value)) throw new AccountError("Login musi mieć 3–32 znaki: litery, cyfry, kropkę, _ lub -.", "INVALID_ACCOUNT");
  return value.toLowerCase();
}
function normalizeDisplayName(value) {
  validateDisplayName(value);
  return value.trim().replace(/\s+/g, " ");
}
function validateDisplayName(value) { if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 40) throw new AccountError("Nazwa gracza musi mieć 2–40 znaków.", "INVALID_ACCOUNT"); }
function validatePassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) throw new AccountError("Hasło musi mieć co najmniej 10 znaków.", "WEAK_PASSWORD");
  const normalized = value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const simplified = normalized.replace(/[^a-z0-9ąćęłńóśźż.]/g, "");
  if (BLOCKED_PASSWORDS.has(normalized) || BLOCKED_PASSWORDS.has(simplified)) {
    throw new AccountError("To hasło jest zbyt popularne lub przewidywalne. Wybierz inne, unikalne hasło.", "WEAK_PASSWORD");
  }
  if (/^(.)\1{9,}$/.test(normalized) || /^(0123456789|1234567890|9876543210)/.test(normalized)) {
    throw new AccountError("To hasło jest zbyt łatwe do odgadnięcia. Wybierz inne hasło.", "WEAK_PASSWORD");
  }
}
function cleanEmail(value) { return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : ""; }
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value); }
function defaultProfile({ twoFactor = false } = {}) { return { bio: "", country: "PL", city: "", language: "pl", showOnline: true, allowInvites: true, allowMessages: true, newsletter: false, twoFactor: Boolean(twoFactor) }; }
function sanitizeProfile(input) {
  return {
    bio: String(input.bio ?? "").trim().slice(0, 280), country: String(input.country ?? "PL").trim().slice(0, 2).toUpperCase(), city: String(input.city ?? "").trim().slice(0, 60),
    language: ["pl", "en", "de"].includes(input.language) ? input.language : "pl", showOnline: input.showOnline !== false, allowInvites: input.allowInvites !== false,
    allowMessages: input.allowMessages !== false, newsletter: input.newsletter === true, twoFactor: input.twoFactor === true,
  };
}
function publicProfile(row) {
  return Object.freeze({ userId: row.user_id, displayName: row.display_name, email: row.email ?? "", recoveryEmail: row.recovery_email ?? "", createdAt: row.created_at, ...defaultProfile(), ...(row.profile_data ?? {}) });
}
function messageRow(row, names = {}, messageKey = null) {
  const messageId = row.message_id;
  const subject = messageKey ? decryptMessageText(row.subject, messageKey, messageId, "subject") : row.subject;
  const body = messageKey ? decryptMessageText(row.body, messageKey, messageId, "body") : row.body;
  return Object.freeze({ messageId, senderId: row.sender_id, senderName: row.sender_name ?? names.senderName ?? row.sender_id, recipientId: row.recipient_id, recipientName: row.recipient_name ?? names.recipientName ?? row.recipient_id, subject, body, createdAt: row.created_at, readAt: row.read_at });
}

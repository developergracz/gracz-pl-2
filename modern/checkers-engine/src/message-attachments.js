import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import pg from "pg";
import { AccountError } from "./accounts.js";

const { Pool } = pg;
const MAX_ATTACHMENT_BYTES = 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg"]);

export class MessageAttachmentService {
  constructor(connectionString, encryptionSecret) {
    if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany.");
    if (typeof encryptionSecret !== "string" || encryptionSecret.length < 32) throw new TypeError("Sekret szyfrowania załączników musi mieć co najmniej 32 znaki.");
    this.key = Buffer.from(hkdfSync(
      "sha256",
      Buffer.from(encryptionSecret, "utf8"),
      Buffer.from("gracz.pl/message-attachments/v1", "utf8"),
      Buffer.from("private-message-attachment-encryption", "utf8"),
      32,
    ));
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
      max: 3,
    });
    this.ready = this.#initialize();
  }

  async #initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_message_attachments (
        message_id UUID PRIMARY KEY REFERENCES gracz_messages(message_id) ON DELETE CASCADE,
        file_name VARCHAR(120) NOT NULL,
        mime_type VARCHAR(32) NOT NULL,
        file_size INTEGER NOT NULL,
        iv BYTEA NOT NULL,
        auth_tag BYTEA NOT NULL,
        ciphertext BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async save(userId, messageId, input = {}) {
    await this.ready;
    assertMessageId(messageId);
    const { rows } = await this.pool.query("SELECT sender_id FROM gracz_messages WHERE message_id=$1", [messageId]);
    if (!rows[0]) throw new AccountError("Nie znaleziono wiadomości.", "MESSAGE_NOT_FOUND");
    if (rows[0].sender_id !== userId) throw new AccountError("Załącznik może dodać tylko nadawca wiadomości.", "INVALID_MESSAGE");

    const mimeType = String(input.mimeType ?? "").toLowerCase();
    if (!ALLOWED_TYPES.has(mimeType)) throw new AccountError("Dozwolone są tylko zrzuty ekranu PNG lub JPG/JPEG.", "INVALID_ATTACHMENT");
    const fileName = sanitizeName(input.fileName, mimeType);
    let data;
    try { data = Buffer.from(String(input.data ?? ""), "base64"); } catch { data = Buffer.alloc(0); }
    if (!data.length) throw new AccountError("Załącznik jest pusty.", "INVALID_ATTACHMENT");
    if (data.length > MAX_ATTACHMENT_BYTES) throw new AccountError("Zrzut ekranu może mieć maksymalnie 1 MB.", "INVALID_ATTACHMENT");
    if (!matchesSignature(data, mimeType)) throw new AccountError("Plik nie jest prawidłowym obrazem PNG lub JPG/JPEG.", "INVALID_ATTACHMENT");

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(`${messageId}:${mimeType}:${data.length}`, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    await this.pool.query(
      `INSERT INTO gracz_message_attachments (message_id,file_name,mime_type,file_size,iv,auth_tag,ciphertext)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (message_id) DO UPDATE SET file_name=EXCLUDED.file_name,mime_type=EXCLUDED.mime_type,file_size=EXCLUDED.file_size,iv=EXCLUDED.iv,auth_tag=EXCLUDED.auth_tag,ciphertext=EXCLUDED.ciphertext`,
      [messageId, fileName, mimeType, data.length, iv, authTag, ciphertext],
    );
    return { messageId, fileName, mimeType, fileSize: data.length };
  }

  async getMetaForMessages(messageIds = []) {
    await this.ready;
    if (!messageIds.length) return new Map();
    const { rows } = await this.pool.query(
      "SELECT message_id,file_name,mime_type,file_size FROM gracz_message_attachments WHERE message_id = ANY($1::uuid[])",
      [messageIds],
    );
    return new Map(rows.map((row) => [row.message_id, { fileName: row.file_name, mimeType: row.mime_type, fileSize: row.file_size }]));
  }

  async get(userId, messageId) {
    await this.ready;
    assertMessageId(messageId);
    const { rows } = await this.pool.query(
      `SELECT a.file_name,a.mime_type,a.file_size,a.iv,a.auth_tag,a.ciphertext,m.sender_id,m.recipient_id
       FROM gracz_message_attachments a JOIN gracz_messages m ON m.message_id=a.message_id WHERE a.message_id=$1`,
      [messageId],
    );
    const row = rows[0];
    if (!row || (row.sender_id !== userId && row.recipient_id !== userId)) throw new AccountError("Nie znaleziono załącznika.", "MESSAGE_NOT_FOUND");
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, row.iv);
      decipher.setAAD(Buffer.from(`${messageId}:${row.mime_type}:${row.file_size}`, "utf8"));
      decipher.setAuthTag(row.auth_tag);
      const clear = Buffer.concat([decipher.update(row.ciphertext), decipher.final()]);
      return { fileName: row.file_name, mimeType: row.mime_type, fileSize: row.file_size, data: clear.toString("base64") };
    } catch {
      throw new AccountError("Nie można odszyfrować załącznika.", "INVALID_ATTACHMENT");
    }
  }

  async close() { await this.pool.end(); }
}

function assertMessageId(value) {
  if (!/^[0-9a-f-]{36}$/i.test(String(value))) throw new AccountError("Nieprawidłowy identyfikator wiadomości.", "INVALID_MESSAGE");
}
function sanitizeName(value, mimeType) {
  const fallback = mimeType === "image/png" ? "zrzut-partii.png" : "zrzut-partii.jpg";
  const cleaned = String(value || fallback).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim().slice(0, 120);
  return cleaned || fallback;
}
function matchesSignature(data, mimeType) {
  if (mimeType === "image/png") return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
}

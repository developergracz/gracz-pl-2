import { createDecipheriv, hkdfSync } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const MESSAGE_PREFIX = "enc:v1:";
const DEFAULT_DB = "gracz_restore_test_20260828";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

const host = String(process.env.PGHOST || "127.0.0.1").trim();
const port = Number(process.env.PGPORT || 5433);
const user = String(process.env.PGUSER || "postgres").trim();
const database = String(process.env.PGDATABASE || DEFAULT_DB).trim();

const baseResult = {
  test: "crypto-decryptability-smoke-v1",
  database,
  readOnly: true,
};

if (!LOCAL_HOSTS.has(host) || database !== DEFAULT_DB) {
  printAndExit({
    ...baseResult,
    gate11Candidate: "NOT_VERIFIED",
    errorCode: "UNSAFE_TARGET_REJECTED",
  }, 2);
}

if (!Number.isInteger(port) || port < 1 || port > 65535 || !user) {
  printAndExit({
    ...baseResult,
    gate11Candidate: "NOT_VERIFIED",
    errorCode: "INVALID_LOCAL_DB_CONFIG",
  }, 2);
}

const pool = new Pool({
  host,
  port,
  user,
  password: process.env.PGPASSWORD,
  database,
  ssl: false,
  max: 1,
  application_name: "gracz-preflight-crypto-smoke",
  connectionTimeoutMillis: 10_000,
});

let client;
try {
  client = await pool.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

  const dbCheck = await client.query("SELECT current_database() AS database, current_setting('transaction_read_only') AS read_only");
  if (dbCheck.rows[0]?.database !== DEFAULT_DB || dbCheck.rows[0]?.read_only !== "on") {
    throw coded("READ_ONLY_TARGET_CHECK_FAILED");
  }

  const messageRows = (await client.query(
    `SELECT message_id::text, subject, body
       FROM public.gracz_messages
      ORDER BY message_id`,
  )).rows;

  const attachmentRows = (await client.query(
    `SELECT message_id::text, storage_name, mime_type, file_size, iv, auth_tag, ciphertext
       FROM public.gracz_message_attachments
      ORDER BY message_id`,
  )).rows;

  const mfaRows = (await client.query(
    `SELECT user_id, secret_iv, secret_tag, secret_ciphertext
       FROM public.gracz_mfa
      ORDER BY user_id`,
  )).rows;

  const messages = testMessages(messageRows, resolveEffectiveSecret("MESSAGE_ENCRYPTION_KEY"));
  const attachments = testAttachments(attachmentRows, resolveEffectiveSecret("ATTACHMENT_ENCRYPTION_KEY"));
  const mfa = testMfa(mfaRows, resolveEffectiveSecret("MFA_ENCRYPTION_KEY"));
  const gate11Candidate = aggregateGate([messages.status, attachments.status, mfa.status]);

  await client.query("ROLLBACK");

  const result = {
    ...baseResult,
    messages,
    attachments,
    mfa,
    gate11Candidate,
  };

  const exitCode = gate11Candidate === "FAIL" ? 1 : gate11Candidate === "NOT_VERIFIED" ? 2 : 0;
  printAndExit(result, exitCode);
} catch (error) {
  try { if (client) await client.query("ROLLBACK"); } catch {}
  printAndExit({
    ...baseResult,
    gate11Candidate: "NOT_VERIFIED",
    errorCode: safeErrorCode(error),
  }, 2);
} finally {
  client?.release();
  await pool.end().catch(() => {});
}

function testMessages(rows, secret) {
  let success = 0;
  let failure = 0;
  let legacyExpected = 0;
  let encryptedRecords = 0;

  if (rows.length === 0) return summary(0, 0, 0, { legacyExpected: 0, encryptedRecords: 0, status: "N/A" });

  for (const row of rows) {
    const subjectEncrypted = String(row.subject ?? "").startsWith(MESSAGE_PREFIX);
    const bodyEncrypted = String(row.body ?? "").startsWith(MESSAGE_PREFIX);

    if (!subjectEncrypted && !bodyEncrypted) {
      legacyExpected += 1;
      continue;
    }

    if (subjectEncrypted !== bodyEncrypted) {
      failure += 1;
      continue;
    }

    encryptedRecords += 1;
    if (!secret) continue;

    try {
      const key = deriveKey(secret, "gracz.pl/messages/v1", "private-message-encryption");
      decryptMessageEnvelope(row.subject, key, row.message_id, "subject");
      decryptMessageEnvelope(row.body, key, row.message_id, "body");
      success += 1;
    } catch {
      failure += 1;
    }
  }

  if (encryptedRecords > 0 && !secret) {
    return summary(rows.length, success, failure, {
      legacyExpected,
      encryptedRecords,
      status: "NOT_VERIFIED",
    });
  }

  const status = failure > 0 ? "FAIL" : legacyExpected > 0 ? "REVIEW" : "PASS";
  return summary(rows.length, success, failure, { legacyExpected, encryptedRecords, status });
}

function testAttachments(rows, secret) {
  let success = 0;
  let failure = 0;
  let legacyAadSuccess = 0;

  if (rows.length === 0) return summary(0, 0, 0, { legacyAadSuccess: 0, status: "N/A" });
  if (!secret) return summary(rows.length, 0, 0, { legacyAadSuccess: 0, status: "NOT_VERIFIED" });

  const key = deriveKey(secret, "gracz.pl/message-attachments/v1", "private-message-attachment-encryption");

  for (const row of rows) {
    try {
      const storageName = row.storage_name ? String(row.storage_name) : null;
      const aad = storageName
        ? `${row.message_id}:${storageName}:${row.mime_type}:${row.file_size}`
        : `${row.message_id}:${row.mime_type}:${row.file_size}`;

      const clear = decryptGcm({
        key,
        iv: row.iv,
        tag: row.auth_tag,
        ciphertext: row.ciphertext,
        aad,
      });

      if (clear.length !== Number(row.file_size) || !matchesSignature(clear, String(row.mime_type))) {
        throw coded("ATTACHMENT_PAYLOAD_VALIDATION_FAILED");
      }

      success += 1;
      if (!storageName) legacyAadSuccess += 1;
    } catch {
      failure += 1;
    }
  }

  const status = failure > 0 ? "FAIL" : legacyAadSuccess > 0 ? "REVIEW" : "PASS";
  return summary(rows.length, success, failure, { legacyAadSuccess, status });
}

function testMfa(rows, secret) {
  let success = 0;
  let failure = 0;

  if (rows.length === 0) return summary(0, 0, 0, { status: "N/A" });
  if (!secret) return summary(rows.length, 0, 0, { status: "NOT_VERIFIED" });

  const key = deriveKey(secret, "gracz.pl/mfa/v1", "totp-secret-encryption");

  for (const row of rows) {
    try {
      const clear = decryptGcm({
        key,
        iv: row.secret_iv,
        tag: row.secret_tag,
        ciphertext: row.secret_ciphertext,
        aad: String(row.user_id),
      }).toString("utf8");

      if (!/^[A-Z2-7]+$/.test(clear) || clear.length < 16 || clear.length > 128) {
        throw coded("MFA_SECRET_FORMAT_INVALID");
      }
      success += 1;
    } catch {
      failure += 1;
    }
  }

  return summary(rows.length, success, failure, { status: failure > 0 ? "FAIL" : "PASS" });
}

function decryptMessageEnvelope(value, key, messageId, field) {
  const text = String(value ?? "");
  if (!text.startsWith(MESSAGE_PREFIX)) throw coded("MESSAGE_NOT_ENCRYPTED");
  const [ivPart, tagPart, cipherPart] = text.slice(MESSAGE_PREFIX.length).split(".");
  if (!ivPart || !tagPart || cipherPart === undefined) throw coded("MESSAGE_ENVELOPE_INVALID");

  return decryptGcm({
    key,
    iv: Buffer.from(ivPart, "base64url"),
    tag: Buffer.from(tagPart, "base64url"),
    ciphertext: Buffer.from(cipherPart, "base64url"),
    aad: `${messageId}:${field}`,
  });
}

function decryptGcm({ key, iv, tag, ciphertext, aad }) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]);
}

function deriveKey(secret, salt, info) {
  return Buffer.from(hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.from(salt, "utf8"),
    Buffer.from(info, "utf8"),
    32,
  ));
}

function resolveEffectiveSecret(name) {
  const dedicated = process.env[name];
  if (dedicated !== undefined && dedicated !== null && dedicated !== "") {
    if (typeof dedicated !== "string" || dedicated.length < 32) throw coded(`${name}_INVALID`);
    return dedicated;
  }

  const fallback = process.env.AUTH_SECRET;
  if (fallback !== undefined && fallback !== null && fallback !== "") {
    if (typeof fallback !== "string" || fallback.length < 32) throw coded("AUTH_SECRET_INVALID");
    return fallback;
  }

  return null;
}

function matchesSignature(data, mimeType) {
  if (mimeType === "image/png") {
    return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/jpeg") {
    return data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9;
  }
  return false;
}

function summary(total, success, failure, extras = {}) {
  return { total, success, failure, ...extras };
}

function aggregateGate(statuses) {
  if (statuses.includes("FAIL")) return "FAIL";
  if (statuses.includes("NOT_VERIFIED")) return "NOT_VERIFIED";
  if (statuses.includes("REVIEW")) return "REVIEW";
  return "PASS";
}

function coded(code) {
  return Object.assign(new Error(code), { code });
}

function safeErrorCode(error) {
  const value = String(error?.code || error?.name || "UNKNOWN_ERROR").toUpperCase();
  return /^[A-Z0-9_.-]{1,96}$/.test(value) ? value : "UNKNOWN_ERROR";
}

function printAndExit(result, code) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = code;
}

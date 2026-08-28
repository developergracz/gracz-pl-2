import { createHash } from "node:crypto";
import pg from "pg";
import { loadConfig } from "../../src/config.js";
import { AuthService } from "../../src/auth.js";

const { Pool } = pg;
const config = loadConfig();
await import("../../src/main.js");

const result = await runSelfCheck().catch((error) => ({
  test: "runtime-crypto-selfcheck-v2",
  readOnlyProbe: true,
  gate11Candidate: "NOT_VERIFIED",
  errorCode: safeCode(error),
}));
console.log(`[preflight.crypto] ${JSON.stringify(result)}`);

async function runSelfCheck() {
  if (!config.databaseUrl) return { test: "runtime-crypto-selfcheck-v2", readOnlyProbe: true, gate11Candidate: "NOT_VERIFIED", errorCode: "DATABASE_URL_MISSING" };
  await waitForHealth();

  const pool = new Pool({ connectionString: config.databaseUrl, max: 1, application_name: "gracz-runtime-crypto-selfcheck" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15000ms'");

    const accounts = (await client.query("SELECT user_id, display_name FROM public.gracz_accounts ORDER BY user_id")).rows;
    const messageCipherRows = (await client.query("SELECT message_id::text, subject, body FROM public.gracz_messages ORDER BY message_id")).rows;
    const attachmentCipherRows = (await client.query("SELECT message_id::text, storage_name, mime_type, file_size, iv, auth_tag, ciphertext FROM public.gracz_message_attachments ORDER BY message_id")).rows;
    const mfaCount = Number((await client.query("SELECT COUNT(*)::int AS count FROM public.gracz_mfa")).rows[0]?.count || 0);

    const auth = new AuthService({ secret: config.authSecret, ttlSeconds: 300 });
    const seenMessages = new Set();
    const seenAttachments = new Set();
    let messageFailure = 0;
    let attachmentFailure = 0;

    for (const account of accounts) {
      const token = auth.issueGuest({ userId: account.user_id, displayName: account.display_name, ttlSeconds: 300 });
      for (const folder of ["inbox", "sent", "archive"]) {
        const response = await fetch(`http://127.0.0.1:${config.port}/messages?folder=${folder}`, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) { messageFailure += 1; continue; }
        const payload = await response.json();
        for (const message of payload.messages || []) {
          if (message?.messageId) seenMessages.add(message.messageId);
          if (message?.attachment && message?.messageId && !seenAttachments.has(message.messageId)) {
            const attachmentResponse = await fetch(`http://127.0.0.1:${config.port}/messages/${message.messageId}/attachment`, { headers: { authorization: `Bearer ${token}` } });
            if (attachmentResponse.ok) {
              const attachmentPayload = await attachmentResponse.json();
              if (attachmentPayload?.attachment?.data) seenAttachments.add(message.messageId);
              else attachmentFailure += 1;
            } else attachmentFailure += 1;
          }
        }
      }
    }

    const messages = {
      total: messageCipherRows.length,
      success: seenMessages.size,
      failure: messageFailure + Math.max(0, messageCipherRows.length - seenMessages.size),
      status: messageFailure === 0 && seenMessages.size === messageCipherRows.length ? "PASS" : "FAIL",
      ciphertextSha256: hashMessages(messageCipherRows),
    };
    const attachments = {
      total: attachmentCipherRows.length,
      success: seenAttachments.size,
      failure: attachmentFailure + Math.max(0, attachmentCipherRows.length - seenAttachments.size),
      status: attachmentFailure === 0 && seenAttachments.size === attachmentCipherRows.length ? "PASS" : "FAIL",
      ciphertextSha256: hashAttachments(attachmentCipherRows),
    };
    const mfa = {
      total: mfaCount,
      success: 0,
      failure: 0,
      status: mfaCount === 0 ? "N/A" : "NOT_VERIFIED",
    };

    await client.query("ROLLBACK");
    const statuses = [messages.status, attachments.status, mfa.status];
    const gate11Candidate = statuses.includes("FAIL") ? "FAIL" : statuses.includes("NOT_VERIFIED") ? "REVIEW" : "PASS";
    return { test: "runtime-crypto-selfcheck-v2", readOnlyProbe: true, messages, attachments, mfa, gate11Candidate };
  } finally {
    try { await client.query("ROLLBACK"); } catch {}
    client.release();
    await pool.end().catch(() => {});
  }
}

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${config.port}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Object.assign(new Error("HEALTH_TIMEOUT"), { code: "HEALTH_TIMEOUT" });
}

function hashMessages(rows) {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(`${row.message_id}\0${row.subject ?? ""}\0${row.body ?? ""}\n`);
  return hash.digest("hex");
}

function hashAttachments(rows) {
  const hash = createHash("sha256");
  for (const row of rows) {
    hash.update(`${row.message_id}\0${row.storage_name ?? ""}\0${row.mime_type ?? ""}\0${row.file_size}\0`);
    hash.update(Buffer.from(row.iv || []));
    hash.update(Buffer.from(row.auth_tag || []));
    hash.update(Buffer.from(row.ciphertext || []));
    hash.update("\n");
  }
  return hash.digest("hex");
}

function safeCode(error) {
  const value = String(error?.code || error?.name || "SELF_CHECK_ERROR").toUpperCase();
  return /^[A-Z0-9_.-]{1,96}$/.test(value) ? value : "SELF_CHECK_ERROR";
}

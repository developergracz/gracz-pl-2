import { createHash } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const EXPECTED_DB = "gracz_restore_test_20260828";
const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);

const config = {
  host: String(process.env.PGHOST || "127.0.0.1").trim(),
  port: Number(process.env.PGPORT || 5433),
  user: String(process.env.PGUSER || "postgres").trim(),
  password: process.env.PGPASSWORD,
  database: String(process.env.PGDATABASE || EXPECTED_DB).trim(),
};

function fail(code) {
  console.log(JSON.stringify({
    test: "crypto-ciphertext-fingerprint-v1",
    database: config.database,
    readOnly: true,
    status: "NOT_VERIFIED",
    errorCode: code,
  }, null, 2));
  process.exitCode = 1;
}

if (!allowedHosts.has(config.host)) {
  fail("LOCALHOST_REQUIRED");
} else if (config.database !== EXPECTED_DB) {
  fail("RESTORE_DATABASE_REQUIRED");
} else if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  fail("PGPORT_INVALID");
} else {
  await run().catch((error) => {
    const raw = String(error?.code || error?.name || "FINGERPRINT_ERROR").toUpperCase();
    const safe = /^[A-Z0-9_.-]{1,96}$/.test(raw) ? raw : "FINGERPRINT_ERROR";
    fail(safe);
  });
}

async function run() {
  const pool = new Pool({ ...config, max: 1, application_name: "gracz-local-ciphertext-fingerprint" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15000ms'");

    const messages = (await client.query(`
      SELECT message_id::text, subject, body
      FROM public.gracz_messages
      ORDER BY message_id
    `)).rows;

    const attachments = (await client.query(`
      SELECT message_id::text, storage_name, mime_type, file_size, iv, auth_tag, ciphertext
      FROM public.gracz_message_attachments
      ORDER BY message_id
    `)).rows;

    const result = {
      test: "crypto-ciphertext-fingerprint-v1",
      database: config.database,
      readOnly: true,
      messages: {
        total: messages.length,
        ciphertextSha256: hashMessages(messages),
      },
      attachments: {
        total: attachments.length,
        ciphertextSha256: hashAttachments(attachments),
      },
      status: "PASS",
    };

    await client.query("ROLLBACK");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    try { await client.query("ROLLBACK"); } catch {}
    client.release();
    await pool.end().catch(() => {});
  }
}

function hashMessages(rows) {
  const hash = createHash("sha256");
  for (const row of rows) {
    hash.update(`${row.message_id}\0${row.subject ?? ""}\0${row.body ?? ""}\n`);
  }
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

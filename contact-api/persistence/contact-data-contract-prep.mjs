import path from "node:path";
import { pathToFileURL } from "node:url";
import { createDatabase } from "./database.mjs";
import { createContactDataCrypto } from "../security/contact-data-crypto.mjs";

const EXECUTE_CONFIRMATION = "BACKFILL_CONTACT_DATA_V1";
const DEFAULT_BATCH_SIZE = 100;

function contractError(message, code = "CONTACT_DATA_CONTRACT_PREP_FAILED") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertDatabase(database) {
  if (!database?.enabled || typeof database.query !== "function") {
    throw contractError(
      "Durable persistence is not configured.",
      "PERSISTENCE_NOT_CONFIGURED"
    );
  }
}

function assertCrypto(contactCrypto) {
  if (!contactCrypto?.enabled) {
    throw contractError(
      "CONTACT_DATA_ENCRYPTION_SECRET is required.",
      "CONTACT_DATA_ENCRYPTION_NOT_CONFIGURED"
    );
  }
}

function normalizeBatchSize(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(500, parsed));
}

async function verifyEncryptedRows(database, contactCrypto, batchSize) {
  let afterCreatedAt = null;
  let afterRequestId = null;
  let verified = 0;

  for (;;) {
    const result = await database.query(
      `SELECT request_id, created_at, subject_ciphertext, source_path_ciphertext
       FROM contact_cases
       WHERE subject_ciphertext IS NOT NULL
         AND source_path_ciphertext IS NOT NULL
         AND (
           $1::timestamptz IS NULL
           OR created_at > $1::timestamptz
           OR (created_at = $1::timestamptz AND request_id > $2::uuid)
         )
       ORDER BY created_at ASC, request_id ASC
       LIMIT $3`,
      [afterCreatedAt, afterRequestId, batchSize]
    );

    if (result.rowCount === 0) break;

    for (const row of result.rows) {
      const requestId = String(row.request_id);
      contactCrypto.decrypt(row.subject_ciphertext, {
        aad: "contact-case:" + requestId + ":subject",
      });
      contactCrypto.decrypt(row.source_path_ciphertext, {
        aad: "contact-case:" + requestId + ":source",
      });
      verified += 1;
      afterCreatedAt = row.created_at;
      afterRequestId = requestId;
    }

    if (result.rowCount < batchSize) break;
  }

  return verified;
}

export async function inspectContactDataContractState(
  database,
  { contactCrypto, batchSize = DEFAULT_BATCH_SIZE } = {}
) {
  assertDatabase(database);
  assertCrypto(contactCrypto);

  const normalizedBatchSize = normalizeBatchSize(batchSize);
  const summary = await database.query(`
    SELECT
      count(*)::int AS total_rows,
      count(*) FILTER (
        WHERE subject_ciphertext IS NULL
           OR source_path_ciphertext IS NULL
      )::int AS rows_needing_backfill,
      count(*) FILTER (
        WHERE subject_ciphertext IS NOT NULL
          AND source_path_ciphertext IS NOT NULL
      )::int AS encrypted_rows,
      count(*) FILTER (
        WHERE subject <> '[encrypted]'
           OR source_path <> ''
      )::int AS rows_with_legacy_plaintext,
      count(*) FILTER (
        WHERE subject = '[encrypted]'
          AND subject_ciphertext IS NULL
      )::int AS unrecoverable_subject_rows
    FROM contact_cases
  `);

  const state = summary.rows[0] || {};
  if (Number(state.unrecoverable_subject_rows || 0) > 0) {
    throw contractError(
      "At least one row has a redacted subject but no encrypted subject envelope.",
      "CONTACT_DATA_BACKFILL_SOURCE_MISSING"
    );
  }

  const verifiedEncryptedRows = await verifyEncryptedRows(
    database,
    contactCrypto,
    normalizedBatchSize
  );

  return Object.freeze({
    totalRows: Number(state.total_rows || 0),
    rowsNeedingBackfill: Number(state.rows_needing_backfill || 0),
    encryptedRows: Number(state.encrypted_rows || 0),
    rowsWithLegacyPlaintext: Number(state.rows_with_legacy_plaintext || 0),
    verifiedEncryptedRows,
  });
}

export async function backfillLegacyContactData(
  database,
  {
    contactCrypto,
    confirmation,
    batchSize = DEFAULT_BATCH_SIZE,
  } = {}
) {
  assertDatabase(database);
  assertCrypto(contactCrypto);

  if (String(confirmation || "") !== EXECUTE_CONFIRMATION) {
    throw contractError(
      "Explicit backfill confirmation is required.",
      "CONTACT_DATA_BACKFILL_CONFIRMATION_REQUIRED"
    );
  }

  const normalizedBatchSize = normalizeBatchSize(batchSize);
  const before = await inspectContactDataContractState(database, {
    contactCrypto,
    batchSize: normalizedBatchSize,
  });

  let updatedRows = 0;

  for (;;) {
    const updatedInBatch = await database.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        ["gracz-contact-data-contract-prep"]
      );

      const selected = await client.query(
        `SELECT request_id, subject, source_path,
                subject_ciphertext, source_path_ciphertext
         FROM contact_cases
         WHERE subject_ciphertext IS NULL
            OR source_path_ciphertext IS NULL
         ORDER BY created_at ASC, request_id ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [normalizedBatchSize]
      );

      if (selected.rowCount === 0) return 0;

      for (const row of selected.rows) {
        const requestId = String(row.request_id);

        if (
          row.subject_ciphertext === null &&
          String(row.subject || "") === "[encrypted]"
        ) {
          throw contractError(
            "Cannot backfill a redacted subject without an encrypted envelope.",
            "CONTACT_DATA_BACKFILL_SOURCE_MISSING"
          );
        }

        const subjectCiphertext =
          row.subject_ciphertext ??
          contactCrypto.encrypt(String(row.subject ?? ""), {
            aad: "contact-case:" + requestId + ":subject",
          });

        const sourcePathCiphertext =
          row.source_path_ciphertext ??
          contactCrypto.encrypt(String(row.source_path ?? ""), {
            aad: "contact-case:" + requestId + ":source",
          });

        await client.query(
          `UPDATE contact_cases
           SET subject_ciphertext = $2,
               source_path_ciphertext = $3,
               updated_at = now()
           WHERE request_id = $1`,
          [requestId, subjectCiphertext, sourcePathCiphertext]
        );
      }

      return selected.rowCount;
    });

    if (updatedInBatch === 0) break;
    updatedRows += updatedInBatch;
  }

  const after = await inspectContactDataContractState(database, {
    contactCrypto,
    batchSize: normalizedBatchSize,
  });

  if (after.rowsNeedingBackfill !== 0) {
    throw contractError(
      "Contact-data backfill did not reach a complete state.",
      "CONTACT_DATA_BACKFILL_INCOMPLETE"
    );
  }

  return Object.freeze({
    updatedRows,
    before,
    after,
  });
}

async function runCli() {
  const database = createDatabase();
  const contactCrypto = createContactDataCrypto({
    secret: process.env.CONTACT_DATA_ENCRYPTION_SECRET,
  });
  const execute = process.argv.includes("--execute");

  try {
    if (!execute) {
      const state = await inspectContactDataContractState(database, {
        contactCrypto,
      });
      console.log("gracz.pl contact-data contract prep (read-only)", state);
      return;
    }

    const result = await backfillLegacyContactData(database, {
      contactCrypto,
      confirmation: process.env.CONTACT_DATA_CONTRACT_CONFIRM,
    });
    console.log("gracz.pl contact-data contract prep completed", {
      updatedRows: result.updatedRows,
      before: result.before,
      after: result.after,
    });
  } finally {
    await database.close();
  }
}

const invokedAsScript =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsScript) {
  runCli().catch((error) => {
    console.error("gracz.pl contact-data contract prep failed", {
      code: error?.code || "CONTACT_DATA_CONTRACT_PREP_FAILED",
      message: error?.message || "Unknown contract-prep failure",
    });
    process.exitCode = 1;
  });
}

export const CONTACT_DATA_BACKFILL_CONFIRMATION = EXECUTE_CONFIRMATION;

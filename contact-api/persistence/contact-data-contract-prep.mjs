import path from "node:path";
import { pathToFileURL } from "node:url";
import { createDatabase } from "./database.mjs";
import { createContactDataCrypto } from "../security/contact-data-crypto.mjs";

const EXECUTE_CONFIRMATION = "BACKFILL_CONTACT_DATA_V1";
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const SUBJECT_PLACEHOLDER = "[encrypted]";
const SOURCE_PLACEHOLDER = "";
const UTC_CUTOFF_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

function contractError(
  message,
  code = "CONTACT_DATA_CONTRACT_PREP_FAILED",
  details = {}
) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function assertDatabase(database) {
  if (
    !database?.enabled ||
    typeof database.query !== "function" ||
    typeof database.transaction !== "function"
  ) {
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
  if (value === undefined) return DEFAULT_BATCH_SIZE;
  if (typeof value !== "number" && typeof value !== "string") {
    throw contractError(
      `batchSize must be an integer from 1 to ${MAX_BATCH_SIZE}.`,
      "CONTACT_DATA_BATCH_SIZE_INVALID"
    );
  }
  if (typeof value === "string" && !/^[1-9][0-9]*$/.test(value)) {
    throw contractError(
      `batchSize must be an integer from 1 to ${MAX_BATCH_SIZE}.`,
      "CONTACT_DATA_BATCH_SIZE_INVALID"
    );
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_BATCH_SIZE) {
    throw contractError(
      `batchSize must be an integer from 1 to ${MAX_BATCH_SIZE}.`,
      "CONTACT_DATA_BATCH_SIZE_INVALID"
    );
  }
  return parsed;
}

function parseEncryptedWriterCutoff(value) {
  const normalized = String(value || "").trim();
  if (!UTC_CUTOFF_PATTERN.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    throw contractError(
      "CONTACT_DATA_ENCRYPTED_WRITER_CUTOFF must be an exact UTC timestamp ending in Z.",
      "CONTACT_DATA_WRITER_CUTOFF_REQUIRED"
    );
  }
  return normalized;
}

function decryptField(contactCrypto, envelope, { requestId, field, aad, expected }) {
  let plaintext;
  try {
    plaintext = contactCrypto.decrypt(envelope, { aad });
  } catch (error) {
    throw contractError(
      `Encrypted contact data failed authentication for request ${requestId} field ${field}.`,
      "CONTACT_DATA_PREFLIGHT_DECRYPT_FAILED",
      { requestId, field, cause: error }
    );
  }

  if (expected !== undefined && plaintext !== expected) {
    throw contractError(
      `Encrypted contact data does not match retained plaintext for request ${requestId} field ${field}.`,
      "CONTACT_DATA_PREFLIGHT_MISMATCH",
      { requestId, field }
    );
  }

  return plaintext;
}

function verifyRow(contactCrypto, row) {
  const requestId = String(row.request_id);
  const subject = String(row.subject ?? "");
  const sourcePath = String(row.source_path ?? "");
  const hasSubjectCiphertext = row.subject_ciphertext !== null;
  const hasSourceCiphertext = row.source_path_ciphertext !== null;
  const postWriterCutoff = row.is_post_writer_cutoff === true;

  if (postWriterCutoff) {
    if (
      subject !== SUBJECT_PLACEHOLDER ||
      sourcePath !== SOURCE_PLACEHOLDER ||
      !hasSubjectCiphertext ||
      !hasSourceCiphertext
    ) {
      throw contractError(
        `Post-cutoff contact row does not match the encrypted-writer invariant for request ${requestId}.`,
        "CONTACT_DATA_POST_CUTOFF_WRITER_ANOMALY",
        { requestId }
      );
    }

    decryptField(contactCrypto, row.subject_ciphertext, {
      requestId,
      field: "subject",
      aad: "contact-case:" + requestId + ":subject",
    });
    decryptField(contactCrypto, row.source_path_ciphertext, {
      requestId,
      field: "source",
      aad: "contact-case:" + requestId + ":source",
    });

    return {
      requestId,
      subject,
      sourcePath,
      hasSubjectCiphertext,
      hasSourceCiphertext,
      verifiedCiphertextFields: 2,
      isModernWriterRow: true,
    };
  }

  let verifiedCiphertextFields = 0;

  // Before the verified encrypted-writer cutoff, the retained plaintext is
  // authoritative even when it equals a sentinel value such as "[encrypted]"
  // or an empty source path. Never skip equality based on the value alone.
  if (hasSubjectCiphertext) {
    decryptField(contactCrypto, row.subject_ciphertext, {
      requestId,
      field: "subject",
      aad: "contact-case:" + requestId + ":subject",
      expected: subject,
    });
    verifiedCiphertextFields += 1;
  }

  if (hasSourceCiphertext) {
    decryptField(contactCrypto, row.source_path_ciphertext, {
      requestId,
      field: "source",
      aad: "contact-case:" + requestId + ":source",
      expected: sourcePath,
    });
    verifiedCiphertextFields += 1;
  }

  return {
    requestId,
    subject,
    sourcePath,
    hasSubjectCiphertext,
    hasSourceCiphertext,
    verifiedCiphertextFields,
    isModernWriterRow: false,
  };
}

async function scanContactRows(
  client,
  contactCrypto,
  batchSize,
  encryptedWriterCutoff
) {
  let afterRequestId = null;
  const state = {
    totalRows: 0,
    rowsNeedingBackfill: 0,
    encryptedRows: 0,
    legacyRows: 0,
    modernWriterRows: 0,
    rowsWithLegacyPlaintext: 0,
    verifiedEncryptedRows: 0,
    verifiedCiphertextFields: 0,
  };

  for (;;) {
    const result = await client.query(
      `SELECT request_id, subject, source_path,
              subject_ciphertext, source_path_ciphertext,
              (created_at >= $3::timestamptz) AS is_post_writer_cutoff
       FROM contact_cases
       WHERE $1::uuid IS NULL OR request_id > $1::uuid
       ORDER BY request_id ASC
       LIMIT $2`,
      [afterRequestId, batchSize, encryptedWriterCutoff]
    );

    if (result.rowCount === 0) break;

    for (const row of result.rows) {
      const verified = verifyRow(contactCrypto, row);
      state.totalRows += 1;
      state.verifiedCiphertextFields += verified.verifiedCiphertextFields;

      if (verified.isModernWriterRow) {
        state.modernWriterRows += 1;
      } else {
        state.legacyRows += 1;
        state.rowsWithLegacyPlaintext += 1;
      }

      if (!verified.hasSubjectCiphertext || !verified.hasSourceCiphertext) {
        state.rowsNeedingBackfill += 1;
      } else {
        state.encryptedRows += 1;
        state.verifiedEncryptedRows += 1;
      }

      afterRequestId = verified.requestId;
    }

    if (result.rowCount < batchSize) break;
  }

  return state;
}

async function inspectWithClient(
  client,
  contactCrypto,
  batchSize,
  encryptedWriterCutoff
) {
  const identity = await client.query(
    "SELECT current_database() AS database_name"
  );
  const independentCount = await client.query(
    "SELECT count(*)::int AS total_rows FROM contact_cases"
  );
  const state = await scanContactRows(
    client,
    contactCrypto,
    batchSize,
    encryptedWriterCutoff
  );
  const expectedTotal = Number(independentCount.rows[0]?.total_rows || 0);

  if (state.totalRows !== expectedTotal) {
    throw contractError(
      "Contact-data scan count does not match an independent count(*) in the same snapshot.",
      "CONTACT_DATA_SCAN_COUNT_MISMATCH"
    );
  }

  if (state.verifiedEncryptedRows !== state.encryptedRows) {
    throw contractError(
      "Encrypted-row verification count does not match the encrypted-row count.",
      "CONTACT_DATA_VERIFICATION_COUNT_MISMATCH"
    );
  }

  return Object.freeze({
    databaseName: String(identity.rows[0]?.database_name || ""),
    encryptedWriterCutoff,
    keyEvidenceSatisfied: state.modernWriterRows > 0,
    ...state,
  });
}

export async function inspectContactDataContractState(
  database,
  {
    contactCrypto,
    batchSize = DEFAULT_BATCH_SIZE,
    encryptedWriterCutoff,
  } = {}
) {
  assertDatabase(database);
  assertCrypto(contactCrypto);
  const normalizedBatchSize = normalizeBatchSize(batchSize);
  const normalizedWriterCutoff = parseEncryptedWriterCutoff(encryptedWriterCutoff);

  return database.transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );
    return inspectWithClient(
      client,
      contactCrypto,
      normalizedBatchSize,
      normalizedWriterCutoff
    );
  });
}

function assertBackfillKeyEvidence(state) {
  if (state.rowsNeedingBackfill > 0 && state.modernWriterRows < 1) {
    throw contractError(
      "Backfill requires at least one authenticated row created after the verified encrypted-writer cutoff.",
      "CONTACT_DATA_KEY_EVIDENCE_REQUIRED"
    );
  }
}

export async function backfillLegacyContactData(
  database,
  {
    contactCrypto,
    confirmation,
    batchSize = DEFAULT_BATCH_SIZE,
    encryptedWriterCutoff,
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
  const normalizedWriterCutoff = parseEncryptedWriterCutoff(encryptedWriterCutoff);

  // PASS 0: full authenticated and provenance-aware validation before first write.
  const before = await inspectContactDataContractState(database, {
    contactCrypto,
    batchSize: normalizedBatchSize,
    encryptedWriterCutoff: normalizedWriterCutoff,
  });
  assertBackfillKeyEvidence(before);

  let updatedRows = 0;

  for (;;) {
    const updatedInBatch = await database.transaction(async (client) => {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '60s'");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        ["gracz-contact-data-contract-prep"]
      );

      const selected = await client.query(
        `SELECT request_id, subject, source_path,
                subject_ciphertext, source_path_ciphertext,
                (created_at >= $2::timestamptz) AS is_post_writer_cutoff
         FROM contact_cases
         WHERE subject_ciphertext IS NULL
            OR source_path_ciphertext IS NULL
         ORDER BY request_id ASC
         LIMIT $1
         FOR NO KEY UPDATE SKIP LOCKED`,
        [normalizedBatchSize, normalizedWriterCutoff]
      );

      if (selected.rowCount === 0) return 0;

      for (const row of selected.rows) {
        const verified = verifyRow(contactCrypto, row);
        const requestId = verified.requestId;

        if (verified.isModernWriterRow) {
          throw contractError(
            `Modern encrypted-writer row unexpectedly requires backfill for request ${requestId}.`,
            "CONTACT_DATA_POST_CUTOFF_WRITER_ANOMALY",
            { requestId }
          );
        }

        const subjectCiphertext =
          row.subject_ciphertext ??
          contactCrypto.encrypt(verified.subject, {
            aad: "contact-case:" + requestId + ":subject",
          });

        const sourcePathCiphertext =
          row.source_path_ciphertext ??
          contactCrypto.encrypt(verified.sourcePath, {
            aad: "contact-case:" + requestId + ":source",
          });

        await client.query(
          `UPDATE contact_cases
           SET subject_ciphertext = $2,
               source_path_ciphertext = $3
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
    encryptedWriterCutoff: normalizedWriterCutoff,
  });

  if (after.rowsNeedingBackfill !== 0) {
    throw contractError(
      "Contact-data backfill did not reach a complete state.",
      "CONTACT_DATA_BACKFILL_INCOMPLETE"
    );
  }

  if (after.verifiedCiphertextFields !== after.totalRows * 2) {
    throw contractError(
      "Not every contact-data field has a verified encrypted envelope.",
      "CONTACT_DATA_VERIFICATION_COUNT_MISMATCH"
    );
  }

  return Object.freeze({
    updatedRows,
    before,
    after,
  });
}

function parseCliArguments(argv) {
  const args = Array.from(argv || []);
  const unknown = args.filter((arg) => arg !== "--execute");
  if (unknown.length > 0) {
    throw contractError(
      "Unknown command-line argument. No changes made.",
      "CONTACT_DATA_CLI_ARGUMENT_INVALID"
    );
  }
  return Object.freeze({ execute: args.includes("--execute") });
}

async function runCli() {
  const database = createDatabase();
  const contactCrypto = createContactDataCrypto({
    secret: process.env.CONTACT_DATA_ENCRYPTION_SECRET,
  });
  const encryptedWriterCutoff = parseEncryptedWriterCutoff(
    process.env.CONTACT_DATA_ENCRYPTED_WRITER_CUTOFF
  );
  const { execute } = parseCliArguments(process.argv.slice(2));

  try {
    if (!execute) {
      const state = await inspectContactDataContractState(database, {
        contactCrypto,
        encryptedWriterCutoff,
      });
      console.log(
        "gracz.pl contact-data contract prep (READ ONLY — NO CHANGES MADE)",
        state
      );
      return;
    }

    const result = await backfillLegacyContactData(database, {
      contactCrypto,
      confirmation: process.env.CONTACT_DATA_CONTRACT_CONFIRM,
      encryptedWriterCutoff,
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
      requestId: error?.requestId || undefined,
      field: error?.field || undefined,
    });
    process.exitCode = 1;
  });
}

export const CONTACT_DATA_BACKFILL_CONFIRMATION = EXECUTE_CONFIRMATION;
export {
  normalizeBatchSize,
  parseCliArguments,
  parseEncryptedWriterCutoff,
};

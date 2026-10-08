import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../persistence/database.mjs";
import { applyMigrations } from "../persistence/migrator.mjs";
import { createContactDataCrypto } from "../security/contact-data-crypto.mjs";
import {
  backfillLegacyContactData,
  inspectContactDataContractState,
  CONTACT_DATA_BACKFILL_CONFIRMATION,
  normalizeBatchSize,
  parseCliArguments,
} from "../persistence/contact-data-contract-prep.mjs";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

function assertDisposableDatabaseUrl(value) {
  if (!value) return;
  const parsed = new URL(value);
  const allowedHosts = new Set(["127.0.0.1", "localhost", "::1", "postgres"]);
  if (!allowedHosts.has(parsed.hostname)) {
    throw new Error(
      "Refusing contact-data integration tests against a non-local PostgreSQL host."
    );
  }
}

async function reset(database) {
  await database.query("TRUNCATE TABLE contact_cases CASCADE");
}

function crypto(secret = "contract-prep-" + "q".repeat(64)) {
  return createContactDataCrypto({ secret });
}

async function insertLegacy(
  database,
  {
    requestId = randomUUID(),
    subject = "Legacy subject",
    sourcePath = "/kontakt",
    subjectCiphertext = null,
    sourcePathCiphertext = null,
  } = {}
) {
  await database.query(
    `INSERT INTO contact_cases(
       request_id, sender_hash, category, subject, source_path,
       subject_ciphertext, source_path_ciphertext
     ) VALUES ($1, repeat('a', 64), 'Problem techniczny', $2, $3, $4, $5)`,
    [requestId, subject, sourcePath, subjectCiphertext, sourcePathCiphertext]
  );
  return requestId;
}

async function insertModern(database, contactCrypto, { requestId = randomUUID() } = {}) {
  const subjectCiphertext = contactCrypto.encrypt("Modern subject", {
    aad: "contact-case:" + requestId + ":subject",
  });
  const sourcePathCiphertext = contactCrypto.encrypt("/kontakt", {
    aad: "contact-case:" + requestId + ":source",
  });
  await database.query(
    `INSERT INTO contact_cases(
       request_id, sender_hash, category, subject, source_path,
       subject_ciphertext, source_path_ciphertext
     ) VALUES ($1, repeat('b', 64), 'Pytanie ogólne', '[encrypted]', '', $2, $3)`,
    [requestId, subjectCiphertext, sourcePathCiphertext]
  );
  return requestId;
}

test(
  "contact-data CONTRACT prep is fail-closed, idempotent and pagination-safe",
  { skip: !DATABASE_URL },
  async (t) => {
    assertDisposableDatabaseUrl(DATABASE_URL);
    const database = createDatabase({ connectionString: DATABASE_URL });
    t.after(() => database.close());

    await applyMigrations(database);
    const contactCrypto = crypto();

    await t.test("preflight authenticates partial ciphertext before any write", async () => {
      await reset(database);
      await insertModern(database, contactCrypto);

      const corruptId = randomUUID();
      await insertLegacy(database, {
        requestId: corruptId,
        subjectCiphertext: "c1.invalid.invalid.invalid",
        sourcePathCiphertext: null,
      });
      const untouchedId = await insertLegacy(database);

      await assert.rejects(
        () =>
          backfillLegacyContactData(database, {
            contactCrypto,
            confirmation: CONTACT_DATA_BACKFILL_CONFIRMATION,
          }),
        (error) =>
          error?.code === "CONTACT_DATA_PREFLIGHT_DECRYPT_FAILED" &&
          error?.requestId === corruptId
      );

      const rows = await database.query(
        `SELECT request_id, subject_ciphertext, source_path_ciphertext
         FROM contact_cases
         WHERE request_id = ANY($1::uuid[])
         ORDER BY request_id`,
        [[corruptId, untouchedId]]
      );
      for (const row of rows.rows) {
        if (row.request_id === corruptId) {
          assert.equal(row.source_path_ciphertext, null);
        }
        if (row.request_id === untouchedId) {
          assert.equal(row.subject_ciphertext, null);
          assert.equal(row.source_path_ciphertext, null);
        }
      }
    });

    await t.test("wrong secret cannot backfill a legacy-only database", async () => {
      await reset(database);
      const legacyId = await insertLegacy(database);
      const wrongCrypto = crypto("wrong-contract-key-" + "w".repeat(64));

      await assert.rejects(
        () =>
          backfillLegacyContactData(database, {
            contactCrypto: wrongCrypto,
            confirmation: CONTACT_DATA_BACKFILL_CONFIRMATION,
          }),
        (error) => error?.code === "CONTACT_DATA_KEY_EVIDENCE_REQUIRED"
      );

      const row = await database.query(
        `SELECT subject_ciphertext, source_path_ciphertext
         FROM contact_cases WHERE request_id = $1`,
        [legacyId]
      );
      assert.equal(row.rows[0].subject_ciphertext, null);
      assert.equal(row.rows[0].source_path_ciphertext, null);
    });

    await t.test("wrong secret is rejected before writes when key evidence exists", async () => {
      await reset(database);
      await insertModern(database, contactCrypto);
      const legacyId = await insertLegacy(database);
      const wrongCrypto = crypto("wrong-contract-key-" + "z".repeat(64));

      await assert.rejects(
        () =>
          backfillLegacyContactData(database, {
            contactCrypto: wrongCrypto,
            confirmation: CONTACT_DATA_BACKFILL_CONFIRMATION,
          }),
        (error) => error?.code === "CONTACT_DATA_PREFLIGHT_DECRYPT_FAILED"
      );

      const row = await database.query(
        `SELECT subject_ciphertext, source_path_ciphertext
         FROM contact_cases WHERE request_id = $1`,
        [legacyId]
      );
      assert.equal(row.rows[0].subject_ciphertext, null);
      assert.equal(row.rows[0].source_path_ciphertext, null);
    });

    await t.test("authenticated ciphertext must match retained legacy plaintext", async () => {
      await reset(database);
      const requestId = randomUUID();
      const subjectCiphertext = contactCrypto.encrypt("Different subject", {
        aad: "contact-case:" + requestId + ":subject",
      });
      const sourcePathCiphertext = contactCrypto.encrypt("/kontakt", {
        aad: "contact-case:" + requestId + ":source",
      });
      await insertLegacy(database, {
        requestId,
        subject: "Expected subject",
        sourcePath: "/kontakt",
        subjectCiphertext,
        sourcePathCiphertext,
      });

      await assert.rejects(
        () => inspectContactDataContractState(database, { contactCrypto }),
        (error) =>
          error?.code === "CONTACT_DATA_PREFLIGHT_MISMATCH" &&
          error?.requestId === requestId &&
          error?.field === "subject"
      );
    });

    await t.test("request-id keyset pagination verifies each row exactly once", async () => {
      await reset(database);
      const fixedCreatedAt = new Date("2026-10-08T07:00:00.123Z");

      for (let index = 0; index < 250; index += 1) {
        const requestId = randomUUID();
        const subjectCiphertext = contactCrypto.encrypt("Modern subject", {
          aad: "contact-case:" + requestId + ":subject",
        });
        const sourcePathCiphertext = contactCrypto.encrypt("/kontakt", {
          aad: "contact-case:" + requestId + ":source",
        });
        await database.query(
          `INSERT INTO contact_cases(
             request_id, sender_hash, category, subject, source_path,
             subject_ciphertext, source_path_ciphertext, created_at, updated_at
           ) VALUES ($1, repeat('c', 64), 'Pytanie ogólne', '[encrypted]', '', $2, $3, $4, $4)`,
          [requestId, subjectCiphertext, sourcePathCiphertext, fixedCreatedAt]
        );
      }

      const state = await inspectContactDataContractState(database, {
        contactCrypto,
        batchSize: 100,
      });
      assert.equal(state.totalRows, 250);
      assert.equal(state.encryptedRows, 250);
      assert.equal(state.verifiedEncryptedRows, 250);
      assert.equal(state.verifiedCiphertextFields, 500);
    });

    await t.test("normal backfill preserves plaintext and updated_at and is idempotent", async () => {
      await reset(database);
      await insertModern(database, contactCrypto);
      const legacyId = await insertLegacy(database);

      const beforeRow = await database.query(
        `SELECT subject, source_path, updated_at
         FROM contact_cases WHERE request_id = $1`,
        [legacyId]
      );

      const first = await backfillLegacyContactData(database, {
        contactCrypto,
        confirmation: CONTACT_DATA_BACKFILL_CONFIRMATION,
      });
      assert.equal(first.updatedRows, 1);
      assert.equal(first.after.rowsNeedingBackfill, 0);
      assert.equal(
        first.after.verifiedCiphertextFields,
        first.after.totalRows * 2
      );

      const afterRow = await database.query(
        `SELECT subject, source_path, subject_ciphertext,
                source_path_ciphertext, updated_at
         FROM contact_cases WHERE request_id = $1`,
        [legacyId]
      );
      assert.equal(afterRow.rows[0].subject, beforeRow.rows[0].subject);
      assert.equal(afterRow.rows[0].source_path, beforeRow.rows[0].source_path);
      assert.equal(
        new Date(afterRow.rows[0].updated_at).getTime(),
        new Date(beforeRow.rows[0].updated_at).getTime()
      );
      assert.equal(
        contactCrypto.decrypt(afterRow.rows[0].subject_ciphertext, {
          aad: "contact-case:" + legacyId + ":subject",
        }),
        beforeRow.rows[0].subject
      );
      assert.equal(
        contactCrypto.decrypt(afterRow.rows[0].source_path_ciphertext, {
          aad: "contact-case:" + legacyId + ":source",
        }),
        beforeRow.rows[0].source_path
      );

      const second = await backfillLegacyContactData(database, {
        contactCrypto,
        confirmation: CONTACT_DATA_BACKFILL_CONFIRMATION,
      });
      assert.equal(second.updatedRows, 0);
    });

    await t.test("modern-like source placeholder without ciphertext fails closed", async () => {
      await reset(database);
      const requestId = randomUUID();
      const subjectCiphertext = contactCrypto.encrypt("Modern subject", {
        aad: "contact-case:" + requestId + ":subject",
      });
      await insertLegacy(database, {
        requestId,
        subject: "[encrypted]",
        sourcePath: "",
        subjectCiphertext,
        sourcePathCiphertext: null,
      });

      await assert.rejects(
        () => inspectContactDataContractState(database, { contactCrypto }),
        (error) =>
          error?.code === "CONTACT_DATA_BACKFILL_SOURCE_MISSING" &&
          error?.requestId === requestId &&
          error?.field === "source"
      );
    });

    await t.test("batch size validation rejects coercion and out-of-range values", () => {
      for (const value of [0, -5, null, "", false, true, [], 1.5, "abc", 501, 1e9]) {
        assert.throws(
          () => normalizeBatchSize(value),
          (error) => error?.code === "CONTACT_DATA_BATCH_SIZE_INVALID"
        );
      }
      assert.equal(normalizeBatchSize(undefined), 100);
      assert.equal(normalizeBatchSize(1), 1);
      assert.equal(normalizeBatchSize("50"), 50);
      assert.equal(normalizeBatchSize(500), 500);
    });

    await t.test("CLI rejects unknown flags instead of silently succeeding", () => {
      assert.deepEqual(parseCliArguments([]), { execute: false });
      assert.deepEqual(parseCliArguments(["--execute"]), { execute: true });
      for (const args of [
        ["--EXECUTE"],
        ["--execute=true"],
        ["-execute"],
        ["execute"],
        ["--dry-run"],
      ]) {
        assert.throws(
          () => parseCliArguments(args),
          (error) => error?.code === "CONTACT_DATA_CLI_ARGUMENT_INVALID"
        );
      }
    });
  }
);

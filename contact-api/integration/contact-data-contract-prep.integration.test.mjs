import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../persistence/database.mjs";
import { applyMigrations } from "../persistence/migrator.mjs";
import { createContactDataCrypto } from "../security/contact-data-crypto.mjs";
import {
  assertDisposableDatabaseUrl,
  inspectEffectiveTestDatabase,
} from "./test-database-guard.mjs";
import {
  backfillLegacyContactData,
  inspectContactDataContractState,
  CONTACT_DATA_BACKFILL_CONFIRMATION,
  normalizeBatchSize,
  parseCliArguments,
  parseEncryptedWriterCutoff,
} from "../persistence/contact-data-contract-prep.mjs";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
const WRITER_CUTOFF = "2026-10-08T00:00:00Z";
const LEGACY_CREATED_AT = "2026-10-07T23:00:00.123456Z";
const MODERN_CREATED_AT = "2026-10-08T01:00:00.654321Z";

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
    createdAt = LEGACY_CREATED_AT,
  } = {}
) {
  await database.query(
    `INSERT INTO contact_cases(
       request_id, sender_hash, category, subject, source_path,
       subject_ciphertext, source_path_ciphertext, created_at, updated_at
     ) VALUES (
       $1, repeat('a', 64), 'Problem techniczny', $2, $3, $4, $5,
       $6::timestamptz, $6::timestamptz
     )`,
    [
      requestId,
      subject,
      sourcePath,
      subjectCiphertext,
      sourcePathCiphertext,
      createdAt,
    ]
  );
  return requestId;
}

async function insertModern(
  database,
  contactCrypto,
  {
    requestId = randomUUID(),
    subject = "Modern subject",
    sourcePath = "/kontakt",
    createdAt = MODERN_CREATED_AT,
  } = {}
) {
  const subjectCiphertext = contactCrypto.encrypt(subject, {
    aad: "contact-case:" + requestId + ":subject",
  });
  const sourcePathCiphertext = contactCrypto.encrypt(sourcePath, {
    aad: "contact-case:" + requestId + ":source",
  });
  await database.query(
    `INSERT INTO contact_cases(
       request_id, sender_hash, category, subject, source_path,
       subject_ciphertext, source_path_ciphertext, created_at, updated_at
     ) VALUES (
       $1, repeat('b', 64), 'Pytanie ogólne', '[encrypted]', '', $2, $3,
       $4::timestamptz, $4::timestamptz
     )`,
    [requestId, subjectCiphertext, sourcePathCiphertext, createdAt]
  );
  return requestId;
}

function prepOptions(contactCrypto, extra = {}) {
  return {
    contactCrypto,
    encryptedWriterCutoff: WRITER_CUTOFF,
    ...extra,
  };
}

test(
  "contact-data CONTRACT prep is provenance-aware, fail-closed and idempotent",
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
            ...prepOptions(contactCrypto),
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
      assert.equal(rows.rowCount, 2);
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
            ...prepOptions(wrongCrypto),
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

    await t.test("pre-cutoff encrypted rows cannot fabricate modern key evidence", async () => {
      await reset(database);
      const fakeId = randomUUID();
      await insertLegacy(database, {
        requestId: fakeId,
        subject: "[encrypted]",
        sourcePath: "",
        subjectCiphertext: contactCrypto.encrypt("[encrypted]", {
          aad: "contact-case:" + fakeId + ":subject",
        }),
        sourcePathCiphertext: contactCrypto.encrypt("", {
          aad: "contact-case:" + fakeId + ":source",
        }),
      });
      await insertLegacy(database);

      await assert.rejects(
        () =>
          backfillLegacyContactData(database, {
            ...prepOptions(contactCrypto),
            confirmation: CONTACT_DATA_BACKFILL_CONFIRMATION,
          }),
        (error) => error?.code === "CONTACT_DATA_KEY_EVIDENCE_REQUIRED"
      );
    });

    await t.test("wrong secret is rejected before writes when modern evidence exists", async () => {
      await reset(database);
      await insertModern(database, contactCrypto);
      const legacyId = await insertLegacy(database);
      const wrongCrypto = crypto("wrong-contract-key-" + "z".repeat(64));

      await assert.rejects(
        () =>
          backfillLegacyContactData(database, {
            ...prepOptions(wrongCrypto),
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

    await t.test("ordinary retained plaintext must match authenticated ciphertext", async () => {
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
        () =>
          inspectContactDataContractState(
            database,
            prepOptions(contactCrypto)
          ),
        (error) =>
          error?.code === "CONTACT_DATA_PREFLIGHT_MISMATCH" &&
          error?.requestId === requestId &&
          error?.field === "subject"
      );
    });

    await t.test("empty legacy source is authoritative before writer cutoff", async () => {
      await reset(database);
      const requestId = randomUUID();
      const subjectCiphertext = contactCrypto.encrypt("Legacy subject", {
        aad: "contact-case:" + requestId + ":subject",
      });
      const wrongSourceCiphertext = contactCrypto.encrypt("/WRONG", {
        aad: "contact-case:" + requestId + ":source",
      });
      await insertLegacy(database, {
        requestId,
        subject: "Legacy subject",
        sourcePath: "",
        subjectCiphertext,
        sourcePathCiphertext: wrongSourceCiphertext,
      });

      await assert.rejects(
        () =>
          inspectContactDataContractState(
            database,
            prepOptions(contactCrypto)
          ),
        (error) =>
          error?.code === "CONTACT_DATA_PREFLIGHT_MISMATCH" &&
          error?.requestId === requestId &&
          error?.field === "source"
      );
    });

    await t.test("literal legacy [encrypted] subject is authoritative before cutoff", async () => {
      await reset(database);
      const requestId = randomUUID();
      const wrongSubjectCiphertext = contactCrypto.encrypt("Different subject", {
        aad: "contact-case:" + requestId + ":subject",
      });
      const sourcePathCiphertext = contactCrypto.encrypt("/kontakt", {
        aad: "contact-case:" + requestId + ":source",
      });
      await insertLegacy(database, {
        requestId,
        subject: "[encrypted]",
        sourcePath: "/kontakt",
        subjectCiphertext: wrongSubjectCiphertext,
        sourcePathCiphertext,
      });

      await assert.rejects(
        () =>
          inspectContactDataContractState(
            database,
            prepOptions(contactCrypto)
          ),
        (error) =>
          error?.code === "CONTACT_DATA_PREFLIGHT_MISMATCH" &&
          error?.requestId === requestId &&
          error?.field === "subject"
      );
    });

    await t.test("post-cutoff rows must satisfy the encrypted-writer invariant", async () => {
      await reset(database);
      const modernId = await insertModern(database, contactCrypto);
      const state = await inspectContactDataContractState(
        database,
        prepOptions(contactCrypto)
      );
      assert.equal(state.totalRows, 1);
      assert.equal(state.modernWriterRows, 1);
      assert.equal(state.legacyRows, 0);
      assert.equal(state.keyEvidenceSatisfied, true);

      await reset(database);
      const anomalyId = await insertLegacy(database, {
        subject: "Unexpected post-cutoff plaintext",
        sourcePath: "/kontakt",
        createdAt: MODERN_CREATED_AT,
      });

      await assert.rejects(
        () =>
          inspectContactDataContractState(
            database,
            prepOptions(contactCrypto)
          ),
        (error) =>
          error?.code === "CONTACT_DATA_POST_CUTOFF_WRITER_ANOMALY" &&
          error?.requestId === anomalyId
      );

      assert.ok(modernId);
    });

    await t.test("request-id pagination verifies exact counts independent of timestamps", async () => {
      await reset(database);
      const fixedCreatedAt = "2026-10-08T01:00:00.123456Z";

      for (let index = 0; index < 250; index += 1) {
        await insertModern(database, contactCrypto, {
          createdAt: fixedCreatedAt,
        });
      }

      const state = await inspectContactDataContractState(database, {
        ...prepOptions(contactCrypto),
        batchSize: 100,
      });
      assert.equal(state.totalRows, 250);
      assert.equal(state.encryptedRows, 250);
      assert.equal(state.verifiedEncryptedRows, 250);
      assert.equal(state.verifiedCiphertextFields, 500);
      assert.equal(state.modernWriterRows, 250);
    });

    await t.test("normal backfill preserves plaintext, microsecond updated_at and ciphertext bytes", async () => {
      await reset(database);
      await insertModern(database, contactCrypto);
      const legacyId = await insertLegacy(database, {
        sourcePath: "",
      });

      const beforeRow = await database.query(
        `SELECT subject, source_path, updated_at::text
         FROM contact_cases WHERE request_id = $1`,
        [legacyId]
      );

      const first = await backfillLegacyContactData(database, {
        ...prepOptions(contactCrypto),
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
                source_path_ciphertext, updated_at::text
         FROM contact_cases WHERE request_id = $1`,
        [legacyId]
      );
      assert.equal(afterRow.rows[0].subject, beforeRow.rows[0].subject);
      assert.equal(afterRow.rows[0].source_path, beforeRow.rows[0].source_path);
      assert.equal(afterRow.rows[0].updated_at, beforeRow.rows[0].updated_at);
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

      const firstSubjectCiphertext = afterRow.rows[0].subject_ciphertext;
      const firstSourceCiphertext = afterRow.rows[0].source_path_ciphertext;

      const second = await backfillLegacyContactData(database, {
        ...prepOptions(contactCrypto),
        confirmation: CONTACT_DATA_BACKFILL_CONFIRMATION,
      });
      assert.equal(second.updatedRows, 0);

      const rerun = await database.query(
        `SELECT subject_ciphertext, source_path_ciphertext
         FROM contact_cases WHERE request_id = $1`,
        [legacyId]
      );
      assert.equal(rerun.rows[0].subject_ciphertext, firstSubjectCiphertext);
      assert.equal(rerun.rows[0].source_path_ciphertext, firstSourceCiphertext);
    });

    await t.test("writer cutoff is mandatory and strictly UTC", () => {
      for (const value of [
        undefined,
        null,
        "",
        "2026-10-08",
        "2026-10-08T00:00:00",
        "2026-10-08T00:00:00+00:00",
        "not-a-date",
      ]) {
        assert.throws(
          () => parseEncryptedWriterCutoff(value),
          (error) => error?.code === "CONTACT_DATA_WRITER_CUTOFF_REQUIRED"
        );
      }
      assert.equal(
        parseEncryptedWriterCutoff(WRITER_CUTOFF),
        WRITER_CUTOFF
      );
      assert.equal(
        parseEncryptedWriterCutoff("2026-10-08T00:00:00.123456Z"),
        "2026-10-08T00:00:00.123456Z"
      );
    });

    await t.test("batch size validation rejects coercion and out-of-range values", () => {
      for (const value of [
        0,
        -5,
        null,
        "",
        " ",
        false,
        true,
        [],
        {},
        1.5,
        "001",
        "1e2",
        "0x64",
        "abc",
        501,
        1e9,
      ]) {
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

    await t.test("CLI rejects unknown flags without echoing their contents", () => {
      assert.deepEqual(parseCliArguments([]), { execute: false });
      assert.deepEqual(parseCliArguments(["--execute"]), { execute: true });
      for (const args of [
        ["--EXECUTE"],
        ["--execute=true"],
        ["-execute"],
        ["execute"],
        ["--dry-run"],
        ["--SYNTHETIC_SENSITIVE_CANARY"],
      ]) {
        assert.throws(
          () => parseCliArguments(args),
          (error) =>
            error?.code === "CONTACT_DATA_CLI_ARGUMENT_INVALID" &&
            !String(error?.message || "").includes(args[0])
        );
      }
    });

    await t.test("destructive database guard validates effective pg host", () => {
      const local = inspectEffectiveTestDatabase(
        "postgresql://postgres:postgres@127.0.0.1:5432/gracz_test"
      );
      assert.equal(local.host, "127.0.0.1");
      assert.equal(local.databaseName, "gracz_test");

      const ipv6 = inspectEffectiveTestDatabase(
        "postgresql://postgres:postgres@[::1]:5432/gracz_test"
      );
      assert.equal(ipv6.host, "::1");

      for (const value of [
        "postgresql://postgres:postgres@192.0.2.1:5432/gracz_test",
        "postgresql://postgres:postgres@localhost:5432/gracz_test?host=192.0.2.1",
        "postgresql://postgres:postgres@localhost:5432/gracz_test?%68ost=192.0.2.1",
        "postgresql://postgres:postgres@localhost:5432/production",
        "postgresql:///gracz_test",
      ]) {
        assert.throws(
          () => inspectEffectiveTestDatabase(value),
          (error) => error?.code === "DESTRUCTIVE_TEST_DATABASE_REJECTED"
        );
      }
    });
  }
);

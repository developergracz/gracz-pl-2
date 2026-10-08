import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createDatabase } from "../persistence/database.mjs";
import { applyMigrations } from "../persistence/migrator.mjs";
import { createPersistenceRepositories } from "../persistence/repositories.mjs";
import { createContactDataCrypto } from "../security/contact-data-crypto.mjs";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

function hash(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

test(
  "R4.1 PostgreSQL persistence is durable, atomic and append-only where required",
  { skip: !DATABASE_URL },
  async (t) => {
    const database = createDatabase({ connectionString: DATABASE_URL });
    t.after(() => database.close());

    assert.equal(database.enabled, true);
    assert.equal(await database.ping(), true);

    const firstMigration = await applyMigrations(database);
    assert.ok(
      firstMigration.applied.includes("001_persistent_state.sql") ||
        firstMigration.skipped.includes("001_persistent_state.sql")
    );
    assert.ok(
      firstMigration.applied.includes("003_newsletter_state_version.sql") ||
        firstMigration.skipped.includes("003_newsletter_state_version.sql")
    );
    assert.ok(
      firstMigration.applied.includes("004_contact_data_encryption.sql") ||
        firstMigration.skipped.includes("004_contact_data_encryption.sql")
    );

    const secondMigration = await applyMigrations(database);
    assert.ok(secondMigration.skipped.includes("001_persistent_state.sql"));
    assert.ok(secondMigration.skipped.includes("003_newsletter_state_version.sql"));
    assert.ok(secondMigration.skipped.includes("004_contact_data_encryption.sql"));

    await database.query(
      `TRUNCATE TABLE
        newsletter_consent_events,
        newsletter_contacts,
        reply_tokens,
        idempotency_keys,
        contact_cases
       CASCADE`
    );

    await t.test("legacy contact writer remains compatible after migration 004", async () => {
      const legacyRequestId = randomUUID();
      const legacySenderHash = hash("legacy-writer@example.test");

      const inserted = await database.query(
        `INSERT INTO contact_cases(
          request_id, sender_hash, category, subject, source_path
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING request_id, subject, source_path, subject_ciphertext, source_path_ciphertext`,
        [
          legacyRequestId,
          legacySenderHash,
          "Problem techniczny",
          "Legacy writer compatibility",
          "/kontakt",
        ]
      );

      assert.equal(inserted.rowCount, 1);
      assert.equal(inserted.rows[0].request_id, legacyRequestId);
      assert.equal(inserted.rows[0].subject, "Legacy writer compatibility");
      assert.equal(inserted.rows[0].source_path, "/kontakt");
      assert.equal(inserted.rows[0].subject_ciphertext, null);
      assert.equal(inserted.rows[0].source_path_ciphertext, null);
    });

    const repositories = createPersistenceRepositories(database);
    const requestId = randomUUID();
    const senderHash = hash("jan@example.test");
    const contactCrypto = createContactDataCrypto({
      secret: "integration-" + "k".repeat(64),
    });

    assert.equal(
      await repositories.contactCases.create({
        requestId,
        senderHash,
        category: "Pytanie ogólne",
        subjectCiphertext: contactCrypto.encrypt("Persistence integration test", {
          aad: "contact-case:" + requestId + ":subject",
        }),
        sourcePathCiphertext: contactCrypto.encrypt("/kontakt", {
          aad: "contact-case:" + requestId + ":source",
        }),
      }),
      true
    );

    const storedContactCase = await database.query(
      `SELECT subject, source_path, subject_ciphertext, source_path_ciphertext
       FROM contact_cases
       WHERE request_id = $1`,
      [requestId]
    );
    assert.equal(storedContactCase.rows[0].subject, "[encrypted]");
    assert.equal(storedContactCase.rows[0].source_path, "");
    assert.equal(
      contactCrypto.decrypt(storedContactCase.rows[0].subject_ciphertext, {
        aad: "contact-case:" + requestId + ":subject",
      }),
      "Persistence integration test"
    );
    assert.equal(
      contactCrypto.decrypt(storedContactCase.rows[0].source_path_ciphertext, {
        aad: "contact-case:" + requestId + ":source",
      }),
      "/kontakt"
    );

    await t.test("reply-token claim is atomic", async () => {
      const jtiHash = hash("reply-jti-" + requestId);
      assert.equal(
        await repositories.replyTokens.issue({
          jtiHash,
          requestId,
          expiresAt: new Date(Date.now() + 60_000),
          providerIdempotencyKey: "contact-reply/" + hash(requestId).slice(0, 40),
        }),
        true
      );

      const messageHash = hash("reply-message-" + requestId);
      const [a, b] = await Promise.all([
        repositories.replyTokens.claim(jtiHash, messageHash),
        repositories.replyTokens.claim(jtiHash, messageHash),
      ]);

      assert.equal([a.claimed, b.claimed].filter(Boolean).length, 1);

      assert.equal(
        await repositories.replyTokens.release(jtiHash, messageHash, "TEST_RELEASE"),
        "issued"
      );
      assert.equal(
        (await repositories.replyTokens.claim(jtiHash, messageHash)).claimed,
        true
      );
      assert.equal(
        await repositories.replyTokens.markUsed(
          jtiHash,
          messageHash,
          "provider-message-persistence-test"
        ),
        true
      );

      const afterUse = await repositories.replyTokens.claim(jtiHash, messageHash);
      assert.equal(afterUse.claimed, false);
      assert.equal(afterUse.token.state, "used");
    });

    await t.test("critical idempotency reservation is atomic", async () => {
      const keyHash = hash("idempotency-key");
      const fingerprint = hash("payload-fingerprint");
      const expiresAt = new Date(Date.now() + 60_000);

      const [a, b] = await Promise.all([
        repositories.idempotency.reserve({
          scope: "contact",
          keyHash,
          fingerprint,
          expiresAt,
        }),
        repositories.idempotency.reserve({
          scope: "contact",
          keyHash,
          fingerprint,
          expiresAt,
        }),
      ]);

      assert.equal([a.reserved, b.reserved].filter(Boolean).length, 1);

      assert.equal(
        await repositories.idempotency.complete({
          scope: "contact",
          keyHash,
          fingerprint,
          status: 200,
          body: { ok: true, id: requestId },
        }),
        true
      );

      const replay = await repositories.idempotency.reserve({
        scope: "contact",
        keyHash,
        fingerprint,
        expiresAt,
      });
      assert.equal(replay.reserved, false);
      assert.equal(replay.record.state, "done");
      assert.equal(replay.record.response_status, 200);
      assert.deepEqual(replay.record.response_body, { ok: true, id: requestId });
    });

    await t.test("newsletter consent history is append-only", async () => {
      const emailHash = hash("newsletter@example.test");
      const eventId = randomUUID();

      const contact = await repositories.newsletter.upsertContact({
        emailHash,
        currentState: "pending",
        consentVersion: "newsletter-r4-test",
      });
      assert.equal(contact.current_state, "pending");

      const appended = await repositories.newsletter.appendConsentEvent({
        eventId,
        emailHash,
        eventType: "opt_in_requested",
        consentVersion: "newsletter-r4-test",
        source: "integration_test",
        correlationId: requestId,
        metadata: { test: true },
      });
      assert.equal(appended.inserted, true);
      assert.equal(appended.eventId, eventId);

      const replayed = await repositories.newsletter.appendConsentEvent({
        eventId,
        emailHash,
        eventType: "opt_in_requested",
        consentVersion: "newsletter-r4-test",
        source: "integration_test",
        correlationId: requestId,
        metadata: { test: true },
      });
      assert.equal(replayed.inserted, false);
      assert.equal(replayed.eventId, eventId);

      const events = await repositories.newsletter.listConsentEvents(emailHash);
      assert.equal(events.length, 1);
      assert.equal(events[0].event_type, "opt_in_requested");
      assert.deepEqual(events[0].metadata, { test: true });

      await assert.rejects(
        () =>
          database.query(
            "UPDATE newsletter_consent_events SET source = 'tampered' WHERE event_id = $1",
            [eventId]
          ),
        /append-only/
      );

      await assert.rejects(
        () =>
          database.query(
            "DELETE FROM newsletter_consent_events WHERE event_id = $1",
            [eventId]
          ),
        /append-only/
      );
    });

    await t.test("newsletter projection CAS prevents stale consent overwrite", async () => {
      const emailHash = hash("newsletter-race@example.test");
      const initial = await repositories.newsletter.upsertContact({
        emailHash,
        currentState: "pending",
        consentVersion: "newsletter-r4-test",
      });
      assert.equal(initial.state_version, "0");

      const snapshotA = await repositories.newsletter.getContact(emailHash);
      const snapshotB = await repositories.newsletter.getContact(emailHash);

      const withdrawnAt = new Date();
      const withdrawn = await repositories.newsletter.upsertContact({
        emailHash,
        currentState: "unsubscribed",
        unsubscribedAt: withdrawnAt,
        expectedStateVersion: Number(snapshotA.state_version),
      });
      assert.equal(withdrawn.current_state, "unsubscribed");
      assert.equal(Number(withdrawn.state_version), 1);

      const staleProviderSync = await repositories.newsletter.upsertContact({
        emailHash,
        currentState: "subscribed",
        confirmedAt: new Date(withdrawnAt.getTime() - 1000),
        expectedStateVersion: Number(snapshotB.state_version),
      });
      assert.equal(staleProviderSync, null);

      const latest = await repositories.newsletter.getContact(emailHash);
      assert.equal(latest.current_state, "unsubscribed");
      assert.equal(Number(latest.state_version), 1);
    });
  }
);

test("persistence fails closed when DATABASE_URL is absent", async () => {
  const database = createDatabase({ connectionString: "" });
  assert.equal(database.enabled, false);
  await assert.rejects(
    () => database.query("SELECT 1"),
    (error) => error?.code === "PERSISTENCE_NOT_CONFIGURED"
  );
});

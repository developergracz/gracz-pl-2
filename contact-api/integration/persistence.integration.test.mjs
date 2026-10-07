import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createDatabase } from "../persistence/database.mjs";
import { applyMigrations } from "../persistence/migrator.mjs";
import { createPersistenceRepositories } from "../persistence/repositories.mjs";

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

    const secondMigration = await applyMigrations(database);
    assert.ok(secondMigration.skipped.includes("001_persistent_state.sql"));

    await database.query(
      `TRUNCATE TABLE
        newsletter_consent_events,
        newsletter_contacts,
        reply_tokens,
        idempotency_keys,
        contact_cases
       CASCADE`
    );

    const repositories = createPersistenceRepositories(database);
    const requestId = randomUUID();
    const senderHash = hash("jan@example.test");

    assert.equal(
      await repositories.contactCases.create({
        requestId,
        senderHash,
        category: "Pytanie ogólne",
        subject: "Persistence integration test",
        sourcePath: "/kontakt",
      }),
      true
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

      assert.equal(
        await repositories.newsletter.appendConsentEvent({
          eventId,
          emailHash,
          eventType: "opt_in_requested",
          consentVersion: "newsletter-r4-test",
          source: "integration_test",
          correlationId: requestId,
          metadata: { test: true },
        }),
        eventId
      );

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

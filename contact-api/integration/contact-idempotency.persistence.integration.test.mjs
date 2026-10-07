import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createDatabase } from "../persistence/database.mjs";
import { applyMigrations } from "../persistence/migrator.mjs";
import { createPersistenceRepositories } from "../persistence/repositories.mjs";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

function hash(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

test(
  "R4.3 contact idempotency survives restart and keeps uncertain inflight state fail-closed",
  { skip: !DATABASE_URL },
  async (t) => {
    const database = createDatabase({ connectionString: DATABASE_URL });
    t.after(() => database.close());

    await applyMigrations(database);
    await database.query(
      `TRUNCATE TABLE
        newsletter_consent_events,
        newsletter_contacts,
        reply_tokens,
        idempotency_keys,
        contact_cases
       CASCADE`
    );

    const firstProcess = createPersistenceRepositories(database);
    const scope = "contact";
    const keyHash = hash("contact-idempotency-key");
    const fingerprint = hash("contact-payload-v1");

    const first = await firstProcess.idempotency.reserve({
      scope,
      keyHash,
      fingerprint,
      expiresAt: new Date(Date.now() + 60_000),
    });
    assert.equal(first.reserved, true);
    assert.equal(first.record.state, "inflight");

    await t.test("restart sees inflight reservation instead of creating a second one", async () => {
      const restartedProcess = createPersistenceRepositories(database);

      const stored = await restartedProcess.idempotency.get({
        scope,
        keyHash,
      });
      assert.equal(stored.state, "inflight");
      assert.equal(stored.fingerprint, fingerprint);

      const second = await restartedProcess.idempotency.reserve({
        scope,
        keyHash,
        fingerprint,
        expiresAt: new Date(Date.now() + 60_000),
      });
      assert.equal(second.reserved, false);
      assert.equal(second.record.state, "inflight");
    });

    await t.test("completed response survives restart as replay data", async () => {
      assert.equal(
        await firstProcess.idempotency.complete({
          scope,
          keyHash,
          fingerprint,
          status: 200,
          body: {
            ok: true,
            id: "11111111-1111-4111-8111-111111111111",
            newsletter: "not_requested",
          },
        }),
        true
      );

      const restartedProcess = createPersistenceRepositories(database);
      const stored = await restartedProcess.idempotency.get({
        scope,
        keyHash,
      });

      assert.equal(stored.state, "done");
      assert.equal(stored.response_status, 200);
      assert.deepEqual(stored.response_body, {
        ok: true,
        id: "11111111-1111-4111-8111-111111111111",
        newsletter: "not_requested",
      });
    });

    await t.test("known pre-delivery failure can release and reserve again", async () => {
      const retryKeyHash = hash("known-failure-key");
      const retryFingerprint = hash("known-failure-payload");

      const reserved = await firstProcess.idempotency.reserve({
        scope,
        keyHash: retryKeyHash,
        fingerprint: retryFingerprint,
        expiresAt: new Date(Date.now() + 60_000),
      });
      assert.equal(reserved.reserved, true);

      assert.equal(
        await firstProcess.idempotency.release({
          scope,
          keyHash: retryKeyHash,
          fingerprint: retryFingerprint,
        }),
        true
      );

      const retried = await firstProcess.idempotency.reserve({
        scope,
        keyHash: retryKeyHash,
        fingerprint: retryFingerprint,
        expiresAt: new Date(Date.now() + 60_000),
      });
      assert.equal(retried.reserved, true);
    });

    await t.test("expired inflight state is not recycled after an uncertain crash", async () => {
      const uncertainKeyHash = hash("uncertain-key");
      const uncertainFingerprint = hash("uncertain-payload");

      const reserved = await firstProcess.idempotency.reserve({
        scope,
        keyHash: uncertainKeyHash,
        fingerprint: uncertainFingerprint,
        expiresAt: new Date(Date.now() + 60_000),
      });
      assert.equal(reserved.reserved, true);

      await database.query(
        `UPDATE idempotency_keys
         SET expires_at = now() - interval '1 minute'
         WHERE scope = $1 AND key_hash = $2`,
        [scope, uncertainKeyHash]
      );

      const restartedProcess = createPersistenceRepositories(database);
      const retry = await restartedProcess.idempotency.reserve({
        scope,
        keyHash: uncertainKeyHash,
        fingerprint: uncertainFingerprint,
        expiresAt: new Date(Date.now() + 60_000),
      });

      assert.equal(retry.reserved, false);
      assert.equal(retry.record.state, "inflight");
    });

    await t.test("expired completed state may be recycled safely", async () => {
      const recyclableKeyHash = hash("recyclable-key");
      const firstFingerprint = hash("recyclable-payload-v1");
      const secondFingerprint = hash("recyclable-payload-v2");

      assert.equal(
        (
          await firstProcess.idempotency.reserve({
            scope,
            keyHash: recyclableKeyHash,
            fingerprint: firstFingerprint,
            expiresAt: new Date(Date.now() + 60_000),
          })
        ).reserved,
        true
      );

      assert.equal(
        await firstProcess.idempotency.complete({
          scope,
          keyHash: recyclableKeyHash,
          fingerprint: firstFingerprint,
          status: 200,
          body: { ok: true },
        }),
        true
      );

      await database.query(
        `UPDATE idempotency_keys
         SET expires_at = now() - interval '1 minute'
         WHERE scope = $1 AND key_hash = $2`,
        [scope, recyclableKeyHash]
      );

      const recycled = await firstProcess.idempotency.reserve({
        scope,
        keyHash: recyclableKeyHash,
        fingerprint: secondFingerprint,
        expiresAt: new Date(Date.now() + 60_000),
      });

      assert.equal(recycled.reserved, true);
      assert.equal(recycled.record.state, "inflight");
      assert.equal(recycled.record.fingerprint, secondFingerprint);
    });
  }
);

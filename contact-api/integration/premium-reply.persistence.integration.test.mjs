import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createPremiumReplyManager } from "../premium-reply.mjs";
import { createDatabase } from "../persistence/database.mjs";
import { applyMigrations } from "../persistence/migrator.mjs";
import { createPersistenceRepositories } from "../persistence/repositories.mjs";
import { createContactDataCrypto } from "../security/contact-data-crypto.mjs";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

function hash(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function payload(overrides = {}) {
  return {
    name: "Jan Kowalski",
    email: "jan@example.test",
    category: "Pytanie ogólne",
    subject: "Trwała odpowiedź Premium",
    message: "Wiadomość testowa dla trwałego Premium Reply.",
    page: "https://gracz.pl/",
    ...overrides,
  };
}

function extractToken(delivery) {
  const match = String(delivery.replyUrl || "").match(/#token=([A-Za-z0-9._-]+)/);
  assert.ok(match, "expected persisted Premium Reply token");
  return match[1];
}

function manager(store) {
  return createPremiumReplyManager({
    secret: "test-" + "r".repeat(40),
    ownerAddress: "admin@gracz.pl",
    newsletterUrl: "https://gracz.pl/newsletter/",
    tokenStore: store,
  });
}

async function createCase(repositories, requestId, email = "jan@example.test") {
  const contactCrypto = createContactDataCrypto({
    secret: "integration-" + "k".repeat(64),
  });
  const created = await repositories.contactCases.create({
    requestId,
    senderHash: hash(email),
    category: "Pytanie ogólne",
    subjectCiphertext: contactCrypto.encrypt("Trwała odpowiedź Premium", {
      aad: "contact-case:" + requestId + ":subject",
    }),
    sourcePathCiphertext: contactCrypto.encrypt("https://gracz.pl/", {
      aad: "contact-case:" + requestId + ":source",
    }),
  });
  assert.equal(created, true);
}

test(
  "R4.2 Premium Reply remains one-time across manager restart and concurrent claims",
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

    const repositories = createPersistenceRepositories(database);

    await t.test("used token stays used after manager restart", async () => {
      const requestId = randomUUID();
      await createCase(repositories, requestId);

      const beforeRestart = manager(repositories.replyTokens);
      const adminDelivery = await beforeRestart.createAdminDelivery(
        payload(),
        requestId
      );
      const token = extractToken(adminDelivery);

      const first = await beforeRestart.prepareReply(
        token,
        "To jest pierwsza i jedyna odpowiedź."
      );
      await beforeRestart.markReplySent(
        first.tokenKey,
        first.messageHash,
        "provider-message-1"
      );

      const afterRestart = manager(repositories.replyTokens);

      await assert.rejects(
        () =>
          afterRestart.prepareReply(
            token,
            "To jest pierwsza i jedyna odpowiedź."
          ),
        (error) => error?.code === "REPLY_TOKEN_USED" && error?.status === 409
      );

      const stored = await repositories.replyTokens.get(first.tokenKey);
      assert.equal(stored.state, "used");
      assert.equal(stored.provider_message_id, "provider-message-1");

      const parent = await database.query(
        "SELECT reply_status FROM contact_cases WHERE request_id = $1",
        [requestId]
      );
      assert.equal(parent.rows[0].reply_status, "sent");
    });

    await t.test("concurrent managers cannot both claim the same token", async () => {
      const requestId = randomUUID();
      await createCase(repositories, requestId, "race@example.test");

      const issuer = manager(repositories.replyTokens);
      const adminDelivery = await issuer.createAdminDelivery(
        payload({ email: "race@example.test", subject: "Race test" }),
        requestId
      );
      const token = extractToken(adminDelivery);

      const a = manager(repositories.replyTokens);
      const b = manager(repositories.replyTokens);

      const results = await Promise.allSettled([
        a.prepareReply(token, "Jedna treść odpowiedzi."),
        b.prepareReply(token, "Jedna treść odpowiedzi."),
      ]);

      const fulfilled = results.filter((item) => item.status === "fulfilled");
      const rejected = results.filter((item) => item.status === "rejected");

      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(rejected[0].reason?.code, "REPLY_TOKEN_IN_PROGRESS");

      const claimed = fulfilled[0].value;
      await issuer.releaseReply(
        claimed.tokenKey,
        claimed.messageHash,
        "TEST_RELEASE"
      );
    });

    await t.test("retry is locked to the original message fingerprint", async () => {
      const requestId = randomUUID();
      await createCase(repositories, requestId, "retry@example.test");

      const reply = manager(repositories.replyTokens);
      const adminDelivery = await reply.createAdminDelivery(
        payload({ email: "retry@example.test", subject: "Retry test" }),
        requestId
      );
      const token = extractToken(adminDelivery);

      const first = await reply.prepareReply(token, "Treść do ponowienia.");
      assert.match(first.providerIdempotencyKey, /^contact-reply\/[a-f0-9]{40}$/);

      await reply.releaseReply(
        first.tokenKey,
        first.messageHash,
        "MAIL_PROVIDER_NETWORK_ERROR"
      );

      await assert.rejects(
        () => reply.prepareReply(token, "Zmieniona treść po nieudanej próbie."),
        (error) =>
          error?.code === "REPLY_TOKEN_MESSAGE_CONFLICT" &&
          error?.status === 409
      );

      const retry = await reply.prepareReply(token, "Treść do ponowienia.");
      assert.equal(retry.messageHash, first.messageHash);
      assert.equal(retry.providerIdempotencyKey, first.providerIdempotencyKey);

      await reply.markReplySent(
        retry.tokenKey,
        retry.messageHash,
        "provider-message-retry"
      );
    });
  }
);

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

import { NewsletterService } from "../src/newsletter.js";
import { NewsletterAdminService } from "../src/newsletter-admin-service.js";
import { NewsletterLifecycleRecorder } from "../src/newsletter-lifecycle-recorder.js";
import poolBudget from "../src/postgres-pool-budget.cjs";

const {
  POSTGRES_RESOURCE_PROFILE,
  aggregatePoolMax,
  aggregateEmbeddedPersistentListeners,
  aggregateExternalPersistentClients,
  aggregateStartupTemporaryClients,
  connectionBudgetPlan,
  configuredPoolBudget,
} = poolBudget;

const DATABASE_URL = process.env.B1_C35_DATABASE_URL || "";

test("B1-C35 static contract makes newsletter lifecycle an admin-pool borrower", async () => {
  const lifecycleSource = await readFile(new URL("../src/newsletter-lifecycle-recorder.js", import.meta.url), "utf8");
  const adminSource = await readFile(new URL("../src/newsletter-admin-service.js", import.meta.url), "utf8");
  const newsletterSource = await readFile(new URL("../src/newsletter.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

  assert.doesNotMatch(lifecycleSource, /from\s+["']pg["']/);
  assert.doesNotMatch(lifecycleSource, /new\s+Pool\s*\(/);
  assert.doesNotMatch(lifecycleSource, /new\s+pg\.Pool\s*\(/);
  assert.doesNotMatch(lifecycleSource, /new\s+Client\s*\(/);
  assert.doesNotMatch(lifecycleSource, /new\s+pg\.Client\s*\(/);
  assert.doesNotMatch(lifecycleSource, /this\.pool\.end\s*\(/);
  assert.match(lifecycleSource, /constructor\(pool\s*=\s*null\)/);
  assert.match(lifecycleSource, /this\.pool\s*=\s*pool/);

  assert.match(adminSource, /new\s+Pool\([\s\S]*?max:\s*3/);
  assert.match(newsletterSource, /new\s+Pool\([\s\S]*?max:\s*3/);

  const adminReadyIndex = main.indexOf("const newsletterAdmin=new NewsletterAdminService(config.databaseUrl||null);await newsletterAdmin.ready;");
  const lifecycleIndex = main.indexOf("const newsletterLifecycle=new NewsletterLifecycleRecorder(newsletterAdmin.pool);");
  assert.ok(adminReadyIndex >= 0 && lifecycleIndex > adminReadyIndex, "lifecycle recorder must be constructed only after newsletterAdmin.ready");
  assert.doesNotMatch(main, /new NewsletterLifecycleRecorder\(config\.databaseUrl\|\|null\)/);
  assert.doesNotMatch(main, /new NewsletterLifecycleRecorder\(newsletter\.pool\)/);

  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.length, 14);
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.some((entry) => entry.id === "newsletter-lifecycle"), false);
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.some((entry) => entry.id === "newsletter-admin"), true);
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.some((entry) => entry.id === "newsletter"), true);
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.find((entry) => entry.id === "newsletter-admin")?.max, 3);
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.find((entry) => entry.id === "newsletter")?.max, 3);
  assert.equal(aggregatePoolMax(), 48);
  assert.equal(aggregateEmbeddedPersistentListeners(), 3);
  assert.equal(aggregateExternalPersistentClients(), 1);
  assert.equal(aggregateStartupTemporaryClients(), 1);
  assert.equal(configuredPoolBudget({ POSTGRES_POOL_BUDGET: "64" }), 48);
  assert.equal(configuredPoolBudget({ POSTGRES_POOL_BUDGET: "48" }), 48);
  assert.throws(
    () => configuredPoolBudget({ POSTGRES_POOL_BUDGET: "47" }),
    (error) => error?.code === "POSTGRES_POOL_BUDGET_EXCEEDED",
  );

  const expected = [
    [1, 49, 50, true],
    [2, 98, 100, false],
    [3, 147, 150, false],
    [4, 196, 200, false],
  ];
  for (const [replicaCount, steadyEnvelope, startupEnvelope, safe] of expected) {
    const plan = connectionBudgetPlan({
      replicaCount,
      maxConnections: 100,
      reservedConnections: 0,
      superuserReservedConnections: 3,
      environment: { POSTGRES_POOL_BUDGET: "64" },
    });
    assert.equal(plan.poolMaxPerReplica, 48);
    assert.equal(plan.externalDedicatedPerReplica, 1);
    assert.equal(plan.startupOverlapPerReplica, 1);
    assert.equal(plan.steadyEnvelope, steadyEnvelope);
    assert.equal(plan.startupEnvelope, startupEnvelope);
    assert.equal(plan.safeApplicationCapacity, 87);
    assert.equal(plan.safe, safe);
  }
});

test("B1-C35 real PostgreSQL lifecycle shares exact admin pool and preserves lifecycle semantics and shutdown", { skip: !DATABASE_URL, timeout: 30_000 }, async () => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const email = `c35-${suffix}@example.com`;
  const nick = `C35_${suffix.slice(0, 8)}`;
  const confirmationHash = Buffer.from(`confirmation-${suffix}`, "utf8");
  const unsubscribeHash = Buffer.from(`unsubscribe-${suffix}`, "utf8");
  let newsletter = null;
  let newsletterAdmin = null;
  let adminClosed = false;
  let newsletterClosed = false;
  let subscriberId = null;

  try {
    const allocatedBefore = Number(pg.Pool.graczAllocatedPoolMax ?? 0);

    newsletter = new NewsletterService(DATABASE_URL, {
      mail: { send: async () => ({ sent: true }) },
      baseUrl: "https://gracz.pl",
    });
    await newsletter.ready;
    const allocatedAfterNewsletter = Number(pg.Pool.graczAllocatedPoolMax ?? 0);
    assert.equal(allocatedAfterNewsletter - allocatedBefore, 3, "NewsletterService must remain max=3");
    assert.equal(newsletter.pool.options.max, 3);

    newsletterAdmin = new NewsletterAdminService(DATABASE_URL);
    await newsletterAdmin.ready;
    const allocatedAfterAdmin = Number(pg.Pool.graczAllocatedPoolMax ?? 0);
    assert.equal(allocatedAfterAdmin - allocatedAfterNewsletter, 3, "NewsletterAdminService must remain max=3");
    assert.equal(newsletterAdmin.pool.options.max, 3);
    assert.notEqual(newsletter.pool, newsletterAdmin.pool, "NewsletterService must remain a separate physical pool");

    const newsletterLifecycle = new NewsletterLifecycleRecorder(newsletterAdmin.pool);
    assert.equal(newsletterLifecycle.pool, newsletterAdmin.pool, "lifecycle must borrow the exact NewsletterAdminService pool");
    assert.equal(Number(pg.Pool.graczAllocatedPoolMax ?? 0), allocatedAfterAdmin, "lifecycle recorder must allocate no independent pool");

    const inserted = await newsletterAdmin.pool.query(
      `INSERT INTO gracz_newsletter_subscribers(
        email,email_normalized,preferred_nick,preferred_nick_normalized,
        consent_version,consented_at,status,confirmation_token_hash,
        confirmation_expires_at,confirmation_sent_at
      ) VALUES($1,$1,$2,$3,$4,NOW(),'pending_confirmation',$5,NOW()+INTERVAL '24 hours',NOW())
      RETURNING id`,
      [email, nick, nick.toLowerCase(), "launch-v3-double-opt-in", confirmationHash],
    );
    subscriberId = Number(inserted.rows[0].id);

    await newsletterLifecycle.captureSubscribe(email, "homepage");
    await newsletterLifecycle.captureResend(email, "homepage");

    const confirmationContext = await newsletterLifecycle.findConfirmationContext(confirmationHash);
    assert.equal(Number(confirmationContext?.id), subscriberId);
    assert.equal(confirmationContext?.consent_version, "launch-v3-double-opt-in");

    await newsletterAdmin.pool.query(
      `UPDATE gracz_newsletter_subscribers
       SET status='subscribed',confirmed_at=NOW(),confirmation_token_hash=NULL,unsubscribe_token_hash=$2,updated_at=NOW()
       WHERE id=$1`,
      [subscriberId, unsubscribeHash],
    );
    await newsletterLifecycle.captureConfirmed(subscriberId, "homepage");
    await newsletterLifecycle.captureConfirmed(subscriberId, "homepage");

    const unsubscribeContext = await newsletterLifecycle.findUnsubscribeContext(unsubscribeHash);
    assert.equal(Number(unsubscribeContext?.id), subscriberId);
    assert.equal(unsubscribeContext?.consent_version, "launch-v3-double-opt-in");

    await newsletterAdmin.pool.query(
      `UPDATE gracz_newsletter_subscribers
       SET status='unsubscribed',unsubscribed_at=NOW(),unsubscribe_token_hash=NULL,updated_at=NOW()
       WHERE id=$1`,
      [subscriberId],
    );
    await newsletterLifecycle.captureUnsubscribed(subscriberId, "homepage");
    await newsletterLifecycle.captureUnsubscribed(subscriberId, "homepage");

    const administrative = await newsletterAdmin.subscriber(subscriberId);
    assert.equal(administrative.subscriber.maskedEmail, "c3***@example.com");
    assert.equal(administrative.subscriber.status, "unsubscribed");
    assert.ok(administrative.sources.some((source) => source.code === "homepage"));

    const consentActions = administrative.consentHistory.map((entry) => entry.action);
    assert.ok(consentActions.includes("granted"));
    assert.ok(consentActions.includes("confirmed"));
    assert.ok(consentActions.includes("revoked"));

    const eventTypes = administrative.events.map((entry) => entry.eventType);
    assert.ok(eventTypes.includes("subscribe.requested"));
    assert.ok(eventTypes.includes("subscribe.resend_requested"));
    assert.ok(eventTypes.includes("subscribe.confirmation_sent"));
    assert.ok(eventTypes.includes("subscribe.confirmed"));
    assert.ok(eventTypes.includes("subscribe.unsubscribed"));
    assert.equal(eventTypes.filter((type) => type === "subscribe.confirmed").length, 1, "confirmed lifecycle event must remain deduplicated");
    assert.equal(eventTypes.filter((type) => type === "subscribe.unsubscribed").length, 1, "unsubscribe lifecycle event must remain deduplicated");

    const physicalAdminPool = newsletterAdmin.pool;
    const originalAdminEnd = physicalAdminPool.end.bind(physicalAdminPool);
    let adminPoolEndCount = 0;
    physicalAdminPool.end = (...args) => {
      adminPoolEndCount += 1;
      return originalAdminEnd(...args);
    };

    await newsletterLifecycle.close();
    await newsletterLifecycle.close();
    assert.equal(adminPoolEndCount, 0, "lifecycle borrower close must not terminate canonical admin pool");
    assert.equal((await physicalAdminPool.query("SELECT 1 AS ok")).rows[0].ok, 1, "canonical admin pool must remain usable after borrower close");

    await newsletter.close();
    newsletterClosed = true;
    assert.equal(adminPoolEndCount, 0, "closing separate NewsletterService pool must not terminate admin pool");
    assert.equal((await physicalAdminPool.query("SELECT 1 AS ok")).rows[0].ok, 1);

    await physicalAdminPool.query("DELETE FROM newsletter_events WHERE subscriber_id=$1", [subscriberId]);
    await physicalAdminPool.query("DELETE FROM newsletter_consent_history WHERE subscriber_id=$1", [subscriberId]);
    await physicalAdminPool.query("DELETE FROM newsletter_subscriber_sources WHERE subscriber_id=$1", [subscriberId]);
    await physicalAdminPool.query("DELETE FROM gracz_newsletter_subscribers WHERE id=$1", [subscriberId]);
    subscriberId = null;

    await newsletterAdmin.close();
    adminClosed = true;
    assert.equal(adminPoolEndCount, 1, "only NewsletterAdminService physical owner may terminate the shared pool");
    assert.equal(physicalAdminPool.totalCount, 0);
    assert.equal(physicalAdminPool.waitingCount, 0);
  } finally {
    if (subscriberId && newsletterAdmin?.pool) {
      await newsletterAdmin.pool.query("DELETE FROM newsletter_events WHERE subscriber_id=$1", [subscriberId]).catch(() => {});
      await newsletterAdmin.pool.query("DELETE FROM newsletter_consent_history WHERE subscriber_id=$1", [subscriberId]).catch(() => {});
      await newsletterAdmin.pool.query("DELETE FROM newsletter_subscriber_sources WHERE subscriber_id=$1", [subscriberId]).catch(() => {});
      await newsletterAdmin.pool.query("DELETE FROM gracz_newsletter_subscribers WHERE id=$1", [subscriberId]).catch(() => {});
    }
    if (!newsletterClosed && newsletter) await newsletter.close().catch(() => {});
    if (!adminClosed && newsletterAdmin) await newsletterAdmin.close().catch(() => {});
  }
});

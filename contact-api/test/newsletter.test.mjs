import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryNewsletterConsentStore } from "../persistence/memory-newsletter-consent-store.mjs";
import { createProvider, createManager, extractToken, consentEmailHash } from "../test-support/newsletter-provider.mjs";
const CONFIRMED_AT_KEY = "gracz_newsletter_confirmed_at";
const UNSUBSCRIBED_AT_KEY = "gracz_newsletter_unsubscribed_at";
test("hybrid newsletter lifecycle uses Resend operational state and first-party consent audit", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider);

  const requested = await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "contact_form",
  });

  assert.equal(requested.state, "request_received");

  const consentHash = consentEmailHash("jan@example.test");
  const pendingLedgerContact = await provider.consentStore.getContact(consentHash);
  assert.equal(pendingLedgerContact.current_state, "pending");
  let consentEvents = await provider.consentStore.listConsentEvents(consentHash);
  assert.deepEqual(
    consentEvents.map((event) => event.event_type),
    ["opt_in_requested"]
  );

  assert.equal(provider.contacts.size, 0, "contact must not exist before double opt-in");
  assert.equal(provider.emails.length, 1);
  assert.match(provider.emails[0].body.subject, /^♦️ gracz\.pl Newsletter — potwierdź zapis$/);
  assert.match(provider.emails[0].body.html, /FULL MAX PREMIUM/);
  assert.match(provider.emails[0].body.html, /DOUBLE OPT-IN/);
  assert.match(
    provider.emails[0].body.headers["X-Entity-Ref-ID"],
    /^gracz-newsletter-confirm-[a-f0-9]{40}$/
  );

  const firstConfirmToken = extractToken(provider.emails[0], "confirm");
  provider.behavior.contactGet429Remaining = 1;

  const confirmed = await manager.confirm(firstConfirmToken);
  assert.equal(confirmed.state, "subscribed");
  assert.ok(provider.stats.contactGetAttempts >= 2, "429 must be retried");

  assert.equal(provider.segments.length, 1);
  assert.equal(provider.segments[0].name, "gracz.pl Newsletter");
  assert.equal(provider.topics.length, 1);
  assert.equal(provider.topics[0].name, "Newsletter gracz.pl");
  assert.equal(provider.topics[0].default_subscription, "opt_out");
  assert.equal(provider.contactProperties.length, 3);

  const contact = provider.contacts.get("jan@example.test");
  assert.ok(contact);
  assert.equal(contact.unsubscribed, false);
  assert.equal(contact.first_name, "Jan");
  assert.equal(contact.last_name, "Kowalski");
  assert.ok(Number(contact.properties[CONFIRMED_AT_KEY]) > 0);
  assert.equal(
    contact.properties.gracz_newsletter_consent_version,
    "newsletter-r1-2026-10-07"
  );
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), true);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_in");

  const confirmedLedgerContact = await provider.consentStore.getContact(consentHash);
  assert.equal(confirmedLedgerContact.current_state, "subscribed");
  assert.ok(confirmedLedgerContact.confirmed_at);
  consentEvents = await provider.consentStore.listConsentEvents(consentHash);
  assert.deepEqual(
    consentEvents.map((event) => event.event_type),
    ["opt_in_requested", "opt_in_confirmed"]
  );

  const documented = provider.providerContact(contact);
  assert.equal(
    documented.properties[CONFIRMED_AT_KEY].value,
    contact.properties[CONFIRMED_AT_KEY]
  );
  assert.equal(documented.properties[CONFIRMED_AT_KEY].type, "number");

  assert.equal(provider.emails.length, 2);
  assert.match(provider.emails[1].body.subject, /^♦️ gracz\.pl Newsletter — witamy!$/);
  assert.match(provider.emails[1].body.html, /FULL MAX PREMIUM/);
  const firstUnsubscribeToken = extractToken(provider.emails[1], "unsubscribe");

  const mutationsBeforeReplay = provider.stats.contactMutations;
  const repeated = await manager.confirm(firstConfirmToken);
  assert.equal(repeated.state, "already_subscribed");
  assert.equal(provider.stats.contactMutations, mutationsBeforeReplay);
  assert.equal(provider.emails.length, 2);
  consentEvents = await provider.consentStore.listConsentEvents(consentHash);
  assert.equal(
    consentEvents.filter((event) => event.event_type === "opt_in_confirmed").length,
    1
  );

  await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "newsletter_page",
  });
  assert.equal(provider.emails.length, 2, "active subscriber receives no new DOI");
  const secondConfirmToken = firstConfirmToken;
  const mutationsBeforeActiveConfirm = provider.stats.contactMutations;
  assert.equal((await manager.confirm(secondConfirmToken)).state, "already_subscribed");
  assert.equal(provider.stats.contactMutations, mutationsBeforeActiveConfirm);

  const unsubscribed = await manager.unsubscribe(firstUnsubscribeToken);
  assert.equal(unsubscribed.state, "unsubscribed");
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), false);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_out");
  assert.ok(Number(contact.properties[UNSUBSCRIBED_AT_KEY]) > 0);

  const unsubscribedLedgerContact = await provider.consentStore.getContact(consentHash);
  assert.equal(unsubscribedLedgerContact.current_state, "unsubscribed");
  assert.ok(unsubscribedLedgerContact.unsubscribed_at);
  consentEvents = await provider.consentStore.listConsentEvents(consentHash);
  assert.equal(
    consentEvents.filter((event) => event.event_type === "unsubscribe").length,
    1
  );

  await assert.rejects(
    () => manager.confirm(secondConfirmToken),
    (error) => error?.code === "NEWSLETTER_CONFIRMATION_STALE"
  );

  await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "newsletter_page",
  });
  const thirdConfirmToken = extractToken(provider.emails[2], "confirm");
  const resubscribed = await manager.confirm(thirdConfirmToken);
  assert.equal(resubscribed.state, "resubscribed");
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), true);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_in");
  assert.equal(contact.unsubscribed, false);
  assert.equal(provider.emails.length, 4);

  consentEvents = await provider.consentStore.listConsentEvents(consentHash);
  assert.equal(
    consentEvents.filter((event) => event.event_type === "resubscribe").length,
    1
  );

  const thirdUnsubscribeToken = extractToken(provider.emails[3], "unsubscribe");

  const confirmedAtAfterResubscribe = Number(contact.properties[CONFIRMED_AT_KEY]);
  provider.hostedUnsubscribe("jan@example.test");
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_out");

  await assert.rejects(
    () => manager.confirm(thirdConfirmToken),
    (error) => error?.code === "NEWSLETTER_CONFIRMATION_STALE"
  );

  await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "newsletter_page",
  });
  const fourthConfirmToken = extractToken(provider.emails[4], "confirm");
  const hostedResubscribe = await manager.confirm(fourthConfirmToken);
  assert.equal(hostedResubscribe.state, "resubscribed");
  assert.ok(Number(contact.properties[CONFIRMED_AT_KEY]) > confirmedAtAfterResubscribe);
  assert.equal(contact.unsubscribed, false);
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), true);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_in");
  assert.equal(provider.emails.length, 6);

  const fourthUnsubscribeToken = extractToken(provider.emails[5], "unsubscribe");
  const firstOff = await manager.unsubscribe(fourthUnsubscribeToken);
  const secondOff = await manager.unsubscribe(fourthUnsubscribeToken);
  assert.equal(firstOff.state, "unsubscribed");
  assert.equal(secondOff.state, "unsubscribed");
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), false);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_out");

  consentEvents = await provider.consentStore.listConsentEvents(consentHash);
  assert.equal(
    consentEvents.filter((event) => event.event_type === "unsubscribe").length,
    2,
    "reusing the same unsubscribe token must not append a duplicate event"
  );

  assert.ok(thirdUnsubscribeToken.startsWith("n1."));
});

test("hybrid newsletter keeps Resend operational state and no reconciliation engine", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider);

  assert.equal(
    typeof manager.reconcile,
    "undefined",
    "hybrid mode must not expose a second subscription-state reconciliation engine"
  );

  await manager.requestOptIn({
    email: "hybrid@example.test",
    name: "Hybrid Test",
    source: "newsletter_page",
  });
  const firstToken = extractToken(provider.emails[0], "confirm");
  await manager.confirm(firstToken);

  provider.hostedUnsubscribe("hybrid@example.test");

  await assert.rejects(
    () => manager.confirm(firstToken),
    (error) => error?.code === "NEWSLETTER_CONFIRMATION_STALE"
  );

  await manager.requestOptIn({
    email: "hybrid@example.test",
    name: "Hybrid Test",
    source: "newsletter_page",
  });
  const freshToken = extractToken(provider.emails[2], "confirm");
  const result = await manager.confirm(freshToken);

  assert.equal(result.state, "resubscribed");
  assert.equal(provider.contacts.get("hybrid@example.test").unsubscribed, false);
  assert.equal(
    provider.memberships.get("hybrid@example.test").has("segment-1"),
    true
  );
  assert.equal(
    provider.topicStates.get("hybrid@example.test").get("topic-1"),
    "opt_in"
  );
});

test("hybrid cutover protects legacy subscribers without ledger rows", async (t) => {
  const provider = await createProvider(t);
  const legacyStore = createMemoryNewsletterConsentStore();
  const legacyManager = createManager(provider, { consentStore: legacyStore });

  await legacyManager.requestOptIn({
    email: "legacy@example.test",
    name: "Legacy Subscriber",
    source: "newsletter_page",
  });
  const legacyToken = extractToken(provider.emails[0], "confirm");
  const initial = await legacyManager.confirm(legacyToken);
  assert.equal(initial.state, "subscribed");

  const welcomeCount = provider.emails.filter((email) =>
    /Newsletter — witamy!/i.test(String(email.body.subject || ""))
  ).length;
  assert.equal(welcomeCount, 1);

  // Simulate an R1-R3 subscriber at R4 cutover: provider state/properties
  // exist, but the new first-party consent ledger is empty.
  const cutoverStore = createMemoryNewsletterConsentStore();
  const cutoverManager = createManager(provider, { consentStore: cutoverStore });

  const replayWhileActive = await cutoverManager.confirm(legacyToken);
  assert.equal(
    replayWhileActive.state,
    "already_subscribed",
    "old legacy DOI must be a no-op while provider subscription is active"
  );
  assert.equal(
    provider.emails.filter((email) =>
      /Newsletter — witamy!/i.test(String(email.body.subject || ""))
    ).length,
    1,
    "legacy replay must not send a duplicate welcome"
  );

  provider.hostedUnsubscribe("legacy@example.test");

  await assert.rejects(
    () => cutoverManager.confirm(legacyToken),
    (error) => error?.code === "NEWSLETTER_CONFIRMATION_STALE"
  );
  assert.equal(
    provider.memberships.get("legacy@example.test").has("segment-1"),
    false
  );
  assert.equal(
    provider.topicStates.get("legacy@example.test").get("topic-1"),
    "opt_out"
  );

  // Only a freshly-issued DOI after the provider confirmation timestamp may
  // intentionally resubscribe the legacy address.
  await new Promise((resolve) => setTimeout(resolve, 5));
  await cutoverManager.requestOptIn({
    email: "legacy@example.test",
    name: "Legacy Subscriber",
    source: "newsletter_page",
  });
  const freshToken = extractToken(provider.emails.at(-1), "confirm");
  const resubscribed = await cutoverManager.confirm(freshToken);
  assert.equal(resubscribed.state, "resubscribed");

  const ledger = await cutoverStore.getContact(consentEmailHash("legacy@example.test"));
  assert.equal(ledger.current_state, "subscribed");
  assert.equal(
    provider.memberships.get("legacy@example.test").has("segment-1"),
    true
  );
  assert.equal(
    provider.topicStates.get("legacy@example.test").get("topic-1"),
    "opt_in"
  );
});

test("hybrid concurrent fresh confirmations keep provider active safely", async (t) => {
  // Keep provider-clock and app-clock comparable during concurrent DOI races.
  t.mock.timers.enable({ apis: ["Date"], now: 1_800_000_000_000 });
  const provider = await createProvider(t);
  const manager = createManager(provider);

  await manager.requestOptIn({
    email: "concurrent@example.test",
    name: "Concurrent Test",
    source: "newsletter_page",
  });
  const originalToken = extractToken(provider.emails[0], "confirm");
  await manager.confirm(originalToken);

  provider.hostedUnsubscribe("concurrent@example.test");
  await assert.rejects(
    () => manager.confirm(originalToken),
    (error) => error?.code === "NEWSLETTER_CONFIRMATION_STALE"
  );
  t.mock.timers.tick(1);

  await manager.requestOptIn({
    email: "concurrent@example.test",
    name: "Concurrent Test",
    source: "newsletter_page",
  });
  const freshA = extractToken(provider.emails[2], "confirm");

  // Simulate a second still-valid link issued before durable B1 deduplication.
  await createManager(provider, { consentStore: createMemoryNewsletterConsentStore() }).requestOptIn({
    email: "concurrent@example.test",
    name: "Concurrent Test",
    source: "newsletter_page",
  });
  const freshB = extractToken(provider.emails[3], "confirm");

  const results = await Promise.all([
    manager.confirm(freshA),
    manager.confirm(freshB),
  ]);

  assert.equal(results.length, 2);
  assert.ok(results.every((entry) => entry.state === "resubscribed"));
  assert.equal(
    provider.memberships.get("concurrent@example.test").has("segment-1"),
    true
  );
  assert.equal(
    provider.topicStates.get("concurrent@example.test").get("topic-1"),
    "opt_in"
  );
});

test("hybrid confirmation fails closed if consent commit loses to unsubscribe", async (t) => {
  const provider = await createProvider(t);
  const backingStore = createMemoryNewsletterConsentStore();
  let injectUnsubscribeRace = false;

  provider.consentStore = Object.freeze({
    ...backingStore,
    ensureContact: (...args) => backingStore.ensureContact(...args),
    getContact: (...args) => backingStore.getContact(...args),
    appendConsentEvent: (...args) => backingStore.appendConsentEvent(...args),
    getConsentEvent: (...args) => backingStore.getConsentEvent(...args),
    listConsentEvents: (...args) => backingStore.listConsentEvents(...args),
    async upsertContact(args) {
      if (injectUnsubscribeRace && args.currentState === "subscribed") {
        injectUnsubscribeRace = false;
        const current = await backingStore.getContact(args.emailHash);
        await backingStore.upsertContact({
          emailHash: args.emailHash,
          providerContactId: args.providerContactId,
          currentState: "unsubscribed",
          unsubscribedAt: new Date(Date.now() + 5),
          expectedStateVersion: current.state_version,
        });
        return null;
      }
      return backingStore.upsertContact(args);
    },
  });

  const manager = createManager(provider);

  await manager.requestOptIn({
    email: "race-off@example.test",
    name: "Race Off",
    source: "newsletter_page",
  });
  const token = extractToken(provider.emails[0], "confirm");
  injectUnsubscribeRace = true;

  await assert.rejects(
    () => manager.confirm(token),
    (error) =>
      error?.code === "NEWSLETTER_CONFIRMATION_STALE" ||
      error?.code === "NEWSLETTER_CONSENT_CONFLICT"
  );

  assert.equal(
    provider.contacts.has("race-off@example.test"),
    false,
    "failed durable consent commit must happen before any provider activation"
  );
});

test("hybrid delayed compensation cannot disable a newer successful confirmation", async (t) => {
  const provider = await createProvider(t);
  const backingStore = createMemoryNewsletterConsentStore();
  let injectWithdrawalAfterActivation = false;
  let injected = false;

  provider.consentStore = Object.freeze({
    ...backingStore,
    ensureContact: (...args) => backingStore.ensureContact(...args),
    appendConsentEvent: (...args) => backingStore.appendConsentEvent(...args),
    getConsentEvent: (...args) => backingStore.getConsentEvent(...args),
    listConsentEvents: (...args) => backingStore.listConsentEvents(...args),
    upsertContact: (...args) => backingStore.upsertContact(...args),
    async getContact(emailHash) {
      if (
        injectWithdrawalAfterActivation &&
        !injected &&
        provider.topicStates.get("delayed-comp@example.test")?.get("topic-1") === "opt_in"
      ) {
        injected = true;
        const current = await backingStore.getContact(emailHash);
        await backingStore.upsertContact({
          emailHash,
          providerContactId: current?.provider_contact_id || null,
          currentState: "unsubscribed",
          unsubscribedAt: new Date(Date.now() + 5),
          expectedStateVersion: current.state_version,
        });
      }
      return backingStore.getContact(emailHash);
    },
  });

  const manager = createManager(provider);

  await manager.requestOptIn({
    email: "delayed-comp@example.test",
    name: "Delayed Compensation",
    source: "newsletter_page",
  });
  const tokenA = extractToken(provider.emails[0], "confirm");
  injectWithdrawalAfterActivation = true;

  let tokenB = "";
  provider.behavior.beforeTopicOptOut = async () => {
    // Hosted withdrawal makes the provider inactive before the fresh B1 request.
    provider.hostedUnsubscribe("delayed-comp@example.test");
    await manager.requestOptIn({
      email: "delayed-comp@example.test",
      name: "Delayed Compensation",
      source: "newsletter_page",
    });
    tokenB = extractToken(provider.emails.at(-1), "confirm");
    const resultB = await manager.confirm(tokenB);
    assert.equal(resultB.state, "resubscribed");
  };

  await assert.rejects(
    () => manager.confirm(tokenA),
    (error) =>
      error?.code === "NEWSLETTER_CONFIRMATION_STALE" ||
      error?.code === "NEWSLETTER_CONSENT_CONFLICT"
  );

  assert.ok(tokenB, "newer confirmation must run during delayed compensation");
  const ledger = await backingStore.getContact(
    consentEmailHash("delayed-comp@example.test")
  );
  assert.equal(ledger.current_state, "subscribed");
  assert.equal(
    provider.memberships.get("delayed-comp@example.test").has("segment-1"),
    true,
    "older compensation must not remove the newer subscription"
  );
  assert.equal(
    provider.topicStates.get("delayed-comp@example.test").get("topic-1"),
    "opt_in",
    "older compensation must restore provider topic when a newer DOI wins"
  );
});

test("hybrid welcome failure cannot leave provider active without durable consent", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider);

  await manager.requestOptIn({
    email: "welcome-failure@example.test",
    name: "Welcome Failure",
    source: "newsletter_page",
  });
  const token = extractToken(provider.emails[0], "confirm");

  // R2: a send invocation now makes one attempt; explicit caller recovery remains tested.
  provider.behavior.welcomeEmail503Remaining = 1;

  await assert.rejects(
    () => manager.confirm(token),
    (error) => error?.code === "NEWSLETTER_MAIL_FAILED"
  );

  const ledger = await provider.consentStore.getContact(
    consentEmailHash("welcome-failure@example.test")
  );
  assert.equal(
    ledger.current_state,
    "subscribed",
    "durable consent must exist before provider activation and welcome delivery"
  );
  assert.equal(
    provider.memberships.get("welcome-failure@example.test").has("segment-1"),
    true
  );
  assert.equal(
    provider.topicStates.get("welcome-failure@example.test").get("topic-1"),
    "opt_in"
  );

  const retried = await manager.confirm(token);
  assert.equal(retried.state, "subscribed");
  assert.equal(
    provider.emails.filter((email) => /Newsletter — witamy!/i.test(email.body.subject)).length,
    0,
    "uncertain welcome delivery must not trigger a new send from replay"
  );
});

test("hybrid exhausted provider-off compensation persists and recovers an obligation", async (t) => {
  const provider = await createProvider(t);
  const backingStore = createMemoryNewsletterConsentStore();
  let injectWithdrawalAfterActivation = false;
  let injected = false;

  provider.consentStore = Object.freeze({
    ...backingStore,
    ensureContact: (...args) => backingStore.ensureContact(...args),
    appendConsentEvent: (...args) => backingStore.appendConsentEvent(...args),
    getConsentEvent: (...args) => backingStore.getConsentEvent(...args),
    listConsentEvents: (...args) => backingStore.listConsentEvents(...args),
    upsertContact: (...args) => backingStore.upsertContact(...args),
    async getContact(emailHash) {
      if (
        injectWithdrawalAfterActivation &&
        !injected &&
        provider.topicStates.get("recover-off@example.test")?.get("topic-1") === "opt_in"
      ) {
        injected = true;
        const current = await backingStore.getContact(emailHash);
        await backingStore.upsertContact({
          emailHash,
          providerContactId: current?.provider_contact_id || null,
          currentState: "unsubscribed",
          unsubscribedAt: new Date(Date.now() + 5),
          expectedStateVersion: current.state_version,
        });
      }
      return backingStore.getContact(emailHash);
    },
  });

  const manager = createManager(provider);

  await manager.requestOptIn({
    email: "recover-off@example.test",
    name: "Recover Off",
    source: "newsletter_page",
  });
  const token = extractToken(provider.emails[0], "confirm");

  injectWithdrawalAfterActivation = true;
  provider.behavior.topicOptOut503Remaining = 4;
  provider.behavior.segmentDelete503Remaining = 4;

  await assert.rejects(
    () => manager.confirm(token),
    (error) => error?.code === "NEWSLETTER_PROVIDER_FAILED"
  );

  let ledger = await backingStore.getContact(
    consentEmailHash("recover-off@example.test")
  );
  assert.equal(ledger.current_state, "unsubscribed");
  assert.ok(
    ledger.provider_blocked_at,
    "failed provider-off operation must persist a recovery obligation"
  );

  await manager.requestOptIn({
    email: "recover-off@example.test",
    name: "Recover Off",
    source: "newsletter_page",
  });

  ledger = await backingStore.getContact(
    consentEmailHash("recover-off@example.test")
  );
  assert.equal(
    ledger.provider_blocked_at,
    null,
    "next newsletter interaction must recover and clear the provider-off obligation"
  );
  assert.equal(
    provider.memberships.get("recover-off@example.test").has("segment-1"),
    false
  );
  assert.equal(
    provider.topicStates.get("recover-off@example.test").get("topic-1"),
    "opt_out"
  );
});


test("newsletter R3 repairs partial activation without duplicate welcome", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider);

  await manager.requestOptIn({
    email: "partial@example.test",
    name: "Partial Test",
    source: "newsletter_page",
  });
  const token = extractToken(provider.emails[0], "confirm");

  provider.behavior.failFinalConfirmPatchStatus = 422;

  await assert.rejects(
    () => manager.confirm(token),
    (error) =>
      error?.code === "NEWSLETTER_PROVIDER_FAILED" &&
      error?.status === 422 &&
      error?.providerOperation === "PATCH /contacts/{contact}"
  );

  const contact = provider.contacts.get("partial@example.test");
  assert.ok(contact);
  assert.equal(contact.properties[CONFIRMED_AT_KEY], undefined);
  assert.equal(provider.memberships.get("partial@example.test").has("segment-1"), true);
  assert.equal(provider.topicStates.get("partial@example.test").get("topic-1"), "opt_in");
  assert.equal(provider.emails.length, 2, "welcome was accepted before final proof failed");

  // Simulate expiry of Resend's bounded idempotency retention before replay.
  // The repair must not issue a second welcome even without provider dedupe.
  provider.expireEmailIdempotency();
  const retried = await manager.confirm(token);
  assert.equal(retried.state, "subscribed");
  assert.ok(Number(contact.properties[CONFIRMED_AT_KEY]) > 0);
  assert.equal(
    provider.emails.length,
    2,
    "replay must never resend an accepted welcome even after Resend dedupe expiry"
  );

  const replay = await manager.confirm(token);
  assert.equal(replay.state, "already_subscribed");
  assert.equal(provider.emails.length, 2);
});

test("newsletter R3 retries provider 5xx and succeeds", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider);

  await manager.requestOptIn({
    email: "retry@example.test",
    name: "Retry Test",
    source: "newsletter_page",
  });
  const token = extractToken(provider.emails[0], "confirm");

  provider.behavior.contactGet503Remaining = 2;
  const result = await manager.confirm(token);

  assert.equal(result.state, "subscribed");
  assert.ok(provider.stats.contactGetAttempts >= 3);
  assert.equal(provider.emails.length, 2);
});

test("newsletter R3 retries provider timeout and succeeds", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider, { providerTimeoutMs: 25 });

  await manager.requestOptIn({
    email: "timeout@example.test",
    name: "Timeout Test",
    source: "newsletter_page",
  });
  const token = extractToken(provider.emails[0], "confirm");

  provider.behavior.contactGetDelayMs = 80;
  const result = await manager.confirm(token);

  assert.equal(result.state, "subscribed");
  assert.ok(provider.stats.contactGetAttempts >= 2);
  assert.equal(provider.emails.length, 2);
});

function nestedContactRequests(provider) {
  return provider.requests.filter((request) =>
    /^\/contacts\/[^/]+\/(segments|topics)/.test(request.path)
  );
}

function assertNestedRoutesUseContactId(
  provider,
  contactId,
  { injectedFailures = 0 } = {}
) {
  const nested = nestedContactRequests(provider);
  assert.ok(nested.length > 0, "expected nested contact route traffic");
  for (const request of nested) {
    assert.ok(
      request.path.startsWith("/contacts/" + contactId + "/"),
      request.method + " " + request.path + " must address the contact by id"
    );
  }
  assert.equal(
    nested.filter((request) => request.status === 422).length,
    injectedFailures,
    "only deliberately injected 422 responses are allowed"
  );
  for (const request of nested.filter((item) => item.path.endsWith("/topics"))) {
    if (request.method === "PATCH") {
      assert.ok(Array.isArray(request.body), "topics PATCH must send a bare array");
    }
  }
}

async function subscribeFixture(t, email) {
  const provider = await createProvider(t);
  const manager = createManager(provider);

  await manager.requestOptIn({ email, name: "Wire Contract", source: "newsletter_page" });
  const confirmed = await manager.confirm(extractToken(provider.emails[0], "confirm"));
  assert.equal(confirmed.state, "subscribed");

  return {
    provider,
    manager,
    contact: provider.contacts.get(email),
    unsubscribeToken: extractToken(provider.emails[1], "unsubscribe"),
    emailHash: consentEmailHash(email),
  };
}

test("unsubscribe addresses Resend by contact id with a bare topics array (production 422)", async (t) => {
  const email = "prod-422@example.test";
  const { provider, manager, contact, unsubscribeToken, emailHash } =
    await subscribeFixture(t, email);
  provider.requests.length = 0;

  const result = await manager.unsubscribe(unsubscribeToken);
  assert.equal(result.state, "unsubscribed");

  assertNestedRoutesUseContactId(provider, contact.id);
  const topicPatch = provider.requests.find(
    (request) => request.method === "PATCH" && request.path.endsWith("/topics")
  );
  assert.deepEqual(topicPatch.body, [{ id: "topic-1", subscription: "opt_out" }]);
  assert.equal(topicPatch.status, 200);
  const segmentDelete = provider.requests.find(
    (request) => request.method === "DELETE"
  );
  assert.equal(
    segmentDelete.path,
    "/contacts/" + contact.id + "/segments/segment-1"
  );
  assert.equal(segmentDelete.status, 200);

  assert.equal(provider.memberships.get(email).has("segment-1"), false);
  assert.equal(provider.topicStates.get(email).get("topic-1"), "opt_out");
  const ledger = await provider.consentStore.getContact(emailHash);
  assert.equal(ledger.current_state, "unsubscribed");
});

for (const failure of [
  {
    name: "topic opt-out",
    arm: (provider) => {
      provider.behavior.topicOptOut422Remaining = 1;
    },
    operation: "PATCH /contacts/{contact}/topics",
    topicAfterFailure: "opt_in",
    inSegmentAfterFailure: true,
  },
  {
    name: "segment removal",
    arm: (provider) => {
      provider.behavior.segmentDelete422Remaining = 1;
    },
    operation: "DELETE /contacts/{contact}/segments/{segment}",
    topicAfterFailure: "opt_out",
    inSegmentAfterFailure: true,
  },
]) {
  test(
    "unsubscribe fails closed on provider 422 during " +
      failure.name +
      " and the same token completes on retry",
    async (t) => {
      const email = "partial-" + failure.name.replace(/\W+/g, "-") + "@example.test";
      const { provider, manager, contact, unsubscribeToken, emailHash } =
        await subscribeFixture(t, email);
      failure.arm(provider);

      await assert.rejects(
        () => manager.unsubscribe(unsubscribeToken),
        (error) =>
          error?.code === "NEWSLETTER_PROVIDER_FAILED" &&
          error.providerStatus === 422 &&
          error.providerName === "validation_error" &&
          error.providerOperation === failure.operation
      );

      // Partial provider state: the audit timestamp landed, marketing did not
      // fully stop, and no durable "unsubscribed" evidence was committed.
      assert.ok(Number(contact.properties[UNSUBSCRIBED_AT_KEY]) > 0);
      assert.equal(
        provider.topicStates.get(email).get("topic-1"),
        failure.topicAfterFailure
      );
      assert.equal(
        provider.memberships.get(email).has("segment-1"),
        failure.inSegmentAfterFailure
      );
      let ledger = await provider.consentStore.getContact(emailHash);
      assert.equal(ledger.current_state, "subscribed");
      let events = await provider.consentStore.listConsentEvents(emailHash);
      assert.equal(events.filter((event) => event.event_type === "unsubscribe").length, 0);

      const retried = await manager.unsubscribe(unsubscribeToken);
      assert.equal(retried.state, "unsubscribed");
      assert.equal(provider.topicStates.get(email).get("topic-1"), "opt_out");
      assert.equal(provider.memberships.get(email).has("segment-1"), false);
      ledger = await provider.consentStore.getContact(emailHash);
      assert.equal(ledger.current_state, "unsubscribed");

      const replayed = await manager.unsubscribe(unsubscribeToken);
      assert.equal(replayed.state, "unsubscribed");
      events = await provider.consentStore.listConsentEvents(emailHash);
      assert.equal(
        events.filter((event) => event.event_type === "unsubscribe").length,
        1,
        "retrying the same token must stay idempotent"
      );
      assertNestedRoutesUseContactId(provider, contact.id, { injectedFailures: 1 });
    }
  );
}

test("re-activation of an existing provider contact addresses nested routes by contact id", async (t) => {
  // Ensure new DOI is strictly later than the provider suppression lifecycle.
  t.mock.timers.enable({ apis: ["Date"], now: 1_800_000_000_000 });
  const email = "reactivate@example.test";
  const { provider, manager, contact } = await subscribeFixture(t, email);

  provider.hostedUnsubscribe(email);
  await assert.rejects(
    () => manager.confirm(extractToken(provider.emails[0], "confirm")),
    (error) => error?.code === "NEWSLETTER_CONFIRMATION_STALE"
  );
  t.mock.timers.tick(1);
  provider.requests.length = 0;
  await manager.requestOptIn({ email, name: "Wire Contract", source: "newsletter_page" });
  const resubscribed = await manager.confirm(
    extractToken(provider.emails.at(-1), "confirm")
  );

  assert.equal(resubscribed.state, "resubscribed");
  assert.equal(provider.memberships.get(email).has("segment-1"), true);
  assert.equal(provider.topicStates.get(email).get("topic-1"), "opt_in");
  assertNestedRoutesUseContactId(provider, contact.id);
  assert.ok(
    nestedContactRequests(provider).some(
      (request) => request.method === "POST" && request.path.includes("/segments/")
    ),
    "segment re-add must run through the id-addressed route"
  );
  assert.ok(
    nestedContactRequests(provider).some(
      (request) =>
        request.method === "PATCH" &&
        request.path.endsWith("/topics") &&
        request.body?.[0]?.subscription === "opt_in"
    ),
    "topic opt-in must run through the id-addressed route"
  );
});

test("provider-off recovery obligation addresses nested routes by contact id", async (t) => {
  const email = "recover-by-id@example.test";
  const { provider, manager, contact, emailHash } = await subscribeFixture(t, email);

  const current = await provider.consentStore.getContact(emailHash);
  await provider.consentStore.upsertContact({
    emailHash,
    providerContactId: contact.id,
    currentState: "unsubscribed",
    unsubscribedAt: new Date(Date.now() + 5),
    providerBlockedAt: new Date(),
    expectedStateVersion: current.state_version,
  });
  provider.requests.length = 0;

  await manager.requestOptIn({ email, name: "Wire Contract", source: "newsletter_page" });

  const ledger = await provider.consentStore.getContact(emailHash);
  assert.equal(ledger.provider_blocked_at, null);
  assert.equal(provider.memberships.get(email).has("segment-1"), false);
  assert.equal(provider.topicStates.get(email).get("topic-1"), "opt_out");
  assertNestedRoutesUseContactId(provider, contact.id);
});

test("provider-on recovery for a newer subscription addresses nested routes by contact id", async (t) => {
  const email = "keep-on-by-id@example.test";
  const { provider, manager, contact, emailHash } = await subscribeFixture(t, email);

  provider.hostedUnsubscribe(email);
  const current = await provider.consentStore.getContact(emailHash);
  await provider.consentStore.upsertContact({
    emailHash,
    providerContactId: contact.id,
    currentState: "subscribed",
    providerBlockedAt: new Date(),
    expectedStateVersion: current.state_version,
  });
  provider.requests.length = 0;

  await manager.requestOptIn({ email, name: "Wire Contract", source: "newsletter_page" });

  const ledger = await provider.consentStore.getContact(emailHash);
  assert.equal(ledger.provider_blocked_at, null);
  assert.equal(provider.memberships.get(email).has("segment-1"), true);
  assert.equal(provider.topicStates.get(email).get("topic-1"), "opt_in");
  assertNestedRoutesUseContactId(provider, contact.id);
});

test("B1 pending requests across managers send only one DOI", async (t) => {
  const provider = await createProvider(t);
  const first = createManager(provider);
  const email = "b1-pending@example.test";
  await first.requestOptIn({ email });
  for (let n = 0; n < 10; n++) await createManager(provider).requestOptIn({ email });
  assert.equal(provider.emails.length, 1);
  assert.equal((await provider.consentStore.listConsentEvents(consentEmailHash(email))).length, 1);
});

test("B1 active repeated requests never send DOI or change consent", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider);
  const email = "b1-active@example.test";
  await manager.requestOptIn({ email });
  await manager.confirm(extractToken(provider.emails[0], "confirm"));
  const before = await provider.consentStore.listConsentEvents(consentEmailHash(email));
  for (let n = 0; n < 10; n++) await createManager(provider).requestOptIn({ email });
  assert.equal(provider.emails.length, 2);
  assert.deepEqual(await provider.consentStore.listConsentEvents(consentEmailHash(email)), before);
});

test("B1 concurrent managers reserve only one send", async (t) => {
  const provider = await createProvider(t);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () =>
    createManager(provider).requestOptIn({ email: "b1-race@example.test" })));
  assert.ok(results.every(result => result.status === "fulfilled"), "ordinary concurrent requests must have the same neutral public outcome");
  assert.equal(provider.emails.length, 1);
});

test("B1 suppression blocks signup without altering provider or consent", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider);
  provider.suppressions.set("b1-suppressed@example.test", true);
  assert.deepEqual(await manager.requestOptIn({ email: "b1-suppressed@example.test" }), { state: "request_received" });
  assert.equal(provider.emails.length, 0);
  assert.equal(provider.stats.contactMutations, 0);
  assert.equal(await provider.consentStore.getContact(consentEmailHash("b1-suppressed@example.test")), null);
});

for (const disable of ['global', 'topic', 'segment']) {
  test(`B1 ${disable} withdrawal requires fresh DOI and never reactivates on request`, async (t) => {
    const provider = await createProvider(t), manager = createManager(provider);
    const email = 'b1-' + disable + '@example.test';
    await manager.requestOptIn({email});
    const original = extractToken(provider.emails[0], 'confirm');
    await manager.confirm(original);
    if (disable === 'global') provider.contacts.get(email).unsubscribed = true;
    if (disable === 'topic') provider.topicStates.get(email).set('topic-1', 'opt_out');
    if (disable === 'segment') provider.memberships.get(email).clear();
    const mutations = provider.stats.contactMutations;
    await manager.requestOptIn({email});
    await manager.requestOptIn({email});
    assert.equal(provider.emails.length,3);
    assert.equal(provider.stats.contactMutations, mutations);
    await assert.rejects(() => manager.confirm(original), {code:'NEWSLETTER_CONFIRMATION_STALE'});
    await manager.confirm(extractToken(provider.emails[2], 'confirm'));
    assert.equal(provider.emails.length,4);
  });
}

test("B1 legacy active provider with no ledger gets no fabricated consent or DOI", async (t) => {
  const provider = await createProvider(t), manager = createManager(provider);
  const email = 'b1-legacy@example.test';
  await manager.requestOptIn({email});
  await manager.confirm(extractToken(provider.emails[0], 'confirm'));
  const freshStore = createMemoryNewsletterConsentStore();
  await createManager(provider, {consentStore:freshStore}).requestOptIn({email});
  assert.equal(provider.emails.length,2);
  assert.equal(await freshStore.getContact(consentEmailHash(email)), null);
});

test("B1 provider failure before reservation sends nothing and can safely retry", async (t) => {
  const provider = await createProvider(t), manager = createManager(provider);
  provider.behavior.contactGet503Remaining = 4;
  await assert.rejects(() => manager.requestOptIn({email:'b1-unavailable@example.test'}), {code:'NEWSLETTER_PROVIDER_FAILED'});
  assert.equal(provider.emails.length,0);
  await manager.requestOptIn({email:'b1-unavailable@example.test'});
  assert.equal(provider.emails.length,1);
});

for (const failure of [429, 503, 'disconnect', 'timeout']) {
  test(`B1 uncertain send ${failure} makes one attempt and blocks restart resend`, async (t) => {
    const provider = await createProvider(t), manager = createManager(provider, {providerTimeoutMs:50});
    const email = 'b1-failure@example.test';
    provider.behavior.confirmResponse = failure;
    await assert.rejects(() => manager.requestOptIn({email}), {code:'NEWSLETTER_MAIL_FAILED'});
    assert.equal(provider.emails.length,1, 'provider accepted only one idempotent message');
    const attempts = provider.requests.filter(r => r.path === '/emails').length;
    assert.equal(attempts,1,'R2 forbids automatic retries after an ambiguous send');
    provider.behavior.confirmResponse = null;
    await assert.rejects(() => createManager(provider).requestOptIn({email}), {code:'NEWSLETTER_REQUEST_UNCERTAIN'});
    assert.equal(provider.requests.filter(r => r.path === '/emails').length,attempts);
    assert.equal((await provider.consentStore.listConsentEvents(consentEmailHash(email))).length,1);
  });
}

test("B1 suppression lookup failure fails closed without exposing address", async (t) => {
  const provider = await createProvider(t), manager = createManager(provider);
  provider.behavior.suppressionError = 403;
  await assert.rejects(() => manager.requestOptIn({email:'b1-denied@example.test'}), error => {
    assert.equal(error.providerOperation,'GET /suppressions/{recipient}');
    assert.ok(!JSON.stringify(error).includes('b1-denied'));
    return error.code === 'NEWSLETTER_PROVIDER_FAILED';
  });
  assert.equal(provider.emails.length,0);
});

test("B1 malformed send acknowledgement cannot be marked sent", async (t) => {
  const provider = await createProvider(t), manager = createManager(provider);
  const email = 'b1-malformed@example.test';
  provider.behavior.confirmResponse = 'malformed';
  await assert.rejects(() => manager.requestOptIn({email}), {code:'NEWSLETTER_REQUEST_UNCERTAIN'});
  provider.behavior.confirmResponse = null;
  await assert.rejects(() => createManager(provider).requestOptIn({email}), {code:'NEWSLETTER_REQUEST_UNCERTAIN'});
  assert.equal(provider.emails.length,1);
});

test("B1 malformed 200 contact is unknown, never a new mailbox", async (t) => {
  const provider = await createProvider(t), manager = createManager(provider);
  for (const body of [null, false, 0, '', {}, {id:'contact-1',email:'other@example.test',unsubscribed:false}]) {
    provider.behavior.contactPayload = body;
    await assert.rejects(() => manager.requestOptIn({email:'b1-invalid@example.test'}), {code:'NEWSLETTER_PROVIDER_INVALID'});
  }
  assert.equal(provider.emails.length,0);
  assert.equal(await provider.consentStore.getContact(consentEmailHash('b1-invalid@example.test')),null);
  delete provider.behavior.contactPayload;
  await manager.requestOptIn({email:'b1-invalid@example.test'});
  assert.equal(provider.emails.length,1, 'malformed response did not leave a reservation');
});

test("B1 malformed named resource cannot imply inactive subscription", async (t) => {
  const provider = await createProvider(t), manager = createManager(provider);
  const email = 'b1-resource@example.test';
  await manager.requestOptIn({email});
  await manager.confirm(extractToken(provider.emails[0],'confirm'));
  provider.behavior.invalidResource = true;
  await assert.rejects(() => manager.requestOptIn({email}), {code:'NEWSLETTER_PROVIDER_INVALID'});
  assert.equal(provider.emails.length,2);
});

for (const mode of ['second','repeat']) {
  test(`B1 resource pagination ${mode} never sends a duplicate for active contact`, async (t) => {
    const provider = await createProvider(t), manager = createManager(provider);
    const email = 'b1-pagination@example.test';
    await manager.requestOptIn({email});
    await manager.confirm(extractToken(provider.emails[0],'confirm'));
    provider.behavior.segmentPages = mode;
    if (mode === 'second') assert.deepEqual(await manager.requestOptIn({email}),{state:'request_received'});
    else await assert.rejects(() => manager.requestOptIn({email}),{code:'NEWSLETTER_PROVIDER_INVALID'});
    assert.equal(provider.emails.length,2);
  });
}

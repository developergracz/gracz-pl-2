import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import net from "node:net";
import { createNewsletterManager } from "../newsletter.mjs";

const CONFIRMED_AT_KEY = "gracz_newsletter_confirmed_at";
const UNSUBSCRIBED_AT_KEY = "gracz_newsletter_unsubscribed_at";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function nestedProperties(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      {
        value,
        type:
          typeof value === "number"
            ? "number"
            : typeof value === "boolean"
              ? "boolean"
              : "string",
      },
    ])
  );
}

function extractToken(email, kind) {
  const pattern =
    kind === "confirm"
      ? /https:\/\/gracz\.pl\/newsletter\/#confirm=([A-Za-z0-9._-]+)/
      : /https:\/\/gracz\.pl\/newsletter\/#unsubscribe=([A-Za-z0-9._-]+)/;
  const match = String(email?.body?.html || "").match(pattern);
  assert.ok(match, "expected " + kind + " token");
  return match[1];
}

async function createProvider(t) {
  const port = await getFreePort();
  const emails = [];
  const emailIdempotency = new Map();
  const contacts = new Map();
  const segments = [];
  const topics = [];
  const contactProperties = [];
  const memberships = new Map();
  const topicStates = new Map();

  const behavior = {
    contactGet429Remaining: 0,
    contactGet503Remaining: 0,
    contactGetDelayMs: 0,
    failFinalConfirmPatchStatus: 0,
  };

  const stats = {
    contactGetAttempts: 0,
    contactMutations: 0,
  };

  function providerContact(contact) {
    if (!contact) return null;
    return {
      ...contact,
      properties: nestedProperties(contact.properties),
    };
  }

  function hostedUnsubscribe(email) {
    const contact = contacts.get(email);
    assert.ok(contact, "hosted unsubscribe requires contact");
    contact.unsubscribed = true;
    memberships.get(email)?.clear();
    const states = topicStates.get(email) || new Map();
    topicStates.set(email, states);
    for (const topic of topics) states.set(topic.id, "opt_out");
  }

  const provider = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const method = req.method || "GET";

    if (url.pathname === "/emails" && method === "POST") {
      const body = await readBody(req);
      const key = String(req.headers["idempotency-key"] || "");
      const serialized = JSON.stringify(body);
      const existing = emailIdempotency.get(key);
      if (existing) {
        if (existing.serialized !== serialized) {
          return send(res, 409, {
            name: "invalid_idempotent_request",
            message: "same key with different payload",
          });
        }
        return send(res, 200, { id: existing.id });
      }

      const id = "email-" + String(emails.length + 1);
      emails.push({ body, headers: req.headers, id });
      emailIdempotency.set(key, { serialized, id });
      return send(res, 200, { id });
    }

    if (url.pathname === "/segments" && method === "GET") {
      return send(res, 200, { object: "list", has_more: false, data: segments });
    }
    if (url.pathname === "/segments" && method === "POST") {
      const body = await readBody(req);
      const entry = { id: "segment-1", name: body.name };
      segments.push(entry);
      return send(res, 201, { object: "segment", id: entry.id });
    }

    if (url.pathname === "/topics" && method === "GET") {
      return send(res, 200, { object: "list", has_more: false, data: topics });
    }
    if (url.pathname === "/topics" && method === "POST") {
      const body = await readBody(req);
      const entry = {
        id: "topic-1",
        name: body.name,
        description: body.description || "",
        default_subscription: body.default_subscription,
        visibility: body.visibility,
      };
      topics.push(entry);
      return send(res, 201, { object: "topic", id: entry.id });
    }

    if (url.pathname === "/contact-properties" && method === "GET") {
      return send(res, 200, {
        object: "list",
        has_more: false,
        data: contactProperties,
      });
    }
    if (url.pathname === "/contact-properties" && method === "POST") {
      const body = await readBody(req);
      const existing = contactProperties.find((item) => item.key === body.key);
      if (existing) return send(res, 409, { name: "already_exists" });
      const entry = {
        id: "property-" + String(contactProperties.length + 1),
        key: body.key,
        type: body.type,
        fallback_value: body.fallback_value,
      };
      contactProperties.push(entry);
      return send(res, 201, { object: "contact_property", id: entry.id });
    }

    if (url.pathname === "/contacts" && method === "POST") {
      stats.contactMutations += 1;
      const body = await readBody(req);
      const contact = {
        object: "contact",
        id: "contact-" + String(contacts.size + 1),
        email: body.email,
        first_name: body.first_name || null,
        last_name: body.last_name || null,
        unsubscribed: body.unsubscribed === true,
        properties: { ...(body.properties || {}) },
      };
      contacts.set(body.email, contact);
      memberships.set(body.email, new Set((body.segments || []).map((item) => item.id)));
      topicStates.set(
        body.email,
        new Map((body.topics || []).map((item) => [item.id, item.subscription]))
      );
      return send(res, 201, { object: "contact", id: contact.id });
    }

    const segmentsListMatch = url.pathname.match(/^\/contacts\/([^/]+)\/segments$/);
    if (segmentsListMatch && method === "GET") {
      const email = decodeURIComponent(segmentsListMatch[1]);
      const ids = memberships.get(email) || new Set();
      return send(res, 200, {
        object: "list",
        has_more: false,
        data: segments.filter((segment) => ids.has(segment.id)),
      });
    }

    const segmentMatch = url.pathname.match(
      /^\/contacts\/([^/]+)\/segments\/([^/]+)$/
    );
    if (segmentMatch) {
      const email = decodeURIComponent(segmentMatch[1]);
      const segmentId = decodeURIComponent(segmentMatch[2]);
      const set = memberships.get(email) || new Set();
      memberships.set(email, set);
      if (method === "POST") {
        stats.contactMutations += 1;
        set.add(segmentId);
        return send(res, 201, {
          object: "contact_segment",
          contact_id: contacts.get(email)?.id || "contact-1",
          segment_id: segmentId,
        });
      }
      if (method === "DELETE") {
        stats.contactMutations += 1;
        set.delete(segmentId);
        return send(res, 200, {
          object: "contact_segment",
          contact_id: contacts.get(email)?.id || "contact-1",
          segment_id: segmentId,
          deleted: true,
        });
      }
    }

    const topicMatch = url.pathname.match(/^\/contacts\/([^/]+)\/topics$/);
    if (topicMatch && method === "GET") {
      const email = decodeURIComponent(topicMatch[1]);
      const states = topicStates.get(email) || new Map();
      return send(res, 200, {
        object: "list",
        has_more: false,
        data: topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          description: topic.description || "",
          subscription: states.get(topic.id) || "opt_out",
        })),
      });
    }
    if (topicMatch && method === "PATCH") {
      stats.contactMutations += 1;
      const email = decodeURIComponent(topicMatch[1]);
      const body = await readBody(req);
      const states = topicStates.get(email) || new Map();
      topicStates.set(email, states);
      for (const item of body.topics || []) {
        states.set(item.id, item.subscription);
      }
      return send(res, 200, {
        object: "contact_topics",
        contact_id: contacts.get(email)?.id || "contact-1",
        topics: body.topics || [],
      });
    }

    const contactMatch = url.pathname.match(/^\/contacts\/([^/]+)$/);
    if (contactMatch && method === "GET") {
      stats.contactGetAttempts += 1;

      if (behavior.contactGet429Remaining > 0) {
        behavior.contactGet429Remaining -= 1;
        return send(
          res,
          429,
          { name: "rate_limit_exceeded", message: "Too many requests." },
          { "retry-after": "0.01" }
        );
      }

      if (behavior.contactGet503Remaining > 0) {
        behavior.contactGet503Remaining -= 1;
        return send(res, 503, {
          name: "provider_unavailable",
          message: "Temporary provider failure.",
        });
      }

      if (behavior.contactGetDelayMs > 0) {
        const delay = behavior.contactGetDelayMs;
        behavior.contactGetDelayMs = 0;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const email = decodeURIComponent(contactMatch[1]);
      const contact = contacts.get(email);
      return contact
        ? send(res, 200, providerContact(contact))
        : send(res, 404, { name: "not_found", message: "not found" });
    }

    if (contactMatch && method === "PATCH") {
      stats.contactMutations += 1;
      const email = decodeURIComponent(contactMatch[1]);
      const current = contacts.get(email);
      if (!current) return send(res, 404, { name: "not_found" });
      const body = await readBody(req);

      if (
        behavior.failFinalConfirmPatchStatus &&
        body?.properties &&
        Object.prototype.hasOwnProperty.call(body.properties, CONFIRMED_AT_KEY)
      ) {
        const status = behavior.failFinalConfirmPatchStatus;
        behavior.failFinalConfirmPatchStatus = 0;
        return send(res, status, {
          name: "forced_final_commit_failure",
          message: "forced test failure",
        });
      }

      const nextProperties = body.properties
        ? { ...(current.properties || {}), ...body.properties }
        : current.properties;
      Object.assign(current, body, { properties: nextProperties });
      return send(res, 200, { object: "contact", id: current.id });
    }

    return send(res, 404, {
      name: "unhandled",
      path: url.pathname,
      method,
    });
  });

  provider.listen(port, "127.0.0.1");
  await once(provider, "listening");
  t.after(() => new Promise((resolve) => provider.close(resolve)));

  return {
    base: "http://127.0.0.1:" + port,
    emails,
    contacts,
    segments,
    topics,
    contactProperties,
    memberships,
    topicStates,
    behavior,
    stats,
    providerContact,
    hostedUnsubscribe,
  };
}

function createManager(provider, options = {}) {
  return createNewsletterManager({
    secret: "test-" + "n".repeat(40),
    resendApiKey: "test-key",
    resendApiBase: provider.base,
    emailEndpoint: provider.base + "/emails",
    emailFrom: "gracz.pl <kontakt@gracz.pl>",
    replyTo: "admin@gracz.pl",
    baseUrl: "https://gracz.pl/newsletter/",
    ...options,
  });
}

test("newsletter R3 lifecycle uses documented nested properties and safe state transitions", async (t) => {
  const provider = await createProvider(t);
  const manager = createManager(provider);

  const requested = await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "contact_form",
  });

  assert.equal(requested.state, "confirmation_sent");
  assert.equal(provider.contacts.size, 0, "contact must not exist before double opt-in");
  assert.equal(provider.emails.length, 1);
  assert.match(provider.emails[0].body.subject, /gracz\.pl Newsletter — potwierdź zapis/);
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

  const documented = provider.providerContact(contact);
  assert.equal(
    documented.properties[CONFIRMED_AT_KEY].value,
    contact.properties[CONFIRMED_AT_KEY]
  );
  assert.equal(documented.properties[CONFIRMED_AT_KEY].type, "number");

  assert.equal(provider.emails.length, 2);
  assert.match(provider.emails[1].body.subject, /gracz\.pl Newsletter — witamy!/);
  assert.match(provider.emails[1].body.html, /FULL MAX PREMIUM/);
  const firstUnsubscribeToken = extractToken(provider.emails[1], "unsubscribe");

  const mutationsBeforeReplay = provider.stats.contactMutations;
  const repeated = await manager.confirm(firstConfirmToken);
  assert.equal(repeated.state, "already_subscribed");
  assert.equal(provider.stats.contactMutations, mutationsBeforeReplay);
  assert.equal(provider.emails.length, 2);

  await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "newsletter_page",
  });
  assert.equal(provider.emails.length, 3);
  const secondConfirmToken = extractToken(provider.emails[2], "confirm");

  const mutationsBeforeActiveConfirm = provider.stats.contactMutations;
  const activeAgain = await manager.confirm(secondConfirmToken);
  assert.equal(activeAgain.state, "already_subscribed");
  assert.equal(provider.stats.contactMutations, mutationsBeforeActiveConfirm);
  assert.equal(provider.emails.length, 3, "active subscriber gets no duplicate welcome");

  const unsubscribed = await manager.unsubscribe(firstUnsubscribeToken);
  assert.equal(unsubscribed.state, "unsubscribed");
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), false);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_out");
  assert.ok(Number(contact.properties[UNSUBSCRIBED_AT_KEY]) > 0);

  await assert.rejects(
    () => manager.confirm(secondConfirmToken),
    (error) => error?.code === "NEWSLETTER_CONFIRMATION_STALE"
  );

  await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "newsletter_page",
  });
  const thirdConfirmToken = extractToken(provider.emails[3], "confirm");
  const resubscribed = await manager.confirm(thirdConfirmToken);
  assert.equal(resubscribed.state, "resubscribed");
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), true);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_in");
  assert.equal(contact.unsubscribed, false);
  assert.equal(provider.emails.length, 5);
  const thirdUnsubscribeToken = extractToken(provider.emails[4], "unsubscribe");

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
  const fourthConfirmToken = extractToken(provider.emails[5], "confirm");
  const hostedResubscribe = await manager.confirm(fourthConfirmToken);
  assert.equal(hostedResubscribe.state, "resubscribed");
  assert.ok(Number(contact.properties[CONFIRMED_AT_KEY]) > confirmedAtAfterResubscribe);
  assert.equal(contact.unsubscribed, false);
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), true);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_in");
  assert.equal(provider.emails.length, 7);

  const fourthUnsubscribeToken = extractToken(provider.emails[6], "unsubscribe");
  const firstOff = await manager.unsubscribe(fourthUnsubscribeToken);
  const secondOff = await manager.unsubscribe(fourthUnsubscribeToken);
  assert.equal(firstOff.state, "unsubscribed");
  assert.equal(secondOff.state, "unsubscribed");
  assert.equal(provider.memberships.get("jan@example.test").has("segment-1"), false);
  assert.equal(provider.topicStates.get("jan@example.test").get("topic-1"), "opt_out");

  assert.ok(thirdUnsubscribeToken.startsWith("n1."));
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

  const retried = await manager.confirm(token);
  assert.equal(retried.state, "subscribed");
  assert.ok(Number(contact.properties[CONFIRMED_AT_KEY]) > 0);
  assert.equal(
    provider.emails.length,
    2,
    "same deterministic welcome payload must reuse Resend idempotency result"
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

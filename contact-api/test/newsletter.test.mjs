import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import net from "node:net";
import { createNewsletterManager } from "../newsletter.mjs";

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

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

test("newsletter FULL MAX PREMIUM double opt-in lifecycle", async (t) => {
  const port = await getFreePort();
  const emails = [];
  const contacts = new Map();
  const segments = [];
  const topics = [];
  const contactProperties = [];
  const memberships = new Map();
  const topicStates = new Map();
  let contactGetAttempts = 0;

  const provider = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const method = req.method || "GET";

    if (url.pathname === "/emails" && method === "POST") {
      const body = await readBody(req);
      emails.push({ body, headers: req.headers });
      return send(res, 200, { id: "email-" + emails.length });
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
      if (existing) return send(res, 409, { message: "already exists" });
      const entry = {
        id: "property-" + String(contactProperties.length + 1),
        key: body.key,
        type: body.type,
        fallback_value: body.fallback_value,
      };
      contactProperties.push(entry);
      return send(res, 201, { object: "contact_property", id: entry.id });
    }

    const contactMatch = url.pathname.match(/^\/contacts\/([^/]+)$/);
    if (contactMatch && method === "GET") {
      contactGetAttempts += 1;
      if (contactGetAttempts === 1) {
        res.writeHead(429, {
          "content-type": "application/json",
          "retry-after": "0.01",
        });
        return res.end(
          JSON.stringify({
            name: "rate_limit_exceeded",
            message: "Too many requests.",
            statusCode: 429,
          })
        );
      }
      const email = decodeURIComponent(contactMatch[1]);
      const contact = contacts.get(email);
      return contact
        ? send(res, 200, contact)
        : send(res, 404, { message: "not found" });
    }

    if (url.pathname === "/contacts" && method === "POST") {
      const body = await readBody(req);
      const contact = {
        object: "contact",
        id: "contact-1",
        email: body.email,
        first_name: body.first_name || null,
        last_name: body.last_name || null,
        unsubscribed: body.unsubscribed === true,
        properties: { ...(body.properties || {}) },
      };
      contacts.set(body.email, contact);
      memberships.set(body.email, new Set((body.segments || []).map((x) => x.id)));
      topicStates.set(
        body.email,
        new Map((body.topics || []).map((x) => [x.id, x.subscription]))
      );
      return send(res, 201, { object: "contact", id: contact.id });
    }

    if (contactMatch && method === "PATCH") {
      const email = decodeURIComponent(contactMatch[1]);
      const current = contacts.get(email);
      if (!current) return send(res, 404, { message: "not found" });
      const body = await readBody(req);
      const nextProperties = body.properties
        ? { ...(current.properties || {}), ...body.properties }
        : current.properties;
      Object.assign(current, body, { properties: nextProperties });
      return send(res, 200, { object: "contact", id: current.id });
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
        set.add(segmentId);
        return send(res, 201, { object: "contact_segment", id: segmentId });
      }
      if (method === "DELETE") {
        set.delete(segmentId);
        return send(res, 200, { object: "contact_segment", id: segmentId });
      }
    }

    const topicMatch = url.pathname.match(/^\/contacts\/([^/]+)\/topics$/);
    if (topicMatch && method === "PATCH") {
      const email = decodeURIComponent(topicMatch[1]);
      const body = await readBody(req);
      const states = topicStates.get(email) || new Map();
      topicStates.set(email, states);
      for (const item of body.topics || []) states.set(item.id, item.subscription);
      return send(res, 200, {
        object: "contact_topics",
        contact_id: contacts.get(email)?.id || "contact-1",
        topics: body.topics,
      });
    }

    return send(res, 404, { message: "unhandled", path: url.pathname, method });
  });

  provider.listen(port, "127.0.0.1");
  await once(provider, "listening");
  t.after(() => new Promise((resolve) => provider.close(resolve)));

  const manager = createNewsletterManager({
    secret: "test-" + "n".repeat(40),
    resendApiKey: "test-key",
    resendApiBase: "http://127.0.0.1:" + port,
    emailEndpoint: "http://127.0.0.1:" + port + "/emails",
    emailFrom: "gracz.pl <kontakt@gracz.pl>",
    replyTo: "admin@gracz.pl",
    baseUrl: "https://gracz.pl/newsletter/",
  });

  assert.equal(manager.enabled, true);

  const requested = await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "contact_form",
  });

  assert.equal(requested.state, "confirmation_sent");
  assert.equal(contacts.size, 0, "contact must not exist before double opt-in");
  assert.equal(emails.length, 1);
  assert.match(emails[0].body.subject, /gracz\.pl Newsletter — potwierdź zapis/);
  assert.match(emails[0].body.html, /FULL MAX PREMIUM/);
  assert.match(emails[0].body.html, /DOUBLE OPT-IN/);
  assert.match(emails[0].body.html, /Potwierdź swój zapis/);
  assert.match(emails[0].body.html, /Nowe gry/);
  assert.match(emails[0].body.html, /Poradniki/);
  assert.match(emails[0].body.html, /Rozwój serwisu/);
  assert.match(
    emails[0].body.headers["X-Entity-Ref-ID"],
    /^gracz-newsletter-confirm-[a-f0-9]{40}$/
  );
  assert.equal(emails[0].body.html.includes("jan@example.test"), false);

  const confirmMatch = emails[0].body.html.match(
    /https:\/\/gracz\.pl\/newsletter\/#confirm=([A-Za-z0-9._-]+)/
  );
  assert.ok(confirmMatch);
  const confirmToken = confirmMatch[1];
  assert.ok(confirmToken.startsWith("n1."));
  assert.equal(confirmToken.includes("jan@example.test"), false);

  const tampered =
    confirmToken.slice(0, -1) +
    (confirmToken.endsWith("A") ? "B" : "A");
  await assert.rejects(
    () => manager.confirm(tampered),
    (error) => error?.code === "INVALID_NEWSLETTER_TOKEN"
  );
  assert.equal(contacts.size, 0);

  const confirmed = await manager.confirm(confirmToken);
  assert.equal(confirmed.state, "subscribed");
  assert.ok(contactGetAttempts >= 2, "429 response must be retried automatically");
  assert.equal(segments.length, 1);
  assert.equal(segments[0].name, "gracz.pl Newsletter");
  assert.equal(topics.length, 1);
  assert.equal(topics[0].name, "Newsletter gracz.pl");
  assert.equal(topics[0].default_subscription, "opt_out");
  assert.equal(topics[0].visibility, "public");
  assert.equal(contactProperties.length, 3);
  assert.deepEqual(
    new Set(contactProperties.map((item) => item.key)),
    new Set([
      "gracz_newsletter_confirmed_at",
      "gracz_newsletter_unsubscribed_at",
      "gracz_newsletter_consent_version",
    ])
  );

  const contact = contacts.get("jan@example.test");
  assert.ok(contact);
  assert.equal(contact.unsubscribed, false);
  assert.equal(contact.first_name, "Jan");
  assert.equal(contact.last_name, "Kowalski");
  assert.ok(Number(contact.properties.gracz_newsletter_confirmed_at) > 0);
  assert.equal(
    contact.properties.gracz_newsletter_consent_version,
    "newsletter-r1-2026-10-07"
  );
  assert.equal(memberships.get("jan@example.test").has("segment-1"), true);
  assert.equal(topicStates.get("jan@example.test").get("topic-1"), "opt_in");

  assert.equal(emails.length, 2);
  assert.match(emails[1].body.subject, /gracz\.pl Newsletter — witamy!/);
  assert.match(emails[1].body.html, /FULL MAX PREMIUM/);
  assert.match(
    emails[1].body.headers["X-Entity-Ref-ID"],
    /^gracz-newsletter-welcome-[a-f0-9]{40}$/
  );

  const unsubscribeMatch = emails[1].body.html.match(
    /https:\/\/gracz\.pl\/newsletter\/#unsubscribe=([A-Za-z0-9._-]+)/
  );
  assert.ok(unsubscribeMatch);

  const repeated = await manager.confirm(confirmToken);
  assert.equal(repeated.state, "already_subscribed");
  assert.equal(contacts.size, 1);
  assert.equal(segments.length, 1);
  assert.equal(topics.length, 1);
  assert.equal(emails.length, 2);

  await manager.requestOptIn({
    email: "jan@example.test",
    name: "Jan Kowalski",
    source: "newsletter_page",
  });
  assert.equal(emails.length, 3);

  const secondConfirmMatch = emails[2].body.html.match(
    /https:\/\/gracz\.pl\/newsletter\/#confirm=([A-Za-z0-9._-]+)/
  );
  assert.ok(secondConfirmMatch);
  const secondConfirmToken = secondConfirmMatch[1];

  const activeAgain = await manager.confirm(secondConfirmToken);
  assert.equal(activeAgain.state, "already_subscribed");
  assert.equal(memberships.get("jan@example.test").has("segment-1"), true);
  assert.equal(topicStates.get("jan@example.test").get("topic-1"), "opt_in");
  assert.equal(emails.length, 3, "active subscriber must not receive another welcome email");

  const unsubscribed = await manager.unsubscribe(unsubscribeMatch[1]);
  assert.equal(unsubscribed.state, "unsubscribed");
  assert.equal(memberships.get("jan@example.test").has("segment-1"), false);
  assert.equal(topicStates.get("jan@example.test").get("topic-1"), "opt_out");
  assert.ok(Number(contact.properties.gracz_newsletter_unsubscribed_at) > 0);

  await assert.rejects(
    () => manager.confirm(secondConfirmToken),
    (error) => error?.code === "NEWSLETTER_CONFIRMATION_STALE"
  );
  assert.equal(memberships.get("jan@example.test").has("segment-1"), false);
  assert.equal(topicStates.get("jan@example.test").get("topic-1"), "opt_out");
  assert.equal(emails.length, 3);
});

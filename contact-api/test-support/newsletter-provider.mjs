import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import net from "node:net";
import { createHash, createHmac } from "node:crypto";
import { createNewsletterManager } from "../newsletter.mjs";
import { createMemoryNewsletterConsentStore } from "../persistence/memory-newsletter-consent-store.mjs";

const CONFIRMED_AT_KEY = "gracz_newsletter_confirmed_at";
const UNSUBSCRIBED_AT_KEY = "gracz_newsletter_unsubscribed_at";
const CONSENT_HASH_SECRET = "test-consent-" + "h".repeat(40);

export function consentEmailHash(email) {
  const key = createHash("sha256")
    .update("newsletter-consent-subject:", "utf8")
    .update(CONSENT_HASH_SECRET, "utf8")
    .digest();
  return createHmac("sha256", key)
    .update(String(email).trim(), "utf8")
    .digest("hex");
}

export function getFreePort() {
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

export function extractToken(email, kind) {
  const pattern =
    kind === "confirm"
      ? /https:\/\/gracz\.pl\/newsletter\/#confirm=([A-Za-z0-9._-]+)/
      : /https:\/\/gracz\.pl\/newsletter\/#unsubscribe=([A-Za-z0-9._-]+)/;
  const match = String(email?.body?.html || "").match(pattern);
  assert.ok(match, "expected " + kind + " token");
  return match[1];
}

export async function createProvider(t) {
  const port = await getFreePort();
  const emails = [];
  const emailIdempotency = new Map();
  const contacts = new Map();
  const segments = [];
  const topics = [];
  const contactProperties = [];
  const memberships = new Map();
  const topicStates = new Map();
  const suppressions = new Map();

  function resolveContactEmail(identifier) {
    const value = decodeURIComponent(String(identifier || ""));
    if (contacts.has(value)) return value;
    for (const [email, contact] of contacts.entries()) {
      if (contact?.id === value) return email;
    }
    return value;
  }

  // Nested contact routes (/contacts/{contact}/segments|topics) are served
  // for the durable contact id only. The first real unsubscribe failed with
  // 422 validation_error on PATCH /contacts/{contact}/topics, so the double
  // pins the id-addressed contract instead of tolerating e-mail identifiers.
  function resolveNestedContactEmail(res, identifier) {
    const value = decodeURIComponent(String(identifier || ""));
    for (const [email, contact] of contacts.entries()) {
      if (contact?.id === value) return email;
    }
    if (value.includes("@")) {
      send(res, 422, {
        name: "validation_error",
        message: "Nested contact routes require the contact id.",
      });
    } else {
      send(res, 404, { name: "not_found", message: "Contact not found." });
    }
    return null;
  }

  const behavior = {
    contactGet429Remaining: 0,
    contactGet503Remaining: 0,
    contactGetDelayMs: 0,
    failFinalConfirmPatchStatus: 0,
    welcomeEmail503Remaining: 0,
    topicOptOut503Remaining: 0,
    topicOptOut422Remaining: 0,
    segmentDelete503Remaining: 0,
    segmentDelete422Remaining: 0,
    beforeTopicOptOut: null,
  };

  const requests = [];

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
    function emailResponse(id) {
      if (behavior.confirmResponse === "timeout") return setTimeout(() => send(res,200,{id}),200);
      if (behavior.confirmResponse === "malformed") return send(res, 200, {});
      if (behavior.confirmResponse === "disconnect") return res.destroy();
      if (Number.isInteger(behavior.confirmResponse)) return send(res, behavior.confirmResponse, {name:"provider_unavailable"});
      return send(res, 200, {id});
    }
    const logged = { method, path: url.pathname, status: 0, body: undefined };
    requests.push(logged);
    res.on("finish", () => {
      logged.status = res.statusCode;
    });

    if (url.pathname.startsWith("/suppressions/") && method === "GET") {
      if (behavior.suppressionError) return send(res, behavior.suppressionError, {name:"provider_unavailable"});
      const email = decodeURIComponent(url.pathname.slice("/suppressions/".length));
      return suppressions.has(email)
        ? send(res, 200, { object: "suppression", id: "suppression-1", email, origin: "manual" })
        : send(res, 404, { name: "not_found" });
    }
    if (url.pathname === "/emails" && method === "POST") {
      const body = await readBody(req);
      if (
        /Newsletter — witamy!/i.test(String(body.subject || "")) &&
        behavior.welcomeEmail503Remaining > 0
      ) {
        behavior.welcomeEmail503Remaining -= 1;
        return send(res, 503, {
          name: "provider_unavailable",
          message: "forced welcome failure",
        });
      }
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
        return emailResponse(existing.id);
      }

      const id = "email-" + String(emails.length + 1);
      emails.push({ body, headers: req.headers, id });
      emailIdempotency.set(key, { serialized, id });
      return emailResponse(id);
    }

    if (url.pathname === "/segments" && method === "GET") {
      if (behavior.segmentPages === "repeat") return send(res,200,{data:[{id:"other",name:"Other"}],has_more:true});
      if (behavior.segmentPages === "second" && !url.searchParams.has("after")) return send(res,200,{data:[{id:"other",name:"Other"}],has_more:true});
      if (behavior.invalidResource) return send(res,200,{data:[{id:"segment-1"}],has_more:false});
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
      const email = resolveNestedContactEmail(res, segmentsListMatch[1]);
      if (!email) return;
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
      const email = resolveNestedContactEmail(res, segmentMatch[1]);
      if (!email) return;
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
        if (behavior.segmentDelete422Remaining > 0) {
          behavior.segmentDelete422Remaining -= 1;
          return send(res, 422, {
            name: "validation_error",
            message: "forced segment delete validation failure",
          });
        }
        if (behavior.segmentDelete503Remaining > 0) {
          behavior.segmentDelete503Remaining -= 1;
          return send(res, 503, {
            name: "provider_unavailable",
            message: "forced segment delete failure",
          });
        }
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
      const email = resolveNestedContactEmail(res, topicMatch[1]);
      if (!email) return;
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
      const email = resolveNestedContactEmail(res, topicMatch[1]);
      if (!email) return;
      const body = await readBody(req);
      logged.body = body;
      // The documented Resend cURL examples and official SDKs send the bare
      // array of topic updates, not a {topics: [...]} wrapper.
      const validUpdates =
        Array.isArray(body) &&
        body.length > 0 &&
        body.every(
          (item) =>
            typeof item?.id === "string" &&
            (item.subscription === "opt_in" || item.subscription === "opt_out")
        );
      if (!validUpdates) {
        return send(res, 422, {
          name: "validation_error",
          message: "Expected an array of topic subscription updates.",
        });
      }
      const isOptOut = body.some((item) => item.subscription === "opt_out");
      if (isOptOut && behavior.topicOptOut422Remaining > 0) {
        behavior.topicOptOut422Remaining -= 1;
        return send(res, 422, {
          name: "validation_error",
          message: "forced topic opt-out validation failure",
        });
      }
      if (isOptOut && behavior.topicOptOut503Remaining > 0) {
        behavior.topicOptOut503Remaining -= 1;
        return send(res, 503, {
          name: "provider_unavailable",
          message: "forced topic opt-out failure",
        });
      }
      if (isOptOut && typeof behavior.beforeTopicOptOut === "function") {
        const hook = behavior.beforeTopicOptOut;
        behavior.beforeTopicOptOut = null;
        await hook();
      }
      const states = topicStates.get(email) || new Map();
      topicStates.set(email, states);
      for (const item of body) {
        states.set(item.id, item.subscription);
      }
      return send(res, 200, {
        object: "contact_topics",
        contact_id: contacts.get(email)?.id || "contact-1",
        topics: body,
      });
    }

    const contactMatch = url.pathname.match(/^\/contacts\/([^/]+)$/);
    if (contactMatch && method === "GET") {
      if (Object.hasOwn(behavior,"contactPayload")) return send(res,200,behavior.contactPayload);
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

      const email = resolveContactEmail(contactMatch[1]);
      const contact = contacts.get(email);
      return contact
        ? send(res, 200, providerContact(contact))
        : send(res, 404, { name: "not_found", message: "not found" });
    }

    if (contactMatch && method === "PATCH") {
      stats.contactMutations += 1;
      const email = resolveContactEmail(contactMatch[1]);
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
    suppressions,
    behavior,
    stats,
    requests,
    providerContact,
    hostedUnsubscribe,
  };
}

export function createManager(provider, options = {}) {
  provider.consentStore ||= createMemoryNewsletterConsentStore();

  return createNewsletterManager({
    secret: "test-" + "n".repeat(40),
    resendApiKey: "test-key",
    resendApiBase: provider.base,
    emailEndpoint: provider.base + "/emails",
    emailFrom: "gracz.pl <kontakt@gracz.pl>",
    replyTo: "admin@gracz.pl",
    baseUrl: "https://gracz.pl/newsletter/",
    consentStore: provider.consentStore,
    consentHashSecret: CONSENT_HASH_SECRET,
    ...options,
  });
}

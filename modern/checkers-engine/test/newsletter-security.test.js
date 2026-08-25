import test from "node:test";
import assert from "node:assert/strict";
import { NewsletterService, createNewsletterHandler } from "../src/newsletter.js";
import { TokenService } from "../src/token-service.js";

function tokenFrom(text, path) {
  const match = String(text).match(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?token=([^\\s]+)`));
  assert.ok(match, `expected ${path} token in mail`);
  return decodeURIComponent(match[1]);
}

test("newsletter stores only hashes for confirmation, position and unsubscribe tokens", async () => {
  const sent = [];
  const mail = { send: async message => { sent.push(message); return { sent: true }; } };
  const tokens = new TokenService();
  const service = new NewsletterService(null, { tokenService: tokens, mail, baseUrl: "https://gracz.pl" });

  await service.subscribe({
    email: "security-test@example.com",
    preferredNick: "SecurityTest",
    legal: true,
    consent: true,
  });

  assert.equal(sent.length, 1);
  const confirmationToken = tokenFrom(sent[0].text, "/newsletter/confirm");
  const pending = service.memory.get("security-test@example.com");
  assert.ok(pending.confirmationHash);
  assert.notEqual(String(pending.confirmationHash), confirmationToken);
  assert.deepEqual(Buffer.from(pending.confirmationHash), tokens.hash(confirmationToken));

  await service.confirm(confirmationToken);
  assert.equal(sent.length, 2);

  const positionToken = tokenFrom(sent[1].text, "/newsletter/position");
  const unsubscribeToken = tokenFrom(sent[1].text, "/newsletter/unsubscribe");
  const subscribed = service.memory.get("security-test@example.com");

  assert.equal(subscribed.confirmationHash, null);
  assert.deepEqual(Buffer.from(subscribed.positionHash), tokens.hash(positionToken));
  assert.deepEqual(Buffer.from(subscribed.unsubscribeHash), tokens.hash(unsubscribeToken));
  assert.notEqual(String(subscribed.positionHash), positionToken);
  assert.notEqual(String(subscribed.unsubscribeHash), unsubscribeToken);

  assert.deepEqual(await service.position(positionToken), { position: 1 });
  await service.unsubscribeByToken(unsubscribeToken);
  assert.equal(subscribed.status, "unsubscribed");
  assert.equal(subscribed.positionHash, null);
  assert.equal(subscribed.unsubscribeHash, null);

  // Powtórne użycie tego samego tokenu nie przywraca subskrypcji ani nie ujawnia danych.
  assert.deepEqual(await service.unsubscribeByToken(unsubscribeToken), { ok: true });
  await service.close();
});


test("newsletter normalizes compatibility Unicode before validation", async () => {
  const service = new NewsletterService(null, { mail: { send: async () => ({ sent: true }) } });
  assert.equal(service.normalize("  Ｕser@Ｅxample.com  "), "user@example.com");
  assert.deepEqual(service.normalizeNick("  Ｐlayer_1  "), { value: "Player_1", normalized: "player_1" });
  await service.close();
});

test("honeypot is silently accepted without storing or sending anything", async () => {
  let subscribed = false;
  const auditEvents = [];
  const service = {
    normalize() { throw new Error("honeypot must be checked before email parsing"); },
    async subscribe() { subscribed = true; },
  };
  const security = {
    assertSameOrigin() {},
    source() { return "127.0.0.1"; },
    audit: { async record(event) { auditEvents.push(event); } },
  };
  const handler = createNewsletterHandler(service, { security });
  const payload = JSON.stringify({ website: "https://spam.example", email: "bot@example.com" });
  const request = {
    method: "POST",
    url: "/newsletter/subscribe",
    headers: { host: "localhost" },
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() { yield payload; },
  };
  const response = {
    status: null,
    body: "",
    writeHead(status) { this.status = status; },
    end(value) { this.body = String(value || ""); },
  };

  assert.equal(await handler(request, response), true);
  assert.equal(response.status, 202);
  assert.equal(JSON.parse(response.body).pendingConfirmation, true);
  assert.equal(subscribed, false);
  assert.equal(auditEvents[0].eventType, "newsletter.honeypot");
});

import test from "node:test";
import assert from "node:assert/strict";
import { createNewsletterRoute } from "../routes/newsletter-route.mjs";

function setup(newsletter, body) {
  return createNewsletterRoute({
    allowedOrigins: new Set(["https://gracz.pl"]), newsletter,
    newsletterIpBuckets: new Map(), newsletterEmailBuckets: new Map(),
    rateLimit() {}, hashValue: value => value, clientIp: () => "127.0.0.1",
    readJson: async () => body, json: (_res, status, body) => ({ status, body }),
    setCors() {}, bad(message, code) { throw Object.assign(new Error(message), {code}); },
    normalizeEmail: value => value.toLowerCase(), requiredString: value => value,
    optionalString: value => value || "", parseStartedAt: () => 0,
    isValidEmailSyntax: value => value.includes("@"), enforceFormTiming() {},
    validateEmailDomain: async () => {}, logger: { log() {} },
  });
}
const req = { method: "POST", headers: {origin: "https://gracz.pl"} };
const url = new URL("https://test/newsletter/subscribe");
test("B1 public success is neutral including honeypot", async () => {
  for (const state of ["new", "pending", "active", "suppressed"]) {
    const manager = { enabled: true, async requestOptIn() { return {state}; } };
    for (const website of ["", "bot"]) {
      const result = await setup(manager, {email:"test@example.test", consent:true, website})(req, {}, url, "test");
      assert.deepEqual(result, {status:200, body:{ok:true, state:"request_received"}});
    }
  }
});
test("B1 public contract preserves validation and actual provider failure", async () => {
  const failure = Object.assign(new Error("provider unavailable"), {status:502});
  const manager = {enabled:true, async requestOptIn() {throw failure;}};
  await assert.rejects(() => setup(manager, {email:"test@example.test", consent:false})(req, {}, url, "test"), {code:"NEWSLETTER_CONSENT_REQUIRED"});
  await assert.rejects(() => setup(manager, {email:"test@example.test", consent:true})(req, {}, url, "test"), error => error === failure);
});

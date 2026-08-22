import assert from "node:assert/strict";
import test from "node:test";

import { AdaptiveBotDefense, ChallengeRequiredError } from "../src/adaptive-bot-defense.js";
import { TrafficGuard, TrafficLimitError } from "../src/traffic-guard.js";

test("adaptive challenge appears only after repeated suspicious authentication failures", async () => {
  let now = 1_000_000;
  const defense = new AdaptiveBotDefense({
    siteKey: "site-key",
    secretKey: "secret-key",
    clock: () => now,
    fetchImpl: async () => ({ ok: true, json: async () => ({ success: true, hostname: "gracz.pl" }) }),
    expectedHostname: "gracz.pl",
  });
  const input = { source: "203.0.113.10", accountId: "alice", endpoint: "login" };
  assert.equal(defense.requiresChallenge(input), false);
  defense.recordFailure(input);
  assert.equal(defense.requiresChallenge(input), false);
  defense.recordFailure(input);
  assert.equal(defense.requiresChallenge(input), true);
  await assert.rejects(() => defense.verifyIfRequired(input), ChallengeRequiredError);
  await defense.verifyIfRequired({ ...input, token: "verified-token" });
  assert.equal(defense.requiresChallenge(input), false);
  now += 16 * 60_000;
  assert.equal(defense.requiresChallenge(input), false);
});

test("traffic guard rate limits the same account independently of IP", () => {
  const guard = new TrafficGuard();
  const request = { method: "POST", url: "/messages", headers: {}, socket: { remoteAddress: "203.0.113.20" } };
  for (let i = 0; i < 20; i += 1) guard.assertAccountAllowed({ request, userId: "alice", action: "message" });
  assert.throws(() => guard.assertAccountAllowed({ request, userId: "alice", action: "message" }), TrafficLimitError);
});

test("credential attempts are limited by source-account pair", () => {
  const guard = new TrafficGuard();
  const request = { method: "POST", url: "/auth/login", headers: {}, socket: { remoteAddress: "203.0.113.30" } };
  for (let i = 0; i < 6; i += 1) guard.assertCredentialAttempt({ request, accountId: "alice", endpoint: "login" });
  assert.throws(() => guard.assertCredentialAttempt({ request, accountId: "alice", endpoint: "login" }), TrafficLimitError);
});

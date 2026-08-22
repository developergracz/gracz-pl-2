import assert from "node:assert/strict";
import test from "node:test";

import { TrafficGuard, TrafficLimitError, clientSource } from "../src/traffic-guard.js";

function request(method, url, ip = "203.0.113.10") {
  return { method, url, headers: { "x-forwarded-for": ip }, socket: { remoteAddress: "127.0.0.1" } };
}

test("traffic guard allows normal requests and blocks registration floods", () => {
  let now = 1_000;
  const guard = new TrafficGuard({ clock: () => now });
  for (let i = 0; i < 8; i += 1) guard.assertAllowed(request("POST", "/auth/register"));
  assert.throws(() => guard.assertAllowed(request("POST", "/auth/register")), (error) => {
    assert.ok(error instanceof TrafficLimitError);
    assert.equal(error.scope, "register");
    assert.ok(error.retryAfterSeconds > 0);
    return true;
  });
  now += 15 * 60_000 + 1;
  assert.doesNotThrow(() => guard.assertAllowed(request("POST", "/auth/register")));
});

test("traffic guard throttles message and game chat spam independently", () => {
  const guard = new TrafficGuard();
  for (let i = 0; i < 20; i += 1) guard.assertAllowed(request("POST", "/messages"));
  assert.throws(() => guard.assertAllowed(request("POST", "/messages")), (error) => error.scope === "messages");

  const otherIp = "203.0.113.11";
  for (let i = 0; i < 30; i += 1) guard.assertAllowed(request("POST", "/games/abc123/chat", otherIp));
  assert.throws(() => guard.assertAllowed(request("POST", "/games/abc123/chat", otherIp)), (error) => error.scope === "game-chat");
});

test("health endpoint is excluded and forwarded source uses the nearest proxy value", () => {
  const guard = new TrafficGuard();
  const health = request("GET", "/health");
  for (let i = 0; i < 1_000; i += 1) guard.assertAllowed(health);
  assert.equal(clientSource({ headers: { "x-forwarded-for": "198.51.100.2, 203.0.113.9" }, socket: {} }), "203.0.113.9");
});

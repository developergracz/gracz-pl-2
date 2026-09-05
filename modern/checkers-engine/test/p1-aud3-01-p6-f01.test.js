import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createProductionRateLimitComposition,
  sendProductionRequestError,
} from "../src/production-rate-limit.js";

class CaptureResponse {
  constructor() {
    this.headers = new Map();
    this.headersSent = false;
    this.writableEnded = false;
    this.statusCode = null;
    this.body = "";
  }
  setHeader(name, value) { this.headers.set(String(name).toLowerCase(), String(value)); }
  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headersSent = true;
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
  }
  end(body = "") { this.body = String(body); this.writableEnded = true; }
}

function localGuard(events, { blockPath = null } = {}) {
  return {
    assertAllowed(request) {
      events.push("local-request");
      if (request.url === blockPath) {
        const error = new Error("local limited");
        error.status = 429;
        error.code = "TOO_MANY_REQUESTS";
        error.retryAfterSeconds = 17;
        throw error;
      }
    },
    assertAccountAllowed() { events.push("local-account"); },
    assertCredentialAttempt() { events.push("local-credential"); },
    assertRegistrationAttempt() { events.push("local-registration"); },
  };
}

test("P6-F01 production request composition executes local before shared exactly once", async () => {
  const events = [];
  const local = localGuard(events);
  const shared = { async assertAllowed() { events.push("shared-request"); } };
  const composition = createProductionRateLimitComposition({ localTrafficGuard: local, sharedTrafficGuard: shared });

  await composition.enforceRequest({ url: "/api/test", method: "GET" });
  composition.routedTrafficGuard.assertAllowed({ url: "/api/test", method: "GET" });

  assert.deepEqual(events, ["local-request", "shared-request"]);
  assert.equal(events.filter((event) => event === "local-request").length, 1);
  assert.equal(events.filter((event) => event === "shared-request").length, 1);
});

test("P6-F01 local 429 prevents any shared PostgreSQL limiter call", async () => {
  const events = [];
  const local = localGuard(events, { blockPath: "/blocked" });
  let sharedCalls = 0;
  const shared = { async assertAllowed() { sharedCalls += 1; events.push("shared-request"); } };
  const composition = createProductionRateLimitComposition({ localTrafficGuard: local, sharedTrafficGuard: shared });

  await assert.rejects(
    composition.enforceRequest({ url: "/blocked", method: "GET" }),
    (error) => error.status === 429 && error.retryAfterSeconds === 17,
  );
  assert.deepEqual(events, ["local-request"]);
  assert.equal(sharedCalls, 0);
});

test("P6-F01 health paths execute neither request-level limiter", async () => {
  const events = [];
  const local = localGuard(events);
  const shared = { async assertAllowed() { events.push("shared-request"); } };
  const composition = createProductionRateLimitComposition({ localTrafficGuard: local, sharedTrafficGuard: shared });

  for (const url of ["/health", "/health/live", "/health/ready"]) {
    await composition.enforceRequest({ url, method: "GET" });
  }
  assert.deepEqual(events, []);
});

test("P6-F01 shared failure stays sanitized 503 and local Retry-After remains correct", async () => {
  const localEvents = [];
  const local = localGuard(localEvents, { blockPath: "/local-block" });
  const shared = {
    async assertAllowed() {
      const error = new Error("postgresql://user:password@db/internal SELECT secret");
      error.status = 503;
      error.code = "SHARED_INFRASTRUCTURE_UNAVAILABLE";
      throw error;
    },
  };
  const composition = createProductionRateLimitComposition({ localTrafficGuard: local, sharedTrafficGuard: shared });

  const sharedResponse = new CaptureResponse();
  try {
    await composition.enforceRequest({ url: "/shared-failure", method: "GET" });
    assert.fail("shared failure expected");
  } catch (error) {
    assert.equal(sendProductionRequestError(sharedResponse, error), true);
  }
  assert.equal(sharedResponse.statusCode, 503);
  assert.deepEqual(JSON.parse(sharedResponse.body), {
    error: { code: "SHARED_INFRASTRUCTURE_UNAVAILABLE", message: "Wewnętrzny błąd aplikacji." },
  });
  for (const leaked of ["postgresql://", "password", "SELECT", "secret"]) {
    assert.equal(sharedResponse.body.includes(leaked), false);
  }

  const localResponse = new CaptureResponse();
  try {
    await composition.enforceRequest({ url: "/local-block", method: "GET" });
    assert.fail("local limit expected");
  } catch (error) {
    assert.equal(sendProductionRequestError(localResponse, error), true);
  }
  assert.equal(localResponse.statusCode, 429);
  assert.equal(localResponse.headers.get("retry-after"), "17");
});

test("P6-F01 routed account credential registration guards keep local delegation and production wiring", async () => {
  const events = [];
  const local = localGuard(events);
  const composition = createProductionRateLimitComposition({ localTrafficGuard: local, sharedTrafficGuard: null });
  composition.routedTrafficGuard.assertAccountAllowed({});
  composition.routedTrafficGuard.assertCredentialAttempt({});
  composition.routedTrafficGuard.assertRegistrationAttempt({});
  assert.deepEqual(events, ["local-account", "local-credential", "local-registration"]);

  const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const serverSource = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(mainSource, /createProductionRateLimitComposition/);
  assert.match(mainSource, /trafficGuard:routedTrafficGuard/);
  assert.match(mainSource, /sharedRequestGuardExternally:true/);
  assert.match(mainSource, /await enforceRequest\(request\)/);
  assert.match(serverSource, /localGuard\.assertAccountAllowed\(input\)[\s\S]*sharedGuard\.assertAccountAllowed\(input\)/);
  assert.match(serverSource, /localGuard\.assertCredentialAttempt\(input\)[\s\S]*sharedGuard\.assertCredentialAttempt\(input\)/);
  assert.match(serverSource, /localGuard\.assertRegistrationAttempt\(input\)[\s\S]*sharedGuard\.assertRegistrationAttempt\(input\)/);
});

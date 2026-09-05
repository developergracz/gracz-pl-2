import assert from "node:assert/strict";
import test from "node:test";

import { handleHealthRequest } from "../src/health.js";

function responseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; },
    end(body) { this.body = JSON.parse(body); },
  };
}

test("liveness stays healthy without touching dependencies", async () => {
  let checks = 0;
  const response = responseRecorder();
  const handled = await handleHealthRequest({ method: "GET", url: "/health/live" }, response, {
    store: { async healthCheck() { checks += 1; throw new Error("db down"); } },
  });
  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(checks, 0);
});

test("readiness is 200 when required dependency is healthy", async () => {
  const response = responseRecorder();
  await handleHealthRequest({ method: "GET", url: "/health/ready" }, response, {
    store: { async healthCheck() { return { ok: true, dependency: "postgresql", latencyMs: 1 }; } },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "ready");
  assert.equal(response.body.dependency.dependency, "postgresql");
});

test("readiness is 503 when required dependency is unavailable", async () => {
  const response = responseRecorder();
  await handleHealthRequest({ method: "GET", url: "/health/ready" }, response, {
    store: { async healthCheck() { throw new Error("connection refused"); } },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.status, "not-ready");
  assert.equal(response.body.error.code, "DEPENDENCY_UNAVAILABLE");
});

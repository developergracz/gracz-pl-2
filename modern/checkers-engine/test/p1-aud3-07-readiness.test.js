import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { handleHealthRequest } from "../src/health.js";

async function withHealthServer(store, run) {
  const server = createServer(async (request, response) => {
    const handled = await handleHealthRequest(request, response, { store });
    if (!handled && !response.writableEnded) {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: { code: "NOT_FOUND" } }));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("P1-AUD3-07 compatibility /health remains liveness with the historical response", async () => {
  let checks = 0;
  await withHealthServer({
    async healthCheck() {
      checks += 1;
      throw new Error("must not be called");
    },
  }, async (origin) => {
    const response = await fetch(`${origin}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
  assert.equal(checks, 0);
});

test("P1-AUD3-07 liveness is 200 and never touches PostgreSQL health", async () => {
  let checks = 0;
  await withHealthServer({
    async healthCheck() {
      checks += 1;
      throw new Error("postgresql://user:secret@db.internal:5432/gracz");
    },
  }, async (origin) => {
    const response = await fetch(`${origin}/health/live`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", probe: "liveness" });
  });
  assert.equal(checks, 0);
});

test("P1-AUD3-07 readiness is minimal 200 for a healthy required store", async () => {
  let checks = 0;
  await withHealthServer({
    async healthCheck() {
      checks += 1;
      return {
        ok: true,
        dependency: "postgresql",
        latencyMs: 99,
        internal: "must-not-leak",
      };
    },
  }, async (origin) => {
    const response = await fetch(`${origin}/health/ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready", probe: "readiness" });
  });
  assert.equal(checks, 1);
});

test("P1-AUD3-07 readiness is explicit ready for a deliberate local/dev store", async () => {
  await withHealthServer({ kind: "file-store" }, async (origin) => {
    const response = await fetch(`${origin}/health/ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready", probe: "readiness" });
  });
});

test("P1-AUD3-07 readiness fails closed with sanitized DEPENDENCY_UNAVAILABLE", async () => {
  const secret = "postgresql://gracz:super-secret@db.internal:5432/gracz";
  await withHealthServer({
    async healthCheck() {
      const error = new Error(`connect ECONNREFUSED ${secret}\nSELECT 1\n/var/lib/postgresql/data`);
      error.stack = `Error: ${error.message}\n at ${secret}`;
      throw error;
    },
  }, async (origin) => {
    const response = await fetch(`${origin}/health/ready`);
    assert.equal(response.status, 503);
    const bodyText = await response.text();
    assert.deepEqual(JSON.parse(bodyText), {
      status: "not-ready",
      probe: "readiness",
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
    assert.equal(bodyText.includes("super-secret"), false);
    assert.equal(bodyText.includes("DATABASE_URL"), false);
    assert.equal(bodyText.includes("ECONNREFUSED"), false);
    assert.equal(bodyText.includes("SELECT 1"), false);
    assert.equal(bodyText.includes("/var/lib"), false);
  });
});

test("P1-AUD3-07 unsupported methods never execute health probe logic", async () => {
  let checks = 0;
  await withHealthServer({
    async healthCheck() {
      checks += 1;
      return { ok: true };
    },
  }, async (origin) => {
    for (const path of ["/health/live", "/health/ready"]) {
      const response = await fetch(`${origin}${path}`, { method: "POST" });
      assert.equal(response.status, 404);
    }
  });
  assert.equal(checks, 0);
});

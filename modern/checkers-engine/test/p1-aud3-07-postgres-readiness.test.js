import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import pg from "pg";

import { handleHealthRequest } from "../src/health.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";

const { Pool } = pg;
const INIT_LOCK_ID = 731_004_201;

const databaseUrl = process.env.P1_AUD3_07_DATABASE_URL;
const requirePostgres = process.env.P1_AUD3_07_REQUIRE_POSTGRES === "1";

if (requirePostgres && !databaseUrl) {
  throw new Error("P1_AUD3_07_DATABASE_URL is required for the dedicated PostgreSQL readiness gate.");
}

const pgTest = databaseUrl ? test : test.skip;

async function requestHealth(store, pathname) {
  const server = createServer(async (request, response) => {
    const handled = await handleHealthRequest(request, response, { store });
    if (!handled) {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

pgTest("P1-AUD3-07 real PostgreSQL healthCheck performs a healthy bounded SELECT 1", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  try {
    await store.ready;
    const result = await store.healthCheck();
    assert.deepEqual(result, { ok: true, dependency: "postgresql" });

    const readiness = await requestHealth(store, "/health/ready");
    assert.equal(readiness.status, 200);
    assert.deepEqual(readiness.body, { status: "ready", probe: "readiness" });
  } finally {
    await store.close();
  }
});

pgTest("P1-AUD3-07 PostgreSQL pool exhaustion cannot hang readiness indefinitely", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const heldClients = [];
  try {
    await store.ready;
    for (let index = 0; index < 4; index += 1) {
      heldClients.push(await store.pool.connect());
    }

    const started = Date.now();
    await assert.rejects(store.healthCheck(), (error) => error?.code === "DEPENDENCY_UNAVAILABLE");
    const elapsedMs = Date.now() - started;
    assert.ok(elapsedMs >= 800, `probe returned too early to exercise deadline: ${elapsedMs}ms`);
    assert.ok(elapsedMs < 2_500, `probe exceeded bounded readiness window: ${elapsedMs}ms`);
  } finally {
    for (const client of heldClients) client.release();
    await store.close();
  }
});

pgTest("P1-AUD3-07 an unavailable actual PostgreSQL store maps readiness to sanitized 503", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  await store.ready;
  await store.close();

  const readiness = await requestHealth(store, "/health/ready");
  assert.equal(readiness.status, 503);
  assert.deepEqual(readiness.body, {
    status: "not-ready",
    probe: "readiness",
    error: { code: "DEPENDENCY_UNAVAILABLE" },
  });
});

pgTest("P1-AUD3-07 blocked initialization cannot hang readiness and liveness stays healthy", async () => {
  const adminPool = new Pool({
    connectionString: databaseUrl,
    ssl: false,
    max: 1,
  });
  const lockClient = await adminPool.connect();
  let store;
  let lockHeld = false;

  try {
    await lockClient.query("SELECT pg_advisory_lock($1)", [INIT_LOCK_ID]);
    lockHeld = true;

    store = new PostgresSessionStore(databaseUrl);

    const initializationState = await Promise.race([
      store.ready.then(() => "ready", () => "rejected"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 150)),
    ]);
    assert.equal(initializationState, "pending");

    const started = Date.now();
    const readiness = await requestHealth(store, "/health/ready");
    const elapsedMs = Date.now() - started;

    assert.equal(readiness.status, 503);
    assert.deepEqual(readiness.body, {
      status: "not-ready",
      probe: "readiness",
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    });
    assert.ok(elapsedMs >= 800, `blocked initialization returned too early: ${elapsedMs}ms`);
    assert.ok(elapsedMs < 2_500, `blocked initialization exceeded readiness bound: ${elapsedMs}ms`);

    const liveness = await requestHealth(store, "/health/live");
    assert.equal(liveness.status, 200);
    assert.deepEqual(liveness.body, { status: "ok", probe: "liveness" });
  } finally {
    if (lockHeld) {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [INIT_LOCK_ID]);
    }
    lockClient.release();

    if (store) {
      await store.ready.catch(() => {});
      await store.close();
    }
    await adminPool.end();
  }
});

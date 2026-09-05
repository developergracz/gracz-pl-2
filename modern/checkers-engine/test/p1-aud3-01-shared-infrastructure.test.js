import { EventEmitter } from "node:events";
import { createServer as createNodeServer } from "node:http";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

import {
  DistributedRateLimitError,
  PostgresDistributedTrafficGuard,
  PostgresRealtimeHub,
  SharedInfrastructureUnavailableError,
} from "../src/distributed-infrastructure.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameHttpServer } from "../src/server.js";
import { createGameSession, getSessionSnapshot, sendChatMessage } from "../src/session.js";
import { TrafficGuard, TrafficLimitError, clientSource } from "../src/traffic-guard.js";

const { Pool } = pg;
const databaseUrl = process.env.P1_AUD3_01_DATABASE_URL || "";
const requirePostgres = process.env.P1_AUD3_01_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("P1_AUD3_01_DATABASE_URL is required.");
const pgTest = databaseUrl ? test : test.skip;
const REALTIME_CHANNEL = "gracz_checkers_realtime";

class CaptureResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = null;
    this.headers = {};
    this.chunks = [];
    this.ended = false;
  }
  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }
  write(chunk) {
    const value = String(chunk);
    this.chunks.push(value);
    this.emit("chunk", value);
    return true;
  }
  end() {
    if (this.ended) return;
    this.ended = true;
    this.emit("close");
  }
}

function requestShape(url, method = "GET", remoteAddress = "203.0.113.10") {
  return { method, url, headers: {}, socket: { remoteAddress } };
}

async function waitFor(predicate, timeoutMs = 5_000, intervalMs = 25) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timeout waiting for condition");
}

async function waitForChunk(response, predicate, timeoutMs = 5_000) {
  const existing = response.chunks.find(predicate);
  if (existing) return existing;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      response.off("chunk", onChunk);
      reject(new Error("Timeout waiting for SSE event"));
    }, timeoutMs);
    const onChunk = (chunk) => {
      if (!predicate(chunk)) return;
      clearTimeout(timer);
      response.off("chunk", onChunk);
      resolve(chunk);
    };
    response.on("chunk", onChunk);
  });
}

function parseSseData(chunk) {
  const data = String(chunk).split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(data.slice(6));
}

async function requestServer(server, { path = "/x", method = "GET", headers = {}, body = null } = {}) {
  if (!server.listening) await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: body == null ? headers : { "content-type": "application/json", ...headers },
    body: body == null ? undefined : JSON.stringify(body),
  });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve) => server.close(resolve));
}

pgTest("P1-AUD3-01 shared counter is atomic across two independent guard instances", async () => {
  const guardA = new PostgresDistributedTrafficGuard(databaseUrl);
  const guardB = new PostgresDistributedTrafficGuard(databaseUrl);
  const key = `atomic-${Date.now()}-${Math.random()}`;
  try {
    await Promise.all([guardA.ready, guardB.ready]);
    const attempts = Array.from({ length: 40 }, (_, index) =>
      (index % 2 ? guardA : guardB).consume(key, { limit: 20, windowMs: 60_000, scope: "atomic" }),
    );
    const results = await Promise.allSettled(attempts);
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 20);
    const rejected = results.filter((item) => item.status === "rejected");
    assert.equal(rejected.length, 20);
    assert.ok(rejected.every((item) => item.reason instanceof DistributedRateLimitError));
    assert.ok(rejected.every((item) => item.reason.status === 429));
  } finally {
    await Promise.all([guardA.close(), guardB.close()]);
  }
});

pgTest("P1-AUD3-01 shared counter resets deterministically after its window", async () => {
  let now = 1_800_000_000_000;
  const guard = new PostgresDistributedTrafficGuard(databaseUrl, { clock: () => now });
  const key = `reset-${Date.now()}-${Math.random()}`;
  try {
    await guard.ready;
    assert.equal((await guard.consume(key, { limit: 1, windowMs: 1_000 })).count, 1);
    await assert.rejects(guard.consume(key, { limit: 1, windowMs: 1_000 }), DistributedRateLimitError);
    now += 1_001;
    const reset = await guard.consume(key, { limit: 1, windowMs: 1_000 });
    assert.equal(reset.count, 1);
    assert.equal(reset.resetAt, now + 1_000);
  } finally {
    await guard.close();
  }
});

pgTest("P1-AUD3-01 credential and registration protections are shared across instances", async () => {
  const guardA = new PostgresDistributedTrafficGuard(databaseUrl);
  const guardB = new PostgresDistributedTrafficGuard(databaseUrl);
  const unique = `${Date.now()}-${Math.random()}`;
  const loginRequest = requestShape("/auth/login", "POST", `198.51.100.${Math.floor(Math.random() * 100) + 1}`);
  const registerRequest = requestShape("/auth/register", "POST", `203.0.113.${Math.floor(Math.random() * 100) + 1}`);
  try {
    await Promise.all([guardA.ready, guardB.ready]);
    for (let index = 0; index < 6; index += 1) {
      await (index % 2 ? guardA : guardB).assertCredentialAttempt({ request: loginRequest, accountId: `login-${unique}`, endpoint: "login" });
    }
    await assert.rejects(
      guardA.assertCredentialAttempt({ request: loginRequest, accountId: `login-${unique}`, endpoint: "login" }),
      (error) => error instanceof DistributedRateLimitError && error.scope === "credential-pair",
    );

    for (let index = 0; index < 3; index += 1) {
      await (index % 2 ? guardA : guardB).assertRegistrationAttempt({ request: registerRequest, accountId: `register-${unique}` });
    }
    await assert.rejects(
      guardB.assertRegistrationAttempt({ request: registerRequest, accountId: `register-${unique}` }),
      (error) => error instanceof DistributedRateLimitError && error.scope === "mass-registration-pair",
    );
  } finally {
    await Promise.all([guardA.close(), guardB.close()]);
  }
});

pgTest("P1-AUD3-01 account-sensitive limits are shared across instances", async () => {
  const guardA = new PostgresDistributedTrafficGuard(databaseUrl);
  const guardB = new PostgresDistributedTrafficGuard(databaseUrl);
  const request = requestShape("/messages", "POST", "192.0.2.55");
  const userId = `account-${Date.now()}-${Math.random()}`;
  try {
    await Promise.all([guardA.ready, guardB.ready]);
    for (let index = 0; index < 20; index += 1) {
      await (index % 2 ? guardA : guardB).assertAccountAllowed({ request, userId, action: "message" });
    }
    await assert.rejects(
      guardA.assertAccountAllowed({ request, userId, action: "message" }),
      (error) => error instanceof DistributedRateLimitError && error.scope === "ip-account-pair",
    );
  } finally {
    await Promise.all([guardA.close(), guardB.close()]);
  }
});

pgTest("P1-AUD3-01 all health paths bypass both process and shared limiter", async () => {
  const local = new TrafficGuard();
  const shared = new PostgresDistributedTrafficGuard(databaseUrl);
  await shared.ready;
  await shared.close();
  for (const path of ["/health", "/health/live", "/health/ready"]) {
    const request = requestShape(path);
    assert.doesNotThrow(() => local.assertAllowed(request));
    await assert.doesNotReject(shared.assertAllowed(request));
  }
});

pgTest("P1-AUD3-01 required shared infrastructure outage fails closed within a bounded window", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  await guard.ready;
  await guard.pool.end();
  const started = Date.now();
  await assert.rejects(
    guard.consume(`outage-${Date.now()}`, { limit: 10, windowMs: 60_000 }),
    SharedInfrastructureUnavailableError,
  );
  assert.ok(Date.now() - started < 2_500);
});

test("P1-AUD3-01 HTTP 429 includes Retry-After and local guard remains active", async () => {
  const sharedServer = createGameHttpServer({
    store: {},
    sharedTrafficGuard: { async assertAllowed() { throw new DistributedRateLimitError(17, "shared"); } },
  });
  const localServer = createGameHttpServer({
    store: {},
    trafficGuard: { assertAllowed() { throw new TrafficLimitError(9, "local"); } },
    sharedTrafficGuard: { async assertAllowed() {} },
  });
  try {
    const shared = await requestServer(sharedServer);
    assert.equal(shared.status, 429);
    assert.equal(shared.headers.get("retry-after"), "17");
    const local = await requestServer(localServer);
    assert.equal(local.status, 429);
    assert.equal(local.headers.get("retry-after"), "9");
  } finally {
    await Promise.all([closeServer(sharedServer), closeServer(localServer)]);
  }
});

test("P1-AUD3-01 HTTP shared-infrastructure failure is sanitized 503", async () => {
  const server = createGameHttpServer({
    store: {},
    sharedTrafficGuard: { async assertAllowed() { throw new SharedInfrastructureUnavailableError(); } },
  });
  try {
    const response = await requestServer(server);
    assert.equal(response.status, 503);
    assert.deepEqual(JSON.parse(response.text), {
      error: {
        code: "SHARED_INFRASTRUCTURE_UNAVAILABLE",
        message: "Współdzielona infrastruktura ochronna jest chwilowo niedostępna.",
      },
    });
    for (const secret of ["postgresql://", "SELECT", "ECONNREFUSED", "password", "stack"]) {
      assert.equal(response.text.includes(secret), false);
    }
  } finally {
    await closeServer(server);
  }
});

test("P1-AUD3-01 clientSource ignores proxy headers unless explicitly trusted", () => {
  const previousProxy = process.env.TRUST_PROXY_HEADERS;
  const previousCloudflare = process.env.TRUST_CLOUDFLARE_HEADERS;
  delete process.env.TRUST_PROXY_HEADERS;
  delete process.env.TRUST_CLOUDFLARE_HEADERS;
  try {
    assert.equal(clientSource({
      headers: { "x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "5.6.7.8" },
      socket: { remoteAddress: "::ffff:192.0.2.99" },
    }), "192.0.2.99");
  } finally {
    if (previousProxy === undefined) delete process.env.TRUST_PROXY_HEADERS; else process.env.TRUST_PROXY_HEADERS = previousProxy;
    if (previousCloudflare === undefined) delete process.env.TRUST_CLOUDFLARE_HEADERS; else process.env.TRUST_CLOUDFLARE_HEADERS = previousCloudflare;
  }
});

pgTest("P1-AUD3-01 publish on A reaches B after authoritative re-read with player-scoped projection", async () => {
  const cleanupPool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresSessionStore(databaseUrl);
  const hubA = new PostgresRealtimeHub(databaseUrl);
  const hubB = new PostgresRealtimeHub(databaseUrl);
  const gameId = `p6-realtime-${Date.now()}`;
  const whiteResponse = new CaptureResponse();
  const blackResponse = new CaptureResponse();
  try {
    await Promise.all([store.ready, hubA.ready, hubB.ready]);
    const session = await store.create(createGameSession({ gameId, whitePlayerId: "white-a", blackPlayerId: "black-b" }));
    hubB.subscribe(session, "white-a", whiteResponse);
    hubB.subscribe(session, "black-b", blackResponse);

    const updated = sendChatMessage(session, { playerId: "black-b", text: "cross-instance-authoritative" });
    const saved = await store.save(updated);
    assert.equal(await hubA.publish(saved, "chat.message"), true);

    const whiteChunk = await waitForChunk(whiteResponse, (chunk) => chunk.includes("event: chat.message"));
    const blackChunk = await waitForChunk(blackResponse, (chunk) => chunk.includes("event: chat.message"));
    const whiteSnapshot = parseSseData(whiteChunk);
    const blackSnapshot = parseSseData(blackChunk);
    assert.deepEqual(whiteSnapshot, getSessionSnapshot(saved, "white-a"));
    assert.deepEqual(blackSnapshot, getSessionSnapshot(saved, "black-b"));
    assert.equal(whiteSnapshot.color, "white");
    assert.equal(blackSnapshot.color, "black");
  } finally {
    whiteResponse.end();
    blackResponse.end();
    await Promise.all([hubA.close(), hubB.close()]);
    await store.close();
    await cleanupPool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await cleanupPool.end();
  }
});

pgTest("P1-AUD3-01 malformed notifications are ignored and listener reconnects without duplicate delivery", async () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresSessionStore(databaseUrl);
  const hubA = new PostgresRealtimeHub(databaseUrl);
  const hubB = new PostgresRealtimeHub(databaseUrl);
  const gameId = `p6-reconnect-${Date.now()}`;
  const response = new CaptureResponse();
  try {
    await Promise.all([store.ready, hubA.ready, hubB.ready]);
    const session = await store.create(createGameSession({ gameId, whitePlayerId: "white-a", blackPlayerId: "black-b" }));
    hubB.subscribe(session, "white-a", response);
    const initialChunks = response.chunks.length;

    await adminPool.query("SELECT pg_notify($1, $2)", [REALTIME_CHANNEL, "not-json"]);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(response.chunks.length, initialChunks);

    const oldPid = hubB.listenerBackendPid;
    assert.ok(Number.isInteger(oldPid));
    await adminPool.query("SELECT pg_terminate_backend($1)", [oldPid]);
    const newPid = await waitFor(() => hubB.listenerBackendPid && hubB.listenerBackendPid !== oldPid ? hubB.listenerBackendPid : null);
    assert.notEqual(newPid, oldPid);

    const updated = sendChatMessage(session, { playerId: "black-b", text: "after-reconnect" });
    const saved = await store.save(updated);
    assert.equal(await hubA.publish(saved, "chat.message"), true);
    await waitForChunk(response, (chunk) => chunk.includes("after-reconnect"));
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(response.chunks.filter((chunk) => chunk.includes("after-reconnect")).length, 1);
  } finally {
    response.end();
    await Promise.all([hubA.close(), hubB.close(), hubB.close()]);
    await store.close();
    await adminPool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await adminPool.end();
  }
});

test("P1-AUD3-01 session conflict returns 409 and does not call realtime publish", async () => {
  const session = createGameSession({ gameId: "p6-conflict", whitePlayerId: "white-a", blackPlayerId: "black-b" });
  let publishes = 0;
  const conflict = Object.assign(new Error("conflict"), { code: "SESSION_CONCURRENCY_CONFLICT", status: 409 });
  const server = createGameHttpServer({
    store: {
      async get() { return session; },
      async save() { throw conflict; },
    },
    realtime: {
      subscribe() {},
      publish() { publishes += 1; return Promise.resolve(true); },
      close() {},
    },
  });
  try {
    const response = await requestServer(server, {
      path: "/games/p6-conflict/chat",
      method: "POST",
      headers: { "x-player-id": "white-a" },
      body: { text: "must-not-publish" },
    });
    assert.equal(response.status, 409);
    assert.equal(publishes, 0);
  } finally {
    await closeServer(server);
  }
});

test("P1-AUD3-01 source does not introduce an independent insecure TLS policy or full-state NOTIFY", async () => {
  const source = await readFile(new URL("../src/distributed-infrastructure.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /rejectUnauthorized\s*:\s*false/);
  assert.doesNotMatch(source, /\bssl\s*:/);
  assert.match(source, /JSON\.stringify\(\{ gameId, type \}\)/);
  assert.doesNotMatch(source, /pg_notify[\s\S]{0,400}serializeSession/);
  assert.match(source, /SELECT state FROM gracz_game_sessions WHERE game_id = \$1/);
});

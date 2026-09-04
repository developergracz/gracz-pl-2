import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

import {
  DistributedRateLimitError,
  PostgresDistributedTrafficGuard,
  PostgresRealtimeHub,
} from "../src/distributed-infrastructure.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameSession, sendChatMessage } from "../src/session.js";

const { Pool } = pg;
const databaseUrl = process.env.P1_AUD3_01_DATABASE_URL || "";
const postgresOnly = { skip: databaseUrl ? false : "P1_AUD3_01_DATABASE_URL is not configured" };

class CaptureResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = null;
    this.headers = null;
    this.chunks = [];
    this.ended = false;
  }

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
  }

  write(chunk) {
    const value = String(chunk);
    this.chunks.push(value);
    this.emit("chunk", value);
    return true;
  }

  end() {
    this.ended = true;
    this.emit("close");
  }
}

async function waitForChunk(response, predicate, timeoutMs = 3000) {
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

test("P1-AUD3-01 PostgreSQL: rate-limit counter is atomic and shared across instances", postgresOnly, async () => {
  const guardA = new PostgresDistributedTrafficGuard(databaseUrl);
  const guardB = new PostgresDistributedTrafficGuard(databaseUrl);
  try {
    await Promise.all([guardA.ready, guardB.ready]);
    const key = `p1-aud3-01-${Date.now()}-${Math.random()}`;
    const first = await Promise.allSettled([
      guardA.consume(key, { limit: 1, windowMs: 60_000, scope: "multi-instance" }),
      guardB.consume(key, { limit: 1, windowMs: 60_000, scope: "multi-instance" }),
    ]);

    assert.equal(first.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(first.filter((result) => result.status === "rejected").length, 1);
    const rejected = first.find((result) => result.status === "rejected");
    assert.ok(rejected.reason instanceof DistributedRateLimitError);
    assert.equal(rejected.reason.status, 429);
    assert.equal(rejected.reason.scope, "multi-instance");
  } finally {
    await Promise.all([guardA.close(), guardB.close()]);
  }
});

test("P1-AUD3-01 PostgreSQL: SSE event published by instance A reaches subscriber on instance B", postgresOnly, async () => {
  const cleanupPool = new Pool({ connectionString: databaseUrl, ssl: false });
  const store = new PostgresSessionStore(databaseUrl);
  const hubA = new PostgresRealtimeHub(databaseUrl);
  const hubB = new PostgresRealtimeHub(databaseUrl);
  const gameId = `p1-aud3-01-${Date.now()}`;
  const response = new CaptureResponse();

  try {
    await Promise.all([store.ready, hubA.ready, hubB.ready]);
    const session = createGameSession({ gameId, whitePlayerId: "white-a", blackPlayerId: "black-b" });
    await store.create(session);
    hubB.subscribe(session, "white-a", response);

    const updated = sendChatMessage(session, { playerId: "white-a", text: "cross-instance" });
    await store.save(updated);
    assert.equal(await hubA.publish(updated, "chat.message"), true);

    const event = await waitForChunk(response, (chunk) => chunk.includes("event: chat.message"));
    assert.match(event, /cross-instance/);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "text/event-stream; charset=utf-8");
  } finally {
    response.end();
    await Promise.all([hubA.close(), hubB.close()]);
    await store.close();
    await cleanupPool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await cleanupPool.end();
  }
});

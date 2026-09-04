import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import pg from "pg";

import { AuthService } from "../src/auth.js";
import { createGomokuHttpHandler } from "../src/gomoku-http.js";
import { PostgresGomokuService } from "../src/postgres-gomoku-service.js";

const { Pool } = pg;
const databaseUrl = process.env.P1_AUD3_04_DATABASE_URL;
const admin = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: false, max: 2 }) : null;
const secret = "g".repeat(64);

before(async () => {
  if (!admin) return;
  const client = await admin.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [731004304]);
    await client.query(`CREATE TABLE IF NOT EXISTS gracz_gomoku_games (
      game_id VARCHAR(128) PRIMARY KEY,
      state JSONB NOT NULL,
      revision INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [731004304]).catch(() => {});
    client.release();
  }
});

after(async () => {
  if (!admin) return;
  await admin.query("DELETE FROM gracz_gomoku_games WHERE game_id LIKE 'p1aud304http_%'").catch(() => {});
  await admin.end();
});

test("P1-AUD3-04 durable HTTP GET/move and requestId retry remain stable", { skip: !databaseUrl }, async () => {
  const fixture = await httpFixture();
  try {
    const alice = fixture.token("alice", "Alicja");
    let result = await request(fixture, `/gomoku/games/${fixture.gameId}`, alice);
    assert.equal(result.status, 200);
    assert.equal(result.body.revision, 0);

    const options = { method: "POST", body: JSON.stringify({ row: 7, column: 7, requestId: "http-stable-1" }) };
    result = await request(fixture, `/gomoku/games/${fixture.gameId}/moves`, alice, options);
    assert.equal(result.status, 200);
    assert.equal(result.body.revision, 1);
    assert.equal(result.body.moves.length, 1);

    const retry = await request(fixture, `/gomoku/games/${fixture.gameId}/moves`, alice, options);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.revision, 1);
    assert.equal(retry.body.moves.length, 1);
    assert.equal(retry.body.moves[0].requestId, "http-stable-1");
  } finally {
    await fixture.close();
  }
});

test("P1-AUD3-04 durable HTTP maps stale CAS to stable 409 without overwriting winner", { skip: !databaseUrl }, async () => {
  const barrier = oneShotBarrier();
  const fixture = await httpFixture({ beforeCas: barrier.hook });
  const concurrent = new PostgresGomokuService(databaseUrl);
  await concurrent.ready;
  try {
    const alice = fixture.token("alice", "Alicja");
    const pending = request(fixture, `/gomoku/games/${fixture.gameId}/moves`, alice, {
      method: "POST",
      body: JSON.stringify({ row: 1, column: 1, requestId: "http-stale" }),
    });
    await barrier.entered;
    try {
      const winner = await concurrent.move(fixture.gameId, "alice", { row: 1, column: 2, requestId: "direct-winner" });
      assert.equal(winner.revision, 1);
    } finally {
      barrier.release();
    }

    const conflict = await pending;
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.code, "GOMOKU_CONCURRENCY_CONFLICT");

    const finalView = await request(fixture, `/gomoku/games/${fixture.gameId}`, alice);
    assert.equal(finalView.status, 200);
    assert.equal(finalView.body.revision, 1);
    assert.equal(finalView.body.moves.length, 1);
    assert.equal(finalView.body.moves[0].requestId, "direct-winner");
    // Gomoku currently has no realtime publisher dependency: publish count is zero by architecture.
  } finally {
    barrier.release();
    await concurrent.close();
    await fixture.close();
  }
});

async function httpFixture({ beforeCas = null } = {}) {
  const gameId = `p1aud304http_${randomUUID()}`;
  const auth = new AuthService({ secret });
  const service = new PostgresGomokuService(databaseUrl, { beforeCas });
  await service.ready;
  await service.createGame({ gameId, players: [{ userId: "alice", displayName: "Alicja" }, { userId: "bob", displayName: "Robert" }] });
  const handler = createGomokuHttpHandler({ service, auth });
  const server = createServer(async (incoming, response) => {
    if (!await handler(incoming, response)) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    gameId,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    token(userId, displayName) { return auth.issue({ userId, displayName }); },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await service.close();
    },
  };
}

async function request(fixture, path, token, options = {}) {
  const response = await fetch(`${fixture.baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  return { status: response.status, body: await response.json() };
}

function oneShotBarrier() {
  let enter;
  let release;
  let used = false;
  const entered = new Promise((resolve) => { enter = resolve; });
  const released = new Promise((resolve) => { release = resolve; });
  return {
    entered,
    hook: async () => {
      if (used) return;
      used = true;
      enter();
      await released;
    },
    release: () => release(),
  };
}

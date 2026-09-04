import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import pg from "pg";

import { PostgresGomokuService } from "../src/postgres-gomoku-service.js";

const { Pool } = pg;
const databaseUrl = process.env.P1_AUD3_04_DATABASE_URL;
const admin = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: false, max: 2 }) : null;

const players = () => [
  { userId: "alice", displayName: "Alicja" },
  { userId: "bob", displayName: "Robert" },
];
const otherPlayers = () => [
  { userId: "carol", displayName: "Karolina" },
  { userId: "dave", displayName: "Dawid" },
];
const gameId = (label) => `p1aud304_${label}_${randomUUID()}`;

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
  await admin.query("DELETE FROM gracz_gomoku_games WHERE game_id LIKE 'p1aud304_%'").catch(() => {});
  await admin.end();
});

test("P1-AUD3-04 PostgreSQL persists canonical state, revision and requestId across restart", { skip: !databaseUrl }, async () => {
  const id = gameId("recovery");
  const first = new PostgresGomokuService(databaseUrl);
  await first.ready;
  let beforeRestart;
  try {
    await first.createGame({ gameId: id, players: players() });
    await first.move(id, "alice", { row: 7, column: 7, requestId: "alice-r1" });
    await first.move(id, "bob", { row: 7, column: 8, requestId: "bob-r1" });
    beforeRestart = await first.view(id, "alice");
    assert.equal(beforeRestart.revision, 2);
    assert.equal(beforeRestart.moves.length, 2);
  } finally {
    await first.close();
  }

  const second = new PostgresGomokuService(databaseUrl);
  await second.ready;
  try {
    const recovered = await second.view(id, "alice");
    assert.deepEqual(recovered, beforeRestart);
    const retry = await second.move(id, "bob", { row: 7, column: 8, requestId: "bob-r1" });
    assert.equal(retry.revision, 2);
    assert.equal(retry.moves.length, 2);
    assert.equal(retry.moves[1].sequence, 2);
  } finally {
    await second.close();
  }
});

test("P1-AUD3-04 PostgreSQL CAS allows exactly one winner and protects newer state", { skip: !databaseUrl }, async () => {
  const id = gameId("cas");
  const barrier = oneShotBarrier();
  const a = new PostgresGomokuService(databaseUrl, { beforeCas: barrier.hook });
  const b = new PostgresGomokuService(databaseUrl);
  await Promise.all([a.ready, b.ready]);
  try {
    await a.createGame({ gameId: id, players: players() });
    const staleAttempt = a.move(id, "alice", { row: 0, column: 0, requestId: "stale-a" });
    await barrier.entered;
    let winner;
    try {
      winner = await b.move(id, "alice", { row: 0, column: 1, requestId: "winner-b" });
    } finally {
      barrier.release();
    }
    assert.equal(winner.revision, 1);
    await assert.rejects(staleAttempt, (error) => error.code === "GOMOKU_CONCURRENCY_CONFLICT" && error.status === 409);
    const current = await b.view(id, "alice");
    assert.equal(current.revision, 1);
    assert.equal(current.moves.length, 1);
    assert.equal(current.moves[0].requestId, "winner-b");
    assert.deepEqual([current.moves[0].row, current.moves[0].column], [0, 1]);
  } finally {
    barrier.release();
    await Promise.all([a.close(), b.close()]);
  }
});

test("P1-AUD3-04 PostgreSQL lost-response retry succeeds after stale CAS without duplicate mutation", { skip: !databaseUrl }, async () => {
  const id = gameId("retry");
  const barrier = oneShotBarrier();
  const a = new PostgresGomokuService(databaseUrl, { beforeCas: barrier.hook });
  const b = new PostgresGomokuService(databaseUrl);
  await Promise.all([a.ready, b.ready]);
  try {
    await a.createGame({ gameId: id, players: players() });
    const retrying = a.move(id, "alice", { row: 3, column: 3, requestId: "same-request" });
    await barrier.entered;
    let committed;
    try {
      committed = await b.move(id, "alice", { row: 3, column: 3, requestId: "same-request" });
    } finally {
      barrier.release();
    }
    const recoveredSuccess = await retrying;
    assert.equal(committed.revision, 1);
    assert.equal(recoveredSuccess.revision, 1);
    assert.equal(recoveredSuccess.moves.length, 1);
    assert.equal(recoveredSuccess.moves[0].requestId, "same-request");
  } finally {
    barrier.release();
    await Promise.all([a.close(), b.close()]);
  }
});

test("P1-AUD3-04 PostgreSQL concurrent create with same players is idempotent", { skip: !databaseUrl }, async () => {
  const id = gameId("create_same");
  const a = new PostgresGomokuService(databaseUrl);
  const b = new PostgresGomokuService(databaseUrl);
  await Promise.all([a.ready, b.ready]);
  try {
    const [first, second] = await Promise.all([
      a.createGame({ gameId: id, players: players() }),
      b.createGame({ gameId: id, players: players() }),
    ]);
    assert.equal(first.gameId, id);
    assert.equal(second.gameId, id);
    assert.equal(first.revision, 0);
    assert.equal(second.revision, 0);
    assert.equal((await a.view(id, "alice")).moves.length, 0);
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
});

test("P1-AUD3-04 PostgreSQL concurrent create with different players never overwrites existing game", { skip: !databaseUrl }, async () => {
  const id = gameId("create_conflict");
  const a = new PostgresGomokuService(databaseUrl);
  const b = new PostgresGomokuService(databaseUrl);
  await Promise.all([a.ready, b.ready]);
  try {
    const results = await Promise.allSettled([
      a.createGame({ gameId: id, players: players() }),
      b.createGame({ gameId: id, players: otherPlayers() }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.equal(rejected.reason.code, "GAME_ALREADY_EXISTS");
    const row = await admin.query("SELECT state, revision FROM gracz_gomoku_games WHERE game_id = $1", [id]);
    assert.equal(row.rows.length, 1);
    assert.equal(Number(row.rows[0].revision), 0);
    assert.equal(row.rows[0].state.moves.length, 0);
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
});

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

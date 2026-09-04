import assert from "node:assert/strict";
import test from "node:test";

import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameSession, sendChatMessage } from "../src/session.js";

const databaseUrl = process.env.P1_C_01_DATABASE_URL || process.env.DATABASE_URL;

test("P1-C-01 PostgreSQL CAS permits one winner, preserves newer state and supports retry", { skip: !databaseUrl }, async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const gameId = `p1c01_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const a = await store.getVersioned(gameId);
    const b = await store.getVersioned(gameId);
    assert.equal(a.version, 1);
    assert.equal(b.version, 1);

    await store.save(sendChatMessage(a.session, { playerId: "alice", text: "winner" }), a.version);
    await assert.rejects(
      store.save(sendChatMessage(b.session, { playerId: "bob", text: "stale" }), b.version),
      (error) => error?.code === "SESSION_CONCURRENCY_CONFLICT" && error?.status === 409,
    );

    const current = await store.getVersioned(gameId);
    assert.equal(current.version, 2);
    assert.deepEqual(current.session.messages.map((message) => message.text), ["winner"]);

    await store.save(sendChatMessage(current.session, { playerId: "bob", text: "retry" }), current.version);
    const final = await store.getVersioned(gameId);
    assert.equal(final.version, 3);
    assert.deepEqual(final.session.messages.map((message) => message.text), ["winner", "retry"]);
  } finally {
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await store.close();
  }
});

test("P1-C-01 PostgreSQL CAS keeps version stable for an exact idempotent no-op save", { skip: !databaseUrl }, async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const gameId = `p1c01_noop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const created = await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const before = await store.getVersioned(gameId);
    assert.equal(before.version, 1);

    const saved = await store.save(created, 1);
    const after = await store.getVersioned(gameId);
    assert.equal(after.version, 1);
    assert.equal(saved.gameId, gameId);
    assert.equal(after.session.events.length, before.session.events.length);
  } finally {
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await store.close();
  }
});

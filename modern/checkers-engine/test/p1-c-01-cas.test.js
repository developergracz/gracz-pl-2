import assert from "node:assert/strict";
import test from "node:test";

import { createGameHttpServer } from "../src/server.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import {
  createGameSession,
  disconnectPlayer,
  sendChatMessage,
} from "../src/session.js";

class ConflictStore {
  constructor(session) {
    this.session = session;
  }

  async get() {
    return this.session;
  }

  async save() {
    const error = new Error("stale session");
    error.code = "SESSION_CONCURRENCY_CONFLICT";
    error.status = 409;
    throw error;
  }
}

class RealtimeSpy {
  constructor() {
    this.published = 0;
  }
  publish() { this.published += 1; }
  subscribe() {}
  close() {}
}

async function withServer(store, realtime, callback) {
  const server = createGameHttpServer({ store, realtime });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function jsonRequest(url, { method = "GET", playerId, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(playerId ? { "x-player-id": playerId } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

const mutationCases = [
  {
    name: "move",
    path: "moves",
    playerId: "alice",
    body: { requestId: "p1-c-01-move", move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } },
  },
  { name: "chat", path: "chat", playerId: "alice", body: { text: "hello" } },
  { name: "action", path: "actions", playerId: "alice", body: { action: "resign" } },
  { name: "disconnect", path: "disconnect", playerId: "alice" },
];

for (const mutation of mutationCases) {
  test(`P1-C-01 HTTP ${mutation.name}: CAS conflict returns 409 and does not publish realtime`, async () => {
    const session = createGameSession({ gameId: `cas-${mutation.name}`, whitePlayerId: "alice", blackPlayerId: "bob" });
    const realtime = new RealtimeSpy();
    await withServer(new ConflictStore(session), realtime, async (baseUrl) => {
      const response = await jsonRequest(`${baseUrl}/games/${session.gameId}/${mutation.path}`, {
        method: "POST",
        playerId: mutation.playerId,
        body: mutation.body,
      });
      assert.equal(response.status, 409);
      assert.equal(response.body.error.code, "SESSION_CONCURRENCY_CONFLICT");
      assert.equal(realtime.published, 0);
    });
  });
}

test("P1-C-01 HTTP reconnect: CAS conflict returns 409 and does not publish realtime", async () => {
  const base = createGameSession({ gameId: "cas-reconnect", whitePlayerId: "alice", blackPlayerId: "bob" });
  const session = disconnectPlayer(base, "alice");
  const realtime = new RealtimeSpy();
  await withServer(new ConflictStore(session), realtime, async (baseUrl) => {
    const response = await jsonRequest(`${baseUrl}/games/${session.gameId}/reconnect`, {
      method: "POST",
      playerId: "alice",
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, "SESSION_CONCURRENCY_CONFLICT");
    assert.equal(realtime.published, 0);
  });
});

const databaseUrl = process.env.P1_C_01_DATABASE_URL || process.env.DATABASE_URL;

test("P1-C-01 PostgreSQL: exactly one stale concurrent write wins, version increments, retry succeeds", { skip: !databaseUrl }, async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const gameId = `p1c01_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const initial = createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" });
    await store.create(initial);

    const first = await store.getVersioned(gameId);
    const second = await store.getVersioned(gameId);
    assert.equal(first.version, 1);
    assert.equal(second.version, 1);

    const firstWrite = sendChatMessage(first.session, { playerId: "alice", text: "winner" });
    const staleWrite = sendChatMessage(second.session, { playerId: "bob", text: "stale" });

    const saved = await store.save(firstWrite, first.version);
    const afterWinner = await store.getVersioned(gameId);
    assert.equal(afterWinner.version, 2);
    assert.equal(afterWinner.session.messages.at(-1).text, "winner");

    await assert.rejects(
      store.save(staleWrite, second.version),
      (error) => error?.code === "SESSION_CONCURRENCY_CONFLICT" && error?.status === 409,
    );

    const afterConflict = await store.getVersioned(gameId);
    assert.equal(afterConflict.version, 2);
    assert.equal(afterConflict.session.messages.length, 1);
    assert.equal(afterConflict.session.messages[0].text, "winner");

    const retried = sendChatMessage(afterConflict.session, { playerId: "bob", text: "retry" });
    await store.save(retried, afterConflict.version);
    const final = await store.getVersioned(gameId);
    assert.equal(final.version, 3);
    assert.deepEqual(final.session.messages.map((message) => message.text), ["winner", "retry"]);
    assert.equal(saved.gameId, gameId);
  } finally {
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await store.close();
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { createGameHttpServer } from "../src/server.js";
import { createGameSession, disconnectPlayer } from "../src/session.js";

class ConflictStore {
  constructor(session) { this.session = session; }
  async get() { return this.session; }
  async save() {
    const error = new Error("stale session");
    error.code = "SESSION_CONCURRENCY_CONFLICT";
    error.status = 409;
    throw error;
  }
}

class RealtimeSpy {
  constructor() { this.published = 0; }
  publish() { this.published += 1; }
  subscribe() {}
  close() {}
}

async function withServer(store, realtime, callback) {
  const server = createGameHttpServer({ store, realtime });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

async function jsonRequest(url, { playerId, body } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-player-id": playerId,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

const cases = [
  ["moves", "alice", { requestId: "m1", move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } }],
  ["chat", "alice", { text: "hello" }],
  ["actions", "alice", { action: "resign" }],
  ["disconnect", "alice", undefined],
];

for (const [path, playerId, body] of cases) {
  test(`P1-C-01 ${path}: 409 and no realtime publish after CAS conflict`, async () => {
    const session = createGameSession({ gameId: `http-${path}`, whitePlayerId: "alice", blackPlayerId: "bob" });
    const realtime = new RealtimeSpy();
    await withServer(new ConflictStore(session), realtime, async (baseUrl) => {
      const result = await jsonRequest(`${baseUrl}/games/${session.gameId}/${path}`, { playerId, body });
      assert.equal(result.status, 409);
      assert.equal(result.body.error.code, "SESSION_CONCURRENCY_CONFLICT");
      assert.equal(realtime.published, 0);
    });
  });
}

test("P1-C-01 reconnect: 409 and no realtime publish after CAS conflict", async () => {
  const session = disconnectPlayer(createGameSession({ gameId: "http-reconnect", whitePlayerId: "alice", blackPlayerId: "bob" }), "alice");
  const realtime = new RealtimeSpy();
  await withServer(new ConflictStore(session), realtime, async (baseUrl) => {
    const result = await jsonRequest(`${baseUrl}/games/${session.gameId}/reconnect`, { playerId: "alice" });
    assert.equal(result.status, 409);
    assert.equal(result.body.error.code, "SESSION_CONCURRENCY_CONFLICT");
    assert.equal(realtime.published, 0);
  });
});

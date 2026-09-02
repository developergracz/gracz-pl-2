import assert from "node:assert/strict";
import test from "node:test";

import { createGameHttpServer } from "../src/server.js";
import { MemorySessionStore } from "../src/store.js";

async function withServer(callback) {
  const server = createGameHttpServer({ store: new MemorySessionStore() });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

async function jsonRequest(url, { method = "GET", playerId, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { ...(playerId ? { "x-player-id": playerId } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test("P1-C-01 does not change successful move response contract", async () => {
  await withServer(async (baseUrl) => {
    const created = await jsonRequest(`${baseUrl}/games`, {
      method: "POST",
      body: { gameId: "p1-success", whitePlayerId: "alice", blackPlayerId: "bob" },
    });
    assert.equal(created.status, 201);
    const move = await jsonRequest(`${baseUrl}/games/p1-success/moves`, {
      method: "POST",
      playerId: "alice",
      body: { requestId: "m1", move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } },
    });
    assert.equal(move.status, 200);
    assert.equal(typeof move.body.duplicate, "boolean");
    assert.equal(typeof move.body.eventSequence, "number");
    assert.equal(move.body.snapshot.game.turn, "black");
  });
});

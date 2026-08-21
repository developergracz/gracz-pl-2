import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createGameHttpServer } from "../src/server.js";
import { FileSessionStore, MemorySessionStore } from "../src/store.js";

async function withServer(store, callback) {
  const server = createGameHttpServer({ store });
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
    headers: { ...(playerId ? { "x-player-id": playerId } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test("two real HTTP clients create a game and exchange turns", async () => {
  await withServer(new MemorySessionStore(), async (baseUrl) => {
    const created = await jsonRequest(`${baseUrl}/games`, {
      method: "POST",
      body: { gameId: "game-http", whitePlayerId: "alice", blackPlayerId: "bob" },
    });
    assert.equal(created.status, 201);

    const aliceMove = await jsonRequest(`${baseUrl}/games/game-http/moves`, {
      method: "POST", playerId: "alice",
      body: { requestId: "a1", move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } },
    });
    assert.equal(aliceMove.status, 200);
    assert.equal(aliceMove.body.snapshot.game.turn, "black");

    const bobMove = await jsonRequest(`${baseUrl}/games/game-http/moves`, {
      method: "POST", playerId: "bob",
      body: { requestId: "b1", move: { from: { row: 5, column: 0 }, to: { row: 4, column: 1 } } },
    });
    assert.equal(bobMove.status, 200);
    assert.equal(bobMove.body.snapshot.game.turn, "white");
  });
});

test("API rejects missing identity and out-of-turn client", async () => {
  await withServer(new MemorySessionStore(), async (baseUrl) => {
    await jsonRequest(`${baseUrl}/games`, {
      method: "POST",
      body: { gameId: "secured", whitePlayerId: "alice", blackPlayerId: "bob" },
    });
    assert.equal((await jsonRequest(`${baseUrl}/games/secured`)).status, 401);
    const wrongTurn = await jsonRequest(`${baseUrl}/games/secured/moves`, {
      method: "POST", playerId: "bob", body: { requestId: "b1", move: { from: { row: 5, column: 0 }, to: { row: 4, column: 1 } } },
    });
    assert.equal(wrongTurn.status, 400);
    assert.equal(wrongTurn.body.error.code, "OUT_OF_TURN");
  });
});

test("disconnect and reconnect return current server snapshot", async () => {
  await withServer(new MemorySessionStore(), async (baseUrl) => {
    await jsonRequest(`${baseUrl}/games`, {
      method: "POST", body: { gameId: "reconnect", whitePlayerId: "alice", blackPlayerId: "bob" },
    });
    await jsonRequest(`${baseUrl}/games/reconnect/disconnect`, { method: "POST", playerId: "alice" });
    const restored = await jsonRequest(`${baseUrl}/games/reconnect/reconnect`, { method: "POST", playerId: "alice" });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.players.white.connected, true);
    assert.equal(restored.body.game.turn, "white");
  });
});

test("file store persists private session JSON and restores it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gracz-sessions-"));
  const store = new FileSessionStore(directory);
  await withServer(store, async (baseUrl) => {
    await jsonRequest(`${baseUrl}/games`, {
      method: "POST", body: { gameId: "durable", whitePlayerId: "alice", blackPlayerId: "bob" },
    });
    await jsonRequest(`${baseUrl}/games/durable/moves`, {
      method: "POST", playerId: "alice",
      body: { requestId: "a1", move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } },
    });
  });
  const raw = await readFile(join(directory, "durable.json"), "utf8");
  assert.equal(JSON.parse(raw).game.turn, "black");
  assert.equal((await store.get("durable")).events.length, 2);
});

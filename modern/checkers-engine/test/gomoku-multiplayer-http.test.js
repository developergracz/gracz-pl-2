import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { AuthService } from "../src/auth.js";
import { createGomokuHttpHandler } from "../src/gomoku-http.js";
import { GomokuService } from "../src/gomoku-service.js";

const secret = "a-secure-gomoku-test-secret-with-at-least-32-characters";

async function fixture() {
  const auth = new AuthService({ secret });
  const service = new GomokuService();
  service.createGame({ gameId: "gomoku-http", players: [{ userId: "alice", displayName: "Alicja" }, { userId: "bob", displayName: "Robert" }] });
  const handler = createGomokuHttpHandler({ service, auth });
  const server = createServer(async (request, response) => {
    if (!await handler(request, response)) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    token(userId, displayName) { return auth.issue({ userId, displayName }); },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function request(game, path, token, options = {}) {
  const response = await fetch(`${game.baseUrl}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) },
  });
  return { status: response.status, body: await response.json() };
}

test("two authenticated HTTP clients see the same Gomoku state and alternate moves", async () => {
  const game = await fixture();
  try {
    const alice = game.token("alice", "Alicja"), bob = game.token("bob", "Robert");
    let result = await request(game, "/gomoku/games/gomoku-http/moves", alice, { method: "POST", body: JSON.stringify({ row: 7, column: 7, requestId: "alice-1" }) });
    assert.equal(result.status, 200);
    assert.equal(result.body.revision, 1);
    result = await request(game, "/gomoku/games/gomoku-http", bob);
    assert.equal(result.body.moves.length, 1);
    assert.equal(result.body.canMove, true);
    result = await request(game, "/gomoku/games/gomoku-http/moves", bob, { method: "POST", body: JSON.stringify({ row: 7, column: 8, requestId: "bob-1" }) });
    assert.equal(result.status, 200);
    assert.equal(result.body.revision, 2);
    const aliceView = await request(game, "/gomoku/games/gomoku-http", alice);
    assert.deepEqual(aliceView.body.moves.map(({ row, column, color }) => [row, column, color]), [[7, 7, "black"], [7, 8, "white"]]);
    assert.equal(aliceView.body.canMove, true);
  } finally { await game.close(); }
});

test("Gomoku HTTP move retry is idempotent", async () => {
  const game = await fixture();
  try {
    const alice = game.token("alice", "Alicja");
    const options = { method: "POST", body: JSON.stringify({ row: 7, column: 7, requestId: "stable-request" }) };
    assert.equal((await request(game, "/gomoku/games/gomoku-http/moves", alice, options)).status, 200);
    const repeated = await request(game, "/gomoku/games/gomoku-http/moves", alice, options);
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.moves.length, 1);
    assert.equal(repeated.body.revision, 1);
  } finally { await game.close(); }
});

test("Gomoku HTTP protects private games and rejects invalid or cross-site moves", async () => {
  const game = await fixture();
  try {
    const alice = game.token("alice", "Alicja"), bob = game.token("bob", "Robert"), outsider = game.token("mallory", "Obcy");
    assert.equal((await request(game, "/gomoku/games/gomoku-http", outsider)).status, 403);
    assert.equal((await request(game, "/gomoku/games/gomoku-http/moves", bob, { method: "POST", body: JSON.stringify({ row: 1, column: 1 }) })).status, 409);
    assert.equal((await request(game, "/gomoku/games/gomoku-http/moves", alice, { method: "POST", body: JSON.stringify({ row: 99, column: 1 }) })).status, 400);
    const crossSite = await request(game, "/gomoku/games/gomoku-http/moves", alice, { method: "POST", headers: { "sec-fetch-site": "cross-site" }, body: JSON.stringify({ row: 1, column: 1 }) });
    assert.equal(crossSite.status, 403);
    assert.equal(crossSite.body.error.code, "CROSS_SITE_REQUEST");
  } finally { await game.close(); }
});

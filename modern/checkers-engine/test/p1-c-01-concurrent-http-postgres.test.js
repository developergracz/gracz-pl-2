import assert from "node:assert/strict";
import test from "node:test";

import { createGameHttpServer } from "../src/server.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";

const databaseUrl = process.env.P1_C_01_DATABASE_URL || process.env.DATABASE_URL;

async function withServer(store, callback) {
  const server = createGameHttpServer({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

async function request(url, { playerId, body } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "x-player-id": playerId, "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return { status: response.status, body: await response.json() };
}

test("P1-C-01 real PostgreSQL concurrent HTTP mutations yield one winner and one 409", { skip: !databaseUrl }, async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const gameId = `p1c01_http_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await withServer(store, async (baseUrl) => {
      const created = await request(`${baseUrl}/games`, {
        playerId: "alice",
        body: { gameId, whitePlayerId: "alice", blackPlayerId: "bob" },
      });
      assert.equal(created.status, 201);

      const [alice, bob] = await Promise.all([
        request(`${baseUrl}/games/${gameId}/chat`, { playerId: "alice", body: { text: "alice" } }),
        request(`${baseUrl}/games/${gameId}/chat`, { playerId: "bob", body: { text: "bob" } }),
      ]);

      const statuses = [alice.status, bob.status].sort((a, b) => a - b);
      assert.deepEqual(statuses, [201, 409]);
      const conflict = alice.status === 409 ? alice : bob;
      assert.equal(conflict.body.error.code, "SESSION_CONCURRENCY_CONFLICT");

      const current = await store.getVersioned(gameId);
      assert.equal(current.version, 2);
      assert.equal(current.session.messages.length, 1);
      assert.ok(["alice", "bob"].includes(current.session.messages[0].text));
    });
  } finally {
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await store.close();
  }
});

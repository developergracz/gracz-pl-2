import assert from "node:assert/strict";
import test from "node:test";

import { createGameHttpServer } from "../src/server.js";
import { createGameSession } from "../src/session.js";

class VersionedMemoryStore {
  constructor() {
    this.session = null;
    this.version = 0;
  }
  async create(session) { this.session = session; this.version = 1; return session; }
  async get() { return Object.freeze({ ...this.session, __testVersion: this.version }); }
  async save(session) {
    const expected = session.__testVersion;
    if (expected !== this.version) {
      const error = new Error("stale");
      error.code = "SESSION_CONCURRENCY_CONFLICT";
      error.status = 409;
      throw error;
    }
    this.version += 1;
    this.session = Object.freeze({ ...session, __testVersion: this.version });
    return this.session;
  }
}

async function withServer(store, callback) {
  const server = createGameHttpServer({ store });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  return { status: response.status, body: await response.json() };
}

test("HTTP mutation path preserves store concurrency metadata", async () => {
  const store = new VersionedMemoryStore();
  await store.create(createGameSession({ gameId: "meta", whitePlayerId: "alice", blackPlayerId: "bob" }));
  await withServer(store, async (base) => {
    const result = await request(`${base}/games/meta/moves`, {
      method: "POST",
      headers: { "x-player-id": "alice", "content-type": "application/json" },
      body: JSON.stringify({ requestId: "m1", move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } }),
    });
    assert.equal(result.status, 200);
    assert.equal(store.version, 2);
  });
});

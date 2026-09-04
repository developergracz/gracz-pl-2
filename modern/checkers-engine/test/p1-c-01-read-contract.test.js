import assert from "node:assert/strict";
import test from "node:test";

import { createGameSession } from "../src/session.js";
import { MemorySessionStore } from "../src/store.js";

test("P1-C-01 leaves non-PostgreSQL store contract unchanged", async () => {
  const store = new MemorySessionStore();
  const session = createGameSession({ gameId: "memory-contract", whitePlayerId: "alice", blackPlayerId: "bob" });
  await store.create(session);
  assert.equal((await store.get("memory-contract")).gameId, "memory-contract");
});

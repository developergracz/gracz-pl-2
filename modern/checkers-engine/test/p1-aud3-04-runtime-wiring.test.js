import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LobbyService } from "../src/lobby.js";
import { MemorySessionStore } from "../src/store.js";

test("P1-AUD3-04 runtime selects PostgresGomokuService when DATABASE_URL exists", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(main, /import \{ PostgresGomokuService \} from "\.\/postgres-gomoku-service\.js";/);
  assert.match(main, /config\.databaseUrl\?new PostgresGomokuService\(config\.databaseUrl\):new GomokuService\(\)/);
  assert.match(main, /typeof gomokuService\.close===\"function\"/);
});

test("P1-AUD3-04 lobby awaits durable Gomoku creation and rolls back on persistence failure", async () => {
  const gomokuService = {
    async createGame() { throw new Error("database unavailable"); },
  };
  const lobby = new LobbyService({ sessionStore: new MemorySessionStore(), gomokuService, idGenerator: (() => { let n = 0; return () => `room-${++n}`; })() });
  lobby.touchUser({ userId: "alice", displayName: "Alice" });
  lobby.touchUser({ userId: "bob", displayName: "Bob" });
  const room = lobby.createRoom({ ownerId: "alice", ownerName: "Alice", gameType: "gomoku" });

  await assert.rejects(
    lobby.joinRoom({ roomId: room.roomId, playerId: "bob", playerName: "Bob" }),
    /database unavailable/,
  );

  const after = lobby.listRooms().find((candidate) => candidate.roomId === room.roomId);
  assert.equal(after.status, "waiting");
  assert.equal(after.filledSeats, 1);
  assert.equal(after.gameId, null);
});

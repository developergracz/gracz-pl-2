import assert from "node:assert/strict";
import test from "node:test";

import { getLegalMoves } from "../src/index.js";
import { MatchRuntime } from "../src/match-runtime.js";
import { createCheckersMatchRuntimeAdapter } from "../src/checkers-match-runtime-adapter.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameSession } from "../src/session.js";

const databaseUrl = process.env.P1_U_02_DATABASE_URL || "";
const requirePostgres = process.env.P1_U_02_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("P1_U_02_DATABASE_URL is required.");
const pgTest = databaseUrl ? test : test.skip;

pgTest("P1-U-02 Checkers reference path executes through common Match Runtime", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const gameId = `p7_checkers_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const publications = [];
  try {
    await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const before = await store.getVersioned(gameId);
    const move = getLegalMoves(before.session.game)[0];
    assert.ok(move);

    const runtime = new MatchRuntime({
      repository: store,
      engine: createCheckersMatchRuntimeAdapter(),
      ownerId: "checkers-reference",
      publish: async ({ matchId, eventType, version }) => {
        publications.push({ eventType, version, gameId: matchId });
      },
    });

    const result = await runtime.executeCommand({
      matchId: gameId,
      expectedVersion: before.version,
      idempotencyKey: "checkers-move-1",
      command: {
        type: "move",
        playerId: "alice",
        requestId: "checkers-move-1",
        move,
      },
      viewerId: "alice",
    });

    assert.equal(result.version, 2);
    assert.equal(result.snapshot.gameId, gameId);
    assert.equal(result.snapshot.lastEventSequence, 2);
    assert.equal("state" in result, false);
    assert.deepEqual(publications, [{ eventType: "game.updated", version: 2, gameId }]);

    const persisted = await store.getVersioned(gameId);
    assert.equal(persisted.version, 2);
    assert.equal(persisted.session.events.at(-1)?.type, "move.accepted");
  } finally {
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await store.close();
  }
});

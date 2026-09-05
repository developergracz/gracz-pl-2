import assert from "node:assert/strict";
import test from "node:test";

import { getLegalMoves } from "../src/index.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameHttpServer } from "../src/server-p7.js";
import { createGameSession, getSessionSnapshot } from "../src/session.js";
import { TrafficGuard } from "../src/traffic-guard.js";

const databaseUrl = process.env.P1_U_02_DATABASE_URL || "";
const requirePostgres = process.env.P1_U_02_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("P1_U_02_DATABASE_URL is required.");
const pgTest = databaseUrl ? test : test.skip;

class RecordingRealtime {
  constructor() { this.publications = []; }
  async publish(signal, type) {
    this.publications.push({ signal: structuredClone(signal), type });
    return true;
  }
  subscribe() {}
  close() {}
}

async function withServer(store, realtime, callback) {
  const server = createGameHttpServer({ store, realtime, trafficGuard: new TrafficGuard() });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

async function moveRequest(baseUrl, gameId, playerId, requestId, move) {
  const response = await fetch(`${baseUrl}/games/${gameId}/moves`, {
    method: "POST",
    headers: { "x-player-id": playerId, "content-type": "application/json" },
    body: JSON.stringify({ requestId, move }),
  });
  return { status: response.status, body: await response.json() };
}

pgTest("P7-F03 durable replay preserves original event sequence but returns current authoritative projection", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const realtime = new RecordingRealtime();
  const gameId = `p7f03_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));

    await withServer(store, realtime, async (baseUrl) => {
      const initial = await store.getVersioned(gameId);
      const moveA = getLegalMoves(initial.session.game)[0];
      const first = await moveRequest(baseUrl, gameId, "alice", "request-R", moveA);

      assert.equal(first.status, 200);
      assert.equal(first.body.duplicate, false);
      const originalSequence = first.body.eventSequence;
      assert.equal(originalSequence, 2);

      const afterA = await store.getVersioned(gameId);
      assert.equal(afterA.version, 2);
      const moveB = getLegalMoves(afterA.session.game)[0];
      const advance = await moveRequest(baseUrl, gameId, "bob", "advance-B", moveB);

      assert.equal(advance.status, 200);
      assert.equal(advance.body.duplicate, false);

      const currentBeforeReplay = await store.getVersioned(gameId);
      assert.equal(currentBeforeReplay.version, 3);
      const expectedCurrentSnapshot = getSessionSnapshot(currentBeforeReplay.session, "alice");
      const currentSequence = currentBeforeReplay.session.events.at(-1).sequence;
      const moveCountBeforeReplay = currentBeforeReplay.session.events.filter((event) => event.type === "move.accepted").length;
      const publicationsBeforeReplay = realtime.publications.length;

      assert.equal(currentSequence, 3);
      assert.equal(moveCountBeforeReplay, 2);
      assert.equal(publicationsBeforeReplay, 2);
      assert.notDeepEqual(expectedCurrentSnapshot.game, first.body.snapshot.game);

      const replay = await moveRequest(baseUrl, gameId, "alice", "request-R", moveA);

      assert.equal(replay.status, 200);
      assert.equal(replay.body.duplicate, true);
      assert.equal(replay.body.eventSequence, originalSequence);
      assert.equal(replay.body.snapshot.lastEventSequence, currentSequence);
      assert.deepEqual(replay.body.snapshot, expectedCurrentSnapshot);
      assert.equal(replay.body.snapshot.processedRequests, undefined);
      assert.equal(replay.body.snapshot.events, undefined);

      const afterReplay = await store.getVersioned(gameId);
      assert.equal(afterReplay.version, currentBeforeReplay.version);
      assert.equal(afterReplay.session.events.filter((event) => event.type === "move.accepted").length, moveCountBeforeReplay);
      assert.equal(realtime.publications.length, publicationsBeforeReplay);

      const commands = await store.pool.query(
        "SELECT COUNT(*)::int AS count FROM gracz_match_runtime_commands WHERE match_id = $1",
        [gameId],
      );
      assert.equal(commands.rows[0].count, 2);
    });
  } finally {
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await store.close();
  }
});

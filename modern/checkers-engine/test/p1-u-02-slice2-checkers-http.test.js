import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getLegalMoves } from "../src/index.js";
import { createGameHttpServer } from "../src/server-p7.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameSession, submitMove } from "../src/session.js";
import { FileSessionStore } from "../src/store.js";
import { TrafficGuard } from "../src/traffic-guard.js";

const databaseUrl = process.env.P1_U_02_DATABASE_URL || "";
const requirePostgres = process.env.P1_U_02_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("P1_U_02_DATABASE_URL is required.");
const pgTest = databaseUrl ? test : test.skip;

class RecordingRealtime {
  constructor({ fail = false } = {}) {
    this.fail = fail;
    this.publications = [];
  }
  async publish(signal, type) {
    this.publications.push({ signal: structuredClone(signal), type });
    if (this.fail) throw new Error("synthetic realtime failure");
    return true;
  }
  subscribe() {}
  close() {}
}

class DelegatingRuntimeStore {
  constructor(store) { this.store = store; }
  get pool() { return this.store.pool; }
  get ready() { return this.store.ready; }
  create(...args) { return this.store.create(...args); }
  get(...args) { return this.store.get(...args); }
  getVersioned(...args) { return this.store.getVersioned(...args); }
  save(...args) { return this.store.save(...args); }
  loadMatchRuntime(...args) { return this.store.loadMatchRuntime(...args); }
  claimMatchOwnership(...args) { return this.store.claimMatchOwnership(...args); }
  executeMatchRuntimeCommand(...args) { return this.store.executeMatchRuntimeCommand(...args); }
}

class BarrierRuntimeStore extends DelegatingRuntimeStore {
  constructor(store, gameId) {
    super(store);
    this.gameId = gameId;
    this.waiting = 0;
    this.release = null;
    this.gate = new Promise((resolve) => { this.release = resolve; });
  }
  async loadMatchRuntime(gameId) {
    const loaded = await this.store.loadMatchRuntime(gameId);
    if (gameId !== this.gameId) return loaded;
    this.waiting += 1;
    if (this.waiting === 2) this.release();
    await this.gate;
    return loaded;
  }
}

class FailingPersistenceStore extends DelegatingRuntimeStore {
  async executeMatchRuntimeCommand() {
    throw new Error("synthetic persistence failure");
  }
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
    body: JSON.stringify({ requestId, move, playerId: "mallory" }),
  });
  return { status: response.status, body: await response.json() };
}

async function cleanup(store, gameId) {
  await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
}

pgTest("P7 Slice 2 public Checkers move uses MatchRuntime, preserves response/projection and signal-only publication", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const realtime = new RecordingRealtime();
  const gameId = `p7s2_success_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const initial = { ...createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }), privateState: { secret: "hidden" } };
  try {
    await store.create(initial);
    const before = await store.getVersioned(gameId);
    const move = getLegalMoves(before.session.game)[0];
    await withServer(store, realtime, async (baseUrl) => {
      const result = await moveRequest(baseUrl, gameId, "alice", "move-1", move);
      assert.equal(result.status, 200);
      assert.deepEqual(Object.keys(result.body).sort(), ["duplicate", "eventSequence", "snapshot"]);
      assert.equal(result.body.duplicate, false);
      assert.equal(result.body.eventSequence, 2);
      assert.equal(result.body.snapshot.gameId, gameId);
      assert.equal(result.body.snapshot.color, "white");
      assert.equal(result.body.snapshot.privateState, undefined);
      assert.equal(result.body.snapshot.processedRequests, undefined);
      assert.equal(result.body.snapshot.events, undefined);
    });
    const persisted = await store.getVersioned(gameId);
    assert.equal(persisted.version, 2);
    assert.equal(persisted.session.privateState.secret, "hidden");
    assert.equal(realtime.publications.length, 1);
    assert.deepEqual(realtime.publications[0], { signal: { gameId }, type: "game.updated" });
    assert.equal("state" in realtime.publications[0].signal, false);
    assert.equal("command" in realtime.publications[0].signal, false);
    assert.equal("snapshot" in realtime.publications[0].signal, false);
  } finally {
    await cleanup(store, gameId);
    await store.close();
  }
});

pgTest("P7 Slice 2 same-player retry is durable replay with no version bump or republish", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const realtime = new RecordingRealtime();
  const gameId = `p7s2_retry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const move = getLegalMoves((await store.getVersioned(gameId)).session.game)[0];
    await withServer(store, realtime, async (baseUrl) => {
      const first = await moveRequest(baseUrl, gameId, "alice", "same-request", move);
      const replay = await moveRequest(baseUrl, gameId, "alice", "same-request", move);
      assert.equal(first.status, 200);
      assert.equal(first.body.duplicate, false);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.duplicate, true);
      assert.equal(replay.body.eventSequence, first.body.eventSequence);
      assert.deepEqual(replay.body.snapshot, first.body.snapshot);
    });
    const persisted = await store.getVersioned(gameId);
    assert.equal(persisted.version, 2);
    assert.equal(persisted.session.events.filter((event) => event.type === "move.accepted").length, 1);
    assert.equal(realtime.publications.length, 1);
    const commands = await store.pool.query("SELECT COUNT(*)::int AS count FROM gracz_match_runtime_commands WHERE match_id = $1", [gameId]);
    assert.equal(commands.rows[0].count, 1);
  } finally {
    await cleanup(store, gameId);
    await store.close();
  }
});

pgTest("P7 Slice 2 same requestId for different players does not collide and runtime stays long-lived", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const realtime = new RecordingRealtime();
  const gameId = `p7s2_scope_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    await withServer(store, realtime, async (baseUrl) => {
      const aliceMove = getLegalMoves((await store.getVersioned(gameId)).session.game)[0];
      const alice = await moveRequest(baseUrl, gameId, "alice", "shared-id", aliceMove);
      assert.equal(alice.status, 200);
      const bobMove = getLegalMoves((await store.getVersioned(gameId)).session.game)[0];
      const bob = await moveRequest(baseUrl, gameId, "bob", "shared-id", bobMove);
      assert.equal(bob.status, 200);
      assert.equal(bob.body.duplicate, false);
    });
    const commands = await store.pool.query("SELECT COUNT(*)::int AS count, COUNT(DISTINCT idempotency_key)::int AS keys FROM gracz_match_runtime_commands WHERE match_id = $1", [gameId]);
    assert.equal(commands.rows[0].count, 2);
    assert.equal(commands.rows[0].keys, 2);
    const ownership = await store.pool.query("SELECT ownership_epoch FROM gracz_match_runtime_ownership WHERE match_id = $1", [gameId]);
    assert.equal(Number(ownership.rows[0].ownership_epoch), 1);
    assert.equal((await store.getVersioned(gameId)).version, 3);
  } finally {
    await cleanup(store, gameId);
    await store.close();
  }
});

pgTest("P7 Slice 2 legacy pre-cutover processedRequests retry does not mutate, bump version or publish", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const realtime = new RecordingRealtime();
  const gameId = `p7s2_legacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const requestId = "legacy-request";
  try {
    await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const before = await store.getVersioned(gameId);
    const move = getLegalMoves(before.session.game)[0];
    const legacy = submitMove(before.session, { playerId: "alice", requestId, move });
    await store.save(legacy.session, before.version);
    const commandsBefore = await store.pool.query("SELECT COUNT(*)::int AS count FROM gracz_match_runtime_commands WHERE match_id = $1", [gameId]);
    assert.equal(commandsBefore.rows[0].count, 0);

    await withServer(store, realtime, async (baseUrl) => {
      const replay = await moveRequest(baseUrl, gameId, "alice", requestId, move);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.duplicate, true);
      assert.equal(replay.body.eventSequence, legacy.event.sequence);
    });

    const after = await store.getVersioned(gameId);
    assert.equal(after.version, 2);
    assert.equal(after.session.events.filter((event) => event.type === "move.accepted").length, 1);
    assert.equal(realtime.publications.length, 0);
    const commandsAfter = await store.pool.query("SELECT COUNT(*)::int AS count FROM gracz_match_runtime_commands WHERE match_id = $1", [gameId]);
    assert.equal(commandsAfter.rows[0].count, 0);
  } finally {
    await cleanup(store, gameId);
    await store.close();
  }
});

pgTest("P7 Slice 2 concurrent public writers from one authoritative version yield one success and one 409", async () => {
  const realStore = new PostgresSessionStore(databaseUrl);
  const realtime = new RecordingRealtime();
  const gameId = `p7s2_concurrent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await realStore.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const initial = await realStore.getVersioned(gameId);
    const moves = getLegalMoves(initial.session.game);
    assert.ok(moves.length >= 2);
    const store = new BarrierRuntimeStore(realStore, gameId);
    await withServer(store, realtime, async (baseUrl) => {
      const [a, b] = await Promise.all([
        moveRequest(baseUrl, gameId, "alice", "concurrent-a", moves[0]),
        moveRequest(baseUrl, gameId, "alice", "concurrent-b", moves[1]),
      ]);
      assert.deepEqual([a.status, b.status].sort((x, y) => x - y), [200, 409]);
      const conflict = a.status === 409 ? a : b;
      assert.ok(["MATCH_RUNTIME_VERSION_CONFLICT", "MATCH_RUNTIME_STALE_OWNERSHIP"].includes(conflict.body.error.code));
    });
    const after = await realStore.getVersioned(gameId);
    assert.equal(after.version, 2);
    assert.equal(after.session.events.filter((event) => event.type === "move.accepted").length, 1);
    assert.equal(realtime.publications.length, 1);
    const commands = await realStore.pool.query("SELECT COUNT(*)::int AS count FROM gracz_match_runtime_commands WHERE match_id = $1", [gameId]);
    assert.equal(commands.rows[0].count, 1);
  } finally {
    await cleanup(realStore, gameId);
    await realStore.close();
  }
});

pgTest("P7 Slice 2 persistence failure never publishes", async () => {
  const realStore = new PostgresSessionStore(databaseUrl);
  const realtime = new RecordingRealtime();
  const gameId = `p7s2_persist_fail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await realStore.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const move = getLegalMoves((await realStore.getVersioned(gameId)).session.game)[0];
    await withServer(new FailingPersistenceStore(realStore), realtime, async (baseUrl) => {
      const result = await moveRequest(baseUrl, gameId, "alice", "fail-persist", move);
      assert.equal(result.status, 500);
    });
    assert.equal((await realStore.getVersioned(gameId)).version, 1);
    assert.equal(realtime.publications.length, 0);
  } finally {
    await cleanup(realStore, gameId);
    await realStore.close();
  }
});

pgTest("P7 Slice 2 realtime failure after commit does not roll back HTTP or PostgreSQL state", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const realtime = new RecordingRealtime({ fail: true });
  const gameId = `p7s2_rt_fail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const move = getLegalMoves((await store.getVersioned(gameId)).session.game)[0];
    await withServer(store, realtime, async (baseUrl) => {
      const result = await moveRequest(baseUrl, gameId, "alice", "rt-fail", move);
      assert.equal(result.status, 200);
      assert.equal(result.body.duplicate, false);
    });
    const after = await store.getVersioned(gameId);
    assert.equal(after.version, 2);
    assert.equal(after.session.events.at(-1)?.type, "move.accepted");
    assert.equal(realtime.publications.length, 1);
  } finally {
    await cleanup(store, gameId);
    await store.close();
  }
});

test("P7 Slice 2 FileSessionStore keeps the safe legacy development move path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gracz-p7-file-"));
  const store = new FileSessionStore(directory);
  const realtime = new RecordingRealtime();
  const gameId = `p7_file_${Date.now()}`;
  try {
    await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
    const session = await store.get(gameId);
    const move = getLegalMoves(session.game)[0];
    await withServer(store, realtime, async (baseUrl) => {
      const result = await moveRequest(baseUrl, gameId, "alice", "file-move", move);
      assert.equal(result.status, 200);
      assert.equal(result.body.duplicate, false);
      assert.equal(result.body.eventSequence, 2);
    });
    assert.equal((await store.get(gameId)).events.at(-1)?.type, "move.accepted");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

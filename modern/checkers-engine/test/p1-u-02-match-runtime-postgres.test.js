import assert from "node:assert/strict";
import test from "node:test";

import { MatchRuntime } from "../src/match-runtime.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameSession, sendChatMessage } from "../src/session.js";

const databaseUrl = process.env.P1_U_02_DATABASE_URL || "";
const requirePostgres = process.env.P1_U_02_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("P1_U_02_DATABASE_URL is required.");
const pgTest = databaseUrl ? test : test.skip;

function chatEngine(counter = null) {
  return {
    applyCommand({ state, command }) {
      if (counter) counter.calls += 1;
      if (command.type !== "chat") throw new TypeError("Unsupported test command.");
      return sendChatMessage(state, { playerId: command.playerId, text: command.text });
    },
    project(state, viewerId) {
      return { gameId: state.gameId, viewerId, messages: state.messages.map((message) => message.text) };
    },
    eventType() { return "game.updated"; },
  };
}

async function fixture(name) {
  const store = new PostgresSessionStore(databaseUrl);
  const gameId = `p7_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await store.create(createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }));
  return { store, gameId };
}

async function cleanup(store, gameId) {
  await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
  await store.close();
}

pgTest("P1-U-02 successful command increments version and persists before publish", async () => {
  const { store, gameId } = await fixture("success");
  const publications = [];
  const runtime = new MatchRuntime({
    repository: store,
    engine: chatEngine(),
    ownerId: "runtime-success",
    publish: async ({ version }) => {
      const current = await store.getVersioned(gameId);
      publications.push({ version, persistedVersion: current.version, text: current.session.messages.at(-1)?.text });
    },
  });
  try {
    const result = await runtime.executeCommand({
      matchId: gameId,
      expectedVersion: 1,
      idempotencyKey: "cmd-1",
      command: { type: "chat", playerId: "alice", text: "first" },
      viewerId: "alice",
    });
    assert.equal(result.version, 2);
    assert.equal(result.replayed, false);
    assert.deepEqual(result.snapshot.messages, ["first"]);
    assert.deepEqual(publications, [{ version: 2, persistedVersion: 2, text: "first" }]);
  } finally {
    await cleanup(store, gameId);
  }
});

pgTest("P1-U-02 stale expectedVersion is rejected and does not publish", async () => {
  const { store, gameId } = await fixture("version");
  let published = 0;
  const runtime = new MatchRuntime({ repository: store, engine: chatEngine(), ownerId: "runtime-version", publish: async () => { published += 1; } });
  try {
    await runtime.executeCommand({ matchId: gameId, expectedVersion: 1, idempotencyKey: "v1", command: { type: "chat", playerId: "alice", text: "winner" } });
    await assert.rejects(
      runtime.executeCommand({ matchId: gameId, expectedVersion: 1, idempotencyKey: "v2", command: { type: "chat", playerId: "bob", text: "stale" } }),
      (error) => error?.code === "MATCH_RUNTIME_VERSION_CONFLICT" && error?.status === 409,
    );
    assert.equal(published, 1);
    assert.equal((await store.getVersioned(gameId)).version, 2);
  } finally {
    await cleanup(store, gameId);
  }
});

pgTest("P1-U-02 stale ownershipEpoch is fenced after a new owner claims the match", async () => {
  const { store, gameId } = await fixture("fence");
  const oldRuntime = new MatchRuntime({ repository: store, engine: chatEngine(), ownerId: "runtime-old" });
  const newRuntime = new MatchRuntime({ repository: store, engine: chatEngine(), ownerId: "runtime-new" });
  try {
    const oldEpoch = await oldRuntime.claimOwnership(gameId);
    const newEpoch = await newRuntime.claimOwnership(gameId);
    assert.ok(newEpoch > oldEpoch);
    await assert.rejects(
      oldRuntime.executeCommand({ matchId: gameId, expectedVersion: 1, idempotencyKey: "old", ownershipEpoch: oldEpoch, command: { type: "chat", playerId: "alice", text: "stale-owner" } }),
      (error) => error?.code === "MATCH_RUNTIME_STALE_OWNERSHIP" && error?.status === 409,
    );
    const committed = await newRuntime.executeCommand({ matchId: gameId, expectedVersion: 1, idempotencyKey: "new", ownershipEpoch: newEpoch, command: { type: "chat", playerId: "alice", text: "new-owner" } });
    assert.equal(committed.version, 2);
  } finally {
    await cleanup(store, gameId);
  }
});

pgTest("P1-U-02 duplicate idempotency key replays persisted result without executing engine twice", async () => {
  const { store, gameId } = await fixture("idempotency");
  const counter = { calls: 0 };
  const runtime = new MatchRuntime({ repository: store, engine: chatEngine(counter), ownerId: "runtime-idem" });
  try {
    const input = { matchId: gameId, expectedVersion: 1, idempotencyKey: "same-key", command: { type: "chat", playerId: "alice", text: "once" } };
    const first = await runtime.executeCommand(input);
    const replay = await runtime.executeCommand(input);
    assert.equal(first.version, 2);
    assert.equal(replay.version, 2);
    assert.equal(replay.replayed, true);
    assert.equal(counter.calls, 1);
    assert.deepEqual((await store.getVersioned(gameId)).session.messages.map((message) => message.text), ["once"]);
  } finally {
    await cleanup(store, gameId);
  }
});

pgTest("P1-U-02 two competing writers with the same expected version cannot both commit", async () => {
  const { store, gameId } = await fixture("writers");
  const a = new MatchRuntime({ repository: store, engine: chatEngine(), ownerId: "writer-a" });
  const b = new MatchRuntime({ repository: store, engine: chatEngine(), ownerId: "writer-b" });
  try {
    const epochA = await a.claimOwnership(gameId);
    const epochB = await b.claimOwnership(gameId);
    const results = await Promise.allSettled([
      a.executeCommand({ matchId: gameId, expectedVersion: 1, idempotencyKey: "a", ownershipEpoch: epochA, command: { type: "chat", playerId: "alice", text: "a" } }),
      b.executeCommand({ matchId: gameId, expectedVersion: 1, idempotencyKey: "b", ownershipEpoch: epochB, command: { type: "chat", playerId: "bob", text: "b" } }),
    ]);
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(results.filter((item) => item.status === "rejected").length, 1);
    assert.equal((await store.getVersioned(gameId)).version, 2);
  } finally {
    await cleanup(store, gameId);
  }
});

pgTest("P1-U-02 restart reload preserves state/version and fences the stale process", async () => {
  const { store, gameId } = await fixture("restart");
  const oldRuntime = new MatchRuntime({ repository: store, engine: chatEngine(), ownerId: "before-restart" });
  let secondStore;
  try {
    const oldEpoch = await oldRuntime.claimOwnership(gameId);
    await oldRuntime.executeCommand({ matchId: gameId, expectedVersion: 1, idempotencyKey: "before", ownershipEpoch: oldEpoch, command: { type: "chat", playerId: "alice", text: "persisted" } });

    secondStore = new PostgresSessionStore(databaseUrl);
    const recovered = new MatchRuntime({ repository: secondStore, engine: chatEngine(), ownerId: "after-restart" });
    const loaded = await recovered.load(gameId, "alice");
    assert.equal(loaded.version, 2);
    assert.deepEqual(loaded.snapshot.messages, ["persisted"]);
    const newEpoch = await recovered.claimOwnership(gameId);
    assert.ok(newEpoch > oldEpoch);

    await assert.rejects(
      oldRuntime.executeCommand({ matchId: gameId, expectedVersion: 2, idempotencyKey: "stale-after-restart", ownershipEpoch: oldEpoch, command: { type: "chat", playerId: "bob", text: "must-fail" } }),
      (error) => error?.code === "MATCH_RUNTIME_STALE_OWNERSHIP",
    );
    const next = await recovered.executeCommand({ matchId: gameId, expectedVersion: 2, idempotencyKey: "after", ownershipEpoch: newEpoch, command: { type: "chat", playerId: "bob", text: "resumed" } });
    assert.equal(next.version, 3);
  } finally {
    if (secondStore) await secondStore.close();
    await cleanup(store, gameId);
  }
});

pgTest("P1-U-02 publication failure after persistence does not roll back authoritative state", async () => {
  const { store, gameId } = await fixture("publish-failure");
  const runtime = new MatchRuntime({
    repository: store,
    engine: chatEngine(),
    ownerId: "runtime-publish-failure",
    publish: async () => { throw new Error("realtime unavailable"); },
  });
  try {
    const result = await runtime.executeCommand({ matchId: gameId, expectedVersion: 1, idempotencyKey: "persist", command: { type: "chat", playerId: "alice", text: "durable" } });
    assert.equal(result.version, 2);
    const current = await store.getVersioned(gameId);
    assert.equal(current.version, 2);
    assert.equal(current.session.messages.at(-1)?.text, "durable");
  } finally {
    await cleanup(store, gameId);
  }
});

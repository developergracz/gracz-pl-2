import assert from "node:assert/strict";
import test from "node:test";

import { MatchRuntime } from "../src/match-runtime.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameSession, sendChatMessage } from "../src/session.js";

const databaseUrl = process.env.P1_U_02_DATABASE_URL || "";
const requirePostgres = process.env.P1_U_02_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("P1_U_02_DATABASE_URL is required.");
const pgTest = databaseUrl ? test : test.skip;

pgTest("P7-F01 MatchRuntime keeps authoritative private state behind signal-only publication and projection", async () => {
  const store = new PostgresSessionStore(databaseUrl);
  const gameId = `p7_privacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const secret = "synthetic-private-secret";
  const initial = Object.freeze({
    ...createGameSession({ gameId, whitePlayerId: "alice", blackPlayerId: "bob" }),
    privateState: { secret },
  });
  await store.create(initial);

  const publications = [];
  let persistedAtPublish = null;
  const engine = {
    applyCommand({ state, command }) {
      return sendChatMessage(state, { playerId: command.playerId, text: command.text });
    },
    project(state, viewerId) {
      return {
        gameId: state.gameId,
        viewerId,
        messages: state.messages.map((message) => message.text),
      };
    },
    eventType() { return "game.updated"; },
  };
  const runtime = new MatchRuntime({
    repository: store,
    engine,
    ownerId: "runtime-privacy",
    publish: async (payload) => {
      publications.push(structuredClone(payload));
      const row = await store.pool.query("SELECT state, version FROM gracz_game_sessions WHERE game_id = $1", [gameId]);
      persistedAtPublish = {
        state: JSON.parse(row.rows[0].state),
        version: Number(row.rows[0].version),
      };
    },
  });

  try {
    const input = {
      matchId: gameId,
      expectedVersion: 1,
      idempotencyKey: "privacy-command",
      command: { type: "chat", playerId: "alice", text: "visible-message", secretCommandField: "must-not-publish" },
      viewerId: "alice",
    };

    const first = await runtime.executeCommand(input);
    assert.deepEqual(Object.keys(publications[0]).sort(), ["eventType", "matchId", "version"]);
    assert.equal("state" in publications[0], false);
    assert.equal("command" in publications[0], false);
    assert.equal("snapshot" in publications[0], false);
    assert.equal(JSON.stringify(publications[0]).includes(secret), false);
    assert.equal(JSON.stringify(publications[0]).includes("must-not-publish"), false);

    assert.equal("state" in first, false);
    assert.equal(first.snapshot.privateState, undefined);
    assert.equal(JSON.stringify(first.snapshot).includes(secret), false);
    assert.deepEqual(first.snapshot.messages, ["visible-message"]);

    assert.equal(persistedAtPublish.version, 2);
    assert.equal(persistedAtPublish.state.privateState.secret, secret);
    assert.equal(persistedAtPublish.state.messages.at(-1)?.text, "visible-message");

    const persisted = await store.pool.query("SELECT state, version FROM gracz_game_sessions WHERE game_id = $1", [gameId]);
    const authoritative = JSON.parse(persisted.rows[0].state);
    assert.equal(Number(persisted.rows[0].version), 2);
    assert.equal(authoritative.privateState.secret, secret);

    const replay = await runtime.executeCommand(input);
    assert.equal(replay.replayed, true);
    assert.equal(replay.version, 2);
    assert.equal("state" in replay, false);
    assert.equal(replay.snapshot.privateState, undefined);
    assert.deepEqual(replay.snapshot.messages, ["visible-message"]);
    assert.equal(publications.length, 1);

    const afterReplay = await store.pool.query("SELECT state, version FROM gracz_game_sessions WHERE game_id = $1", [gameId]);
    assert.equal(Number(afterReplay.rows[0].version), 2);
    assert.equal(JSON.parse(afterReplay.rows[0].state).privateState.secret, secret);
  } finally {
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id = $1", [gameId]).catch(() => {});
    await store.close();
  }
});

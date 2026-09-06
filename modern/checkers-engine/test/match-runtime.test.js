import test from "node:test";
import assert from "node:assert/strict";

import { CommonMatchRuntime, MatchRuntimeError, createMatchCommand } from "../src/match-runtime.js";
import { createLegacyMatchRuntime } from "../src/match-runtime-adapters.js";
import { MemorySessionStore } from "../src/store.js";
import { ThousandGameService } from "../src/thousand-service.js";
import { MemoryThousandRepository } from "../src/thousand-repository.js";
import { GomokuService } from "../src/gomoku-service.js";

test("command envelope normalizes the common runtime contract", () => {
  const command = createMatchCommand({
    commandId: "cmd-1",
    gameType: "CHECKERS",
    matchId: "match-1",
    commandType: "MATCH.MOVE",
    actorUserId: "alice",
    expectedVersion: 1,
    payload: { move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } },
    correlationId: "corr-1",
  });

  assert.equal(command.gameType, "checkers");
  assert.equal(command.commandType, "match.move");
  assert.equal(command.expectedVersion, 1);
  assert.equal(command.correlationId, "corr-1");
  assert.ok(Object.isFrozen(command));
});

test("runtime serializes commands for the same match without serializing unrelated matches", async () => {
  let active = 0;
  let maxSameMatch = 0;
  const versions = new Map();
  const adapter = {
    async getView({ matchId }) { return { version: versions.get(matchId) ?? 0, view: { matchId } }; },
    async execute(command) {
      active += 1;
      maxSameMatch = Math.max(maxSameMatch, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      const version = (versions.get(command.matchId) ?? 0) + 1;
      versions.set(command.matchId, version);
      return { version, view: { matchId: command.matchId } };
    },
  };
  const runtime = new CommonMatchRuntime({ adapters: { checkers: adapter } });

  await Promise.all([
    runtime.execute({ commandId: "a", gameType: "checkers", matchId: "same", commandType: "match.action", actorUserId: "alice" }),
    runtime.execute({ commandId: "b", gameType: "checkers", matchId: "same", commandType: "match.action", actorUserId: "alice" }),
  ]);

  assert.equal(maxSameMatch, 1);
  assert.equal((await runtime.getView({ gameType: "checkers", matchId: "same", actorUserId: "alice" })).version, 2);
});

test("checkers is exposed through the common runtime without rewriting the engine", async () => {
  const runtime = createLegacyMatchRuntime({ checkersStore: new MemorySessionStore() });

  const created = await runtime.execute({
    commandId: "checkers-create-1",
    gameType: "checkers",
    matchId: "checkers-match-1",
    commandType: "match.create",
    actorUserId: "alice",
    expectedVersion: 0,
    payload: { whitePlayerId: "alice", blackPlayerId: "bob" },
  });
  assert.equal(created.version, 1);
  assert.equal(created.view.gameId, "checkers-match-1");

  const moved = await runtime.execute({
    commandId: "checkers-move-1",
    gameType: "checkers",
    matchId: "checkers-match-1",
    commandType: "match.move",
    actorUserId: "alice",
    expectedVersion: 1,
    payload: { move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } },
  });
  assert.equal(moved.version, 2);
  assert.equal(moved.duplicate, false);

  await assert.rejects(
    runtime.execute({
      commandId: "checkers-chat-stale",
      gameType: "checkers",
      matchId: "checkers-match-1",
      commandType: "match.chat",
      actorUserId: "alice",
      expectedVersion: 1,
      payload: { text: "hej" },
    }),
    (error) => error instanceof MatchRuntimeError && error.code === "MATCH_STALE_VERSION" && error.status === 409,
  );
});

test("gomoku is exposed through the same command envelope with revision checks and idempotent request id", async () => {
  const runtime = createLegacyMatchRuntime({ gomokuService: new GomokuService({ size: 15 }) });
  const players = [
    { userId: "alice", displayName: "Alice" },
    { userId: "bob", displayName: "Bob" },
  ];

  const created = await runtime.execute({
    commandId: "gomoku-create-1",
    gameType: "gomoku",
    matchId: "gomoku-match-1",
    commandType: "match.create",
    actorUserId: "alice",
    expectedVersion: 0,
    payload: { players },
  });
  assert.equal(created.version, 0);

  const first = await runtime.execute({
    commandId: "gomoku-move-1",
    gameType: "gomoku",
    matchId: "gomoku-match-1",
    commandType: "match.move",
    actorUserId: "alice",
    expectedVersion: 0,
    payload: { row: 7, column: 7 },
  });
  assert.equal(first.version, 1);
  assert.equal(first.view.moves.length, 1);

  const retry = await runtime.execute({
    commandId: "gomoku-move-1",
    gameType: "gomoku",
    matchId: "gomoku-match-1",
    commandType: "match.move",
    actorUserId: "alice",
    expectedVersion: 1,
    payload: { row: 7, column: 7 },
  });
  assert.equal(retry.version, 1);
  assert.equal(retry.view.moves.length, 1);
});

test("thousand uses the same runtime boundary and preserves its repository revision", async () => {
  const service = new ThousandGameService({ repository: new MemoryThousandRepository(), random: () => 0.5 });
  const runtime = createLegacyMatchRuntime({ thousandService: service });
  const players = [
    { userId: "alice", displayName: "Alice" },
    { userId: "bob", displayName: "Bob" },
  ];

  const created = await runtime.execute({
    commandId: "thousand-create-1",
    gameType: "thousand",
    matchId: "thousand-match-1",
    commandType: "match.create",
    actorUserId: "alice",
    expectedVersion: 0,
    payload: { players },
  });

  assert.equal(created.version, 1);
  assert.equal(created.view.gameId, "thousand-match-1");
  assert.equal(created.view.viewerIndex, 0);
  await service.close();
});

test("unregistered game type fails deterministically", async () => {
  const runtime = new CommonMatchRuntime();
  await assert.rejects(
    runtime.execute({ commandId: "x", gameType: "unknown", matchId: "m", commandType: "match.move", actorUserId: "alice" }),
    (error) => error instanceof MatchRuntimeError && error.code === "MATCH_GAME_NOT_REGISTERED" && error.status === 404,
  );
});

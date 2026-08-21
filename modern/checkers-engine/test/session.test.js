import assert from "node:assert/strict";
import test from "node:test";

import { PLAYERS } from "../src/index.js";
import {
  SessionError,
  createGameSession,
  deserializeSession,
  disconnectPlayer,
  getSessionSnapshot,
  reconnectPlayer,
  serializeSession,
  submitMove,
} from "../src/session.js";

const firstMove = { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } };

function newSession() {
  return createGameSession({ gameId: "game-1", whitePlayerId: "alice", blackPlayerId: "bob" });
}

test("session assigns players to colors", () => {
  const session = newSession();
  assert.equal(session.players.white.id, "alice");
  assert.equal(session.players.black.id, "bob");
  assert.equal(session.game.turn, PLAYERS.WHITE);
});

test("server accepts a move only from the player whose turn it is", () => {
  const session = newSession();
  assert.throws(
    () => submitMove(session, { playerId: "bob", requestId: "r1", move: firstMove }),
    (error) => error instanceof SessionError && error.code === "OUT_OF_TURN",
  );
  const result = submitMove(session, { playerId: "alice", requestId: "r1", move: firstMove });
  assert.equal(result.session.game.turn, PLAYERS.BLACK);
  assert.equal(result.event.type, "move.accepted");
});

test("repeated request is idempotent and does not apply move twice", () => {
  const first = submitMove(newSession(), { playerId: "alice", requestId: "r1", move: firstMove });
  const repeated = submitMove(first.session, { playerId: "alice", requestId: "r1", move: firstMove });
  assert.equal(repeated.session, first.session);
  assert.equal(repeated.event, first.event);
  assert.equal(repeated.duplicate, true);
});

test("disconnected player cannot move and receives snapshot after reconnect", () => {
  const disconnected = disconnectPlayer(newSession(), "alice");
  assert.throws(
    () => submitMove(disconnected, { playerId: "alice", requestId: "r1", move: firstMove }),
    (error) => error instanceof SessionError && error.code === "PLAYER_DISCONNECTED",
  );
  const { session, snapshot } = reconnectPlayer(disconnected, "alice");
  assert.equal(session.players.white.connected, true);
  assert.equal(snapshot.color, PLAYERS.WHITE);
  assert.deepEqual(snapshot.game, session.game);
  assert.equal(snapshot.lastEventSequence, 3);
});

test("spectator or unknown user cannot read private player snapshot", () => {
  assert.throws(
    () => getSessionSnapshot(newSession(), "mallory"),
    (error) => error instanceof SessionError && error.code === "PLAYER_NOT_IN_GAME",
  );
});

test("session persists with event log and processed request ids", () => {
  const moved = submitMove(newSession(), { playerId: "alice", requestId: "r1", move: firstMove }).session;
  const restored = deserializeSession(serializeSession(moved));
  assert.deepEqual(restored, moved);
  const repeated = submitMove(restored, { playerId: "alice", requestId: "r1", move: firstMove });
  assert.equal(repeated.duplicate, true);
});

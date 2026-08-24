import assert from "node:assert/strict";
import test from "node:test";

import { PIECES, PLAYERS, createEmptyBoard, createState } from "../src/index.js";
import {
  SessionError,
  createGameSession,
  deserializeSession,
  disconnectPlayer,
  getSessionSnapshot,
  reconnectPlayer,
  serializeSession,
  submitMove,
  sendChatMessage,
  submitGameAction,
} from "../src/session.js";

const firstMove = { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } };

function newSession() {
  return createGameSession({ gameId: "game-1", whitePlayerId: "alice", blackPlayerId: "bob" });
}

function multiCaptureSession() {
  const board = createEmptyBoard();
  board[1][0] = PIECES.WHITE_MAN;
  board[2][1] = PIECES.BLACK_MAN;
  board[4][3] = PIECES.BLACK_MAN;
  const game = createState({ board, turn: PLAYERS.WHITE });
  return createGameSession({ gameId: "multi-1", whitePlayerId: "alice", blackPlayerId: "bob", game });
}

test("session assigns players to colors", () => {
  const session = newSession();
  assert.equal(session.players.white.id, "alice");
  assert.equal(session.players.black.id, "bob");
  assert.equal(session.game.turn, PLAYERS.WHITE);
});

test("chat and classic console actions are shared in the session", () => {
  let session = sendChatMessage(newSession(), { playerId: "alice", text: "Powodzenia!" });
  assert.equal(session.messages[0].text, "Powodzenia!");
  session = submitGameAction(session, { playerId: "alice", action: "draw" });
  assert.equal(session.pendingOffer.type, "draw");
  session = submitGameAction(session, { playerId: "bob", action: "draw" });
  assert.equal(session.game.status, "draw");
  assert.equal(session.game.drawReason, "agreement");
});

test("resignation ends the game for the opponent", () => {
  const session = submitGameAction(newSession(), { playerId: "alice", action: "resign" });
  assert.equal(session.game.status, "won");
  assert.equal(session.game.winner, "black");
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

test("forced multi-capture survives persistence and reconnect", () => {
  const firstCapture = submitMove(multiCaptureSession(), {
    playerId: "alice",
    requestId: "capture-1",
    move: { from: { row: 1, column: 0 }, to: { row: 3, column: 2 } },
  }).session;
  assert.deepEqual(firstCapture.game.forcedPiece, { row: 3, column: 2 });
  assert.equal(firstCapture.game.turn, PLAYERS.WHITE);

  const persisted = deserializeSession(serializeSession(firstCapture));
  const disconnected = disconnectPlayer(persisted, "alice");
  const { session: reconnected, snapshot } = reconnectPlayer(disconnected, "alice");

  assert.deepEqual(snapshot.game.forcedPiece, { row: 3, column: 2 });
  assert.equal(snapshot.game.turn, PLAYERS.WHITE);

  const finished = submitMove(reconnected, {
    playerId: "alice",
    requestId: "capture-2",
    move: { from: { row: 3, column: 2 }, to: { row: 5, column: 4 } },
  }).session;
  assert.equal(finished.game.forcedPiece, null);
  assert.equal(finished.game.turn, PLAYERS.BLACK);
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

import assert from "node:assert/strict";
import test from "node:test";

import {
  IllegalMoveError,
  PIECES,
  PLAYERS,
  applyMove,
  createEmptyBoard,
  createInitialState,
  createState,
  deserializeState,
  determineWinner,
  getLegalMoves,
  replayGame,
  serializeState,
} from "../src/index.js";
import { ProtocolError, createMoveMessage, decodeMessage, encodeMessage } from "../src/protocol.js";

function stateWith(pieces, turn = PLAYERS.WHITE, forcedPiece = null) {
  const board = createEmptyBoard();
  for (const [row, column, piece] of pieces) board[row][column] = piece;
  return createState({ board, turn, forcedPiece });
}

test("initial state contains twelve pieces per player", () => {
  const state = createInitialState();
  const pieces = state.board.flat().filter(Boolean);
  assert.equal(pieces.filter((piece) => piece === PIECES.WHITE_MAN).length, 12);
  assert.equal(pieces.filter((piece) => piece === PIECES.BLACK_MAN).length, 12);
  assert.equal(state.turn, PLAYERS.WHITE);
});

test("white begins with seven legal moves", () => {
  assert.equal(getLegalMoves(createInitialState()).length, 7);
});

test("applying a legal move changes turn without mutating input", () => {
  const state = createInitialState();
  const next = applyMove(state, { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } });
  assert.equal(state.board[2][1], PIECES.WHITE_MAN);
  assert.equal(next.board[2][1], null);
  assert.equal(next.board[3][0], PIECES.WHITE_MAN);
  assert.equal(next.turn, PLAYERS.BLACK);
});

test("capture is mandatory when available", () => {
  const state = stateWith([
    [2, 1, PIECES.WHITE_MAN],
    [2, 5, PIECES.WHITE_MAN],
    [3, 2, PIECES.BLACK_MAN],
  ]);
  assert.deepEqual(getLegalMoves(state), [{
    from: { row: 2, column: 1 },
    to: { row: 4, column: 3 },
    capture: { row: 3, column: 2 },
  }]);
  assert.throws(
    () => applyMove(state, { from: { row: 2, column: 5 }, to: { row: 3, column: 4 } }),
    IllegalMoveError,
  );
});

test("multi-capture keeps turn and forces the same piece", () => {
  const state = stateWith([
    [1, 0, PIECES.WHITE_MAN],
    [2, 1, PIECES.BLACK_MAN],
    [4, 3, PIECES.BLACK_MAN],
  ]);
  const afterFirstCapture = applyMove(state, {
    from: { row: 1, column: 0 },
    to: { row: 3, column: 2 },
  });
  assert.equal(afterFirstCapture.turn, PLAYERS.WHITE);
  assert.deepEqual(afterFirstCapture.forcedPiece, { row: 3, column: 2 });
  assert.equal(getLegalMoves(afterFirstCapture).length, 1);

  const finished = applyMove(afterFirstCapture, {
    from: { row: 3, column: 2 },
    to: { row: 5, column: 4 },
  });
  assert.equal(finished.turn, PLAYERS.BLACK);
  assert.equal(finished.forcedPiece, null);
});

test("piece is promoted on the last row", () => {
  const state = stateWith([
    [6, 1, PIECES.WHITE_MAN],
    [0, 1, PIECES.BLACK_MAN],
  ]);
  const next = applyMove(state, { from: { row: 6, column: 1 }, to: { row: 7, column: 0 } });
  assert.equal(next.board[7][0], PIECES.WHITE_KING);
});

test("king can move in both directions", () => {
  const state = stateWith([
    [4, 3, PIECES.WHITE_KING],
    [0, 1, PIECES.BLACK_MAN],
  ]);
  const destinations = getLegalMoves(state).map((move) => `${move.to.row}:${move.to.column}`).sort();
  assert.deepEqual(destinations, ["3:2", "3:4", "5:2", "5:4"]);
});

test("player with no pieces loses", () => {
  const state = stateWith([[4, 3, PIECES.WHITE_MAN]], PLAYERS.BLACK);
  assert.equal(determineWinner(state), PLAYERS.WHITE);
});

test("player blocked without a legal move loses", () => {
  const state = stateWith([
    [0, 1, PIECES.BLACK_MAN],
    [7, 0, PIECES.WHITE_MAN],
  ], PLAYERS.BLACK);
  assert.equal(determineWinner(state), PLAYERS.WHITE);
});

test("malformed and out-of-turn moves are rejected", () => {
  const state = createInitialState();
  assert.throws(() => applyMove(state, { from: { row: 8, column: 1 }, to: { row: 7, column: 0 } }), IllegalMoveError);
  assert.throws(() => applyMove(state, { from: { row: 5, column: 0 }, to: { row: 4, column: 1 } }), IllegalMoveError);
});

test("state can be serialized and restored", () => {
  const state = createInitialState();
  assert.deepEqual(deserializeState(serializeState(state)), state);
});

test("game can be rebuilt deterministically from move history", () => {
  const moves = [
    { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } },
    { from: { row: 5, column: 0 }, to: { row: 4, column: 1 } },
  ];
  const replayed = replayGame(moves);
  const manual = applyMove(applyMove(createInitialState(), moves[0]), moves[1]);
  assert.deepEqual(replayed, manual);
});

test("three repetitions finish the game with a draw", () => {
  let state = stateWith([
    [2, 1, PIECES.WHITE_KING],
    [5, 6, PIECES.BLACK_KING],
  ]);
  const cycle = [
    { from: { row: 2, column: 1 }, to: { row: 3, column: 2 } },
    { from: { row: 5, column: 6 }, to: { row: 4, column: 5 } },
    { from: { row: 3, column: 2 }, to: { row: 2, column: 1 } },
    { from: { row: 4, column: 5 }, to: { row: 5, column: 6 } },
  ];
  state = replayGame([...cycle, ...cycle], state);
  assert.equal(state.status, "draw");
  assert.equal(state.drawReason, "threefold-repetition");
  assert.equal(getLegalMoves(state).length, 0);
});

test("multiplayer move messages round-trip through JSON", () => {
  const message = createMoveMessage({
    gameId: "game-1",
    playerId: "user-2",
    requestId: "request-3",
    move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } },
  });
  assert.deepEqual(decodeMessage(encodeMessage(message)), message);
});

test("multiplayer protocol rejects malformed input", () => {
  assert.throws(() => decodeMessage("not-json"), ProtocolError);
  assert.throws(() => decodeMessage(JSON.stringify({ version: 99, type: "game.move" })), ProtocolError);
});

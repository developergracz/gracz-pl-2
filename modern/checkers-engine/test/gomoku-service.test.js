import assert from "node:assert/strict";
import test from "node:test";
import { GomokuError, GomokuService } from "../src/gomoku-service.js";

function game() {
  const service = new GomokuService({ idGenerator: () => "test-id" });
  service.createGame({ gameId: "gomoku-test", players: [{ userId: "alice", displayName: "Alicja" }, { userId: "bob", displayName: "Robert" }] });
  return service;
}

test("Gomoku assigns two independent players and alternates turns", () => {
  const service = game();
  assert.equal(service.view("gomoku-test", "alice").color, "black");
  assert.equal(service.view("gomoku-test", "bob").color, "white");
  service.move("gomoku-test", "alice", { row: 7, column: 7, requestId: "a1" });
  assert.equal(service.view("gomoku-test", "bob").canMove, true);
  assert.throws(() => service.move("gomoku-test", "alice", { row: 7, column: 8 }), (error) => error instanceof GomokuError && error.code === "OUT_OF_TURN");
});

test("Gomoku rejects occupied fields and players outside the game", () => {
  const service = game();
  service.move("gomoku-test", "alice", { row: 4, column: 4 });
  assert.throws(() => service.move("gomoku-test", "bob", { row: 4, column: 4 }), (error) => error.code === "FIELD_OCCUPIED");
  assert.throws(() => service.view("gomoku-test", "mallory"), (error) => error.code === "PLAYER_NOT_IN_GAME");
});

test("Gomoku detects five stones in a row", () => {
  const service = game();
  for (let column = 0; column < 5; column += 1) {
    service.move("gomoku-test", "alice", { row: 7, column });
    if (column < 4) service.move("gomoku-test", "bob", { row: 8, column });
  }
  const alice = service.view("gomoku-test", "alice");
  assert.equal(alice.status, "finished");
  assert.equal(alice.winner, "black");
  assert.equal(alice.moves.length, 9);
});

test("Gomoku accepts a repeated request after the turn changed", () => {
  const service = game();
  const first = service.move("gomoku-test", "alice", { row: 7, column: 7, requestId: "move-1" });
  const repeated = service.move("gomoku-test", "alice", { row: 7, column: 7, requestId: "move-1" });
  assert.equal(first.revision, 1);
  assert.equal(repeated.revision, 1);
  assert.equal(repeated.moves.length, 1);
  assert.equal(repeated.turn, "white");
});

test("Gomoku accepts a repeated winning request after the game finished", () => {
  const service = game();
  for (let column = 0; column < 5; column += 1) {
    service.move("gomoku-test", "alice", { row: 7, column, requestId: `a-${column}` });
    if (column < 4) service.move("gomoku-test", "bob", { row: 8, column, requestId: `b-${column}` });
  }
  const repeated = service.move("gomoku-test", "alice", { row: 7, column: 4, requestId: "a-4" });
  assert.equal(repeated.status, "finished");
  assert.equal(repeated.moves.length, 9);
});

test("Gomoku validates board coordinates and request identifiers", () => {
  const service = game();
  for (const move of [{ row: -1, column: 0 }, { row: 0, column: 15 }, { row: 1.5, column: 2 }, { row: "1", column: 2 }]) {
    assert.throws(() => service.move("gomoku-test", "alice", move), (error) => error.code === "INVALID_MOVE");
  }
  assert.throws(() => service.move("gomoku-test", "alice", { row: 1, column: 1, requestId: "" }), (error) => error.code === "INVALID_REQUEST_ID");
  assert.throws(() => service.move("gomoku-test", "alice", { row: 1, column: 1, requestId: "x".repeat(129) }), (error) => error.code === "INVALID_REQUEST_ID");
});

test("Gomoku detects vertical and both diagonal wins", () => {
  for (const blackMoves of [
    [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
    [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
    [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]],
  ]) {
    const service = game();
    blackMoves.forEach(([row, column], index) => {
      service.move("gomoku-test", "alice", { row, column });
      if (index < 4) service.move("gomoku-test", "bob", { row: 10, column: index });
    });
    assert.equal(service.view("gomoku-test", "alice").winner, "black");
  }
});

test("Gomoku refuses duplicate players and game id collisions", () => {
  const service = game();
  assert.throws(() => service.createGame({ players: [{ userId: "alice", displayName: "A" }, { userId: "alice", displayName: "A" }] }), (error) => error.code === "DUPLICATE_PLAYER");
  assert.throws(() => service.createGame({ gameId: "gomoku-test", players: [{ userId: "carol", displayName: "Karolina" }, { userId: "dave", displayName: "Dawid" }] }), (error) => error.code === "GAME_ALREADY_EXISTS");
});

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

import assert from "node:assert/strict";
import test from "node:test";

import { createGameSession, disconnectPlayer, reconnectPlayer, sendChatMessage, submitGameAction, submitMove } from "../src/session.js";

const VERSION = Symbol("test-version");
function mark(session) { return Object.freeze({ ...session, [VERSION]: 7 }); }

const initial = () => mark(createGameSession({ gameId: "version-propagation", whitePlayerId: "alice", blackPlayerId: "bob" }));

test("P1-C-01 session mutations preserve symbol metadata used by CAS store", () => {
  const move = submitMove(initial(), { playerId: "alice", requestId: "m1", move: { from: { row: 2, column: 1 }, to: { row: 3, column: 0 } } }).session;
  assert.equal(move[VERSION], 7);
  assert.equal(sendChatMessage(initial(), { playerId: "alice", text: "hello" })[VERSION], 7);
  assert.equal(submitGameAction(initial(), { playerId: "alice", action: "resign" })[VERSION], 7);
  const disconnected = disconnectPlayer(initial(), "alice");
  assert.equal(disconnected[VERSION], 7);
  assert.equal(reconnectPlayer(disconnected, "alice").session[VERSION], 7);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_GAME_TYPES,
  GameTypeError,
  getGameDefinition,
  isCanonicalGameType,
  normalizeGameType,
  requireGameType,
} from "../src/game-types.js";
import { LobbyService } from "../src/lobby.js";
import { RankingService } from "../src/rankings.js";
import { TournamentService } from "../src/tournaments.js";

const owner = { userId: "owner", displayName: "Owner" };
const sessionStore = { create: async () => {} };

function assertInvalid(value) {
  assert.equal(normalizeGameType(value), null);
  assert.throws(() => requireGameType(value), (error) => error instanceof GameTypeError && error.code === "INVALID_GAME_TYPE" && error.status === 400);
}

test("P8 canonical registry exposes exactly current canonical game IDs", () => {
  assert.deepEqual(CANONICAL_GAME_TYPES, ["checkers", "gomoku", "thousand"]);
  for (const game of CANONICAL_GAME_TYPES) {
    assert.equal(isCanonicalGameType(game), true);
    const definition = getGameDefinition(game);
    assert.equal(definition.id, game);
    assert.equal(definition.implemented, true);
  }
  assert.equal(getGameDefinition("checkers").label, "Warcaby");
  assert.equal(getGameDefinition("thousand").players.default, 3);
});

test("P8 warcaby is the controlled alias for checkers", () => {
  assert.equal(normalizeGameType("warcaby"), "checkers");
  assert.equal(normalizeGameType(" WARCABY "), "checkers");
  assert.equal(isCanonicalGameType("warcaby"), false);
  assert.equal(requireGameType("warcaby"), "checkers");
});

test("P8 unknown, empty and malformed identifiers fail closed", () => {
  for (const value of ["szachy", "poker", "blackjack", "war", "tysiac", "draughts", "", "   ", null, undefined, 42, {}]) assertInvalid(value);
});

test("P8 lobby stores and exposes canonical game types", () => {
  const lobby = new LobbyService({ sessionStore, idGenerator: (() => { let id=0; return () => `room-${++id}`; })() });
  const aliasRoom = lobby.createRoom({ ownerId:"u1", ownerName:"U1", roomName:"Alias", gameType:"warcaby" });
  assert.equal(aliasRoom.gameType, "checkers");
  const duplicate = lobby.createRoom({ ownerId:"u1", ownerName:"U1", roomName:"Canonical", gameType:"checkers" });
  assert.equal(duplicate.roomId, aliasRoom.roomId);
  assert.equal(duplicate.gameType, "checkers");

  assert.equal(lobby.createRoom({ ownerId:"u2", ownerName:"U2", roomName:"G", gameType:"gomoku" }).gameType, "gomoku");
  assert.equal(lobby.createRoom({ ownerId:"u3", ownerName:"U3", roomName:"T", gameType:"thousand" }).gameType, "thousand");
  assert.throws(() => lobby.createRoom({ ownerId:"u4", ownerName:"U4", roomName:"Bad", gameType:"szachy" }), (error) => error.code === "INVALID_GAME_TYPE");
});

test("P8 rankings preserve all but normalize aliases and reject invalid filters", async () => {
  const rankings = new RankingService(null);
  assert.equal((await rankings.leaderboard({ game:"checkers" })).game, "checkers");
  assert.equal((await rankings.leaderboard({ game:"warcaby" })).game, "checkers");
  assert.equal((await rankings.leaderboard({ game:"thousand" })).game, "thousand");
  assert.equal((await rankings.leaderboard({ game:"all" })).game, "all");
  await assert.rejects(rankings.leaderboard({ game:"szachy" }), (error) => error.code === "INVALID_GAME_TYPE");
  await assert.rejects(rankings.leaderboard({ game:"" }), (error) => error.code === "INVALID_GAME_TYPE");
  await assert.rejects(rankings.leaderboard({ game:"gomoku" }), (error) => error.code === "UNSUPPORTED_GAME_TYPE");
});

test("P8 tournaments normalize new writes and reject unsupported game types", async () => {
  const tournaments = new TournamentService(null);
  const checkers = await tournaments.create(owner, { title:"Checkers Cup", game:"checkers" });
  const alias = await tournaments.create(owner, { title:"Legacy Input", game:"warcaby" });
  const gomoku = await tournaments.create(owner, { title:"Gomoku Cup", game:"gomoku" });
  const thousand = await tournaments.create(owner, { title:"Thousand Cup", game:"thousand" });

  assert.equal(checkers.game, "checkers");
  assert.equal(alias.game, "checkers");
  assert.equal(tournaments.memory.get(alias.tournamentId).tournament.game, "checkers");
  assert.equal(gomoku.game, "gomoku");
  assert.equal(thousand.game, "thousand");

  await assert.rejects(tournaments.create(owner, { title:"Chess Cup", game:"szachy" }), (error) => error.code === "INVALID_GAME_TYPE");
  await assert.rejects(tournaments.create(owner, { title:"Unknown Cup", game:"poker" }), (error) => error.code === "INVALID_GAME_TYPE");
  await assert.rejects(tournaments.create(owner, { title:"Missing Game" }), (error) => error.code === "INVALID_GAME_TYPE");
});

test("P8 tournament legacy warcaby rows normalize on read without migration", async () => {
  const tournaments = new TournamentService(null);
  tournaments.memory.set("legacy", {
    tournament: {
      tournamentId:"legacy", ownerId:owner.userId, ownerName:owner.displayName, title:"Legacy Cup", description:"", game:"warcaby", format:"swiss",
      status:"registration", visibility:"public", maxPlayers:16, rounds:5, timeControl:"5+0", rated:true, startsAt:null, currentRound:0,
      createdAt:new Date(0).toISOString(), finishedAt:null,
    },
    players: [], matches: [],
  });

  const list = await tournaments.list(owner, { game:"checkers" });
  assert.equal(list.length, 1);
  assert.equal(list[0].game, "checkers");
  assert.equal(tournaments.memory.get("legacy").tournament.game, "warcaby");
  assert.equal((await tournaments.detail(owner, "legacy")).tournament.game, "checkers");
  assert.equal((await tournaments.list(owner, { game:"warcaby" }))[0].game, "checkers");
  await assert.rejects(tournaments.list(owner, { game:"szachy" }), (error) => error.code === "INVALID_GAME_TYPE");
});

test("P8 cross-module warcaby contract resolves to one canonical identity", async () => {
  const lobby = new LobbyService({ sessionStore, idGenerator: () => "cross-room" });
  const rankings = new RankingService(null);
  const tournaments = new TournamentService(null);

  const room = lobby.createRoom({ ownerId:"cross", ownerName:"Cross", roomName:"Cross", gameType:"warcaby" });
  const ranking = await rankings.leaderboard({ game:"warcaby" });
  const tournament = await tournaments.create(owner, { title:"Cross Cup", game:"warcaby" });

  assert.deepEqual([room.gameType, ranking.game, tournament.game], ["checkers", "checkers", "checkers"]);
});

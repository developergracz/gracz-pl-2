import assert from "node:assert/strict";
import test from "node:test";

import { AuthService } from "../src/auth.js";
import {
  CANONICAL_GAME_TYPES,
  GameTypeError,
  getGameDefinition,
  isCanonicalGameType,
  normalizeGameType,
  requireGameType,
  validateGameTypeDefinitions,
} from "../src/game-types.js";
import { LobbyService } from "../src/lobby.js";
import { RankingService } from "../src/rankings.js";
import { createGameHttpServer } from "../src/server.js";
import { MemorySessionStore } from "../src/store.js";
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

test("P8 registry construction fails closed on canonical and alias collisions", () => {
  assert.equal(validateGameTypeDefinitions([
    { id:"alpha", aliases:["legacy-alpha"] },
    { id:"beta", aliases:[] },
  ]), true);
  assert.throws(() => validateGameTypeDefinitions([
    { id:"alpha", aliases:[] },
    { id:"alpha", aliases:[] },
  ]), /Duplikat canonical game id/);
  assert.throws(() => validateGameTypeDefinitions([
    { id:"alpha", aliases:[] },
    { id:"beta", aliases:["alpha"] },
  ]), /Kolizja typu gry/);
  assert.throws(() => validateGameTypeDefinitions([
    { id:"alpha", aliases:["legacy"] },
    { id:"beta", aliases:["legacy"] },
  ]), /Kolizja typu gry/);
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
  assert.throws(() => lobby.createRoom({ ownerId:"u4", ownerName:"U4", roomName:"Bad", gameType:"szachy" }), (error) => error.code === "INVALID_GAME_TYPE" && error.status === 400);
});

test("P8 legacy lobby HTTP wrapper returns 400 for invalid game type", async () => {
  const store = new MemorySessionStore();
  const auth = new AuthService({ secret:"p8-http-test-secret-that-is-longer-than-32-characters" });
  const lobby = new LobbyService({ sessionStore:store });
  const server = createGameHttpServer({ store, auth, lobby });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const token = auth.issue({ userId:"p8-http-user", displayName:"P8 HTTP User" });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/lobby/rooms`, {
      method:"POST",
      headers:{
        "content-type":"application/json",
        cookie:`__Host-gracz_session=${encodeURIComponent(token)}`,
      },
      body:JSON.stringify({ roomName:"Invalid", gameType:"szachy" }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "INVALID_GAME_TYPE");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
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
  assert.equal(list[0].gameSupported, true);
  assert.equal(tournaments.memory.get("legacy").tournament.game, "warcaby");
  assert.equal((await tournaments.detail(owner, "legacy")).tournament.game, "checkers");
  assert.equal((await tournaments.list(owner, { game:"warcaby" }))[0].game, "checkers");
  await assert.rejects(tournaments.list(owner, { game:"szachy" }), (error) => error.code === "INVALID_GAME_TYPE");
});

test("P8 legacy unsupported szachy row remains readable but cannot become a supported game", async () => {
  const tournaments = new TournamentService(null);
  tournaments.memory.set("legacy-chess", {
    tournament: {
      tournamentId:"legacy-chess", ownerId:owner.userId, ownerName:owner.displayName, title:"Historical Chess", description:"", game:"szachy", format:"swiss",
      status:"registration", visibility:"public", maxPlayers:16, rounds:5, timeControl:"5+0", rated:true, startsAt:null, currentRound:0,
      createdAt:new Date(0).toISOString(), finishedAt:null,
    },
    players: [], matches: [],
  });
  const list = await tournaments.list(owner, {});
  const legacy = list.find((item) => item.tournamentId === "legacy-chess");
  assert.equal(legacy.game, null);
  assert.equal(legacy.gameSupported, false);
  assert.equal(legacy.legacyGame, "szachy");
  assert.equal(tournaments.memory.get("legacy-chess").tournament.game, "szachy");
  await assert.rejects(tournaments.join({ userId:"other", displayName:"Other" }, "legacy-chess"), (error) => error.code === "TOURNAMENT_GAME_UNSUPPORTED");
});

test("P8 PostgreSQL legacy unsupported row cannot break valid tournament collection", { skip: !process.env.P1_U_01_DATABASE_URL }, async () => {
  const tournaments = new TournamentService(process.env.P1_U_01_DATABASE_URL);
  await tournaments.ready;
  const legacyId = "a8f00000-0000-4000-8000-000000000001";
  const canonicalId = "a8f00000-0000-4000-8000-000000000002";
  try {
    await tournaments.pool.query(`DELETE FROM gracz_tournaments WHERE tournament_id IN ($1,$2)`, [legacyId, canonicalId]);
    await tournaments.pool.query(`
      INSERT INTO gracz_tournaments(tournament_id,owner_id,owner_name,title,description,game,format,status,visibility,max_players,rounds,time_control,rated,current_round)
      VALUES
        ($1,$3,$4,'P8 legacy compatibility chess','', 'szachy','swiss','registration','public',16,5,'5+0',TRUE,0),
        ($2,$3,$4,'P8 legacy compatibility checkers','', 'checkers','swiss','registration','public',16,5,'5+0',TRUE,0)
    `, [legacyId, canonicalId, owner.userId, owner.displayName]);

    const list = await tournaments.list(owner, { q:"p8 legacy compatibility" });
    const legacy = list.find((item) => item.tournamentId === legacyId);
    const canonical = list.find((item) => item.tournamentId === canonicalId);
    assert.ok(legacy);
    assert.ok(canonical);
    assert.equal(legacy.game, null);
    assert.equal(legacy.gameSupported, false);
    assert.equal(legacy.legacyGame, "szachy");
    assert.equal(canonical.game, "checkers");
    assert.equal(canonical.gameSupported, true);
    assert.equal((await tournaments.detail(owner, legacyId)).tournament.legacyGame, "szachy");
    await assert.rejects(tournaments.join({ userId:"other", displayName:"Other" }, legacyId), (error) => error.code === "TOURNAMENT_GAME_UNSUPPORTED");
    const stored = await tournaments.pool.query(`SELECT game FROM gracz_tournaments WHERE tournament_id=$1`, [legacyId]);
    assert.equal(stored.rows[0].game, "szachy");
  } finally {
    await tournaments.pool.query(`DELETE FROM gracz_tournaments WHERE tournament_id IN ($1,$2)`, [legacyId, canonicalId]).catch(() => {});
    await tournaments.close();
  }
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

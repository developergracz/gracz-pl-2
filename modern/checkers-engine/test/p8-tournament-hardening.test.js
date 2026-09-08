import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { validateGameTypeDefinitions } from "../src/game-types.js";
import { TournamentService } from "../src/tournaments.js";

const databaseUrl = process.env.P1_H_01_DATABASE_URL || process.env.P1_U_01_DATABASE_URL || process.env.DATABASE_URL;
const owner = { userId: "owner", displayName: "Owner" };
const p2 = { userId: "p2", displayName: "P2" };
const p3 = { userId: "p3", displayName: "P3" };
const p4 = { userId: "p4", displayName: "P4" };
const p5 = { userId: "p5", displayName: "P5" };

async function createFourSeatTournament(service, suffix = "") {
  return service.create(owner, {
    title: `P8 join hardening ${suffix || Date.now()}`,
    game: "checkers",
    format: "swiss",
    maxPlayers: 4,
    rounds: 3,
  });
}

async function cleanup(service, tournamentId) {
  if (!tournamentId || !service.pool) return;
  await service.pool.query("DELETE FROM gracz_tournaments WHERE tournament_id=$1", [tournamentId]).catch(() => {});
}

function assertUniqueSeeds(players) {
  const seeds = players.map((player) => Number(player.seed));
  assert.equal(new Set(seeds).size, seeds.length);
}

test("P8 registry rejects a duplicate alias inside one definition", () => {
  assert.throws(() => validateGameTypeDefinitions([
    { id: "alpha", aliases: ["legacy", "legacy"] },
  ]), /Kolizja typu gry/);
});

test("P8 memory join is idempotent under concurrent duplicate same-user requests", async () => {
  const service = new TournamentService(null);
  const tournament = await createFourSeatTournament(service, "memory-duplicate");

  const settled = await Promise.allSettled([
    service.join(p2, tournament.tournamentId),
    service.join(p2, tournament.tournamentId),
  ]);

  assert.equal(settled.every((result) => result.status === "fulfilled"), true);
  const detail = await service.detail(owner, tournament.tournamentId);
  assert.equal(detail.players.filter((player) => player.userId === p2.userId).length, 1);
  assert.equal(detail.players.length, 2);
  assertUniqueSeeds(detail.players);
});

test("P8 memory join cannot overbook the final tournament seat", async () => {
  const service = new TournamentService(null);
  const tournament = await createFourSeatTournament(service, "memory-one-slot");
  await service.join(p2, tournament.tournamentId);
  await service.join(p3, tournament.tournamentId);

  const settled = await Promise.allSettled([
    service.join(p4, tournament.tournamentId),
    service.join(p5, tournament.tournamentId),
  ]);

  assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = settled.find((result) => result.status === "rejected");
  assert.equal(rejected?.reason?.code, "TOURNAMENT_FULL");
  const detail = await service.detail(owner, tournament.tournamentId);
  assert.equal(detail.players.length, 4);
  assertUniqueSeeds(detail.players);
});

test("P8 legacy unsupported tournament cannot start and remains unchanged", async () => {
  const service = new TournamentService(null);
  const tournamentId = "legacy-start";
  service.memory.set(tournamentId, {
    tournament: {
      tournamentId,
      ownerId: owner.userId,
      ownerName: owner.displayName,
      title: "Historical Chess Start",
      description: "",
      game: "szachy",
      format: "swiss",
      status: "registration",
      visibility: "public",
      maxPlayers: 16,
      rounds: 5,
      timeControl: "5+0",
      rated: true,
      startsAt: null,
      currentRound: 0,
      createdAt: new Date(0).toISOString(),
      finishedAt: null,
    },
    players: [
      { userId: owner.userId, displayName: owner.displayName, seed: 1, points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0, status: "active", joinedAt: new Date(0).toISOString() },
      { userId: p2.userId, displayName: p2.displayName, seed: 2, points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0, status: "active", joinedAt: new Date(0).toISOString() },
    ],
    matches: [],
  });

  await assert.rejects(service.start(owner, tournamentId), (error) => error.code === "TOURNAMENT_GAME_UNSUPPORTED");
  const stored = service.memory.get(tournamentId);
  assert.equal(stored.tournament.status, "registration");
  assert.equal(stored.tournament.currentRound, 0);
  assert.equal(stored.matches.length, 0);
});

test("P8 legacy unsupported tournament cannot report a result and remains unchanged", async () => {
  const service = new TournamentService(null);
  const tournamentId = "legacy-report";
  const matchId = "legacy-match";
  service.memory.set(tournamentId, {
    tournament: {
      tournamentId,
      ownerId: owner.userId,
      ownerName: owner.displayName,
      title: "Historical Chess Report",
      description: "",
      game: "szachy",
      format: "swiss",
      status: "live",
      visibility: "public",
      maxPlayers: 16,
      rounds: 5,
      timeControl: "5+0",
      rated: true,
      startsAt: null,
      currentRound: 1,
      createdAt: new Date(0).toISOString(),
      finishedAt: null,
    },
    players: [
      { userId: owner.userId, displayName: owner.displayName, seed: 1, points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0, status: "active", joinedAt: new Date(0).toISOString() },
      { userId: p2.userId, displayName: p2.displayName, seed: 2, points: 0, wins: 0, draws: 0, losses: 0, buchholz: 0, status: "active", joinedAt: new Date(0).toISOString() },
    ],
    matches: [{
      matchId,
      round: 1,
      board: 1,
      whiteId: owner.userId,
      whiteName: owner.displayName,
      blackId: p2.userId,
      blackName: p2.displayName,
      result: null,
      status: "scheduled",
      completedAt: null,
    }],
  });

  await assert.rejects(service.report(owner, tournamentId, matchId, "1-0"), (error) => error.code === "TOURNAMENT_GAME_UNSUPPORTED");
  const stored = service.memory.get(tournamentId);
  assert.equal(stored.matches[0].result, null);
  assert.equal(stored.matches[0].status, "scheduled");
  assert.equal(stored.players[0].points, 0);
  assert.equal(stored.players[1].points, 0);
});

test("P8 PostgreSQL: concurrent final-seat joins admit exactly one player", { skip: !databaseUrl }, async () => {
  const service = new TournamentService(databaseUrl);
  await service.ready;
  let tournamentId;
  try {
    const tournament = await createFourSeatTournament(service, `pg-one-slot-${randomUUID()}`);
    tournamentId = tournament.tournamentId;
    await service.join(p2, tournamentId);
    await service.join(p3, tournamentId);

    const settled = await Promise.allSettled([
      service.join(p4, tournamentId),
      service.join(p5, tournamentId),
    ]);

    assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = settled.find((result) => result.status === "rejected");
    assert.equal(rejected?.reason?.code, "TOURNAMENT_FULL");
    const detail = await service.detail(owner, tournamentId);
    assert.equal(detail.players.length, 4);
    assertUniqueSeeds(detail.players);
  } finally {
    await cleanup(service, tournamentId);
    await service.close();
  }
});

test("P8 PostgreSQL: two parallel joins receive distinct seeds", { skip: !databaseUrl }, async () => {
  const service = new TournamentService(databaseUrl);
  await service.ready;
  let tournamentId;
  try {
    const tournament = await createFourSeatTournament(service, `pg-two-slots-${randomUUID()}`);
    tournamentId = tournament.tournamentId;
    await service.join(p2, tournamentId);

    const settled = await Promise.allSettled([
      service.join(p3, tournamentId),
      service.join(p4, tournamentId),
    ]);

    assert.equal(settled.every((result) => result.status === "fulfilled"), true);
    const detail = await service.detail(owner, tournamentId);
    assert.equal(detail.players.length, 4);
    assertUniqueSeeds(detail.players);
  } finally {
    await cleanup(service, tournamentId);
    await service.close();
  }
});

test("P8 PostgreSQL: concurrent duplicate same-user join is idempotent", { skip: !databaseUrl }, async () => {
  const service = new TournamentService(databaseUrl);
  await service.ready;
  let tournamentId;
  try {
    const tournament = await createFourSeatTournament(service, `pg-duplicate-${randomUUID()}`);
    tournamentId = tournament.tournamentId;

    const settled = await Promise.allSettled([
      service.join(p2, tournamentId),
      service.join(p2, tournamentId),
    ]);

    assert.equal(settled.every((result) => result.status === "fulfilled"), true);
    const { rows } = await service.pool.query(
      "SELECT user_id,display_name,seed FROM gracz_tournament_players WHERE tournament_id=$1 ORDER BY seed",
      [tournamentId],
    );
    assert.equal(rows.filter((row) => row.user_id === p2.userId).length, 1);
    const row = rows.find((item) => item.user_id === p2.userId);
    assert.equal(row.display_name, p2.displayName);
    assert.equal(Number(row.seed), 2);
    assertUniqueSeeds(rows);
  } finally {
    await cleanup(service, tournamentId);
    await service.close();
  }
});

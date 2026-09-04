import assert from "node:assert/strict";
import test from "node:test";

import { TournamentService } from "../src/tournaments.js";

const databaseUrl = process.env.P1_H_01_DATABASE_URL || process.env.DATABASE_URL;
const owner = { userId: "owner", displayName: "Owner" };
const p2 = { userId: "p2", displayName: "P2" };
const p3 = { userId: "p3", displayName: "P3" };
const p4 = { userId: "p4", displayName: "P4" };

async function createFourPlayerKnockout(service) {
  const tournament = await service.create(owner, {
    title: `P1-H-01 ${Date.now()}`,
    game: "warcaby",
    format: "knockout",
    maxPlayers: 4,
    rounds: 2,
  });
  await service.join(p2, tournament.tournamentId);
  await service.join(p3, tournament.tournamentId);
  await service.join(p4, tournament.tournamentId);
  return service.start(owner, tournament.tournamentId);
}

async function cleanup(service, tournamentId) {
  if (!tournamentId) return;
  await service.pool.query("DELETE FROM gracz_tournaments WHERE tournament_id = $1", [tournamentId]).catch(() => {});
}

test("P1-H-01 PostgreSQL: concurrent last results advance knockout exactly once", { skip: !databaseUrl }, async () => {
  const service = new TournamentService(databaseUrl);
  await service.ready;
  let tournamentId;
  try {
    const started = await createFourPlayerKnockout(service);
    tournamentId = started.tournament.tournamentId;
    const roundOne = started.matches.filter((match) => match.round === 1);
    assert.equal(roundOne.length, 2);

    await Promise.all([
      service.report(owner, tournamentId, roundOne[0].matchId, "1-0"),
      service.report(owner, tournamentId, roundOne[1].matchId, "1-0"),
    ]);

    const current = await service.detail(owner, tournamentId);
    assert.equal(current.tournament.currentRound, 2);
    const roundTwo = current.matches.filter((match) => match.round === 2);
    assert.equal(roundTwo.length, 1);
    assert.equal(new Set(roundTwo.map((match) => match.board)).size, 1);
  } finally {
    await cleanup(service, tournamentId);
    await service.close();
  }
});

test("P1-H-01 PostgreSQL: duplicate concurrent result is applied once", { skip: !databaseUrl }, async () => {
  const service = new TournamentService(databaseUrl);
  await service.ready;
  let tournamentId;
  try {
    const started = await createFourPlayerKnockout(service);
    tournamentId = started.tournament.tournamentId;
    const match = started.matches.find((item) => item.round === 1);

    const settled = await Promise.allSettled([
      service.report(owner, tournamentId, match.matchId, "1-0"),
      service.report(owner, tournamentId, match.matchId, "1-0"),
    ]);

    assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = settled.find((result) => result.status === "rejected");
    assert.equal(rejected?.reason?.code, "MATCH_COMPLETED");

    const current = await service.detail(owner, tournamentId);
    const completed = current.matches.find((item) => item.matchId === match.matchId);
    assert.equal(completed.status, "completed");
    const winner = current.players.find((player) => player.userId === match.whiteId);
    assert.equal(winner.points, 1);
    assert.equal(winner.wins, 1);
  } finally {
    await cleanup(service, tournamentId);
    await service.close();
  }
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { TournamentService } from "../src/tournaments.js";

const databaseUrl = process.env.P1_H_01_DATABASE_URL || process.env.P1_U_01_DATABASE_URL || process.env.DATABASE_URL;
const owner = { userId: "owner", displayName: "Owner" };
const p2 = { userId: "p2", displayName: "P2" };
const p3 = { userId: "p3", displayName: "P3" };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function createTournament(service, suffix = "") {
  return service.create(owner, {
    title: `P8 start boundary ${suffix || randomUUID()}`,
    game: "checkers",
    format: "swiss",
    maxPlayers: 4,
    rounds: 3,
  });
}

async function cleanup(service, tournamentId) {
  if (!tournamentId || !service?.pool) return;
  await service.pool.query("DELETE FROM gracz_tournaments WHERE tournament_id=$1", [tournamentId]).catch(() => {});
}

function playerAppearsInRound(matches, userId, round = 1) {
  return matches.some((match) => match.round === round && (match.whiteId === userId || match.blackId === userId));
}

function wrapConnectPauseAfter(pool, matcher) {
  const originalConnect = pool.connect.bind(pool);
  const reached = deferred();
  const release = deferred();
  pool.connect = async () => {
    const client = await originalConnect();
    const originalQuery = client.query.bind(client);
    client.query = async (...args) => {
      const result = await originalQuery(...args);
      const text = typeof args[0] === "string" ? args[0] : args[0]?.text || "";
      if (matcher(text)) {
        reached.resolve();
        await release.promise;
      }
      return result;
    };
    return client;
  };
  return { reached: reached.promise, release: release.resolve };
}

test("P8 memory membership boundary serializes join/start and leave/start", async () => {
  {
    const service = new TournamentService(null);
    const tournament = await createTournament(service, "memory-join-first");
    await service.join(p2, tournament.tournamentId);

    const settled = await Promise.allSettled([
      service.join(p3, tournament.tournamentId),
      service.start(owner, tournament.tournamentId),
    ]);
    assert.equal(settled.every((result) => result.status === "fulfilled"), true);
    const detail = await service.detail(owner, tournament.tournamentId);
    assert.equal(detail.tournament.status, "live");
    assert.equal(detail.players.some((player) => player.userId === p3.userId), true);
    assert.equal(playerAppearsInRound(detail.matches, p3.userId), true);
  }

  {
    const service = new TournamentService(null);
    const tournament = await createTournament(service, "memory-start-first");
    await service.join(p2, tournament.tournamentId);

    const startPromise = service.start(owner, tournament.tournamentId);
    const joinPromise = service.join(p3, tournament.tournamentId);
    await startPromise;
    await assert.rejects(joinPromise, (error) => error.code === "REGISTRATION_CLOSED");
    const detail = await service.detail(owner, tournament.tournamentId);
    assert.equal(detail.players.some((player) => player.userId === p3.userId), false);
  }

  {
    const service = new TournamentService(null);
    const tournament = await createTournament(service, "memory-leave-first");
    await service.join(p2, tournament.tournamentId);
    await service.join(p3, tournament.tournamentId);

    const settled = await Promise.allSettled([
      service.leave(p3, tournament.tournamentId),
      service.start(owner, tournament.tournamentId),
    ]);
    assert.equal(settled.every((result) => result.status === "fulfilled"), true);
    const detail = await service.detail(owner, tournament.tournamentId);
    assert.equal(detail.players.some((player) => player.userId === p3.userId), false);
    assert.equal(playerAppearsInRound(detail.matches, p3.userId), false);
  }

  {
    const service = new TournamentService(null);
    const tournament = await createTournament(service, "memory-start-before-leave");
    await service.join(p2, tournament.tournamentId);
    await service.join(p3, tournament.tournamentId);

    const startPromise = service.start(owner, tournament.tournamentId);
    const leavePromise = service.leave(p3, tournament.tournamentId);
    await startPromise;
    await assert.rejects(leavePromise, (error) => error.code === "TOURNAMENT_STARTED");
    const detail = await service.detail(owner, tournament.tournamentId);
    assert.equal(detail.players.some((player) => player.userId === p3.userId), true);
    assert.equal(playerAppearsInRound(detail.matches, p3.userId), true);
  }
});

test("P8 PostgreSQL: join commits before start snapshot and joined player is paired", { skip: !databaseUrl, timeout: 10000 }, async () => {
  const joinService = new TournamentService(databaseUrl);
  const startService = new TournamentService(databaseUrl);
  await Promise.all([joinService.ready, startService.ready]);
  let tournamentId;
  try {
    const tournament = await createTournament(joinService, `pg-join-start-${randomUUID()}`);
    tournamentId = tournament.tournamentId;
    await joinService.join(p2, tournamentId);

    const gate = wrapConnectPauseAfter(joinService.pool, (sql) => sql.startsWith("INSERT INTO gracz_tournament_players"));
    const joinPromise = joinService.join(p3, tournamentId);
    await gate.reached;

    const startPromise = startService.start(owner, tournamentId);
    gate.release();

    await joinPromise;
    const started = await startPromise;
    assert.equal(started.tournament.status, "live");
    assert.equal(started.players.some((player) => player.userId === p3.userId), true);
    assert.equal(playerAppearsInRound(started.matches, p3.userId), true);
  } finally {
    await cleanup(startService, tournamentId);
    await Promise.all([joinService.close(), startService.close()]);
  }
});

test("P8 PostgreSQL: start is atomically invisible until all initial matches commit", { skip: !databaseUrl, timeout: 10000 }, async () => {
  const service = new TournamentService(databaseUrl);
  await service.ready;
  let tournamentId;
  const originalInsertMatches = service.insertMatches.bind(service);
  const enteredInsert = deferred();
  const releaseInsert = deferred();
  try {
    const tournament = await createTournament(service, `pg-start-visibility-${randomUUID()}`);
    tournamentId = tournament.tournamentId;
    await service.join(p2, tournamentId);

    service.insertMatches = async (id, matches, db) => {
      const [first, ...rest] = matches;
      if (first) await originalInsertMatches(id, [first], db);
      enteredInsert.resolve();
      await releaseInsert.promise;
      if (rest.length) await originalInsertMatches(id, rest, db);
    };

    const startPromise = service.start(owner, tournamentId);
    await enteredInsert.promise;

    const visibleTournament = await service.pool.query(
      "SELECT status,current_round FROM gracz_tournaments WHERE tournament_id=$1",
      [tournamentId],
    );
    const visibleMatches = await service.pool.query(
      "SELECT COUNT(*)::int AS count FROM gracz_tournament_matches WHERE tournament_id=$1 AND round=1",
      [tournamentId],
    );
    assert.equal(visibleTournament.rows[0].status, "registration");
    assert.equal(Number(visibleTournament.rows[0].current_round), 0);
    assert.equal(Number(visibleMatches.rows[0].count), 0);

    releaseInsert.resolve();
    const detail = await startPromise;
    assert.equal(detail.tournament.status, "live");
    assert.equal(detail.tournament.currentRound, 1);
    assert.equal(detail.matches.length >= 1, true);
  } finally {
    releaseInsert.resolve();
    await cleanup(service, tournamentId);
    await service.close();
  }
});

test("P8 PostgreSQL: leave commits before start snapshot and departing player is not paired", { skip: !databaseUrl, timeout: 10000 }, async () => {
  const leaveService = new TournamentService(databaseUrl);
  const startService = new TournamentService(databaseUrl);
  await Promise.all([leaveService.ready, startService.ready]);
  let tournamentId;
  try {
    const tournament = await createTournament(leaveService, `pg-leave-start-${randomUUID()}`);
    tournamentId = tournament.tournamentId;
    await leaveService.join(p2, tournamentId);
    await leaveService.join(p3, tournamentId);

    const gate = wrapConnectPauseAfter(leaveService.pool, (sql) => sql.startsWith("DELETE FROM gracz_tournament_players"));
    const leavePromise = leaveService.leave(p3, tournamentId);
    await gate.reached;

    const startPromise = startService.start(owner, tournamentId);
    gate.release();

    await leavePromise;
    const started = await startPromise;
    assert.equal(started.tournament.status, "live");
    assert.equal(started.players.some((player) => player.userId === p3.userId), false);
    assert.equal(playerAppearsInRound(started.matches, p3.userId), false);
  } finally {
    await cleanup(startService, tournamentId);
    await Promise.all([leaveService.close(), startService.close()]);
  }
});

test("P8 PostgreSQL: start wins membership lock and late join/leave fail closed", { skip: !databaseUrl, timeout: 10000 }, async () => {
  const startService = new TournamentService(databaseUrl);
  const mutationService = new TournamentService(databaseUrl);
  await Promise.all([startService.ready, mutationService.ready]);
  let tournamentId;
  const originalInsertMatches = startService.insertMatches.bind(startService);
  const enteredInsert = deferred();
  const releaseInsert = deferred();
  try {
    const tournament = await createTournament(startService, `pg-start-wins-${randomUUID()}`);
    tournamentId = tournament.tournamentId;
    await startService.join(p2, tournamentId);
    await startService.join(p3, tournamentId);

    startService.insertMatches = async (id, matches, db) => {
      enteredInsert.resolve();
      await releaseInsert.promise;
      return originalInsertMatches(id, matches, db);
    };

    const startPromise = startService.start(owner, tournamentId);
    await enteredInsert.promise;
    const joinPromise = mutationService.join({ userId: "late", displayName: "Late" }, tournamentId);
    const leavePromise = mutationService.leave(p3, tournamentId);
    releaseInsert.resolve();

    await startPromise;
    await assert.rejects(joinPromise, (error) => error.code === "REGISTRATION_CLOSED");
    await assert.rejects(leavePromise, (error) => error.code === "TOURNAMENT_STARTED");
    const detail = await startService.detail(owner, tournamentId);
    assert.equal(detail.players.some((player) => player.userId === p3.userId), true);
    assert.equal(playerAppearsInRound(detail.matches, p3.userId), true);
  } finally {
    releaseInsert.resolve();
    await cleanup(startService, tournamentId);
    await Promise.all([startService.close(), mutationService.close()]);
  }
});

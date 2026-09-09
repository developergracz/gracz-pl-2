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

function capture(promise) {
  return promise.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason }),
  );
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
    const joinResult = capture(service.join(p3, tournament.tournamentId));
    await startPromise;
    const outcome = await joinResult;
    assert.equal(outcome.status, "rejected");
    assert.equal(outcome.reason.code, "REGISTRATION_CLOSED");
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
    const leaveResult = capture(service.leave(p3, tournament.tournamentId));
    await startPromise;
    const outcome = await leaveResult;
    assert.equal(outcome.status, "rejected");
    assert.equal(outcome.reason.code, "TOURNAMENT_STARTED");
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
    const joinResult = capture(mutationService.join({ userId: "late", displayName: "Late" }, tournamentId));
    const leaveResult = capture(mutationService.leave(p3, tournamentId));
    releaseInsert.resolve();

    await startPromise;
    const [joinOutcome, leaveOutcome] = await Promise.all([joinResult, leaveResult]);
    assert.equal(joinOutcome.status, "rejected");
    assert.equal(joinOutcome.reason.code, "REGISTRATION_CLOSED");
    assert.equal(leaveOutcome.status, "rejected");
    assert.equal(leaveOutcome.reason.code, "TOURNAMENT_STARTED");
    const detail = await startService.detail(owner, tournamentId);
    assert.equal(detail.players.some((player) => player.userId === p3.userId), true);
    assert.equal(playerAppearsInRound(detail.matches, p3.userId), true);
  } finally {
    releaseInsert.resolve();
    await cleanup(startService, tournamentId);
    await Promise.all([startService.close(), mutationService.close()]);
  }
});

function wrapCreatePauseAfterTournamentInsert(pool) {
  const originalConnect = pool.connect.bind(pool);
  const reached = deferred();
  const release = deferred();
  let tournamentId = null;
  pool.connect = async () => {
    const client = await originalConnect();
    const originalQuery = client.query.bind(client);
    client.query = async (...args) => {
      const result = await originalQuery(...args);
      const text = typeof args[0] === "string" ? args[0] : args[0]?.text || "";
      if (text.startsWith("INSERT INTO gracz_tournaments")) {
        tournamentId = args[1]?.[0] || null;
        reached.resolve();
        await release.promise;
      }
      return result;
    };
    return client;
  };
  return { reached: reached.promise, release: release.resolve, getTournamentId: () => tournamentId };
}

test("P8 PostgreSQL: create keeps tournament and owner membership atomically invisible before commit", { skip: !databaseUrl, timeout: 10000 }, async () => {
  const createService = new TournamentService(databaseUrl);
  const observerService = new TournamentService(databaseUrl);
  await Promise.all([createService.ready, observerService.ready]);
  const gate = wrapCreatePauseAfterTournamentInsert(createService.pool);
  let tournamentId;
  try {
    const createPromise = createTournament(createService, `pg-create-visibility-${randomUUID()}`);
    await gate.reached;
    tournamentId = gate.getTournamentId();
    assert.ok(tournamentId);

    const visibleTournament = await observerService.pool.query(
      "SELECT COUNT(*)::int AS count FROM gracz_tournaments WHERE tournament_id=$1",
      [tournamentId],
    );
    const visibleOwner = await observerService.pool.query(
      "SELECT COUNT(*)::int AS count FROM gracz_tournament_players WHERE tournament_id=$1",
      [tournamentId],
    );
    assert.equal(Number(visibleTournament.rows[0].count), 0);
    assert.equal(Number(visibleOwner.rows[0].count), 0);

    gate.release();
    const created = await createPromise;
    assert.equal(created.tournamentId, tournamentId);
    const committed = await observerService.pool.query(
      "SELECT p.user_id,p.seed FROM gracz_tournaments t JOIN gracz_tournament_players p ON p.tournament_id=t.tournament_id WHERE t.tournament_id=$1",
      [tournamentId],
    );
    assert.equal(committed.rowCount, 1);
    assert.equal(committed.rows[0].user_id, owner.userId);
    assert.equal(Number(committed.rows[0].seed), 1);
  } finally {
    gate.release();
    await cleanup(observerService, tournamentId);
    await Promise.all([createService.close(), observerService.close()]);
  }
});

test("P8 PostgreSQL: concurrent join cannot claim owner seed during create", { skip: !databaseUrl, timeout: 10000 }, async () => {
  const createService = new TournamentService(databaseUrl);
  const joinService = new TournamentService(databaseUrl);
  await Promise.all([createService.ready, joinService.ready]);
  const gate = wrapCreatePauseAfterTournamentInsert(createService.pool);
  let tournamentId;
  try {
    const createPromise = createTournament(createService, `pg-create-join-${randomUUID()}`);
    await gate.reached;
    tournamentId = gate.getTournamentId();
    assert.ok(tournamentId);

    const concurrentJoin = capture(joinService.join(p2, tournamentId));
    gate.release();
    await createPromise;
    const firstJoinOutcome = await concurrentJoin;
    if (firstJoinOutcome.status === "rejected") {
      assert.equal(firstJoinOutcome.reason.code, "TOURNAMENT_NOT_FOUND");
      await joinService.join(p2, tournamentId);
    }

    const players = await joinService.pool.query(
      "SELECT user_id,seed FROM gracz_tournament_players WHERE tournament_id=$1 ORDER BY seed,user_id",
      [tournamentId],
    );
    assert.equal(players.rowCount, 2);
    const ownerRow = players.rows.find((row) => row.user_id === owner.userId);
    const joinedRow = players.rows.find((row) => row.user_id === p2.userId);
    assert.equal(Number(ownerRow?.seed), 1);
    assert.equal(Number(joinedRow?.seed), 2);
    assert.equal(new Set(players.rows.map((row) => Number(row.seed))).size, 2);
  } finally {
    gate.release();
    await cleanup(joinService, tournamentId);
    await Promise.all([createService.close(), joinService.close()]);
  }
});

test("P8 PostgreSQL: create rolls back tournament when mandatory owner membership insert fails", { skip: !databaseUrl, timeout: 10000 }, async () => {
  const createService = new TournamentService(databaseUrl);
  const observerService = new TournamentService(databaseUrl);
  await Promise.all([createService.ready, observerService.ready]);
  const originalConnect = createService.pool.connect.bind(createService.pool);
  let tournamentId = null;
  createService.pool.connect = async () => {
    const client = await originalConnect();
    const originalQuery = client.query.bind(client);
    client.query = async (...args) => {
      const text = typeof args[0] === "string" ? args[0] : args[0]?.text || "";
      if (text.startsWith("INSERT INTO gracz_tournaments")) tournamentId = args[1]?.[0] || null;
      if (text.startsWith("INSERT INTO gracz_tournament_players")) throw new Error("forced owner membership failure");
      return originalQuery(...args);
    };
    return client;
  };

  try {
    const outcome = await capture(createTournament(createService, `pg-create-rollback-${randomUUID()}`));
    assert.equal(outcome.status, "rejected");
    assert.match(String(outcome.reason?.message || ""), /forced owner membership failure/);
    assert.ok(tournamentId);

    const tournamentRows = await observerService.pool.query(
      "SELECT COUNT(*)::int AS count FROM gracz_tournaments WHERE tournament_id=$1",
      [tournamentId],
    );
    const playerRows = await observerService.pool.query(
      "SELECT COUNT(*)::int AS count FROM gracz_tournament_players WHERE tournament_id=$1",
      [tournamentId],
    );
    assert.equal(Number(tournamentRows.rows[0].count), 0);
    assert.equal(Number(playerRows.rows[0].count), 0);
  } finally {
    await cleanup(observerService, tournamentId);
    await Promise.all([createService.close(), observerService.close()]);
  }
});

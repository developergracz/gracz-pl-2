import assert from "node:assert/strict";
import test from "node:test";

import { CommonMatchRuntime, MatchRuntimeError } from "../src/match-runtime.js";
import { PostgresMatchLeaseCoordinator } from "../src/postgres-match-lease-coordinator.js";

const databaseUrl = process.env.P1_U_02_DATABASE_URL || process.env.DATABASE_URL;

function command(id, matchId = "owned-match") {
  return { commandId: id, gameType: "checkers", matchId, commandType: "match.action", actorUserId: "alice" };
}

test("P1-U-02 PostgreSQL: two runtime instances never execute the same match concurrently and fencing increases on handoff", { skip: !databaseUrl }, async () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const matchId = `owned_${suffix}`;
  const a = new PostgresMatchLeaseCoordinator(databaseUrl, { ownerId: `instance-a-${suffix}` });
  const b = new PostgresMatchLeaseCoordinator(databaseUrl, { ownerId: `instance-b-${suffix}` });
  let active = 0;
  let maxActive = 0;
  let releaseFirst;
  let firstEnteredResolve;
  const firstEntered = new Promise((resolve) => { firstEnteredResolve = resolve; });
  const holdFirst = new Promise((resolve) => { releaseFirst = resolve; });
  const seenTokens = [];

  const adapter = {
    async getView() { return { version: 0, view: {} }; },
    async execute(input, ownership) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      seenTokens.push({ commandId: input.commandId, token: ownership.fencingToken, ownerId: ownership.ownerId });
      if (input.commandId === "a") {
        firstEnteredResolve();
        await holdFirst;
      }
      active -= 1;
      return { version: input.commandId === "a" ? 1 : 2, view: { ok: true } };
    },
  };
  const runtimeA = new CommonMatchRuntime({ adapters: { checkers: adapter }, ownershipCoordinator: a });
  const runtimeB = new CommonMatchRuntime({ adapters: { checkers: adapter }, ownershipCoordinator: b });

  try {
    const first = runtimeA.execute(command("a", matchId));
    await firstEntered;
    let secondFinished = false;
    const second = runtimeB.execute(command("b", matchId)).then((value) => { secondFinished = true; return value; });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(secondFinished, false, "second instance must wait for distributed ownership");
    releaseFirst();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    assert.equal(maxActive, 1);
    assert.equal(firstResult.metadata.ownership.ownerId, `instance-a-${suffix}`);
    assert.equal(secondResult.metadata.ownership.ownerId, `instance-b-${suffix}`);
    assert.ok(secondResult.metadata.ownership.fencingToken > firstResult.metadata.ownership.fencingToken);
    assert.equal(seenTokens.length, 2);

    await assert.rejects(
      a.assertFence({ gameType: "checkers", matchId, ownerId: firstResult.metadata.ownership.ownerId, fencingToken: firstResult.metadata.ownership.fencingToken }),
      (error) => error instanceof MatchRuntimeError && error.code === "MATCH_STALE_OWNER" && error.status === 409,
    );
  } finally {
    await a.pool.query("DELETE FROM match_actor_leases WHERE game_type=$1 AND match_id=$2", ["checkers", matchId]).catch(() => {});
    await a.close();
    await b.close();
  }
});

test("P1-U-02 PostgreSQL: unrelated matches may execute concurrently", { skip: !databaseUrl }, async () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const coordinatorA = new PostgresMatchLeaseCoordinator(databaseUrl, { ownerId: `parallel-a-${suffix}` });
  const coordinatorB = new PostgresMatchLeaseCoordinator(databaseUrl, { ownerId: `parallel-b-${suffix}` });
  let active = 0;
  let maxActive = 0;
  let bothResolve;
  const both = new Promise((resolve) => { bothResolve = resolve; });
  const entered = [];
  const adapter = {
    async getView() { return { version: 0, view: {} }; },
    async execute(input) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      entered.push(input.matchId);
      if (entered.length === 2) bothResolve();
      await Promise.race([both, new Promise((resolve) => setTimeout(resolve, 500))]);
      active -= 1;
      return { version: 1, view: {} };
    },
  };
  const runtimeA = new CommonMatchRuntime({ adapters: { checkers: adapter }, ownershipCoordinator: coordinatorA });
  const runtimeB = new CommonMatchRuntime({ adapters: { checkers: adapter }, ownershipCoordinator: coordinatorB });
  const matchA = `parallel_a_${suffix}`;
  const matchB = `parallel_b_${suffix}`;
  try {
    await Promise.all([runtimeA.execute(command("a", matchA)), runtimeB.execute(command("b", matchB))]);
    assert.equal(maxActive, 2);
  } finally {
    await coordinatorA.pool.query("DELETE FROM match_actor_leases WHERE match_id IN ($1,$2)", [matchA, matchB]).catch(() => {});
    await coordinatorA.close();
    await coordinatorB.close();
  }
});

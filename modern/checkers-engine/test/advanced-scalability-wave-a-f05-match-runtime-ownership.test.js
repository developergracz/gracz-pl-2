import assert from "node:assert/strict";
import test from "node:test";

import { MatchRuntime, MatchRuntimeOwnershipError, MatchRuntimeVersionConflictError } from "../src/match-runtime.js";

function engine() {
  return {
    applyCommand({ state, command }) {
      return { ...state, value: state.value + command.delta };
    },
    project(state) {
      return structuredClone(state);
    },
    eventType() {
      return "match.updated";
    },
  };
}

test("AS-CAN-F05: stale cached epoch is invalidated, reclaimed once and command commits exactly once", async () => {
  const claims = [1, 2];
  const attempts = [];
  let applyCount = 0;
  let publishCount = 0;

  const repository = {
    async loadMatchRuntime() { return { version: 1, ownershipEpoch: 1, state: { value: 0 } }; },
    async claimMatchOwnership(matchId, ownerId) {
      assert.equal(matchId, "m1");
      assert.equal(ownerId, "node-a");
      return { ownershipEpoch: claims.shift() };
    },
    async executeMatchRuntimeCommand(input) {
      attempts.push({ epoch: input.ownershipEpoch, key: input.idempotencyKey, version: input.expectedVersion, hash: input.commandHash });
      if (input.ownershipEpoch === 1) throw new MatchRuntimeOwnershipError(input.matchId, 1);
      applyCount += 1;
      const state = await input.execute({ value: 0 });
      return { version: 2, state, replayed: false };
    },
  };

  const runtime = new MatchRuntime({ repository, engine: engine(), ownerId: "node-a", publish: async () => { publishCount += 1; } });
  await runtime.claimOwnership("m1");
  const result = await runtime.executeCommand({ matchId: "m1", expectedVersion: 1, idempotencyKey: "cmd-1", command: { delta: 1 } });

  assert.equal(result.ownershipEpoch, 2);
  assert.equal(result.version, 2);
  assert.deepEqual(result.snapshot, { value: 1 });
  assert.deepEqual(attempts.map((attempt) => attempt.epoch), [1, 2]);
  assert.equal(attempts[0].key, attempts[1].key);
  assert.equal(attempts[0].version, attempts[1].version);
  assert.equal(attempts[0].hash, attempts[1].hash);
  assert.equal(applyCount, 1);
  assert.equal(publishCount, 1);
});

test("AS-CAN-F05: explicit ownershipEpoch is authoritative and is not auto-reclaimed", async () => {
  let claims = 0;
  let attempts = 0;
  const repository = {
    async loadMatchRuntime() { return { version: 1, ownershipEpoch: 9, state: { value: 0 } }; },
    async claimMatchOwnership() { claims += 1; return { ownershipEpoch: 10 }; },
    async executeMatchRuntimeCommand(input) { attempts += 1; throw new MatchRuntimeOwnershipError(input.matchId, input.ownershipEpoch); },
  };
  const runtime = new MatchRuntime({ repository, engine: engine(), ownerId: "node-a" });

  await assert.rejects(
    runtime.executeCommand({ matchId: "m2", expectedVersion: 1, idempotencyKey: "cmd-2", command: { delta: 1 }, ownershipEpoch: 9 }),
    (error) => error?.code === "MATCH_RUNTIME_STALE_OWNERSHIP",
  );
  assert.equal(attempts, 1);
  assert.equal(claims, 0);
});

test("AS-CAN-F05: recovery is bounded to one reclaim and one retry", async () => {
  let claims = 0;
  let attempts = 0;
  const repository = {
    async loadMatchRuntime() { return { version: 1, ownershipEpoch: 1, state: { value: 0 } }; },
    async claimMatchOwnership() { claims += 1; return { ownershipEpoch: claims }; },
    async executeMatchRuntimeCommand(input) { attempts += 1; throw new MatchRuntimeOwnershipError(input.matchId, input.ownershipEpoch); },
  };
  const runtime = new MatchRuntime({ repository, engine: engine(), ownerId: "node-a" });

  await assert.rejects(
    runtime.executeCommand({ matchId: "m3", expectedVersion: 1, idempotencyKey: "cmd-3", command: { delta: 1 } }),
    (error) => error?.code === "MATCH_RUNTIME_STALE_OWNERSHIP",
  );
  assert.equal(claims, 2);
  assert.equal(attempts, 2);
});

test("AS-CAN-F05: version conflict after ownership reclaim stays a version conflict", async () => {
  let claims = 0;
  let attempts = 0;
  const repository = {
    async loadMatchRuntime() { return { version: 1, ownershipEpoch: 1, state: { value: 0 } }; },
    async claimMatchOwnership() { claims += 1; return { ownershipEpoch: claims }; },
    async executeMatchRuntimeCommand(input) {
      attempts += 1;
      if (attempts === 1) throw new MatchRuntimeOwnershipError(input.matchId, input.ownershipEpoch);
      throw new MatchRuntimeVersionConflictError(input.matchId, input.expectedVersion, 2);
    },
  };
  const runtime = new MatchRuntime({ repository, engine: engine(), ownerId: "node-a" });

  await assert.rejects(
    runtime.executeCommand({ matchId: "m4", expectedVersion: 1, idempotencyKey: "cmd-4", command: { delta: 1 } }),
    (error) => error?.code === "MATCH_RUNTIME_VERSION_CONFLICT" && error.currentVersion === 2,
  );
  assert.equal(claims, 2);
  assert.equal(attempts, 2);
});

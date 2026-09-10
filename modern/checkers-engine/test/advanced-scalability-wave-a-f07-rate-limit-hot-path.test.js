import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DistributedRateLimitError,
  PostgresDistributedTrafficGuard,
  SharedInfrastructureUnavailableError,
} from "../src/distributed-infrastructure.js";
import { createProductionRateLimitComposition } from "../src/production-rate-limit.js";

const databaseUrl = process.env.P1_AUD3_01_DATABASE_URL || "";
const requirePostgres = process.env.P1_AUD3_01_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("P1_AUD3_01_DATABASE_URL is required.");
const pgTest = databaseUrl ? test : test.skip;

function requestShape(path, method = "GET", source = `f07-${Date.now()}-${Math.random()}`) {
  return { method, url: path, headers: {}, socket: { remoteAddress: source } };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("AS-CAN-F07 static GET/HEAD stays locally limited without shared PostgreSQL admission", async () => {
  let localCalls = 0;
  let sharedCalls = 0;
  const localTrafficGuard = {
    assertAllowed() { localCalls += 1; },
    assertAccountAllowed() {},
    assertCredentialAttempt() {},
    assertRegistrationAttempt() {},
  };
  const sharedTrafficGuard = {
    async assertAllowed() { sharedCalls += 1; },
  };
  const { enforceRequest } = createProductionRateLimitComposition({ localTrafficGuard, sharedTrafficGuard });

  await enforceRequest(requestShape("/homepage-scale.css"));
  await enforceRequest(requestShape("/thousand.js"));
  await enforceRequest(requestShape("/favicon.ico", "HEAD"));
  assert.equal(localCalls, 3);
  assert.equal(sharedCalls, 0);

  await enforceRequest(requestShape("/ranking"));
  await enforceRequest(requestShape("/games/f07/state"));
  await enforceRequest(requestShape("/auth/login", "POST"));
  assert.equal(localCalls, 6);
  assert.equal(sharedCalls, 3);
});

test("AS-CAN-F07 dynamic API remains fail-closed while static assets remain locally protected", async () => {
  let localCalls = 0;
  const { enforceRequest } = createProductionRateLimitComposition({
    localTrafficGuard: {
      assertAllowed() { localCalls += 1; },
      assertAccountAllowed() {},
      assertCredentialAttempt() {},
      assertRegistrationAttempt() {},
    },
    sharedTrafficGuard: {
      async assertAllowed() { throw new SharedInfrastructureUnavailableError(); },
    },
  });

  await assert.rejects(enforceRequest(requestShape("/api/f07")), SharedInfrastructureUnavailableError);
  await assert.doesNotReject(enforceRequest(requestShape("/community.css")));
  assert.equal(localCalls, 2);
});

test("AS-CAN-F07 source contract keeps one authoritative batched path without a sequential per-scope database loop", async () => {
  const distributed = await readFile(new URL("../src/distributed-infrastructure.js", import.meta.url), "utf8");
  const production = await readFile(new URL("../src/production-rate-limit.js", import.meta.url), "utf8");
  assert.match(distributed, /consumeMany\(checks\)/);
  assert.match(distributed, /MAX_BATCH_REQUESTS\s*=\s*64/);
  assert.match(distributed, /UNNEST\(\$1::text\[\]\)/);
  assert.match(distributed, /FOR UPDATE/);
  assert.doesNotMatch(distributed, /for \(const \[key, limit, windowMs, scope\] of checks\)/);
  assert.match(production, /STATIC_ASSET_PATH/);
  assert.match(production, /requiresSharedLimiter\(request\)/);
});

pgTest("AS-CAN-F07 one dynamic request batches all request scopes into one PostgreSQL operation", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  const source = `f07-batch-${Date.now()}-${Math.random()}`;
  const request = requestShape("/f07-batch", "POST", source);
  try {
    await guard.ready;
    const before = guard.operations;
    await guard.assertAllowed(request);
    assert.equal(guard.operations - before, 1);

    const keys = [
      `global:${source}`,
      `endpoint:${source}:POST:/f07-batch`,
      `mutation:${source}`,
    ];
    const hashes = keys.map(sha256);
    const { rows } = await guard.pool.query(
      "SELECT key_hash::text AS key_hash,count FROM gracz_shared_rate_limits WHERE key_hash::text = ANY($1::text[]) ORDER BY key_hash",
      [hashes],
    );
    assert.equal(rows.length, 3);
    assert.ok(rows.every((row) => Number(row.count) === 1));
    assert.deepEqual(rows.map((row) => row.key_hash).sort(), [...hashes].sort());
  } finally {
    await guard.close();
  }
});

pgTest("AS-CAN-F07 batched credential scopes stay exact across two independent nodes", async () => {
  const guardA = new PostgresDistributedTrafficGuard(databaseUrl);
  const guardB = new PostgresDistributedTrafficGuard(databaseUrl);
  const account = `f07-account-${Date.now()}-${Math.random()}`;
  const request = requestShape("/auth/login", "POST", `f07-source-${Date.now()}-${Math.random()}`);
  try {
    await Promise.all([guardA.ready, guardB.ready]);
    for (let index = 0; index < 6; index += 1) {
      await (index % 2 ? guardA : guardB).assertCredentialAttempt({ request, accountId: account, endpoint: "login" });
    }
    await assert.rejects(
      guardA.assertCredentialAttempt({ request, accountId: account, endpoint: "login" }),
      (error) => error instanceof DistributedRateLimitError && error.scope === "credential-pair" && error.status === 429,
    );
    assert.equal(guardA.operations + guardB.operations, 7);
  } finally {
    await Promise.all([guardA.close(), guardB.close()]);
  }
});

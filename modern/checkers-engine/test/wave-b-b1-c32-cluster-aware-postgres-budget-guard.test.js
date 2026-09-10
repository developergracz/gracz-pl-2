import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pg from "pg";

import { loadConfig } from "../src/config.js";
import poolBudget from "../src/postgres-pool-budget.cjs";
import {
  POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT_CODE,
  acquirePostgresStartupSchemaLock,
  withPostgresStartupSchemaLock,
} from "../src/postgres-startup-schema-lock.js";
import { startApplication } from "../src/start.js";

const {
  DEFAULT_POSTGRES_POOL_BUDGET,
  MAX_POSTGRES_REPLICA_COUNT,
  POSTGRES_RESOURCE_PROFILE,
  aggregatePoolMax,
  aggregateEmbeddedPersistentListeners,
  aggregateExternalPersistentClients,
  aggregateStartupTemporaryClients,
  aggregateClusterGlobalClients,
  configuredPoolBudget,
  connectionBudgetPlan,
  resolvePostgresReplicaCount,
  validateClusterConnectionBudget,
} = poolBudget;

const DATABASE_URL = process.env.B1_C32_DATABASE_URL || "";
const AUTH = "c32-auth-secret-material-for-production-test-0001";
const MESSAGE = "c32-message-key-material-for-production-test-001";
const ATTACHMENT = "c32-attachment-key-material-production-test-001";
const MFA = "c32-mfa-key-material-for-production-test-00001";

function productionEnvironment(overrides = {}) {
  return {
    NODE_ENV: "production",
    DATABASE_URL: DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/gracz_b1_c32",
    POSTGRES_REPLICA_COUNT: "1",
    POSTGRES_POOL_BUDGET: "64",
    AUTH_SECRET: AUTH,
    MESSAGE_ENCRYPTION_KEY: MESSAGE,
    ATTACHMENT_ENCRYPTION_KEY: ATTACHMENT,
    MFA_ENCRYPTION_KEY: MFA,
    ...overrides,
  };
}

function syntheticProfile({ poolMax, external = 0, startup = 0, global = 0 }) {
  return Object.freeze({
    pools: Object.freeze([
      Object.freeze({
        id: "synthetic",
        owner: "Synthetic",
        file: "synthetic.js",
        max: poolMax,
        mainConstructor: "synthetic",
        embeddedPersistentListeners: Object.freeze([]),
      }),
    ]),
    externalPersistentClients: Object.freeze(
      external ? [Object.freeze({ id: "external", count: external })] : [],
    ),
    startupTemporaryClients: Object.freeze(
      startup ? [Object.freeze({ id: "startup", count: startup })] : [],
    ),
    clusterGlobalClients: Object.freeze(
      global ? [Object.freeze({ id: "global", count: global })] : [],
    ),
  });
}

function classSegment(source, owner) {
  const matcher = new RegExp(`(?:export\\s+)?class\\s+${owner}\\b`);
  const match = matcher.exec(source);
  assert.ok(match, `missing class ${owner}`);
  const start = match.index;
  const rest = source.slice(start + match[0].length);
  const next = rest.search(/\n(?:export\s+)?class\s+[A-Za-z0-9_]+\b/);
  return next === -1 ? source.slice(start) : source.slice(start, start + match[0].length + next);
}

test("B1-C32 canonical profile models actual post-C35 production ownership without double-counting listeners", () => {
  assert.equal(POSTGRES_RESOURCE_PROFILE.pools.length, 14);
  assert.equal(aggregatePoolMax(), 48);
  assert.equal(DEFAULT_POSTGRES_POOL_BUDGET, 48);
  assert.equal(aggregateEmbeddedPersistentListeners(), 3);
  assert.equal(aggregateExternalPersistentClients(), 1);
  assert.equal(aggregateStartupTemporaryClients(), 1);
  assert.equal(aggregateClusterGlobalClients(), 0);

  const ids = POSTGRES_RESOURCE_PROFILE.pools.map((entry) => entry.id);
  assert.equal(ids.includes("secure-accounts"), false);
  assert.equal(ids.includes("auth-sessions"), false);
  assert.equal(ids.includes("message-attachments"), false);
  assert.equal(ids.includes("newsletter-lifecycle"), false);
  assert.equal(ids.includes("global-chat"), false);

  assert.deepEqual(
    POSTGRES_RESOURCE_PROFILE.externalPersistentClients.map((entry) => [entry.id, entry.count]),
    [["global-chat-listen", 1]],
  );
  assert.deepEqual(
    POSTGRES_RESOURCE_PROFILE.startupTemporaryClients.map((entry) => [entry.id, entry.count]),
    [["startup-schema-lock", 1]],
  );

  const embedded = POSTGRES_RESOURCE_PROFILE.pools.flatMap(
    (entry) => entry.embeddedPersistentListeners.map((listener) => [entry.id, listener.id, listener.count]),
  );
  assert.deepEqual(embedded, [
    ["checkers-realtime", "checkers-realtime-listen", 1],
    ["thousand", "thousand-realtime-listen", 1],
    ["gomoku", "gomoku-realtime-listen", 1],
  ]);

  const plan = connectionBudgetPlan({
    replicaCount: 1,
    maxConnections: 100,
    reservedConnections: 0,
    superuserReservedConnections: 3,
    environment: { POSTGRES_POOL_BUDGET: "64" },
  });
  assert.equal(plan.poolMaxPerReplica, 48);
  assert.equal(plan.externalDedicatedPerReplica, 1);
  assert.equal(plan.steadyEnvelope, 49);
  assert.equal(plan.startupOverlapPerReplica, 1);
  assert.equal(plan.startupEnvelope, 50);
  assert.equal(plan.embeddedPersistentListenersPerReplica, 3);
});

test("B1-C32 process-local budget cannot be widened above canonical production pool max", () => {
  assert.equal(configuredPoolBudget({}), 48);
  assert.equal(configuredPoolBudget({ POSTGRES_POOL_BUDGET: "48" }), 48);
  assert.equal(configuredPoolBudget({ POSTGRES_POOL_BUDGET: "64" }), 48);
  assert.throws(
    () => configuredPoolBudget({ POSTGRES_POOL_BUDGET: "47" }),
    (error) => error?.code === "POSTGRES_POOL_BUDGET_EXCEEDED",
  );
});

test("B1-C32 canonical profile remains visibly aligned with production pool-owner source and main composition", async () => {
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  const byFile = new Map();

  for (const entry of POSTGRES_RESOURCE_PROFILE.pools) {
    assert.ok(main.includes(entry.mainConstructor), `main.js missing production owner ${entry.owner}`);
    const entries = byFile.get(entry.file) || [];
    entries.push(entry);
    byFile.set(entry.file, entries);
  }

  for (const [file, entries] of byFile) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
    assert.equal(
      (source.match(/new\s+Pool\s*\(/g) || []).length,
      entries.length,
      `${file} physical Pool constructor count drifted from canonical profile`,
    );
    for (const entry of entries) {
      const segment = classSegment(source, entry.owner);
      const poolIndex = segment.indexOf("new Pool(");
      assert.ok(poolIndex >= 0, `${entry.owner} no longer owns the profiled pool`);
      const poolWindow = segment.slice(poolIndex, poolIndex + 500);
      if (entry.usesDefaultPoolMax) {
        assert.equal(entry.max, 3);
        assert.doesNotMatch(poolWindow, /\bmax\s*:/, `${entry.owner} no longer uses canonical default max`);
      } else {
        assert.match(poolWindow, new RegExp(`\\bmax\\s*:\\s*${entry.max}\\b`), `${entry.owner} max drifted`);
      }
    }
  }

  const secureAccounts = await readFile(new URL("../src/secure-accounts.js", import.meta.url), "utf8");
  assert.doesNotMatch(secureAccounts, /new\s+Pool\s*\(/);
  assert.match(secureAccounts, /this\.pool\s*=\s*baseService\.pool/);

  const authSessions = await readFile(new URL("../src/auth-sessions.js", import.meta.url), "utf8");
  assert.doesNotMatch(authSessions, /new\s+Pool\s*\(/);
  assert.doesNotMatch(authSessions, /new\s+Client\s*\(/);
  assert.doesNotMatch(authSessions, /this\.pool\.end\s*\(/);
  assert.doesNotMatch(authSessions, /from\s+["\']pg["\']/);
  assert.match(authSessions, /this\.pool\s*=\s*pool/);
  assert.match(main, /new PostgresAuthSessionStore\(baseAccounts\.pool\)/);

  const messageAttachments = await readFile(new URL("../src/message-attachments.js", import.meta.url), "utf8");
  assert.doesNotMatch(messageAttachments, /new\s+Pool\s*\(/);
  assert.doesNotMatch(messageAttachments, /new\s+Client\s*\(/);
  assert.doesNotMatch(messageAttachments, /this\.pool\.end\s*\(/);
  assert.doesNotMatch(messageAttachments, /from\s+["\']pg["\']/);
  assert.match(messageAttachments, /this\.pool\s*=\s*pool/);
  assert.match(main, /new MessageAttachmentService\(baseAccounts\.pool,config\.attachmentEncryptionKey\)/);

  const globalChat = await readFile(new URL("../src/distributed-global-chat.js", import.meta.url), "utf8");
  assert.doesNotMatch(globalChat, /new\s+Pool\s*\(/);
  assert.match(globalChat, /return\(\)=>new Client\(options\)/);
  assert.ok(main.includes(POSTGRES_RESOURCE_PROFILE.externalPersistentClients[0].mainConstructor));

  const startupLock = await readFile(new URL("../src/postgres-startup-schema-lock.js", import.meta.url), "utf8");
  assert.equal((startupLock.match(/new\s+Client\s*\(/g) || []).length, 1);

  const checkersInfra = await readFile(new URL("../src/distributed-infrastructure.js", import.meta.url), "utf8");
  const thousandRealtime = await readFile(new URL("../src/thousand-realtime.js", import.meta.url), "utf8");
  const gomokuRealtime = await readFile(new URL("../src/gomoku-realtime.js", import.meta.url), "utf8");
  assert.match(classSegment(checkersInfra, "PostgresRealtimeHub"), /acquireClient\(this\.pool,/);
  assert.match(thousandRealtime, /this\.pool\.connect\(\)/);
  assert.match(gomokuRealtime, /this\.pool\.connect\(\)/);
});

test("B1-C32 cluster formula rejects unsafe current multi-replica topology", () => {
  const fixture = {
    maxConnections: 100,
    reservedConnections: 0,
    superuserReservedConnections: 3,
    environment: { POSTGRES_POOL_BUDGET: "64" },
  };

  const one = validateClusterConnectionBudget({ ...fixture, replicaCount: 1 });
  assert.equal(one.safe, true);
  assert.equal(one.safeApplicationCapacity, 87);
  assert.equal(one.steadyEnvelope, 49);
  assert.equal(one.startupEnvelope, 50);

  for (const replicas of [2, 3, 4]) {
    assert.throws(
      () => validateClusterConnectionBudget({ ...fixture, replicaCount: replicas }),
      (error) => {
        assert.equal(error?.code, "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED");
        assert.equal(error?.plan?.replicaCount, replicas);
        return true;
      },
    );
  }
});

test("B1-C32 server reserved slots and operational headroom are independent deductions", () => {
  const plan = connectionBudgetPlan({
    replicaCount: 1,
    maxConnections: 100,
    reservedConnections: 2,
    superuserReservedConnections: 3,
    operationalHeadroom: 12,
    profile: syntheticProfile({ poolMax: 10 }),
  });
  assert.equal(plan.reservedConnections, 2);
  assert.equal(plan.superuserReservedConnections, 3);
  assert.equal(plan.serverReservedConnections, 5);
  assert.equal(plan.operationalHeadroom, 12);
  assert.equal(plan.safeApplicationCapacity, 83);
  assert.equal(plan.formula.capacity, "100 - 2 reserved - 3 superuser_reserved - 12 operational = 83");
});

test("B1-C32 exact steady and startup capacity boundaries are fail-closed only above equality", () => {
  const steadyEqual = connectionBudgetPlan({
    replicaCount: 1,
    maxConnections: 50,
    reservedConnections: 0,
    superuserReservedConnections: 0,
    profile: syntheticProfile({ poolMax: 40 }),
  });
  assert.equal(steadyEqual.safeApplicationCapacity, 40);
  assert.equal(steadyEqual.steadyEnvelope, 40);
  assert.equal(steadyEqual.startupEnvelope, 40);
  assert.equal(steadyEqual.safe, true);

  assert.throws(
    () => validateClusterConnectionBudget({
      replicaCount: 1,
      maxConnections: 50,
      reservedConnections: 0,
      superuserReservedConnections: 0,
      profile: syntheticProfile({ poolMax: 41 }),
    }),
    (error) => error?.code === "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED",
  );

  const startupEqual = connectionBudgetPlan({
    replicaCount: 1,
    maxConnections: 50,
    reservedConnections: 0,
    superuserReservedConnections: 0,
    profile: syntheticProfile({ poolMax: 39, startup: 1 }),
  });
  assert.equal(startupEqual.steadyEnvelope, 39);
  assert.equal(startupEqual.startupEnvelope, 40);
  assert.equal(startupEqual.safeApplicationCapacity, 40);
  assert.equal(startupEqual.safe, true);

  assert.throws(
    () => validateClusterConnectionBudget({
      replicaCount: 1,
      maxConnections: 50,
      reservedConnections: 0,
      superuserReservedConnections: 0,
      profile: syntheticProfile({ poolMax: 40, startup: 1 }),
    }),
    (error) => error?.code === "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED",
  );
});

test("B1-C32 replica-count contract rejects malformed values and production omission", () => {
  for (const value of [
    0,
    -1,
    1.5,
    Number.NaN,
    MAX_POSTGRES_REPLICA_COUNT + 1,
    "0",
    "-1",
    "1.5",
    "NaN",
    "abc",
    String(MAX_POSTGRES_REPLICA_COUNT + 1),
  ]) {
    assert.throws(
      () => resolvePostgresReplicaCount({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example.invalid/db",
        POSTGRES_REPLICA_COUNT: value,
      }),
      /POSTGRES_REPLICA_COUNT/,
    );
  }
  assert.throws(
    () => resolvePostgresReplicaCount({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example.invalid/db",
    }),
    (error) => error?.code === "POSTGRES_REPLICA_COUNT_REQUIRED",
  );
  assert.throws(
    () => resolvePostgresReplicaCount({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example.invalid/db",
      POSTGRES_REPLICA_COUNT: " ",
    }),
    (error) => error?.code === "POSTGRES_REPLICA_COUNT_REQUIRED",
  );
  assert.equal(resolvePostgresReplicaCount({ NODE_ENV: "test", DATABASE_URL: "postgres://example.invalid/db" }), 1);
});

test("B1-C32 loadConfig enforces explicit replica count only for PostgreSQL-backed production", () => {
  assert.throws(
    () => loadConfig(productionEnvironment({ POSTGRES_REPLICA_COUNT: undefined })),
    (error) => error?.code === "POSTGRES_REPLICA_COUNT_REQUIRED",
  );

  const config = loadConfig(productionEnvironment());
  assert.equal(config.postgresReplicaCount, 1);
  assert.equal(config.postgresPoolBudget.aggregateMax, 48);
  assert.equal(config.postgresPoolBudget.budget, 48);
  assert.equal(config.postgresPoolBudget.requestedBudget, 64);

  const noDatabase = loadConfig({
    ...productionEnvironment({ DATABASE_URL: undefined, POSTGRES_REPLICA_COUNT: undefined }),
  });
  assert.equal(noDatabase.postgresReplicaCount, null);
});

test("B1-C32 pg-secure-preload preserves TLS and rejects hidden process allocation beyond canonical 48", () => {
  const preload = fileURLToPath(new URL("../src/pg-secure-preload.cjs", import.meta.url));

  const allocationScript = String.raw`
    const pg = require("pg");
    if (pg.Pool.graczPoolBudget.aggregateMax !== 48) process.exit(21);
    if (pg.Pool.graczPoolBudget.budget !== 48) process.exit(22);
    const pools = [];
    for (let i = 0; i < 9; i += 1) pools.push(new pg.Pool({ max: 5 }));
    pools.push(new pg.Pool({ max: 3 }));
    if (pg.Pool.graczAllocatedPoolMax !== 48) process.exit(23);
    try {
      new pg.Pool({ max: 1 });
      process.exit(24);
    } catch (error) {
      if (error.code !== "POSTGRES_POOL_BUDGET_EXCEEDED") process.exit(25);
    }
  `;
  const allocation = spawnSync(process.execPath, ["--require", preload, "-e", allocationScript], {
    encoding: "utf8",
    env: { ...process.env, POSTGRES_POOL_BUDGET: "64" },
  });
  assert.equal(allocation.status, 0, allocation.stderr || allocation.stdout);

  const tlsScript = String.raw`
    const pg = require("pg");
    const pool = new pg.Pool({
      connectionString: "postgres://user:password@database.example.com/gracz",
      max: 1,
      ssl: false
    });
    if (!pool.options.ssl || pool.options.ssl.rejectUnauthorized !== true) process.exit(31);
  `;
  const tls = spawnSync(process.execPath, ["--require", preload, "-e", tlsScript], {
    encoding: "utf8",
    env: { ...process.env, POSTGRES_POOL_BUDGET: "64" },
  });
  assert.equal(tls.status, 0, tls.stderr || tls.stdout);
});

test("B1-C32 live PostgreSQL capacity snapshot uses the same single startup Client", { skip: !DATABASE_URL }, async () => {
  const OriginalClient = pg.Client;
  let constructedClients = 0;
  class CountingClient extends OriginalClient {
    constructor(...args) {
      super(...args);
      constructedClients += 1;
    }
  }

  pg.Client = CountingClient;
  let lock;
  try {
    const module = await import("../src/postgres-startup-schema-lock.js?b1-c32-single-client");
    lock = await module.acquirePostgresStartupSchemaLock(DATABASE_URL);
    assert.equal(constructedClients, 1, "capacity snapshot must not create a second startup client");
    assert.ok(lock.capacity.serverVersionNum >= 100000);
    assert.ok(lock.capacity.maxConnections >= 1);
    assert.ok(lock.capacity.superuserReservedConnections >= 0);
    assert.ok(lock.capacity.reservedConnections >= 0);
    assert.ok(lock.capacity.backendPid >= 1);
    if (lock.capacity.serverVersionNum >= 160000) {
      assert.equal(lock.capacity.reservedConnectionsSupported, true);
    } else {
      assert.equal(lock.capacity.reservedConnectionsSupported, false);
      assert.equal(lock.capacity.reservedConnections, 0);
    }

    console.log("[B1-C32 capacity]", JSON.stringify({
      serverVersionNum: lock.capacity.serverVersionNum,
      maxConnections: lock.capacity.maxConnections,
      reservedConnections: lock.capacity.reservedConnections,
      reservedConnectionsSupported: lock.capacity.reservedConnectionsSupported,
      superuserReservedConnections: lock.capacity.superuserReservedConnections,
    }));
    console.log("[B1-C32 current-topology]", JSON.stringify([1, 2, 3, 4].map((replicaCount) => {
      const plan = connectionBudgetPlan({
        replicaCount,
        maxConnections: lock.capacity.maxConnections,
        reservedConnections: lock.capacity.reservedConnections,
        superuserReservedConnections: lock.capacity.superuserReservedConnections,
        environment: { POSTGRES_POOL_BUDGET: "64" },
      });
      return {
        replicaCount,
        steadyEnvelope: plan.steadyEnvelope,
        startupEnvelope: plan.startupEnvelope,
        serverReservedConnections: plan.serverReservedConnections,
        operationalHeadroom: plan.operationalHeadroom,
        safeApplicationCapacity: plan.safeApplicationCapacity,
        safe: plan.safe,
      };
    })));
  } finally {
    await lock?.release().catch(() => {});
    pg.Client = OriginalClient;
  }
});

test("B1-C32 startup lock still serializes concurrent startup work", { skip: !DATABASE_URL, timeout: 10_000 }, async () => {
  let releaseFirst;
  let firstEnteredResolve;
  const firstEntered = new Promise((resolve) => { firstEnteredResolve = resolve; });
  let secondEntered = false;

  const first = withPostgresStartupSchemaLock(DATABASE_URL, async () => {
    firstEnteredResolve();
    await new Promise((resolve) => { releaseFirst = resolve; });
  });
  await firstEntered;

  const second = withPostgresStartupSchemaLock(DATABASE_URL, async () => {
    secondEntered = true;
  });

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(secondEntered, false, "second startup must remain serialized behind advisory lock");
  releaseFirst();
  await Promise.all([first, second]);
  assert.equal(secondEntered, true);
});

test("B1-C32 startup lock retains bounded timeout and releases after work failure", { skip: !DATABASE_URL, timeout: 10_000 }, async () => {
  const first = await acquirePostgresStartupSchemaLock(DATABASE_URL);
  try {
    await assert.rejects(
      () => acquirePostgresStartupSchemaLock(DATABASE_URL, { timeoutMs: 75 }),
      (error) => error?.code === POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT_CODE,
    );
  } finally {
    await first.release();
  }

  await assert.rejects(
    () => withPostgresStartupSchemaLock(DATABASE_URL, async () => {
      throw Object.assign(new Error("controlled startup work failure"), { code: "C32_CONTROLLED_FAILURE" });
    }),
    (error) => error?.code === "C32_CONTROLLED_FAILURE",
  );

  const afterFailure = await acquirePostgresStartupSchemaLock(DATABASE_URL, { timeoutMs: 500 });
  await afterFailure.release();
});

test("B1-C32 unsafe real-PostgreSQL topology is rejected before main initialization", { skip: !DATABASE_URL, timeout: 10_000 }, async () => {
  let mainCalled = false;
  await assert.rejects(
    () => startApplication({
      environment: productionEnvironment({ DATABASE_URL, POSTGRES_REPLICA_COUNT: "2" }),
      importMain: async () => {
        mainCalled = true;
        return "should-not-run";
      },
    }),
    (error) => {
      assert.equal(error?.code, "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED");
      assert.equal(error?.plan?.replicaCount, 2);
      assert.equal(error?.plan?.poolMaxPerReplica, 48);
      assert.equal(error?.plan?.externalDedicatedPerReplica, 1);
      assert.equal(error?.plan?.startupOverlapPerReplica, 1);
      return true;
    },
  );
  assert.equal(mainCalled, false);
});

test("B1-C32 safe real-PostgreSQL topology proceeds beyond the budget gate", { skip: !DATABASE_URL, timeout: 10_000 }, async () => {
  let mainCalled = 0;
  const result = await startApplication({
    environment: productionEnvironment({ DATABASE_URL, POSTGRES_REPLICA_COUNT: "1" }),
    importMain: async () => {
      mainCalled += 1;
      return "main-initialized";
    },
  });
  assert.equal(result, "main-initialized");
  assert.equal(mainCalled, 1);
});

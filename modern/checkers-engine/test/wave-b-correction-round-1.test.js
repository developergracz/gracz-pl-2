import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const budget = require("../src/postgres-pool-budget.cjs");

const environment = { POSTGRES_POOL_BUDGET: "64" };

test("Wave B connection budget accepts the 1-replica PostgreSQL=100 topology", () => {
  const plan = budget.validateClusterConnectionBudget({
    replicaCount: 1,
    maxConnections: 100,
    reservedConnections: 3,
    environment,
  });
  assert.equal(plan.profilePoolMaxPerReplica, 62);
  assert.equal(plan.dedicatedListenPerReplica, 1);
  assert.equal(plan.ordinaryPoolMaxPerReplica, 61);
  assert.equal(plan.operationalHeadroom, 10);
  assert.equal(plan.safe, true);
});

test("Wave B connection budget rejects unsafe 2-replica PostgreSQL=100 topology", () => {
  assert.throws(
    () => budget.validateClusterConnectionBudget({ replicaCount: 2, maxConnections: 100, reservedConnections: 3, environment }),
    (error) => error?.code === "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED" && error.plan?.configuredTotalApplicationEnvelope === 124,
  );
});

test("Wave B connection budget rejects unsafe 4-replica PostgreSQL=100 topology", () => {
  assert.throws(
    () => budget.validateClusterConnectionBudget({ replicaCount: 4, maxConnections: 100, reservedConnections: 3, environment }),
    (error) => error?.code === "POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED" && error.plan?.configuredTotalApplicationEnvelope === 248,
  );
});

test("Wave B connection budget accepts topology only when measured max_connections provides headroom", () => {
  const two = budget.validateClusterConnectionBudget({ replicaCount: 2, maxConnections: 160, reservedConnections: 3, environment });
  const four = budget.validateClusterConnectionBudget({ replicaCount: 4, maxConnections: 320, reservedConnections: 3, environment });
  assert.equal(two.safe, true);
  assert.equal(four.safe, true);
  assert.ok(two.operationalHeadroom >= 16);
  assert.ok(four.operationalHeadroom >= 32);
});

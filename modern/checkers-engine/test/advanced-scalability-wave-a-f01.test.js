import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import poolBudget from "../src/postgres-pool-budget.cjs";
import { loadConfig } from "../src/config.js";

const {
  DEFAULT_POSTGRES_POOL_MAX,
  DEFAULT_POSTGRES_POOL_BUDGET,
  POSTGRES_POOL_PROFILE,
  aggregatePoolMax,
  aggregateDedicatedListen,
  validateConfiguredPoolBudget,
} = poolBudget;

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = join(HERE, "..");
const SRC = join(ENGINE_ROOT, "src");
const AUTH = "auth-secret-material-for-pool-budget-0001";

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("AS-CAN-F01: canonical profile inventories all 19 PostgreSQL pools", () => {
  assert.equal(POSTGRES_POOL_PROFILE.length, 19);
  assert.equal(aggregatePoolMax(), 62);
  assert.equal(aggregateDedicatedListen(), 1);
  assert.equal(DEFAULT_POSTGRES_POOL_MAX, 3);
  assert.equal(DEFAULT_POSTGRES_POOL_BUDGET, 64);

  const ids = POSTGRES_POOL_PROFILE.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    POSTGRES_POOL_PROFILE.filter((entry) => entry.dedicatedListen > 0),
    [Object.freeze({ id: "checkers-realtime", file: "distributed-infrastructure.js", max: 6, dedicatedListen: 1 })],
  );
});

test("AS-CAN-F01: every production pool is covered by an explicit source or bootstrap max", () => {
  for (const entry of POSTGRES_POOL_PROFILE) {
    const source = readFileSync(join(SRC, entry.file), "utf8");
    assert.match(source, /new Pool\s*\(/, `${entry.id} nie tworzy oczekiwanej puli PostgreSQL`);
    if (entry.usesBootstrapDefault) {
      assert.equal(entry.max, DEFAULT_POSTGRES_POOL_MAX, `${entry.id} ma niespójny bootstrap default`);
      continue;
    }
    assert.match(
      source,
      new RegExp(`max\\s*:\\s*${escaped(String(entry.max))}\\b`),
      `${entry.id} nie ma jawnego max=${entry.max}`,
    );
  }
});

test("AS-CAN-F01: current Wave-A profile fits declared per-replica budget", () => {
  const result = validateConfiguredPoolBudget({ POSTGRES_POOL_BUDGET: "64" });
  assert.deepEqual(result, { budget: 64, aggregateMax: 62, dedicatedListen: 1 });
});

test("AS-CAN-F01: over-budget configuration fails closed", () => {
  assert.throws(
    () => validateConfiguredPoolBudget({ POSTGRES_POOL_BUDGET: "61" }),
    (error) => error?.code === "POSTGRES_POOL_BUDGET_EXCEEDED" && error.aggregateMax === 62,
  );
  assert.throws(
    () => loadConfig({ AUTH_SECRET: AUTH, POSTGRES_POOL_BUDGET: "61" }),
    (error) => error?.code === "POSTGRES_POOL_BUDGET_EXCEEDED",
  );
});

test("AS-CAN-F01: application config exposes validated budget evidence", () => {
  const config = loadConfig({ AUTH_SECRET: AUTH, POSTGRES_POOL_BUDGET: "64" });
  assert.deepEqual(config.postgresPoolBudget, { budget: 64, aggregateMax: 62, dedicatedListen: 1 });
  assert.equal(Object.isFrozen(config.postgresPoolBudget), true);
});

test("AS-CAN-F01: preload clamps implicit pools to max=3 and enforces runtime aggregate", () => {
  const preload = join(SRC, "pg-secure-preload.cjs");
  const script = `
    const pg = require("pg");
    const pools = [];
    for (let i = 0; i < 21; i += 1) {
      const pool = new pg.Pool({ connectionString: "postgres://u:p@localhost/db" });
      if (pool.options.max !== 3) process.exit(20);
      pools.push(pool);
    }
    if (pg.Pool.graczAllocatedPoolMax !== 63) process.exit(21);
    try {
      new pg.Pool({ connectionString: "postgres://u:p@localhost/db" });
      process.exit(22);
    } catch (error) {
      if (error?.code !== "POSTGRES_POOL_BUDGET_EXCEEDED") process.exit(23);
    }
  `;
  const child = spawnSync(process.execPath, ["--require", preload, "-e", script], {
    cwd: ENGINE_ROOT,
    encoding: "utf8",
    env: { ...process.env, POSTGRES_POOL_BUDGET: "64" },
  });
  assert.equal(child.status, 0, child.stderr || child.stdout);
});

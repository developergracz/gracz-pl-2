import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mainSource = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const healthSource = await readFile(new URL("../src/health.js", import.meta.url), "utf8");
const postgresStoreSource = await readFile(new URL("../src/postgres-session-store.js", import.meta.url), "utf8");

test("P1-AUD3-07 main wires the health handler to the exact runtime session store", () => {
  assert.match(mainSource, /import\s+\{\s*handleHealthRequest\s*\}\s+from\s+"\.\/health\.js"/);
  assert.match(mainSource, /handleHealthRequest\(request,\s*response,\s*\{\s*store\s*\}\)/);
  assert.match(mainSource, /config\.databaseUrl\s*\?\s*new PostgresSessionStore\(config\.databaseUrl\)\s*:\s*new FileSessionStore/);
});

test("P1-AUD3-07 health paths are evaluated before mutation-origin enforcement without weakening it globally", () => {
  const healthIndex = mainSource.indexOf("handleHealthRequest(request,response,{store})");
  const originIndex = mainSource.indexOf("security.assertSameOrigin(request)");
  assert.ok(healthIndex >= 0);
  assert.ok(originIndex >= 0);
  assert.ok(healthIndex < originIndex);
  assert.equal((mainSource.match(/security\.assertSameOrigin\(request\)/g) ?? []).length, 1);
});

test("P1-AUD3-07 public health payloads contain no dependency details or latency telemetry", () => {
  assert.doesNotMatch(healthSource, /latencyMs|DATABASE_URL|connectionString|hostname|username|password/i);
  assert.match(healthSource, /DEPENDENCY_UNAVAILABLE/);
  assert.match(healthSource, /pathname === "\/health"/);
  assert.match(healthSource, /pathname === "\/health\/live"/);
  assert.match(healthSource, /pathname !== "\/health\/ready"/);
});

test("P1-AUD3-07 PostgreSQL probe path is read-only and uses bounded driver timeout", () => {
  const start = postgresStoreSource.indexOf("async healthCheck()");
  const end = postgresStoreSource.indexOf("async create(", start);
  assert.ok(start >= 0 && end > start);
  const probe = postgresStoreSource.slice(start, end);

  assert.match(probe, /SELECT 1 AS ready/);
  assert.match(probe, /query_timeout:\s*HEALTH_TIMEOUT_MS/);
  assert.doesNotMatch(probe, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE)\b/i);
});

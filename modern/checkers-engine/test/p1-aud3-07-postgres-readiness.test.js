import assert from "node:assert/strict";
import test from "node:test";

import { PostgresSessionStore } from "../src/postgres-session-store.js";

const databaseUrl = process.env.P1_AUD3_07_DATABASE_URL;

test("PostgreSQL readiness probe returns healthy", { skip: !databaseUrl }, async () => {
  const store = new PostgresSessionStore(databaseUrl);
  try {
    const result = await store.healthCheck();
    assert.equal(result.ok, true);
    assert.equal(result.dependency, "postgresql");
    assert.equal(Number.isInteger(result.latencyMs), true);
  } finally {
    await store.close();
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import pg from "pg";

import { PostgresSessionStore } from "../src/postgres-session-store.js";

const { Pool } = pg;
const DATABASE_URL = process.env.P1_C_01_DATABASE_URL;
const INIT_LOCK_ID = 731_004_201;

function poolOptions(connectionString) {
  return {
    connectionString,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}

async function waitForAdvisoryLockWaiters(pool, expected, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM pg_locks
       WHERE locktype = 'advisory'
         AND granted = false
         AND objid = $1::oid`,
      [INIT_LOCK_ID],
    );
    if (rows[0].count >= expected) return rows[0].count;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Nie zaobserwowano ${expected} oczekujących inicjalizacji przed upływem ${timeoutMs} ms.`);
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Operacja przekroczyła limit ${timeoutMs} ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test("P1-C-01 two PostgresSessionStore instances initialize simultaneously without deadlock", {
  skip: !DATABASE_URL,
  timeout: 20_000,
}, async () => {
  const controlPool = new Pool(poolOptions(DATABASE_URL));
  const gateClient = await controlPool.connect();
  let gateHeld = false;
  let firstStore;
  let secondStore;

  try {
    await gateClient.query("SELECT pg_advisory_lock($1)", [INIT_LOCK_ID]);
    gateHeld = true;

    firstStore = new PostgresSessionStore(DATABASE_URL);
    secondStore = new PostgresSessionStore(DATABASE_URL);

    const waiterCount = await waitForAdvisoryLockWaiters(controlPool, 2);
    assert.ok(waiterCount >= 2, "both independent stores must overlap while waiting on the same init lock");

    const unlock = await gateClient.query("SELECT pg_advisory_unlock($1) AS unlocked", [INIT_LOCK_ID]);
    assert.equal(unlock.rows[0].unlocked, true);
    gateHeld = false;

    await withTimeout(Promise.all([firstStore.ready, secondStore.ready]), 10_000);

    const { rows } = await controlPool.query(`
      SELECT
        to_regclass('public.gracz_game_sessions') IS NOT NULL AS has_table,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'gracz_game_sessions'
            AND column_name = 'version'
            AND is_nullable = 'NO'
        ) AS has_version_column,
        EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'gracz_game_sessions'
            AND indexname = 'gracz_game_sessions_updated_idx'
        ) AS has_updated_index
    `);

    assert.deepEqual(rows[0], {
      has_table: true,
      has_version_column: true,
      has_updated_index: true,
    });
  } finally {
    if (gateHeld) {
      await gateClient.query("SELECT pg_advisory_unlock($1)", [INIT_LOCK_ID]).catch(() => {});
    }
    gateClient.release();
    await Promise.allSettled([
      firstStore?.close(),
      secondStore?.close(),
    ]);
    await controlPool.end();
  }
});

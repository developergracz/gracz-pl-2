import { createRequire } from "node:module";
import pg from "pg";

const require = createRequire(import.meta.url);
const { secureSslConfig } = require("./postgres-ssl-policy.cjs");
const { Client } = pg;

export const POSTGRES_STARTUP_SCHEMA_LOCK_CLASS = 1_000_006_007;
export const POSTGRES_STARTUP_SCHEMA_LOCK_OBJECT = 2;
export const POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT_CODE = "POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT";
export const DEFAULT_POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT_MS = 30_000;

function normalizeLockTimeoutMs(value) {
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 120_000) {
    throw new TypeError("Timeout blokady inicjalizacji PostgreSQL musi wynosić od 50 do 120000 ms.");
  }
  return timeoutMs;
}

function startupLockTimeoutError(timeoutMs, cause) {
  const error = new Error(
    `Przekroczono ${timeoutMs} ms oczekiwania na blokadę inicjalizacji PostgreSQL.`,
    { cause },
  );
  error.name = "PostgresStartupSchemaLockTimeoutError";
  error.code = POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT_CODE;
  error.timeoutMs = timeoutMs;
  return error;
}

export async function acquirePostgresStartupSchemaLock(
  connectionString,
  { timeoutMs = DEFAULT_POSTGRES_STARTUP_SCHEMA_LOCK_TIMEOUT_MS } = {},
) {
  if (typeof connectionString !== "string" || !connectionString.trim()) {
    throw new TypeError("DATABASE_URL jest wymagany do blokady inicjalizacji PostgreSQL.");
  }

  const boundedTimeoutMs = normalizeLockTimeoutMs(timeoutMs);
  const client = new Client({
    connectionString,
    ssl: secureSslConfig(connectionString),
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    await client.query(
      "SELECT set_config('lock_timeout', $1, false)",
      [`${boundedTimeoutMs}ms`],
    );
    await client.query(
      "SELECT pg_advisory_lock($1::int, $2::int)",
      [POSTGRES_STARTUP_SCHEMA_LOCK_CLASS, POSTGRES_STARTUP_SCHEMA_LOCK_OBJECT],
    );
  } catch (error) {
    await client.end().catch(() => {});
    if (error?.code === "55P03") throw startupLockTimeoutError(boundedTimeoutMs, error);
    throw error;
  }

  let released = false;
  return Object.freeze({
    async release() {
      if (released) return;
      released = true;
      let releaseError = null;
      try {
        const { rows } = await client.query(
          "SELECT pg_advisory_unlock($1::int, $2::int) AS unlocked",
          [POSTGRES_STARTUP_SCHEMA_LOCK_CLASS, POSTGRES_STARTUP_SCHEMA_LOCK_OBJECT],
        );
        if (rows?.[0]?.unlocked !== true) {
          throw new Error("Nie udało się zwolnić blokady inicjalizacji PostgreSQL.");
        }
      } catch (error) {
        releaseError = error;
      }
      try {
        await client.end();
      } catch (error) {
        if (!releaseError) releaseError = error;
      }
      if (releaseError) throw releaseError;
    },
  });
}

export async function withPostgresStartupSchemaLock(connectionString, work, options = {}) {
  if (typeof work !== "function") throw new TypeError("Funkcja inicjalizacji PostgreSQL jest wymagana.");
  const lock = await acquirePostgresStartupSchemaLock(connectionString, options);
  try {
    return await work();
  } finally {
    await lock.release();
  }
}

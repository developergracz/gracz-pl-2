import pg from "pg";

const { Client } = pg;
const STARTUP_SCHEMA_LOCK_CLASS = 1_000_006_007;
const STARTUP_SCHEMA_LOCK_OBJECT = 2;

export async function acquirePostgresStartupSchemaLock(connectionString) {
  if (typeof connectionString !== "string" || !connectionString.trim()) {
    throw new TypeError("DATABASE_URL jest wymagany do blokady inicjalizacji PostgreSQL.");
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    await client.query(
      "SELECT pg_advisory_lock($1::int, $2::int)",
      [STARTUP_SCHEMA_LOCK_CLASS, STARTUP_SCHEMA_LOCK_OBJECT],
    );
  } catch (error) {
    await client.end().catch(() => {});
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
          [STARTUP_SCHEMA_LOCK_CLASS, STARTUP_SCHEMA_LOCK_OBJECT],
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

export async function withPostgresStartupSchemaLock(connectionString, work) {
  if (typeof work !== "function") throw new TypeError("Funkcja inicjalizacji PostgreSQL jest wymagana.");
  const lock = await acquirePostgresStartupSchemaLock(connectionString);
  try {
    return await work();
  } finally {
    await lock.release();
  }
}

import pg from "pg";
import { PostgresGomokuService } from "../../src/postgres-gomoku-service.js";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (process.env.WAVE_B_ALLOW_SCHEMA_BOOTSTRAP !== "1") {
  throw new Error("Wave B Gomoku bootstrap requires WAVE_B_ALLOW_SCHEMA_BOOTSTRAP=1.");
}
if (typeof databaseUrl !== "string" || !databaseUrl.trim()) {
  throw new Error("DATABASE_URL is required for Wave B Gomoku bootstrap.");
}
if (!databaseUrl.includes("127.0.0.1") && !databaseUrl.includes("localhost")) {
  throw new Error("Wave B Gomoku bootstrap is restricted to isolated local PostgreSQL.");
}

const pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 1 });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [731004304]);
    await client.query(`CREATE TABLE IF NOT EXISTS gracz_gomoku_games (
      game_id VARCHAR(128) PRIMARY KEY,
      state JSONB NOT NULL,
      revision INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

const verifier = new PostgresGomokuService(databaseUrl);
try {
  await verifier.ready;
} finally {
  await verifier.close();
}

console.log("WAVE_B_GOMOKU_SCHEMA_BOOTSTRAP=PASS");

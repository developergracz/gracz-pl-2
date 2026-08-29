import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { discoverMigrations } from "./migration-plan.js";

const { Pool } = pg;
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(here, "migrations");
const LOCK_KEY = "gracz.pl:migrator:v3";

const mode = process.argv.includes("--plan") ? "plan" : process.argv.includes("--verify") ? "verify" : "apply";
const migrations = await discoverMigrations(migrationsDirectory);

if (mode === "plan") {
  printPlan(migrations);
  process.exit(0);
}

const connectionString = requiredMigrationConnectionString();
const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  if (mode === "verify") {
    await verifyAppliedMigrations(client, migrations);
    console.log(`[migrator] verify PASS: ${migrations.length} migracji zgodnych.`);
  } else {
    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [LOCK_KEY]);
    try {
      await ensureLedger(client);
      await verifyAppliedMigrations(client, migrations, { allowMissing: true });
      for (const migration of migrations) await applyMigration(client, migration);
      await verifyAppliedMigrations(client, migrations);
      console.log(`[migrator] apply PASS: schema version ${migrations.at(-1).version}.`);
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [LOCK_KEY]).catch(() => {});
    }
  }
} finally {
  client.release();
  await pool.end();
}

function requiredMigrationConnectionString() {
  const migrationUrl = String(process.env.MIGRATOR_DATABASE_URL || "").trim();
  if (!migrationUrl) throw new Error("MIGRATOR_DATABASE_URL jest wymagany. Migrator nie używa DATABASE_URL runtime.");
  const runtimeUrl = String(process.env.DATABASE_URL || "").trim();
  if (runtimeUrl && runtimeUrl === migrationUrl) {
    throw new Error("MIGRATOR_DATABASE_URL nie może być identyczny z DATABASE_URL runtime.");
  }
  return migrationUrl;
}

async function ensureLedger(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS gracz_schema_migrations(
    version INTEGER PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

async function applyMigration(client, migration) {
  const existing = await client.query(
    "SELECT version,name,checksum FROM gracz_schema_migrations WHERE version=$1",
    [migration.version],
  );
  if (existing.rows[0]) {
    assertSame(existing.rows[0], migration);
    console.log(`[migrator] ${migration.fileName}: already applied`);
    return;
  }

  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query(migration.sql);
    await client.query(
      "INSERT INTO gracz_schema_migrations(version,name,checksum) VALUES($1,$2,$3)",
      [migration.version, migration.name, migration.checksum],
    );
    await client.query("COMMIT");
    console.log(`[migrator] ${migration.fileName}: applied`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function verifyAppliedMigrations(client, migrations, { allowMissing = false } = {}) {
  let rows;
  try {
    ({ rows } = await client.query("SELECT version,name,checksum FROM gracz_schema_migrations ORDER BY version"));
  } catch (error) {
    if (allowMissing && error?.code === "42P01") return;
    throw error;
  }
  const expectedByVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  for (const row of rows) {
    const expected = expectedByVersion.get(Number(row.version));
    if (!expected) throw new Error(`Baza zawiera nieznaną migrację ${row.version}.`);
    assertSame(row, expected);
  }
  if (!allowMissing) {
    for (const migration of migrations) {
      if (!rows.some((row) => Number(row.version) === migration.version)) {
        throw new Error(`Brak zastosowanej migracji ${migration.fileName}.`);
      }
    }
  }
}

function assertSame(row, migration) {
  if (String(row.name) !== migration.name || String(row.checksum) !== migration.checksum) {
    throw new Error(`Checksum/name mismatch dla migracji ${migration.version}; odmowa kontynuacji.`);
  }
}

function printPlan(items) {
  for (const migration of items) {
    console.log(`${String(migration.version).padStart(3, "0")} ${migration.name} ${migration.checksum}`);
  }
}

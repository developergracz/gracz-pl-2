import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { discoverMigrations } from "./migrator/migration-plan.js";

const { Pool } = pg;
const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "migrator", "migrations");

export async function assertRuntimeSchema(databaseUrl) {
  if (!databaseUrl) return { skipped: true, reason: "no-database-url" };
  const migrations = await discoverMigrations(migrationsDirectory);
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    let rows;
    try {
      ({ rows } = await pool.query("SELECT version,name,checksum FROM gracz_schema_migrations ORDER BY version"));
    } catch (error) {
      if (error?.code === "42P01") throw schemaError("SCHEMA_MIGRATION_REQUIRED", "Brak tabeli wersji schematu. Uruchom osobny migrator przed startem runtime.");
      throw error;
    }
    if (rows.length !== migrations.length) {
      throw schemaError("SCHEMA_VERSION_MISMATCH", `Runtime oczekuje ${migrations.length} migracji, baza raportuje ${rows.length}.`);
    }
    for (let index = 0; index < migrations.length; index += 1) {
      const expected = migrations[index];
      const actual = rows[index];
      if (Number(actual?.version) !== expected.version || String(actual?.name) !== expected.name || String(actual?.checksum) !== expected.checksum) {
        throw schemaError("SCHEMA_CHECKSUM_MISMATCH", `Niezgodna migracja schema version ${expected.version}.`);
      }
    }
    return Object.freeze({ skipped: false, version: migrations.at(-1).version, migrations: migrations.length });
  } finally {
    await pool.end();
  }
}

function schemaError(code, message) {
  return Object.assign(new Error(message), { name: "SchemaCompatibilityError", code });
}

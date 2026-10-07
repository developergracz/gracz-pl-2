import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createDatabase } from "./database.mjs";

const DEFAULT_MIGRATIONS_DIR = fileURLToPath(
  new URL("./migrations/", import.meta.url)
);

function checksum(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function migrationError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function applyMigrations(
  database,
  { migrationsDir = DEFAULT_MIGRATIONS_DIR } = {}
) {
  if (!database?.enabled) {
    throw migrationError(
      "Durable persistence is not configured.",
      "PERSISTENCE_NOT_CONFIGURED"
    );
  }

  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const entries = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const result = {
    applied: [],
    skipped: [],
  };

  for (const version of entries) {
    const sql = await readFile(path.join(migrationsDir, version), "utf8");
    const digest = checksum(sql);

    const state = await database.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        ["gracz-contact-api-migrations"]
      );

      const existing = await client.query(
        "SELECT checksum FROM schema_migrations WHERE version = $1",
        [version]
      );

      if (existing.rowCount > 0) {
        const stored = String(existing.rows[0].checksum || "").trim();
        if (stored !== digest) {
          throw migrationError(
            `Migration checksum mismatch for ${version}.`,
            "MIGRATION_CHECKSUM_MISMATCH"
          );
        }
        return "skipped";
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)",
        [version, digest]
      );
      return "applied";
    });

    result[state].push(version);
  }

  return result;
}

async function runCli() {
  const database = createDatabase();
  if (!database.enabled) {
    throw migrationError(
      "DATABASE_URL is required to run migrations.",
      "PERSISTENCE_NOT_CONFIGURED"
    );
  }

  try {
    const result = await applyMigrations(database);
    console.log("gracz.pl persistence migrations", result);
  } finally {
    await database.close();
  }
}

const invokedAsScript =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedAsScript) {
  runCli().catch((error) => {
    console.error("gracz.pl persistence migration failed", {
      code: error?.code || "MIGRATION_FAILED",
      message: error?.message || "Unknown migration failure",
    });
    process.exitCode = 1;
  });
}

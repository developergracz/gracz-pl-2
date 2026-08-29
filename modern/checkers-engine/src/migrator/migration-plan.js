import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MIGRATION_FILE = /^(\d{3})_([a-z0-9][a-z0-9-]*)\.sql$/;

export async function discoverMigrations(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrations = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = MIGRATION_FILE.exec(entry.name);
    if (!match) continue;
    const version = Number(match[1]);
    const name = match[2];
    const path = join(directory, entry.name);
    const sql = await readFile(path, "utf8");
    const checksum = createHash("sha256").update(sql, "utf8").digest("hex");
    migrations.push(Object.freeze({ version, name, fileName: entry.name, path, sql, checksum }));
  }
  migrations.sort((a, b) => a.version - b.version || a.fileName.localeCompare(b.fileName));
  validateSequence(migrations);
  return migrations;
}

export function validateSequence(migrations) {
  if (!Array.isArray(migrations) || migrations.length === 0) {
    throw new Error("Brak wersjonowanych migracji SQL.");
  }
  const versions = new Set();
  let previous = 0;
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) throw new Error("Nieprawidłowa wersja migracji.");
    if (versions.has(migration.version)) throw new Error(`Duplikat wersji migracji: ${migration.version}.`);
    if (migration.version !== previous + 1) throw new Error(`Luka w migracjach: oczekiwano ${previous + 1}, znaleziono ${migration.version}.`);
    if (!/^[a-f0-9]{64}$/.test(migration.checksum)) throw new Error(`Nieprawidłowy checksum migracji ${migration.fileName}.`);
    versions.add(migration.version);
    previous = migration.version;
  }
}

export function latestMigration(migrations) {
  validateSequence(migrations);
  return migrations[migrations.length - 1];
}

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverMigrations } from "../src/migrator/migration-plan.js";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");
const migrationsDir = join(src, "migrator", "migrations");
const PASS1_RUNTIME_MODULES = [
  "postgres-accounts.js",
  "postgres-session-store.js",
  "secure-accounts.js",
  "auth-sessions.js",
  "message-attachments.js",
];
const FORBIDDEN_RUNTIME_DDL = /\b(?:CREATE\s+(?:TABLE|INDEX|UNIQUE\s+INDEX|OR\s+REPLACE\s+FUNCTION|FUNCTION|TRIGGER)|ALTER\s+TABLE|DROP\s+(?:TABLE|INDEX|TRIGGER|FUNCTION)|TRUNCATE\s+TABLE|GRANT\s+|REVOKE\s+)/i;

const PASS1_MIGRATIONS = [
  { version: 1, name: "identity" },
  { version: 2, name: "messages" },
  { version: 3, name: "game-sessions" },
  { version: 4, name: "secure-account" },
  { version: 5, name: "auth-sessions" },
  { version: 6, name: "message-attachments" },
];

test("Gate 14A.3 runtime modules contain no executable DDL/DCL statements", async () => {
  for (const file of PASS1_RUNTIME_MODULES) {
    const source = await readFile(join(src, file), "utf8");
    assert.doesNotMatch(source, FORBIDDEN_RUNTIME_DDL, `${file} nadal zawiera DDL/DCL`);
  }
});

test("Gate 14A.3 migrations 001-006 remain contiguous and named as approved", async () => {
  const migrations = await discoverMigrations(migrationsDir);
  assert.deepEqual(
    migrations.slice(0, PASS1_MIGRATIONS.length).map(({ version, name }) => ({ version, name })),
    PASS1_MIGRATIONS,
  );
  assert.ok(migrations.slice(0, PASS1_MIGRATIONS.length).every((migration) => /^[a-f0-9]{64}$/.test(migration.checksum)));
});

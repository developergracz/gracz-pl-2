import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverMigrations } from "../src/migrator/migration-plan.js";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");
const migrationsDir = join(src, "migrator", "migrations");

const RUNTIME_DB_MODULES = [
  "postgres-accounts.js",
  "postgres-session-store.js",
  "auth-sessions.js",
  "message-attachments.js",
  "global-chat.js",
  "tournaments.js",
  "newsletter.js",
  "newsletter-admin-service.js",
  "audit-service.js",
  "rbac-service.js",
  "mfa-service.js",
  "moderation-service.js",
  "secure-accounts.js",
  "thousand-repository.js",
];

const FORBIDDEN_RUNTIME_DDL = /\b(?:CREATE\s+(?:TABLE|INDEX|UNIQUE\s+INDEX|OR\s+REPLACE\s+FUNCTION|FUNCTION|TRIGGER)|ALTER\s+TABLE|DROP\s+(?:TABLE|INDEX|TRIGGER|FUNCTION)|TRUNCATE\s+TABLE|GRANT\b|REVOKE\b)/i;

const EXPECTED_MIGRATIONS = [
  [1, "identity"],
  [2, "messages"],
  [3, "game-sessions"],
  [4, "secure-account"],
  [5, "auth-sessions"],
  [6, "message-attachments"],
  [7, "rbac-mfa"],
  [8, "audit"],
  [9, "moderation"],
  [10, "global-chat-social"],
  [11, "tournaments"],
  [12, "newsletter-core"],
  [13, "newsletter-admin"],
  [14, "thousand-games"],
];

test("Gate 14A runtime modules contain no executable DDL/DCL", async () => {
  for (const file of RUNTIME_DB_MODULES) {
    const source = await readFile(join(src, file), "utf8");
    assert.doesNotMatch(source, FORBIDDEN_RUNTIME_DDL, `${file} nadal zawiera wykonywalny DDL/DCL`);
  }
});

test("Gate 14A migrations 001-014 are contiguous and match the approved extraction plan", async () => {
  const migrations = await discoverMigrations(migrationsDir);
  assert.deepEqual(
    migrations.map(({ version, name }) => [version, name]),
    EXPECTED_MIGRATIONS,
  );
  assert.ok(migrations.every((migration) => /^[a-f0-9]{64}$/.test(migration.checksum)));
});

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

const PRIVILEGE = "(?:ALL|SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER|USAGE|CREATE|CONNECT|TEMPORARY|EXECUTE)";
const FORBIDDEN_RUNTIME_DDL = new RegExp(
  `\\b(?:CREATE\\s+(?:TABLE|INDEX|UNIQUE\\s+INDEX|OR\\s+REPLACE\\s+FUNCTION|FUNCTION|TRIGGER)|ALTER\\s+TABLE|DROP\\s+(?:TABLE|INDEX|TRIGGER|FUNCTION)|TRUNCATE\\s+TABLE|GRANT\\s+${PRIVILEGE}\\b|REVOKE\\s+(?:GRANT\\s+OPTION\\s+FOR\\s+)?${PRIVILEGE}\\b)`,
  "i",
);

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

test("Gate 14A runtime schema check runs before the first PostgreSQL service and never invokes the migrator", async () => {
  const main = await readFile(join(src, "main.js"), "utf8");
  const checker = await readFile(join(src, "runtime-schema-check.js"), "utf8");
  const checkCall = main.indexOf("await assertRuntimeSchema(config.databaseUrl)");
  const firstDbService = main.indexOf("new AuditService(config.databaseUrl");

  assert.ok(checkCall >= 0, "main.js nie wywołuje fail-closed runtime schema check");
  assert.ok(firstDbService > checkCall, "runtime schema check musi wykonać się przed pierwszym serwisem PostgreSQL");
  assert.match(checker, /SELECT version,name,checksum FROM gracz_schema_migrations ORDER BY version/);
  assert.doesNotMatch(main, /migrate-v3|MIGRATOR_DATABASE_URL/, "runtime nie może uruchamiać migratora");
  assert.doesNotMatch(checker, FORBIDDEN_RUNTIME_DDL, "runtime schema checker nie może wykonywać DDL/DCL");
});

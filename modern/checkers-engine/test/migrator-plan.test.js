import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverMigrations } from "../src/migrator/migration-plan.js";

test("discoverMigrations orders versions and computes stable SHA-256 checksums", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gracz-migrations-"));
  try {
    await writeFile(join(dir, "002_second.sql"), "SELECT 2;\n");
    await writeFile(join(dir, "001_first.sql"), "SELECT 1;\n");
    await writeFile(join(dir, "README.md"), "ignored\n");
    const migrations = await discoverMigrations(dir);
    assert.deepEqual(migrations.map((item) => item.version), [1, 2]);
    assert.deepEqual(migrations.map((item) => item.name), ["first", "second"]);
    assert.ok(migrations.every((item) => /^[a-f0-9]{64}$/.test(item.checksum)));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("discoverMigrations fails closed on a version gap", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gracz-migrations-gap-"));
  try {
    await writeFile(join(dir, "001_first.sql"), "SELECT 1;\n");
    await writeFile(join(dir, "003_third.sql"), "SELECT 3;\n");
    await assert.rejects(() => discoverMigrations(dir), /Luka w migracjach/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

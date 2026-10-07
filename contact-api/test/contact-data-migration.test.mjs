import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("contact encryption migration 004 is expand-only for zero-downtime rollout", () => {
  const sql = fs.readFileSync(
    path.resolve("persistence/migrations/004_contact_data_encryption.sql"),
    "utf8"
  );

  assert.match(sql, /subject_ciphertext/);
  assert.match(sql, /source_path_ciphertext/);
  assert.doesNotMatch(sql, /UPDATE\s+contact_cases/i);
  assert.doesNotMatch(sql, /ADD\s+CONSTRAINT/i);
});

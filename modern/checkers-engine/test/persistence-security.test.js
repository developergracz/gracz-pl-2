import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FileAccountService } from "../src/accounts.js";
import { LoginRateLimiter, RateLimitError } from "../src/rate-limit.js";

test("file account store survives restart without saving plaintext password", async () => {
  const directory = await mkdtemp(join(tmpdir(), "gracz-accounts-"));
  const path = join(directory, "accounts.json");
  const first = new FileAccountService(path);
  await first.register({ userId: "alice", displayName: "Alicja", password: "plain-secret-123" });
  const raw = await readFile(path, "utf8");
  assert.equal(raw.includes("plain-secret-123"), false);
  const restarted = new FileAccountService(path);
  assert.equal((await restarted.authenticate({ userId: "alice", password: "plain-secret-123" })).displayName, "Alicja");
});

test("rate limiter locks login after repeated failures and resets after success", () => {
  let now = 1_000;
  const limiter = new LoginRateLimiter({ maxAttempts: 3, lockoutMs: 5_000, clock: () => now });
  limiter.recordFailure("ip:alice"); limiter.recordFailure("ip:alice"); limiter.recordFailure("ip:alice");
  assert.throws(() => limiter.assertAllowed("ip:alice"), RateLimitError);
  now += 5_001;
  assert.doesNotThrow(() => limiter.assertAllowed("ip:alice"));
  limiter.recordSuccess("ip:alice");
  assert.doesNotThrow(() => limiter.assertAllowed("ip:alice"));
});

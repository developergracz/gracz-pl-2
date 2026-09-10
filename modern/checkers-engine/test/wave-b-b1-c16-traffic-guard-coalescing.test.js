import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

import {
  DistributedRateLimitError,
  PostgresDistributedTrafficGuard,
  SharedInfrastructureUnavailableError,
} from "../src/distributed-infrastructure.js";

const { Pool } = pg;
const databaseUrl = process.env.WAVE_B_TEST_DATABASE_URL || process.env.DATABASE_URL || "";
const requirePostgres = process.env.B1_C16_REQUIRE_POSTGRES === "1";
if (requirePostgres && !databaseUrl) throw new Error("WAVE_B_TEST_DATABASE_URL is required for B1-C16.");
const pgTest = databaseUrl ? test : test.skip;

function unique(prefix) {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedLimiter(pool, key, count, resetAt) {
  await pool.query(
    `INSERT INTO gracz_shared_rate_limits(key_hash,count,reset_at,updated_at)
     VALUES($1,$2,$3,NOW())
     ON CONFLICT(key_hash) DO UPDATE SET count=EXCLUDED.count, reset_at=EXCLUDED.reset_at, updated_at=NOW()`,
    [hashKey(key), count, resetAt],
  );
}

async function readLimiter(pool, keys) {
  const hashes = keys.map(hashKey);
  const { rows } = await pool.query(
    `SELECT key_hash::text AS key_hash,count,reset_at
     FROM gracz_shared_rate_limits
     WHERE key_hash::text = ANY($1::text[])
     ORDER BY key_hash`,
    [hashes],
  );
  return new Map(rows.map((row) => [String(row.key_hash).trim(), {
    count: Number(row.count),
    resetAt: Number(row.reset_at),
  }]));
}

function assert429(reason, scope = null) {
  assert.ok(reason instanceof DistributedRateLimitError, `expected DistributedRateLimitError, got ${reason?.constructor?.name}`);
  assert.equal(reason.status, 429);
  if (scope) assert.equal(reason.scope, scope);
}

pgTest("B1-C16 one request preserves authoritative limiter semantics", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  const key = unique("c16-single");
  try {
    await guard.ready;
    const before = guard.operations;
    const result = await guard.consume(key, { limit: 5, windowMs: 60_000, scope: "single" });
    assert.equal(result.count, 1);
    assert.equal(guard.operations - before, 1);
    const persisted = await readLimiter(guard.pool, [key]);
    assert.equal(persisted.get(hashKey(key)).count, 1);
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 different concurrent keys coalesce into one authoritative acquisition", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  const a = unique("c16-different-a");
  const b = unique("c16-different-b");
  try {
    await guard.ready;
    const before = guard.operations;
    const [ra, rb] = await Promise.all([
      guard.consume(a, { limit: 5, windowMs: 60_000, scope: "a" }),
      guard.consume(b, { limit: 5, windowMs: 60_000, scope: "b" }),
    ]);
    assert.equal(ra.count, 1);
    assert.equal(rb.count, 1);
    assert.equal(guard.operations - before, 1);
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 repeated same key preserves multiplicity and stable admission order", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  const key = unique("c16-same-key");
  try {
    await guard.ready;
    const before = guard.operations;
    const attempts = Array.from({ length: 6 }, () =>
      guard.consume(key, { limit: 3, windowMs: 60_000, scope: "same-key" }),
    );
    const results = await Promise.allSettled(attempts);
    assert.deepEqual(results.map((item) => item.status), [
      "fulfilled", "fulfilled", "fulfilled", "rejected", "rejected", "rejected",
    ]);
    for (const item of results.slice(3)) assert429(item.reason, "same-key");
    assert.equal(guard.operations - before, 1);
    const persisted = await readLimiter(guard.pool, [key]);
    assert.equal(persisted.get(hashKey(key)).count, 6, "denied consumes must remain counted exactly as before");
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 exact limit boundary admits only the remaining capacity", async () => {
  const now = 1_900_000_000_000;
  const guard = new PostgresDistributedTrafficGuard(databaseUrl, { clock: () => now });
  const key = unique("c16-boundary");
  try {
    await guard.ready;
    await guard.consume(key, { limit: 4, windowMs: 60_000, scope: "boundary" });
    await guard.consume(key, { limit: 4, windowMs: 60_000, scope: "boundary" });
    const results = await Promise.allSettled(Array.from({ length: 4 }, () =>
      guard.consume(key, { limit: 4, windowMs: 60_000, scope: "boundary" }),
    ));
    assert.deepEqual(results.map((item) => item.status), ["fulfilled", "fulfilled", "rejected", "rejected"]);
    for (const item of results.slice(2)) assert429(item.reason, "boundary");
    const persisted = await readLimiter(guard.pool, [key]);
    assert.equal(persisted.get(hashKey(key)).count, 6);
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 multi-scope request persists every authoritative consume before 429", async () => {
  const now = 1_910_000_000_000;
  const guard = new PostgresDistributedTrafficGuard(databaseUrl, { clock: () => now });
  const a = unique("c16-scope-a");
  const b = unique("c16-scope-b");
  const c = unique("c16-scope-c");
  try {
    await guard.ready;
    await guard.consume(b, { limit: 1, windowMs: 60_000, scope: "scope-b" });
    await assert.rejects(
      guard.consumeMany([
        [a, 10, 60_000, "scope-a"],
        [b, 1, 60_000, "scope-b"],
        [c, 10, 60_000, "scope-c"],
      ]),
      (error) => error instanceof DistributedRateLimitError && error.scope === "scope-b",
    );
    const persisted = await readLimiter(guard.pool, [a, b, c]);
    assert.equal(persisted.get(hashKey(a)).count, 1);
    assert.equal(persisted.get(hashKey(b)).count, 2);
    assert.equal(persisted.get(hashKey(c)).count, 1);
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 mixed overlapping requests map authoritative counts back deterministically", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  const a = unique("c16-overlap-a");
  const b = unique("c16-overlap-b");
  const c = unique("c16-overlap-c");
  const d = unique("c16-overlap-d");
  try {
    await guard.ready;
    const [r1, r2, r3] = await Promise.all([
      guard.consumeMany([[a, 20, 60_000, "a"], [b, 20, 60_000, "b"]]),
      guard.consumeMany([[a, 20, 60_000, "a"], [c, 20, 60_000, "c"]]),
      guard.consumeMany([[d, 20, 60_000, "d"]]),
    ]);
    assert.deepEqual(r1.map((x) => x.count), [1, 1]);
    assert.deepEqual(r2.map((x) => x.count), [2, 1]);
    assert.deepEqual(r3.map((x) => x.count), [1]);
    const persisted = await readLimiter(guard.pool, [a, b, c, d]);
    assert.equal(persisted.get(hashKey(a)).count, 2);
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 window rollover is exact before, at and after reset_at inside one batch", async () => {
  const times = [999, 1000, 1001];
  const guard = new PostgresDistributedTrafficGuard(databaseUrl, { clock: () => times.shift() });
  const key = unique("c16-rollover");
  try {
    await guard.ready;
    await seedLimiter(guard.pool, key, 1, 1000);
    const results = await Promise.all([
      guard.consume(key, { limit: 20, windowMs: 1_000, scope: "rollover" }),
      guard.consume(key, { limit: 20, windowMs: 1_000, scope: "rollover" }),
      guard.consume(key, { limit: 20, windowMs: 1_000, scope: "rollover" }),
    ]);
    assert.deepEqual(results.map((item) => item.count), [2, 1, 2]);
    assert.deepEqual(results.map((item) => item.resetAt), [1000, 2000, 2000]);
    const persisted = await readLimiter(guard.pool, [key]);
    assert.deepEqual(persisted.get(hashKey(key)), { count: 2, resetAt: 2000 });
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 Retry-After remains derived from the persisted authoritative window", async () => {
  const now = 2_000_000_000_000;
  const guard = new PostgresDistributedTrafficGuard(databaseUrl, { clock: () => now });
  const key = unique("c16-retry");
  try {
    await guard.ready;
    await seedLimiter(guard.pool, key, 1, now + 2_500);
    await assert.rejects(
      guard.consume(key, { limit: 1, windowMs: 60_000, scope: "retry" }),
      (error) => error instanceof DistributedRateLimitError
        && error.scope === "retry"
        && error.retryAfterSeconds === 3,
    );
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 PostgreSQL query failure rejects the affected batch fail-closed", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  try {
    await guard.ready;
    const originalConnect = guard.pool.connect.bind(guard.pool);
    guard.pool.connect = async () => ({
      async query() { throw Object.assign(new Error("forced B1-C16 query failure"), { code: "B1_C16_QUERY_FAILURE" }); },
      release() {},
    });
    try {
      await assert.rejects(
        guard.consume(unique("c16-query-fail"), { limit: 10, windowMs: 60_000 }),
        SharedInfrastructureUnavailableError,
      );
    } finally {
      guard.pool.connect = originalConnect;
    }
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 acquisition timeout remains inside the unchanged 1500ms fail-closed deadline", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  try {
    await guard.ready;
    const originalConnect = guard.pool.connect.bind(guard.pool);
    guard.pool.connect = () => new Promise(() => {});
    const started = Date.now();
    try {
      await assert.rejects(
        guard.consume(unique("c16-acquire-timeout"), { limit: 10, windowMs: 60_000 }),
        SharedInfrastructureUnavailableError,
      );
      const elapsed = Date.now() - started;
      assert.ok(elapsed >= 1_350, `deadline fired too early: ${elapsed}ms`);
      assert.ok(elapsed < 2_200, `deadline was increased or escaped: ${elapsed}ms`);
    } finally {
      guard.pool.connect = originalConnect;
    }
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 queue overflow is bounded and fails closed without dropping checks", { timeout: 10_000 }, async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  try {
    await guard.ready;
    const originalConnect = guard.pool.connect.bind(guard.pool);
    guard.pool.connect = () => new Promise(() => {});
    try {
      const attempts = Array.from({ length: 600 }, (_, index) =>
        guard.consume(unique(`c16-overflow-${index}`), { limit: 10, windowMs: 60_000 }),
      );
      const overflow = await Promise.allSettled(attempts.slice(512));
      assert.equal(overflow.length, 88);
      assert.ok(overflow.every((item) => item.status === "rejected" && item.reason instanceof SharedInfrastructureUnavailableError));
      const all = await Promise.allSettled(attempts);
      assert.ok(all.every((item) => item.status === "rejected" && item.reason instanceof SharedInfrastructureUnavailableError));
    } finally {
      guard.pool.connect = originalConnect;
    }
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 batch deadline includes SQL and result mapping time", { timeout: 10_000 }, async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  const key = unique("c16-batch-deadline");
  try {
    await guard.ready;
    const originalConnect = guard.pool.connect.bind(guard.pool);
    const hash = hashKey(key);
    guard.pool.connect = async () => ({
      async query(query) {
        const text = typeof query === "string" ? query : String(query?.text || "");
        if (/SELECT key_hash::text/.test(text)) {
          await delay(1_600);
          return { rows: [{ key_hash: hash, count: 0, reset_at: 0 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
      release() {},
    });
    try {
      await assert.rejects(
        guard.consume(key, { limit: 10, windowMs: 60_000 }),
        SharedInfrastructureUnavailableError,
      );
    } finally {
      guard.pool.connect = originalConnect;
    }
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 malformed database result is fail-closed", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  try {
    await guard.ready;
    const originalConnect = guard.pool.connect.bind(guard.pool);
    guard.pool.connect = async () => ({
      async query(query) {
        const text = typeof query === "string" ? query : String(query?.text || "");
        if (/SELECT key_hash::text/.test(text)) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 1 };
      },
      release() {},
    });
    try {
      await assert.rejects(
        guard.consume(unique("c16-malformed"), { limit: 10, windowMs: 60_000 }),
        SharedInfrastructureUnavailableError,
      );
    } finally {
      guard.pool.connect = originalConnect;
    }
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 no request resolves before the authoritative transaction commits", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  const key = unique("c16-commit-gate");
  const hash = hashKey(key);
  let releaseCommit;
  const commitGate = new Promise((resolve) => { releaseCommit = resolve; });
  try {
    await guard.ready;
    const originalConnect = guard.pool.connect.bind(guard.pool);
    guard.pool.connect = async () => ({
      async query(query) {
        const text = typeof query === "string" ? query : String(query?.text || "");
        if (/SELECT key_hash::text/.test(text)) return { rows: [{ key_hash: hash, count: 0, reset_at: 0 }], rowCount: 1 };
        if (/^\s*UPDATE gracz_shared_rate_limits/.test(text)) return { rows: [], rowCount: 1 };
        if (/^\s*COMMIT/.test(text)) await commitGate;
        return { rows: [], rowCount: 1 };
      },
      release() {},
    });
    let settled = false;
    try {
      const request = guard.consume(key, { limit: 10, windowMs: 60_000 }).finally(() => { settled = true; });
      await delay(40);
      assert.equal(settled, false);
      releaseCommit();
      const result = await request;
      assert.equal(result.count, 1);
      assert.equal(settled, true);
    } finally {
      releaseCommit();
      guard.pool.connect = originalConnect;
    }
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 160 simultaneous unique requests require at most three authoritative batch acquisitions", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  try {
    await guard.ready;
    const before = guard.operations;
    const attempts = Array.from({ length: 160 }, (_, index) =>
      guard.consume(unique(`c16-bulk-${index}`), { limit: 10, windowMs: 60_000 }),
    );
    const results = await Promise.allSettled(attempts);
    assert.ok(results.every((item) => item.status === "fulfilled"));
    const batches = guard.operations - before;
    assert.ok(batches >= 3 && batches <= 3, `expected bounded 64-request batching, got ${batches} DB operations`);
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 arrivals while a batch is in flight remain queued for a later authoritative batch", async () => {
  const guard = new PostgresDistributedTrafficGuard(databaseUrl);
  const firstKey = unique("c16-inflight-first");
  const secondKey = unique("c16-inflight-second");
  let releaseAcquire;
  const acquireGate = new Promise((resolve) => { releaseAcquire = resolve; });
  try {
    await guard.ready;
    const originalConnect = guard.pool.connect.bind(guard.pool);
    let firstAcquire = true;
    guard.pool.connect = async () => {
      if (firstAcquire) {
        firstAcquire = false;
        await acquireGate;
      }
      return originalConnect();
    };
    try {
      const before = guard.operations;
      const first = guard.consume(firstKey, { limit: 10, windowMs: 60_000 });
      await delay(20);
      const second = guard.consume(secondKey, { limit: 10, windowMs: 60_000 });
      releaseAcquire();
      await Promise.all([first, second]);
      assert.equal(guard.operations - before, 2);
    } finally {
      releaseAcquire();
      guard.pool.connect = originalConnect;
    }
  } finally {
    await guard.close();
  }
});

pgTest("B1-C16 exact same-key admission holds across 1, 2 and 4 independent replicas", { timeout: 30_000 }, async () => {
  for (const replicas of [1, 2, 4]) {
    const guards = Array.from({ length: replicas }, () => new PostgresDistributedTrafficGuard(databaseUrl));
    const key = unique(`c16-r${replicas}`);
    try {
      await Promise.all(guards.map((guard) => guard.ready));
      const attempts = Array.from({ length: 80 }, (_, index) =>
        guards[index % replicas].consume(key, { limit: 40, windowMs: 60_000, scope: `replica-${replicas}` }),
      );
      const results = await Promise.allSettled(attempts);
      assert.equal(results.filter((item) => item.status === "fulfilled").length, 40, `replicas=${replicas}`);
      const rejected = results.filter((item) => item.status === "rejected");
      assert.equal(rejected.length, 40, `replicas=${replicas}`);
      for (const item of rejected) assert429(item.reason, `replica-${replicas}`);
      const observer = new Pool({ connectionString: databaseUrl, max: 1 });
      try {
        const persisted = await readLimiter(observer, [key]);
        assert.equal(persisted.get(hashKey(key)).count, 80, `replicas=${replicas}`);
      } finally {
        await observer.end();
      }
    } finally {
      await Promise.allSettled(guards.map((guard) => guard.close()));
    }
  }
});

test("B1-C16 source bounds remain finite and capacity tuning remains prohibited", async () => {
  const source = await readFile(new URL("../src/distributed-infrastructure.js", import.meta.url), "utf8");
  assert.match(source, /MAX_BATCH_REQUESTS\s*=\s*64/);
  assert.match(source, /MAX_BATCH_KEYS\s*=\s*256/);
  assert.match(source, /MAX_BATCH_WAIT_MS\s*=\s*4/);
  assert.match(source, /MAX_QUEUE_DEPTH\s*=\s*512/);
  const trafficGuardClass = source.slice(
    source.indexOf("export class PostgresDistributedTrafficGuard"),
    source.indexOf("export class PostgresRealtimeHub"),
  );
  assert.match(trafficGuardClass, /max:\s*4/);
  assert.match(trafficGuardClass, /OPERATION_TIMEOUT_MS|connectionTimeoutMillis:\s*OPERATION_TIMEOUT_MS/);
  assert.doesNotMatch(trafficGuardClass, /max:\s*(?:[5-9]|[1-9][0-9]+)/);
});

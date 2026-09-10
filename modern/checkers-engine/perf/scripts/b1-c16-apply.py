from pathlib import Path

path = Path("src/distributed-infrastructure.js")
text = path.read_text(encoding="utf-8")

if "const MAX_BATCH_REQUESTS = 64;" in text:
    print("B1-C16 implementation already present")
    raise SystemExit(0)


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return source.replace(old, new, 1)

text = replace_once(
    text,
    "const MAX_NOTIFICATION_BYTES = 1024;\n",
    "const MAX_NOTIFICATION_BYTES = 1024;\n"
    "const MAX_BATCH_REQUESTS = 64;\n"
    "const MAX_BATCH_KEYS = 256;\n"
    "const MAX_BATCH_WAIT_MS = 4;\n"
    "const MAX_QUEUE_DEPTH = 512;\n",
    "batch constants",
)

text = replace_once(
    text,
    "    this.operations = 0;\n    this.ready = this.#initialize();\n",
    "    this.operations = 0;\n"
    "    this.logicalOperations = 0;\n"
    "    this.cleanupCycles = 0;\n"
    "    this.batchQueue = [];\n"
    "    this.batchTimer = null;\n"
    "    this.batchKickScheduled = false;\n"
    "    this.batchFlushPromise = null;\n"
    "    this.batchClosed = false;\n"
    "    this.nextBatchOrdinal = 0;\n"
    "    this.ready = this.#initialize();\n",
    "constructor state",
)

start = text.index("  async consumeMany(checks) {")
end = text.index("\n  async #cleanup(now) {", start)
replacement = '''  async consumeMany(checks) {
    if (!Array.isArray(checks) || checks.length === 0) return [];
    const normalized = checks.map((check, index) => normalizeRateCheck(check, index));
    const hashes = normalized.map((check) => hashKey(check.key));
    if (new Set(hashes).size !== hashes.length) throw new TypeError("Zakresy limitera muszą mieć unikalne klucze.");
    if (normalized.length > MAX_BATCH_KEYS) throw sharedUnavailable();

    await waitForPromise(this.ready, OPERATION_TIMEOUT_MS);
    if (this.batchClosed) throw sharedUnavailable();

    const now = this.clock();
    const deadlineAt = Date.now() + OPERATION_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      if (this.batchClosed || this.batchQueue.length >= MAX_QUEUE_DEPTH) {
        reject(sharedUnavailable());
        return;
      }
      this.batchQueue.push({
        ordinal: this.nextBatchOrdinal++,
        normalized,
        hashes,
        now,
        deadlineAt,
        resolve,
        reject,
      });
      this.#scheduleBatchFlush();
    });
  }

  #scheduleBatchFlush() {
    if (this.batchClosed || this.batchFlushPromise || this.batchQueue.length === 0) return;
    if (this.batchQueue.length >= MAX_BATCH_REQUESTS) {
      if (this.batchTimer) clearTimeout(this.batchTimer);
      this.batchTimer = null;
      if (!this.batchKickScheduled) {
        this.batchKickScheduled = true;
        queueMicrotask(() => {
          this.batchKickScheduled = false;
          this.#startBatchFlush();
        });
      }
      return;
    }
    if (this.batchTimer || this.batchKickScheduled) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.#startBatchFlush();
    }, MAX_BATCH_WAIT_MS);
    this.batchTimer.unref?.();
  }

  #startBatchFlush() {
    if (this.batchClosed || this.batchFlushPromise || this.batchQueue.length === 0) return;
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = null;
    this.batchFlushPromise = this.#drainBatches()
      .finally(() => {
        this.batchFlushPromise = null;
        this.#scheduleBatchFlush();
      });
  }

  async #drainBatches() {
    while (!this.batchClosed && this.batchQueue.length > 0) {
      const batch = this.#takeBatch();
      if (batch.length === 0) continue;
      await this.#executeBatch(batch);
    }
  }

  #takeBatch() {
    const batch = [];
    const keys = new Set();
    while (this.batchQueue.length > 0 && batch.length < MAX_BATCH_REQUESTS) {
      const item = this.batchQueue[0];
      if (remaining(item.deadlineAt) <= 0) {
        this.batchQueue.shift();
        item.reject(sharedUnavailable());
        continue;
      }
      const additions = item.hashes.filter((hash) => !keys.has(hash));
      if (batch.length > 0 && keys.size + additions.length > MAX_BATCH_KEYS) break;
      this.batchQueue.shift();
      batch.push(item);
      for (const hash of additions) keys.add(hash);
    }
    return batch;
  }

  async #executeBatch(batch) {
    batch.sort((a, b) => a.ordinal - b.ordinal);
    const keys = [...new Set(batch.flatMap((item) => item.hashes))].sort();
    if (keys.length === 0 || keys.length > MAX_BATCH_KEYS) {
      const error = sharedUnavailable();
      for (const item of batch) item.reject(error);
      return;
    }

    const deadlineAt = Math.min(...batch.map((item) => item.deadlineAt));
    let client;
    let transactionOpen = false;
    let destroyClient = false;
    try {
      client = await acquireClient(this.pool, deadlineAt);
      await queryBounded(client, "BEGIN", [], deadlineAt);
      transactionOpen = true;

      await queryBounded(client, `
        INSERT INTO gracz_shared_rate_limits(key_hash, count, reset_at, updated_at)
        SELECT key_hash::char(64), 0, 0, NOW()
        FROM UNNEST($1::text[]) AS x(key_hash)
        ORDER BY key_hash
        ON CONFLICT (key_hash) DO NOTHING
      `, [keys], deadlineAt);

      const locked = await queryBounded(client, `
        SELECT key_hash::text AS key_hash, count, reset_at
        FROM gracz_shared_rate_limits
        WHERE key_hash::text = ANY($1::text[])
        ORDER BY key_hash
        FOR UPDATE
      `, [keys], deadlineAt);

      if (!Array.isArray(locked.rows) || locked.rows.length !== keys.length) {
        throw new Error("Malformed shared rate-limit batch state.");
      }

      const state = new Map();
      for (const row of locked.rows) {
        const keyHash = String(row.key_hash || "").trim();
        const count = Number(row.count);
        const resetAt = Number(row.reset_at);
        if (!keys.includes(keyHash) || !Number.isInteger(count) || count < 0 || !Number.isFinite(resetAt)) {
          throw new Error("Malformed shared rate-limit batch row.");
        }
        if (state.has(keyHash)) throw new Error("Duplicate shared rate-limit batch row.");
        state.set(keyHash, { count, resetAt });
      }
      if (state.size !== keys.length) throw new Error("Incomplete shared rate-limit batch state.");

      const decisions = [];
      for (const item of batch) {
        const result = [];
        let exceeded = null;
        for (let index = 0; index < item.normalized.length; index += 1) {
          const check = item.normalized[index];
          const keyHash = item.hashes[index];
          const current = state.get(keyHash);
          if (!current) throw new Error("Missing shared rate-limit batch mapping.");
          if (current.resetAt <= item.now) {
            current.count = 1;
            current.resetAt = item.now + check.windowMs;
          } else {
            current.count += 1;
          }
          result.push({ count: current.count, resetAt: current.resetAt });
          if (!exceeded && current.count > check.limit) {
            exceeded = {
              retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - item.now) / 1000)),
              scope: check.scope,
            };
          }
        }
        decisions.push({ item, result, exceeded });
      }

      if (remaining(deadlineAt) <= 0) throw sharedUnavailable();
      const updateKeys = keys;
      const updateCounts = updateKeys.map((keyHash) => state.get(keyHash)?.count);
      const updateResets = updateKeys.map((keyHash) => state.get(keyHash)?.resetAt);
      if (updateCounts.some((value) => !Number.isInteger(value) || value < 0)
        || updateResets.some((value) => !Number.isFinite(value))) {
        throw new Error("Invalid shared rate-limit batch update state.");
      }

      const updated = await queryBounded(client, `
        WITH input AS (
          SELECT key_hash, count_value, reset_value
          FROM UNNEST($1::text[], $2::integer[], $3::bigint[])
            AS x(key_hash, count_value, reset_value)
        )
        UPDATE gracz_shared_rate_limits AS current
        SET count = input.count_value,
            reset_at = input.reset_value,
            updated_at = NOW()
        FROM input
        WHERE current.key_hash::text = input.key_hash
      `, [updateKeys, updateCounts, updateResets], deadlineAt);
      if (Number(updated.rowCount) !== updateKeys.length) {
        throw new Error("Incomplete shared rate-limit batch update.");
      }

      await queryBounded(client, "COMMIT", [], deadlineAt);
      transactionOpen = false;

      this.operations += 1;
      this.logicalOperations += batch.length;
      const cleanupCycle = Math.floor(this.logicalOperations / 500);
      if (cleanupCycle > this.cleanupCycles) {
        this.cleanupCycles = cleanupCycle;
        void this.#cleanup(batch.at(-1)?.now ?? this.clock());
      }

      for (const decision of decisions) {
        if (decision.exceeded) {
          decision.item.reject(new DistributedRateLimitError(
            decision.exceeded.retryAfterSeconds,
            decision.exceeded.scope,
          ));
        } else {
          decision.item.resolve(decision.result);
        }
      }
    } catch (error) {
      destroyClient = true;
      if (client && transactionOpen) {
        await client.query({
          text: "ROLLBACK",
          query_timeout: Math.max(1, remaining(deadlineAt)),
        }).catch(() => {});
      }
      const unavailable = sharedUnavailable(error);
      for (const item of batch) item.reject(unavailable);
    } finally {
      if (client) client.release(destroyClient);
    }
  }
'''
text = text[:start] + replacement + text[end:]

text = replace_once(
    text,
    "  async close() {\n    await this.pool.end();\n  }\n}\n\nexport class PostgresRealtimeHub",
    "  async close() {\n"
    "    this.batchClosed = true;\n"
    "    if (this.batchTimer) clearTimeout(this.batchTimer);\n"
    "    this.batchTimer = null;\n"
    "    this.batchKickScheduled = false;\n"
    "    const unavailable = sharedUnavailable();\n"
    "    for (const item of this.batchQueue.splice(0)) item.reject(unavailable);\n"
    "    if (this.batchFlushPromise) await this.batchFlushPromise.catch(() => {});\n"
    "    await this.pool.end();\n"
    "  }\n"
    "}\n\nexport class PostgresRealtimeHub",
    "traffic guard close",
)

path.write_text(text, encoding="utf-8")
print("B1-C16 distributed TrafficGuard coalescing applied")

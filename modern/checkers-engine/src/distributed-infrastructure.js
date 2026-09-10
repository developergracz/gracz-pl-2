import { createHash } from "node:crypto";
import pg from "pg";

import { deserializeSession, getSessionSnapshot } from "./session.js";
import { clientSource } from "./traffic-guard.js";

const { Pool } = pg;
const REALTIME_CHANNEL = "gracz_checkers_realtime";
const RATE_LIMIT_SCHEMA_LOCK = 1_937_202_601;
const OPERATION_TIMEOUT_MS = 1_500;
const INIT_TIMEOUT_MS = 3_000;
const RECONNECT_DELAY_MS = 250;
const MAX_NOTIFICATION_BYTES = 1024;
const MAX_BATCH_REQUESTS = 64;
const MAX_BATCH_KEYS = 256;
const MAX_BATCH_WAIT_MS = 4;
const MAX_QUEUE_DEPTH = 512;
const ALLOWED_EVENT_TYPES = new Set([
  "game.snapshot",
  "game.updated",
  "chat.message",
  "game.action",
  "player.disconnected",
  "player.reconnected",
]);

export class DistributedRateLimitError extends Error {
  constructor(retryAfterSeconds, scope = "request") {
    super(`Zbyt wiele żądań. Spróbuj ponownie za ${retryAfterSeconds} s.`);
    this.name = "DistributedRateLimitError";
    this.code = "TOO_MANY_REQUESTS";
    this.retryAfterSeconds = retryAfterSeconds;
    this.scope = scope;
    this.status = 429;
  }
}

export class SharedInfrastructureUnavailableError extends Error {
  constructor() {
    super("Współdzielona infrastruktura ochronna jest chwilowo niedostępna.");
    this.name = "SharedInfrastructureUnavailableError";
    this.code = "SHARED_INFRASTRUCTURE_UNAVAILABLE";
    this.status = 503;
  }
}

export class PostgresDistributedTrafficGuard {
  constructor(connectionString, { clock = () => Date.now() } = {}) {
    assertConnectionString(connectionString);
    this.clock = clock;
    this.pool = new Pool({
      connectionString,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: OPERATION_TIMEOUT_MS,
    });
    this.operations = 0;
    this.logicalOperations = 0;
    this.cleanupCycles = 0;
    this.batchQueue = [];
    this.batchTimer = null;
    this.batchKickScheduled = false;
    this.batchFlushPromise = null;
    this.batchClosed = false;
    this.nextBatchOrdinal = 0;
    this.ready = this.#initialize();
  }

  async #initialize() {
    const deadlineAt = Date.now() + INIT_TIMEOUT_MS;
    let client;
    let lockHeld = false;
    let destroyClient = false;
    try {
      client = await acquireClient(this.pool, deadlineAt);
      while (!lockHeld) {
        const { rows } = await queryBounded(
          client,
          "SELECT pg_try_advisory_lock($1) AS locked",
          [RATE_LIMIT_SCHEMA_LOCK],
          deadlineAt,
        );
        lockHeld = rows?.[0]?.locked === true;
        if (!lockHeld) await delayWithinDeadline(25, deadlineAt);
      }
      await queryBounded(client, `
        CREATE TABLE IF NOT EXISTS gracz_shared_rate_limits (
          key_hash CHAR(64) PRIMARY KEY,
          count INTEGER NOT NULL,
          reset_at BIGINT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `, [], deadlineAt);
      await queryBounded(client, `
        CREATE INDEX IF NOT EXISTS gracz_shared_rate_limits_reset_idx
        ON gracz_shared_rate_limits(reset_at)
      `, [], deadlineAt);
    } catch (error) {
      destroyClient = true;
      throw sharedUnavailable(error);
    } finally {
      if (client && lockHeld) {
        await client.query({
          text: "SELECT pg_advisory_unlock($1)",
          values: [RATE_LIMIT_SCHEMA_LOCK],
          query_timeout: 500,
        }).catch(() => { destroyClient = true; });
      }
      if (client) client.release(destroyClient);
    }
  }

  async assertAllowed(request) {
    const method = String(request.method || "GET").toUpperCase();
    const path = safePath(request.url);
    if (isHealthPath(path)) return;

    const source = clientSource(request);
    const checks = [
      [`global:${source}`, 600, 60_000, "global"],
      [`endpoint:${source}:${method}:${endpointClass(path)}`, endpointLimit(method, path), 60_000, "endpoint"],
    ];
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) checks.push([`mutation:${source}`, 120, 60_000, "mutation"]);
    if (method === "POST" && path === "/auth/register") checks.push([`register:${source}`, 8, 15 * 60_000, "register"]);
    if (method === "POST" && path === "/auth/login") checks.push([`login-ip:${source}`, 40, 15 * 60_000, "login"]);
    if (method === "POST" && path === "/auth/reset-password") checks.push([`reset:${source}`, 8, 30 * 60_000, "password-reset"]);
    if (method === "POST" && path === "/messages") checks.push([`messages:${source}`, 20, 60_000, "messages"]);
    if (method === "POST" && /^\/messages\/[0-9a-f-]{36}\/attachment$/i.test(path)) checks.push([`attachments:${source}`, 10, 10 * 60_000, "attachments"]);
    if (method === "POST" && path === "/lobby/invitations") checks.push([`invites:${source}`, 30, 60_000, "invitations"]);
    if (method === "POST" && path === "/lobby/rooms") checks.push([`rooms:${source}`, 20, 60_000, "rooms"]);
    if (method === "POST" && /^\/games\/[a-zA-Z0-9_-]{1,128}\/chat$/.test(path)) checks.push([`game-chat:${source}`, 30, 15_000, "game-chat"]);
    if (method === "POST" && /^\/games\/[a-zA-Z0-9_-]{1,128}\/moves$/.test(path)) checks.push([`moves:${source}`, 120, 60_000, "moves"]);

    await this.consumeMany(checks);
  }

  async assertAccountAllowed({ request, userId, action = "api" }) {
    const source = clientSource(request);
    const account = normalizeKey(userId);
    if (!account) return;
    const path = safePath(request.url);
    const method = String(request.method || "GET").toUpperCase();
    await this.consumeMany([
      [`account-global:${account}`, 900, 60_000, "global-account"],
      [`account-endpoint:${account}:${method}:${endpointClass(path)}`, accountEndpointLimit(method, path), 60_000, "endpoint-account"],
      [`pair:${source}:${account}:${action}`, pairLimit(action), 60_000, "ip-account-pair"],
    ]);
  }

  async assertCredentialAttempt({ request, accountId, endpoint = "login" }) {
    const source = clientSource(request);
    const account = normalizeKey(accountId) || "unknown";
    await this.consumeMany([
      [`credential-account:${account}:${endpoint}`, 12, 15 * 60_000, "credential-account"],
      [`credential-pair:${source}:${account}:${endpoint}`, 6, 15 * 60_000, "credential-pair"],
      [`spray:${source}:${endpoint}`, 30, 15 * 60_000, "password-spraying"],
    ]);
  }

  async assertRegistrationAttempt({ request, accountId = "" }) {
    const source = clientSource(request);
    const account = normalizeKey(accountId) || "unknown";
    await this.consumeMany([
      [`registration-ip:${source}`, 5, 30 * 60_000, "mass-registration-ip"],
      [`registration-pair:${source}:${account}`, 3, 30 * 60_000, "mass-registration-pair"],
    ]);
  }

  async consume(key, { limit, windowMs, scope = "request" }) {
    const [result] = await this.consumeMany([[key, limit, windowMs, scope]]);
    return result;
  }

  async consumeMany(checks) {
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

  async #cleanup(now) {
    const deadlineAt = Date.now() + OPERATION_TIMEOUT_MS;
    let client;
    try {
      client = await acquireClient(this.pool, deadlineAt);
      await queryBounded(
        client,
        "DELETE FROM gracz_shared_rate_limits WHERE reset_at < $1",
        [now - 24 * 60 * 60_000],
        deadlineAt,
      );
    } catch {
      // Best-effort cleanup only; enforcement remains fail-closed in consumeMany().
    } finally {
      client?.release();
    }
  }

  async close() {
    this.batchClosed = true;
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = null;
    this.batchKickScheduled = false;
    const unavailable = sharedUnavailable();
    for (const item of this.batchQueue.splice(0)) item.reject(unavailable);
    if (this.batchFlushPromise) await this.batchFlushPromise.catch(() => {});
    await this.pool.end();
  }
}

export class PostgresRealtimeHub {
  #subscribers = new Map();
  #listener = null;
  #closing = false;
  #reconnectTimer = null;
  #connectPromise = null;
  #closePromise = null;

  constructor(connectionString, { logger = { error() {} } } = {}) {
    assertConnectionString(connectionString);
    this.connectionString = connectionString;
    this.logger = logger;
    this.listenerBackendPid = null;
    this.pool = new Pool({
      connectionString,
      max: 6,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: OPERATION_TIMEOUT_MS,
    });
    this.ready = this.#connectListener();
  }

  subscribe(session, playerId, response) {
    assertGameId(session?.gameId);
    if (!this.#listener) throw new SharedInfrastructureUnavailableError();
    const key = session.gameId;
    const subscription = { playerId, response };
    const subscribers = this.#subscribers.get(key) ?? new Set();
    subscribers.add(subscription);
    this.#subscribers.set(key, subscribers);

    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    response.write(encodeEvent("game.snapshot", getSessionSnapshot(session, playerId)));

    const remove = () => {
      subscribers.delete(subscription);
      if (subscribers.size === 0) this.#subscribers.delete(key);
    };
    response.on("close", remove);
    return remove;
  }

  async publish(session, type = "game.snapshot") {
    const gameId = session?.gameId;
    if (!isGameId(gameId) || !ALLOWED_EVENT_TYPES.has(type)) return false;
    const payload = JSON.stringify({ gameId, type });
    if (Buffer.byteLength(payload, "utf8") > MAX_NOTIFICATION_BYTES) return false;

    const deadlineAt = Date.now() + OPERATION_TIMEOUT_MS;
    let client;
    let destroyClient = false;
    try {
      client = await acquireClient(this.pool, deadlineAt);
      await queryBounded(client, "SELECT pg_notify($1, $2)", [REALTIME_CHANNEL, payload], deadlineAt);
      return true;
    } catch (error) {
      destroyClient = true;
      this.logger.error(sharedUnavailable(error));
      return false;
    } finally {
      if (client) client.release(destroyClient);
    }
  }

  #connectListener() {
    if (this.#closing) return Promise.resolve();
    if (this.#listener) return Promise.resolve();
    if (this.#connectPromise) return this.#connectPromise;

    this.#connectPromise = this.#openListener()
      .finally(() => { this.#connectPromise = null; });
    return this.#connectPromise;
  }

  async #openListener() {
    const deadlineAt = Date.now() + OPERATION_TIMEOUT_MS;
    let client;
    try {
      client = await acquireClient(this.pool, deadlineAt);
      client.on("notification", (notification) => {
        if (notification.channel === REALTIME_CHANNEL) void this.#handleNotification(notification.payload);
      });
      client.on("error", (error) => this.#listenerLost(client, error));
      client.on("end", () => this.#listenerLost(client));
      await queryBounded(client, `LISTEN ${REALTIME_CHANNEL}`, [], deadlineAt);
      if (this.#closing) {
        client.release(true);
        return;
      }
      this.#listener = client;
      this.listenerBackendPid = client.processID ?? null;
    } catch (error) {
      if (client) client.release(true);
      if (!this.#closing) this.#scheduleReconnect();
      throw sharedUnavailable(error);
    }
  }

  #listenerLost(client, error = null) {
    if (error) this.logger.error(sharedUnavailable(error));
    if (this.#listener === client) {
      this.#listener = null;
      this.listenerBackendPid = null;
      try { client.release(true); } catch {}
      this.#recycleSubscribers();
    }
    if (!this.#closing) this.#scheduleReconnect();
  }

  #scheduleReconnect() {
    if (this.#closing || this.#reconnectTimer) return;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      this.ready = this.#connectListener().catch((error) => {
        this.logger.error(sharedUnavailable(error));
      });
    }, RECONNECT_DELAY_MS);
    this.#reconnectTimer.unref?.();
  }

  async #handleNotification(rawPayload) {
    const event = parseNotification(rawPayload);
    if (!event) return;
    const subscribers = this.#subscribers.get(event.gameId);
    if (!subscribers?.size) return;

    const deadlineAt = Date.now() + OPERATION_TIMEOUT_MS;
    let client;
    let destroyClient = false;
    try {
      client = await acquireClient(this.pool, deadlineAt);
      const { rows } = await queryBounded(
        client,
        "SELECT state FROM gracz_game_sessions WHERE game_id = $1",
        [event.gameId],
        deadlineAt,
      );
      if (!rows[0]) return;
      const session = deserializeSession(rows[0].state);
      for (const subscriber of [...subscribers]) {
        try {
          subscriber.response.write(encodeEvent(event.type, getSessionSnapshot(session, subscriber.playerId)));
        } catch {
          subscriber.response.end();
        }
      }
    } catch (error) {
      destroyClient = true;
      this.logger.error(sharedUnavailable(error));
    } finally {
      if (client) client.release(destroyClient);
    }
  }

  #recycleSubscribers() {
    for (const subscribers of this.#subscribers.values()) {
      for (const { response } of subscribers) {
        try { response.end(); } catch {}
      }
    }
    this.#subscribers.clear();
  }

  close() {
    if (this.#closePromise) return this.#closePromise;
    this.#closing = true;
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
    this.#recycleSubscribers();

    this.#closePromise = (async () => {
      const listener = this.#listener;
      this.#listener = null;
      this.listenerBackendPid = null;
      if (listener) {
        await listener.query({ text: "UNLISTEN *", query_timeout: 500 }).catch(() => {});
        try { listener.release(true); } catch {}
      }
      await this.pool.end().catch(() => {});
    })();
    return this.#closePromise;
  }
}

function parseNotification(rawPayload) {
  if (Buffer.byteLength(String(rawPayload || ""), "utf8") > MAX_NOTIFICATION_BYTES) return null;
  let event;
  try { event = JSON.parse(String(rawPayload || "{}")); }
  catch { return null; }
  if (!isGameId(event?.gameId)) return null;
  if (!ALLOWED_EVENT_TYPES.has(event?.type)) return null;
  return { gameId: event.gameId, type: event.type };
}

async function acquireClient(pool, deadlineAt) {
  const timeoutMs = remaining(deadlineAt);
  if (timeoutMs <= 0) throw sharedUnavailable();
  let timer;
  let timedOut = false;
  const acquisition = pool.connect().then(
    (client) => {
      if (!timedOut) return client;
      client.release(true);
      return null;
    },
    (error) => {
      if (timedOut) return null;
      throw error;
    },
  );
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => { timedOut = true; resolve(null); }, timeoutMs);
    timer.unref?.();
  });
  const client = await Promise.race([acquisition, deadline]);
  clearTimeout(timer);
  if (!client) throw sharedUnavailable();
  return client;
}

function queryBounded(client, text, values, deadlineAt) {
  const timeoutMs = remaining(deadlineAt);
  if (timeoutMs <= 0) return Promise.reject(sharedUnavailable());
  return client.query({ text, values, query_timeout: timeoutMs });
}

async function waitForPromise(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(sharedUnavailable()), timeoutMs);
    timer.unref?.();
  });
  try { return await Promise.race([promise, timeout]); }
  catch (error) { throw sharedUnavailable(error); }
  finally { clearTimeout(timer); }
}

async function delayWithinDeadline(delayMs, deadlineAt) {
  const timeoutMs = remaining(deadlineAt);
  if (timeoutMs <= 0) throw sharedUnavailable();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, Math.min(delayMs, timeoutMs));
    timer.unref?.();
  });
  if (remaining(deadlineAt) <= 0) throw sharedUnavailable();
}

function remaining(deadlineAt) {
  return Math.max(0, deadlineAt - Date.now());
}

function sharedUnavailable(error = null) {
  if (error instanceof SharedInfrastructureUnavailableError) return error;
  const wrapped = new SharedInfrastructureUnavailableError();
  if (error) wrapped.cause = error;
  return wrapped;
}

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

function normalizeRateCheck(check, index) {
  if (!Array.isArray(check) || check.length < 3) throw new TypeError(`Nieprawidłowy zakres limitera #${index + 1}.`);
  const [key, limit, windowMs, scope = "request"] = check;
  if (typeof key !== "string" || !key) throw new TypeError("Klucz limitera jest wymagany.");
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError("Limit musi być dodatnią liczbą całkowitą.");
  if (!Number.isInteger(windowMs) || windowMs < 1000) throw new TypeError("Okno limitera musi mieć co najmniej 1 s.");
  return { key, limit, windowMs, scope: String(scope || "request").slice(0, 80) };
}

function endpointLimit(method, path) {
  if (method === "GET") return 300;
  if (path.startsWith("/auth/")) return 60;
  if (path === "/messages" || path.includes("/chat")) return 60;
  return 120;
}

function accountEndpointLimit(method, path) {
  if (method === "GET") return 360;
  if (path === "/messages") return 30;
  if (path.includes("/chat")) return 60;
  if (path.includes("/moves")) return 180;
  if (path.startsWith("/lobby/invitations")) return 45;
  return 120;
}

function pairLimit(action) {
  return ({ message: 20, chat: 30, invitation: 30, move: 120, room: 20 })[action] ?? 90;
}

function endpointClass(path) {
  return String(path || "/").replace(/[0-9a-f-]{24,}/gi, ":id").replace(/\/[a-zA-Z0-9_-]{16,}/g, "/:id").slice(0, 180);
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_").slice(0, 128);
}

function safePath(value) {
  try { return new URL(value || "/", "http://localhost").pathname; }
  catch { return "/"; }
}

function isHealthPath(path) {
  return path === "/health" || path === "/health/live" || path === "/health/ready";
}

function isGameId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function assertGameId(value) {
  if (!isGameId(value)) throw new TypeError("Nieprawidłowy identyfikator sesji.");
}

function encodeEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function assertConnectionString(connectionString) {
  if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany.");
}
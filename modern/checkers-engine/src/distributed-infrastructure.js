import { createHash } from "node:crypto";
import pg from "pg";

import { deserializeSession, getSessionSnapshot } from "./session.js";
import { clientSource } from "./traffic-guard.js";

const { Client, Pool } = pg;
const REALTIME_CHANNEL = "gracz_checkers_realtime";

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
  constructor(message = "Współdzielona infrastruktura ochronna jest chwilowo niedostępna.") {
    super(message);
    this.name = "SharedInfrastructureUnavailableError";
    this.code = "SHARED_INFRASTRUCTURE_UNAVAILABLE";
    this.status = 503;
  }
}

export class PostgresDistributedTrafficGuard {
  constructor(connectionString, { clock = () => Date.now() } = {}) {
    assertConnectionString(connectionString);
    this.clock = clock;
    this.pool = new Pool(poolOptions(connectionString));
    this.operations = 0;
    this.ready = this.#initialize();
  }

  async #initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_shared_rate_limits (
        key_hash CHAR(64) PRIMARY KEY,
        count INTEGER NOT NULL,
        reset_at BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS gracz_shared_rate_limits_reset_idx
      ON gracz_shared_rate_limits(reset_at)
    `);
  }

  async assertAllowed(request) {
    await this.ready;
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

    for (const [key, limit, windowMs, scope] of checks) await this.consume(key, { limit, windowMs, scope });
  }

  async consume(key, { limit, windowMs, scope = "request" }) {
    await this.ready;
    if (typeof key !== "string" || !key) throw new TypeError("Klucz limitera jest wymagany.");
    if (!Number.isInteger(limit) || limit < 1) throw new TypeError("Limit musi być dodatnią liczbą całkowitą.");
    if (!Number.isInteger(windowMs) || windowMs < 1000) throw new TypeError("Okno limitera musi mieć co najmniej 1 s.");

    const now = this.clock();
    const resetAt = now + windowMs;
    let result;
    try {
      result = await this.pool.query(
        `INSERT INTO gracz_shared_rate_limits AS current (key_hash, count, reset_at, updated_at)
         VALUES ($1, 1, $2, NOW())
         ON CONFLICT (key_hash)
         DO UPDATE SET
           count = CASE WHEN current.reset_at <= $3 THEN 1 ELSE current.count + 1 END,
           reset_at = CASE WHEN current.reset_at <= $3 THEN $2 ELSE current.reset_at END,
           updated_at = NOW()
         RETURNING count, reset_at`,
        [hashKey(key), resetAt, now],
      );
    } catch (error) {
      throw sharedUnavailable(error);
    }

    const row = result.rows[0];
    const count = Number(row.count);
    const persistedResetAt = Number(row.reset_at);
    this.operations += 1;
    if (this.operations % 500 === 0) void this.#cleanup(now);
    if (count > limit) {
      throw new DistributedRateLimitError(Math.max(1, Math.ceil((persistedResetAt - now) / 1000)), scope);
    }
    return { count, resetAt: persistedResetAt };
  }

  async #cleanup(now) {
    try {
      await this.pool.query(`DELETE FROM gracz_shared_rate_limits WHERE reset_at < $1`, [now - 24 * 60 * 60_000]);
    } catch {
      // Cleanup is best-effort; request enforcement remains fail-closed in consume().
    }
  }

  async close() {
    await this.pool.end();
  }
}

export class PostgresRealtimeHub {
  #subscribers = new Map();
  #listener = null;
  #closing = false;
  #reconnectTimer = null;
  #closePromise = null;

  constructor(connectionString, { logger = { error() {} } } = {}) {
    assertConnectionString(connectionString);
    this.connectionString = connectionString;
    this.logger = logger;
    this.pool = new Pool(poolOptions(connectionString));
    this.ready = this.#connectListener();
  }

  subscribe(session, playerId, response) {
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

  publish(session, type = "game.snapshot") {
    const payload = JSON.stringify({ gameId: session?.gameId, type, sentAt: Date.now() });
    if (!session?.gameId || payload.length > 7000) return Promise.resolve(false);
    return this.ready
      .then(() => this.pool.query("SELECT pg_notify($1, $2)", [REALTIME_CHANNEL, payload]))
      .then(() => true)
      .catch((error) => {
        this.logger.error(sharedUnavailable(error));
        return false;
      });
  }

  async #connectListener() {
    if (this.#closing) return;
    const listener = new Client(poolOptions(this.connectionString));
    listener.on("notification", (notification) => {
      if (notification.channel !== REALTIME_CHANNEL) return;
      void this.#handleNotification(notification.payload);
    });
    listener.on("error", (error) => {
      this.logger.error(sharedUnavailable(error));
      if (!this.#closing) this.#scheduleReconnect();
    });
    listener.on("end", () => {
      if (!this.#closing) this.#scheduleReconnect();
    });
    try {
      await listener.connect();
      await listener.query(`LISTEN ${REALTIME_CHANNEL}`);
      this.#listener = listener;
    } catch (error) {
      await listener.end().catch(() => {});
      if (!this.#closing) this.#scheduleReconnect();
      throw sharedUnavailable(error);
    }
  }

  #scheduleReconnect() {
    if (this.#closing || this.#reconnectTimer) return;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = null;
      this.ready = this.#reconnect();
    }, 1000);
    this.#reconnectTimer.unref?.();
  }

  async #reconnect() {
    const previous = this.#listener;
    this.#listener = null;
    if (previous) await previous.end().catch(() => {});
    try {
      await this.#connectListener();
    } catch {
      // #connectListener schedules the next retry.
    }
  }

  async #handleNotification(rawPayload) {
    let event;
    try {
      event = JSON.parse(String(rawPayload || "{}"));
    } catch {
      return;
    }
    if (typeof event.gameId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(event.gameId)) return;
    const subscribers = this.#subscribers.get(event.gameId);
    if (!subscribers?.size) return;

    try {
      const { rows } = await this.pool.query(`SELECT state FROM gracz_game_sessions WHERE game_id = $1`, [event.gameId]);
      if (!rows[0]) return;
      const session = deserializeSession(rows[0].state);
      for (const subscriber of [...subscribers]) {
        try {
          subscriber.response.write(encodeEvent(typeof event.type === "string" ? event.type : "game.snapshot", getSessionSnapshot(session, subscriber.playerId)));
        } catch {
          subscriber.response.end();
        }
      }
    } catch (error) {
      this.logger.error(sharedUnavailable(error));
    }
  }

  close() {
    if (this.#closePromise) return this.#closePromise;
    this.#closing = true;
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    for (const subscribers of this.#subscribers.values()) {
      for (const { response } of subscribers) response.end();
    }
    this.#subscribers.clear();
    this.#closePromise = (async () => {
      const listener = this.#listener;
      this.#listener = null;
      if (listener) await listener.end().catch(() => {});
      await this.pool.end().catch(() => {});
    })();
    return this.#closePromise;
  }
}

function poolOptions(connectionString) {
  return {
    connectionString,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}

function sharedUnavailable(error) {
  const wrapped = new SharedInfrastructureUnavailableError();
  wrapped.cause = error;
  return wrapped;
}

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

function endpointLimit(method, path) {
  if (method === "GET") return 300;
  if (path.startsWith("/auth/")) return 60;
  if (path === "/messages" || path.includes("/chat")) return 60;
  return 120;
}

function endpointClass(path) {
  return String(path || "/").replace(/[0-9a-f-]{24,}/gi, ":id").replace(/\/[a-zA-Z0-9_-]{16,}/g, "/:id").slice(0, 180);
}

function safePath(value) {
  try { return new URL(value || "/", "http://localhost").pathname; }
  catch { return "/"; }
}

function isHealthPath(path) {
  return path === "/health" || path === "/health/live" || path === "/health/ready";
}

function encodeEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function assertConnectionString(connectionString) {
  if (typeof connectionString !== "string" || !connectionString.trim()) throw new TypeError("DATABASE_URL jest wymagany.");
}

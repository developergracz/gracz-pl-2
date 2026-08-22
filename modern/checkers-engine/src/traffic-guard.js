export class TrafficLimitError extends Error {
  constructor(retryAfterSeconds, scope = "request") {
    super(`Zbyt wiele żądań. Spróbuj ponownie za ${retryAfterSeconds} s.`);
    this.name = "TrafficLimitError";
    this.code = "TOO_MANY_REQUESTS";
    this.retryAfterSeconds = retryAfterSeconds;
    this.scope = scope;
  }
}

export class TrafficGuard {
  #buckets = new Map();
  #operations = 0;

  constructor({ clock = () => Date.now(), maxEntries = 50_000 } = {}) {
    this.clock = clock;
    this.maxEntries = maxEntries;
  }

  assertAllowed(request) {
    const method = String(request.method || "GET").toUpperCase();
    const path = safePath(request.url);
    if (path === "/health") return;

    const source = clientSource(request);
    this.#consume(`global:${source}`, 600, 60_000, "global");

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      this.#consume(`mutation:${source}`, 120, 60_000, "mutation");
    }

    if (method === "POST" && path === "/auth/register") {
      this.#consume(`register:${source}`, 8, 15 * 60_000, "register");
    }

    if (method === "POST" && path === "/auth/login") {
      this.#consume(`login-ip:${source}`, 40, 15 * 60_000, "login");
    }

    if (method === "POST" && path === "/auth/reset-password") {
      this.#consume(`reset:${source}`, 8, 30 * 60_000, "password-reset");
    }

    if (method === "POST" && path === "/messages") {
      this.#consume(`messages:${source}`, 20, 60_000, "messages");
    }

    if (method === "POST" && /^\/messages\/[0-9a-f-]{36}\/attachment$/i.test(path)) {
      this.#consume(`attachments:${source}`, 10, 10 * 60_000, "attachments");
    }

    if (method === "POST" && path === "/lobby/invitations") {
      this.#consume(`invites:${source}`, 30, 60_000, "invitations");
    }

    if (method === "POST" && path === "/lobby/rooms") {
      this.#consume(`rooms:${source}`, 20, 60_000, "rooms");
    }

    if (method === "POST" && /^\/games\/[a-zA-Z0-9_-]{1,128}\/chat$/.test(path)) {
      this.#consume(`game-chat:${source}`, 30, 15_000, "game-chat");
    }

    if (method === "POST" && /^\/games\/[a-zA-Z0-9_-]{1,128}\/moves$/.test(path)) {
      this.#consume(`moves:${source}`, 120, 60_000, "moves");
    }
  }

  #consume(key, limit, windowMs, scope) {
    this.#maintenance();
    const now = this.clock();
    let bucket = this.#buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs, lastSeenAt: now };
    }
    bucket.count += 1;
    bucket.lastSeenAt = now;
    this.#buckets.set(key, bucket);
    if (bucket.count > limit) {
      throw new TrafficLimitError(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)), scope);
    }
  }

  #maintenance() {
    this.#operations += 1;
    if (this.#operations % 200 !== 0 && this.#buckets.size < this.maxEntries) return;
    const now = this.clock();
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt + 60_000 < now) this.#buckets.delete(key);
    }
    if (this.#buckets.size <= this.maxEntries) return;
    const overflow = this.#buckets.size - this.maxEntries;
    const oldest = [...this.#buckets.entries()]
      .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
      .slice(0, overflow);
    for (const [key] of oldest) this.#buckets.delete(key);
  }
}

export function clientSource(request) {
  const forwarded = request.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const chain = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (chain.length) return normalizeAddress(chain.at(-1));
  }
  return normalizeAddress(request.socket?.remoteAddress || "unknown");
}

function safePath(value) {
  try { return new URL(value || "/", "http://localhost").pathname; }
  catch { return "/"; }
}

function normalizeAddress(value) {
  return String(value || "unknown").replace(/^::ffff:/, "").slice(0, 128);
}

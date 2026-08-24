export class RateLimitError extends Error {
  constructor(retryAfterSeconds, message = "Zbyt wiele prób.") {
    super(`${message} Spróbuj ponownie za ${retryAfterSeconds} s.`);
    this.name = "RateLimitError";
    this.code = "TOO_MANY_ATTEMPTS";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class LoginRateLimiter {
  #entries = new Map();
  #sources = new Map();
  #operations = 0;

  constructor({ maxAttempts = 5, windowMs = 15 * 60_000, lockoutMs = 15 * 60_000, sourceMaxAttempts = 30, maxEntries = 10_000, clock = () => Date.now() } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;
    this.sourceMaxAttempts = sourceMaxAttempts;
    this.maxEntries = maxEntries;
    this.clock = clock;
  }

  assertAllowed(key) {
    this.#maintenance();
    this.#consumeSource(key);
    const entry = this.#current(key);
    if (entry.lockedUntil > this.clock()) {
      throw new RateLimitError(Math.ceil((entry.lockedUntil - this.clock()) / 1000), "Zbyt wiele prób logowania.");
    }
  }

  recordFailure(key) {
    this.#maintenance();
    const now = this.clock();
    const entry = this.#current(key);
    if (now - entry.windowStartedAt >= this.windowMs) {
      entry.attempts = 0;
      entry.windowStartedAt = now;
      entry.lockedUntil = 0;
    }
    entry.attempts += 1;
    entry.lastSeenAt = now;
    if (entry.attempts >= this.maxAttempts) entry.lockedUntil = now + this.lockoutMs;
    this.#entries.set(key, entry);
  }

  recordSuccess(key) { this.#entries.delete(key); }

  #consumeSource(key) {
    const source = sourceFromKey(key);
    const now = this.clock();
    let entry = this.#sources.get(source);
    if (!entry || now - entry.windowStartedAt >= this.windowMs) {
      entry = { attempts: 0, windowStartedAt: now, lastSeenAt: now };
    }
    entry.attempts += 1;
    entry.lastSeenAt = now;
    this.#sources.set(source, entry);
    if (entry.attempts > this.sourceMaxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((entry.windowStartedAt + this.windowMs - now) / 1000));
      throw new RateLimitError(retryAfter, "Wykryto zbyt wiele prób uwierzytelnienia z tego źródła.");
    }
  }

  #current(key) {
    const now = this.clock();
    return this.#entries.get(key) ?? { attempts: 0, windowStartedAt: now, lockedUntil: 0, lastSeenAt: now };
  }

  #maintenance() {
    this.#operations += 1;
    if (this.#operations % 100 !== 0 && this.#entries.size + this.#sources.size < this.maxEntries) return;
    const now = this.clock();
    const expiry = Math.max(this.windowMs, this.lockoutMs) * 2;
    for (const [key, entry] of this.#entries) {
      if (now - (entry.lastSeenAt ?? entry.windowStartedAt) > expiry && entry.lockedUntil <= now) this.#entries.delete(key);
    }
    for (const [key, entry] of this.#sources) {
      if (now - entry.lastSeenAt > this.windowMs * 2) this.#sources.delete(key);
    }
    const total = this.#entries.size + this.#sources.size;
    if (total <= this.maxEntries) return;
    const candidates = [
      ...[...this.#entries.entries()].map(([key, entry]) => ["entry", key, entry.lastSeenAt ?? entry.windowStartedAt]),
      ...[...this.#sources.entries()].map(([key, entry]) => ["source", key, entry.lastSeenAt]),
    ].sort((a, b) => a[2] - b[2]).slice(0, total - this.maxEntries);
    for (const [kind, key] of candidates) (kind === "entry" ? this.#entries : this.#sources).delete(key);
  }
}

export class AbuseRateLimiter {
  #entries = new Map();
  #operations = 0;

  constructor({ maxEntries = 25_000, clock = () => Date.now() } = {}) {
    this.maxEntries = maxEntries;
    this.clock = clock;
  }

  consume(key, { limit, windowMs, message = "Zbyt wiele żądań." }) {
    if (typeof key !== "string" || !key) throw new TypeError("Klucz limitera jest wymagany.");
    if (!Number.isInteger(limit) || limit < 1) throw new TypeError("Limit musi być dodatnią liczbą całkowitą.");
    if (!Number.isInteger(windowMs) || windowMs < 1000) throw new TypeError("Okno limitera musi mieć co najmniej 1 s.");
    this.#maintenance();

    const now = this.clock();
    let entry = this.#entries.get(key);
    if (!entry || now - entry.windowStartedAt >= windowMs) {
      entry = { count: 0, windowStartedAt: now, lastSeenAt: now, windowMs };
    }
    entry.count += 1;
    entry.lastSeenAt = now;
    entry.windowMs = windowMs;
    this.#entries.set(key, entry);

    if (entry.count > limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStartedAt + windowMs - now) / 1000));
      throw new RateLimitError(retryAfterSeconds, message);
    }
  }

  #maintenance() {
    this.#operations += 1;
    if (this.#operations % 100 !== 0 && this.#entries.size < this.maxEntries) return;
    const now = this.clock();
    for (const [key, entry] of this.#entries) {
      if (now - entry.lastSeenAt > entry.windowMs * 2) this.#entries.delete(key);
    }
    if (this.#entries.size <= this.maxEntries) return;
    const oldest = [...this.#entries.entries()]
      .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)
      .slice(0, this.#entries.size - this.maxEntries);
    for (const [key] of oldest) this.#entries.delete(key);
  }
}

function sourceFromKey(key) {
  const value = String(key ?? "unknown");
  const resetMarker = value.lastIndexOf(":reset:");
  if (resetMarker >= 0) return value.slice(0, resetMarker) || "unknown";
  const lastColon = value.lastIndexOf(":");
  return lastColon > 0 ? value.slice(0, lastColon) : value;
}

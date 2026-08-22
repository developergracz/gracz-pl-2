export class RateLimitError extends Error {
  constructor(retryAfterSeconds, message = "Zbyt wiele prób. Spróbuj ponownie później.") {
    super(`${message} Spróbuj ponownie za ${retryAfterSeconds} s.`);
    this.name = "RateLimitError";
    this.code = "TOO_MANY_ATTEMPTS";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class LoginRateLimiter {
  #entries = new Map();
  #operations = 0;

  constructor({ maxAttempts = 5, windowMs = 15 * 60_000, lockoutMs = 15 * 60_000, maxEntries = 10_000, clock = () => Date.now() } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;
    this.maxEntries = maxEntries;
    this.clock = clock;
  }

  assertAllowed(key) {
    this.#maintenance();
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

  #current(key) {
    const now = this.clock();
    return this.#entries.get(key) ?? { attempts: 0, windowStartedAt: now, lockedUntil: 0, lastSeenAt: now };
  }

  #maintenance() {
    this.#operations += 1;
    if (this.#operations % 100 !== 0 && this.#entries.size < this.maxEntries) return;
    const now = this.clock();
    const expiry = Math.max(this.windowMs, this.lockoutMs) * 2;
    for (const [key, entry] of this.#entries) {
      if (now - (entry.lastSeenAt ?? entry.windowStartedAt) > expiry && entry.lockedUntil <= now) this.#entries.delete(key);
    }
    if (this.#entries.size <= this.maxEntries) return;
    const oldest = [...this.#entries.entries()]
      .sort((a, b) => (a[1].lastSeenAt ?? a[1].windowStartedAt) - (b[1].lastSeenAt ?? b[1].windowStartedAt))
      .slice(0, this.#entries.size - this.maxEntries);
    for (const [key] of oldest) this.#entries.delete(key);
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

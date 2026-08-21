export class RateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super(`Zbyt wiele prób logowania. Spróbuj ponownie za ${retryAfterSeconds} s.`);
    this.name = "RateLimitError";
    this.code = "TOO_MANY_ATTEMPTS";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class LoginRateLimiter {
  #entries = new Map();

  constructor({ maxAttempts = 5, windowMs = 15 * 60_000, lockoutMs = 15 * 60_000, clock = () => Date.now() } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;
    this.clock = clock;
  }

  assertAllowed(key) {
    const entry = this.#current(key);
    if (entry.lockedUntil > this.clock()) {
      throw new RateLimitError(Math.ceil((entry.lockedUntil - this.clock()) / 1000));
    }
  }

  recordFailure(key) {
    const now = this.clock();
    const entry = this.#current(key);
    if (now - entry.windowStartedAt >= this.windowMs) {
      entry.attempts = 0;
      entry.windowStartedAt = now;
    }
    entry.attempts += 1;
    if (entry.attempts >= this.maxAttempts) entry.lockedUntil = now + this.lockoutMs;
    this.#entries.set(key, entry);
  }

  recordSuccess(key) { this.#entries.delete(key); }

  #current(key) {
    return this.#entries.get(key) ?? { attempts: 0, windowStartedAt: this.clock(), lockedUntil: 0 };
  }
}

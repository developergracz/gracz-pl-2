export class ChallengeRequiredError extends Error {
  constructor(siteKey, reason = "suspicious-traffic") {
    super("Dodatkowa weryfikacja jest wymagana.");
    this.name = "ChallengeRequiredError";
    this.code = "CHALLENGE_REQUIRED";
    this.status = 403;
    this.siteKey = siteKey;
    this.reason = reason;
  }
}

export class ChallengeFailedError extends Error {
  constructor() {
    super("Weryfikacja anty-botowa nie powiodła się.");
    this.name = "ChallengeFailedError";
    this.code = "CHALLENGE_FAILED";
    this.status = 403;
  }
}

export class AdaptiveBotDefense {
  #signals = new Map();
  #verifiedUntil = new Map();

  constructor({
    siteKey = process.env.TURNSTILE_SITE_KEY || "",
    secretKey = process.env.TURNSTILE_SECRET_KEY || "",
    expectedHostname = process.env.TURNSTILE_HOSTNAME || "",
    verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    clock = () => Date.now(),
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.siteKey = String(siteKey).trim();
    this.secretKey = String(secretKey).trim();
    this.expectedHostname = String(expectedHostname).trim().toLowerCase();
    this.verifyUrl = verifyUrl;
    this.clock = clock;
    this.fetchImpl = fetchImpl;
  }

  get enabled() {
    return Boolean(this.siteKey && this.secretKey && typeof this.fetchImpl === "function");
  }

  recordFailure({ source, accountId = "", endpoint = "auth" }) {
    this.#bump(`ip:${source}`, 2, 30 * 60_000);
    if (accountId) this.#bump(`account:${normalize(accountId)}`, 2, 30 * 60_000);
    if (accountId) this.#bump(`pair:${source}:${normalize(accountId)}`, 3, 30 * 60_000);
    this.#bump(`endpoint:${source}:${endpoint}`, 1, 15 * 60_000);
  }

  recordRegistration({ source }) {
    this.#bump(`register:${source}`, 3, 60 * 60_000);
  }

  recordSuccess({ source, accountId = "" }) {
    this.#decay(`ip:${source}`, 2);
    if (accountId) this.#decay(`account:${normalize(accountId)}`, 2);
    if (accountId) this.#decay(`pair:${source}:${normalize(accountId)}`, 3);
  }

  requiresChallenge({ source, accountId = "", endpoint = "auth" }) {
    if (!this.enabled) return false;
    if ((this.#verifiedUntil.get(source) || 0) > this.clock()) return false;
    const score =
      this.#score(`ip:${source}`) +
      this.#score(`endpoint:${source}:${endpoint}`) +
      (accountId ? this.#score(`account:${normalize(accountId)}`) : 0) +
      (accountId ? this.#score(`pair:${source}:${normalize(accountId)}`) : 0) +
      (endpoint === "register" ? this.#score(`register:${source}`) : 0);
    return score >= 16;
  }

  async verifyIfRequired({ source, accountId = "", endpoint = "auth", token = "" }) {
    if (!this.requiresChallenge({ source, accountId, endpoint })) return { challenged: false };
    if (!token) throw new ChallengeRequiredError(this.siteKey);

    const form = new URLSearchParams({ secret: this.secretKey, response: String(token), remoteip: String(source) });
    let result;
    try {
      const response = await this.fetchImpl(this.verifyUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`turnstile-http-${response.status}`);
      result = await response.json();
    } catch {
      throw new ChallengeFailedError();
    }

    const hostnameOk = !this.expectedHostname || String(result.hostname || "").toLowerCase() === this.expectedHostname;
    if (!result.success || !hostnameOk) throw new ChallengeFailedError();

    this.#verifiedUntil.set(source, this.clock() + 15 * 60_000);
    this.#decay(`ip:${source}`, 6);
    if (accountId) this.#decay(`pair:${source}:${normalize(accountId)}`, 6);
    return { challenged: true, verified: true };
  }

  #bump(key, amount, ttlMs) {
    const now = this.clock();
    const current = this.#signals.get(key);
    const next = !current || current.expiresAt <= now
      ? { score: amount, expiresAt: now + ttlMs }
      : { score: Math.min(100, current.score + amount), expiresAt: Math.max(current.expiresAt, now + ttlMs) };
    this.#signals.set(key, next);
    this.#cleanup();
  }

  #decay(key, amount) {
    const current = this.#signals.get(key);
    if (!current) return;
    current.score = Math.max(0, current.score - amount);
    if (!current.score) this.#signals.delete(key);
  }

  #score(key) {
    const current = this.#signals.get(key);
    if (!current) return 0;
    if (current.expiresAt <= this.clock()) {
      this.#signals.delete(key);
      return 0;
    }
    return current.score;
  }

  #cleanup() {
    if (this.#signals.size < 25_000) return;
    const now = this.clock();
    for (const [key, value] of this.#signals) if (value.expiresAt <= now) this.#signals.delete(key);
    while (this.#signals.size > 25_000) this.#signals.delete(this.#signals.keys().next().value);
    for (const [key, until] of this.#verifiedUntil) if (until <= now) this.#verifiedUntil.delete(key);
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().slice(0, 128);
}

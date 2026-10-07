const DEFAULT_CLAIM_LEASE_MS = 30_000;

function clone(value) {
  return value ? { ...value } : null;
}

export function createMemoryReplyTokenStore({
  claimLeaseMs = DEFAULT_CLAIM_LEASE_MS,
} = {}) {
  const records = new Map();

  async function issue({
    jtiHash,
    requestId,
    expiresAt,
    providerIdempotencyKey,
  }) {
    if (records.has(jtiHash)) return false;
    records.set(jtiHash, {
      jti_hash: jtiHash,
      request_id: requestId,
      expires_at: new Date(expiresAt),
      used_at: null,
      state: "issued",
      provider_idempotency_key: providerIdempotencyKey,
      message_hash: null,
      claim_expires_at: null,
      provider_message_id: null,
      last_error_code: null,
    });
    return true;
  }

  async function claim(jtiHash, messageHash) {
    const current = records.get(jtiHash);
    if (!current) return { claimed: false, token: null };

    const now = Date.now();
    if (current.expires_at.getTime() <= now) {
      if (current.state !== "used") current.state = "expired";
      current.claim_expires_at = null;
      return { claimed: false, token: clone(current) };
    }

    if (current.message_hash && current.message_hash !== messageHash) {
      return { claimed: false, token: clone(current), messageConflict: true };
    }

    const staleInflight =
      current.state === "inflight" &&
      current.claim_expires_at &&
      current.claim_expires_at.getTime() <= now;

    if (current.state !== "issued" && !staleInflight) {
      return { claimed: false, token: clone(current) };
    }

    current.message_hash ||= messageHash;
    current.state = "inflight";
    current.claim_expires_at = new Date(now + claimLeaseMs);
    current.last_error_code = null;

    return { claimed: true, token: clone(current) };
  }

  async function markUsed(jtiHash, messageHash, providerMessageId = null) {
    const current = records.get(jtiHash);
    if (
      !current ||
      current.state !== "inflight" ||
      current.message_hash !== messageHash
    ) {
      return false;
    }

    current.state = "used";
    current.used_at = new Date();
    current.claim_expires_at = null;
    current.provider_message_id = providerMessageId || null;
    current.last_error_code = null;
    return true;
  }

  async function release(jtiHash, messageHash, errorCode = null) {
    const current = records.get(jtiHash);
    if (
      !current ||
      current.state !== "inflight" ||
      current.message_hash !== messageHash
    ) {
      return null;
    }

    current.state =
      current.expires_at.getTime() > Date.now() ? "issued" : "expired";
    current.claim_expires_at = null;
    current.last_error_code = errorCode || null;
    return current.state;
  }

  async function get(jtiHash) {
    return clone(records.get(jtiHash));
  }

  return Object.freeze({
    issue,
    claim,
    markUsed,
    release,
    get,
  });
}

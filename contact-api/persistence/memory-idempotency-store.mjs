function key(scope, keyHash) {
  return String(scope || "") + ":" + String(keyHash || "");
}

function clone(record) {
  return record
    ? {
        ...record,
        response_body:
          record.response_body && typeof record.response_body === "object"
            ? structuredClone(record.response_body)
            : record.response_body,
      }
    : null;
}

export function createMemoryIdempotencyStore() {
  const records = new Map();

  async function get({ scope, keyHash }) {
    return clone(records.get(key(scope, keyHash)) || null);
  }

  async function reserve({ scope, keyHash, fingerprint, expiresAt }) {
    const storageKey = key(scope, keyHash);
    const existing = records.get(storageKey);
    const now = Date.now();

    if (existing) {
      const expired =
        existing.expires_at instanceof Date &&
        existing.expires_at.getTime() <= now;

      if (existing.state === "done" && expired) {
        records.delete(storageKey);
      } else {
        return { reserved: false, record: clone(existing) };
      }
    }

    const record = {
      scope,
      key_hash: keyHash,
      fingerprint,
      state: "inflight",
      response_status: null,
      response_body: null,
      expires_at: new Date(expiresAt),
      created_at: new Date(),
      updated_at: new Date(),
    };
    records.set(storageKey, record);
    return { reserved: true, record: clone(record) };
  }

  async function complete({
    scope,
    keyHash,
    fingerprint,
    status,
    body,
  }) {
    const storageKey = key(scope, keyHash);
    const record = records.get(storageKey);
    if (
      !record ||
      record.state !== "inflight" ||
      record.fingerprint !== fingerprint
    ) {
      return false;
    }

    record.state = "done";
    record.response_status = Number(status);
    record.response_body = structuredClone(body ?? null);
    record.updated_at = new Date();
    return true;
  }

  async function release({ scope, keyHash, fingerprint }) {
    const storageKey = key(scope, keyHash);
    const record = records.get(storageKey);
    if (
      !record ||
      record.state !== "inflight" ||
      record.fingerprint !== fingerprint
    ) {
      return false;
    }

    records.delete(storageKey);
    return true;
  }

  return Object.freeze({
    get,
    reserve,
    complete,
    release,
  });
}

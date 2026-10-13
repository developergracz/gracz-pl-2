const DISPATCH_SCOPES = new Set(['newsletter-status-dispatch', 'newsletter-public-optin', 'newsletter-public-status']);
function hash(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new TypeError('Expected a lowercase SHA-256 hash');
  return value;
}
function date(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError('Expected a valid Date');
  return value;
}
function key(scope, emailHash) {
  if (!DISPATCH_SCOPES.has(scope)) throw new TypeError('Unsupported newsletter dispatch scope');
  return `${scope}:${hash(emailHash)}`;
}

/** Test-only adapter; pass the same Map to model multiple instances sharing storage. */
export function createMemoryNewsletterProofStore({ records = new Map(), clock = () => new Date() } = {}) {
  return Object.freeze({
    async checkAvailable() { return true; },
    async claimDispatch({ scope, emailHash, requestId, expiresAt }) {
      const id = key(scope, emailHash);
      hash(requestId); date(expiresAt);
      const row = records.get(id);
      if (row && !(row.state === 'done' && row.expiresAt <= clock())) return false;
      records.set(id, { state: 'inflight', requestId, expiresAt: new Date(expiresAt) });
      return true;
    },
    async markDispatchDone({ scope, emailHash, requestId }) {
      const id = key(scope, emailHash); hash(requestId);
      const row = records.get(id);
      if (!row || row.state !== 'inflight' || row.requestId !== requestId) return false;
      row.state = 'done';
      return true;
    },
    async inspectDispatch({ scope, emailHash }) {
      const row = records.get(key(scope, emailHash));
      return row ? { state: row.state, expiresAt: new Date(row.expiresAt) } : null;
    },
    async issueStatusToken({ tokenHash, emailHash, expiresAt }) {
      const id = `newsletter-status-token:${hash(tokenHash)}`;
      hash(emailHash); date(expiresAt);
      if (records.has(id)) return false;
      records.set(id, { state: 'inflight', emailHash, expiresAt: new Date(expiresAt) });
      return true;
    },
    async consumeStatusToken({ tokenHash, emailHash }) {
      const id = `newsletter-status-token:${hash(tokenHash)}`; hash(emailHash);
      const row = records.get(id);
      if (!row || row.state !== 'inflight' || row.emailHash !== emailHash || row.expiresAt <= clock()) return false;
      row.state = 'done';
      return true;
    },
    async reserveStatusBudget({ emailHash, now = new Date() }) {
      hash(emailHash); date(now);
      const hour = Math.floor(now.getTime() / 3_600_000);
      const ids = [`newsletter-status-budget-email:${hour}:${emailHash}`, `newsletter-status-budget-global:${hour}`];
      const counts = ids.map(id => records.get(id)?.count ?? 0);
      if (counts[0] >= 3 || counts[1] >= 100) return false;
      ids.forEach((id, i) => records.set(id, { count: counts[i] + 1 }));
      return true;
    },
  });
}

import { createHash } from 'node:crypto';

const DISPATCH_SCOPES = new Set(['newsletter-status-dispatch', 'newsletter-public-optin', 'newsletter-public-status']);
function hash(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new TypeError('Expected a lowercase SHA-256 hash');
  return value;
}
function date(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError('Expected a valid Date');
  return value;
}
function scope(value) {
  if (!DISPATCH_SCOPES.has(value)) throw new TypeError('Unsupported newsletter dispatch scope');
  return value;
}
function digest(value) { return createHash('sha256').update(value).digest('hex'); }

/** Stores only opaque hashes and counters in the existing baseline idempotency table. */
export function createNewsletterProofStore(database) {
  return Object.freeze({
    async checkAvailable() {
      await database.query('SELECT 1 FROM idempotency_keys LIMIT 1');
      return true;
    },
    async claimDispatch({ scope: namespace, emailHash, requestId, expiresAt }) {
      const result = await database.query(
        `INSERT INTO idempotency_keys(scope, key_hash, fingerprint, state, expires_at)
         VALUES ($1, $2, $3, 'inflight', $4::timestamptz)
         ON CONFLICT (scope, key_hash) DO UPDATE
         SET fingerprint = EXCLUDED.fingerprint, state = 'inflight', response_status = NULL,
             response_body = NULL, expires_at = EXCLUDED.expires_at, updated_at = now()
         WHERE idempotency_keys.state = 'done' AND idempotency_keys.expires_at <= now()
         RETURNING state`, [scope(namespace), hash(emailHash), hash(requestId), date(expiresAt)]);
      return result.rowCount === 1;
    },
    async markDispatchDone({ scope: namespace, emailHash, requestId }) {
      const result = await database.query(
        `UPDATE idempotency_keys SET state = 'done', response_status = 200,
         response_body = '{}'::jsonb, updated_at = now()
         WHERE scope = $1 AND key_hash = $2 AND fingerprint = $3 AND state = 'inflight'
         RETURNING state`, [scope(namespace), hash(emailHash), hash(requestId)]);
      return result.rowCount === 1;
    },
    async inspectDispatch({ scope: namespace, emailHash }) {
      const result = await database.query(
        'SELECT state, expires_at FROM idempotency_keys WHERE scope = $1 AND key_hash = $2',
        [scope(namespace), hash(emailHash)]);
      const row = result.rows[0];
      return row ? { state: row.state, expiresAt: row.expires_at } : null;
    },
    async issueStatusToken({ tokenHash, emailHash, expiresAt }) {
      const result = await database.query(
        `INSERT INTO idempotency_keys(scope, key_hash, fingerprint, state, expires_at)
         VALUES ('newsletter-status-token', $1, $2, 'inflight', $3::timestamptz)
         ON CONFLICT (scope, key_hash) DO NOTHING RETURNING state`,
        [hash(tokenHash), hash(emailHash), date(expiresAt)]);
      return result.rowCount === 1;
    },
    async consumeStatusToken({ tokenHash, emailHash }) {
      const result = await database.query(
        `UPDATE idempotency_keys SET state = 'done', response_status = 200,
         response_body = '{}'::jsonb, updated_at = now()
         WHERE scope = 'newsletter-status-token' AND key_hash = $1 AND fingerprint = $2
           AND state = 'inflight' AND expires_at > now() RETURNING state`,
        [hash(tokenHash), hash(emailHash)]);
      return result.rowCount === 1;
    },
    async reserveStatusBudget({ emailHash, now = new Date() }) {
      hash(emailHash); date(now);
      const hour = Math.floor(now.getTime() / 3_600_000);
      const keys = [digest(`${hour}:${emailHash}`), digest(`${hour}:global`)];
      const scopes = ['newsletter-status-budget-email', 'newsletter-status-budget-global'];
      const expiresAt = new Date((hour + 48) * 3_600_000);
      return database.transaction(async client => {
        // One global transaction lock makes the two counters a single reservation.
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['gracz-newsletter-status-budget']);
        const result = await client.query(
          `SELECT scope, response_body FROM idempotency_keys
           WHERE (scope = $1 AND key_hash = $2) OR (scope = $3 AND key_hash = $4)`,
          [scopes[0], keys[0], scopes[1], keys[1]]);
        const counts = scopes.map(namespace => {
          const row = result.rows.find(row => row.scope === namespace);
          const count = row ? row.response_body?.count : 0;
          if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid persisted newsletter budget');
          return count;
        });
        if (counts[0] >= 3 || counts[1] >= 100) return false;
        for (let i = 0; i < scopes.length; i++) {
          await client.query(
            `INSERT INTO idempotency_keys(scope, key_hash, fingerprint, state, response_status, response_body, expires_at)
             VALUES ($1, $2, $2, 'done', 200, $3::jsonb, $4::timestamptz)
             ON CONFLICT (scope, key_hash) DO UPDATE
             SET response_body = EXCLUDED.response_body, updated_at = now()`,
            [scopes[i], keys[i], JSON.stringify({ count: counts[i] + 1 }), expiresAt]);
        }
        return true;
      });
    },
  });
}

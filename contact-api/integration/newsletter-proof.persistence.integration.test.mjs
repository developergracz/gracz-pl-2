import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { createDatabase } from '../persistence/database.mjs';
import { applyMigrations } from '../persistence/migrator.mjs';
import { createNewsletterProofStore } from '../persistence/newsletter-proof-store.mjs';
import { createMemoryNewsletterProofStore } from '../test-support/memory-newsletter-proof-store.mjs';
import { assertDisposableDatabaseUrl } from './test-database-guard.mjs';

const hash = () => randomBytes(32).toString('hex');
const scope = 'newsletter-status-dispatch';
const future = () => new Date(Date.now() + 600_000);

async function contract(t, makeStore) {
  await t.test('availability and strict validation do not require mailbox data', async () => {
    const store = makeStore();
    assert.equal(await store.checkAvailable(), true);
    await assert.rejects(store.claimDispatch({ scope: 'arbitrary', emailHash: hash(), requestId: hash(), expiresAt: future() }), TypeError);
    await assert.rejects(store.claimDispatch({ scope, emailHash: 'person@example.test', requestId: hash(), expiresAt: future() }), TypeError);
    await assert.rejects(store.issueStatusToken({ tokenHash: hash(), emailHash: hash(), expiresAt: new Date(NaN) }), TypeError);
    await assert.rejects(store.reserveStatusBudget({ emailHash: hash(), now: '2026-01-01' }), TypeError);
  });
  await t.test('dispatch is atomic across instances, scoped, and fenced', async () => {
    const emailHash = hash(), requestId = hash();
    const attempts = await Promise.all(Array.from({ length: 12 }, () => makeStore().claimDispatch({ scope, emailHash, requestId, expiresAt: future() })));
    assert.equal(attempts.filter(Boolean).length, 1);
    assert.equal(await makeStore().markDispatchDone({ scope, emailHash, requestId: hash() }), false);
    assert.equal(await makeStore().markDispatchDone({ scope, emailHash, requestId }), true);
    assert.equal(await makeStore().claimDispatch({ scope, emailHash, requestId: hash(), expiresAt: future() }), false);
    for (const ingressScope of ['newsletter-public-optin', 'newsletter-public-status']) {
      assert.equal(await makeStore().claimDispatch({ scope: ingressScope, emailHash, requestId: hash(), expiresAt: future() }), true);
    }
  });
  await t.test('expired unknown dispatch remains permanently blocked after restart', async () => {
    const emailHash = hash(), requestId = hash(), expiresAt = new Date(1);
    assert.equal(await makeStore().claimDispatch({ scope, emailHash, requestId, expiresAt }), true);
    assert.equal(await makeStore().claimDispatch({ scope, emailHash, requestId: hash(), expiresAt: future() }), false);
    assert.deepEqual(await makeStore().inspectDispatch({ scope, emailHash }), { state: 'inflight', expiresAt });
    assert.equal(await makeStore().inspectDispatch({ scope, emailHash: hash() }), null);
  });
  await t.test('completed expired dispatch permits one replacement and fences stale completion', async () => {
    const emailHash = hash(), requestId = hash();
    await makeStore().claimDispatch({ scope, emailHash, requestId, expiresAt: new Date(1) });
    assert.equal(await makeStore().markDispatchDone({ scope, emailHash, requestId }), true);
    const replacements = await Promise.all(Array.from({ length: 10 }, () => makeStore().claimDispatch({ scope, emailHash, requestId: hash(), expiresAt: future() })));
    assert.equal(replacements.filter(Boolean).length, 1);
    assert.equal(await makeStore().markDispatchDone({ scope, emailHash, requestId }), false);
  });
  await t.test('token consume has exactly one winner and cannot be reissued', async () => {
    const tokenHash = hash(), emailHash = hash();
    assert.equal(await makeStore().issueStatusToken({ tokenHash, emailHash, expiresAt: future() }), true);
    assert.equal(await makeStore().consumeStatusToken({ tokenHash, emailHash: hash() }), false);
    const results = await Promise.all(Array.from({ length: 10 }, () => makeStore().consumeStatusToken({ tokenHash, emailHash })));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await makeStore().issueStatusToken({ tokenHash, emailHash, expiresAt: future() }), false);
    assert.equal(await makeStore().consumeStatusToken({ tokenHash, emailHash }), false);
    const expiredToken = hash();
    await makeStore().issueStatusToken({ tokenHash: expiredToken, emailHash, expiresAt: new Date(1) });
    assert.equal(await makeStore().consumeStatusToken({ tokenHash: expiredToken, emailHash }), false);
    assert.equal(await makeStore().consumeStatusToken({ tokenHash: hash(), emailHash }), false);
  });
  await t.test('hourly mailbox and global budgets are shared, atomic, and do not partially spend', async () => {
    // Unique hour isolates this test from other disposable-database suites without truncation.
    const now = new Date(randomInt(2_000_000, 20_000_000) * 3_600_000);
    const emailHash = hash();
    const attempts = await Promise.all(Array.from({ length: 12 }, () => makeStore().reserveStatusBudget({ emailHash, now })));
    assert.equal(attempts.filter(Boolean).length, 3);
    assert.equal(await makeStore().reserveStatusBudget({ emailHash, now: new Date(now.getTime() + 1_000) }), false);
    const otherAttempts = await Promise.all(Array.from({ length: 110 }, () => makeStore().reserveStatusBudget({ emailHash: hash(), now })));
    assert.equal(otherAttempts.filter(Boolean).length, 97);
    assert.equal(await makeStore().reserveStatusBudget({ emailHash: hash(), now }), false);
    assert.equal(await makeStore().reserveStatusBudget({ emailHash, now: new Date(now.getTime() + 3_600_000) }), true);
  });
}

test('test-only memory newsletter proof store contract', async t => {
  const records = new Map();
  await contract(t, () => createMemoryNewsletterProofStore({ records }));
});

const DATABASE_URL = String(process.env.DATABASE_URL || '').trim();
test('baseline PostgreSQL newsletter proof persistence', { skip: !DATABASE_URL }, async t => {
  assertDisposableDatabaseUrl(DATABASE_URL);
  const database = createDatabase({ connectionString: DATABASE_URL });
  const restartedDatabase = createDatabase({ connectionString: DATABASE_URL });
  t.after(async () => { await Promise.all([database.close(), restartedDatabase.close()]); });
  await applyMigrations(database);
  let instance = 0;
  await contract(t, () => createNewsletterProofStore(instance++ % 2 ? database : restartedDatabase));
  await t.test('stored proof contains only hashes, state, and empty response metadata', async () => {
    const emailHash = hash(), tokenHash = hash(), requestId = hash();
    const store = createNewsletterProofStore(database);
    await store.claimDispatch({ scope, emailHash, requestId, expiresAt: future() });
    await store.issueStatusToken({ tokenHash, emailHash, expiresAt: future() });
    await store.consumeStatusToken({ tokenHash, emailHash });
    const result = await database.query(
      'SELECT scope,key_hash,fingerprint,state,response_status,response_body FROM idempotency_keys WHERE key_hash IN ($1,$2) ORDER BY scope', [emailHash, tokenHash]);
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.rows.map(row => row.fingerprint).sort(), [emailHash, requestId].sort());
    for (const row of result.rows) {
      assert.match(row.key_hash, /^[0-9a-f]{64}$/);
      assert.ok(row.response_body === null || JSON.stringify(row.response_body) === '{}');
      assert.equal(JSON.stringify(row).includes('@'), false);
    }
  });
});

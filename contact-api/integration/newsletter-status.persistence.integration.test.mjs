import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../persistence/database.mjs';
import { applyMigrations } from '../persistence/migrator.mjs';
import { createPersistenceRepositories } from '../persistence/repositories.mjs';
import { createNewsletterProofStore } from '../persistence/newsletter-proof-store.mjs';
import { assertDisposableDatabaseUrl } from './test-database-guard.mjs';
import { applyNewsletterCandidate } from './newsletter-candidate.mjs';
import { createProvider, createManager, extractToken, consentEmailHash } from '../test-support/newsletter-provider.mjs';
const url=String(process.env.DATABASE_URL||'');
const proofToken=mail=>mail.body.text.match(/#status=([^\s]+)/)[1];
test('B2 real PG mailbox proof lifecycle, authoritative provider and admission', {skip:!url},async t=>{
  assertDisposableDatabaseUrl(url);const db=createDatabase({connectionString:url});t.after(()=>db.close());
  await applyMigrations(db);await applyNewsletterCandidate(db,url);
  const store=createNewsletterProofStore(db),consentStore=createPersistenceRepositories(db).newsletter;
  const provider=await createProvider(t);provider.consentStore=consentStore;
  const manager=()=>createManager(provider,{proofStore:store});
  await t.test('status request creates no consent; proof works once across manager restart',async()=>{
    const email='status-'+randomUUID()+'@example.test', m=manager();
    await Promise.all(Array.from({length:6},()=>m.requestStatus({email})));
    assert.equal(provider.emails.length,1);
    assert.equal(await consentStore.getContact(consentEmailHash(email)),null);
    const token=proofToken(provider.emails[0]);
    await assert.rejects(()=>m.confirm(token),{code:'INVALID_NEWSLETTER_TOKEN'});
    await assert.rejects(()=>m.unsubscribe(token),{code:'INVALID_NEWSLETTER_TOKEN'});
    const outcomes=await Promise.allSettled([m.checkStatus(token),manager().checkStatus(token)]);
    assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
    assert.deepEqual(outcomes.find(r=>r.status==='fulfilled').value,{state:'inactive'});
  });
  await t.test('pending and active verified states, suppression and provider errors',async()=>{
    const email='status-'+randomUUID()+'@example.test',m=manager();
    await m.requestOptIn({email});const doi=extractToken(provider.emails.at(-1),'confirm');
    await assert.rejects(()=>m.checkStatus(doi),{code:'NEWSLETTER_STATUS_TOKEN_INVALID'});
    async function proof() {
      // Simulate elapsed cooldown ONLY in isolated test state, not production recovery.
      await db.query("UPDATE idempotency_keys SET expires_at=now()-interval '1 second' WHERE scope='newsletter-status-dispatch' AND key_hash=$1 AND state='done'",[consentEmailHash(email)]);
      await m.requestStatus({email});return proofToken(provider.emails.at(-1));
    }
    assert.deepEqual(await m.checkStatus(await proof()),{state:'pending'});
    await m.confirm(doi);
    assert.deepEqual(await manager().checkStatus(await proof()),{state:'active'});
    const beforeSuppression=await proof();
    provider.suppressions.set(email,true);
    assert.deepEqual(await m.checkStatus(beforeSuppression),{state:'inactive'});
    provider.suppressions.delete(email);
    // Provider failure consumes proof and returns unavailable, never inactive.
    const freshEmail='status-'+randomUUID()+'@example.test';await m.requestStatus({email:freshEmail});
    const token=proofToken(provider.emails.at(-1));provider.behavior.suppressionError=403;
    await assert.rejects(()=>m.checkStatus(token),{code:'NEWSLETTER_STATUS_UNAVAILABLE'});
    await assert.rejects(()=>m.checkStatus(token),{code:'NEWSLETTER_STATUS_TOKEN_INVALID'});
    provider.behavior.suppressionError=0;
  });
  await t.test('public admission stays neutral on provider failure and after restart',async()=>{
    const email='status-'+randomUUID()+'@example.test',m=manager();provider.behavior.suppressionError=403;
    assert.deepEqual(await m.acceptOptIn({email}),{state:'request_received'});
    await m.waitForPublicWork();const before=provider.emails.length;
    provider.behavior.suppressionError=0;
    assert.deepEqual(await manager().acceptOptIn({email}),{state:'request_received'});
    assert.equal(provider.emails.length,before);
    assert.equal((await store.inspectDispatch({scope:'newsletter-public-optin',emailHash:consentEmailHash(email)})).state,'inflight');
  });
});

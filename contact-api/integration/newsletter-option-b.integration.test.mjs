import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {applyMigrations} from '../persistence/migrator.mjs';
import {createPersistenceRepositories} from '../persistence/repositories.mjs';
import {createNewsletterProofStore} from '../persistence/newsletter-proof-store.mjs';
import {createHeldNewsletterManager} from '../security/newsletter-recovery-hold.mjs';
import {applyNewsletterCandidate} from './newsletter-candidate.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
const url=process.env.DATABASE_URL;
const hash=n=>createHash('sha256').update('synthetic-280-'+n).digest('hex');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('280 held recovery preserves complete 2/32/1 legacy history, suppression, fences, tombstones and seals', {skip:!url},async t=>{
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});t.after(()=>db.close());
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await applyMigrations(db);await applyNewsletterCandidate(db,url);
  const store=createPersistenceRepositories(db).newsletter,proof=createNewsletterProofStore(db);
  for(const n of [1,2])await store.ensureContact({emailHash:hash(n)});
  await store.upsertContact({emailHash:hash(1),currentState:'subscribed',confirmedAt:new Date(1000)});
  await store.upsertContact({emailHash:hash(2),currentState:'unsubscribed',unsubscribedAt:new Date(2000),providerBlockedAt:new Date(2000)});
  for(let n=0;n<32;n++)await store.appendConsentEvent({eventId:uuid(n+1),emailHash:hash(n%2+1),eventType:n===0?'opt_in_confirmed':n===31?'unsubscribe':'opt_in_requested',occurredAt:new Date(1000+n),source:'synthetic-280'});
  const request={emailHash:hash(1),requestId:uuid(100),issuedAt:new Date(),expiresAt:new Date(Date.now()+60000),supersededBefore:new Date(0)};
  await store.claimOptInRequest(request);await store.markOptInSending(request);await store.markOptInUnknown(request);
  const dispatch={scope:'newsletter-public-optin',emailHash:hash(2),requestId:hash(3),expiresAt:new Date(1)};
  await proof.claimDispatch(dispatch);await proof.markDispatchEffect(dispatch);
  const token={tokenHash:hash(4),emailHash:hash(1),expiresAt:new Date(Date.now()+60000)};
  await proof.issueStatusToken(token);await proof.consumeStatusToken(token);
  await proof.reserveStatusBudget({emailHash:hash(1)});
  const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
  const snapshot=async()=>{
    const state={};
    for(const table of tables){
      assert.match(table,/^[a-z_]+$/);
      state[table]=(await db.query(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY to_jsonb(t)::text`)).rows;
    }
    return JSON.stringify(state);
  };
  const before=await snapshot();
  const counts=(await db.query("SELECT (SELECT count(*) FROM newsletter_contacts)::int contacts,(SELECT count(*) FROM newsletter_consent_events)::int events,(SELECT count(*) FROM newsletter_consent_events WHERE event_type='opt_in_confirmed')::int confirmed")).rows[0];
  assert.deepEqual(counts,{contacts:2,events:32,confirmed:1});
  for(let restart=0;restart<3;restart++){
    const held=createHeldNewsletterManager();
    await Promise.all(['n1.forged','ns1.forged','n2.unknown'].flatMap(token=>['confirm','unsubscribe','checkStatus'].map(method=>assert.rejects(held[method](token),{code:'NEWSLETTER_RECOVERY_HOLD'}))));
    await assert.rejects(held.requestOptIn({email:'unmapped@example.test'}),{code:'NEWSLETTER_RECOVERY_HOLD'});
  }
  assert.equal(await snapshot()===before,true,'complete snapshots identical (do not print rows)');
  assert.equal(await proof.consumeStatusToken(token),false);
  assert.equal((await store.claimOptInRequest({...request,requestId:uuid(101)})).claimed,false);
  await assert.rejects(()=>db.query("UPDATE newsletter_consent_events SET source='invalid'"));
  await assert.rejects(()=>store.importHistoricalOptIns({cutoverBefore:new Date(),writersStopped:true}),/writer start/);
});

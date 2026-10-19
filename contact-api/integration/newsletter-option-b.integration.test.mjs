import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {applyMigrations} from '../persistence/migrator.mjs';
import {createPersistenceRepositories} from '../persistence/repositories.mjs';
import {createNewsletterProofStore} from '../persistence/newsletter-proof-store.mjs';
import {syntheticLegacyEnvelopes} from '../test-support/synthetic-legacy-envelopes.mjs';
import {startHeldHttpServer} from '../test-support/held-http-server.mjs';
import {applyNewsletterCandidate} from './newsletter-candidate.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
const url=process.env.DATABASE_URL;
const hash=n=>createHash('sha256').update('synthetic-280-'+n).digest('hex');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('R3 real HTTP business server preserves complete 2/32/1 legacy history, suppression, fences, tombstones and seals', {skip:!url},async t=>{
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
  const snapshot=async({newsletterOnly=false}={})=>{
    const state={};
    const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
    for(const table of tables){
      assert.match(table,/^[a-z_]+$/);
      if(newsletterOnly&&['contact_cases','reply_tokens'].includes(table))continue;
      const where=newsletterOnly&&table==='idempotency_keys'?" WHERE t.scope <> 'contact'":'';
      state[table]=(await db.query(`SELECT to_jsonb(t) AS row FROM "${table}" t${where} ORDER BY to_jsonb(t)::text`)).rows;
    }
    return JSON.stringify(state);
  };
  let before=await snapshot();
  const newsletterBefore=await snapshot({newsletterOnly:true});
  const envelopes=syntheticLegacyEnvelopes();
  const counts=(await db.query("SELECT (SELECT count(*) FROM newsletter_contacts)::int contacts,(SELECT count(*) FROM newsletter_consent_events)::int events,(SELECT count(*) FROM newsletter_consent_events WHERE event_type='opt_in_confirmed')::int confirmed")).rows[0];
  assert.deepEqual(counts,{contacts:2,events:32,confirmed:1});
  for(let restart=0;restart<2;restart++){
    const server=await startHeldHttpServer(t,url);
    const readiness=await fetch(server.base+'/newsletter/ready');
    assert.equal(readiness.status,503);
    assert.deepEqual(await readiness.json(),{ready:false,configured:false,intakePaused:true,schemaReady:false});
    for(const token of [...Object.values(envelopes),'n1.test','ns1.test','n2.test'])for(const path of ['subscribe','status-request','confirm','unsubscribe','status-check']){
      const response=await fetch(server.base+'/newsletter/'+path,{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json'},body:JSON.stringify({token,email:'unmapped@example.test',consent:true})});
      assert.equal(response.status,503);
      assert.equal((await response.json()).error.code,'NEWSLETTER_NOT_CONFIGURED');
      assert.equal(await snapshot()===before,true,'HTTP action must not mutate historical rows');
    }
    const rejected=await fetch(server.base+'/contact',{method:'POST',headers:{origin:'https://untrusted.example.test','content-type':'application/json'},body:JSON.stringify({newsletter:true,email:'unmapped@example.test'})});
    assert.equal(rejected.status,403);assert.equal((await rejected.json()).error.code,'ORIGIN_NOT_ALLOWED');
    assert.equal(await snapshot()===before,true,'rejected contact leaves every table unchanged');
    const contact=await fetch(server.base+'/contact',{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json','x-idempotency-key':'synthetic-contact-'+restart},body:JSON.stringify({
      name:'Synthetic Player',email:'contact'+restart+'@example.test',category:'Pytanie ogólne',subject:'Synthetic request '+restart,
      message:'Synthetic contact regression message '+restart,acknowledgement:true,newsletter:true,website:'',startedAt:Date.now()-10000,
    })});
    assert.equal(contact.status,200);
    const result=await contact.json();assert.equal(result.ok,true);assert.equal(result.newsletter,'temporarily_unavailable');
    assert.equal(server.contactCalls,1,'only synthetic CONTACT delivery allowed');
    assert.equal(await snapshot({newsletterOnly:true})===newsletterBefore,true,'contact opt-in must preserve all newsletter state');
    before=await snapshot(); // CONTACT rows may change; subsequent restart must preserve them too.
    await server.stop();
    assert.equal(server.providerCalls,0);
    assert.doesNotMatch(server.logs,/unmapped@example|contact[01]@example|n1\.test|ns1\.test|n2\.test/);
    for(const envelope of Object.values(envelopes))assert.equal(server.logs.includes(envelope),false,'no bearer in logs');
    assert.equal(await snapshot()===before,true,'process shutdown preserves historical rows');
  }
  assert.equal(await snapshot()===before,true,'complete snapshots identical (do not print rows)');
  assert.equal(await proof.consumeStatusToken(token),false);
  assert.equal((await store.claimOptInRequest({...request,requestId:uuid(101)})).claimed,false);
  await assert.rejects(()=>db.query("UPDATE newsletter_consent_events SET source='invalid'"));
  await assert.rejects(()=>store.importHistoricalOptIns({cutoverBefore:new Date(),writersStopped:true}),/writer start/);
});

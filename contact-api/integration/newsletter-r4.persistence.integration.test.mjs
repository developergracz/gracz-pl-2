import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { createDatabase } from '../persistence/database.mjs';
import { createPersistenceRepositories } from '../persistence/repositories.mjs';
import { createNewsletterProofStore } from '../persistence/newsletter-proof-store.mjs';
import { createMemoryNewsletterConsentStore } from '../persistence/memory-newsletter-consent-store.mjs';
import { createMemoryNewsletterProofStore } from '../test-support/memory-newsletter-proof-store.mjs';
import { applyMigrations } from '../persistence/migrator.mjs';
import { applyNewsletterCandidate } from './newsletter-candidate.mjs';
import { assertDisposableDatabaseUrl } from './test-database-guard.mjs';
const hash = () => createHash('sha256').update(randomUUID()).digest('hex');

async function exercise(t, store, proof, ageDispatch, legacyDispatch) {
  await t.test('pre-effect expiry reclaims once and fences the old worker', async () => {
    const claim = {scope:'newsletter-public-optin', emailHash:hash(), requestId:hash(), expiresAt:new Date(Date.now()+3600000)};
    assert.equal(await proof.claimDispatch(claim), true);
    await ageDispatch(claim);
    const fresh = {...claim,requestId:hash()};
    assert.equal(await proof.claimDispatch(fresh), true);
    assert.equal(await proof.markDispatchEffect(claim), false);
    assert.equal(await proof.releaseDispatchBeforeEffect(claim), false);
    assert.equal(await proof.markDispatchDone(claim), false);
    assert.equal(await proof.markDispatchEffect(fresh), true);
    await ageDispatch(fresh);
    assert.equal(await proof.claimDispatch({...fresh,requestId:hash()}), false);
    assert.equal(await proof.releaseDispatchBeforeEffect(fresh), false);
  });
  await t.test('legacy inflight without phase never reclaims', async () => {
    const claim = {scope:'newsletter-public-optin',emailHash:hash(),requestId:hash(),expiresAt:new Date(1)};
    await legacyDispatch(claim);
    assert.equal(await proof.claimDispatch({...claim,requestId:hash(),expiresAt:new Date(Date.now()+60000)}), false);
  });
  await t.test('pre-send expiry fences zombies while ambiguous sends remain held', async () => {
    const claim = {emailHash:hash(),requestId:randomUUID(),issuedAt:new Date(Date.now()-120000),expiresAt:new Date(Date.now()+60000),supersededBefore:new Date(0)};
    assert.equal((await store.claimOptInRequest(claim)).state,'pre_send');
    const fresh = {...claim,requestId:randomUUID(),issuedAt:new Date()};
    assert.equal((await store.claimOptInRequest(fresh)).claimed,true);
    assert.equal(await store.markOptInSending(claim),false);
    assert.equal(await store.releaseOptInBeforeSend(claim),false);
    assert.equal(await store.markOptInSent(claim),false);
    assert.equal(await store.markOptInSending(fresh),true);
    await store.markOptInUnknown(fresh);
    assert.equal((await store.claimOptInRequest({...fresh,requestId:randomUUID(),issuedAt:new Date(Date.now()+1000),supersededBefore:new Date(Date.now()+2000)})).claimed,false);
    assert.equal(await store.releaseOptInBeforeSend(fresh),false);
  });
  await t.test('only matching stored confirmation with current consent reconciles both holds', async () => {
    const emailHash=hash(), requestId=randomUUID(), issuedAt=new Date(Date.now()-1000);
    const claim={emailHash,requestId,issuedAt,expiresAt:new Date(Date.now()+60000),supersededBefore:new Date(0)};
    await store.ensureContact({emailHash});
    await store.claimOptInRequest(claim);
    await store.markOptInSending(claim);
    await store.markOptInUnknown(claim);
    const dispatch={scope:'newsletter-public-optin',emailHash,requestId:hash(),expiresAt:new Date(Date.now()+60000)};
    await proof.claimDispatch(dispatch);
    await proof.markDispatchEffect(dispatch);
    const occurredAt=new Date(Date.now()+20);
    const eventId=randomUUID();
    await store.appendConsentEvent({eventId,emailHash,eventType:'opt_in_confirmed',source:'test',occurredAt,metadata:{tokenIssuedAt:issuedAt.getTime()}});
    assert.equal(await store.reconcileOptInFromConsent({...claim,eventId:randomUUID()}),false);
    assert.equal(await store.reconcileOptInFromConsent({...claim,eventId}),false,'pending contact is insufficient');
    await store.upsertContact({emailHash,currentState:'subscribed',confirmedAt:occurredAt});
    const wrongId=randomUUID();
    await store.appendConsentEvent({eventId:wrongId,emailHash,eventType:'opt_in_confirmed',source:'test',occurredAt,metadata:{tokenIssuedAt:issuedAt.getTime()-1}});
    assert.equal(await store.reconcileOptInFromConsent({...claim,eventId:wrongId}),false);
    assert.equal(await proof.reconcilePublicOptInFromConsent({emailHash,eventId}),false,'B1 must be reconciled first');
    assert.equal(await store.reconcileOptInFromConsent({...claim,eventId}),true);
    await store.upsertContact({emailHash,currentState:'unsubscribed',unsubscribedAt:occurredAt});
    assert.equal(await proof.reconcilePublicOptInFromConsent({emailHash,eventId}),false);
    await store.upsertContact({emailHash,currentState:'subscribed',confirmedAt:occurredAt});
    assert.equal(await proof.reconcilePublicOptInFromConsent({emailHash,eventId}),true);
    assert.equal((await proof.inspectDispatch(dispatch)).state,'done');
  });
  await t.test('historical import refuses running writers and preserves reservations and events', async () => {
    const emailHash=hash(), other=hash();
    for (const subject of [emailHash,other]) {
      await store.ensureContact({emailHash:subject});
      await store.appendConsentEvent({eventId:randomUUID(),emailHash:subject,eventType:'opt_in_requested',source:'test',occurredAt:new Date()});
    }
    const claim={emailHash,requestId:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+60000),supersededBefore:new Date(0)};
    await store.claimOptInRequest(claim);
    await assert.rejects(()=>store.importHistoricalOptIns({cutoverBefore:new Date(),writersStopped:true}),/writer/);
    assert.equal(await store.markOptInSending(claim),true);
    assert.equal((await store.claimOptInRequest({...claim,emailHash:other,requestId:randomUUID()})).claimed,true);
    assert.equal((await store.listConsentEvents(emailHash)).length,1);
  });
}

test('R4 memory persistence fences and reconciliation', async t => {
  const records=new Map();
  const store=createMemoryNewsletterConsentStore();
  const proof=createMemoryNewsletterProofStore({records,consentStore:store});
  await exercise(t,store,proof, async claim => {records.get(`${claim.scope}:${claim.emailHash}`).updatedAt=new Date(0);}, async claim => {
    records.set(`${claim.scope}:${claim.emailHash}`,{state:'inflight',requestId:claim.requestId,expiresAt:claim.expiresAt,updatedAt:new Date(0)});
  });
});

test('R4 real PostgreSQL persistence fences and reconciliation', {skip:!process.env.DATABASE_URL}, async t => {
  assertDisposableDatabaseUrl(process.env.DATABASE_URL);
  const db=createDatabase({connectionString:process.env.DATABASE_URL});
  t.after(()=>db.close());
  await applyMigrations(db);
  await applyNewsletterCandidate(db,process.env.DATABASE_URL);
  const store=createPersistenceRepositories(db).newsletter;
  await store.checkOptInAvailable();
  await exercise(t,store,createNewsletterProofStore(db), async claim => {
    await db.query("UPDATE idempotency_keys SET updated_at=now()-interval '2 minutes' WHERE scope=$1 AND key_hash=$2",[claim.scope,claim.emailHash]);
  }, async claim => {
    await db.query("INSERT INTO idempotency_keys(scope,key_hash,fingerprint,state,expires_at,updated_at) VALUES ($1,$2,$3,'inflight',$4,now()-interval '2 minutes')",[claim.scope,claim.emailHash,claim.requestId,claim.expiresAt]);
  });
});

test('candidate remains outside the default migrator directory', async () => {
  const names=await readdir(new URL('../persistence/migrations/',import.meta.url));
  assert.equal(names.some(name=>name.startsWith('005')),false);
});

test('candidate rejects a substituted safe URL for a remote actual client', async () => {
  let queried=false;
  const db={getConnectionIdentity:()=>({host:'172.20.0.3',database:'gracz_test'}),query:async()=>{queried=true;}};
  await assert.rejects(()=>applyNewsletterCandidate(db,'postgres://localhost/gracz_test'),/connection identity mismatch/);
  assert.equal(queried,false);
});

test('R4 private diagnostics and retention preserve uncertain work and replay protection', {skip:!process.env.DATABASE_URL}, async t=>{
  assertDisposableDatabaseUrl(process.env.DATABASE_URL);
  const db=createDatabase({connectionString:process.env.DATABASE_URL});t.after(()=>db.close());
  await applyMigrations(db);await applyNewsletterCandidate(db,process.env.DATABASE_URL);
  const {createNewsletterOperations}=await import('../persistence/newsletter-operations.mjs');
  const ops=createNewsletterOperations(db), proof=createNewsletterProofStore(db);
  const subject=hash(),request=hash();
  const uncertain={scope:'newsletter-public-optin',emailHash:subject,requestId:request,expiresAt:new Date(1)};
  await proof.claimDispatch(uncertain);await proof.markDispatchEffect(uncertain);
  await db.query("UPDATE idempotency_keys SET updated_at=now()-interval '2 days' WHERE scope=$1 AND key_hash=$2",[uncertain.scope,subject]);
  const expired=hash(),valid=hash();
  await proof.issueStatusToken({tokenHash:expired,emailHash:subject,expiresAt:new Date(1)});
  await proof.issueStatusToken({tokenHash:valid,emailHash:subject,expiresAt:new Date(Date.now()+600000)});
  assert.equal(await proof.consumeStatusToken({tokenHash:valid,emailHash:subject}),true);
  const report=await ops.inspect();assert.equal(report.alarms.stalled,true);
  const serialized=JSON.stringify(report);for(const forbidden of [subject,request,expired,valid,'email_hash','fingerprint'])assert.ok(!serialized.includes(forbidden));
  const before=(await db.query('SELECT count(*) FROM newsletter_consent_events')).rows[0].count;
  const result=await ops.purgeExpiredProofs();assert.ok(result.removed>=1);
  assert.equal(await proof.claimDispatch({...uncertain,requestId:hash()}),false);
  assert.equal(await proof.consumeStatusToken({tokenHash:valid,emailHash:subject}),false);
  assert.equal(await proof.consumeStatusToken({tokenHash:expired,emailHash:subject}),false);
  assert.equal((await db.query('SELECT count(*) FROM newsletter_consent_events')).rows[0].count,before);
});

test('R4 unnumbered expand proposal preserves old inflight and refuses old schema readiness', {skip:!process.env.DATABASE_URL},async t=>{
  assertDisposableDatabaseUrl(process.env.DATABASE_URL);
  const db=createDatabase({connectionString:process.env.DATABASE_URL});t.after(()=>db.close());
  const {readFile}=await import('node:fs/promises');
  const {createNewsletterOptInStore}=await import('../persistence/newsletter-opt-in-store.mjs');
  const upgrade=await readFile(new URL('../persistence/candidates/newsletter_r4_expand_existing.sql',import.meta.url),'utf8');
  await db.transaction(async client=>{
    await client.query('CREATE SCHEMA r4_upgrade_fixture');await client.query('SET LOCAL search_path TO r4_upgrade_fixture');
    await client.query(`CREATE TABLE newsletter_opt_in_requests(email_hash char(64) PRIMARY KEY,request_id uuid UNIQUE,state varchar(16) NOT NULL DEFAULT 'inflight' CHECK(state IN ('inflight','unknown','sent','legacy_pending')),issued_at timestamptz,expires_at timestamptz CHECK(expires_at > issued_at),sent_at timestamptz,CHECK((state='sent')=(sent_at IS NOT NULL)))`);
    await client.query("INSERT INTO newsletter_opt_in_requests(email_hash,request_id,issued_at,expires_at) VALUES($1,$2,now()-interval '2 days',now()-interval '1 day')",[hash(),randomUUID()]);
    const store=createNewsletterOptInStore(client);
    await assert.rejects(()=>store.checkOptInAvailable());
    await client.query(upgrade);
    await client.query("ALTER TABLE newsletter_opt_in_requests ALTER COLUMN email_hash SET NOT NULL, ALTER COLUMN request_id SET NOT NULL, ALTER COLUMN issued_at SET NOT NULL, ALTER COLUMN expires_at SET NOT NULL, ADD CHECK(email_hash ~ '^[0-9a-f]{64}$')");
    await client.query('CREATE TABLE idempotency_keys (LIKE public.idempotency_keys INCLUDING ALL)');
    assert.equal(await store.checkOptInAvailable(),true);
    assert.deepEqual((await client.query('SELECT state,sent_at FROM newsletter_opt_in_requests')).rows,[{state:'inflight',sent_at:null}]);
    await client.query('DROP SCHEMA r4_upgrade_fixture CASCADE');
  });
});

test('R4 logical restore preserves unknown reservations, consumed proof and append-only evidence', {skip:!process.env.DATABASE_URL},async t=>{
  assertDisposableDatabaseUrl(process.env.DATABASE_URL);
  const db=createDatabase({connectionString:process.env.DATABASE_URL});t.after(()=>db.close());
  await applyMigrations(db);await applyNewsletterCandidate(db,process.env.DATABASE_URL);
  const subject=hash(),token=hash(),requestId=randomUUID();
  const live=createPersistenceRepositories(db).newsletter,proof=createNewsletterProofStore(db);
  await live.ensureContact({emailHash:subject});
  await live.appendConsentEvent({eventId:randomUUID(),emailHash:subject,eventType:'opt_in_requested',occurredAt:new Date(),source:'dr-fixture'});
  await live.claimOptInRequest({emailHash:subject,requestId,issuedAt:new Date(),expiresAt:new Date(Date.now()+600000),supersededBefore:new Date(0)});
  await live.markOptInSending({emailHash:subject,requestId});await live.markOptInUnknown({emailHash:subject,requestId});
  const dispatch={scope:'newsletter-public-optin',emailHash:subject,requestId:hash(),expiresAt:new Date(1)};
  await proof.claimDispatch(dispatch);await proof.markDispatchEffect(dispatch);
  await proof.issueStatusToken({tokenHash:token,emailHash:subject,expiresAt:new Date(Date.now()+600000)});
  await proof.consumeStatusToken({tokenHash:token,emailHash:subject});
  await db.transaction(async client=>{
    await client.query('CREATE SCHEMA r4_dr_fixture');
    // Coherent SQL logical snapshot into a separate namespace; never application memory.
    for(const table of ['newsletter_contacts','newsletter_consent_events','newsletter_opt_in_requests','idempotency_keys']) {
      await client.query(`CREATE TABLE r4_dr_fixture.${table} (LIKE public.${table} INCLUDING ALL)`);
      await client.query(`INSERT INTO r4_dr_fixture.${table} SELECT * FROM public.${table}`);
    }
    await client.query('SET LOCAL search_path TO r4_dr_fixture');
    const restoredDatabase={enabled:true,query:client.query.bind(client),transaction:work=>work(client)};
    const recovered=createPersistenceRepositories(restoredDatabase).newsletter,recoveredProof=createNewsletterProofStore(restoredDatabase);
    assert.equal((await recovered.claimOptInRequest({emailHash:subject,requestId:randomUUID(),issuedAt:new Date(Date.now()+1),expiresAt:new Date(Date.now()+600001),supersededBefore:new Date()})).claimed,false);
    assert.equal(await recoveredProof.claimDispatch({...dispatch,requestId:hash()}),false);
    assert.equal(await recoveredProof.consumeStatusToken({tokenHash:token,emailHash:subject}),false);
    assert.equal((await recovered.listConsentEvents(subject)).length,1);
    await client.query('DROP SCHEMA r4_dr_fixture CASCADE');
  });
});

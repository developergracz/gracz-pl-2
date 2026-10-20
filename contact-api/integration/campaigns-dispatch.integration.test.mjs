import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createCampaignPgDispatchStore} from '../campaigns/pg-dispatch-store.mjs';

const url=process.env.DATABASE_URL;
const sql=await Promise.all([
  '../persistence/new-only/001_new_only_doi.sql',
  '../persistence/new-only/002_verified_withdrawal.sql',
  '../campaigns/schema-r1.sql',
].map(file=>readFile(new URL(file,import.meta.url),'utf8')));
const emailTag='a'.repeat(64);
const campaignId=randomUUID();
const dispatchId=randomUUID();

test('campaign PostgreSQL reservation, DOI, withdrawal and single claim',{timeout:30000},async t=>{
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  t.after(async()=>{
    try {await db.query('DROP SCHEMA IF EXISTS newsletter_campaigns CASCADE');} finally {
      await db.query('DROP SCHEMA IF EXISTS newsletter_new CASCADE');
      await db.close();
    }
  });
  await db.query('DROP SCHEMA IF EXISTS newsletter_campaigns CASCADE');
  await db.query('DROP SCHEMA IF EXISTS newsletter_new CASCADE');
  for(const statement of sql) await db.query(statement);
  await db.query(`INSERT INTO newsletter_new.subscribers
    (email_tag,ciphertext,nonce,auth_tag,challenge_id,state,delivery_state,
     source,consent_version,expires_at,confirmed_at)
    VALUES($1,$2,$3,$4,$5,'active','sent','newsletter',
      'newsletter-new-only-2026-10-20',clock_timestamp()+interval '1 day',clock_timestamp())`,
  [emailTag,Buffer.alloc(20,1),Buffer.alloc(12,2),Buffer.alloc(16,3),randomUUID()]);
  await db.query(`INSERT INTO newsletter_new.consent_events
    (event_id,email_tag,challenge_id,event_type,consent_version,source)
    VALUES ($1,$2,$3,'opt_in_confirmed','newsletter-new-only-2026-10-20','newsletter')`,
    [randomUUID(),emailTag,randomUUID()]);
  await db.query(`INSERT INTO newsletter_campaigns.campaigns
    (id,subject,body,audience,state,approved_at)
    VALUES ($1,'Nowości gracz.pl','Witaj w newsletterze','confirmed_active_new_only',
      'approved',clock_timestamp())`,[campaignId]);
  const reserve=async(id)=>db.query(
    'SELECT newsletter_campaigns.reserve_confirmed($1,$2,$3,$4) AS ok',
    [campaignId,id,randomUUID(),emailTag]);
  assert.equal((await reserve(dispatchId)).rows[0].ok,true);
  assert.equal((await reserve(randomUUID())).rows[0].ok,false);
  const store=createCampaignPgDispatchStore({database:db});
  assert.equal(await store.claim({campaignId,dispatchId}),true);
  assert.equal(await store.claim({campaignId,dispatchId}),false);
  assert.equal(await store.recordOutcome({campaignId,dispatchId,accepted:false}),true);
  assert.equal(await store.recordOutcome({campaignId,dispatchId,accepted:true}),false);
  const nextCampaign=randomUUID();
  await db.query(`INSERT INTO newsletter_campaigns.campaigns
    (id,subject,body,audience,state,approved_at)
    VALUES ($1,'Kolejne gry','Przeczytaj nowe wiadomości','confirmed_active_new_only',
      'approved',clock_timestamp())`,[nextCampaign]);
  await db.query('INSERT INTO newsletter_new.revocations(email_tag,challenge_id) VALUES($1,$2)',
    [emailTag,randomUUID()]);
  const afterWithdrawal=await db.query(
    'SELECT newsletter_campaigns.reserve_confirmed($1,$2,$3,$4) AS ok',
    [nextCampaign,randomUUID(),randomUUID(),emailTag]);
  assert.equal(afterWithdrawal.rows[0].ok,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {
  createCampaignAudienceProofCount,CAMPAIGN_CONSENT_VERSION
} from '../campaigns/audience-proof-count.mjs';

test('new-only DOI evidence count excludes pending, unconfirmed and revoked recipients',
  {timeout:30000},async t=>{
  const url=process.env.DATABASE_URL;
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  t.after(async()=>{
    try{await db.query('DROP SCHEMA IF EXISTS newsletter_new CASCADE');}
    finally{await db.close();}
  });
  await db.query('DROP SCHEMA IF EXISTS newsletter_new CASCADE');
  for(const path of [
    '../persistence/new-only/001_new_only_doi.sql',
    '../persistence/new-only/002_verified_withdrawal.sql'
  ]) await db.query(await readFile(new URL(path,import.meta.url),'utf8'));
  const count=createCampaignAudienceProofCount({database:db});
  const insert=async(letter,{pending=false,version=CAMPAIGN_CONSENT_VERSION,
    event=true,revoked=false}={})=>{
    const emailTag=letter.repeat(64),challenge=randomUUID();
    await db.query(`INSERT INTO newsletter_new.subscribers
      (email_tag,ciphertext,nonce,auth_tag,challenge_id,token_tag,state,
       delivery_state,source,consent_version,expires_at,confirmed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,'sent','newsletter',$8,
        clock_timestamp()+interval '1 day',$9)`,[
      emailTag,Buffer.alloc(24,1),Buffer.alloc(12,2),Buffer.alloc(16,3),
      challenge,pending?'f'.repeat(64):null,pending?'pending':'active',version,
      pending?null:new Date()
    ]);
    if(event){
      await db.query(`INSERT INTO newsletter_new.consent_events
        (event_id,email_tag,challenge_id,event_type,consent_version,source)
        VALUES ($1,$2,$3,'opt_in_confirmed',$4,'newsletter')`,
        [randomUUID(),emailTag,challenge,version]);
    }
    if(revoked){
      await db.query('INSERT INTO newsletter_new.revocations(email_tag,challenge_id) VALUES($1,$2)',
        [emailTag,randomUUID()]);
    }
    return emailTag;
  };
  const active=await insert('a');
  await insert('b',{revoked:true});
  await insert('c',{pending:true,event:false});
  await insert('d',{event:false});
  await insert('e',{version:'outdated-consent'});
  assert.equal((await count()).confirmed,1);
  await db.query('INSERT INTO newsletter_new.revocations(email_tag,challenge_id) VALUES($1,$2)',
    [active,randomUUID()]);
  assert.equal((await count()).confirmed,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createCipheriv,createHmac} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createCampaignDraftStore} from '../campaigns/draft-store.mjs';
import {createCampaignRecipientEvidenceReview} from '../campaigns/recipient-evidence-review.mjs';
import {createCampaignPgDispatchStore} from '../campaigns/pg-dispatch-store.mjs';
import {createNewOnlyNewsletter} from '../new-only-newsletter.mjs';
import {createCampaignAudienceProofCount} from '../campaigns/audience-proof-count.mjs';
import {createCampaignOwnerSender} from '../campaigns/owner-send.mjs';
import {CAMPAIGN_CONSENT_VERSION} from '../campaigns/audience-proof-count.mjs';

// Real PostgreSQL and production adapters; only outbound HTTP is synthetic.
test('manual campaign send is fail-closed, durable and once-only',{timeout:60000},async t=>{
  const url=process.env.DATABASE_URL;
  assertDisposableDatabaseUrl(url);
  const database=createDatabase({connectionString:url,poolOptions:{max:1}});
  const reset=async()=>{
    for(const name of ['newsletter_campaigns','newsletter_new','newsletter_recovery'])
      await database.query('DROP SCHEMA IF EXISTS '+name+' CASCADE');
  };
  t.after(async()=>{await reset();await database.close();});
  await reset();
  for(const path of ['persistence/new-only/001_new_only_doi.sql',
    'persistence/new-only/002_verified_withdrawal.sql',
    'persistence/recovery/001_withdrawal_queue.sql',
    'campaigns/draft-only-manual-r1.sql','campaigns/schema-r1.sql'])
    await database.query(await readFile(new URL('../'+path,import.meta.url),'utf8'));
  const enc=Buffer.alloc(32,11),subject=Buffer.alloc(32,22),withdrawal=Buffer.alloc(32,33);
  const address='synthetic@example.test';
  const emailTag=createHmac('sha256',subject).update('gracz-new-only:email\n'+address).digest('hex');
  const nonce=Buffer.alloc(12,44),cipher=createCipheriv('aes-256-gcm',enc,nonce);
  cipher.setAAD(Buffer.from('gracz-newsletter-new:'+emailTag));
  const ciphertext=Buffer.concat([cipher.update(address),cipher.final()]);
  const challenge=randomUUID();
  await database.query(`INSERT INTO newsletter_new.subscribers
    (email_tag,ciphertext,nonce,auth_tag,challenge_id,state,delivery_state,source,consent_version,expires_at,confirmed_at)
    VALUES($1,$2,$3,$4,$5,'active','sent','newsletter',$6,now()+interval '1 day',now())`,
    [emailTag,ciphertext,nonce,cipher.getAuthTag(),challenge,CAMPAIGN_CONSENT_VERSION]);
  const drafts=createCampaignDraftStore({database});
  const content={subject:'Test kampanii',body:'Wyłącznie syntetyczna wiadomość.',audience:'confirmed_active_new_only'};
  const campaign=async()=>{
    const {id}=await drafts.save(content);
    await drafts.approve(id,content);
    return id;
  };
  let calls=0,uncertain=false,providerAllowed=true;
  const config={database,enabled:true,newEncryptionKey:enc.toString('base64url'),
    newSubjectKey:subject.toString('base64url'),withdrawalRecipientTagKey:withdrawal.toString('base64url'),
    checkDeliveryAllowed:async()=>providerAllowed,
    apiKey:'synthetic-api-key',from:'newsletter@example.test',checkWithdrawalReady:async()=>true,
    fetchFn:async(_url,options)=>{
      calls++;
      assert.equal(JSON.parse(options.body).to[0],address);
      if(uncertain)throw Error('synthetic timeout');
      return {status:200,json:async()=>({id:'synthetic-message-1234'})};
    }};
  const sender=createCampaignOwnerSender(config);
  const id=await campaign();
  assert.equal((await sender.send(id)).accepted,0,'no DOI event');
  assert.equal(calls,0);
  await database.query(`INSERT INTO newsletter_new.consent_events
    (event_id,email_tag,challenge_id,event_type,consent_version,source)
    VALUES($1,$2,$3,'opt_in_confirmed',$4,'newsletter')`,[randomUUID(),emailTag,challenge,CAMPAIGN_CONSENT_VERSION]);
  await assert.rejects(createCampaignOwnerSender({...config,enabled:false}).send(id));
  await assert.rejects(database.query("UPDATE newsletter_campaigns.campaigns SET body='Changed approved body' WHERE id=$1",[id]));
  const results=await Promise.all([sender.send(id),createCampaignOwnerSender(config).send(id)]);
  assert.equal(results.reduce((n,r)=>n+r.accepted,0),1);
  assert.equal(calls,1);
  await createCampaignOwnerSender(config).send(id);
  assert.equal(calls,1,'restart cannot replay');
  const unknown=await campaign();
  uncertain=true;
  assert.equal((await sender.send(unknown)).state,'uncertain');
  await createCampaignOwnerSender(config).send(unknown);
  assert.equal(calls,2,'unknown provider result cannot replay');
  assert.equal((await database.query('SELECT state FROM newsletter_campaigns.dispatches WHERE campaign_id=$1',[unknown])).rows[0].state,'uncertain');
  // Consent changed after resolution/reservation: the final check must see it.
  const freshCheck=await campaign();
  const changingDb={...database,transaction:async work=>{
    let claim=false;
    const result=await database.transaction(client=>work({query:async(sql,params)=>{
      if(sql.includes('claim_delivery'))claim=true;
      return client.query(sql,params);
    }}));
    if(claim)await database.query("UPDATE newsletter_new.subscribers SET delivery_state='uncertain' WHERE email_tag=$1",[emailTag]);
    return result;
  }};
  assert.equal((await createCampaignOwnerSender({...config,database:changingDb}).send(freshCheck)).suppressed,1);
  assert.equal(calls,2,'fresh DOI review runs after claim, before provider');
  await database.query("UPDATE newsletter_new.subscribers SET delivery_state='sent' WHERE email_tag=$1",[emailTag]);
  await database.query('INSERT INTO newsletter_new.revocations(email_tag,challenge_id) VALUES($1,$2)',[emailTag,randomUUID()]);
  assert.equal((await sender.send(await campaign())).accepted,0);
  assert.equal(calls,2,'revoked consent never reaches provider');
  // Exercise the real renewed DOI, immutable withdrawal history and provider gate.
  const recoveryTag=createHmac('sha256',withdrawal).update('gracz-withdrawal-v1\0recipient\0'+address).digest('hex');
  const addWithdrawal=async()=>{
    const request=randomUUID(),withdrawChallenge=randomUUID();
    await database.query(`INSERT INTO newsletter_recovery.withdrawal_requests
      (request_id,dedupe_tag,intake_source,evidence_ref) VALUES($1,$2,'self_service',$3)`,
      [request,withdrawChallenge.replaceAll('-','').repeat(2),randomUUID()]);
    await database.query(`INSERT INTO newsletter_recovery.self_service_challenges
      (challenge_id,recipient_tag,token_tag,ciphertext,nonce,auth_tag,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,clock_timestamp()+interval '30 minutes')`,
      [withdrawChallenge,recoveryTag,withdrawChallenge.replaceAll('-','').repeat(2),ciphertext,nonce,Buffer.alloc(16)]);
    await database.query('INSERT INTO newsletter_recovery.self_service_verified(challenge_id,withdrawal_request_id) VALUES($1,$2)',[withdrawChallenge,request]);
    await database.query('INSERT INTO newsletter_recovery.self_service_provider_intents(challenge_id) VALUES($1)',[withdrawChallenge]);
    await database.query('INSERT INTO newsletter_recovery.self_service_provider_verified(challenge_id) VALUES($1)',[withdrawChallenge]);
    return withdrawChallenge;
  };
  await addWithdrawal();
  const review=createCampaignRecipientEvidenceReview(config);
  const dispatch=createCampaignPgDispatchStore({database});
  const tokens=[];
  const manager=createNewOnlyNewsletter({database,enabled:true,
    encryptionKey:enc.toString('base64url'),subjectKey:subject.toString('base64url'),
    apiKey:'synthetic',emailFrom:'newsletter@example.test',checkDeliveryAllowed:async()=>providerAllowed,
    fetchFn:async(_url,options)=>{
      tokens.push(JSON.parse(options.body).text.match(/#confirm=(ni3\.[\w.-]+)/)[1]);
      return {ok:true,json:async()=>({id:'synthetic-doi'})};
    }});
  providerAllowed=false;
  await manager.acceptOptIn({email:address});
  assert.equal(tokens.length,0,'suppression blocks DOI');
  providerAllowed=true;uncertain=false;
  await Promise.all(Array.from({length:3},()=>manager.acceptOptIn({email:address})));
  assert.equal(tokens.length,1,'parallel submissions reserve one DOI');
  assert.equal((await review(emailTag)).state,'no_current_doi');
  await assert.rejects(sender.send(await campaign()),{code:'campaign_send_unavailable'});
  await manager.confirm(tokens[0]);
  await assert.rejects(manager.confirm(tokens[0]),{code:'NEWSLETTER_CONFIRM_REJECTED'});
  const count=createCampaignAudienceProofCount({database});
  assert.equal((await count()).confirmed,1,'historical withdrawal does not erase new DOI');
  providerAllowed=false;
  assert.equal((await review(emailTag)).state,'provider_evidence_hold','suppression still denies renewed consent');
  assert.equal(calls,2);
  providerAllowed=true;
  assert.equal((await review(emailTag)).state,'evidence_complete_for_review');
  const futureCampaign=await campaign();
  const reserved=await dispatch.reserve({campaignId:futureCampaign,emailTag});
  assert.ok(reserved,'renewed consent qualifies for a future reservation');
  assert.equal(await dispatch.claim({campaignId:futureCampaign,dispatchId:reserved}),true);
  await assert.rejects(sender.send(await campaign()),{code:'campaign_send_unavailable'});
  assert.equal(calls,2,'global HOLD remains despite renewed consent');
  const second=await addWithdrawal();
  // Even before the callback updates the subscriber, the fresh recovery evidence denies.
  assert.equal((await review(emailTag)).state,'verified_withdrawal','later recovery withdrawal denies');
  await database.transaction(client=>manager.recordVerifiedWithdrawal({client,email:address,challengeId:second}));
  assert.equal((await count()).confirmed,0);
  await assert.rejects(manager.confirm(tokens[0]),{code:'NEWSLETTER_CONFIRM_REJECTED'});
  assert.equal((await database.query('SELECT count(*) FROM newsletter_new.revocations')).rows[0].count,'1');
  await assert.rejects(database.query('DELETE FROM newsletter_new.revocations'));
  assert.equal((await database.query('SELECT count(*) FROM newsletter_recovery.self_service_verified')).rows[0].count,'2');
  await database.query(`INSERT INTO newsletter_recovery.withdrawal_requests
    (request_id,dedupe_tag,intake_source,evidence_ref) VALUES($1,$2,'operator_record',$3)`,
    [randomUUID(),'b'.repeat(64),randomUUID()]);
  await assert.rejects(sender.send(await campaign()));
  assert.equal(calls,2,'global HOLD never reaches provider');
  await assert.rejects(createCampaignOwnerSender({...config,database:{
    transaction:async()=>{throw Error('database unavailable');},
    queryBounded:async()=>{throw Error('database unavailable');}
  }}).send(id));
  assert.equal(calls,2);
});

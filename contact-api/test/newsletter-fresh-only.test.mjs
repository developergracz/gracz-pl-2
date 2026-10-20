import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createFreshNewsletter,createFreshResend} from '../persistence/fresh-newsletter.mjs';

function harness({eligible=true,enroll=true,send=true}={}) {
  let challenge=null,confirmed=false,attempts=0,sent=null,providerEffects=0;
  const database={
    async transaction(fn){return fn({
      async query(sql,params=[]) {
        if(sql.startsWith('SELECT pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
        if(sql.startsWith('SELECT 1 FROM newsletter_fresh.consent_events'))
          return {rowCount:confirmed?1:0,rows:[]};
        if(sql.startsWith('SELECT 1 FROM newsletter_fresh.challenges'))
          return {rowCount:challenge?1:0,rows:[]};
        if(sql.startsWith('INSERT INTO newsletter_fresh.mail_budget'))
          return {rowCount:1,rows:[{count:1}]};
        if(sql.startsWith('INSERT INTO newsletter_fresh.challenges')) {
          const [challenge_id,recipient_tag,token_tag,ciphertext,nonce,auth_tag,source,consent_version]=params;
          challenge={challenge_id,recipient_tag,token_tag,ciphertext,nonce,auth_tag,source,consent_version};
          return {rowCount:1};
        }
        if(sql.startsWith('SELECT challenge_id,recipient_tag'))return {rowCount:challenge&&!confirmed?1:0,rows:challenge?[challenge]:[]};
        if(sql.startsWith('INSERT INTO newsletter_fresh.consent_events')){
          confirmed=true;return {rowCount:1,rows:[]};
        }
        return {rowCount:1,rows:[{}]};
      }
    });},
    async query(){return {rowCount:1,rows:[]};},
    async queryBounded(){return {rowCount:1,rows:[{n:0}]};}
  };
  const provider={
    async isEligible(){providerEffects++;return eligible;},
    async enroll(){providerEffects++;return enroll;}
  };
  const mailer={async send(item){attempts++;sent=item;return send;}};
  const manager=createFreshNewsletter({database,rootKey:randomBytes(32),mailer,provider});
  return {manager,mail:()=>sent,attempts:()=>attempts,effects:()=>providerEffects,
    get challenge(){return challenge;},get confirmed(){return confirmed;}};
}

test('fresh-only: no old consent lookup; new email requires mailbox challenge and provider verification',async()=>{
  const h=harness();
  assert.equal(await h.manager.readiness(),true);
  assert.deepEqual(await h.manager.request({email:'new@example.test'}),{state:'request_received'});
  assert.equal(h.attempts(),1);
  assert.equal(h.challenge.ciphertext.length,'new@example.test'.length);
  const proof=h.mail();
  assert.equal(typeof proof.token,'string');
  assert.deepEqual(await h.manager.confirm({id:proof.id,token:proof.token}),
    {state:'subscribed',confirmed:true});
  assert.equal(h.confirmed,true);
  await assert.rejects(h.manager.confirm({id:proof.id,token:proof.token}),{code:'FRESH_PROOF_REJECTED'});
});

test('fresh-only: provider suppression or historic contact refuses new DOI',async()=>{
  const h=harness({eligible:false});
  assert.deepEqual(await h.manager.request({email:'blocked@example.test'}),{state:'request_received'});
  assert.equal(h.attempts(),0);
  assert.equal(h.challenge,null);
});

test('fresh-only: provider uncertainty must not claim active signup',async()=>{
  const h=harness({enroll:false});
  await h.manager.request({email:'person@example.test'});
  const proof=h.mail();
  assert.deepEqual(await h.manager.confirm({id:proof.id,token:proof.token}),
    {state:'provider_pending',confirmed:false});
});

test('fresh-only: duplicate request does not resend DOI, forged token has no provider effect',async()=>{
  const h=harness();
  await h.manager.request({email:'same@example.test'});
  await h.manager.request({email:'same@example.test'});
  assert.equal(h.attempts(),1);
  const proof=h.mail(),before=h.effects();
  await assert.rejects(h.manager.confirm({id:proof.id,token:'z'.repeat(43)}),
    {code:'FRESH_PROOF_REJECTED'});
  assert.equal(h.effects(),before);
});

test('fresh Resend: sender and manager keys are separate and existing contact blocks activation',async()=>{
  const requests=[];
  const fetcher=async(url,opt)=>{
    const path=new URL(url).pathname;
    requests.push({path,method:opt.method,auth:opt.headers.Authorization});
    if(path.startsWith('/suppressions/'))return {status:404,json:async()=>({})};
    if(path.startsWith('/contacts/')&&opt.method==='GET')
      return {status:200,json:async()=>({id:'existing',unsubscribed:true})};
    throw new Error('Unplanned provider call');
  };
  const svc=createFreshResend({sendKey:'send-key',manageKey:'management-key',emailFrom:'gracz.pl <kontakt@gracz.pl>',
    segmentId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',request:fetcher});
  assert.equal(await svc.isEligible('existing@example.test'),false);
  assert.equal(await svc.enroll('existing@example.test'),false);
  assert.ok(requests.every(x=>x.auth==='Bearer management-key'));
  assert.ok(!requests.some(x=>x.method==='POST'));
});

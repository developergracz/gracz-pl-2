import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHmac,randomBytes} from 'node:crypto';
import {createCampaignRecipientEvidenceReview} from '../campaigns/recipient-evidence-review.mjs';
import {CAMPAIGN_CONSENT_VERSION} from '../campaigns/audience-proof-count.mjs';

function fixture({
  pending=false,obligation=false,doi=true,withdrawn=false,corrupt=false,
  mismatchedTag=false,queryFails=false,providerAllowed=true
}={}){
  const enc=randomBytes(32),subject=randomBytes(32),withdrawal=randomBytes(32);
  const email='recipient@example.test';
  const tag=createHmac('sha256',subject)
    .update('gracz-new-only:email\n'+email).digest('hex');
  const nonce=randomBytes(12);
  const c=createCipheriv('aes-256-gcm',enc,nonce);
  c.setAAD(Buffer.from('gracz-newsletter-new:'+tag));
  const row={
    email_tag:tag,ciphertext:Buffer.concat([c.update(email),c.final()]),
    nonce,auth_tag:c.getAuthTag()
  };
  if(corrupt)row.auth_tag=Buffer.alloc(16);
  if(mismatchedTag)row.email_tag='a'.repeat(64);
  const recoveryTag=createHmac('sha256',withdrawal)
    .update('gracz-withdrawal-v1\0recipient\0'+email).digest('hex');
  const statements=[];
  const database={async queryBounded(sql,params,opts){
    statements.push({sql,params,opts});
    if(queryFails)throw Error('private query error');
    if(sql.includes('AS unverified_withdrawals'))
      return {rows:[{unverified_withdrawals:pending,obligations:obligation}]};
    if(sql.includes('SELECT s.email_tag'))
      return {rows:doi?[row]:[]};
    if(sql.includes('AS withdrawn')){
      assert.deepEqual(params,[recoveryTag,tag]);
      return {rows:[{withdrawn}]};
    }
    throw Error('Unexpected SQL');
  }};
  const review=createCampaignRecipientEvidenceReview({
    database,checkDeliveryAllowed:async()=>providerAllowed,
    newEncryptionKey:enc.toString('base64url'),
    newSubjectKey:subject.toString('base64url'),
    withdrawalRecipientTagKey:withdrawal.toString('base64url')
  });
  return {review,tag,statements};
}
const verdict=state=>({state,advisoryOnly:true,maySend:false});

test('reviews only current DOI with independently matched recovery tags',async()=>{
  const {review,tag,statements}=fixture();
  assert.deepEqual(await review(tag),verdict('evidence_complete_for_review'));
  assert.equal(statements.length,3);
  for(const item of statements){
    assert.match(item.sql,/^\s*SELECT\b/i);
    assert.doesNotMatch(item.sql,/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/i);
    assert.deepEqual(item.opts,{timeoutMs:3000});
  }
  assert.deepEqual(statements[1].params,[tag,CAMPAIGN_CONSENT_VERSION]);
  assert.match(statements[1].sql,/e\.challenge_id=s\.challenge_id/);
  assert.match(statements[1].sql,/e\.consent_version=s\.consent_version/);
  assert.match(statements[1].sql,/NOT EXISTS[\s\S]*newsletter_new\.revocations/);
  assert.match(statements[0].sql,/newsletter_recovery\.withdrawal_no_send_obligations/);
});
test('any unresolved withdrawal or obligation holds everyone, even with DOI',async()=>{
  for(const options of [{pending:true},{obligation:true}]){
    const {review,tag,statements}=fixture(options);
    assert.deepEqual(await review(tag),verdict('global_evidence_hold'));
    assert.equal(statements.length,1);
  }
});
test('no DOI is not eligible; verified recovery opt-out excludes exact recipient',async()=>{
  const a=fixture({doi:false});
  assert.deepEqual(await a.review(a.tag),verdict('no_current_doi'));
  assert.equal(a.statements.length,2);
  const b=fixture({withdrawn:true});
  assert.deepEqual(await b.review(b.tag),verdict('verified_withdrawal'));
});
test('cryptographic inconsistency or unavailable PostgreSQL fails closed',async()=>{
  for(const o of [{corrupt:true},{mismatchedTag:true},{queryFails:true}]){
    const {review,tag}=fixture(o);
    await assert.rejects(review(tag));
  }
});
test('invalid identifier and missing configuration are rejected',async()=>{
  const a=fixture();
  await assert.rejects(a.review('not-an-email-tag'));
  assert.throws(()=>createCampaignRecipientEvidenceReview({database:{}}),
    /read_only_database_required/);
});

test('the reviewed recipient must match the authenticated encrypted DOI identity',async()=>{
  const a=fixture();
  assert.deepEqual(await a.review(a.tag,'recipient@example.test'),{
    state:'evidence_complete_for_review',
    advisoryOnly:true,maySend:false,recipientMatched:true
  });
  const b=fixture();
  assert.deepEqual(await b.review(b.tag,'another@example.test'),{
    state:'recipient_mismatch',advisoryOnly:true,maySend:false
  });
  assert.equal(b.statements.length,2,
    'mismatch must not be treated as a delivery-ready checked recipient');
});
test('invalid send-to address cannot bypass recipient binding',async()=>{
  const a=fixture();
  for(const value of ['RECIPIENT@example.test',' recipient@example.test ',
    'evil@example.test\nBcc:someone@example.test',null]){
    await assert.rejects(a.review(a.tag,value));
  }
});
test('a verified opt-out denies even when an authenticated address matches',async()=>{
  const a=fixture({withdrawn:true});
  assert.deepEqual(await a.review(a.tag,'recipient@example.test'),{
    state:'verified_withdrawal',advisoryOnly:true,maySend:false
  });
});

test('private sender resolves only a verified current recipient without changing advisory output',async()=>{
  const a=fixture();
  assert.equal(typeof a.review.resolveRecipient,'function');
  assert.equal(await a.review.resolveRecipient(a.tag),'recipient@example.test');
  for(const options of [{doi:false},{withdrawn:true},{pending:true}]){
    const b=fixture(options);
    assert.equal(await b.review.resolveRecipient(b.tag),null);
  }
});

test('provider suppression or unknown preflight denies despite current DOI',async()=>{
  for(const providerAllowed of [false,undefined,null]){
    const a=fixture({providerAllowed:providerAllowed===undefined?null:providerAllowed});
    assert.equal((await a.review(a.tag)).state,'provider_evidence_hold');
    assert.equal(await a.review.resolveRecipient(a.tag),null);
  }
});

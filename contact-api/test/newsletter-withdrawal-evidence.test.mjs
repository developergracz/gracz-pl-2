import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createWithdrawalEvidenceVerifier} from '../persistence/recovery/withdrawal-evidence.mjs';

const mailboxKeys=generateKeyPairSync('ed25519');
const mappingKeys=generateKeyPairSync('ed25519');
const mailbox={issuer:'https://synthetic-mailbox.example.test',audience:'withdrawal-mailbox-proof',
  keyId:'synthetic-mailbox',publicKeyPem:mailboxKeys.publicKey.export({format:'pem',type:'spki'})};
const mapping={issuer:'https://synthetic-mapping.example.test',audience:'withdrawal-legacy-mapping',
  keyId:'synthetic-mapping',publicKeyPem:mappingKeys.publicKey.export({format:'pem',type:'spki'})};
const now=1_800_000_000_000;
const verifier=createWithdrawalEvidenceVerifier({mailbox,mapping,now:()=>now});
const deny={code:'WITHDRAWAL_EVIDENCE_REJECTED'};
function signed(config,keys,purpose,claims,headerOverrides={}) {
  const header={typ:'JWT',alg:'EdDSA',kid:config.keyId,...headerOverrides};
  const body={iss:config.issuer,aud:config.audience,purpose,request_id:claims.request_id,
    jti:randomUUID(),iat:Math.floor(now/1000)-10,exp:Math.floor(now/1000)+180,...claims};
  const data=Buffer.from(JSON.stringify(header)).toString('base64url')+'.'+
    Buffer.from(JSON.stringify(body)).toString('base64url');
  return data+'.'+sign(null,Buffer.from(data),keys.privateKey).toString('base64url');
}
function pair(requestId=randomUUID(),override={}) {
  const mailboxTag='a'.repeat(64),subjectRef=randomUUID();
  const mailboxClaims={request_id:requestId,mailbox_tag:mailboxTag,
    method:'independent_mailbox_challenge',challenge_ref:randomUUID(),...(override.mailbox||{})};
  const mappingClaims={request_id:requestId,mailbox_tag:mailboxTag,
    method:'one_to_one_legacy_mapping',subject_ref:subjectRef,mapping_ref:randomUUID(),
    collision_checked:true,suppressions_checked:true,...(override.mapping||{})};
  return {requestId,subjectRef,mailboxToken:signed(mailbox,mailboxKeys,'MAILBOX',mailboxClaims),
    mappingToken:signed(mapping,mappingKeys,'MAPPING',mappingClaims)};
}
test('#282 accepts only two independent authority-signed matching proofs, returns opaque references',()=>{
  const {requestId,subjectRef,mailboxToken,mappingToken}=pair();
  const result=verifier.verifyPair({expectedRequestId:requestId,mailboxToken,mappingToken});
  assert.deepEqual(Object.keys(result),
    ['requestId','legacySubjectRef','mailboxProofRef','mappingProofRef','mailboxProofTag','mappingProofTag']);
  assert.equal(result.requestId,requestId);
  assert.equal(result.legacySubjectRef,subjectRef);
  assert.match(result.mailboxProofTag,/^[0-9a-f]{64}$/);
  assert.match(result.mappingProofTag,/^[0-9a-f]{64}$/);
  assert.notEqual(result.mailboxProofTag,result.mappingProofTag);
  assert.deepEqual(verifier.verifyPair({expectedRequestId:requestId,mailboxToken,mappingToken}),result);
});
test('#282 rejects mismatched recipients, unproven legacy mapping, forged fields and expired proofs',()=>{
  const orig=pair();
  for (const bad of [
    {mailbox:{mailbox_tag:'b'.repeat(64)}},
    {mapping:{mailbox_tag:'b'.repeat(64)}},
    {mapping:{subject_ref:'not-a-uuid'}},
    {mapping:{collision_checked:false}},
    {mapping:{suppressions_checked:false}},
    {mapping:{method:'operator_attests'}},
    {mailbox:{method:'email_delivered'}},
    {mailbox:{challenge_ref:'not-a-uuid'}},
    {mailbox:{iat:Math.floor(now/1000)-2000}},
    {mapping:{exp:Math.floor(now/1000)-1}},
    {mailbox:{jti:'replay'}},
    {mapping:{nbf:Math.floor(now/1000)+120}}
  ]) {
    const candidate=pair(orig.requestId,bad);
    assert.throws(()=>verifier.verifyPair({expectedRequestId:candidate.requestId,
      mailboxToken:candidate.mailboxToken,mappingToken:candidate.mappingToken}),deny);
  }
  assert.throws(()=>verifier.verifyPair({
    expectedRequestId:orig.requestId,
    mailboxToken:orig.mailboxToken,mappingToken:pair().mappingToken
  }),deny);
});
test('#282 rejects missing signatures, cross-purpose substitution and attacker-provided verification flags',()=>{
  const {requestId,mailboxToken,mappingToken}=pair();
  assert.throws(()=>verifier.verifyPair({
    expectedRequestId:requestId,mailboxToken:mappingToken,mappingToken
  }),deny);
  const parts=mailboxToken.split('.');
  assert.throws(()=>verifier.verifyPair({expectedRequestId:requestId,
    mailboxToken:parts[0]+'.'+parts[1]+'.'+('A'.repeat(86)),mappingToken}),deny);
  assert.throws(()=>verifier.verifyPair({expectedRequestId:requestId,
    mailboxToken:mailboxToken+'.noise',mappingToken}),deny);
  assert.throws(()=>verifier.verifyPair({expectedRequestId:'not-a-uuid',mailboxToken,mappingToken}),deny);
  const fakeMail=signed(mailbox,mappingKeys,'MAILBOX',{
    request_id:requestId,mailbox_tag:'a'.repeat(64),
    method:'independent_mailbox_challenge',challenge_ref:randomUUID()
  });
  assert.throws(()=>verifier.verifyPair({expectedRequestId:requestId,
    mailboxToken:fakeMail,mappingToken}),deny);
});
test('#282 requires independent pinned Ed25519 authorities at construction',()=>{
  assert.throws(()=>createWithdrawalEvidenceVerifier({
    mailbox,mapping:{...mapping,issuer:mailbox.issuer},now:()=>now
  }),TypeError);
  assert.throws(()=>createWithdrawalEvidenceVerifier({
    mailbox,mapping:{...mapping,publicKeyPem:mailbox.publicKeyPem},now:()=>now
  }),TypeError);
  assert.throws(()=>createWithdrawalEvidenceVerifier({
    mailbox,mapping:{...mapping,audience:mailbox.audience},now:()=>now
  }),TypeError);
  assert.throws(()=>createWithdrawalEvidenceVerifier({mailbox,mapping:{...mapping,keyId:''}}),TypeError);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createOperatorAssertionVerifier} from '../persistence/recovery/operator-assertion.mjs';
import {createOwnerApprovedOperatorEnrollment} from '../persistence/recovery/operator-enrollment.mjs';
import {createVerifiedRecipientMapping,legacySubjectRefFromHash} from '../persistence/recovery/verified-recipient-mapping.mjs';

const epoch=1_800_000_000_000,sec=Math.floor(epoch/1000);
const op=generateKeyPairSync('ed25519'),owner=generateKeyPairSync('ed25519');
const issuer='https://synthetic-id.example.test',approvalIssuer='https://synthetic-owner.example.test';
const opVerifier=createOperatorAssertionVerifier({issuer,audience:'withdrawal-operator',
  keyId:'synthetic-op',publicKeyPem:op.publicKey.export({format:'pem',type:'spki'}),
  subjectTagKey:Buffer.alloc(32,0x11),now:()=>epoch});
function token(config,claims){
  const header=Buffer.from(JSON.stringify({alg:'EdDSA',kid:config.kid,typ:'JWT'})).toString('base64url');
  const body=Buffer.from(JSON.stringify({iss:config.issuer,aud:config.aud,
    jti:randomUUID(),iat:sec-10,exp:sec+200,...claims})).toString('base64url');
  const input=header+'.'+body;
  return input+'.'+sign(null,Buffer.from(input),config.privateKey).toString('base64url');
}
const opConfig={kid:'synthetic-op',issuer,aud:'withdrawal-operator',privateKey:op.privateKey};
const ownerConfig={kid:'synthetic-owner',issuer:approvalIssuer,aud:'operator-pair',privateKey:owner.privateKey};
const operator=sub=>token(opConfig,{sub,auth_time:sec-20,amr:['mfa','webauthn']});
function approval(primaryTag,backupTag){
  return token(ownerConfig,{purpose:'OPERATOR_PAIR_ENROLLMENT',
    primary_tag:primaryTag,backup_tag:backupTag});
}
function enrollment(){
  let count=0,approved=0;const rows=[];
  const client={async query(sql,params){
    if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[{}]};
    if(sql.includes('count(*)')&&sql.includes('operator_accounts'))return {rows:[{n:count}]};
    if(sql.includes('count(*)')&&sql.includes('operator_enrollments'))return {rows:[{n:approved}]};
    if(sql.includes('INSERT INTO newsletter_recovery.operator_accounts')){
      count=2;rows.push(params);return {rowCount:2};
    }
    if(sql.includes('INSERT INTO newsletter_recovery.operator_enrollments')){
      approved=1;return {rowCount:1};
    }
    throw new Error('Unexpected synthetic query');
  }};
  const database={transaction:work=>work(client)};
  const svc=createOwnerApprovedOperatorEnrollment({
    database,assertionVerifier:opVerifier,
    issuer:approvalIssuer,audience:'operator-pair',keyId:'synthetic-owner',
    approvalPublicKeyPem:owner.publicKey.export({format:'pem',type:'spki'}),
    now:()=>epoch
  });
  return {svc,rows};
}
test('#282 owner-signed approval provisions exactly two distinct fresh MFA operator identities',async()=>{
  const env=enrollment();
  const first=operator(randomUUID()),second=operator(randomUUID());
  const a=approval(opVerifier.verify(first).subjectTag,opVerifier.verify(second).subjectTag);
  const result=await env.svc.enrollPair({primaryAssertion:first,backupAssertion:second,ownerApproval:a});
  assert.equal(result.accounts,2);
  assert.equal(env.rows.length,1);
  assert.notEqual(env.rows[0][1],env.rows[0][3]);
  await assert.rejects(env.svc.enrollPair({primaryAssertion:first,backupAssertion:second,ownerApproval:a}),
    {code:'WITHDRAWAL_ENROLLMENT_DENIED'});
});
test('#282 owner approval cannot swap roles, share account or bypass strong operator authentication',async()=>{
  const env=enrollment(),first=operator(randomUUID()),second=operator(randomUUID());
  const a=approval(opVerifier.verify(first).subjectTag,opVerifier.verify(second).subjectTag);
  await assert.rejects(env.svc.enrollPair({primaryAssertion:second,backupAssertion:first,ownerApproval:a}),
    {code:'WITHDRAWAL_ENROLLMENT_DENIED'});
  await assert.rejects(env.svc.enrollPair({primaryAssertion:first,backupAssertion:first,ownerApproval:a}),
    {code:'WITHDRAWAL_ENROLLMENT_DENIED'});
  await assert.rejects(env.svc.enrollPair({primaryAssertion:token(opConfig,{
    sub:randomUUID(),auth_time:sec-20,amr:['pwd']}),backupAssertion:second,ownerApproval:a}),
    {code:'OPERATOR_ACCESS_DENIED'});
  assert.equal(env.rows.length,0);
});

function mappingFixture({f03=true,contacts=1,events=1}={}){
  const legacy=Buffer.from('synthetic-escrow-secret-'.repeat(3));
  const mailboxKey=Buffer.alloc(32,0x31),encryptionKey=Buffer.alloc(32,0x42);
  const address='synthetic@example.test',requestId=randomUUID(),actor=randomUUID();
  const derived=createHash('sha256').update('newsletter-consent-subject:','utf8').update(legacy).digest();
  const hash=createHmac('sha256',derived).update(address).digest('hex');
  const ref=legacySubjectRefFromHash(hash);
  const mailboxTag=createHmac('sha256',mailboxKey).update(
    'gracz-newsletter-recovery-mailbox-v1\0'+address).digest('hex');
  let row=null;
  const client={async query(sql,args=[]){
    if(sql.includes('FROM newsletter_recovery.withdrawal_verified_evidence')&&!sql.includes('verified_recipient_links'))
      return {rowCount:1,rows:[{legacy_subject_ref:ref,mailbox_tag:mailboxTag}]};
    if(sql.includes("to_regclass('public.newsletter_opt_in_requests')"))
      return {rowCount:1,rows:[{f03,contacts,events}]};
    if(sql.includes('INSERT INTO newsletter_recovery.verified_recipient_links')){
      if(row)return {rowCount:0,rows:[]};
      row={request_id:args[0],legacy_subject_ref:args[1],mailbox_tag:args[2],
        legacy_email_hash:args[3],ciphertext:args[4],nonce:args[5],auth_tag:args[6]};
      return {rowCount:1,rows:[{request_id:args[0]}]};
    }
    if(sql.includes('FROM newsletter_recovery.verified_recipient_links l')){
      return row?{rowCount:1,rows:[row]}:{rowCount:0,rows:[]};
    }
    throw new Error('Unexpected synthetic DB query');
  }};
  const database={query:(s,a)=>client.query(s,a),transaction:work=>work(client)};
  const create=opts=>createVerifiedRecipientMapping({
    database,legacyConsentSecret:legacy,escrowConsentSecret:legacy,
    mailboxTagKey:mailboxKey,encryptionKey,...opts
  });
  return {client,create,hash,ref,mailboxTag,requestId,actor,address,
    get row(){return row;}};
}
test('#282 real legacy-HMAC association encrypts address and binds existing historic records',async()=>{
  const f=mappingFixture(),mapper=f.create();
  const result=await mapper.linkVerified({client:f.client,requestId:f.requestId,
    legacySubjectRef:f.ref,mailboxTag:f.mailboxTag,email:f.address,operatorRef:f.actor});
  assert.deepEqual(result,{requestId:f.requestId,linked:true});
  assert.equal(f.row.legacy_email_hash,f.hash);
  assert.equal(f.row.ciphertext.includes(Buffer.from(f.address)),false);
  assert.deepEqual(await mapper.resolveVerifiedRecipient({
    requestId:f.requestId,legacySubjectRef:f.ref
  }),{email:f.address,mailboxTag:f.mailboxTag,legacySubjectRef:f.ref});
  await assert.rejects(mapper.linkVerified({client:f.client,requestId:f.requestId,
    legacySubjectRef:f.ref,mailboxTag:f.mailboxTag,email:f.address,operatorRef:f.actor}),
    {code:'WITHDRAWAL_IDENTITY_UNRESOLVED'});
  f.row.auth_tag[0]^=0x01;
  await assert.rejects(mapper.resolveVerifiedRecipient({
    requestId:f.requestId,legacySubjectRef:f.ref
  }),{code:'WITHDRAWAL_IDENTITY_UNRESOLVED'});
});
test('#282 missing F03, missing historic events, wrong escrow or mismatched mailbox cannot create aliases',async()=>{
  for(const bad of [{f03:false},{contacts:0},{events:0}]) {
    const f=mappingFixture(bad),mapper=f.create();
    await assert.rejects(mapper.linkVerified({client:f.client,requestId:f.requestId,
      legacySubjectRef:f.ref,mailboxTag:f.mailboxTag,email:f.address,operatorRef:f.actor}),
      {code:'WITHDRAWAL_IDENTITY_UNRESOLVED'});
    assert.equal(f.row,null);
  }
  const f=mappingFixture();
  assert.throws(()=>f.create({escrowConsentSecret:Buffer.alloc(64,0x41)}),
    {code:'WITHDRAWAL_IDENTITY_UNRESOLVED'});
  const mapper=f.create();
  await assert.rejects(mapper.linkVerified({client:f.client,requestId:f.requestId,
    legacySubjectRef:f.ref,mailboxTag:'a'.repeat(64),email:f.address,operatorRef:f.actor}),
    {code:'WITHDRAWAL_IDENTITY_UNRESOLVED'});
  assert.equal(f.row,null);
});

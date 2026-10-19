import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createWithdrawalInbox} from '../persistence/recovery/withdrawal-inbox.mjs';
import {createOperatorAssertionVerifier} from '../persistence/recovery/operator-assertion.mjs';
import {createWithdrawalEvidenceVerifier} from '../persistence/recovery/withdrawal-evidence.mjs';
import {createWithdrawalOperatorService} from '../persistence/recovery/operator-service.mjs';

const url=process.env.DATABASE_URL;
const sql=await readFile(new URL('../persistence/recovery/001_withdrawal_queue.sql',import.meta.url),'utf8');
const operatorKeys=generateKeyPairSync('ed25519');
const mailboxKeys=generateKeyPairSync('ed25519');
const mappingKeys=generateKeyPairSync('ed25519');
const clock=1_800_000_000_000,sec=Math.floor(clock/1000);
const mailConfig={issuer:'https://mailproof.example.test',audience:'mbx-proof',keyId:'mbx-test',
  publicKeyPem:mailboxKeys.publicKey.export({format:'pem',type:'spki'})};
const mapConfig={issuer:'https://mapping.example.test',audience:'map-proof',keyId:'map-test',
  publicKeyPem:mappingKeys.publicKey.export({format:'pem',type:'spki'})};
const operatorConfig={issuer:'https://operator.example.test',audience:'ops',
  keyId:'ops-test',publicKeyPem:operatorKeys.publicKey.export({format:'pem',type:'spki'})};
const operatorVerifier=createOperatorAssertionVerifier({
  ...operatorConfig,subjectTagKey:Buffer.alloc(32,0x12),now:()=>clock
});
const evidenceVerifier=createWithdrawalEvidenceVerifier({
  mailbox:mailConfig,mapping:mapConfig,now:()=>clock
});
function jwt(config,pair,claims){
  const head=Buffer.from(JSON.stringify({typ:'JWT',alg:'EdDSA',kid:config.keyId})).toString('base64url');
  const data=head+'.'+Buffer.from(JSON.stringify({
    iss:config.issuer,aud:config.audience,
    jti:randomUUID(),iat:sec-20,exp:sec+180,...claims
  })).toString('base64url');
  return data+'.'+sign(null,Buffer.from(data),pair.privateKey).toString('base64url');
}
function proofs(requestId,overrides={}) {
  const tag=overrides.tag||'b'.repeat(64);
  const subjectRef=overrides.subjectRef||randomUUID();
  return {
    mailboxToken:jwt(mailConfig,mailboxKeys,{
      purpose:'MAILBOX',request_id:requestId,mailbox_tag:tag,
      method:overrides.badMailboxMethod||'independent_mailbox_challenge',
      challenge_ref:randomUUID()
    }),
    mappingToken:jwt(mapConfig,mappingKeys,{
      purpose:'MAPPING',request_id:requestId,mailbox_tag:overrides.wrongTag||tag,
      method:'one_to_one_legacy_mapping',subject_ref:subjectRef,
      mapping_ref:randomUUID(),collision_checked:overrides.collisionChecked??true,
      suppressions_checked:overrides.suppressionsChecked??true
    }),
    subjectRef
  };
}
async function fixture(t){
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  t.after(async()=>{await db.query('DROP SCHEMA IF EXISTS newsletter_recovery CASCADE');await db.close();});
  await db.query('DROP SCHEMA IF EXISTS newsletter_recovery CASCADE');
  await db.query(sql);
  const inbox=createWithdrawalInbox(db);
  const ops=createWithdrawalOperatorService({
    database:db,assertionVerifier:operatorVerifier,evidenceVerifier
  });
  const sub=randomUUID(),ref=randomUUID();
  const signer=(jti=randomUUID())=>jwt(operatorConfig,operatorKeys,{
    sub,jti,iat:sec-10,auth_time:sec-30,amr:['pwd','mfa','webauthn']
  });
  await db.query(
    'INSERT INTO newsletter_recovery.operator_accounts(operator_ref,subject_tag,role) VALUES($1,$2,$3)',
    [ref,operatorVerifier.verify(signer()).subjectTag,'primary']
  );
  const request=async tag=>inbox.receive({dedupeTag:tag||'a'.repeat(64),
    source:'routed_email',evidenceRef:randomUUID()});
  return {db,ops,signer,request,ref};
}

test('#282 two independently signed proofs yield durable VERIFIED_PENDING and NO-SEND obligation, never confirmed',{timeout:30000},async t=>{
  const {db,ops,request,signer,ref}=await fixture(t);
  const {requestId}=await request();
  const {mailboxToken,mappingToken,subjectRef}=proofs(requestId);
  const done=await ops.recordVerifiedPending({signedToken:signer(),requestId,mailboxToken,mappingToken});
  assert.deepEqual(done,{requestId,state:'VERIFIED_PENDING',
    providerState:'RECONCILIATION_PENDING',confirmed:false});
  const evidence=(await db.query(
    'SELECT actor_ref,legacy_subject_ref FROM newsletter_recovery.withdrawal_verified_evidence'
  )).rows;
  assert.equal(evidence.length,1);assert.equal(evidence[0].actor_ref,ref);
  assert.equal(evidence[0].legacy_subject_ref,subjectRef);
  const obligations=(await db.query(
    'SELECT obligation_state,legacy_subject_ref FROM newsletter_recovery.withdrawal_no_send_obligations'
  )).rows;
  assert.deepEqual(obligations,[{obligation_state:'RECONCILIATION_PENDING',legacy_subject_ref:subjectRef}]);
  const events=(await db.query(
    'SELECT event_kind FROM newsletter_recovery.withdrawal_events ORDER BY event_id'
  )).rows.map(row=>row.event_kind);
  assert.deepEqual(events,['RECEIVED','VERIFIED_PENDING']);
  const audits=(await db.query(
    'SELECT action_kind FROM newsletter_recovery.operator_actions ORDER BY audit_id'
  )).rows.map(row=>row.action_kind);
  assert.deepEqual(audits,['RECORD_VERIFIED_PENDING']);
  const inspect=await ops.inspectPending({signedToken:signer()});
  assert.equal(inspect[0].state,'VERIFIED_PENDING');
  assert.equal(Object.hasOwn(inspect[0],'legacySubjectRef'),false);
  await assert.rejects(db.query(
    "UPDATE newsletter_recovery.withdrawal_no_send_obligations SET obligation_state='COMPLETE'"
  ),{code:'P0001'});
  await assert.rejects(db.query(
    'DELETE FROM newsletter_recovery.withdrawal_verified_evidence'
  ),{code:'P0001'});
  await assert.rejects(ops.quarantine({signedToken:signer(),requestId,reason:'OTHER'}),
    {code:'WITHDRAWAL_UNKNOWN_STATE'});
});

test('#282 missing, contradictory, colliding or replayed proofs leave request safely PENDING',{timeout:30000},async t=>{
  const {db,ops,request,signer}=await fixture(t);
  const {requestId}=await request();
  for(const variant of [
    {wrongTag:'c'.repeat(64)},
    {collisionChecked:false},
    {suppressionsChecked:false},
    {badMailboxMethod:'email_was_delivered'}
  ]){
    const p=proofs(requestId,variant);
    await assert.rejects(ops.recordVerifiedPending({
      signedToken:signer(),requestId,mailboxToken:p.mailboxToken,mappingToken:p.mappingToken
    }),{code:'WITHDRAWAL_EVIDENCE_REJECTED'});
  }
  const first=proofs(requestId);
  await assert.rejects(ops.recordVerifiedPending({
    signedToken:'untrusted',requestId,...first
  }),{code:'OPERATOR_ACCESS_DENIED'});
  assert.equal((await db.query(
    'SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_verified_evidence'
  )).rows[0].n,0);
  assert.equal((await db.query(
    'SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_no_send_obligations'
  )).rows[0].n,0);
  assert.equal((await db.query(
    'SELECT count(*)::int AS n FROM newsletter_recovery.operator_actions'
  )).rows[0].n,0);
  assert.equal((await db.query(
    'SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_events'
  )).rows[0].n,1);
});

test('#282 proof cannot be reused across requests or replayed to bypass state',{timeout:30000},async t=>{
  const {db,ops,request,signer}=await fixture(t);
  const first=(await request()).requestId;
  const p=proofs(first);
  await ops.recordVerifiedPending({signedToken:signer(),requestId:first,
    mailboxToken:p.mailboxToken,mappingToken:p.mappingToken});
  await assert.rejects(ops.recordVerifiedPending({signedToken:signer(),
    requestId:first,mailboxToken:p.mailboxToken,mappingToken:p.mappingToken
  }),{code:'WITHDRAWAL_VERIFICATION_STATE_CONFLICT'});
  const other=(await request('d'.repeat(64))).requestId;
  await assert.rejects(ops.recordVerifiedPending({
    signedToken:signer(),requestId:other,mailboxToken:p.mailboxToken,mappingToken:p.mappingToken
  }),{code:'WITHDRAWAL_EVIDENCE_REJECTED'});
  assert.equal((await db.query(
    'SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_no_send_obligations'
  )).rows[0].n,1);
  assert.equal((await db.query(
    'SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_verified_evidence'
  )).rows[0].n,1);
});

test('#282 evidence transaction failure rolls back audit, verification event and obligations',{timeout:30000},async t=>{
  const {db,ops,request,signer}=await fixture(t);
  const requestId=(await request()).requestId,p=proofs(requestId);
  await db.query(
    "CREATE FUNCTION newsletter_recovery.test_reject_obligation() RETURNS trigger " +
    "LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic no-send rejection'; END $$; " +
    "CREATE TRIGGER test_reject_obligation BEFORE INSERT ON newsletter_recovery.withdrawal_no_send_obligations " +
    "FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.test_reject_obligation();"
  );
  await assert.rejects(ops.recordVerifiedPending({
    signedToken:signer(),requestId,mailboxToken:p.mailboxToken,mappingToken:p.mappingToken
  }),{code:'P0001'});
  for(const table of ['withdrawal_verified_evidence','withdrawal_no_send_obligations','operator_actions']){
    assert.equal((await db.query(
      'SELECT count(*)::int AS n FROM newsletter_recovery.'+table
    )).rows[0].n,0);
  }
  assert.equal((await db.query(
    'SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_events'
  )).rows[0].n,1);
  await db.query('DROP TRIGGER test_reject_obligation ON newsletter_recovery.withdrawal_no_send_obligations');
  await db.query('DROP FUNCTION newsletter_recovery.test_reject_obligation()');
  const done=await ops.recordVerifiedPending({
    signedToken:signer(),requestId,mailboxToken:p.mailboxToken,mappingToken:p.mappingToken
  });
  assert.equal(done.state,'VERIFIED_PENDING');
});

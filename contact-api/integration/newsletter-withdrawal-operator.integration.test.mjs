import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createWithdrawalInbox} from '../persistence/recovery/withdrawal-inbox.mjs';
import {createOperatorAssertionVerifier} from '../persistence/recovery/operator-assertion.mjs';
import {createWithdrawalOperatorService} from '../persistence/recovery/operator-service.mjs';

const url=process.env.DATABASE_URL;
const schemaSql=await readFile(new URL('../persistence/recovery/001_withdrawal_queue.sql',import.meta.url),'utf8');
const pair=generateKeyPairSync('ed25519');
const issuer='https://isolated-id.example.test',audience='private-operator',keyId='temporary-test-only';
const timeMs=1_800_000_000_000,sec=Math.floor(timeMs/1000);
const verifier=createOperatorAssertionVerifier({
  issuer,audience,keyId,publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}),
  subjectTagKey:Buffer.alloc(32,0x15),now:()=>timeMs
});
function token(sub,jti=randomUUID(),options={}) {
  const claims={iss:issuer,aud:audience,sub,jti,iat:sec-5,auth_time:sec-20,exp:sec+180,
    amr:['pwd','mfa','webauthn'],...options};
  const input=Buffer.from(JSON.stringify({alg:'EdDSA',typ:'JWT',kid:keyId})).toString('base64url')+'.'+
    Buffer.from(JSON.stringify(claims)).toString('base64url');
  return input+'.'+sign(null,Buffer.from(input),pair.privateKey).toString('base64url');
}
async function fixture(t) {
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  t.after(async()=>{
    await db.query('DROP SCHEMA IF EXISTS newsletter_recovery CASCADE');
    await db.close();
  });
  await db.query('DROP SCHEMA IF EXISTS newsletter_recovery CASCADE');
  await db.query(schemaSql);
  const inbox=createWithdrawalInbox(db);
  const ops=createWithdrawalOperatorService({database:db,assertionVerifier:verifier});
  async function enroll(role,sub=randomUUID()) {
    const ref=randomUUID(),tag=verifier.verify(token(sub)).subjectTag;
    await db.query(
      'INSERT INTO newsletter_recovery.operator_accounts(operator_ref,subject_tag,role) VALUES($1,$2,$3)',
      [ref,tag,role]
    );
    return {ref,sub,issue:(options={})=>token(sub,randomUUID(),options)};
  }
  async function request(dedupeTag='a'.repeat(64)) {
    return inbox.receive({dedupeTag,source:'routed_email',evidenceRef:randomUUID()});
  }
  return {db,ops,enroll,request};
}

test('#282 distinct operator identities and signed MFA required; no trusted role in token',{timeout:30000},async t=>{
  const {db,ops,enroll,request}=await fixture(t);
  const primary=await enroll('primary'),backup=await enroll('backup');
  const received=await request();
  const inbox=await ops.inspectPending({signedToken:primary.issue({role:'admin'})});
  assert.equal(inbox.length,1);
  assert.equal(inbox[0].requestId,received.requestId);
  assert.equal(inbox[0].state,'PENDING');
  assert.equal(Object.hasOwn(inbox[0],'evidenceRef'),false);
  const result=await ops.quarantine({signedToken:backup.issue({role:'primary'}),requestId:received.requestId,reason:'UNMAPPED'});
  assert.deepEqual(result,{requestId:received.requestId,state:'QUARANTINED',created:true});
  const audit=(await db.query('SELECT a.action_kind,a.operator_ref FROM newsletter_recovery.operator_actions a ORDER BY a.audit_id')).rows;
  assert.deepEqual(audit.map(x=>x.action_kind),['INSPECT_PENDING','QUARANTINE']);
  assert.deepEqual(audit.map(x=>x.operator_ref),[primary.ref,backup.ref]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_events WHERE event_kind='QUARANTINED'")).rows[0].n,1);
  // A mailbox address, bearer role claim, or unknown signed subject is never operator enrollment.
  await assert.rejects(ops.inspectPending({signedToken:token(randomUUID(),randomUUID(),{role:'primary'})}),{code:'OPERATOR_ACCESS_DENIED'});
  await assert.rejects(ops.inspectPending({signedToken:primary.issue({amr:['pwd']})}),{code:'OPERATOR_ACCESS_DENIED'});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.operator_actions')).rows[0].n,2);
});

test('#282 immediate operator revocation, replay blocking and durable read audit',{timeout:30000},async t=>{
  const {db,ops,enroll,request}=await fixture(t);
  const primary=await enroll('primary'),backup=await enroll('backup');
  await request();
  const first=backup.issue();
  await ops.inspectPending({signedToken:first});
  await assert.rejects(ops.inspectPending({signedToken:first}),{code:'23505'});
  await db.query('UPDATE newsletter_recovery.operator_accounts SET disabled_at=clock_timestamp() WHERE operator_ref=$1',[backup.ref]);
  await assert.rejects(ops.inspectPending({signedToken:backup.issue()}),{code:'OPERATOR_ACCESS_DENIED'});
  assert.equal((await ops.inspectPending({signedToken:primary.issue()})).length,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.operator_actions')).rows[0].n,2);
  await assert.rejects(db.query('UPDATE newsletter_recovery.operator_actions SET action_kind=$1',['QUARANTINE']),{code:'P0001'});
  await assert.rejects(db.query('DELETE FROM newsletter_recovery.operator_actions'),{code:'P0001'});
});

test('#282 concurrent quarantine uses row lock, preserves one event and audited outcomes',{timeout:30000},async t=>{
  const {db,ops,enroll,request}=await fixture(t);
  const primary=await enroll('primary'),backup=await enroll('backup');
  const {requestId}=await request();
  const results=await Promise.all([
    ops.quarantine({signedToken:primary.issue(),requestId,reason:'AMBIGUOUS'}),
    ops.quarantine({signedToken:backup.issue(),requestId,reason:'AMBIGUOUS'})
  ]);
  assert.equal(results.filter(x=>x.created).length,1);
  assert.equal(results.filter(x=>!x.created).length,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_events WHERE event_kind='QUARANTINED'")).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM newsletter_recovery.operator_actions WHERE action_kind='QUARANTINE'")).rows[0].n,2);
  await assert.rejects(ops.quarantine({signedToken:primary.issue(),requestId,reason:'UNMAPPED'}),
    {code:'WITHDRAWAL_QUARANTINE_CONFLICT'});
  await assert.rejects(ops.quarantine({signedToken:primary.issue(),requestId:randomUUID(),reason:'UNMAPPED'}),
    {code:'WITHDRAWAL_REQUEST_NOT_FOUND'});
  const history=(await db.query('SELECT event_kind FROM newsletter_recovery.withdrawal_events WHERE request_id=$1 ORDER BY event_id',[requestId])).rows;
  assert.deepEqual(history.map(x=>x.event_kind),['RECEIVED','QUARANTINED']);
});

test('#282 token replay across actions is rejected; pending read never alters consent',{timeout:30000},async t=>{
  const {db,ops,enroll,request}=await fixture(t),primary=await enroll('primary'),item=await request();
  const signedToken=primary.issue();
  await ops.inspectPending({signedToken});
  await assert.rejects(ops.quarantine({signedToken,requestId:item.requestId,reason:'UNVERIFIED'}),{code:'23505'});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_events')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.operator_actions')).rows[0].n,1);
});

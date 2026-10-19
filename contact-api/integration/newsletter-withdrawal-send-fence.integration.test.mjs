import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createWithdrawalInbox} from '../persistence/recovery/withdrawal-inbox.mjs';
import {createWithdrawalSendFence,WITHDRAWAL_EGRESS_LOCK} from '../persistence/recovery/withdrawal-send-fence.mjs';
import {createSelfServiceWithdrawal} from '../persistence/recovery/self-service-withdrawal.mjs';
import {randomBytes} from 'node:crypto';

const url=process.env.DATABASE_URL;
const schemaSql=await readFile(new URL('../persistence/recovery/001_withdrawal_queue.sql',import.meta.url),'utf8');
const emailFreeTag='e'.repeat(64);

async function fixture(t) {
  // A test may DROP the recovery schema: forbid ANY non-disposable database.
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  t.after(async()=>{
    await db.query('DROP SCHEMA IF EXISTS newsletter_recovery CASCADE');
    await db.close();
  });
  await db.query('DROP SCHEMA IF EXISTS newsletter_recovery CASCADE');
  await db.query(schemaSql);
  return {
    db,inbox:createWithdrawalInbox(db),
    fence:createWithdrawalSendFence(db)
  };
}
async function receive(inbox,tag=emailFreeTag) {
  return inbox.receive({
    dedupeTag:tag,source:'operator_record',evidenceRef:randomUUID()
  });
}

test('#282 zero pending requests permits a bounded synthetic effect under shared lock',{timeout:30000},async t=>{
  const {db,fence}=await fixture(t);
  let called=0;
  const result=await fence.withSendPermit(async()=>{
    called++;
    const lockCheck=await db.transaction(client=>
      client.query(
        'SELECT pg_try_advisory_xact_lock($1::int,$2::int) AS exclusive_available',
        WITHDRAWAL_EGRESS_LOCK
      )
    );
    assert.equal(lockCheck.rows[0].exclusive_available,false);
    return {synthetic:true};
  });
  assert.deepEqual(result,{synthetic:true});
  assert.equal(called,1);
});

test('#282 durable pending intake globally blocks all sends and never calls provider',{timeout:30000},async t=>{
  const {db,inbox,fence}=await fixture(t);
  await receive(inbox);
  let sends=0;
  await assert.rejects(fence.withSendPermit(async()=>{sends++;}),{code:'WITHDRAWAL_SEND_BLOCKED'});
  assert.equal(sends,0);
  // Even quarantine is NOT an effective withdrawal and does not clear the fence.
  const item=(await db.query(
    'SELECT request_id FROM newsletter_recovery.withdrawal_requests LIMIT 1'
  )).rows[0];
  const actorRef=randomUUID();
  await db.query(
    'INSERT INTO newsletter_recovery.operator_accounts(operator_ref,subject_tag,role) VALUES($1,$2,$3)',
    [actorRef,'b'.repeat(64),'primary']
  );
  await db.query(
    "INSERT INTO newsletter_recovery.withdrawal_events(request_id,event_kind,actor_ref,reason_code) "+
    "VALUES ($1,'QUARANTINED',$2,'UNMAPPED')",[item.request_id,actorRef]
  );
  await assert.rejects(fence.withSendPermit(async()=>{sends++;}),{code:'WITHDRAWAL_SEND_BLOCKED'});
  assert.equal(sends,0);
});

test('#282 missing recovery schema blocks egress by error, never silently permits',{timeout:30000},async t=>{
  const {db,fence}=await fixture(t);
  await db.query('DROP SCHEMA newsletter_recovery CASCADE');
  let called=false;
  await assert.rejects(fence.withSendPermit(async()=>{called=true;}));
  assert.equal(called,false);
});

test('#282 intake cannot commit or acknowledge during an admitted synthetic send',{timeout:30000},async t=>{
  const {db,inbox,fence}=await fixture(t);
  let effectStarted,releaseEffect;
  const effectEntered=new Promise(resolve=>{effectStarted=resolve;});
  const effectRelease=new Promise(resolve=>{releaseEffect=resolve;});
  const outgoing=fence.withSendPermit(async()=>{
    effectStarted();
    await effectRelease;
    return 'synthetic-sent';
  });
  try {
    await effectEntered;
    // This separate transaction must not obtain an exclusive lock while the
    // permitted callback is executing, so new intake cannot commit yet.
    const lockCheck=await db.transaction(client=>
      client.query(
        'SELECT pg_try_advisory_xact_lock($1::int,$2::int) AS exclusive_available',
        WITHDRAWAL_EGRESS_LOCK
      )
    );
    assert.equal(lockCheck.rows[0].exclusive_available,false);
    const incoming=receive(inbox);
    // Release the sender and verify both durable outcomes without real mail.
    releaseEffect();
    assert.equal(await outgoing,'synthetic-sent');
    const item=await incoming;
    assert.equal(item.created,true);
    assert.equal(item.state,'PENDING');
    await assert.rejects(fence.withSendPermit(()=>Promise.resolve('never')),
      {code:'WITHDRAWAL_SEND_BLOCKED'});
  }finally {
    releaseEffect?.();
    await outgoing.catch(()=>{});
  }
});

test('#282 failed synthetic send releases admission lock and intake can proceed',{timeout:30000},async t=>{
  const {inbox,fence}=await fixture(t);
  const syntheticError=new Error('synthetic provider failure');
  await assert.rejects(fence.withSendPermit(async()=>{throw syntheticError;}),error=>error===syntheticError);
  assert.equal((await receive(inbox)).created,true);
  await assert.rejects(fence.withSendPermit(async()=>{}),{code:'WITHDRAWAL_SEND_BLOCKED'});
});

test('#282 fence refuses missing callback and transactional client',{timeout:30000},async()=>{
  assert.throws(()=>createWithdrawalSendFence({}),TypeError);
  const fence=createWithdrawalSendFence({
    transaction:()=>{throw new Error('must not be called');}
  });
  await assert.rejects(fence.withSendPermit(null),TypeError);
});


test('#282 public readiness stays false for missing schema and ANY pending withdrawal',{timeout:30000},async t=>{
  const {db,fence,inbox}=await fixture(t);
  assert.equal(await fence.checkAvailable(),true);
  await receive(inbox,'f'.repeat(64));
  assert.equal(await fence.checkAvailable(),false);
  await db.query('DROP SCHEMA newsletter_recovery CASCADE');
  assert.equal(await fence.checkAvailable(),false);
});


function selfService(db,{providerFails=false}={}) {
  const delivered=[];
  const provider={calls:0,off:false,
    async ensureOff(){this.calls++;if(providerFails)throw new Error('synthetic timeout');this.off=true;return {off:true};},
    async verifyOff(){return {off:this.off};}
  };
  const api=createSelfServiceWithdrawal({
    database:db,
    recipientTagKey:Buffer.alloc(32,1),
    challengeKey:Buffer.alloc(32,2),
    encryptionKey:Buffer.alloc(32,3),
    challengeMailer:{async sendChallenge(message){delivered.push(message);}},
    providerOff:provider
  });
  return {api,delivered,provider};
}

test('#283 self-service: new one-time mailbox proof triggers provider OFF and durable NO SEND without operator',{timeout:30000},async t=>{
  const {db,fence}=await fixture(t);
  const {api,delivered,provider}=selfService(db);
  assert.equal(await fence.checkAvailable(),true);
  assert.deepEqual(await api.requestChallenge({email:'synthetic@example.test'}),
    {state:'request_received',confirmed:false});
  assert.deepEqual(await api.requestChallenge({email:'synthetic@example.test'}),
    {state:'request_received',confirmed:false});
  assert.equal(delivered.length,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_requests')).rows[0].n,0);
  const msg=delivered[0];
  assert.equal(msg.token.includes('@'),false);
  await assert.rejects(api.confirmChallenge({
    challengeId:msg.challengeId,token:randomBytes(32).toString('base64url')
  }),{code:'WITHDRAWAL_CHALLENGE_REJECTED'});
  assert.equal(provider.calls,0);
  const done=await api.confirmChallenge({challengeId:msg.challengeId,token:msg.token});
  assert.deepEqual(done,{state:'provider_off_verified',confirmed:false});
  assert.equal(provider.calls,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.self_service_provider_verified')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_requests')).rows[0].n,1);
  const encrypted=(await db.query('SELECT ciphertext FROM newsletter_recovery.self_service_challenges')).rows[0].ciphertext;
  assert.equal(encrypted.includes(Buffer.from('synthetic@example.test')),false);
  assert.equal(await fence.checkAvailable(),false);
  await assert.rejects(api.confirmChallenge({challengeId:msg.challengeId,token:msg.token}),
    {code:'WITHDRAWAL_CHALLENGE_REJECTED'});
  assert.equal(provider.calls,1);
});

test('#283 self-service: ambiguous provider result never confirms, preserves durable hold, rejects replay',{timeout:30000},async t=>{
  const {db,fence}=await fixture(t);
  const {api,delivered,provider}=selfService(db,{providerFails:true});
  await api.requestChallenge({email:'rejected@example.test'});
  assert.equal(delivered.length,1);
  const msg=delivered[0];
  assert.deepEqual(await api.confirmChallenge({challengeId:msg.challengeId,token:msg.token}),
    {state:'request_received',confirmed:false});
  assert.equal(provider.calls,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.self_service_provider_intents')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.self_service_provider_verified')).rows[0].n,0);
  assert.equal(await fence.checkAvailable(),false);
  await assert.rejects(api.confirmChallenge({challengeId:msg.challengeId,token:msg.token}),
    {code:'WITHDRAWAL_CHALLENGE_REJECTED'});
  assert.equal(provider.calls,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createWithdrawalInbox} from '../persistence/recovery/withdrawal-inbox.mjs';
import {createWithdrawalSendFence,WITHDRAWAL_EGRESS_LOCK} from '../persistence/recovery/withdrawal-send-fence.mjs';

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

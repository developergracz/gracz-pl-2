import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createDatabase} from '../persistence/database.mjs';
import {createWithdrawalInbox} from '../persistence/recovery/withdrawal-inbox.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';

const url=process.env.DATABASE_URL;
const schemaSql=await readFile(new URL('../persistence/recovery/001_withdrawal_queue.sql',import.meta.url),'utf8');
const demoTag='a'.repeat(64);
const source='routed_email';

async function fixture(t) {
  // Never permit this destructive test fixture to connect to production.
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});
  t.after(async()=>{
    await db.query('DROP SCHEMA IF EXISTS newsletter_recovery CASCADE');
    await db.close();
  });
  await db.query('DROP SCHEMA IF EXISTS newsletter_recovery CASCADE');
  await db.query(schemaSql);
  return db;
}

test('#282 durable receipt is atomic, append-only and PENDING (no false withdrawal success)',{timeout:30000},async t=>{
  const db=await fixture(t),inbox=createWithdrawalInbox(db),evidenceRef=randomUUID();
  const result=await inbox.receive({dedupeTag:demoTag,source,evidenceRef});
  assert.equal(result.created,true);
  assert.equal(result.state,'PENDING');
  assert.match(result.requestId,/^[0-9a-f-]{36}$/i);
  const requests=(await db.query('SELECT request_id,received_at FROM newsletter_recovery.withdrawal_requests')).rows;
  const events=(await db.query('SELECT event_kind,actor_ref,reason_code FROM newsletter_recovery.withdrawal_events')).rows;
  assert.equal(requests.length,1);
  assert.equal(events.length,1);
  assert.deepEqual(events[0],{event_kind:'RECEIVED',actor_ref:null,reason_code:null});
  assert.ok(requests[0].received_at);
  assert.equal((await db.query("SELECT to_regclass('public.newsletter_recovery_withdrawal_requests') AS name")).rows[0].name,null);
  // A queue receipt never authorizes marketing sends, withdrawal completion, or consent rewriting.
  await assert.rejects(db.query(
    "INSERT INTO newsletter_recovery.withdrawal_events(request_id,event_kind) VALUES ($1,'CONFIRMED')",[result.requestId]
  ),{code:'23514'});
});

test('#282 concurrent duplicate/restart yields one request and one receipt',{timeout:30000},async t=>{
  const db=await fixture(t),inbox=createWithdrawalInbox(db),evidenceRef=randomUUID();
  const args={dedupeTag:demoTag,source,evidenceRef};
  const results=await Promise.all(Array.from({length:12},()=>inbox.receive(args)));
  assert.equal(results.filter(x=>x.created).length,1);
  assert.equal(new Set(results.map(x=>x.requestId)).size,1);
  const restarted=createDatabase({connectionString:url});t.after(()=>restarted.close());
  const again=await createWithdrawalInbox(restarted).receive(args);
  assert.equal(again.created,false);
  assert.equal(again.requestId,results[0].requestId);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_requests')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_events')).rows[0].n,1);
  await assert.rejects(inbox.receive({...args,evidenceRef:randomUUID()}),{code:'WITHDRAWAL_DEDUPE_CONFLICT'});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_events')).rows[0].n,1);
});

test('#282 direct edits and truncate cannot silently change history',{timeout:30000},async t=>{
  const db=await fixture(t),inbox=createWithdrawalInbox(db);
  const {requestId}=await inbox.receive({dedupeTag:demoTag,source,evidenceRef:randomUUID()});
  await assert.rejects(db.query("UPDATE newsletter_recovery.withdrawal_requests SET intake_source='support_request'"),{code:'P0001'});
  await assert.rejects(db.query('DELETE FROM newsletter_recovery.withdrawal_requests'),{code:'P0001'});
  await assert.rejects(db.query('TRUNCATE newsletter_recovery.withdrawal_requests CASCADE'),{code:'P0001'});
  await assert.rejects(db.query("UPDATE newsletter_recovery.withdrawal_events SET event_kind='QUARANTINED'"),{code:'P0001'});
  await assert.rejects(db.query('DELETE FROM newsletter_recovery.withdrawal_events'),{code:'P0001'});
  await assert.rejects(db.query('TRUNCATE newsletter_recovery.withdrawal_events'),{code:'P0001'});
  const actorRef=randomUUID();
  await db.query(
    "INSERT INTO newsletter_recovery.withdrawal_events(request_id,event_kind,actor_ref,reason_code) " +
    "VALUES ($1,'QUARANTINED',$2,'UNMAPPED')",[requestId,actorRef]
  );
  assert.equal((await db.query("SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_events WHERE event_kind='QUARANTINED'")).rows[0].n,1);
  await assert.rejects(db.query(
    "INSERT INTO newsletter_recovery.withdrawal_events(request_id,event_kind,actor_ref) VALUES ($1,'QUARANTINED',$2)",[requestId,actorRef]
  ),{code:'23514'});
});

test('#282 failed receipt audit rolls back intake and retry is safe',{timeout:30000},async t=>{
  const db=await fixture(t),inbox=createWithdrawalInbox(db),evidenceRef=randomUUID();
  await db.query(
    "CREATE FUNCTION newsletter_recovery.test_block_receipt() RETURNS trigger " +
    "LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$; " +
    "CREATE TRIGGER test_block_receipt BEFORE INSERT ON newsletter_recovery.withdrawal_events " +
    "FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.test_block_receipt();"
  );
  await assert.rejects(inbox.receive({dedupeTag:demoTag,source,evidenceRef}),{code:'P0001'});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM newsletter_recovery.withdrawal_requests')).rows[0].n,0);
  await db.query('DROP TRIGGER test_block_receipt ON newsletter_recovery.withdrawal_events');
  await db.query('DROP FUNCTION newsletter_recovery.test_block_receipt()');
  assert.equal((await inbox.receive({dedupeTag:demoTag,source,evidenceRef})).state,'PENDING');
});

test('#282 untrusted values are rejected before opening a transaction',async()=>{
  const inbox=createWithdrawalInbox({transaction:()=>{throw new Error('should not reach database');}});
  await assert.rejects(inbox.receive({dedupeTag:'plain@example.test',source,evidenceRef:randomUUID()}),TypeError);
  await assert.rejects(inbox.receive({dedupeTag:demoTag,source:'public_user',evidenceRef:randomUUID()}),TypeError);
  await assert.rejects(inbox.receive({dedupeTag:demoTag,source,evidenceRef:'mail@example.test'}),TypeError);
});

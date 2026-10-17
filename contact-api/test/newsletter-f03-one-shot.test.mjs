import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PINNED_HISTORY, assertPinnedHistory,
  assertNoCompetingClients, performF03Once,
} from '../operations/newsletter-f03-one-shot.mjs';

const baseline = () => ({
  contacts:2,events:32,confirmed:1,
  latest:new Date(PINNED_HISTORY.latest),
});
function fakeDatabase({clients=0,snapshot=baseline(),sealOk=true}={}) {
  const calls = [];
  return {
    calls,
    async query(sql) {
      calls.push(sql);
      if (sql.includes('pg_catalog.pg_stat_activity'))
        return {rows:[{clients}]};
      if (sql.includes('SELECT response_body FROM public.idempotency_keys'))
        return {rows:[{response_body:{
          imported:sealOk,
          cutoverBefore:PINNED_HISTORY.cutoff,
        }}]};
      return {rows:[snapshot]};
    },
  };
}
const dep = traces => ({
  validate:()=>{traces.push('validate');},
  migrate:async()=>{traces.push('migrate');return {status:'applied'};},
  importHistory:async (_db, opts)=>{
    traces.push('import');
    assert.equal(opts.writersStopped,true);
    assert.equal(opts.cutoverBefore.toISOString(),PINNED_HISTORY.cutoff);
    return 1;
  },
});

test('reject modified legacy history; new events require independent review',()=>{
  assert.doesNotThrow(()=>assertPinnedHistory(baseline()));
  for (const changes of [
    {events:33}, {contacts:3}, {confirmed:2},
    {latest:new Date('2026-10-15T19:29:31.475Z')},
  ]) assert.throws(
    ()=>assertPinnedHistory({...baseline(),...changes}),
    {code:'NEWSLETTER_MIGRATION_HISTORY_DRIFT'},
  );
});

test('reject any competing connected client and missing session evidence',()=>{
  assert.doesNotThrow(()=>assertNoCompetingClients({clients:0}));
  for(const value of [1,-1,0.5,null,undefined,'0'])
    assert.throws(()=>assertNoCompetingClients({clients:value}),
      {code:'NEWSLETTER_MIGRATION_WRITER_SESSIONS_PRESENT'});
});

test('run offline install then history before writer; preserve pinned history',async()=>{
  const db=fakeDatabase(),calls=[];
  const result=await performF03Once(db,{},dep(calls));
  assert.deepEqual(calls,['validate','migrate','validate','import']);
  assert.equal(result.result,'F03_SCHEMA_AND_HISTORY_READY_WRITER_STILL_DISABLED');
  assert.equal(result.importedLegacyPending,1);
  assert.equal(db.calls.length,6);
});

test('never write if a competing client or history drift is found',async()=>{
  for(const cfg of [{clients:1},{snapshot:{...baseline(),events:33}}]){
    const calls=[];
    await assert.rejects(performF03Once(fakeDatabase(cfg),{},dep(calls)),
      {code:cfg.clients?'NEWSLETTER_MIGRATION_WRITER_SESSIONS_PRESENT':'NEWSLETTER_MIGRATION_HISTORY_DRIFT'});
    assert.deepEqual(calls,['validate']);
  }
});

test('reject missing import seal, not a release GO',async()=>{
  const calls=[];
  await assert.rejects(performF03Once(fakeDatabase({sealOk:false}),{},dep(calls)),
    {code:'NEWSLETTER_MIGRATION_IMPORT_SEAL_MISMATCH'});
  assert.deepEqual(calls,['validate','migrate','validate','import']);
});

test('no database operation before evidence validation',async()=>{
  let calls=0;
  const db={query(){calls++;throw new Error('unexpected');}};
  await assert.rejects(performF03Once(db,{},{
    validate:()=>{throw Object.assign(new Error('HOLD'),{code:'NEWSLETTER_MIGRATION_EVIDENCE_INCOMPLETE'});},
  }),{code:'NEWSLETTER_MIGRATION_EVIDENCE_INCOMPLETE'});
  assert.equal(calls,0);
});

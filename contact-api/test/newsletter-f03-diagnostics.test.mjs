import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseF03ReadOnly} from '../operations/newsletter-f03-readonly-diagnostics.mjs';

test('F03 diagnostic only reads metadata and logs aggregate booleans',async()=>{
  const statements=[],logs=[];
  const database={async queryBounded(sql,params,{timeoutMs}){
    statements.push(sql);
    assert.deepEqual(params,[]);
    assert.equal(timeoutMs,3000);
    assert.ok(/^\s*SELECT\b/i.test(sql),'read-only probe must never issue DDL or DML');
    if(statements.length===1)return {rows:[{
      expected_db:true,opt_in:false,f03_ledger:false,contacts:true,events:true,idempotency:true,baseline:true
    }]};
    return {rows:[{contacts:2,events:32,confirmed:1,latest:new Date('2026-10-15T19:29:31.474Z')}]};
  }};
  const logger={info:(message,value)=>logs.push([message,value]),error:()=>assert.fail('unexpected failure')};
  await diagnoseF03ReadOnly(database,logger);
  assert.equal(statements.length,2);
  assert.deepEqual(logs[0],['NEWSLETTER_F03_DIAGNOSTIC_TABLES',{
    expected_db:true,opt_in:false,f03_ledger:false,contacts:true,events:true,idempotency:true,baseline:true
  }]);
  assert.deepEqual(logs[1],['NEWSLETTER_F03_DIAGNOSTIC_PINNED_SNAPSHOT',{
    matchesPinnedHistory:true,newerThanPinned:false
  }]);
});

test('F03 diagnostic errors are redacted',async()=>{
  const logs=[];
  await diagnoseF03ReadOnly({async queryBounded(){throw new Error('postgres://private:user:secret@host/db');}},{
    info:()=>assert.fail('unexpected information'),
    error:(message,value)=>logs.push([message,value])
  });
  assert.deepEqual(logs,[['NEWSLETTER_F03_DIAGNOSTIC_ERROR',{code:'READONLY_PROBE_FAILED'}]]);
});

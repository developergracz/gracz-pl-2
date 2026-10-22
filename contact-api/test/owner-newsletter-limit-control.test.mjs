import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewsletterLimitControl} from '../admin-r1/newsletter-limit-control.mjs';
test('owner lookup and reset affect only status e-mail rate bucket',()=>{
  let now=1000;const buckets=new Map([
    ['status:mail@example.com',{startedAt:1000,count:5}],
    ['optin:mail@example.com',{startedAt:1000,count:5}]
  ]);
  const manager=createNewsletterLimitControl({getBucket:e=>buckets.get('status:'+e),
    clearBucket:e=>buckets.delete('status:'+e),now:()=>now,logger:{info(){}}});
  assert.equal(manager.inspect(' MAIL@EXAMPLE.COM ').blocked,true);
  assert.equal(manager.inspect('mail@example.com').used,5);
  assert.equal(manager.unlock('mail@example.com').changed,true);
  assert.equal(manager.inspect('mail@example.com').blocked,false);
  assert.equal(buckets.has('optin:mail@example.com'),true);
  assert.equal(manager.history().events.length,1);
  assert.equal(manager.history().events[0].recipient,'ma***@example.com');
  assert.equal(manager.unlock('mail@example.com').changed,false);
});
test('expired limit is not reset and invalid address is rejected',()=>{
  let ts=1000;let cleared=0;
  const m=createNewsletterLimitControl({getBucket:()=>({startedAt:1000,count:4}),
    clearBucket:()=>{cleared++;return true;},now:()=>ts});
  assert.equal(m.inspect('x@example.com').blocked,true);
  ts+=3600000;
  assert.equal(m.inspect('x@example.com').blocked,false);
  assert.equal(m.unlock('x@example.com').changed,false);
  assert.equal(cleared,0);
  for(const invalid of ['','x','a@@b.com','x@','a b@example.com']){
    assert.throws(()=>m.inspect(invalid),TypeError);
    assert.throws(()=>m.unlock(invalid),TypeError);
  }
});

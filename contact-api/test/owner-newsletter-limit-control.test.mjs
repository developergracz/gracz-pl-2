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

test('live block registry shows dates, expiry and manual unlock',()=>{
  let time=10_000;
  const buckets=new Map([['status:a@example.com',{startedAt:9000,count:4}],
    ['status:b@example.com',{startedAt:9500,count:5}],
    ['optin:a@example.com',{startedAt:9000,count:4}]]);
  const control=createNewsletterLimitControl({getBucket:email=>buckets.get('status:'+email),
    clearBucket:email=>buckets.delete('status:'+email),now:()=>time,logger:{info(){}}});
  control.observe('a@example.com');time+=100;
  control.observe('b@example.com');
  const snapshot=control.listActive();
  assert.equal(snapshot.total,2);
  assert.deepEqual(snapshot.entries.map(x=>x.email),['b@example.com','a@example.com']);
  assert.equal(snapshot.entries[0].blockedAt,new Date(time).toISOString());
  assert.equal(snapshot.entries[0].expiresAt,new Date(9500+3600000).toISOString());
  assert.equal(snapshot.entries[0].startedAt,new Date(9500).toISOString());
  assert.equal(snapshot.entries[1].used,4);
  assert.equal(control.unlock('b@example.com').changed,true);
  assert.equal(control.listActive().total,1);
  assert.equal(buckets.has('optin:a@example.com'),true);
  time=9000+3600000;
  assert.equal(control.listActive().total,0);
  assert.equal(control.inspect('a@example.com').blocked,false);
});

test('registry never lists sub-quota or opt-in buckets',()=>{
  let time=1000;
  const buckets=new Map([['status:user@example.com',{startedAt:1000,count:3}],
    ['optin:other@example.com',{startedAt:1000,count:10}]]);
  const m=createNewsletterLimitControl({getBucket:e=>buckets.get('status:'+e),
    clearBucket:e=>buckets.delete('status:'+e),now:()=>time,logger:{info(){}}});
  m.observe('user@example.com');
  assert.equal(m.listActive().total,0);
  buckets.get('status:user@example.com').count=4;
  time=1111;m.observe('user@example.com');
  assert.equal(m.listActive().entries[0].blockedAt,new Date(1111).toISOString());
  buckets.get('status:user@example.com').count=8;
  time=1222;m.observe('user@example.com');
  assert.equal(m.listActive().entries[0].blockedAt,new Date(1111).toISOString());
  assert.equal(m.listActive().total,1);
});

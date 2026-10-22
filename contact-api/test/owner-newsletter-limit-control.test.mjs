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

test('live blocked list records first request, block, denial, and expiry',()=>{
  let now=Date.parse('2026-10-22T20:00:00Z');
  const map=new Map();
  const owner=createNewsletterLimitControl({getBucket:e=>map.get(e),
    clearBucket:e=>map.delete(e),now:()=>now,logger:{info(){}}});
  const start=now;
  for(let n=1;n<=3;n++){
    map.set('blocked@example.com',{startedAt:start,count:n});owner.observe('blocked@example.com');
  }
  assert.equal(owner.listBlocked().total,0);
  now+=180000;
  map.set('blocked@example.com',{startedAt:start,count:4});
  owner.observe('blocked@example.com');
  const blockedAt=new Date(now).toISOString();
  assert.equal(owner.listBlocked().total,1);
  now+=1000;
  map.set('blocked@example.com',{startedAt:start,count:5});
  owner.observe('blocked@example.com');
  const entry=owner.listBlocked().entries[0];
  assert.equal(entry.email,'blocked@example.com');
  assert.equal(entry.used,5);
  assert.equal(entry.deniedAttempts,1);
  assert.equal(entry.blockedAt,blockedAt);
  assert.equal(entry.firstRequestAt,new Date(start).toISOString());
  assert.equal(entry.expiresAt,new Date(start+3600000).toISOString());
  assert.equal(entry.lastAttemptAt,new Date(now).toISOString());
  assert.equal(owner.unlock('blocked@example.com').changed,true);
  assert.equal(owner.listBlocked().total,0);
});
test('blocked address list expires automatically and cannot override unrelated limits',()=>{
  let time=1000;
  const map=new Map([['status:one@example.com',{startedAt:1000,count:5}],
    ['status:two@example.com',{startedAt:1000,count:5}],
    ['optin:one@example.com',{startedAt:1000,count:9}],
    ['ip:network',{startedAt:1000,count:16}]]);
  const owner=createNewsletterLimitControl({
    getBucket:e=>map.get('status:'+e),clearBucket:e=>map.delete('status:'+e),
    now:()=>time,logger:{info(){}}
  });
  owner.observe('one@example.com');owner.observe('two@example.com');
  assert.equal(owner.listBlocked().total,2);
  owner.unlock('one@example.com');
  assert.equal(owner.listBlocked().total,1);
  assert.equal(map.has('optin:one@example.com'),true);
  assert.equal(map.has('ip:network'),true);
  time+=3600000;
  assert.equal(owner.listBlocked().total,0);
});

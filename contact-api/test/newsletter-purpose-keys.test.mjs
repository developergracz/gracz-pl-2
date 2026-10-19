import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const purposes=['confirm','unsubscribe','status','identity'];
const fixture=()=>purposes.map(purpose=>({id:purpose+'-2026',purpose,state:'active',key:randomBytes(32)}));
const load=async keys=>(await import('../security/newsletter-purpose-keys.mjs')).createNewsletterPurposeKeys({keys,now:()=>1000000});

test('280 purpose/audience/key-id separation, canonical envelope and random nonce',async()=>{
  const ring=await load(fixture());
  for(const purpose of purposes.slice(0,3)) {
    const token=ring.seal(purpose,{subject:'synthetic-opaque-subject'},60000);
    assert.equal(ring.open(purpose,token).subject,'synthetic-opaque-subject');
    assert.notEqual(token,ring.seal(purpose,{subject:'synthetic-opaque-subject'},60000));
    for(const other of purposes.filter(p=>p!==purpose)) assert.throws(()=>ring.open(other,token));
    const parts=token.split('.');parts[1]='other-key';assert.throws(()=>ring.open(purpose,parts.join('.')));
    assert.throws(()=>ring.open(purpose,token+'='));
    assert.throws(()=>ring.seal(purpose,{},0));
    assert.throws(()=>ring.seal(purpose,{},Number.MAX_SAFE_INTEGER));
  }
  assert.throws(()=>ring.seal('identity',{},1000));
  const subject=ring.identity('Case@EXAMPLE.TEST');
  assert.equal(subject,ring.identity('Case@example.test'));
  assert.notEqual(subject,ring.identity('case@example.test'));
  assert.match(subject,/^ni2:identity-2026:[a-f0-9]{64}$/);
  assert.throws(()=>ring.identity('not an email'));
});

test('280 rejects all legacy and forged envelopes, expiry and different key material',async()=>{
  const keys=fixture(),ring=await load(keys);
  for(const prefix of ['n1','ns1','n2','unknown'])assert.throws(()=>ring.open('confirm',prefix+'.forged'));
  const token=ring.seal('confirm',{},1000);
  const {createNewsletterPurposeKeys}=await import('../security/newsletter-purpose-keys.mjs');
  assert.throws(()=>createNewsletterPurposeKeys({keys,now:()=>1001000}).open('confirm',token));
  assert.throws(()=>createNewsletterPurposeKeys({keys,now:()=>999999}).open('confirm',token));
  assert.throws(()=>(ring.open('confirm',token.replace(/.$/,c=>c==='A'?'B':'A'))));
  assert.throws(()=>(createNewsletterPurposeKeys({keys:fixture(),now:()=>1000000}).open('confirm',token)));
});

test('280 missing/unknown/retired/compromised keys and key reuse fail closed',async()=>{
  const {createNewsletterPurposeKeys}=await import('../security/newsletter-purpose-keys.mjs');
  assert.throws(()=>createNewsletterPurposeKeys({keys:[]}));
  for(const state of ['retired','compromised']){
    const keys=fixture(),token=(await load(keys)).seal('confirm',{},1000);
    keys[0].state=state;
    keys.push({id:'confirm-next',purpose:'confirm',state:'active',key:randomBytes(32)});
    const ring=await load(keys);
    assert.throws(()=>ring.open('confirm',token));
    assert.match(ring.seal('confirm',{},1000),/^n2\.confirm-next\./);
  }
  for(const mutate of [k=>k.pop(),k=>k[0].key=Buffer.alloc(2),k=>k[0].key=k[1].key,k=>k[0].id=k[1].id,k=>k[0].state='maybe',k=>k.push({...k[0],id:'duplicate',key:randomBytes(32)})]){
    const keys=fixture();mutate(keys);assert.throws(()=>createNewsletterPurposeKeys({keys}));
  }
  const keys=fixture(),ring=await load(keys),token=ring.seal('confirm',{},1000);
  keys[0].key.fill(0);keys[0].state='compromised';
  assert.deepEqual(ring.open('confirm',token),{}); // immutable snapshot; replacement ring for rotation
});

for(const state of ['retired','compromised'])for(const purpose of purposes){
  test(`R2 ${state} ${purpose}: no issue/verify/identity without active replacement; no legacy grace`,async()=>{
    const keys=fixture(),previous=await load(keys),entry=keys.find(k=>k.purpose===purpose);
    const old=purpose==='identity'?previous.identity('Case@example.test'):previous.seal(purpose,{},1000);
    entry.state=state;
    await assert.rejects(load(keys),{code:'NEWSLETTER_PROOF_INVALID'});
    const nextId=purpose+'-next';
    keys.push({id:nextId,purpose,state:'active',key:randomBytes(32)});
    const current=await load(keys);
    if(purpose==='identity'){
      assert.notEqual(current.identity('Case@example.test'),old);
      assert.ok(current.identity('Case@example.test').startsWith('ni2:'+nextId+':'));
    }else{
      assert.throws(()=>current.open(purpose,old),{code:'NEWSLETTER_PROOF_INVALID'});
      const fresh=current.seal(purpose,{},1000);
      assert.ok(fresh.startsWith('n2.'+nextId+'.'));
      assert.deepEqual(current.open(purpose,fresh),{});
      for(const legacy of ['n1.test','ns1.test'])assert.throws(()=>current.open(purpose,legacy));
    }
  });
}

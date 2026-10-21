import test from 'node:test';
import assert from 'node:assert/strict';
import {createResendProviderOff} from '../persistence/recovery/resend-provider-off.mjs';

const email='synthetic@example.test';
function harness({contactExists=true,unsubscribed=false,suppressionOrigin=null,
  patchFails=false}={}) {
  let contactState=contactExists?{id:'synthetic-contact',unsubscribed}:null;
  const methods=[];
  const request=async(url,{method,body}={})=>{
    const path=new URL(url).pathname;
    methods.push(method+' '+path);
    const json=(status,obj)=>({status,json:async()=>obj});
    if(path==='/suppressions/'+encodeURIComponent(email) && method==='GET')
      return suppressionOrigin
        ?json(200,{object:'suppression',id:'synthetic-block',email,origin:suppressionOrigin})
        :json(404,{});
    if(path==='/contacts/'+encodeURIComponent(email) && method==='GET')
      return contactState
        ?json(200,{object:'contact',email,...contactState})
        :json(404,{});
    if(path==='/contacts/synthetic-contact' && method==='PATCH'){
      assert.deepEqual(JSON.parse(body),{unsubscribed:true});
      if(patchFails)throw new Error('private provider failure');
      contactState.unsubscribed=true;
      return json(200,{object:'contact',email,...contactState});
    }
    // No POST /suppressions and no DELETE /suppressions, for any opt-out.
    assert.fail('Unexpected provider request '+method+' '+path);
  };
  return {request,methods,get unsubscribed(){return contactState?.unsubscribed;}};
}

test('verified opt-out disables existing marketing contact but never suppresses its email',async()=>{
  const h=harness();
  const svc=createResendProviderOff({apiKey:'synthetic',request:h.request});
  assert.deepEqual(await svc.verifyOff(email),{off:false});
  assert.deepEqual(await svc.ensureOff(email),{off:true});
  assert.equal(h.unsubscribed,true);
  assert.deepEqual(await svc.verifyOff(email),{off:true});
  const count=h.methods.filter(m=>m.startsWith('PATCH ')).length;
  assert.equal(count,1,'only the existing contact unsubscribe flag is changed');
  assert.deepEqual(await svc.ensureOff(email),{off:true});
  assert.equal(h.methods.filter(m=>m.startsWith('PATCH ')).length,count);
  assert.ok(h.methods.every(m=>m.startsWith('GET ')||m.startsWith('PATCH /contacts/')));
  assert.equal(await svc.deliveryAllowed(email),true,
    'fresh double opt-in confirmation must still be deliverable after voluntary withdrawal');
});

test('recipient absent from Resend contacts is already off without any provider mutation',async()=>{
  const h=harness({contactExists:false});
  const svc=createResendProviderOff({apiKey:'synthetic',request:h.request});
  assert.deepEqual(await svc.ensureOff(email),{off:true});
  assert.deepEqual(await svc.verifyOff(email),{off:true});
  assert.equal(await svc.deliveryAllowed(email),true);
  assert.ok(h.methods.every(m=>m.startsWith('GET ')));
});

test('existing bounce, complaint and operator suppressions remain blocked and untouched',async()=>{
  for(const suppressionOrigin of ['bounce','complaint','manual']){
    const h=harness({suppressionOrigin});
    const svc=createResendProviderOff({apiKey:'synthetic',request:h.request});
    assert.deepEqual(await svc.ensureOff(email),{off:true});
    assert.equal(await svc.deliveryAllowed(email),false);
    assert.ok(h.methods.every(m=>m.startsWith('GET ')||m.startsWith('PATCH /contacts/')));
  }
});

test('unknown provider results never claim opt-out verification',async()=>{
  const h=harness({patchFails:true});
  const svc=createResendProviderOff({apiKey:'synthetic',request:h.request});
  await assert.rejects(svc.ensureOff(email),{code:'WITHDRAWAL_PROVIDER_UNCERTAIN'});
  assert.deepEqual(await svc.verifyOff(email),{off:false});
  assert.equal(h.methods.some(m=>m.startsWith('POST /suppressions')),false);
  const broken=createResendProviderOff({apiKey:'synthetic',request:async()=>({
    status:403,json:async()=>({})
  })});
  await assert.rejects(broken.ensureOff(email),{code:'WITHDRAWAL_PROVIDER_UNCERTAIN'});
  await assert.rejects(broken.deliveryAllowed(email),{code:'WITHDRAWAL_PROVIDER_UNCERTAIN'});
  assert.throws(()=>createResendProviderOff({apiKey:'fake',baseUrl:'https://attacker.invalid'}),TypeError);
  await assert.rejects(svc.ensureOff('Not-Normalized@Example.test'),TypeError);
});

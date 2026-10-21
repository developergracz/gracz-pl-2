import test from 'node:test';
import assert from 'node:assert/strict';
import {createResendProviderOff} from '../persistence/recovery/resend-provider-off.mjs';

const email='synthetic@example.test';
function harness(){
  let suppressed=false,unsubscribed=false;
  const methods=[];
  const request=async(url,{method,body}={})=>{
    const path=new URL(url).pathname;
    methods.push(method+' '+path);
    const json=(status,obj)=>({status,json:async()=>obj});
    if(path==='/suppressions/'+encodeURIComponent(email) && method==='GET')
      return suppressed ? json(200,{object:'suppression',id:'synthetic-1',email,origin:'manual'})
                        : json(404,{});
    if(path==='/suppressions' && method==='POST'){
      assert.deepEqual(JSON.parse(body),{email});
      suppressed=true;return json(201,{object:'suppression',id:'synthetic-1',email,origin:'manual'});
    }
    if(path==='/contacts/'+encodeURIComponent(email) && method==='GET')
      return json(200,{object:'contact',id:'synthetic-contact',email,unsubscribed});
    if(path==='/contacts/synthetic-contact' && method==='PATCH'){
      assert.deepEqual(JSON.parse(body),{unsubscribed:true});
      unsubscribed=true;return json(200,{object:'contact',id:'synthetic-contact'});
    }
    throw new Error('Unexpected fake provider request');
  };
  return {request,methods,get suppressed(){return suppressed;},get unsubscribed(){return unsubscribed;}};
}
test('#282 Resend: suppress first, unsubscribe contact, read back both; second run has no writes',async()=>{
  const h=harness();
  const service=createResendProviderOff({apiKey:'fake-test-key',request:h.request});
  assert.deepEqual(await service.verifyOff(email),{off:false});
  assert.deepEqual(await service.ensureOff(email),{off:true});
  assert.equal(h.suppressed,true);
  assert.equal(h.unsubscribed,true);
  const count=h.methods.filter(m=>m.startsWith('POST ')||m.startsWith('PATCH ')).length;
  assert.equal(count,2);
  assert.deepEqual(await service.ensureOff(email),{off:true});
  assert.equal(h.methods.filter(m=>m.startsWith('POST ')||m.startsWith('PATCH ')).length,count);
  assert.ok(h.methods.indexOf('POST /suppressions')<h.methods.indexOf('PATCH /contacts/synthetic-contact'));
});

test('#282 Resend: unknown mutation/readback never reports OFF, never leaks provider response',async()=>{
  let gets=0,posts=0;
  const service=createResendProviderOff({
    apiKey:'fake-test-key',request:async(url,{method})=>{
      const path=new URL(url).pathname;
      if(path.startsWith('/contacts/'))return {status:404,json:async()=>({})};
      if(method==='GET'&&path.startsWith('/suppressions/')){
        gets++;return {status:404,json:async()=>({})};
      }
      if(method==='POST'&&path==='/suppressions'){posts++;throw Error('provider private response');}
      throw Error('unplanned test request');
    }
  });
  await assert.rejects(service.ensureOff(email),{code:'WITHDRAWAL_PROVIDER_UNCERTAIN'});
  assert.equal(posts,1);
  assert.ok(gets>0);
  assert.deepEqual(await service.verifyOff(email),{off:false});
  assert.throws(()=>createResendProviderOff({apiKey:'fake',baseUrl:'https://attacker.invalid'}),TypeError);
  await assert.rejects(service.ensureOff('Not-Normalized@Example.test'),TypeError);
});

test('delivery preflight is read-only and denies active suppression or unknown state',async()=>{
  const h=harness();
  const service=createResendProviderOff({apiKey:'synthetic',request:h.request});
  assert.equal(await service.deliveryAllowed(email),true);
  assert.ok(h.methods.every(m=>m.startsWith('GET ')));
  await service.ensureOff(email);
  h.methods.length=0;
  assert.equal(await service.deliveryAllowed(email),false);
  assert.ok(h.methods.every(m=>m.startsWith('GET ')));
  const broken=createResendProviderOff({apiKey:'synthetic',request:async()=>({status:403,json:async()=>({})})});
  await assert.rejects(broken.deliveryAllowed(email));
});

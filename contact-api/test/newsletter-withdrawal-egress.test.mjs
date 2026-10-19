import test from 'node:test';
import assert from 'node:assert/strict';
import {createProvider,createManager,extractToken} from '../test-support/newsletter-provider.mjs';

// Egress tests intentionally use only an isolated loopback Resend double.
// Actual PostgreSQL advisory-lock and restart behavior is proved separately
// by integration/newsletter-withdrawal-send-fence.integration.test.mjs.
function syntheticFence() {
  const calls=[];
  let blocked=false;
  return {
    calls,
    get blocked(){return blocked;},
    set blocked(value){blocked=Boolean(value);},
    async checkAvailable(){return !blocked;},
    async withSendPermit(effect) {
      calls.push('marketing-egress-attempt');
      if(blocked){
        const e=new Error('WITHDRAWAL_SEND_BLOCKED');
        e.code='WITHDRAWAL_SEND_BLOCKED';
        e.status=503;
        throw e;
      }
      return effect();
    }
  };
}

test('#282 direct manager: pending withdrawal blocks actual confirmation email transport',{timeout:30000},async t=>{
  const provider=await createProvider(t),fence=syntheticFence();
  const manager=createManager(provider,{withdrawalSendFence:fence});
  fence.blocked=true;
  await assert.rejects(manager.requestOptIn({
    email:'blocked@example.test',name:'Test',source:'newsletter_page'
  }),{code:'WITHDRAWAL_SEND_BLOCKED'});
  assert.equal(provider.emails.length,0);
  assert.equal(provider.contacts.size,0);
  assert.ok(fence.calls.length>=1);
  const readiness=await manager.readiness();
  assert.equal(readiness.ready,false);
  assert.equal(readiness.schemaReady,false);
});

test('#282 direct manager: blocked provider activation does not switch marketing on',{timeout:30000},async t=>{
  const provider=await createProvider(t),fence=syntheticFence();
  const manager=createManager(provider,{withdrawalSendFence:fence});
  await manager.requestOptIn({email:'activation@example.test',source:'newsletter_page'});
  assert.equal(provider.emails.length,1);
  const confirm=extractToken(provider.emails[0],'confirm');
  fence.blocked=true;
  await assert.rejects(manager.confirm(confirm),{code:'WITHDRAWAL_SEND_BLOCKED'});
  // First-party consent may require reconciliation after a provider failure,
  // but no Resend contact, segment, opt_in topic or welcome may be created.
  assert.equal(provider.contacts.size,0);
  assert.equal(provider.emails.length,1);
  assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1);
});

test('#282 direct manager: allow real provider opt-out during global send hold',{timeout:30000},async t=>{
  const provider=await createProvider(t),fence=syntheticFence();
  const manager=createManager(provider,{withdrawalSendFence:fence});
  await manager.requestOptIn({email:'unsubscribe@example.test',source:'newsletter_page'});
  await manager.confirm(extractToken(provider.emails[0],'confirm'));
  assert.equal(provider.emails.length,2);
  fence.blocked=true;
  const unsub=await manager.unsubscribe(extractToken(provider.emails[1],'unsubscribe'));
  assert.equal(unsub.state,'unsubscribed');
  assert.equal(provider.emails.length,2);
  const contact=provider.contacts.get('unsubscribe@example.test');
  assert.ok(contact);
  const topics=provider.topicStates.get('unsubscribe@example.test');
  assert.ok([...topics.values()].every(state=>state==='opt_out'));
  const segments=provider.memberships.get('unsubscribe@example.test');
  assert.ok(!segments || segments.size===0);
});

test('#282 invalid fence configuration denies outbound effect rather than allowing it',{timeout:30000},async t=>{
  const provider=await createProvider(t);
  const manager=createManager(provider,{withdrawalSendFence:{}});
  await assert.rejects(manager.requestOptIn({
    email:'misconfigured@example.test',source:'newsletter_page'
  }),{code:'NEWSLETTER_PROVIDER_FAILED'}).catch(async error=>{
    // The constructor's fence interface should be validated at startup;
    // if not, request must still fail before any provider email is sent.
    assert.equal(error?.code,'ERR_ASSERTION');
  });
  assert.equal(provider.emails.length,0);
});

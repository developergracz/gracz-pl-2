import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignDispatchCoordinator} from '../campaigns/dispatch-coordinator.mjs';

const delivery={
  campaignId:'123e4567-e89b-42d3-a456-426614174000',
  dispatchId:'123e4567-e89b-42d3-a456-426614174001',
  emailTag:'a'.repeat(64),to:'recipient@example.test',
  subject:'Witamy gracz.pl',text:'Aktualności na gracz.pl.',
  unsubscribeUrl:'https://gracz.pl/newsletter/#nl-withdrawal-panel'
};
const matching={
  state:'evidence_complete_for_review',
  recipientMatched:true,advisoryOnly:true,maySend:false
};
function make(overrides={}){
  const steps=[];
  let sends=0;
  const funcs={
    enabled:true,
    claim:async()=>{steps.push('durable_claim');return true;},
    withSendPermit:async effect=>{steps.push('global_shared_lock');return effect();},
    reviewRecipient:async(tag,to)=>{
      assert.equal(tag,delivery.emailTag);
      assert.equal(to,delivery.to);
      steps.push('fresh_DOI_and_verified_withdrawal');
      return matching;
    },
    transport:{sendOnce:async()=>{
      sends++;
      steps.push('resend');
      return {state:'accepted',retryAllowed:false};
    }},
    recordOutcome:async({accepted})=>{steps.push(accepted?'accepted':'uncertain');}
  };
  const coordinator=createCampaignDispatchCoordinator({...funcs,...overrides});
  return {coordinator,steps,get sends(){return sends;}};
}

test('OFF and missing either safety gate cannot send',async()=>{
  for(const overrides of [
    {enabled:false},{withSendPermit:undefined},
    {reviewRecipient:undefined},{claim:undefined},{recordOutcome:undefined}
  ]){
    const x=make(overrides);
    await assert.rejects(x.coordinator.dispatch(delivery),{
      code:'campaign_dispatch_disabled'
    });
    assert.equal(x.sends,0);
  }
});
test('invalid address, unbound recipient and IDs are rejected before claim',async()=>{
  const x=make();
  for(const change of [
    {to:'OTHER@example.test'},{to:'a@example.test\nBcc:e@e.test'},
    {to:''},{emailTag:'bad'},{campaignId:'bad'},{dispatchId:'bad'}
  ])await assert.rejects(x.coordinator.dispatch({...delivery,...change}),{
    code:'invalid_dispatch'
  });
  assert.deepEqual(x.steps,[]);
});
test('failed durable claim never enters permit or provider',async()=>{
  const x=make({claim:async()=>false});
  assert.equal((await x.coordinator.dispatch(delivery)).state,'suppressed');
  assert.equal(x.sends,0);
  assert.deepEqual(x.steps,[]);
});
test('claim, global lock, fresh linked recipient proof, provider then permanent result',async()=>{
  const x=make();
  assert.equal((await x.coordinator.dispatch(delivery)).state,'accepted');
  assert.deepEqual(x.steps,[
    'durable_claim','global_shared_lock','fresh_DOI_and_verified_withdrawal',
    'resend','accepted'
  ]);
  assert.equal(x.sends,1);
});
test('stale or mismatched DOI cannot reach provider, consumes claim without retry',async()=>{
  for(const result of [
    {state:'no_current_doi',recipientMatched:false,advisoryOnly:true,maySend:false},
    {state:'verified_withdrawal',recipientMatched:false,advisoryOnly:true,maySend:false},
    {state:'global_evidence_hold',advisoryOnly:true,maySend:false},
    {state:'evidence_complete_for_review',advisoryOnly:true,maySend:false},
    {state:'evidence_complete_for_review',recipientMatched:true,maySend:true},
    undefined
  ]){
    const x=make({reviewRecipient:async()=>result});
    assert.deepEqual(await x.coordinator.dispatch(delivery),
      {state:'suppressed',retryAllowed:false});
    assert.equal(x.sends,0);
    assert.deepEqual(x.steps,['durable_claim','global_shared_lock','uncertain']);
  }
});
test('global withdrawal fence denial never calls the provider',async()=>{
  const x=make({withSendPermit:async()=>{
    throw Object.assign(Error('withdrawal detected'),{code:'WITHDRAWAL_SEND_BLOCKED'});
  }});
  assert.deepEqual(await x.coordinator.dispatch(delivery),
    {state:'uncertain',retryAllowed:false});
  assert.equal(x.sends,0);
  assert.deepEqual(x.steps,['durable_claim','uncertain']);
});
test('transport uncertainty never retries and records an uncertain attempt',async()=>{
  const x=make({transport:{sendOnce:async()=>{
    throw Error('timeout');
  }}});
  assert.deepEqual(await x.coordinator.dispatch(delivery),
    {state:'uncertain',retryAllowed:false});
  assert.deepEqual(x.steps,[
    'durable_claim','global_shared_lock','fresh_DOI_and_verified_withdrawal','uncertain'
  ]);
});
test('record failure propagates; never repeats the external provider call',async()=>{
  const x=make({recordOutcome:async()=>{throw Error('lost commit ACK');}});
  await assert.rejects(x.coordinator.dispatch(delivery),/lost commit ACK/);
  assert.equal(x.sends,1);
});

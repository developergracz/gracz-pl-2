import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignDispatchCoordinator} from '../campaigns/dispatch-coordinator.mjs';
const delivery={campaignId:'c',dispatchId:'d'};
test('disabled coordinator cannot send',async()=>{
  const d=createCampaignDispatchCoordinator();
  await assert.rejects(d.dispatch(delivery),{code:'campaign_dispatch_disabled'});
});
test('rejected claim never sends',async()=>{
  let sends=0;
  const d=createCampaignDispatchCoordinator({
    enabled:true,claim:async()=>false,recordOutcome:async()=>{},
    transport:{sendOnce:async()=>{sends++;}}
  });
  assert.equal((await d.dispatch(delivery)).state,'suppressed');
  assert.equal(sends,0);
});
test('durable claim precedes provider effect, outcome follows',async()=>{
  const steps=[];
  const d=createCampaignDispatchCoordinator({
    enabled:true,claim:async()=>{steps.push('claim committed');return true;},
    transport:{sendOnce:async()=>{steps.push('provider');return {state:'accepted',retryAllowed:false};}},
    recordOutcome:async({accepted})=>{steps.push(accepted?'accepted':'uncertain');}
  });
  assert.equal((await d.dispatch(delivery)).state,'accepted');
  assert.deepEqual(steps,['claim committed','provider','accepted']);
});
test('transport failure is uncertain and never retried',async()=>{
  let calls=0;
  const d=createCampaignDispatchCoordinator({
    enabled:true,claim:async()=>true,
    transport:{sendOnce:async()=>{calls++;throw Error('timeout');}},
    recordOutcome:async({accepted})=>assert.equal(accepted,false)
  });
  assert.equal((await d.dispatch(delivery)).state,'uncertain');
  assert.equal(calls,1);
});

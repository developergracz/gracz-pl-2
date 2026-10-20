import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignPgDispatchStore} from '../campaigns/pg-dispatch-store.mjs';
const campaignId='a1f4bd10-e8fd-44cd-9c4e-215b7dde05e2';
const dispatchId='e1824e34-36c8-4f51-9d0c-bb0a43ba6267';
test('claim and result are each committed through one durable transaction',async()=>{
  const queries=[];
  const database={transaction:async fn=>{
    queries.push('transaction');
    return fn({query:async(sql,args)=>{
      queries.push({sql,args});
      return {rows:[{claimed:true,recorded:true}]};
    }});
  }};
  const store=createCampaignPgDispatchStore({database});
  assert.equal(await store.claim({campaignId,dispatchId}),true);
  assert.equal(await store.recordOutcome({campaignId,dispatchId,accepted:false}),true);
  assert.equal(queries.filter(x=>x==='transaction').length,2);
  assert.match(queries[1].sql,/newsletter_campaigns\.claim_delivery/);
  assert.match(queries[3].sql,/newsletter_campaigns\.record_delivery_result/);
  assert.equal(queries[3].args[3],false);
});
test('refuses missing durable transaction and malformed IDs',async()=>{
  assert.throws(()=>createCampaignPgDispatchStore({database:{query:async()=>{}}}),{message:'durable_postgres_required'});
  const store=createCampaignPgDispatchStore({database:{transaction:async()=>{throw Error('unreachable');}}});
  await assert.rejects(store.claim({campaignId:'wrong',dispatchId}),{message:'invalid_campaign_id'});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignOwnerTestSender} from '../campaigns/owner-test-send.mjs';

const id='123e4567-e89b-42d3-a456-426614174000';
const DRAFT={subject:'Witamy w newsletterze gracz.pl',
  body:'To jest tylko wiadomość testowa newslettera gracz.pl.',
  audience:'confirmed_active_new_only'};
const base={
  apiKey:Array(16).fill('x').join(''),from:'gracz.pl <newsletter@gracz.pl>',
  operatorAddress:'owner@example.com',checkWithdrawalReady:async()=>true,
  enabled:true
};
function fixture({duplicate=false,dbUpdateError=false,attempts='0',deliveryFailure=false}={}){
  const calls=[],outbound=[];
  const database={
    queryBounded:async(sql,params,options)=>{
      calls.push({sql,params,options});return {rows:[{ready:true}]};
    },
    transaction:async fn=>fn({query:async(sql,params=[])=>{
      calls.push({sql,params});
      if(sql.includes('pg_advisory_xact_lock'))return {rowCount:1,rows:[]};
      if(sql.includes('SELECT subject,body,audience'))return {rows:[DRAFT]};
      if(sql.includes('SELECT 1 FROM newsletter_campaigns.test_attempts'))
        return {rows:duplicate?[{one:1}]:[]};
      if(sql.includes('SELECT count(*)::text AS attempts'))
        return {rows:[{attempts}]};
      if(sql.includes('INSERT INTO newsletter_campaigns.test_attempts'))
        return {rowCount:1};
      if(sql.includes('UPDATE newsletter_campaigns.test_attempts')){
        if(dbUpdateError)throw Error('lost-ack');
        return {rowCount:1};
      }
      throw Error('Unexpected SQL');
    }})
  };
  const sender=createCampaignOwnerTestSender({
    ...base,database,
    fetchFn:async(url,options)=>{
      outbound.push({url,options});
      if(deliveryFailure)throw Error('timeout');
      return {status:201,json:async()=>({id:'resend_test_message_123'})};
    }
  });
  return {sender,calls,outbound};
}

test('default OFF and withdrawn flow never contact Resend or write tests',async()=>{
  const db={queryBounded:async()=>{throw Error('not reachable');},
    transaction:async()=>{throw Error('transaction must not run');}};
  const disabled=createCampaignOwnerTestSender({...base,enabled:false,database:db,
    fetchFn:async()=>{throw Error('forbidden');}});
  assert.equal(await disabled.available(),false);
  await assert.rejects(disabled.sendTest(id),{code:'campaign_test_send_unavailable'});
  const withdrawn=createCampaignOwnerTestSender({...base,database:db,
    checkWithdrawalReady:async()=>false,
    fetchFn:async()=>{throw Error('forbidden');}});
  assert.equal(await withdrawn.available(),false);
  await assert.rejects(withdrawn.sendTest(id),{code:'campaign_test_send_unavailable'});
});
test('valid OWNER draft sends at most one operator test after durable reservation',async()=>{
  const {sender,calls,outbound}=fixture();
  assert.equal(await sender.available(),true);
  const result=await sender.sendTest(id);
  assert.deepEqual(result,{state:'accepted',retryAllowed:false});
  assert.equal(outbound.length,1);
  assert.equal(outbound[0].url,'https://api.resend.com/emails');
  const sent=JSON.parse(outbound[0].options.body);
  assert.deepEqual(sent.to,['owner@example.com']);
  assert.match(sent.subject,/^\[TEST\] /);
  assert.match(sent.text,/Wypisz się/);
  assert.ok(calls.findIndex(c=>c.sql.includes('INSERT INTO newsletter_campaigns.test_attempts'))<
    calls.findIndex(c=>c.sql.includes('UPDATE newsletter_campaigns.test_attempts')));
  assert.ok(calls.every(c=>!c.sql.includes('newsletter_new.subscribers')));
});
test('duplicate and daily budget never send again',async()=>{
  for(const options of [{duplicate:true},{attempts:'5'}]){
    const {sender,outbound}=fixture(options);
    const response=await sender.sendTest(id);
    assert.equal(response.state,options.duplicate?'already_attempted':'limit_reached');
    assert.equal(response.retryAllowed,false);
    assert.equal(outbound.length,0);
  }
});
test('timeout and outcome recording error stay uncertain without retry',async()=>{
  for(const options of [{deliveryFailure:true},{dbUpdateError:true}]){
    const {sender,outbound}=fixture(options);
    assert.deepEqual(await sender.sendTest(id),{state:'uncertain',retryAllowed:false});
    assert.equal(outbound.length,1);
  }
});
test('untrusted campaign IDs and absent readiness are denied',async()=>{
  const {sender,outbound}=fixture();
  await assert.rejects(sender.sendTest('invalid-id'),{code:'invalid_campaign_id'});
  assert.equal(outbound.length,0);
  const unavailable=createCampaignOwnerTestSender({...base,
    database:{queryBounded:async()=>({rows:[{ready:false}]}),
      transaction:async()=>{throw Error('should not start');}},
    fetchFn:async()=>{throw Error('should not send');}});
  assert.equal(await unavailable.available(),false);
  await assert.rejects(unavailable.sendTest(id),{code:'campaign_test_send_unavailable'});
});

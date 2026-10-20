import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignResendTransport} from '../campaigns/resend-transport.mjs';

const delivery={
  dispatchId:'a2d4d2d4-0000-4000-a000-000000000001',
  to:'test@example.com',subject:'Nowości gracz.pl',
  text:'Poznaj nowe gry w naszym serwisie.',
  unsubscribeUrl:'https://gracz.pl/newsletter/#unsubscribe=proof'
};

test('adapter refuses to send by default',async()=>{
  let called=0;
  const adapter=createCampaignResendTransport({fetchFn:async()=>{called++;}});
  await assert.rejects(adapter.sendOnce(delivery),{code:'campaign_sending_disabled'});
  assert.equal(called,0);
});
test('explicitly enabled adapter produces idempotent, unsubscribable message',async()=>{
  let outbound;
  const adapter=createCampaignResendTransport({
    enabled:true,apiKey:'test-key-123456789',from:'gracz.pl <news@example.com>',
    fetchFn:async(url,options)=>{
      outbound={url,options};
      return {status:200,json:async()=>({id:'resend_message_123'})};
    },
  });
  const result=await adapter.sendOnce(delivery);
  assert.equal(result.state,'accepted');
  assert.equal(result.retryAllowed,false);
  assert.equal(outbound.url,'https://api.resend.com/emails');
  assert.equal(outbound.options.headers['Idempotency-Key'],'gracz-campaign/'+delivery.dispatchId);
  const body=JSON.parse(outbound.options.body);
  assert.match(body.text,/Wypisz się/);
  assert.equal(body.headers['List-Unsubscribe'],'<'+delivery.unsubscribeUrl+'>');
});
test('transport failures are always uncertain, without a retry',async()=>{
  const adapter=createCampaignResendTransport({
    enabled:true,apiKey:'test-key-123456789',from:'gracz.pl <news@example.com>',
    fetchFn:async()=>{throw Error('timeout');},
  });
  assert.deepEqual(await adapter.sendOnce(delivery),{
    state:'uncertain',providerMessageId:null,retryAllowed:false
  });
});

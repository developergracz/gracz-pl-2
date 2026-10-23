import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignResendTransport} from '../campaigns/resend-transport.mjs';

const delivery={
  dispatchId:'a2d4d2d4-0000-4000-a000-000000000001',
  to:'test@example.com',subject:'Nowości gracz.pl',
  text:'Poznaj nowe gry w naszym serwisie.',
  unsubscribeUrl:'https://gracz.pl/newsletter/#nl-withdrawal-panel'
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
    enabled:true,apiKey:'test' + '-key-' + '123456789',from:'gracz.pl <news@example.com>',
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
  assert.match(body.html,/Odwiedź gracz\.pl<\/a>/);
  assert.match(body.html,/Wypisz się z newslettera/);
  assert.ok(body.html.includes('Poznaj nowe gry w naszym serwisie.'));
  assert.equal(body.headers['List-Unsubscribe'],'<'+delivery.unsubscribeUrl+'>');
});
test('transport failures are always uncertain, without a retry',async()=>{
  const adapter=createCampaignResendTransport({
    enabled:true,apiKey:'test' + '-key-' + '123456789',from:'gracz.pl <news@example.com>',
    fetchFn:async()=>{throw Error('timeout');},
  });
  assert.deepEqual(await adapter.sendOnce(delivery),{
    state:'uncertain',providerMessageId:null,retryAllowed:false
  });
});

test('does not accept invented opt-out token URLs',async()=>{
  const adapter=createCampaignResendTransport({enabled:true,apiKey:'test'+'-key-'+'123456789',from:'gracz.pl <news@example.com>',fetchFn:async()=>{throw Error('unexpected send');}});
  await assert.rejects(adapter.sendOnce({...delivery,unsubscribeUrl:'https://gracz.pl/newsletter/#unsubscribe=proof'}),{code:'invalid_campaign_delivery'});
});


test('targeted transport sends formatted Premium HTML but preserves text fallback and opt-out',async()=>{
  let output;
  const adapter=createCampaignResendTransport({
    enabled:true,apiKey:'test'+'-key-'+'123456789',from:'gracz.pl <news@example.com>',
    fetchFn:async(_url,opts)=>{output=JSON.parse(opts.body);return {status:200,json:async()=>({id:'synthetic'})};}
  });
  const msg={...delivery,markdown:true,text:'**Dzień dobry**\n- Nowość\n[Serwis](https://gracz.pl/) <script>'};
  const result=await adapter.sendOnce(msg);
  assert.equal(result.state,'accepted');
  assert.match(output.html,/<strong>Dzień dobry<\/strong>/);
  assert.match(output.html,/<li>Nowość<\/li>/);
  assert.match(output.html,/&lt;script&gt;/);
  assert.doesNotMatch(output.html,/<script\b/i);
  assert.match(output.text,/\*\*Dzień dobry\*\*/);
  assert.match(output.text,/Wypisz się z newslettera/);
});

test('campaign inbox preview uses the subject instead of message body',async()=>{
  let mail=null;
  const transport=createCampaignResendTransport({
    enabled:true,apiKey:'test-key-123456789',from:'gracz.pl <news@example.com>',
    fetchFn:async(_url,opts)=>{
      mail=JSON.parse(opts.body);
      return {status:200,json:async()=>({id:'synthetic-preview'})};
    }
  });
  const message={...delivery,subject:'Temat kampanii <Premium>',
    text:'Pierwszy test gracz.pl FULL MAX PREMIUM · newsletter',markdown:true};
  assert.equal((await transport.sendOnce(message)).state,'accepted');
  assert.equal(mail.subject,message.subject);
  assert.ok(mail.text.startsWith(message.text),'Plain-text message body must remain unchanged');
  const hidden=mail.html.match(/<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(hidden,'Hidden inbox preheader exists');
  assert.ok(hidden.startsWith('Temat kampanii &lt;Premium&gt;'));
  assert.ok(!hidden.includes('Pierwszy test'),'Preview must not contain message body');
  assert.ok((hidden.match(/&#8204;&nbsp;/g)||[]).length>=100,
    'Invisible preview padding prevents body text spilling into inbox snippets');
  assert.ok(mail.html.includes(message.text),'Opened email still shows its complete original content');
  assert.match(mail.html,/<h1[^>]*>Temat kampanii &lt;Premium&gt;<\/h1>/);
});

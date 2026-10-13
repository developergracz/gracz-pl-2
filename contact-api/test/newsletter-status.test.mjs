import test from 'node:test';
import assert from 'node:assert/strict';
import { createMailboxStatus } from '../newsletter-status.mjs';
import { createMemoryNewsletterProofStore } from '../test-support/memory-newsletter-proof-store.mjs';

function setup(overrides={}) {
  const mails=[]; let reads=0; let time=Date.now();
  const options={secret:'s'.repeat(40), store:createMemoryNewsletterProofStore(),
    hashEmail:email=>'a'.repeat(64), baseUrl:'https://gracz.pl/newsletter/',
    sendEmail:async message=>{mails.push(message);return {id:'mail-1'};},
    readStatus:async()=>{reads++;return {state:'active'};}, now:()=>time, ...overrides};
  const manager=createMailboxStatus(options);
  return {manager,mails,options,reads:()=>reads,advance:ms=>{time+=ms;},token:()=>mails[0].text.match(/#status=([^\s]+)/)[1]};
}
test('STATUS_CHECK proves mailbox once without reading membership on request',async()=>{
  const x=setup();await x.manager.requestStatus({email:'owner@example.test'});
  assert.equal(x.reads(),0);assert.equal(x.mails.length,1);
  assert.deepEqual(await x.manager.checkStatus(x.token()),{state:'active'});
  await assert.rejects(()=>x.manager.checkStatus(x.token()),{code:'NEWSLETTER_STATUS_TOKEN_INVALID'});
  assert.equal(x.reads(),1);
});
test('STATUS_CHECK concurrent requests, restart and replay stay durable',async()=>{
  const x=setup(); await Promise.all(Array.from({length:8},()=>x.manager.requestStatus({email:'owner@example.test'})));
  const restarted=createMailboxStatus(x.options);await restarted.requestStatus({email:'owner@example.test'});
  assert.equal(x.mails.length,1);
  const outcomes=await Promise.allSettled([x.manager.checkStatus(x.token()),restarted.checkStatus(x.token())]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
});
test('STATUS_CHECK expiry, tampering and DOI purpose rejected before status read',async()=>{
  const x=setup();await x.manager.requestStatus({email:'owner@example.test'});
  for(const token of ['n1.foo.bar','',x.token()+'x'])await assert.rejects(()=>x.manager.checkStatus(token),{code:'NEWSLETTER_STATUS_TOKEN_INVALID'});
  x.advance(600001);await assert.rejects(()=>x.manager.checkStatus(x.token()),{code:'NEWSLETTER_STATUS_TOKEN_INVALID'});
  assert.equal(x.reads(),0);
});
test('STATUS_CHECK ambiguous mail is not resent, provider failure never becomes inactive',async()=>{
  let attempts=0; const x=setup({sendEmail:async()=>{attempts++;throw new Error('lost ack');}});
  await assert.rejects(()=>x.manager.requestStatus({email:'owner@example.test'}));
  await x.manager.requestStatus({email:'owner@example.test'});assert.equal(attempts,1);
  const y=setup({readStatus:async()=>{throw new Error('provider detail should not leak');}});
  await y.manager.requestStatus({email:'owner@example.test'});
  await assert.rejects(()=>y.manager.checkStatus(y.token()),{code:'NEWSLETTER_STATUS_UNAVAILABLE'});
  await assert.rejects(()=>y.manager.checkStatus(y.token()),{code:'NEWSLETTER_STATUS_TOKEN_INVALID'});
});

test('anonymous admission status/body/timing do not wait for membership or provider failures',async()=>{
  const {createNewsletterAdmission}=await import('../newsletter-status.mjs');
  const {createHash}=await import('node:crypto');
  const samples=[];let calls=0;const logs=[];let release;
  const blocked=new Promise(resolve=>{release=resolve;});
  const options={store:createMemoryNewsletterProofStore(),hashEmail:email=>createHash('sha256').update(email).digest('hex'),logger:{error:(...args)=>logs.push(args)},
    requestOptIn:async({email})=>{calls++;await blocked;if(email.startsWith('fail'))throw new Error('SECRET-EMAIL-TOKEN');},requestStatus:async()=>{await blocked;}};
  const admission=createNewsletterAdmission(options);
  for(const prefix of ['active','pending','new','fail']) {
    for(let i=0;i<6;i++) {
      const start=performance.now();
      assert.deepEqual(await admission.acceptOptIn({email:prefix+i+'@example.test'}),{state:'request_received'});
      samples.push(performance.now()-start);
    }
  }
  assert.equal(calls,0,'provider work cannot start before public admission yields');
  assert.ok(Math.max(...samples)<100,'bounded local admission independent of blocked provider');
  await new Promise(resolve=>setImmediate(resolve));release();await admission.waitForPublicWork();
  assert.equal(calls,24);assert.equal(logs.length,6);assert.ok(!JSON.stringify(logs).includes('SECRET'));
  await createNewsletterAdmission(options).acceptOptIn({email:'fail0@example.test'});
  assert.equal(calls,24,'unknown admission cannot be replayed across managers');
});
test('anonymous admission reports DB failure, not false delivery success',async()=>{
  const {createNewsletterAdmission}=await import('../newsletter-status.mjs');
  const admission=createNewsletterAdmission({store:{claimDispatch:async()=>{throw new Error('DB detail');}},hashEmail:()=>'a'.repeat(64)});
  await assert.rejects(()=>admission.acceptOptIn({email:'test@example.test'}),{code:'NEWSLETTER_STATUS_UNAVAILABLE',status:503});
});
test('public admission reserves capacity before awaiting durable claims',async()=>{
  const {createNewsletterAdmission}=await import('../newsletter-status.mjs');
  let release;const barrier=new Promise(resolve=>{release=resolve;});let calls=0;
  const store={claimDispatch:async()=>{await barrier;return true;},markDispatchDone:async()=>true};
  const admission=createNewsletterAdmission({store,hashEmail:()=>'b'.repeat(64),requestOptIn:async()=>{calls++;}});
  const pending=Array.from({length:200},()=>admission.acceptOptIn({email:'test@example.test'}));
  const settled=Promise.allSettled(pending);release();
  const outcomes=await settled;assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,64);
  assert.equal(outcomes.filter(r=>r.status==='rejected').length,136);
  await admission.waitForPublicWork();assert.equal(calls,64);
  await admission.acceptOptIn({email:'test@example.test'});await admission.waitForPublicWork();assert.equal(calls,65);
});
test('real HTTP anonymous requests share status, headers, body and bounded timings',async t=>{
  const {createServer}=await import('node:http');const {once}=await import('node:events');
  const {createNewsletterAdmission}=await import('../newsletter-status.mjs');
  const {createNewsletterRoute}=await import('../routes/newsletter-route.mjs');
  const {createHash}=await import('node:crypto');
  let release;const blocked=new Promise(resolve=>{release=resolve;});
  const admission=createNewsletterAdmission({store:createMemoryNewsletterProofStore(),hashEmail:s=>createHash('sha256').update(s).digest('hex'),requestOptIn:async()=>blocked,requestStatus:async()=>blocked,logger:{error(){}}});
  const route=createNewsletterRoute({allowedOrigins:new Set(['https://gracz.pl']),newsletter:{enabled:true,requestOptIn(){},...admission},newsletterIpBuckets:new Map(),newsletterEmailBuckets:new Map(),rateLimit(){},hashValue:s=>s,clientIp:()=> 'test',
    readJson:async req=>{let s='';for await(const chunk of req)s+=chunk;return JSON.parse(s);},
    json:(res,status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer'});res.end(JSON.stringify(body));},setCors(){},bad:()=>{throw new Error('bad input');},normalizeEmail:s=>s,requiredString:s=>s,optionalString:s=>s||'',parseStartedAt:()=>0,isValidEmailSyntax:()=>true,enforceFormTiming(){},validateEmailDomain:async()=>{},logger:{log(){}}});
  const server=createServer((req,res)=>route(req,res,new URL(req.url,'http://local'),'test').catch(()=>{res.writeHead(503);res.end();}));
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{release();await admission.waitForPublicWork();server.close();});
  const samples=[];
  for(const path of ['subscribe','status-request'])for(const kind of ['active','pending','new','suppressed','unknown'])for(let i=0;i<3;i++) {
    const start=performance.now();const response=await fetch(`http://127.0.0.1:${server.address().port}/newsletter/${path}`,{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json'},body:JSON.stringify({email:kind+i+'@example.test',consent:true})});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(await response.text(),'{"ok":true,"state":"request_received"}');samples.push(performance.now()-start);
  }
  assert.ok(Math.max(...samples)<1000,'HTTP responses finish even while all provider operations remain blocked');
  t.diagnostic(`30 HTTP samples; min=${Math.min(...samples).toFixed(1)}ms max=${Math.max(...samples).toFixed(1)}ms; provider barrier held throughout`);
});
test('status-mail suppression prevents delivery; missing permission stays fail-closed',async()=>{
  const x=setup({canSend:async()=>false});await x.manager.requestStatus({email:'suppressed@example.test'});
  assert.equal(x.mails.length,0);assert.equal(x.reads(),0);
  const y=setup({canSend:async()=>{throw new Error('permission denied');}});
  await assert.rejects(()=>y.manager.requestStatus({email:'unknown@example.test'}));
  await y.manager.requestStatus({email:'unknown@example.test'});
  assert.equal(y.mails.length,0);
});

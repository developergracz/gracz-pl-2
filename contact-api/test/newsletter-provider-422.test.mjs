import test from 'node:test';
import assert from 'node:assert/strict';
import {isDefinitiveNewsletterEmailRejection} from '../newsletter-rejection.mjs';
import {createProvider,createManager,consentEmailHash} from '../test-support/newsletter-provider.mjs';

test('422 classification never includes timeouts, 5xx or non-email operations',()=>{
  const definitive={code:'NEWSLETTER_MAIL_FAILED',providerOperation:'POST /emails',providerStatus:422,status:422,providerResponseComplete:true};
  assert.equal(isDefinitiveNewsletterEmailRejection(definitive),true);
  for(const patch of [{providerResponseComplete:false},{providerResponseComplete:undefined},{providerStatus:429,status:429},{providerStatus:503,status:503},{providerStatus:502,status:502},{providerOperation:'PATCH /contacts/{contact}'},{code:'NEWSLETTER_PROVIDER_FAILED'},{providerStatus:null,status:502}]){
    assert.equal(isDefinitiveNewsletterEmailRejection({...definitive,...patch}),false);
  }
});

for(const bodyFailure of ['truncate422Body','invalid422Body'])test(`422 with ${bodyFailure} is ambiguous and never logged as confirmed rejection`,async t=>{
  const provider=await createProvider(t),logs=[];
  provider.behavior.rejectConfirmationBeforeAccept422=true;
  provider.behavior[bodyFailure]=true;
  const manager=createManager(provider,{logger:{error:(...args)=>logs.push(args)}});
  const email='body-failure@example.test';
  await assert.rejects(()=>manager.requestOptIn({email}),error=>{
    assert.equal(isDefinitiveNewsletterEmailRejection(error),false);
    return true;
  });
  assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1);
  assert.equal((await provider.consentStore.getOptInRequest(consentEmailHash(email))).state,'unknown');
  assert.ok(!JSON.stringify(logs).includes('NEWSLETTER_DOI_422_OPERATOR_HOLD'));
});

for(const failure of [429,500,503,'timeout','disconnect','redirect'])test(`DOI ${failure} sends once then fences concurrent and restarted callers`,async t=>{
  const provider=await createProvider(t);
  provider.behavior.confirmResponse=failure;
  const email='single-attempt@example.test';
  const manager=createManager(provider,{providerTimeoutMs:60,logger:{error(){}}});
  await assert.rejects(()=>manager.requestOptIn({email}),{code:'NEWSLETTER_MAIL_FAILED'});
  assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1);
  assert.equal(provider.requests.filter(r=>r.path==='/synthetic-redirect-receiver').length,0,'redirect must not forward credentials or email body');
  provider.behavior.confirmResponse=null;
  const results=await Promise.allSettled(Array.from({length:8},()=>createManager(provider).requestOptIn({email})));
  assert.ok(results.every(r=>r.status==='rejected'&&r.reason.code==='NEWSLETTER_REQUEST_UNCERTAIN'));
  assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1);
  assert.equal((await provider.consentStore.getOptInRequest(consentEmailHash(email))).state,'unknown');
});

test('logger failure cannot skip durable unknown transition or replace provider failure',async t=>{
  const provider=await createProvider(t);
  provider.behavior.rejectConfirmationBeforeAccept422=true;
  const email='logger-failure@example.test';
  const manager=createManager(provider,{logger:{error(){throw new Error('logger unavailable');}}});
  await assert.rejects(()=>manager.requestOptIn({email}),{code:'NEWSLETTER_MAIL_FAILED'});
  assert.equal((await provider.consentStore.getOptInRequest(consentEmailHash(email))).state,'unknown');
});

test('definitive 422 records redacted operator hold, never retries or silently unblocks',async t=>{
  const provider=await createProvider(t);
  provider.behavior.rejectConfirmationBeforeAccept422=true;
  provider.behavior.providerRequestId='synthetic-private@example.test';
  const logs=[];
  const logger={error:(message,metadata)=>logs.push({message,metadata})};
  const manager=createManager(provider,{logger});
  const email='synthetic-422@example.test';
  await assert.rejects(
    ()=>manager.requestOptIn({email,name:'Synthetic',source:'newsletter_page'}),
    error=>error?.code==='NEWSLETTER_MAIL_FAILED'&&error?.status===422
  );
  assert.equal(provider.emails.length,0,'422 returned without provider acceptance');
  assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1,'422 must not retry');
  const entry=logs.find(l=>l.metadata?.code==='NEWSLETTER_DOI_422_OPERATOR_HOLD');
  assert.ok(entry,'must surface explicit operator HOLD');
  assert.match(entry.metadata.requestId,/^[0-9a-f-]{36}$/);
  assert.equal(JSON.stringify(entry).includes(email),false,'never log recipient');
  assert.equal(JSON.stringify(entry).includes('synthetic-private'),false,'provider header is untrusted and never logged verbatim');
  assert.match(entry.metadata.providerRequestIdSha256,/^[0-9a-f]{64}$/);
  const stored=await provider.consentStore.getOptInRequest(consentEmailHash(email));
  assert.equal(stored?.state,'unknown','retain safe durable fence pending operator proof');

  provider.behavior.rejectConfirmationBeforeAccept422=false;
  await assert.rejects(()=>manager.requestOptIn({email,name:'Synthetic',source:'newsletter_page'}),error=>error?.code==='NEWSLETTER_REQUEST_UNCERTAIN');
  assert.equal(provider.emails.length,0,'ordinary later request must not silently resend');
});

test('even a complete 422 after simulated acceptance cannot authorize release',async t=>{
  const provider=await createProvider(t);
  provider.behavior.confirmResponse=422;
  const email='accepted-422@example.test';
  const manager=createManager(provider,{logger:{error(){}}});
  await assert.rejects(()=>manager.requestOptIn({email}),error=>isDefinitiveNewsletterEmailRejection(error));
  assert.equal(provider.emails.length,1);
  assert.equal((await provider.consentStore.getOptInRequest(consentEmailHash(email))).state,'unknown');
  provider.behavior.confirmResponse=null;
  await assert.rejects(()=>createManager(provider).requestOptIn({email}),{code:'NEWSLETTER_REQUEST_UNCERTAIN'});
  assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1);
});

for(const committed of [false,true])test(`lost PostgreSQL send acknowledgement (committed=${committed}) never permits a new DOI`,async t=>{
  const provider=await createProvider(t);
  createManager(provider);
  const store=provider.consentStore;
  const manager=createManager(provider,{consentStore:{...store,async markOptInSent(key){
    if(committed)await store.markOptInSent(key);
    throw new Error('synthetic lost DB acknowledgement');
  }}});
  const email='lost-db-ack@example.test';
  await assert.rejects(()=>manager.requestOptIn({email}),/lost DB acknowledgement/);
  assert.equal((await store.getOptInRequest(consentEmailHash(email))).state,committed?'sent':'unknown');
  if(committed)await createManager(provider).requestOptIn({email});
  else await assert.rejects(()=>createManager(provider).requestOptIn({email}),{code:'NEWSLETTER_REQUEST_UNCERTAIN'});
  assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1);
  assert.equal((await store.listConsentEvents(consentEmailHash(email))).length,1);
});

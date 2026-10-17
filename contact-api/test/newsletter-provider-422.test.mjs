import test from 'node:test';
import assert from 'node:assert/strict';
import {isDefinitiveNewsletterEmailRejection} from '../newsletter-rejection.mjs';
import {createProvider,createManager,consentEmailHash} from '../test-support/newsletter-provider.mjs';

test('422 classification never includes timeouts, 5xx or non-email operations',()=>{
  const definitive={code:'NEWSLETTER_MAIL_FAILED',providerOperation:'POST /emails',providerStatus:422,status:422};
  assert.equal(isDefinitiveNewsletterEmailRejection(definitive),true);
  for(const patch of [{providerStatus:503,status:503},{providerStatus:502,status:502},{providerOperation:'PATCH /contacts/{contact}'},{code:'NEWSLETTER_PROVIDER_FAILED'},{providerStatus:null,status:502}]){
    assert.equal(isDefinitiveNewsletterEmailRejection({...definitive,...patch}),false);
  }
});

test('definitive 422 records redacted operator hold, never retries or silently unblocks',async t=>{
  const provider=await createProvider(t);
  provider.behavior.rejectConfirmationBeforeAccept422=true;
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
  const stored=await provider.consentStore.getOptInRequest(consentEmailHash(email));
  assert.equal(stored?.state,'unknown','retain safe durable fence pending operator proof');

  provider.behavior.rejectConfirmationBeforeAccept422=false;
  const repeat=await manager.requestOptIn({email,name:'Synthetic',source:'newsletter_page'});
  assert.equal(repeat.state,'request_received');
  assert.equal(provider.emails.length,0,'ordinary later request must not silently resend');
});

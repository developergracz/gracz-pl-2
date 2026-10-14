import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseNewsletterIntakePaused} from '../newsletter-config.mjs';
import {createProvider,createManager,consentEmailHash} from '../test-support/newsletter-provider.mjs';
import {createMemoryNewsletterProofStore} from '../test-support/memory-newsletter-proof-store.mjs';
test('R5 intake configuration accepts explicit false only; malformed values fail closed',()=>{
  for(const value of [undefined,'false','FALSE',' false ','0'])assert.equal(parseNewsletterIntakePaused(value),false);
  for(const value of ['true','TRUE','1','yes','no','off','2','',null,'flase',' falsex '])assert.equal(parseNewsletterIntakePaused(value),true);
});
for(const status of [400,429,503])test('R5 HTTP '+status+' after POST is never proof of non-delivery',async t=>{
  const provider=await createProvider(t),proofStore=createMemoryNewsletterProofStore();
  const m=createManager(provider,{proofStore,logger:{error(){}}}),email='status-'+status+'@example.test';
  provider.behavior.confirmResponse=status;
  await m.acceptOptIn({email});await m.waitForPublicWork();
  assert.equal(provider.emails.length,1);
  assert.equal((await provider.consentStore.getOptInRequest(consentEmailHash(email))).state,'unknown');
  provider.behavior.confirmResponse=null;
  const restarted=createManager(provider,{proofStore,logger:{error(){}}});await restarted.acceptOptIn({email});await restarted.waitForPublicWork();assert.equal(provider.emails.length,1);
});
test('R5 request logs contain no email hash prefixes',async()=>{
  for(const path of ['server.mjs','routes/newsletter-route.mjs','routes/premium-reply-route.mjs']) {
    const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
    assert.ok(!/\b(?:emailHash|recipientHash):\s*hashValue\([^)]*\)\.slice/.test(source));
  }
});

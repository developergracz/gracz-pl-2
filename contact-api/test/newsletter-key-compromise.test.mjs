// #278 characterization only: these tests are NOT a recovery implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createProvider, createManager, extractToken, consentEmailHash} from '../test-support/newsletter-provider.mjs';
import {createMailboxStatus} from '../newsletter-status.mjs';
import {createMemoryNewsletterProofStore} from '../test-support/memory-newsletter-proof-store.mjs';

test('278 replacement status key rejects old proof before membership reads', async () => {
  let message, reads=0, consumes=0;
  const store=createMemoryNewsletterProofStore();
  const options={secret:randomBytes(48).toString('hex'),store,hashEmail:consentEmailHash,
    baseUrl:'https://example.test/',sendEmail:async mail=>{message=mail;return {id:'synthetic'};},
    readStatus:async()=>{reads++;return {state:'inactive'};}};
  await createMailboxStatus(options).requestStatus({email:'recovery@example.test'});
  const token=message.text.match(/#status=([^\s]+)/)[1];
  const replacement=createMailboxStatus({...options,secret:randomBytes(48).toString('hex'),
    store:{...store,async consumeStatusToken(...args){consumes++;return store.consumeStatusToken(...args);}}});
  await assert.rejects(replacement.checkStatus(token),{code:'NEWSLETTER_STATUS_TOKEN_INVALID'});
  assert.equal(reads,0);
  assert.equal(consumes,0);
});

test('278 replacement token key rejects legacy confirm and unsubscribe before provider effects', async t => {
  const provider = await createProvider(t);
  const original = createManager(provider);
  await original.requestOptIn({email:'recovery@example.test'});
  const confirm = extractToken(provider.emails[0], 'confirm');
  await original.confirm(confirm);
  const unsubscribe = extractToken(provider.emails[1], 'unsubscribe');
  const before = provider.requests.length;
  const hash = consentEmailHash('recovery@example.test');
  const events = await provider.consentStore.listConsentEvents(hash);
  const replacement = createManager(provider, {secret:randomBytes(48).toString('hex')});
  await assert.rejects(replacement.confirm(confirm), {code:'INVALID_NEWSLETTER_TOKEN'});
  await assert.rejects(replacement.unsubscribe(unsubscribe), {code:'INVALID_NEWSLETTER_TOKEN'});
  assert.equal(provider.requests.length, before);
  assert.deepEqual(await provider.consentStore.listConsentEvents(hash), events);
});

test('278 missing token key fails closed without provider access', async t => {
  const provider = await createProvider(t);
  const manager = createManager(provider, {secret:''});
  await assert.rejects(manager.confirm('invalid'), {code:'NEWSLETTER_NOT_CONFIGURED'});
  await assert.rejects(manager.unsubscribe('invalid'), {code:'NEWSLETTER_NOT_CONFIGURED'});
  await assert.rejects(manager.requestOptIn({email:'recovery@example.test'}), {code:'NEWSLETTER_NOT_CONFIGURED'});
  assert.equal(provider.requests.length, 0);
});

test('278 naive HMAC rotation leaves legacy lookup unresolved: HARD HOLD, not safe migration', async t => {
  const provider = await createProvider(t);
  const original = createManager(provider);
  await original.requestOptIn({email:'recovery@example.test'});
  const oldHash = consentEmailHash('recovery@example.test');
  const oldContact = await provider.consentStore.getContact(oldHash);
  const oldEvents = await provider.consentStore.listConsentEvents(oldHash);
  const before = provider.requests.length;
  let lookedUp = false;
  const store = provider.consentStore;
  const replacement = createManager(provider, {
    consentHashSecret:randomBytes(48).toString('hex'),
    consentStore:{...store, async getContact(hash) {
      lookedUp = true;
      // Boolean assertions avoid emitting identifier values on failure.
      assert.equal(hash === oldHash, false);
      assert.equal(await store.getContact(hash), null);
      // Stop the probe before it could create another identity or effect.
      throw Object.assign(new Error('Synthetic continuity hold'), {code:'TEST_CONTINUITY_HOLD'});
    }},
  });
  await assert.rejects(replacement.requestOptIn({email:'recovery@example.test'}), {code:'TEST_CONTINUITY_HOLD'});
  assert.equal(lookedUp, true);
  assert.equal(provider.requests.length, before);
  assert.deepEqual(await store.getContact(oldHash), oldContact);
  assert.deepEqual(await store.listConsentEvents(oldHash), oldEvents);
});

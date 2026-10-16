import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewsletterAdmission,createMailboxStatus} from '../newsletter-status.mjs';
import {createMemoryNewsletterProofStore} from '../test-support/memory-newsletter-proof-store.mjs';
import {createProvider,createManager} from '../test-support/newsletter-provider.mjs';
import {EventEmitter} from 'node:events';
import {installShutdown} from '../lifecycle.mjs';
const email='private@example.test', hash='a'.repeat(64);
const silent={error(){}};
test('R4 pre-send persistence failure releases both fences and retains append-only events',async t=>{
  const provider=await createProvider(t);createManager(provider);const store=provider.consentStore;
  const original=store.appendConsentEvent;let fail=true;
  provider.consentStore={...store,appendConsentEvent:async(...args)=>{const result=await original(...args);if(fail)throw new Error('after append before send');return result;}};
  const proofStore=createMemoryNewsletterProofStore();
  const m=createManager(provider,{proofStore,logger:silent});
  await m.acceptOptIn({email});await m.waitForPublicWork();assert.equal(provider.emails.length,0);
  fail=false;await m.acceptOptIn({email});await m.waitForPublicWork();assert.equal(provider.emails.length,1);
  assert.equal((await store.listConsentEvents((await import('../test-support/newsletter-provider.mjs')).consentEmailHash(email))).length,2,'request evidence is not deleted on release');
});
test('R4 stale public worker cannot reach external side effect after claim takeover',async()=>{
  let time=new Date(),release;const barrier=new Promise(r=>release=r),records=new Map();
  const proof=createMemoryNewsletterProofStore({records,clock:()=>time});let calls=0,entered;
  const started=new Promise(r=>entered=r);
  const first=createNewsletterAdmission({store:proof,hashEmail:()=>hash,logger:silent,requestOptIn:async({beforeExternalEffect})=>{entered();await barrier;await beforeExternalEffect();calls++;}});
  await first.acceptOptIn({email});await started;time=new Date(time.getTime()+61000);
  const fresh=createNewsletterAdmission({store:proof,hashEmail:()=>hash,logger:silent,requestOptIn:async({beforeExternalEffect})=>{await beforeExternalEffect();calls++;}});
  await fresh.acceptOptIn({email});await fresh.waitForPublicWork();release();await first.waitForPublicWork();assert.equal(calls,1);
});
test('R4 drain waits for admission in DB and rejects fresh intake',async()=>{
  let release;const barrier=new Promise(r=>release=r);let finished=false;
  const store={claimDispatch:async()=>{await barrier;return true;},markDispatchDone:async()=>true};
  const m=createNewsletterAdmission({store,hashEmail:()=>hash,requestOptIn:async()=>{finished=true;}});
  const accepted=m.acceptOptIn({email});m.stopAccepting();let drained=false;const drain=m.waitForPublicWork().then(()=>{drained=true;});
  await assert.rejects(()=>m.acceptOptIn({email}),{status:503});assert.equal(drained,false);release();await accepted;await drain;assert.equal(finished,true);
});
test('R4 shutdown timeout never releases reservations or closes DB before drain',async()=>{
  const signals=new EventEmitter();let exitCode,closed=false,stopCount=0,finish;
  const completed=new Promise(r=>finish=r);
  installShutdown({signals,server:{close(){},closeAllConnections(){}},newsletter:{stopAccepting(){stopCount++;},waitForPublicWork:()=>new Promise(()=>{})},database:{close(){closed=true;}},timeoutMs:50,logger:silent,exit:code=>{exitCode=code;finish();}});
  signals.emit('SIGTERM');signals.emit('SIGINT');await completed;assert.equal(exitCode,1);assert.equal(stopCount,1);assert.equal(closed,false);
});
test('R4 status preflight errors retry safely, lost acknowledgement stays fenced',async()=>{
  let fail=true,sent=0;const store=createMemoryNewsletterProofStore();
  const m=createMailboxStatus({secret:'x'.repeat(40),store,hashEmail:()=>hash,baseUrl:'https://gracz.pl/newsletter/',canSend:async()=>{if(fail)throw new Error('429');return true;},sendEmail:async()=>{sent++;throw new Error('lost ACK');}});
  await assert.rejects(()=>m.requestStatus({email}));fail=false;await assert.rejects(()=>m.requestStatus({email}));await m.requestStatus({email});assert.equal(sent,1);
});

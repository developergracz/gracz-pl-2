import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {createPersistenceRepositories} from '../persistence/repositories.mjs';
import {applyMigrations} from '../persistence/migrator.mjs';
import {applyNewsletterCandidate} from './newsletter-candidate.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createProvider,createManager,extractToken,consentEmailHash,getFreePort} from '../test-support/newsletter-provider.mjs';
const url=process.env.DATABASE_URL;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){for(let i=0;i<200;i++){if(await predicate())return;await delay(25);}throw new Error('condition timeout');}

test('R4 legacy characterization: process interruption, shutdown, health and recovery', {skip:!url}, async t=>{
  assertDisposableDatabaseUrl(url);
  const db=createDatabase({connectionString:url});t.after(()=>db.close());
  await applyMigrations(db);await applyNewsletterCandidate(db,url);
  const provider=await createProvider(t);provider.consentStore=createPersistenceRepositories(db).newsletter;
  let child,base,logs='';
  async function stop(signal='SIGTERM'){
    if(!child||child.exitCode!==null||child.signalCode!==null)return;
    const exited=once(child,'exit');child.kill(signal);return await exited;
  }
  t.after(()=>stop('SIGKILL'));
  async function start(extra={},health=200){
    const port=await getFreePort();base='http://127.0.0.1:'+port;
    child=spawn(process.execPath,['test-support/legacy-newsletter-server.mjs'],{cwd:new URL('..',import.meta.url),stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,NODE_ENV:'test',DATABASE_URL:url,HOST:'127.0.0.1',PORT:String(port),
      RESEND_API_KEY:'test-key',NEWSLETTER_RESEND_API_KEY:'test-key',RESEND_API_BASE:provider.base,RESEND_ENDPOINT:provider.base+'/emails',EMAIL_FROM:'sender@example.test',CONTACT_TO:'owner@example.test',
      CONTACT_REPLY_SECRET:'test-'+'r'.repeat(40),CONTACT_DATA_ENCRYPTION_SECRET:'test-'+'c'.repeat(40),NEWSLETTER_INTAKE_PAUSED:'false',NEWSLETTER_SECRET:'test-'+'n'.repeat(40),NEWSLETTER_CONSENT_HASH_SECRET:'test-consent-'+'h'.repeat(40),...extra}});
    child.stdout.on('data',c=>{logs+=c;});child.stderr.on('data',c=>{logs+=c;});
    await until(async()=>{assert.equal(child.exitCode,null);try{return (await fetch(base+'/health')).status===health;}catch{return false;}});
  }
  async function post(path,body){const response=await fetch(base+'/newsletter/'+path,{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
  const submit=email=>post('subscribe',{email,consent:true,startedAt:Date.now()-5000});
  const row=async email=>(await db.query('SELECT state FROM newsletter_opt_in_requests WHERE email_hash=$1',[consentEmailHash(email)])).rows[0];
  const neutral={status:200,body:{ok:true,state:'request_received'}};
  await t.test('429 read recovers across restart; ambiguous POST does not',async()=>{
    const email=randomUUID()+'@example.test';const before=provider.emails.length;
    provider.behavior.suppressionError=429;await start();assert.deepEqual(await submit(email),neutral);
    await until(()=>logs.includes('NEWSLETTER_PRE_EFFECT_RELEASED'));await stop();
    provider.behavior.suppressionError=0;await start();assert.deepEqual(await submit(email),neutral);await until(async()=>(await row(email))?.state==='sent');await stop();assert.equal(provider.emails.length,before+1);
    const uncertain=randomUUID()+'@example.test';provider.behavior.confirmResponse=503;await start();assert.deepEqual(await submit(uncertain),neutral);
    await until(async()=>(await row(uncertain))?.state==='unknown');await stop();provider.behavior.confirmResponse=null;await start();assert.deepEqual(await submit(uncertain),neutral);await stop();assert.equal(provider.emails.length,before+2);
    assert.ok(!logs.includes(email)&&!logs.includes(uncertain)&&!logs.includes(consentEmailHash(email)));
    // Later actual mailbox confirmation reconciles both holds, without resending DOI.
    const m=createManager(provider,{proofStore:(await import('../persistence/newsletter-proof-store.mjs')).createNewsletterProofStore(db)});
    await m.confirm(extractToken(provider.emails.at(-1),'confirm'));
    assert.equal((await row(uncertain)).state,'sent');
    const dispatch=(await db.query("SELECT state FROM idempotency_keys WHERE scope='newsletter-public-optin' AND key_hash=$1",[consentEmailHash(uncertain)])).rows[0];assert.equal(dispatch.state,'done');
    await m.unsubscribe(extractToken(provider.emails.at(-1),'unsubscribe'));
    await start();assert.deepEqual(await submit(uncertain),neutral);await stop();assert.equal(provider.emails.length,before+4,'one welcome and one fresh DOI after withdrawal');
  });
  for(const signal of ['SIGTERM','SIGINT'])await t.test(signal+' drains admitted provider work before DB close',async()=>{
    const email=randomUUID()+'@example.test',before=provider.emails.length;
    provider.behavior.contactGetDelayMs=350;await start();assert.deepEqual(await submit(email),neutral);
    assert.deepEqual(await stop(signal),[0,null]);assert.equal(provider.emails.length,before+1);assert.equal((await row(email)).state,'sent');
  });
  await t.test('SIGKILL before external effect recovers with fenced claim after restart',async()=>{
    const email=randomUUID()+'@example.test',before=provider.emails.length;
    provider.behavior.contactGetDelayMs=1000;await start();assert.deepEqual(await submit(email),neutral);
    await until(()=>provider.behavior.contactGetDelayMs===0);await stop('SIGKILL');
    assert.equal(provider.emails.length,before);
    await db.query("UPDATE idempotency_keys SET updated_at=now()-interval '2 minutes' WHERE scope='newsletter-public-optin' AND key_hash=$1",[consentEmailHash(email)]);
    await start();assert.deepEqual(await submit(email),neutral);await stop();assert.equal(provider.emails.length,before+1);
  });
  for(const mode of ['SIGKILL','deadline'])await t.test(mode+' after provider accepts never causes a second DOI',async()=>{
    const email=randomUUID()+'@example.test',before=provider.emails.length;
    provider.behavior.emailResponseDelayMs=600;
    await start(mode==='deadline'?{API_SHUTDOWN_TIMEOUT_MS:'50'}:{});
    assert.deepEqual(await submit(email),neutral);await until(()=>provider.emails.length===before+1);
    const result=await stop(mode==='deadline'?'SIGTERM':'SIGKILL');if(mode==='deadline')assert.deepEqual(result,[1,null]);
    provider.behavior.emailResponseDelayMs=0;
    await db.query("UPDATE idempotency_keys SET updated_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE scope='newsletter-public-optin' AND key_hash=$1",[consentEmailHash(email)]);
    await start();assert.deepEqual(await submit(email),neutral);await stop();assert.equal(provider.emails.length,before+1);assert.equal((await row(email)).state,'inflight');
  });
  await t.test('paused intake preserves proof, confirm and unsubscribe',async()=>{
    const email=randomUUID()+'@example.test',m=createManager(provider);await m.requestOptIn({email});const token=extractToken(provider.emails.at(-1),'confirm');
    await start({NEWSLETTER_INTAKE_PAUSED:'true'});
    for(const path of ['subscribe','status-request'])assert.equal((await post(path,{email,consent:true})).status,503);
    assert.equal((await post('confirm',{token})).status,200);
    assert.equal((await post('unsubscribe',{token:extractToken(provider.emails.at(-1),'unsubscribe')})).status,200);
    assert.equal((await post('status-check',{token:'invalid'})).status,400,'proof route remains available');
    assert.equal((await (await fetch(base+'/health')).json()).newsletterIntakePaused,true);await stop();
  });
  for(const pause of [undefined,'','flase','false','0'])await t.test('R5.1 explicit intake configuration '+String(pause),async subtest=>{
    subtest.after(()=>stop('SIGKILL')); // Clean up even when an assertion fails.
    await start({NEWSLETTER_INTAKE_PAUSED:pause});
    const enabled=['false','0'].includes(pause);
    assert.equal((await fetch(base+'/health')).status,200);
    // Liveness may precede the first bounded database readiness check under load.
    if(enabled)await until(async()=>(await fetch(base+'/newsletter/ready')).status===200);
    assert.equal((await fetch(base+'/newsletter/ready')).status,enabled?200:503);
    if(!enabled){
      assert.equal((await submit(randomUUID()+'@example.test')).status,503);
      const response=await fetch(base+'/contact',{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json','x-idempotency-key':randomUUID()},body:JSON.stringify({
        name:'Test User',email:randomUUID()+'@example.test',category:'Pytanie ogólne',subject:'Test formularza',message:'To jest poprawna wiadomość testowa formularza gracz.pl.',website:'',acknowledgement:true,page:'https://gracz.pl/',startedAt:Date.now()-5000,newsletter:true
      })});
      assert.equal(response.status,200);const body=await response.json();assert.equal(body.ok,true);assert.equal(body.newsletter,'temporarily_unavailable');
    }
    await stop();
  });
  await t.test('R5 PostgreSQL outage never changes HTTP liveness; recovery restores readiness',async()=>{
    const unreachable=new URL(url);unreachable.port=String(await getFreePort());
    await start({DATABASE_URL:String(unreachable)});
    assert.equal((await fetch(base+'/health')).status,200);
    assert.equal((await fetch(base+'/newsletter/ready')).status,503);
    assert.equal((await submit(randomUUID()+'@example.test')).status,503);
    assert.equal((await fetch(base+'/health')).status,200);
    await stop();await start();assert.equal((await fetch(base+'/newsletter/ready')).status,200);await stop();
  });
  await t.test('missing candidate table fails newsletter readiness without affecting liveness',async()=>{
    await db.query('ALTER TABLE newsletter_opt_in_requests RENAME TO r4_schema_fixture');
    try{
      await start();assert.equal((await fetch(base+'/newsletter/ready')).status,503);assert.equal((await (await fetch(base+'/newsletter/ready')).json()).schemaReady,false);assert.equal((await submit(randomUUID()+'@example.test')).status,503);await stop();
      await start({NEWSLETTER_INTAKE_PAUSED:'true'});const health=await(await fetch(base+'/newsletter/ready')).json();assert.equal(health.schemaReady,false);assert.equal(health.intakePaused,true);await stop();
    }finally{await stop('SIGKILL');await db.query('ALTER TABLE r4_schema_fixture RENAME TO newsletter_opt_in_requests');}
    await start();assert.equal((await fetch(base+'/newsletter/ready')).status,200);await stop();
  });
});

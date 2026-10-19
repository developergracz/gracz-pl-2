import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('280 business server cannot construct legacy newsletter trust', async () => {
  const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from\s+["']\.\/newsletter\.mjs["']/);
  assert.match(source,/const newsletter = createHeldNewsletterManager\(\)/);
});

test('280 held manager cannot read stores, send, accept consent or report withdrawal complete', async () => {
  const {createHeldNewsletterManager}=await import('../security/newsletter-recovery-hold.mjs');
  const manager=createHeldNewsletterManager();
  assert.equal(manager.enabled,false);
  assert.equal(manager.intakePaused,true);
  assert.deepEqual(await manager.readiness(),{ready:false,configured:false,intakePaused:true,schemaReady:false});
  for(const method of ['requestOptIn','acceptOptIn','requestStatus','acceptStatus','confirm','unsubscribe','checkStatus']) {
    for(const input of ['n1.forged','ns1.forged','n2.future',{email:'synthetic@example.test',consent:true}]) {
      await assert.rejects(manager[method](input),{code:'NEWSLETTER_RECOVERY_HOLD',status:503});
    }
  }
  manager.stopAccepting();
  await manager.waitForPublicWork();
  assert.equal(Object.isFrozen(manager),true);
});

test('280 actual business HTTP surface rejects old/new actions with pause=false and synthetic legacy keys',async t=>{
  const {spawn}=await import('node:child_process');
  const {once}=await import('node:events');
  const {createServer}=await import('node:http');
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  let providerCalls=0;
  const trap=createServer((req,res)=>{providerCalls++;res.writeHead(500);res.end();});
  trap.listen(0,'127.0.0.1');await once(trap,'listening');
  t.after(()=>new Promise(resolve=>trap.close(resolve)));
  const child=spawn(process.execPath,[new URL('../server.mjs',import.meta.url).pathname],{env:{
    PATH:process.env.PATH,NODE_ENV:'test',HOST:'127.0.0.1',PORT:String(port),
    EMAIL_FROM:'Test <sender@example.test>',CONTACT_TO:'owner@example.test',
    NEWSLETTER_SECRET:'synthetic-only-'.repeat(4),NEWSLETTER_CONSENT_HASH_SECRET:'synthetic-hmac-'.repeat(4),
    NEWSLETTER_RESEND_API_KEY:'synthetic',NEWSLETTER_INTAKE_PAUSED:'false',NEWSLETTER_CONSENT_TEST_MEMORY_STORE:'1',
    RESEND_API_BASE:'http://127.0.0.1:'+trap.address().port,RESEND_ENDPOINT:'http://127.0.0.1:'+trap.address().port+'/emails',
  },stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
  const exited=once(child,'exit');
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await exited;}});
  const base='http://127.0.0.1:'+port;
  let started=false;
  for(let n=0;n<100;n++){
    try{if((await fetch(base+'/health')).ok){started=true;break;}}catch{}
    if(child.exitCode!==null)break;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(started,true,'synthetic business server started');
  const ready=await fetch(base+'/newsletter/ready',{headers:{origin:'https://gracz.pl'}});
  assert.equal(ready.status,503);assert.equal((await ready.json()).ready,false);
  for(const path of ['subscribe','status-request','confirm','unsubscribe','status-check']){
    const response=await fetch(base+'/newsletter/'+path,{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json'},body:JSON.stringify({email:'private-synthetic@example.test',token:'n1.test',consent:true})});
    assert.equal(response.status,503);
  }
  assert.equal(providerCalls,0);
  assert.doesNotMatch(logs,/private-synthetic|n1\.test|synthetic-only/);
});

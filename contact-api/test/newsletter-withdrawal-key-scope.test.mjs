import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {randomBytes} from 'node:crypto';

// Production Resend returned 401 restricted_api_key because the withdrawal
// provider-off calls reused the send-only RESEND_API_KEY. Withdrawal now needs
// its own WITHDRAWAL_RESEND_API_KEY; without it the feature stays off while the
// rest of the API keeps serving. Keys below are random per run, never real.
const freePort=()=>new Promise((resolve,reject)=>{
  const s=net.createServer();
  s.once('error',reject);
  s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(e=>e?reject(e):resolve(port));});
});
const secret=()=>randomBytes(32).toString('base64url');

async function boot(t,extraEnv) {
  const providerPort=await freePort(),apiPort=await freePort();
  const authorizations=[];
  const provider=createServer((req,res)=>{
    authorizations.push(req.headers.authorization);
    req.resume();
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({id:'mock-1'}));
  });
  provider.listen(providerPort,'127.0.0.1');
  await once(provider,'listening');
  const sendOnlyKey='send-only-'+randomBytes(8).toString('hex');
  const child=spawn(process.execPath,['server.mjs'],{
    cwd:new URL('..',import.meta.url),
    env:{
      ...process.env,NODE_ENV:'test',PORT:String(apiPort),HOST:'127.0.0.1',
      RESEND_API_KEY:sendOnlyKey,
      RESEND_ENDPOINT:'http://127.0.0.1:'+providerPort+'/emails',
      EMAIL_FROM:'Gracz.pl <kontakt@gracz.pl>',CONTACT_TO:'admin@gracz.pl',
      CONTACT_REPLY_SECRET:'test-'+'x'.repeat(40),
      PREMIUM_REPLY_TEST_MEMORY_STORE:'1',CONTACT_IDEMPOTENCY_TEST_MEMORY_STORE:'1',
      NEWSLETTER_WITHDRAWAL_ENABLED:'1',
      WITHDRAWAL_RECIPIENT_TAG_KEY:secret(),WITHDRAWAL_CHALLENGE_KEY:secret(),
      WITHDRAWAL_ENCRYPTION_KEY:secret(),
      ...extraEnv
    },
    stdio:['ignore','pipe','pipe']
  });
  let logs='';
  child.stdout.on('data',c=>logs+=c);child.stderr.on('data',c=>logs+=c);
  t.after(async()=>{
    child.kill('SIGTERM');
    await Promise.race([once(child,'exit'),new Promise(r=>setTimeout(r,1000))]);
    await new Promise(r=>provider.close(r));
  });
  const base='http://127.0.0.1:'+apiPort;
  const deadline=Date.now()+5000;
  for(;;) {
    assert.equal(child.exitCode,null,'server exited during startup: '+logs);
    try{if((await fetch(base+'/health')).ok)break;}catch{}
    assert.ok(Date.now()<deadline,'server did not start: '+logs);
    await new Promise(r=>setTimeout(r,50));
  }
  return {base,logs:()=>logs,authorizations,sendOnlyKey};
}

test('missing WITHDRAWAL_RESEND_API_KEY disables withdrawal but contact API keeps serving',{timeout:30000},async t=>{
  const s=await boot(t,{});
  const ready=await fetch(s.base+'/newsletter/withdrawal-ready',{headers:{origin:'https://gracz.pl'}});
  assert.equal(ready.status,503);
  assert.equal((await ready.json()).ready,false);
  const attempt=await fetch(s.base+'/newsletter/withdrawal-request',{
    method:'POST',
    headers:{origin:'https://gracz.pl','content-type':'application/json'},
    body:JSON.stringify({email:'someone@example.test'})
  });
  assert.equal(attempt.status,503);
  assert.equal(s.authorizations.length,0,'no provider call may happen while disabled');
  // The rest of the API is unaffected and still sends with the send-only key.
  const idempotency='withdrawal-scope-0001';
  const contact=await fetch(s.base+'/contact',{
    method:'POST',
    headers:{origin:'https://gracz.pl','content-type':'application/json',
      'x-idempotency-key':idempotency,'x-forwarded-for':'198.51.100.77'},
    body:JSON.stringify({
      name:'Jan Kowalski',email:'jan@example.test',category:'Pytanie ogólne',
      subject:'Test formularza',message:'To jest poprawna wiadomość testowa formularza gracz.pl.',
      website:'',acknowledgement:true,page:'https://gracz.pl/',startedAt:Date.now()-5000
    })
  });
  assert.equal(contact.status,200,s.logs());
  assert.deepEqual(s.authorizations,['Bearer '+s.sendOnlyKey]);
  assert.match(s.logs(),/WITHDRAWAL_RESEND_API_KEY_MISSING/);
  assert.ok(!s.logs().includes(s.sendOnlyKey),'key material must never be logged');
});

test('configured WITHDRAWAL_RESEND_API_KEY enables the wiring without logging the key',{timeout:30000},async t=>{
  const withdrawalKey='withdrawal-'+randomBytes(8).toString('hex');
  const s=await boot(t,{WITHDRAWAL_RESEND_API_KEY:withdrawalKey});
  assert.doesNotMatch(s.logs(),/WITHDRAWAL_DISABLED|WITHDRAWAL_RESEND_API_KEY_MISSING/);
  assert.ok(!s.logs().includes(withdrawalKey));
  assert.ok(!s.logs().includes(s.sendOnlyKey));
  // No database in this fixture, so readiness stays closed; nothing was sent.
  const ready=await fetch(s.base+'/newsletter/withdrawal-ready',{headers:{origin:'https://gracz.pl'}});
  assert.equal(ready.status,503);
  assert.equal(s.authorizations.length,0);
});

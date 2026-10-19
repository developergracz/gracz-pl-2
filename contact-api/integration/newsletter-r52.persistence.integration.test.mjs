import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,connect} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {applyMigrations} from '../persistence/migrator.mjs';
import {applyNewsletterCandidate} from './newsletter-candidate.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createProvider,getFreePort} from '../test-support/newsletter-provider.mjs';
const url=process.env.DATABASE_URL;
const delay=ms=>new Promise(r=>setTimeout(r,ms));

// Actual PG terminates its own backend. Deliver ReadyForQuery and the resulting
// FATAL together: pg parses the error before the pool.connect await continuation.
async function checkoutFaultProxy(admin) {
  const target=new URL(url),sockets=new Set();let enabled=true,kills=0;
  const server=createServer(down=>{
    const up=connect({host:target.hostname,port:Number(target.port||5432)});
    sockets.add(down);sockets.add(up);
    let pending=Buffer.alloc(0),pid,firstReady=true,held=null;
    down.on('data',chunk=>up.write(chunk));
    up.on('data',chunk=>{
      pending=Buffer.concat([pending,chunk]);
      while(pending.length>=5){
        const length=pending.readInt32BE(1)+1;if(pending.length<length)return;
        const frame=pending.subarray(0,length);pending=pending.subarray(length);
        if(frame[0]===75)pid=frame.readInt32BE(5);
        if(frame[0]===90&&firstReady){
          firstReady=false;
          if(enabled){
            held=frame;
            admin.query('SELECT pg_terminate_backend($1)',[pid]).then(r=>{if(r.rows[0].pg_terminate_backend)kills++;}).catch(()=>down.destroy());
            continue;
          }
        }
        if(held){down.write(Buffer.concat([held,frame]));held=null;}else down.write(frame);
      }
    });
    up.on('end',()=>down.end());
    down.on('error',()=>up.destroy());up.on('error',()=>down.destroy());
    down.on('close',()=>{sockets.delete(down);up.destroy();});up.on('close',()=>sockets.delete(up));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const proxyUrl=new URL(url);proxyUrl.port=String(server.address().port);proxyUrl.searchParams.set('sslmode','disable');
  return {url:String(proxyUrl),get kills(){return kills;},recover(){enabled=false;},async close(){for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));}};
}

test('R5.2 legacy API characterization survives PostgreSQL checkout FATAL before await resumes', {skip:!url,timeout:30000},async t=>{
  assertDisposableDatabaseUrl(url);const admin=createDatabase({connectionString:url});t.after(()=>admin.close());
  await applyMigrations(admin);await applyNewsletterCandidate(admin,url);
  const proxy=await checkoutFaultProxy(admin);t.after(()=>proxy.close());
  const provider=await createProvider(t),port=await getFreePort(),base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['test-support/legacy-newsletter-server.mjs'],{cwd:new URL('..',import.meta.url),stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,NODE_ENV:'test',DATABASE_URL:proxy.url,PORT:String(port),HOST:'127.0.0.1',
    NEWSLETTER_INTAKE_PAUSED:'false',NEWSLETTER_SECRET:'test-'+'n'.repeat(40),NEWSLETTER_CONSENT_HASH_SECRET:'test-consent-'+'h'.repeat(40),CONTACT_REPLY_SECRET:'test-'+'r'.repeat(40),CONTACT_DATA_ENCRYPTION_SECRET:'test-'+'c'.repeat(40),
    RESEND_API_KEY:'test-key',NEWSLETTER_RESEND_API_KEY:'test-key',RESEND_API_BASE:provider.base,RESEND_ENDPOINT:provider.base+'/emails',EMAIL_FROM:'sender@example.test',CONTACT_TO:'owner@example.test'}});
  let stderr='';child.stderr.on('data',c=>stderr+=c);child.stdout.resume();
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){const exit=once(child,'exit');child.kill('SIGKILL');await exit;}});
  for(let i=0;i<200;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await delay(20);}
  for(let i=0;i<3;i++){
    const responses=await Promise.allSettled([
      fetch(base+'/newsletter/ready'),
      fetch(base+'/newsletter/subscribe',{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json'},body:JSON.stringify({email:'checkout-'+i+'@example.test',consent:true,startedAt:Date.now()-5000})})
    ]);
    await delay(30);
    assert.equal(child.exitCode,null,'API must survive checkout fault: '+stderr);
    assert.ok(responses.every(r=>r.status==='fulfilled'&&r.value.status===503));
    assert.equal((await fetch(base+'/health')).status,200);
  }
  assert.ok(proxy.kills>=3);assert.equal(provider.emails.length,0);
  assert.ok(!/Unhandled|uncaught|MaxListenersExceeded/.test(stderr));
  proxy.recover();assert.equal((await fetch(base+'/newsletter/ready')).status,200);
  assert.ok(!/postgres:\/\/|checkout-\d+@|SELECT |test-key/.test(stderr),'diagnostics contain no request or connection contents');
  const recovered=await fetch(base+'/newsletter/subscribe',{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json'},body:JSON.stringify({email:randomUUID()+'@example.test',consent:true,startedAt:Date.now()-5000})});
  assert.equal(recovered.status,200);assert.equal((await recovered.json()).state,'request_received');
  for(let i=0;i<200&&provider.emails.length===0;i++)await delay(20);
  assert.equal(provider.emails.length,1,'recovered API can send through the local provider fixture');
});

test('R5.2 300 actual backend terminations during checkout; listener and pool recovery', {skip:!url,timeout:120000},async t=>{
  assertDisposableDatabaseUrl(url);const admin=createDatabase({connectionString:url});t.after(()=>admin.close());
  const proxy=await checkoutFaultProxy(admin);t.after(()=>proxy.close());
  const {Pool}=await import('pg');let pool,clients=0;const removed=[];
  class ObservedPool extends Pool {
    constructor(options){super(options);pool=this;this.on('connect',()=>clients++);this.on('remove',client=>removed.push(client));}
  }
  const db=createDatabase({connectionString:proxy.url,poolFactory:ObservedPool,poolOptions:{max:1},logger:{error(){}}});t.after(()=>db.close());
  for(let i=0;i<300;i++){
    const work=i%2?db.transaction(client=>client.query('SELECT 1')):db.queryBounded('SELECT 1');
    await assert.rejects(work);
    assert.ok(pool.totalCount<=1);assert.equal(pool.waitingCount,0);
  }
  assert.equal(proxy.kills,300);assert.equal(clients,300);
  proxy.recover();
  for(let i=0;i<30;i++)assert.equal((await db.queryBounded('SELECT 1 AS ok')).rows[0].ok,1);
  assert.equal(clients,301,'healthy client reused');assert.equal(pool.idleCount,1);
  const healthy=await pool.connect();assert.equal(healthy.listenerCount('error'),1,'one permanent defensive listener');healthy.release();
  await db.close();assert.equal(pool.totalCount,0);assert.equal(pool.waitingCount,0);
  assert.ok(removed.every(client=>client.listenerCount('error')<=2),'no per-checkout listener accumulation');
});

test('R5.2 bounded queries enforce read-only and recover after SQLSTATE 25006', {skip:!url},async t=>{
  assertDisposableDatabaseUrl(url);const db=createDatabase({connectionString:url,poolOptions:{max:1}});t.after(()=>db.close());
  await assert.rejects(db.queryBounded('CREATE TABLE r52_forbidden_write(id integer)'),e=>e.code==='25006');
  assert.equal((await db.queryBounded('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'off');
});

test('R5.2 actual backend termination in transaction rejects and rolls back', {skip:!url,timeout:10000},async t=>{
  assertDisposableDatabaseUrl(url);
  const admin=createDatabase({connectionString:url}),db=createDatabase({connectionString:url,logger:{error(){}}});
  t.after(()=>admin.close());t.after(()=>db.close());
  await admin.query('CREATE TABLE r52_rollback_fixture(id integer)');
  try {
    await assert.rejects(db.transaction(async client=>{
      await client.query('INSERT INTO r52_rollback_fixture VALUES(1)');
      const {rows}=await client.query('SELECT pg_backend_pid() AS pid');
      await admin.query('SELECT pg_terminate_backend($1)',[rows[0].pid]);
      await client.query('SELECT pg_sleep(1)');
    }));
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM r52_rollback_fixture')).rows[0].count,0);
    assert.equal(await db.transaction(async client=>(await client.query('SELECT 42 AS ok')).rows[0].ok),42);
  } finally {await admin.query('DROP TABLE r52_rollback_fixture');}
});

import {createServer as createTcpServer,connect} from 'node:net';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,randomBytes} from 'node:crypto';
import {createDatabase} from '../persistence/database.mjs';
import {createPersistenceRepositories} from '../persistence/repositories.mjs';
import {createNewsletterProofStore} from '../persistence/newsletter-proof-store.mjs';
import {applyMigrations} from '../persistence/migrator.mjs';
import {applyNewsletterCandidate} from './newsletter-candidate.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createProvider,createManager,consentEmailHash} from '../test-support/newsletter-provider.mjs';
const url=process.env.DATABASE_URL, hash=()=>randomBytes(32).toString('hex');
async function until(predicate){for(let i=0;i<200;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,25));}throw new Error('condition timeout');}
function startWorker(provider,email,applicationName='r5-worker') {
  const childUrl=new URL(url);childUrl.searchParams.set('application_name',applicationName);
  const child=spawn(process.execPath,['--input-type=module','-e',`
    import {createDatabase} from './persistence/database.mjs';
    import {createPersistenceRepositories} from './persistence/repositories.mjs';
    import {createNewsletterProofStore} from './persistence/newsletter-proof-store.mjs';
    import {createManager} from './test-support/newsletter-provider.mjs';
    const db=createDatabase();
    try {
      const m=createManager({base:process.argv[1],consentStore:createPersistenceRepositories(db).newsletter},{proofStore:createNewsletterProofStore(db),logger:{error(){}}});
      await m.acceptOptIn({email:process.argv[2]});await m.waitForPublicWork();
    }finally{await db.close();}
  `,provider.base,email],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,NODE_ENV:'test',DATABASE_URL:String(childUrl)},stdio:['ignore','ignore','pipe']});
  let errors='';child.stderr.on('data',data=>errors+=data);
  const completed=once(child,'exit').then(([code,signal])=>({code,signal,errors}));return {child,completed};
}
test('R5 atomic marker rollback, process crash and concurrent recovery', {skip:!url},async t=>{
  assertDisposableDatabaseUrl(url);const db=createDatabase({connectionString:url});t.after(()=>db.close());
  await applyMigrations(db);await applyNewsletterCandidate(db,url);
  const provider=await createProvider(t);provider.consentStore=createPersistenceRepositories(db).newsletter;
  const m=createManager(provider,{proofStore:createNewsletterProofStore(db),logger:{error(){}}});
  await t.test('lost transaction commit acknowledgement never releases either effect marker',async()=>{
    const email=randomUUID()+'@example.test',emailHash=consentEmailHash(email),before=provider.emails.length;
    // Drop the real PostgreSQL COMMIT response, after the server executed it.
    // Only the transaction containing the B1 effect UPDATE is targeted.
    const target=new URL(url),sockets=new Set();let dropped=false;
    const proxy=createTcpServer(down=>{
      const up=connect({host:target.hostname,port:Number(target.port||5432)});
      sockets.add(down);sockets.add(up);let marked=false,pending=Buffer.alloc(0),frontendTail=Buffer.alloc(0);
      down.on('data',chunk=>{
        frontendTail=Buffer.concat([frontendTail,chunk]).subarray(-4096);
        if(frontendTail.includes(Buffer.from("UPDATE newsletter_opt_in_requests SET state = 'inflight'")))marked=true;
        up.write(chunk);
      });
      up.on('data',chunk=>{
        if(!marked||dropped){down.write(chunk);return;}
        pending=Buffer.concat([pending,chunk]);
        // Server protocol messages: byte type, int32 length, payload. Buffer
        // fragmented frames so the test does not depend on TCP packet layout.
        while(pending.length>=5){
          const length=pending.readInt32BE(1)+1;if(pending.length<length)return;
          const frame=pending.subarray(0,length);pending=pending.subarray(length);
          if(frame[0]===67 && frame.subarray(5).toString()==='COMMIT\0'){
            dropped=true;down.destroy();up.destroy();return;
          }
          down.write(frame);
        }
      });
      down.on('error',()=>up.destroy());up.on('error',()=>down.destroy());
      down.on('close',()=>{sockets.delete(down);up.destroy();});up.on('close',()=>{sockets.delete(up);down.destroy();});
    });
    proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
    const proxyUrl=new URL(url);proxyUrl.port=String(proxy.address().port);proxyUrl.searchParams.set('sslmode','disable');
    const faultDb=createDatabase({connectionString:String(proxyUrl)});
    t.after(async()=>{await faultDb.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>proxy.close(resolve));});
    const fault=createManager(provider,{consentStore:createPersistenceRepositories(faultDb).newsletter,proofStore:createNewsletterProofStore(db),logger:{error(){}}});
    await fault.acceptOptIn({email});await fault.waitForPublicWork();
    assert.equal(dropped,true,'actual COMMIT response was discarded');
    assert.equal(provider.emails.length,before);
    assert.equal((await db.query('SELECT state FROM newsletter_opt_in_requests WHERE email_hash=$1',[emailHash])).rows[0].state,'unknown');
    assert.equal((await db.query("SELECT response_body->>'phase' AS phase FROM idempotency_keys WHERE scope='newsletter-public-optin' AND key_hash=$1",[emailHash])).rows[0].phase,'external_effect');
    const result=await startWorker(provider,email).completed;assert.equal(result.code,0);assert.equal(provider.emails.length,before);
  });
  for(const mode of ['exception','process-crash'])await t.test(mode+' exactly between public and B1 markers',async()=>{
    const email=randomUUID()+'@example.test',emailHash=consentEmailHash(email),before=provider.emails.length;
    await db.query(`CREATE FUNCTION r5_marker_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.email_hash='${emailHash}' AND NEW.state='inflight' THEN
        ${mode==='exception'?"RAISE EXCEPTION 'synthetic between-marker failure';":"PERFORM pg_sleep(30);"}
      END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER r5_marker_fault BEFORE UPDATE ON newsletter_opt_in_requests FOR EACH ROW EXECUTE FUNCTION r5_marker_fault()');
    let worker;
    try {
      if(mode==='exception') {
        await m.acceptOptIn({email});await m.waitForPublicWork();
        assert.equal((await db.query('SELECT 1 FROM newsletter_opt_in_requests WHERE email_hash=$1',[emailHash])).rowCount,0);
        assert.equal((await db.query("SELECT 1 FROM idempotency_keys WHERE scope='newsletter-public-optin' AND key_hash=$1",[emailHash])).rowCount,0);
      } else {
        worker=startWorker(provider,email,'r5-between-markers');let pid;
        await until(async()=>{pid=(await db.query("SELECT pid FROM pg_stat_activity WHERE application_name='r5-between-markers' AND wait_event='PgSleep'")).rows[0]?.pid;return Boolean(pid);});
        worker.child.kill('SIGKILL');await worker.completed;
        await db.query('SELECT pg_terminate_backend($1)',[pid]);
        await until(async()=>!(await db.query('SELECT 1 FROM pg_stat_activity WHERE pid=$1',[pid])).rowCount);
        assert.equal((await db.query("SELECT response_body->>'phase' AS phase FROM idempotency_keys WHERE scope='newsletter-public-optin' AND key_hash=$1",[emailHash])).rows[0].phase,'pre_effect');
        assert.equal((await db.query('SELECT state FROM newsletter_opt_in_requests WHERE email_hash=$1',[emailHash])).rows[0].state,'pre_send');
        // Advance only synthetic lease timestamps; real production waits 60s.
        await db.query("UPDATE idempotency_keys SET updated_at=now()-interval '2 minutes' WHERE scope='newsletter-public-optin' AND key_hash=$1",[emailHash]);
        await db.query("UPDATE newsletter_opt_in_requests SET issued_at=now()-interval '2 minutes' WHERE email_hash=$1",[emailHash]);
      }
      assert.equal(provider.emails.length,before);
    } finally {
      if(worker&&worker.child.exitCode===null&&worker.child.signalCode===null){worker.child.kill('SIGKILL');await worker.completed;}
      await db.query('DROP TRIGGER r5_marker_fault ON newsletter_opt_in_requests');await db.query('DROP FUNCTION r5_marker_fault()');
    }
    const outcomes=await Promise.all(Array.from({length:6},()=>startWorker(provider,email).completed));
    assert.ok(outcomes.every(result=>result.code===0),JSON.stringify(outcomes));assert.equal(provider.emails.length,before+1);
    assert.equal((await db.query('SELECT state FROM newsletter_opt_in_requests WHERE email_hash=$1',[emailHash])).rows[0].state,'sent');
    assert.equal((await provider.consentStore.listConsentEvents(emailHash)).length,2,'immutable failed-attempt evidence retained');
  });
});

test('R5 schema constraints, coalesced readiness and fenced offline import', {skip:!url},async t=>{
  assertDisposableDatabaseUrl(url);const db=createDatabase({connectionString:url});t.after(()=>db.close());await applyMigrations(db);await applyNewsletterCandidate(db,url);
  await db.transaction(async client=>{
    await client.query('CREATE SCHEMA r5_fixture');
    for(const table of ['newsletter_contacts','newsletter_consent_events','newsletter_opt_in_requests','idempotency_keys'])await client.query(`CREATE TABLE r5_fixture.${table} (LIKE public.${table} INCLUDING ALL)`);
    await client.query('SET LOCAL search_path TO r5_fixture');
    let queries=0;const scoped={enabled:true,query:(...args)=>{queries++;return client.query(...args);},transaction:work=>work(client)};
    const store=createPersistenceRepositories(scoped).newsletter;
    await Promise.all(Array.from({length:20},()=>store.checkOptInAvailable()));assert.equal(queries,1);
    const pk=(await client.query("SELECT conname FROM pg_constraint WHERE conrelid='newsletter_opt_in_requests'::regclass AND contype='p'")).rows[0].conname;
    await client.query(`ALTER TABLE newsletter_opt_in_requests DROP CONSTRAINT ${pk}`);await assert.rejects(()=>store.checkOptInAvailable(),/constraint/);
    await client.query('ALTER TABLE newsletter_opt_in_requests ADD PRIMARY KEY(email_hash)');assert.equal(await store.checkOptInAvailable(),true);
    await client.query('ALTER TABLE newsletter_opt_in_requests ALTER COLUMN request_id DROP NOT NULL');await assert.rejects(()=>store.checkOptInAvailable(),/column/);
    await client.query('ALTER TABLE newsletter_opt_in_requests ALTER COLUMN request_id SET NOT NULL');
    const unique=(await client.query("SELECT conname FROM pg_constraint WHERE conrelid='newsletter_opt_in_requests'::regclass AND contype='u'")).rows[0].conname;
    await client.query(`ALTER TABLE newsletter_opt_in_requests DROP CONSTRAINT ${unique}`);await assert.rejects(()=>store.checkOptInAvailable(),/constraint/);
    await client.query('ALTER TABLE newsletter_opt_in_requests ADD UNIQUE(request_id)');
    const check=(await client.query("SELECT conname FROM pg_constraint WHERE conrelid='newsletter_opt_in_requests'::regclass AND pg_get_constraintdef(oid) LIKE '%expires_at > issued_at%'")).rows[0].conname;
    await client.query(`ALTER TABLE newsletter_opt_in_requests DROP CONSTRAINT ${check}`);
    await client.query('ALTER TABLE newsletter_opt_in_requests ADD CHECK(expires_at>issued_at OR true)');await assert.rejects(()=>store.checkOptInAvailable(),/constraint/);
    await client.query('ALTER TABLE newsletter_opt_in_requests ADD CHECK(expires_at>issued_at)');assert.equal(await store.checkOptInAvailable(),true);
    const subject=hash(),released=hash();for(const emailHash of [subject,released])await store.ensureContact({emailHash});
    const occurredAt=new Date(Date.now()-1000),cutoverBefore=new Date();
    await store.appendConsentEvent({emailHash:subject,eventId:randomUUID(),eventType:'opt_in_requested',source:'legacy',occurredAt});
    await store.appendConsentEvent({emailHash:released,eventId:randomUUID(),eventType:'opt_in_requested',source:'r5',occurredAt,metadata:{intakeVersion:'R5'}});
    await assert.rejects(()=>store.importHistoricalOptIns(),/cutover/);
    await assert.rejects(()=>store.importHistoricalOptIns({cutoverBefore,writersStopped:true}),/sealed/);
    await client.query("INSERT INTO idempotency_keys(scope,key_hash,fingerprint,state,response_status,response_body,expires_at) VALUES('newsletter-cutover',repeat('0',64),repeat('0',64),'done',200,jsonb_build_object('importNotAfter',$1::timestamptz),'infinity')",[cutoverBefore]);
    await assert.rejects(()=>store.importHistoricalOptIns({cutoverBefore:new Date(cutoverBefore.getTime()+1),writersStopped:true}),/cutover|sealed/);
    assert.equal(await store.importHistoricalOptIns({cutoverBefore,writersStopped:true}),1);
    assert.equal(await store.importHistoricalOptIns({cutoverBefore,writersStopped:true}),0);
    const claim={emailHash:released,requestId:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+600000),supersededBefore:new Date(0)};
    assert.equal((await store.claimOptInRequest(claim)).claimed,true);assert.equal(await store.releaseOptInBeforeSend(claim),true);
    await assert.rejects(()=>store.importHistoricalOptIns({cutoverBefore,writersStopped:true}),/writer start/);
    assert.equal((await client.query('SELECT 1 FROM newsletter_opt_in_requests WHERE email_hash=$1',[released])).rowCount,0,'released R5 event never becomes legacy_pending');
    await client.query('DROP SCHEMA r5_fixture CASCADE');
  });
});

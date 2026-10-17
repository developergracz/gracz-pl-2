import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createDatabase } from "../persistence/database.mjs";
import { createPersistenceRepositories } from "../persistence/repositories.mjs";
import { applyMigrations } from "../persistence/migrator.mjs";
import { applyNewsletterCandidate } from './newsletter-candidate.mjs';
import { assertDisposableDatabaseUrl } from "./test-database-guard.mjs";
import { createProvider, createManager, extractToken, consentEmailHash, getFreePort } from "../test-support/newsletter-provider.mjs";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();
function childRequest(base, email) {
  const source = `
    import {createDatabase} from './persistence/database.mjs';
    import {createPersistenceRepositories} from './persistence/repositories.mjs';
    import {createManager} from './test-support/newsletter-provider.mjs';
    const db = createDatabase();
    try { console.log(JSON.stringify(await createManager({base:process.argv[1],consentStore:createPersistenceRepositories(db).newsletter}).requestOptIn({email:process.argv[2]}))); }
    catch(e) { console.log(JSON.stringify({code:e.code})); }
    finally { await db.close(); }
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', source, base, email], {
      cwd: new URL('..', import.meta.url),
      env: { PATH:process.env.PATH, NODE_ENV:'test', DATABASE_URL },
      stdio:['ignore','pipe','pipe'],
    });
    let out = '', err = '';
    child.stdout.on('data', chunk => {out += chunk;});
    child.stderr.on('data', chunk => {err += chunk;});
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(err)));
  });
}

test("B1 real PostgreSQL durable DOI reservations", {skip:!DATABASE_URL}, async (t) => {
  assertDisposableDatabaseUrl(DATABASE_URL);
  const database = createDatabase({connectionString:DATABASE_URL});
  t.after(() => database.close());
  await applyMigrations(database);
  await applyNewsletterCandidate(database, DATABASE_URL);
  await database.query('TRUNCATE newsletter_opt_in_requests');
  const store = createPersistenceRepositories(database).newsletter;

  await t.test("atomic reservation across repository instances and stale completion fencing", async () => {
    const claim = {emailHash:'a'.repeat(64),requestId:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+60000),supersededBefore:new Date(0)};
    const results = await Promise.all(Array.from({length:12}, () => createPersistenceRepositories(database).newsletter.claimOptInRequest({...claim,requestId:randomUUID()})));
    assert.equal(results.filter(r => r.claimed).length, 1);
    assert.equal(await store.markOptInSent({emailHash:claim.emailHash,requestId:randomUUID()}), false);
  });

  await t.test("expired uncertain request is not recycled after restart or opt-out", async () => {
    const emailHash = 'b'.repeat(64);
    const requestId=randomUUID();
    await store.claimOptInRequest({emailHash,requestId,issuedAt:new Date(0),expiresAt:new Date(1),supersededBefore:new Date(0)});
    await store.markOptInSending({emailHash,requestId});
    const restarted = createPersistenceRepositories(database).newsletter;
    const result = await restarted.claimOptInRequest({emailHash,requestId:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+60000),supersededBefore:new Date()});
    assert.deepEqual(result, {claimed:false,state:'inflight',inProgress:false});
  });

  await t.test("sent expiry permits one replacement and rejects old completion", async () => {
    const emailHash = 'c'.repeat(64), requestId = randomUUID();
    await store.claimOptInRequest({emailHash,requestId,issuedAt:new Date(0),expiresAt:new Date(1),supersededBefore:new Date(0)});
    assert.equal(await store.markOptInSending({emailHash,requestId}), true);
    assert.equal(await store.markOptInSent({emailHash,requestId}), true);
    const replacements = await Promise.all(Array.from({length:8}, () => store.claimOptInRequest({emailHash,requestId:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+60000),supersededBefore:new Date(0)})));
    assert.equal(replacements.filter(r => r.claimed).length, 1);
    assert.equal(await store.markOptInSent({emailHash,requestId}), false);
  });

  await t.test("independent processes and process restart send exactly one DOI", async () => {
    const provider = await createProvider(t);
    const email = 'b1-process-' + randomUUID() + '@example.test';
    const results = await Promise.all(Array.from({length:6}, () => childRequest(provider.base,email)));
    assert.ok(results.every(r => r.state === 'request_received'));
    assert.equal(provider.emails.length, 1);
    assert.deepEqual(await childRequest(provider.base,email), {state:'request_received'});
    assert.equal(provider.emails.length, 1);
    assert.equal((await store.listConsentEvents(consentEmailHash(email))).length, 1);
  });

  await t.test("actual ledger supports active dedup and fresh DOI after unsubscribe", async () => {
    const provider = await createProvider(t);
    provider.consentStore = store;
    const manager = createManager(provider);
    const email = 'b1-lifecycle-' + randomUUID() + '@example.test';
    await manager.requestOptIn({email});
    const token = extractToken(provider.emails[0],'confirm');
    await manager.confirm(token);
    for (let n=0;n<5;n++) await childRequest(provider.base,email);
    assert.equal(provider.emails.length,2);
    await manager.unsubscribe(extractToken(provider.emails[1],'unsubscribe'));
    await childRequest(provider.base,email);
    assert.equal(provider.emails.length,3);
    assert.equal((await store.getContact(consentEmailHash(email))).current_state,'unsubscribed');
    await assert.rejects(() => manager.confirm(token), {code:'NEWSLETTER_CONFIRMATION_STALE'});
    await manager.confirm(extractToken(provider.emails[2],'confirm'));
    assert.equal(provider.emails.length,4);
  });
  await t.test("cutover preserves legacy pending window without fabricating sent or consent", async () => {
    const sql = await readFile(new URL('../persistence/candidates/005_newsletter_opt_in_requests.sql',import.meta.url),'utf8');
    await database.transaction(async client => {
      await client.query('CREATE SCHEMA b1_cutover_fixture');
      await client.query('SET LOCAL search_path TO b1_cutover_fixture');
      await client.query('CREATE TABLE idempotency_keys (LIKE public.idempotency_keys INCLUDING ALL)');
      await client.query('CREATE TABLE newsletter_consent_events (email_hash char(64), event_id uuid, event_type text, occurred_at timestamptz)');
      await client.query("INSERT INTO newsletter_consent_events VALUES ($1,$2,'opt_in_requested',now()),($1,$3,'opt_in_requested',now()-interval '1 day'),($4,$5,'opt_in_requested',now()-interval '31 days')", ['d'.repeat(64),randomUUID(),randomUUID(),'e'.repeat(64),randomUUID()]);
      await client.query(sql);
      const result = await client.query('SELECT state,sent_at FROM newsletter_opt_in_requests');
      assert.deepEqual(result.rows,[],'candidate installation never performs an unfenced history import');
      assert.equal((await client.query('SELECT * FROM newsletter_consent_events')).rowCount,3);
      await client.query('DROP SCHEMA b1_cutover_fixture CASCADE');
    });
  });

  await t.test("confirmed 422 retains reservation and audit history across process restart", async () => {
    const provider = await createProvider(t);
    provider.consentStore = store;
    provider.behavior.rejectConfirmationBeforeAccept422 = true;
    const email = 'r2-422-' + randomUUID() + '@example.test';
    await assert.rejects(() => createManager(provider,{logger:{error(){}}}).requestOptIn({email}), {code:'NEWSLETTER_MAIL_FAILED'});
    const emailHash=consentEmailHash(email);
    const before=await store.inspectOptInRequest(emailHash);
    const events=await store.listConsentEvents(emailHash);
    assert.equal(before.state,'unknown');
    assert.equal(before.sentAt,null);
    assert.equal(events.length,1);
    assert.equal(provider.emails.length,0);
    assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1);
    provider.behavior.rejectConfirmationBeforeAccept422 = false;
    const results=await Promise.all(Array.from({length:4},()=>childRequest(provider.base,email)));
    assert.ok(results.every(r=>r.code==='NEWSLETTER_REQUEST_UNCERTAIN'));
    assert.deepEqual(await store.inspectOptInRequest(emailHash),before,'inspection/restart cannot mutate the reservation');
    assert.deepEqual(await store.listConsentEvents(emailHash),events,'append-only evidence is preserved');
    assert.equal(provider.requests.filter(r=>r.path==='/emails').length,1);
  });

  await t.test("accepted message with lost acknowledgement stays blocked across process restart", async () => {
    const provider = await createProvider(t);
    provider.consentStore = store;
    const email = 'b1-unknown-' + randomUUID() + '@example.test';
    provider.behavior.confirmResponse = 503;
    await assert.rejects(() => createManager(provider).requestOptIn({email}), {code:'NEWSLETTER_MAIL_FAILED'});
    provider.behavior.confirmResponse = null;
    assert.deepEqual(await childRequest(provider.base,email), {code:'NEWSLETTER_REQUEST_UNCERTAIN'});
    assert.equal(provider.emails.length,1);
    assert.equal((await store.listConsentEvents(consentEmailHash(email))).length,1);
  });

  await t.test("HTTP API restart preserves dedup and neutral new/pending/active responses", async () => {
    const provider = await createProvider(t);
    const port = await getFreePort();
    let child;
    const stop = async () => {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(child,'exit');
        child.kill('SIGTERM');
        await exited;
      }
      child = null;
    };
    t.after(stop);
    const start = async () => {
      child = spawn(process.execPath,['server.mjs'], {
        cwd:new URL('..',import.meta.url), stdio:['ignore','ignore','pipe'],
        env:{PATH:process.env.PATH,NODE_ENV:'test',DATABASE_URL,HOST:'127.0.0.1',PORT:String(port),
          RESEND_API_KEY:'test-key',NEWSLETTER_RESEND_API_KEY:'test-key',RESEND_API_BASE:provider.base,
          RESEND_ENDPOINT:provider.base+'/emails',EMAIL_FROM:'sender@example.test',CONTACT_TO:'owner@example.test',
          CONTACT_REPLY_SECRET:'test-'+'r'.repeat(40),CONTACT_DATA_ENCRYPTION_SECRET:'test-'+'c'.repeat(40),
          NEWSLETTER_INTAKE_PAUSED:'false',NEWSLETTER_SECRET:'test-'+'n'.repeat(40),NEWSLETTER_CONSENT_HASH_SECRET:'test-consent-'+'h'.repeat(40)},
      });
      let error = '';
      child.stderr.on('data', data => {error += data;});
      for(let n=0;n<100;n++) {
        if(child.exitCode !== null) throw new Error(error || 'API exited');
        try {if((await fetch('http://127.0.0.1:'+port+'/health')).ok) return;} catch {}
        await new Promise(resolve => setTimeout(resolve,50));
      }
      throw new Error('API startup timeout');
    };
    const email = 'b1-http-' + randomUUID() + '@example.test';
    const post = async (path,body) => {
      const response = await fetch('http://127.0.0.1:'+port+path,{method:'POST',headers:{origin:'https://gracz.pl','content-type':'application/json'},body:JSON.stringify(body)});
      assert.equal(response.headers.get('cache-control'),'no-store');
      return {status:response.status,body:await response.json()};
    };
    await start();
    const request = {email,consent:true,startedAt:Date.now()-5000};
    const expected = {status:200,body:{ok:true,state:'request_received'}};
    assert.deepEqual(await post('/newsletter/subscribe',request),expected);
    // Admission is asynchronous: wait for durable completion before restarting.
    for(let n=0;n<100;n++) {
      const row=await database.query("SELECT state FROM idempotency_keys WHERE scope='newsletter-public-optin' AND key_hash=$1",[consentEmailHash(email)]);
      if(row.rows[0]?.state==='done')break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.equal(provider.emails.length,1);
    await stop();
    await start();
    assert.deepEqual(await post('/newsletter/subscribe',request),expected);
    assert.equal(provider.emails.length,1);
    assert.equal((await post('/newsletter/confirm',{token:extractToken(provider.emails[0],'confirm')})).status,200);
    assert.deepEqual(await post('/newsletter/subscribe',request),expected);
    assert.equal(provider.emails.length,2);
    assert.deepEqual(await post('/newsletter/status-request',{email,startedAt:Date.now()-5000}),expected);
    for(let n=0;n<100 && provider.emails.length<3;n++)await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(provider.emails.length,3);
    const statusToken=provider.emails[2].body.text.match(/#status=([^\s]+)/)[1];
    await stop();
    await start();
    assert.deepEqual(await post('/newsletter/status-check',{token:statusToken}),{status:200,body:{ok:true,state:'active'}});
    assert.equal((await post('/newsletter/status-check',{token:statusToken})).status,400);
    assert.equal((await post('/newsletter/confirm',{token:statusToken})).status,400);
    assert.equal(provider.emails.length,3,'proof and replay do not send another welcome or DOI');
    await stop();
  });

});

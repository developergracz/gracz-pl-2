import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {connect,createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {createDatabase} from '../persistence/database.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
import {createNewOnlyNewsletter} from '../new-only-newsletter.mjs';
import {createSelfServiceWithdrawal} from '../persistence/recovery/self-service-withdrawal.mjs';
import {createNewOnlyAdminReader} from '../admin-r1/new-only-reader.mjs';
import {createNewOnlySummary} from '../admin-r1/summary.mjs';
import {createNewOnlyTrendDetail} from '../admin-r1/trend-detail.mjs';
import {createCampaignAudienceProofCount} from '../campaigns/audience-proof-count.mjs';
import {createCampaignRecipientEvidenceReview} from '../campaigns/recipient-evidence-review.mjs';
import {
  countRepeatWithdrawalsWithoutMarker,inspectRepeatWithdrawal,repairRepeatWithdrawal
} from '../operations/repair-repeat-withdrawal-marker.mjs';
import {runOnPty} from '../test-support/pty-session.mjs';

const enc=Buffer.alloc(32,11),subject=Buffer.alloc(32,22);
const withdrawalTag=Buffer.alloc(32,33);
const subjectKey=subject.toString('base64url');
const tagOf=email=>createHmac('sha256',subject).update('gracz-new-only:email\n'+email).digest('hex');

// Verbatim pre-#354 recordVerifiedWithdrawal statements (e7bbd26): this is
// exactly how production stored a repeated verified opt-out before 005.
async function pre354Withdrawal({client,email,challengeId}){
  const tag=tagOf(email);
  const existing=await client.query(
    'SELECT email_tag FROM newsletter_new.subscribers WHERE email_tag=$1 FOR UPDATE',[tag]);
  if(!existing.rowCount)return;
  const recorded=await client.query(
    'INSERT INTO newsletter_new.revocations (email_tag,challenge_id) VALUES ($1,$2) '+
    'ON CONFLICT (email_tag) DO NOTHING',[tag,challengeId]);
  if(recorded.rowCount)return;
  await client.query(`
    UPDATE newsletter_new.subscribers
    SET state='pending',token_tag=$2,confirmed_at=NULL,expires_at=clock_timestamp()
    WHERE email_tag=$1 AND requested_at>(
      SELECT recorded_at FROM newsletter_new.revocations WHERE email_tag=$1)
  `,[tag,randomBytes(32).toString('hex')]);
}

async function fixture(t){
  const url=process.env.DATABASE_URL;
  assertDisposableDatabaseUrl(url);
  const database=createDatabase({connectionString:url,poolOptions:{max:3},logger:{error(){}}});
  const reset=async()=>{
    for(const name of ['newsletter_new','newsletter_recovery'])
      await database.query('DROP SCHEMA IF EXISTS '+name+' CASCADE');
  };
  t.after(async()=>{await reset();await database.close();});
  await reset();
  for(const path of ['persistence/new-only/001_new_only_doi.sql',
    'persistence/new-only/002_verified_withdrawal.sql',
    'persistence/new-only/005_repeat_withdrawal_state.sql',
    'persistence/recovery/001_withdrawal_queue.sql'])
    await database.query(await readFile(new URL('../'+path,import.meta.url),'utf8'));
  const mail=[];
  const manager=createNewOnlyNewsletter({database,enabled:true,
    encryptionKey:enc.toString('base64url'),subjectKey,
    apiKey:'synthetic',emailFrom:'newsletter@example.test',checkDeliveryAllowed:async()=>true,
    fetchFn:async(_url,options)=>{
      mail.push(JSON.parse(options.body).text);
      return {ok:true,json:async()=>({id:'synthetic-message'})};
    }});
  const challenges=[];
  const withdrawal=afterVerifiedRecipient=>createSelfServiceWithdrawal({database,
    recipientTagKey:withdrawalTag,challengeKey:Buffer.alloc(32,44),encryptionKey:Buffer.alloc(32,55),
    challengeMailer:{async sendChallenge(item){challenges.push(item);}},
    providerOff:{ensureOff:async()=>({off:true}),verifyOff:async()=>({off:true})},
    afterVerifiedRecipient});
  const reader=createNewOnlyAdminReader({database,encryptionKey:enc,subjectKey:subject});
  const summary=createNewOnlySummary({database});
  const trend=createNewOnlyTrendDetail({database});
  const audience=createCampaignAudienceProofCount({database});
  const review=createCampaignRecipientEvidenceReview({database,
    newEncryptionKey:enc.toString('base64url'),newSubjectKey:subjectKey,
    withdrawalRecipientTagKey:withdrawalTag.toString('base64url'),
    checkDeliveryAllowed:async()=>true});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw'}).format(new Date());

  async function subscribe(email){
    const sent=mail.length;
    await manager.acceptOptIn({email});
    assert.equal(mail.length,sent+1,'a deliberate request sends a fresh DOI');
    return mail.at(-1).match(/#confirm=(ni3\.[\w.-]+)/)[1];
  }
  async function withdraw(email,callback=manager.recordVerifiedWithdrawal){
    // Disposable database only: move earlier challenges past the 15-minute cooldown.
    await database.query('ALTER TABLE newsletter_recovery.self_service_challenges DISABLE TRIGGER USER');
    await database.query("UPDATE newsletter_recovery.self_service_challenges SET requested_at=requested_at-interval '16 minutes'");
    await database.query('ALTER TABLE newsletter_recovery.self_service_challenges ENABLE TRIGGER USER');
    const api=withdrawal(callback);
    await api.requestChallenge({email});
    const {challengeId,token}=challenges.at(-1);
    assert.equal((await api.confirmChallenge({challengeId,token})).state,'provider_off_verified');
  }
  async function views(email){
    const page=(await reader.adapter.readPage({search:email})).items;
    assert.equal(page.length,1);
    const recent=(await reader.readRecent()).items.filter(item=>item.email===email);
    const consent=await reader.readConsent(tagOf(email));
    // Status mail shares the hourly DOI budget; reset it in this disposable DB.
    await database.query('DELETE FROM newsletter_new.mail_budget');
    await manager.acceptStatus({email});
    const proof=mail.pop().match(/#status=(ns2\.[\w.-]+)/)[1];
    return {
      panel:page[0].state,recent:recent[0]?.state,consent:consent.state,
      public:(await manager.checkStatus(proof)).state,
      audience:(await audience()).confirmed,review:(await review(tagOf(email))).state,
      summary:(await summary()).counts,trend:(await trend({from:today,to:today})).totals
    };
  }
  const evidenceCounts=async()=>(await database.query(`
    SELECT (SELECT count(*) FROM newsletter_new.consent_events)::int AS consents,
           (SELECT count(*) FROM newsletter_new.revocations)::int AS revocations,
           (SELECT count(*) FROM newsletter_recovery.self_service_verified)::int AS verified
  `)).rows[0];
  return {database,manager,subscribe,withdraw,views,evidenceCounts};
}

test('historical repeat withdrawal is repaired from recovery evidence; T1-T6 hold',{timeout:60000},async t=>{
  const {database,manager,subscribe,withdraw,views,evidenceCounts}=await fixture(t);
  const email='synthetic@example.test';
  const input={database,subjectKey,email};

  // T1: request -> DOI -> active.
  await manager.confirm(await subscribe(email));
  let v=await views(email);
  assert.deepEqual([v.panel,v.recent,v.consent,v.public,v.audience],
    ['active','active','subscribed','active',1]);

  // T2: first verified withdrawal -> unsubscribed.
  await withdraw(email);
  v=await views(email);
  assert.deepEqual([v.panel,v.recent,v.consent,v.public,v.audience],
    ['unsubscribed','unsubscribed','unsubscribed','inactive',0]);

  // T3: deliberate new request -> new DOI -> active.
  const renewed=await subscribe(email);
  await manager.confirm(renewed);
  assert.equal((await views(email)).panel,'active');

  // Second verified withdrawal stored by the pre-#354 code: the defect.
  await withdraw(email,pre354Withdrawal);
  v=await views(email);
  assert.deepEqual([v.panel,v.recent,v.consent],['pending','pending','pending'],
    'reproduces "Oczekuje na DOI" after a verified withdrawal');
  assert.equal(v.summary.pending,1);
  assert.equal(v.public,'inactive');
  // T6 already holds before any repair: no current DOI, no campaign recipient.
  assert.equal(v.audience,0);
  assert.notEqual(v.review,'evidence_complete_for_review');
  assert.equal(await countRepeatWithdrawalsWithoutMarker({database}),1);
  const found=await inspectRepeatWithdrawal(input);
  assert.equal(found.state,'HISTORYCZNE_WYPISANIE_BEZ_ZNACZNIKA');
  assert.ok(Date.parse(found.withdrawnAt)>=Date.parse(found.requestedAt));
  const row=async()=>(await database.query(
    'SELECT * FROM newsletter_new.subscribers WHERE email_tag=$1',[tagOf(email)])).rows[0];
  const before=await row(),evidence=await evidenceCounts();
  assert.equal(before.repeat_withdrawn_at,null,'inspection is read-only');

  // Concurrent repeats are idempotent: exactly one marker write.
  const results=await Promise.all([repairRepeatWithdrawal(input),repairRepeatWithdrawal(input)]);
  assert.deepEqual(results.map(r=>r.repaired).sort(),[false,true]);
  assert.ok(results.every(r=>r.state==='WYPISANA'));
  const after=await row();
  assert.equal(after.repeat_withdrawn_at.toISOString(),found.withdrawnAt);
  for(const column of ['state','token_tag','challenge_id','requested_at','expires_at','confirmed_at','ciphertext'])
    assert.deepEqual(after[column],before[column],column+' unchanged');
  assert.deepEqual(await evidenceCounts(),evidence,'no consent or withdrawal history removed');

  // T5: the verified historical withdrawal is shown as withdrawn everywhere.
  v=await views(email);
  assert.deepEqual([v.panel,v.recent,v.consent,v.public,v.audience],
    ['unsubscribed','unsubscribed','unsubscribed','inactive',0]);
  assert.equal(v.summary.pending,0);
  assert.equal(v.summary.withdrawn,1);
  assert.deepEqual([v.trend.pending,v.trend.withdrawn],[0,1]);
  assert.equal(await countRepeatWithdrawalsWithoutMarker({database}),0);
  assert.equal((await repairRepeatWithdrawal(input)).repaired,false);
  await assert.rejects(manager.confirm(renewed),{code:'NEWSLETTER_CONFIRM_REJECTED'},
    'an old confirmation never restores the subscription');

  // T3 after repair: only a fresh DOI re-subscribes; a real pending DOI is never repaired.
  const fresh=await subscribe(email);
  assert.equal((await views(email)).panel,'pending');
  assert.equal((await inspectRepeatWithdrawal(input)).state,'OCZEKUJE_NA_DOI');
  assert.equal((await repairRepeatWithdrawal(input)).repaired,false);
  await manager.confirm(fresh);
  v=await views(email);
  assert.deepEqual([v.panel,v.public,v.audience],['active','active',1]);

  // T4: repeated withdrawal with the current code.
  await withdraw(email);
  v=await views(email);
  assert.deepEqual([v.panel,v.recent,v.consent,v.public,v.audience],
    ['unsubscribed','unsubscribed','unsubscribed','inactive',0]);
  assert.notEqual(v.review,'evidence_complete_for_review');
  assert.equal(await countRepeatWithdrawalsWithoutMarker({database}),0);
});

test('an expired DOI without a later verified withdrawal is never marked withdrawn',{timeout:60000},async t=>{
  const {database,manager,subscribe,withdraw,views,evidenceCounts}=await fixture(t);
  const email='expired@example.test';
  const input={database,subjectKey,email};
  await manager.confirm(await subscribe(email));
  await withdraw(email);
  await subscribe(email);
  // Disposable database only: let the renewed DOI link expire unconfirmed.
  await database.query("UPDATE newsletter_new.subscribers SET expires_at=clock_timestamp()-interval '1 minute' WHERE email_tag=$1",[tagOf(email)]);
  const evidence=await evidenceCounts();
  assert.equal((await inspectRepeatWithdrawal(input)).state,'DOI_WYGASL_BEZ_DOWODU_WYPISANIA');
  assert.equal(await countRepeatWithdrawalsWithoutMarker({database}),0);
  const result=await repairRepeatWithdrawal(input);
  assert.equal(result.repaired,false);
  assert.equal(result.state,'DOI_WYGASL_BEZ_DOWODU_WYPISANIA');
  const v=await views(email);
  assert.deepEqual([v.panel,v.public,v.audience],['pending','inactive',0]);
  assert.equal((await database.query(
    'SELECT repeat_withdrawn_at FROM newsletter_new.subscribers WHERE email_tag=$1',[tagOf(email)])).rows[0].repeat_withdrawn_at,null);
  assert.deepEqual(await evidenceCounts(),evidence);
  assert.equal((await inspectRepeatWithdrawal({database,subjectKey,email:'missing@example.test'})).state,'BRAK_REKORDU');
  await assert.rejects(inspectRepeatWithdrawal({database,subjectKey:'short',email}));
});

const cli=fileURLToPath(new URL('../operations/repair-repeat-withdrawal-marker.mjs',import.meta.url));
const cliEnv=databaseUrl=>({PATH:process.env.PATH||'/usr/bin:/bin',DATABASE_URL:databaseUrl,
  NEWSLETTER_NEW_SUBJECT_KEY:subjectKey});
function runCli(args,{databaseUrl,email}){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,...args],{env:cliEnv(databaseUrl)});
    let output='';
    child.stdout.on('data',chunk=>{output+=chunk;});
    child.stderr.on('data',chunk=>{output+=chunk;});
    child.on('error',reject);
    child.on('close',code=>resolve({code,output}));
    child.stdin.end(email+'\n');
  });
}

// Forwards PostgreSQL traffic. The first client message containing `marker`
// still reaches the server and runs there, but its answer is never delivered.
async function answerDroppingProxy(databaseUrl,marker){
  const target=new URL(databaseUrl),sockets=new Set();
  let armed=true;
  const server=createServer(client=>{
    const upstream=connect(Number(target.port||5432),target.hostname.replace(/^\[|\]$/g,''));
    let dropping=false;
    for(const [from,to] of [[client,upstream],[upstream,client]]){
      sockets.add(from);
      from.on('error',()=>to.destroy());
      from.on('close',()=>to.destroy());
    }
    client.on('data',chunk=>{
      if(armed&&chunk.includes(marker)){armed=false;dropping=true;}
      upstream.write(chunk);
    });
    upstream.on('data',chunk=>{
      if(!dropping)return void client.write(chunk);
      client.destroy();
      upstream.destroy();
    });
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const url=new URL(databaseUrl);
  url.hostname='127.0.0.1';
  url.port=String(server.address().port);
  return {url:url.href,get dropped(){return !armed;},
    close(){for(const socket of sockets)socket.destroy();return new Promise(done=>server.close(done));}};
}
const COMMIT_MESSAGE=Buffer.from('Q\0\0\0\x0bCOMMIT\0','latin1');
const MARKER_WRITE=Buffer.from('SET repeat_withdrawn_at=e.withdrawn_at');

test('CLI: hidden address on a real PTY; a lost COMMIT answer is uncertain, never "BEZ ZMIAN"',{timeout:60000},async t=>{
  const {database,manager,subscribe,withdraw}=await fixture(t);
  const email='uncertain@example.test',url=process.env.DATABASE_URL;
  await manager.confirm(await subscribe(email));
  await withdraw(email);
  await manager.confirm(await subscribe(email));
  await withdraw(email,pre354Withdrawal);
  const marker=async()=>(await database.query(
    'SELECT repeat_withdrawn_at FROM newsletter_new.subscribers WHERE email_tag=$1',[tagOf(email)])).rows[0].repeat_withdrawn_at;

  // The exact address arrives through the hidden input; the terminal never shows it.
  const pty=await runOnPty({argv:[process.execPath,cli,'--address'],env:cliEnv(url),
    steps:[{wait:'(nie zostanie wypisany): '},{snapshot:'typing'},{write:email+'\r'}]});
  assert.equal(pty.error,undefined);
  assert.equal(pty.typing.echo,false);
  assert.equal(pty.code,0);
  assert.match(pty.text,/STAN: HISTORYCZNE_WYPISANIE_BEZ_ZNACZNIKA/);
  assert.equal(pty.text.includes('uncertain@'),false);
  assert.deepEqual(pty.after.attrs,pty.before.attrs);

  // Connection lost before COMMIT: PostgreSQL rolls back, so "BEZ ZMIAN" is true.
  let proxy=await answerDroppingProxy(url,MARKER_WRITE);
  let run=await runCli(['--address','--apply'],{databaseUrl:proxy.url,email});
  await proxy.close();
  assert.equal(proxy.dropped,true);
  assert.equal(run.code,1);
  assert.match(run.output,/KONTROLA NIEDOSTEPNA — BEZ ZMIAN/);
  assert.equal(await marker(),null);

  // COMMIT reaches PostgreSQL and is applied, but its answer never arrives.
  proxy=await answerDroppingProxy(url,COMMIT_MESSAGE);
  run=await runCli(['--address','--apply'],{databaseUrl:proxy.url,email});
  await proxy.close();
  assert.equal(proxy.dropped,true);
  assert.equal(run.code,2);
  assert.match(run.output,/STAN: WYNIK_NIEPEWNY\n/);
  assert.match(run.output,/^WYNIK NAPRAWY: NIEPEWNY — COMMIT MOGL ZOSTAC ZAPISANY/m);
  assert.match(run.output,/READ-ONLY\), BEZ --apply:\n  node contact-api\/operations\/repair-repeat-withdrawal-marker\.mjs --address\n/);
  assert.doesNotMatch(run.output,/BEZ ZMIAN/);
  assert.equal(run.output.includes('uncertain@'),false);
  assert.notEqual(await marker(),null,'the unacknowledged COMMIT was applied');

  // The prescribed READ-ONLY re-check reports the real state.
  run=await runCli(['--address'],{databaseUrl:url,email});
  assert.equal(run.code,0);
  assert.match(run.output,/STAN: WYPISANA\n/);
  assert.equal(await countRepeatWithdrawalsWithoutMarker({database}),0);
});

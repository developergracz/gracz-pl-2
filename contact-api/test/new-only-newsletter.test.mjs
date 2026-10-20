import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewOnlyNewsletter} from '../new-only-newsletter.mjs';

function fakeStore() {
  const records = new Map();
  const events = [];
  const revocations = new Map();
  let used = 0;
  const client = {async query(statement,p=[]) {
    const sql = statement.replace(/\s+/g,' ').trim();
    if(sql.startsWith('SELECT email_tag FROM newsletter_new.subscribers WHERE email_tag=$1 FOR UPDATE')) {
      const row=records.get(p[0]);return {rowCount:row?1:0,rows:row?[{email_tag:p[0]}]:[]};
    }
    if(sql.startsWith('SELECT 1 FROM newsletter_new.revocations')) {
      return {rowCount:revocations.has(p[0])?1:0,rows:revocations.has(p[0])?[{one:1}]:[]};
    }
    if(sql.startsWith('INSERT INTO newsletter_new.revocations')) {
      if(revocations.has(p[0]))return {rowCount:0};
      revocations.set(p[0],p[1]);return {rowCount:1};
    }
    if(sql.startsWith('INSERT INTO newsletter_new.subscribers')) {
      if(records.has(p[0]))return {rowCount:0,rows:[]};
      records.set(p[0],{
        email_tag:p[0],challenge_id:p[4],token_tag:p[5],state:'pending',
        delivery_state:'uncertain',source:p[6],consent_version:p[7],
        expires_at:p[8]
      });
      return {rowCount:1,rows:[{email_tag:p[0]}]};
    }
    if(sql.startsWith('SELECT state,expires_at FROM newsletter_new.subscribers')) {
      const row=records.get(p[0]);return {rowCount:row?1:0,rows:row?[row]:[]};
    }
    if(sql.startsWith('UPDATE newsletter_new.subscribers SET ciphertext')) {
      const row=records.get(p[0]);Object.assign(row,{
        challenge_id:p[4],token_tag:p[5],state:'pending',delivery_state:'uncertain',
        source:p[6],consent_version:p[7],expires_at:p[8]
      });return {rowCount:1};
    }
    if(sql.startsWith('INSERT INTO newsletter_new.mail_budget')) {
      used++;return {rowCount:used<=p[0]?1:0,rows:[{used}]};
    }
    if(sql.startsWith('SELECT email_tag,token_tag,state,delivery_state,expires_at')) {
      const row=[...records.values()].find(row=>row.challenge_id===p[0]);
      return {rowCount:row?1:0,rows:row?[{...row}]:[]};
    }
    if(sql.startsWith('UPDATE newsletter_new.subscribers SET state=\'active\'')) {
      const row=[...records.values()].find(row=>row.challenge_id===p[0]);
      row.state='active';row.token_tag=null;row.confirmed_at=new Date();
      return {rowCount:1};
    }
    if(sql.startsWith('INSERT INTO newsletter_new.consent_events')) {
      events.push(p);return {rowCount:1};
    }
    throw Error('Unexpected database query: '+sql.slice(0,110));
  }};
  return {
    records,events,revocations,client,
    db:{
      enabled:true,
      async queryBounded(sql,p=[]){
        if(sql.includes('FROM newsletter_new.subscribers s WHERE s.email_tag=$1')){
          const row=records.get(p[0]);
          return {rows:row?[{state:row.state,withdrawn:revocations.has(p[0])}]:[]};
        }
        return {rows:[{allowed:true}]};
      },
      async transaction(work){return work(client);},
      async query(sql,p){
        assert.match(sql,/delivery_state='sent'/);
        const row=records.get(p[0]);
        if(row?.challenge_id===p[1]){row.delivery_state='sent';return {rowCount:1};}
        return {rowCount:0};
      }
    }
  };
}
const key = value=>Buffer.alloc(32,value).toString('base64url');

test('new-only DOI requires a fresh mailbox proof and produces one immutable consent event', async () => {
  const {db,records,events}=fakeStore();
  let sends=0, sent;
  const manager=createNewOnlyNewsletter({
    database:db,enabled:true,encryptionKey:key(1),subjectKey:key(2),
    apiKey:'fake-send-key',emailFrom:'gracz.pl <newsletter@gracz.pl>',
    fetchFn:async (_url,options)=>{
      sends++;sent=JSON.parse(options.body);
      assert.match(options.headers['Idempotency-Key'],/^newsletter-new\//);
      return {ok:true,json:async()=>({id:'synthetic-email'})};
    }
  });
  assert.equal((await manager.readiness()).newOnly,true);
  assert.deepEqual(await manager.acceptOptIn({email:'synthetic@example.test'}),{state:'request_received'});
  assert.equal(sends,1);
  assert.equal(records.size,1);
  assert.equal([...records.values()][0].state,'pending');
  assert.equal(events.length,0);
  assert.equal(JSON.stringify([...records.values()]).includes('synthetic@example.test'),false);
  assert.deepEqual(await manager.acceptOptIn({email:'synthetic@example.test'}),{state:'request_received'});
  assert.equal(sends,1);
  const link=sent.text.match(/#confirm=(ni3\.[\w.-]+)/)?.[1];
  assert.ok(link);
  await assert.rejects(manager.confirm('n1.compromised'),{code:'NEWSLETTER_CONFIRM_REJECTED'});
  assert.deepEqual(await manager.confirm(link),{state:'subscribed'});
  assert.equal(events.length,1);
  assert.equal([...records.values()][0].state,'active');
  await assert.rejects(manager.confirm(link),{code:'NEWSLETTER_CONFIRM_REJECTED'});
  await manager.acceptOptIn({email:'synthetic@example.test'});
  assert.equal(sends,1);
  assert.equal(events.length,1);
});

test('missing new-only enablement never activates legacy newsletter or sends email',async()=>{
  let sends=0;
  const manager=createNewOnlyNewsletter({
    database:{enabled:true},enabled:false,encryptionKey:key(1),subjectKey:key(2),
    apiKey:'synthetic',emailFrom:'gracz.pl <newsletter@gracz.pl>',
    fetchFn:async()=>{sends++;throw Error('unexpected');}
  });
  assert.equal((await manager.readiness()).ready,false);
  await assert.rejects(manager.acceptOptIn({email:'tester@example.test'}),{code:'NEWSLETTER_NEW_NOT_READY'});
  assert.equal(sends,0);
});

test('verified withdrawal fences the new-only recipient and an outstanding DOI link',async()=>{
  const {db,client,records,revocations}=fakeStore();
  let sent,deliveries=0;
  const manager=createNewOnlyNewsletter({
    database:db,enabled:true,encryptionKey:key(1),subjectKey:key(2),
    apiKey:'synthetic',emailFrom:'gracz.pl <newsletter@gracz.pl>',
    fetchFn:async (_url,options)=>{
      deliveries++;sent=JSON.parse(options.body);
      return {ok:true,json:async()=>({id:'receipt'})};
    }
  });
  const email='new-recipient@example.test';
  await manager.acceptOptIn({email});
  assert.equal(deliveries,1);
  const token=sent.text.match(/#confirm=(ni3\.[\w.-]+)/)?.[1];
  assert.ok(token);
  const challengeId='00000000-0000-4000-8000-000000000001';
  await manager.recordVerifiedWithdrawal({client,email,challengeId});
  assert.equal(revocations.size,1);
  assert.equal([...revocations.values()][0],challengeId);
  await assert.rejects(manager.confirm(token),{code:'NEWSLETTER_CONFIRM_REJECTED'});
  records.get([...records.keys()][0]).expires_at=new Date(0);
  await manager.acceptOptIn({email});
  assert.equal(deliveries,1);
  await manager.recordVerifiedWithdrawal({
    client,email,challengeId:'00000000-0000-4000-8000-000000000002'
  });
  assert.equal(revocations.size,1);
  assert.equal([...revocations.values()][0],challengeId);
});

test('withdrawal of a legacy-only address does not create new-only subscriber data',async()=>{
  const {db,client,records,revocations}=fakeStore();
  const manager=createNewOnlyNewsletter({
    database:db,enabled:true,encryptionKey:key(1),subjectKey:key(2),
    apiKey:'synthetic',emailFrom:'gracz.pl <newsletter@gracz.pl>',
    fetchFn:async()=>{throw Error('unexpected send');}
  });
  await manager.recordVerifiedWithdrawal({client,email:'legacy@example.test',
    challengeId:'00000000-0000-4000-8000-000000000003'});
  assert.equal(records.size,0);
  assert.equal(revocations.size,0);
});

test('status proof requires mailbox access, reveals state only after proof and changes no consent',async()=>{
  const {db,records,events,revocations,client}=fakeStore();
  const delivered=[];
  const manager=createNewOnlyNewsletter({
    database:db,enabled:true,encryptionKey:key(1),subjectKey:key(2),
    apiKey:'synthetic',emailFrom:'gracz.pl <newsletter@gracz.pl>',
    fetchFn:async (_url,options)=>{
      delivered.push(JSON.parse(options.body));
      return {ok:true,json:async()=>({id:'receipt'})};
    }
  });
  const email='verified@example.test';
  await manager.acceptOptIn({email});
  const doi=delivered.at(-1).text.match(/#confirm=(ni3[.][A-Za-z0-9_.-]+)/)?.[1];
  assert.ok(doi);
  await manager.confirm(doi);
  assert.equal(events.length,1);
  const before=records.size;
  assert.deepEqual(await manager.acceptStatus({email}),{state:'request_received'});
  assert.equal(records.size,before);
  assert.equal(events.length,1);
  const proof=delivered.at(-1).text.match(/#status=(ns2[.][A-Za-z0-9_.-]+)/)?.[1];
  assert.ok(proof,'only the verified mailbox receives proof');
  assert.deepEqual(await manager.checkStatus(proof),{state:'active'});
  const tampered=proof.split('.');
  tampered[2]=(tampered[2][0]==='A'?'B':'A')+tampered[2].slice(1);
  await assert.rejects(manager.checkStatus(tampered.join('.')),{code:'NEWSLETTER_STATUS_REJECTED'});
  await manager.recordVerifiedWithdrawal({
    client,email,challengeId:'00000000-0000-4000-8000-000000000003'
  });
  assert.equal(revocations.size,1);
  assert.deepEqual(await manager.checkStatus(proof),{state:'inactive'});
  assert.deepEqual(await manager.acceptStatus({email:'unknown@example.test'}),{state:'request_received'});
  const unknown=delivered.at(-1).text.match(/#status=(ns2[.][A-Za-z0-9_.-]+)/)?.[1];
  assert.deepEqual(await manager.checkStatus(unknown),{state:'inactive'});
  const realNow=Date.now;
  try{
    Date.now=()=>realNow()+16*60*1000;
    await assert.rejects(manager.checkStatus(proof),{code:'NEWSLETTER_STATUS_REJECTED'});
  } finally {Date.now=realNow;}
});

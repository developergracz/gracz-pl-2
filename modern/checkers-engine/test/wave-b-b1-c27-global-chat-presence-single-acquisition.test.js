import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';

import { DistributedGlobalChatService } from '../src/distributed-global-chat.js';
import { PostgresSessionStore } from '../src/postgres-session-store.js';

const { Client }=pg;
const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
const pgTest=databaseUrl?test:test.skip;
const CHANNEL='gracz_global_chat_realtime';
const MAX_NOTIFICATION_BYTES=768;

class FakeResponse extends EventEmitter{
  constructor(){super();this.writes=[];this.writableEnded=false}
  writeHead(){}
  write(value){this.writes.push(String(value));return true}
  end(){if(this.writableEnded)return;this.writableEnded=true;this.emit('close')}
}

function events(response,type){
  return response.writes
    .filter(value=>value.startsWith(`event: ${type}\n`))
    .map(value=>JSON.parse(value.split('\ndata: ')[1].trim()));
}

function uniquePrefix(label){return `c27_${label}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

async function waitFor(predicate,{timeoutMs=6000,intervalMs=20}={}){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    if(await predicate())return;
    await sleep(intervalMs);
  }
  assert.fail('Timed out waiting for B1-C27 evidence.');
}

async function controlClient(){
  const client=new Client({connectionString:databaseUrl});
  await client.connect();
  return client;
}

function meterPoolAcquisitions(pool){
  const original=pool.connect;
  let count=0;
  pool.connect=function(...args){count+=1;return original.apply(this,args)};
  return{
    get count(){return count},
    reset(){count=0},
    restore(){pool.connect=original},
  };
}

async function cleanup(client,prefix){
  await client.query('DELETE FROM gracz_global_chat WHERE user_id LIKE $1',[prefix+'%']).catch(()=>{});
  await client.query('DELETE FROM gracz_chat_topics WHERE owner_id LIKE $1',[prefix+'%']).catch(()=>{});
  await client.query('DELETE FROM gracz_global_chat_presence WHERE user_id LIKE $1',[prefix+'%']).catch(()=>{});
}

function assertSharedPoolReleased(pool){
  assert.equal(pool.waitingCount,0,'shared pool must have zero waiting requests after focused operation');
  assert.equal(pool.totalCount-pool.idleCount,0,'shared pool must have zero checked-out orphan clients after focused operation');
}

async function notify(client,signal){
  const payload=JSON.stringify(signal);
  assert.ok(Buffer.byteLength(payload,'utf8')<=MAX_NOTIFICATION_BYTES);
  await client.query('SELECT pg_notify($1,$2)',[CHANNEL,payload]);
}

async function persistedPresence(client,userId){
  const {rows}=await client.query('SELECT user_id,display_name,seen_at FROM gracz_global_chat_presence WHERE user_id=$1',[userId]);
  return rows[0]??null;
}

async function listenerCount(client){
  const {rows}=await client.query('SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE query=$1',[`LISTEN ${CHANNEL}`]);
  return Number(rows[0]?.count??0);
}

test('B1-C27 static source proves one presence pool query, one SQL statement and frozen presence/listener limits',async()=>{
  const source=await readFile(new URL('../src/distributed-global-chat.js',import.meta.url),'utf8');
  const start=source.indexOf('async #persistPresence(user)');
  const end=source.indexOf('async #notify(signal)',start);
  const section=source.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.equal((section.match(/this\.pool\.query\(/g)||[]).length,1,'presence persistence must own exactly one shared pool query');
  assert.match(section,/WITH persisted AS \(/);
  assert.match(section,/INSERT INTO gracz_global_chat_presence/);
  assert.match(section,/ON CONFLICT\(user_id\) DO UPDATE/);
  assert.match(section,/RETURNING user_id/);
  assert.match(section,/SELECT pg_notify\(\$3,\$4\) FROM persisted/);
  assert.doesNotMatch(section,/this\.#notify\(/,'presence must not issue a second shared-pool NOTIFY query');
  assert.match(source,/if\(signal\.originId!==this\.#originId\) await this\.#refreshPresence\(signal\.userId\)/);
  assert.match(source,/const PRESENCE_REFRESH_MS=15_000;/);
  assert.match(source,/const PRESENCE_TTL_MS=90_000;/);
  assert.match(source,/const MAX_NOTIFICATION_BYTES=768;/);
  assert.match(source,/client=this\.#listenerClientFactory\(\)/);
  assert.match(source,/await client\.connect\(\)/);
  assert.doesNotMatch(source,/async #openListener\(\)[\s\S]*?client=await this\.pool\.connect\(\)/);
});

pgTest('B1-C27 one due touch persists and notifies with exactly one origin shared acquisition and zero self reread',async()=>{
  const prefix=uniquePrefix('due'),store=new PostgresSessionStore(databaseUrl);
  let chat,control,observer,meter;
  const originId='c27-origin-due';
  const notifications=[];
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool,originId});
    await chat.ready;
    control=await controlClient();
    observer=await controlClient();
    observer.on('notification',n=>{if(n.channel===CHANNEL)notifications.push(n.payload)});
    await observer.query(`LISTEN ${CHANNEL}`);
    await cleanup(control,prefix);
    meter=meterPoolAcquisitions(store.pool);

    const userId=(prefix+'_user').padEnd(128,'u').slice(0,128);
    const user={userId,displayName:'C27 Due User'};
    chat.touch(user);

    await waitFor(()=>notifications.some(raw=>{try{return JSON.parse(raw).userId===userId}catch{return false}}));
    await waitFor(async()=>Boolean(await persistedPresence(control,userId)));
    await sleep(100);

    assert.equal(meter.count,1,'one due local presence cycle must consume exactly one shared acquisition');
    const row=await persistedPresence(control,userId);
    assert.equal(row.user_id,userId);
    assert.equal(row.display_name,user.displayName);
    const payload=notifications.map(raw=>{try{return JSON.parse(raw)}catch{return null}}).find(x=>x?.userId===userId);
    assert.deepEqual(payload,{kind:'presence',userId,originId});
    assert.ok(Buffer.byteLength(JSON.stringify(payload),'utf8')<MAX_NOTIFICATION_BYTES);
    assert.ok(chat.online().some(item=>item.userId===userId&&item.displayName===user.displayName));
    assertSharedPoolReleased(store.pool);
  }finally{
    meter?.restore();
    if(chat)await chat.close();
    if(observer)await observer.end();
    if(control){await cleanup(control,prefix);await control.end()}
    await store.close();
  }
});

pgTest('B1-C27 list contract is exactly two shared acquisitions when presence is due and one inside debounce',async()=>{
  const prefix=uniquePrefix('list'),store=new PostgresSessionStore(databaseUrl);
  let chat,control,meter;
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool,originId:'c27-origin-list'});
    await chat.ready;
    control=await controlClient();
    await cleanup(control,prefix);
    meter=meterPoolAcquisitions(store.pool);
    const user={userId:`${prefix}_user`,displayName:'List User'};

    const first=await chat.list(user,{limit:20});
    assert.ok(Array.isArray(first.messages)&&Array.isArray(first.online));
    await waitFor(async()=>Boolean(await persistedPresence(control,user.userId)));
    await sleep(100);
    assert.equal(meter.count,2,'due list must be history SELECT + one combined presence UPSERT/NOTIFY');

    meter.reset();
    const second=await chat.list(user,{limit:20});
    assert.ok(Array.isArray(second.messages));
    await sleep(120);
    assert.equal(meter.count,1,'debounced list must execute only the existing history SELECT');
    assert.ok(chat.online().some(item=>item.userId===user.userId));
    assertSharedPoolReleased(store.pool);
  }finally{
    meter?.restore();
    if(chat)await chat.close();
    if(control){await cleanup(control,prefix);await control.end()}
    await store.close();
  }
});

pgTest('B1-C27 two replicas use one origin acquisition and exactly one remote persisted refresh',async()=>{
  const prefix=uniquePrefix('replica');
  const storeA=new PostgresSessionStore(databaseUrl),storeB=new PostgresSessionStore(databaseUrl);
  let a,b,control,meterA,meterB;
  try{
    await Promise.all([storeA.ready,storeB.ready]);
    a=new DistributedGlobalChatService({pool:storeA.pool,originId:'c27-node-a'});
    b=new DistributedGlobalChatService({pool:storeB.pool,originId:'c27-node-b'});
    await Promise.all([a.ready,b.ready]);
    control=await controlClient();
    await cleanup(control,prefix);
    meterA=meterPoolAcquisitions(storeA.pool);
    meterB=meterPoolAcquisitions(storeB.pool);

    const user={userId:`${prefix}_alice`,displayName:'Alice C27'};
    a.touch(user);
    await waitFor(()=>b.online().some(item=>item.userId===user.userId&&item.displayName===user.displayName));
    await sleep(100);

    assert.equal(meterA.count,1,'origin must execute only combined UPSERT+NOTIFY');
    assert.equal(meterB.count,1,'remote replica must execute exactly one authoritative presence reread');
    const row=await persistedPresence(control,user.userId);
    assert.equal(row?.display_name,user.displayName);
    assert.ok(a.online().some(item=>item.userId===user.userId&&item.displayName===user.displayName));
    assert.ok(b.online().some(item=>item.userId===user.userId&&item.displayName===user.displayName));
    assertSharedPoolReleased(storeA.pool);
    assertSharedPoolReleased(storeB.pool);
  }finally{
    meterA?.restore();meterB?.restore();
    if(a)await a.close();if(b)await b.close();
    if(control){await cleanup(control,prefix);await control.end()}
    await Promise.allSettled([storeA.close(),storeB.close()]);
  }
});

pgTest('B1-C27 origin filter suppresses only matching local origin; different, missing and malformed origins reread PostgreSQL',async()=>{
  const prefix=uniquePrefix('origin'),store=new PostgresSessionStore(databaseUrl);
  let chat,control,meter;
  const originId='c27-origin-filter';
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool,originId});
    await chat.ready;
    control=await controlClient();
    await cleanup(control,prefix);
    meter=meterPoolAcquisitions(store.pool);

    const local={userId:`${prefix}_local`,displayName:'Local'};
    chat.touch(local);
    await waitFor(async()=>Boolean(await persistedPresence(control,local.userId)));
    await sleep(100);
    assert.equal(meter.count,1,'matching self-origin notification must not add a refresh acquisition');

    const cases=[
      {suffix:'different',originId:'c27-other-node'},
      {suffix:'missing'},
      {suffix:'malformed',originId:'bad origin with spaces'},
    ];
    for(const item of cases){
      const userId=`${prefix}_${item.suffix}`;
      await control.query('INSERT INTO gracz_global_chat_presence(user_id,display_name,seen_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,seen_at=NOW()',[userId,`Remote ${item.suffix}`]);
      meter.reset();
      const signal={kind:'presence',userId};
      if(Object.hasOwn(item,'originId'))signal.originId=item.originId;
      await notify(control,signal);
      await waitFor(()=>chat.online().some(entry=>entry.userId===userId&&entry.displayName===`Remote ${item.suffix}`));
      await sleep(60);
      assert.equal(meter.count,1,`${item.suffix} origin must fail safe to one persisted reread`);
    }
    assertSharedPoolReleased(store.pool);
  }finally{
    meter?.restore();
    if(chat)await chat.close();
    if(control){await cleanup(control,prefix);await control.end()}
    await store.close();
  }
});

pgTest('B1-C27 listener reconnect preserves self suppression, remote refresh, one dedicated listener and zero shared LISTEN occupancy',async()=>{
  const prefix=uniquePrefix('reconnect'),store=new PostgresSessionStore(databaseUrl);
  let chat,control,meter;
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool,originId:'c27-reconnect-node'});
    await chat.ready;
    control=await controlClient();
    await cleanup(control,prefix);
    const oldPid=chat.listenerBackendPid;
    assert.ok(oldPid);
    const killed=await control.query('SELECT pg_terminate_backend($1) AS terminated',[oldPid]);
    assert.equal(killed.rows[0]?.terminated,true);
    await waitFor(()=>chat.listenerBackendPid&&chat.listenerBackendPid!==oldPid,{timeoutMs:8000});
    await sleep(120);
    assert.equal(await listenerCount(control),1,'one service must own exactly one dedicated listener after reconnect');
    assertSharedPoolReleased(store.pool);

    meter=meterPoolAcquisitions(store.pool);
    const local={userId:`${prefix}_local`,displayName:'Reconnect Local'};
    chat.touch(local);
    await waitFor(async()=>Boolean(await persistedPresence(control,local.userId)));
    await sleep(100);
    assert.equal(meter.count,1,'self-origin suppression must survive listener reconnect');

    const remoteId=`${prefix}_remote`;
    await control.query('INSERT INTO gracz_global_chat_presence(user_id,display_name,seen_at) VALUES($1,$2,NOW()) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,seen_at=NOW()',[remoteId,'Reconnect Remote']);
    meter.reset();
    await notify(control,{kind:'presence',userId:remoteId,originId:'remote-after-reconnect'});
    await waitFor(()=>chat.online().some(item=>item.userId===remoteId&&item.displayName==='Reconnect Remote'));
    await sleep(60);
    assert.equal(meter.count,1,'remote presence after reconnect must still perform one shared refresh');
    assertSharedPoolReleased(store.pool);

    await chat.close();chat=null;
    await waitFor(async()=>await listenerCount(control)===0);
    await sleep(350);
    assert.equal(await listenerCount(control),0,'close must leave zero dedicated listeners');
    assertSharedPoolReleased(store.pool);
  }finally{
    meter?.restore();
    if(chat)await chat.close();
    if(control){await cleanup(control,prefix);await control.end()}
    await store.close();
  }
});

pgTest('B1-C27 message/topic realtime signals and persisted reread remain unchanged across replicas',async()=>{
  const prefix=uniquePrefix('messages');
  const storeA=new PostgresSessionStore(databaseUrl),storeB=new PostgresSessionStore(databaseUrl);
  let a,b,control,observer;
  const response=new FakeResponse(),signals=[];
  try{
    await Promise.all([storeA.ready,storeB.ready]);
    a=new DistributedGlobalChatService({pool:storeA.pool,originId:'c27-message-a'});
    b=new DistributedGlobalChatService({pool:storeB.pool,originId:'c27-message-b'});
    await Promise.all([a.ready,b.ready]);
    control=await controlClient();observer=await controlClient();
    await cleanup(control,prefix);
    observer.on('notification',n=>{if(n.channel===CHANNEL){try{signals.push(JSON.parse(n.payload))}catch{}}});
    await observer.query(`LISTEN ${CHANNEL}`);

    const subscriber={userId:`${prefix}_subscriber`,displayName:'Subscriber'};
    b.subscribe(response,subscriber);
    await waitFor(()=>events(response,'connected').length>0);

    const author={userId:`${prefix}_author`,displayName:'Author'};
    const created=await a.send(author,{body:`C27 message ${prefix}`});
    await waitFor(()=>events(response,'message.created').some(x=>x.message?.messageId===created.messageId));
    const delivered=events(response,'message.created').find(x=>x.message?.messageId===created.messageId);
    assert.equal(delivered.message.body,created.body);
    const persisted=await control.query('SELECT body FROM gracz_global_chat WHERE message_id=$1',[created.messageId]);
    assert.equal(persisted.rows[0]?.body,created.body);
    const createdSignal=signals.find(x=>x.event==='message.created'&&x.entityId===created.messageId);
    assert.deepEqual(createdSignal,{kind:'entity',event:'message.created',entityId:created.messageId});
    assert.equal(JSON.stringify(createdSignal).includes(created.body),false,'message content must not be carried in realtime signal');

    const updated=await a.edit(author,created.messageId,`C27 edited ${prefix}`);
    await waitFor(()=>events(response,'message.updated').some(x=>x.message?.messageId===created.messageId&&x.message?.body===updated.body));

    const topic=await a.createTopic(author,{title:'C27 Topic',description:'Regression',category:'ogólne'});
    await waitFor(()=>events(response,'topic.created').some(x=>x.topic?.topicId===topic.topicId));

    await a.remove(author,created.messageId);
    await waitFor(()=>events(response,'message.deleted').some(x=>x.messageId===created.messageId));

    assert.ok(signals.some(x=>x.event==='message.updated'&&x.entityId===created.messageId));
    assert.ok(signals.some(x=>x.event==='topic.created'&&x.entityId===topic.topicId));
    assert.ok(signals.some(x=>x.event==='message.deleted'&&x.entityId===created.messageId));
    assertSharedPoolReleased(storeA.pool);
    assertSharedPoolReleased(storeB.pool);
  }finally{
    if(a)await a.close();if(b)await b.close();
    if(observer)await observer.end();
    if(control){await cleanup(control,prefix);await control.end()}
    await Promise.allSettled([storeA.close(),storeB.close()]);
  }
});

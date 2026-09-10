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

async function waitFor(predicate,{timeoutMs=5000,intervalMs=20}={}){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    if(await predicate())return;
    await new Promise(resolve=>setTimeout(resolve,intervalMs));
  }
  assert.fail('Timed out waiting for B1-C22 listener-isolation evidence.');
}

async function controlClient(){
  const client=new Client({connectionString:databaseUrl});
  await client.connect();
  return client;
}

async function listenerRow(client,pid){
  const {rows}=await client.query('SELECT pid,state,query FROM pg_stat_activity WHERE pid=$1',[pid]);
  return rows[0]??null;
}

async function listenerCount(client){
  const {rows}=await client.query("SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE query = $1",[`LISTEN ${CHANNEL}`]);
  return Number(rows[0]?.count??0);
}

async function cleanup(store,prefix){
  await store.pool.query('DELETE FROM gracz_global_chat WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
  await store.pool.query('DELETE FROM gracz_global_chat_presence WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
}

test('B1-C22 static architecture isolates LISTEN from shared pool and preserves pool max=4',async()=>{
  const chatSource=await readFile(new URL('../src/distributed-global-chat.js',import.meta.url),'utf8');
  const storeSource=await readFile(new URL('../src/postgres-session-store.js',import.meta.url),'utf8');
  assert.match(chatSource,/client=this\.#listenerClientFactory\(\)/);
  assert.match(chatSource,/await client\.connect\(\)/);
  assert.match(chatSource,/const options=\{\.\.\.pool\.options\}/);
  assert.doesNotMatch(chatSource,/async #openListener\(\)[\s\S]*?client=await this\.pool\.connect\(\)/);
  assert.match(storeSource,/max:\s*4,/);
  assert.match(storeSource,/idleTimeoutMillis:\s*30_000,/);
  assert.match(storeSource,/connectionTimeoutMillis:\s*10_000,/);
});

pgTest('B1-C22 dedicated listener exists while shared SessionStore pool retains zero persistent LISTEN occupancy',async()=>{
  const store=new PostgresSessionStore(databaseUrl);
  let chat,control;
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool});
    await chat.ready;
    assert.ok(Number.isInteger(chat.listenerBackendPid)&&chat.listenerBackendPid>0);
    assert.equal(store.pool.totalCount-store.pool.idleCount,0,'dedicated LISTEN must not occupy a checked-out SessionStore pool client after readiness');

    control=await controlClient();
    const row=await listenerRow(control,chat.listenerBackendPid);
    assert.ok(row,'dedicated listener backend must exist in pg_stat_activity');
    assert.equal(row.query,`LISTEN ${CHANNEL}`);
    assert.equal(row.state,'idle');
  }finally{
    if(chat)await chat.close();
    if(control)await control.end();
    await store.close();
  }
});

pgTest('B1-C22 short GlobalChat SQL remains on shared pool with pre-C22 acquisition counts',async()=>{
  const store=new PostgresSessionStore(databaseUrl);
  const prefix=`c22_short_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  let chat,meter;
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool});
    await chat.ready;
    meter=meterPoolAcquisitions(store.pool);
    const user={userId:`${prefix}_user`,displayName:'C22 User'};

    await chat.list(user,{limit:20});
    await waitFor(()=>meter.count>=4);
    await new Promise(resolve=>setTimeout(resolve,60));
    assert.equal(meter.count,4,'first list must remain list SELECT + presence UPSERT + NOTIFY + listener-triggered presence reread on shared pool');

    meter.reset();
    await chat.list(user,{limit:20});
    await new Promise(resolve=>setTimeout(resolve,80));
    assert.equal(meter.count,1,'list inside the 15-second presence debounce must remain one shared short acquisition');

    meter.reset();
    const message=await chat.send(user,{body:`B1-C22 ${prefix}`});
    assert.ok(message.messageId);
    await waitFor(()=>meter.count>=3);
    await new Promise(resolve=>setTimeout(resolve,60));
    assert.equal(meter.count,3,'send must remain INSERT + NOTIFY + listener-triggered persisted reread on shared pool');
  }finally{
    if(meter)meter.restore();
    if(chat)await chat.close();
    await cleanup(store,prefix);
    await store.close();
  }
});

pgTest('B1-C22 listener loss reconnects single-flight without shared-pool occupancy or duplicate realtime delivery',async()=>{
  const store=new PostgresSessionStore(databaseUrl);
  const prefix=`c22_reconnect_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  let chat,control;
  const response=new FakeResponse();
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool});
    await chat.ready;
    control=await controlClient();
    const oldPid=chat.listenerBackendPid;
    assert.ok(oldPid);

    const terminated=await control.query('SELECT pg_terminate_backend($1) AS terminated',[oldPid]);
    assert.equal(terminated.rows[0]?.terminated,true);
    await waitFor(()=>chat.listenerBackendPid&&chat.listenerBackendPid!==oldPid,{timeoutMs:7000});
    const replacementPid=chat.listenerBackendPid;
    await new Promise(resolve=>setTimeout(resolve,100));

    assert.equal(await listenerRow(control,oldPid),null,'old listener backend must be gone before replacement remains authoritative');
    const replacement=await listenerRow(control,replacementPid);
    assert.equal(replacement?.query,`LISTEN ${CHANNEL}`);
    assert.equal(store.pool.totalCount-store.pool.idleCount,0,'replacement listener must still be outside shared SessionStore pool');
    assert.equal(await listenerCount(control),1,'one service instance must have exactly one live LISTEN backend after reconnect');

    const subscriber={userId:`${prefix}_sub`,displayName:'Subscriber'};
    chat.subscribe(response,subscriber);
    await waitFor(()=>response.writes.some(value=>value.includes('event: connected')));
    const author={userId:`${prefix}_author`,displayName:'Author'};
    const message=await chat.send(author,{body:`Reconnect ${prefix}`});
    await waitFor(()=>events(response,'message.created').some(item=>item.message?.messageId===message.messageId));
    await new Promise(resolve=>setTimeout(resolve,120));
    assert.equal(events(response,'message.created').filter(item=>item.message?.messageId===message.messageId).length,1,'reconnected listener must not duplicate event delivery');
  }finally{
    if(chat)await chat.close();
    if(control)await control.end();
    await cleanup(store,prefix);
    await store.close();
  }
});

pgTest('B1-C22 close destroys dedicated listener, prevents reconnect resurrection and leaves shared pool usable',async()=>{
  const store=new PostgresSessionStore(databaseUrl);
  let chat,control;
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool});
    await chat.ready;
    control=await controlClient();
    const pid=chat.listenerBackendPid;
    assert.ok(pid);

    await chat.close();
    chat=null;
    await waitFor(async()=>await listenerRow(control,pid)===null);
    await new Promise(resolve=>setTimeout(resolve,400));
    assert.equal(await listenerCount(control),0,'shutdown must not resurrect a dedicated listener');
    const {rows}=await store.pool.query('SELECT 1 AS usable');
    assert.equal(Number(rows[0]?.usable),1,'GlobalChat close must not close the shared SessionStore pool');
  }finally{
    if(chat)await chat.close();
    if(control)await control.end();
    await store.close();
  }
});

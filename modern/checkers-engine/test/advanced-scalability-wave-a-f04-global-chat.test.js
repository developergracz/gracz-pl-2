import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { DistributedGlobalChatService } from '../src/distributed-global-chat.js';
import { PostgresSessionStore } from '../src/postgres-session-store.js';

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
const CHANNEL='gracz_global_chat_realtime';

class FakeResponse extends EventEmitter{
  constructor(){super();this.writes=[];this.writableEnded=false;this.status=null;this.headers=null}
  writeHead(status,headers){this.status=status;this.headers=headers}
  write(value){this.writes.push(String(value));return true}
  end(){if(this.writableEnded)return;this.writableEnded=true;this.emit('close')}
}

class FakeBus{
  constructor(){this.listeners=new Set();this.notifications=[];this.messages=new Map();this.presence=new Map()}
  pool(){return new FakePool(this)}
}

class FakePool{
  constructor(bus){
    this.bus=bus;
    const boundBus=bus;
    this.Client=class extends FakeClient{constructor(){super(boundBus)}};
    this.options={};
  }
  async connect(){return new FakeClient(this.bus)}
  async query(config,values){
    const text=typeof config==='string'?config:config.text;
    const params=typeof config==='string'?(values??[]):(config.values??[]);
    if(text.includes('pg_notify')){
      const payload=params[1];this.bus.notifications.push(payload);
      queueMicrotask(()=>{for(const listener of [...this.bus.listeners]) listener.emit('notification',{channel:CHANNEL,payload})});
      return {rowCount:1,rows:[{}]};
    }
    if(text.startsWith('SELECT user_id,display_name,seen_at FROM gracz_global_chat_presence WHERE seen_at')) return {rowCount:this.bus.presence.size,rows:[...this.bus.presence.values()]};
    if(text.startsWith('INSERT INTO gracz_global_chat_presence')){
      const row={user_id:params[0],display_name:params[1],seen_at:new Date()};this.bus.presence.set(params[0],row);return {rowCount:1,rows:[]};
    }
    if(text.startsWith('SELECT user_id,display_name,seen_at FROM gracz_global_chat_presence WHERE user_id')){
      const row=this.bus.presence.get(params[0]);return {rowCount:row?1:0,rows:row?[row]:[]};
    }
    if(text.startsWith('INSERT INTO gracz_global_chat(')){
      const row={message_id:params[0],user_id:params[1],display_name:params[2],body:params[3],reply_to:params[4],topic_id:params[5],reactions:{},created_at:new Date().toISOString(),edited_at:null,deleted:false,topic_title:null,topic_category:null};
      this.bus.messages.set(row.message_id,row);return {rowCount:1,rows:[row]};
    }
    if(text.startsWith('SELECT m.message_id')){
      const row=this.bus.messages.get(params[0]);return {rowCount:row?1:0,rows:row?[row]:[]};
    }
    throw new Error(`Unexpected fake-pool query: ${text.slice(0,100)}`);
  }
}

class FakeClient extends EventEmitter{
  constructor(bus){super();this.bus=bus;this.listening=false;this.closed=false;this.processID=101}
  async connect(){return this}
  async query(config){
    const text=typeof config==='string'?config:config.text;
    if(text===`LISTEN ${CHANNEL}`){this.listening=true;this.bus.listeners.add(this)}
    return {rowCount:0,rows:[]};
  }
  release(){if(this.listening)this.bus.listeners.delete(this)}
  async end(){this.closed=true;if(this.listening)this.bus.listeners.delete(this)}
}

function events(response,type){
  return response.writes.filter(value=>value.startsWith(`event: ${type}\n`)).map(value=>JSON.parse(value.split('\ndata: ')[1].trim()));
}

async function waitFor(predicate,{timeoutMs=3000}={}){
  const start=Date.now();
  while(Date.now()-start<timeoutMs){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20))}
  assert.fail('Timed out waiting for AS-CAN-F04 cross-node event.');
}

function user(prefix,name){return {userId:`${prefix}_${name}`.slice(0,120),displayName:name}}

test('AS-CAN-F04: production runtime injects the existing session-store pool into Global Chat',async()=>{
  const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(source,/new DistributedGlobalChatService\(\{pool:store\.pool,logger:secureLogger\(audit\)\}\)/);
  assert.doesNotMatch(source,/new GlobalChatService\(config\.databaseUrl/);
  assert.ok(source.indexOf('await globalChat.close()')<source.indexOf('await store.close()'));
});

test('AS-CAN-F04: cross-node notification is signal-only and receiver re-reads the persisted message',async()=>{
  const bus=new FakeBus();
  const a=new DistributedGlobalChatService({pool:bus.pool()});
  const b=new DistributedGlobalChatService({pool:bus.pool()});
  await Promise.all([a.ready,b.ready]);
  const response=new FakeResponse();
  const bob=user('f04','bob');
  b.subscribe(response,bob);

  const alice=user('f04','alice');
  const created=await a.send(alice,{body:'Treść widoczna dopiero po ponownym odczycie.'});
  await waitFor(()=>events(response,'message.created').some(item=>item.message?.messageId===created.messageId));

  const signal=JSON.parse(bus.notifications.find(payload=>payload.includes(created.messageId)));
  assert.deepEqual(signal,{kind:'entity',event:'message.created',entityId:created.messageId});
  assert.equal(JSON.stringify(signal).includes(created.body),false);
  const delivered=events(response,'message.created').find(item=>item.message.messageId===created.messageId);
  assert.equal(delivered.message.body,created.body);

  await Promise.all([a.close(),b.close()]);
});

test('AS-CAN-F04: presence from Node A becomes visible on Node B without sharing process memory',async()=>{
  const bus=new FakeBus();
  const a=new DistributedGlobalChatService({pool:bus.pool()});
  const b=new DistributedGlobalChatService({pool:bus.pool()});
  await Promise.all([a.ready,b.ready]);
  const alice=user('presence','alice');
  a.touch(alice);
  await waitFor(()=>b.online().some(item=>item.userId===alice.userId));
  assert.ok(b.online().some(item=>item.userId===alice.userId&&item.displayName==='alice'));
  await Promise.all([a.close(),b.close()]);
});

test('AS-CAN-F04 PostgreSQL: message committed on Node A reaches SSE subscriber on Node B',{skip:!databaseUrl},async()=>{
  const prefix=`asf04_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const storeA=new PostgresSessionStore(databaseUrl),storeB=new PostgresSessionStore(databaseUrl);
  let a,b;
  const response=new FakeResponse();
  try{
    await Promise.all([storeA.ready,storeB.ready]);
    a=new DistributedGlobalChatService({pool:storeA.pool});
    b=new DistributedGlobalChatService({pool:storeB.pool});
    await Promise.all([a.ready,b.ready]);
    await storeA.pool.query('DELETE FROM gracz_global_chat WHERE user_id LIKE $1',[`${prefix}%`]);
    await storeA.pool.query('DELETE FROM gracz_global_chat_presence WHERE user_id LIKE $1',[`${prefix}%`]);

    const bob=user(prefix,'bob');b.subscribe(response,bob);
    const alice=user(prefix,'alice');a.touch(alice);
    await waitFor(()=>b.online().some(item=>item.userId===alice.userId));

    const message=await a.send(alice,{body:`F04 remote ${prefix}`});
    await waitFor(()=>events(response,'message.created').some(item=>item.message?.messageId===message.messageId));
    const delivered=events(response,'message.created').find(item=>item.message.messageId===message.messageId);
    assert.equal(delivered.message.body,message.body);
    assert.equal(delivered.message.userId,alice.userId);
    assert.ok(delivered.online.some(item=>item.userId===alice.userId));
  }finally{
    if(a)await a.close();if(b)await b.close();
    await storeA.pool.query('DELETE FROM gracz_global_chat WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await storeA.pool.query('DELETE FROM gracz_global_chat_presence WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await Promise.allSettled([storeA.close(),storeB.close()]);
  }
});

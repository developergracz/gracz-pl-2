import assert from 'node:assert/strict';
import test from 'node:test';

import { LobbyService } from '../src/lobby.js';
import { DistributedGlobalChatService } from '../src/distributed-global-chat.js';
import { PostgresSessionStore } from '../src/postgres-session-store.js';

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
const pgTest=databaseUrl?test:test.skip;

function counterFor(pool){
  const original=pool.connect;
  let count=0;
  pool.connect=function(...args){count+=1;return original.apply(this,args)};
  return{
    get count(){return count},
    reset(){count=0},
    restore(){pool.connect=original},
  };
}

async function waitFor(predicate,{timeoutMs=3000}={}){
  const start=Date.now();
  while(Date.now()-start<timeoutMs){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20))}
  assert.fail('Timed out waiting for B1-C21 asynchronous attribution evidence.');
}

pgTest('B1-C21: C19 lobby operations have exact shared-pool acquisition counts',async()=>{
  const store=new PostgresSessionStore(databaseUrl);
  const prefix=`c21-lobby-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  let meter;
  try{
    await store.ready;
    let nextId=0;
    const lobby=new LobbyService({sessionStore:store,pool:store.pool,idGenerator:()=>`${prefix}-${++nextId}`});
    await lobby.ready;
    meter=counterFor(store.pool);
    const user={userId:`${prefix}-owner`,displayName:'Owner'};

    await lobby.readState(user);
    assert.equal(meter.count,1,'GET /lobby/state readState must acquire exactly one client post-C19');

    meter.reset();
    await lobby.touchUser(user);
    assert.equal(meter.count,2,'Lobby touchUser persists presence with two short pool acquisitions');

    meter.reset();
    await lobby.createRoom({ownerId:user.userId,ownerName:user.displayName,roomName:'C21 diagnostic',gameType:'checkers'});
    assert.equal(meter.count,1,'Lobby createRoom transaction must use one checked-out client');
  }finally{
    if(meter)meter.restore();
    await store.pool.query('DELETE FROM gracz_lobby_invitations WHERE room_id LIKE $1 OR from_id LIKE $1 OR to_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await store.pool.query('DELETE FROM gracz_lobby_rooms WHERE room_id LIKE $1 OR owner_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await store.pool.query('DELETE FROM gracz_lobby_presence WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await store.close();
  }
});

pgTest('B1-C21: GlobalChat LISTEN occupies one shared slot and short operations have exact acquisition counts',async()=>{
  const store=new PostgresSessionStore(databaseUrl);
  const prefix=`c21-chat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  let chat,meter;
  try{
    await store.ready;
    chat=new DistributedGlobalChatService({pool:store.pool});
    await chat.ready;
    assert.equal(store.pool.totalCount-store.pool.idleCount,1,'GlobalChat LISTEN must retain exactly one shared-pool client');

    meter=counterFor(store.pool);
    const user={userId:`${prefix}-user`,displayName:'C21 User'};
    await chat.list(user,{limit:20});
    await waitFor(()=>chat.online().some(item=>item.userId===user.userId));
    assert.equal(meter.count,4,'First list = list SELECT + presence UPSERT + NOTIFY + listener presence refresh');

    meter.reset();
    await chat.list(user,{limit:20});
    await new Promise(resolve=>setTimeout(resolve,80));
    assert.equal(meter.count,1,'Within presence refresh interval, list uses only its message SELECT');

    meter.reset();
    await chat.send(user,{body:`B1-C21 ${prefix}`});
    await waitFor(()=>meter.count>=3);
    assert.equal(meter.count,3,'Message send = INSERT + NOTIFY + listener re-read');
  }finally{
    if(meter)meter.restore();
    if(chat)await chat.close();
    await store.pool.query('DELETE FROM gracz_global_chat WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await store.pool.query('DELETE FROM gracz_global_chat_presence WHERE user_id LIKE $1',[`${prefix}%`]).catch(()=>{});
    await store.close();
  }
});

pgTest('B1-C21: SessionStore direct health/read operations each acquire one shared-pool client',async()=>{
  const store=new PostgresSessionStore(databaseUrl);
  let meter;
  try{
    await store.ready;
    meter=counterFor(store.pool);
    await store.healthCheck();
    assert.equal(meter.count,1);
    meter.reset();
    await assert.rejects(()=>store.get(`c21-missing-${Date.now()}`));
    assert.equal(meter.count,1);
  }finally{
    if(meter)meter.restore();
    await store.close();
  }
});

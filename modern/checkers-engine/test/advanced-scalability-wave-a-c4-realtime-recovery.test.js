import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import test from 'node:test';
import pg from 'pg';

import {createGameSession,disconnectPlayer} from '../src/session.js';
import {PostgresSessionStore} from '../src/postgres-session-store.js';
import {PostgresRealtimeHub} from '../src/distributed-infrastructure.js';
import {PostgresThousandRepository} from '../src/thousand-repository.js';
import {ThousandGameService} from '../src/thousand-service.js';
import {ThousandRealtimeHub} from '../src/thousand-realtime.js';
import {PostgresGomokuService} from '../src/postgres-gomoku-service.js';
import {GomokuRealtimeHub} from '../src/gomoku-realtime.js';
import {DistributedGlobalChatService} from '../src/distributed-global-chat.js';
import {ensureGomokuPostgresTestSchema} from './helpers/gomoku-postgres-schema.js';

const {Pool}=pg;
const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
if(databaseUrl)await ensureGomokuPostgresTestSchema(databaseUrl);
function unique(prefix){return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`.toLowerCase()}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function waitFor(predicate,{timeout=6_000,label='condition'}={}){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await predicate())return;await sleep(25)}throw new Error(`Timed out waiting for ${label}`)}
class FakeResponse extends EventEmitter{constructor(){super();this.writes=[];this.ended=false;this.writableEnded=false}writeHead(){}write(value){if(this.writableEnded)return false;this.writes.push(String(value));return true}end(){if(this.writableEnded)return;this.ended=true;this.writableEnded=true;this.emit('finish');this.emit('close')}}
function sseData(writes){return writes.flatMap(chunk=>chunk.split('\n\n')).map(block=>block.split('\n').find(line=>line.startsWith('data: '))).filter(Boolean).map(line=>{try{return JSON.parse(line.slice(6))}catch{return null}}).filter(Boolean)}
async function terminate(admin,pid){assert.ok(Number.isInteger(pid)&&pid>0,'listener backend PID must be known');const result=await admin.query('SELECT pg_terminate_backend($1) AS terminated',[pid]);assert.equal(result.rows[0]?.terminated,true)}

// A fresh subscription after the hub recycles an unhealthy stream is the recovery boundary.
test('Wave A C4 PostgreSQL: Tysiac lost LISTEN closes stale SSE and reconnect snapshot contains latest DB revision',{skip:!databaseUrl},async()=>{
  const admin=new Pool({connectionString:databaseUrl});const repo=new PostgresThousandRepository(databaseUrl);const service=new ThousandGameService({repository:repo,random:()=>0.314159});const hub=new ThousandRealtimeHub({service});
  const gameId=unique('thousand_c4').slice(0,90),players=[0,1,2].map(i=>({userId:`c4t${i}_${gameId}`.slice(0,60),displayName:`C4 T${i}`}));
  try{
    await Promise.all([repo.ready,hub.ready]);
    const created=await service.createGame({gameId,players});
    const first=new FakeResponse();await hub.subscribe(gameId,players[0].userId,first);
    const oldPid=hub.listenerBackendPid;await terminate(admin,oldPid);
    await waitFor(()=>first.ended,{label:'Tysiac stale SSE recycle'});
    const saved=await repo.save(gameId,created.revision,{...created});
    assert.equal(saved.revision,created.revision+1);
    await waitFor(()=>Number.isInteger(hub.listenerBackendPid)&&hub.listenerBackendPid!==oldPid,{label:'Tysiac LISTEN reconnect'});
    const second=new FakeResponse();await hub.subscribe(gameId,players[0].userId,second);
    assert.equal(sseData(second.writes)[0]?.revision,saved.revision);
    second.end();
  }finally{
    hub.close();await repo.pool.query('DELETE FROM gracz_thousand_games WHERE game_id=$1',[gameId]).catch(()=>{});await repo.pool.query(`DELETE FROM gracz_ranking_events WHERE game_type='thousand' AND game_id=$1`,[gameId]).catch(()=>{});await Promise.allSettled([repo.close(),admin.end()]);
  }
});

test('Wave A C4 PostgreSQL: Gomoku lost LISTEN closes stale SSE and reconnect snapshot contains missed move',{skip:!databaseUrl},async()=>{
  const admin=new Pool({connectionString:databaseUrl});const service=new PostgresGomokuService(databaseUrl);const hub=new GomokuRealtimeHub({service});const gameId=unique('gomoku_c4').slice(0,120);const players=[{userId:`b_${gameId}`.slice(0,120),displayName:'Black C4'},{userId:`w_${gameId}`.slice(0,120),displayName:'White C4'}];
  try{
    await Promise.all([service.ready,hub.ready]);
    await service.createGame({gameId,players});
    const first=new FakeResponse();await hub.subscribe(gameId,players[1].userId,first);
    const oldPid=hub.listenerBackendPid;await terminate(admin,oldPid);
    await waitFor(()=>first.ended,{label:'Gomoku stale SSE recycle'});
    const moved=await service.move(gameId,players[0].userId,{row:0,column:0,requestId:unique('move')});
    assert.equal(moved.revision,1);
    await waitFor(()=>Number.isInteger(hub.listenerBackendPid)&&hub.listenerBackendPid!==oldPid,{label:'Gomoku LISTEN reconnect'});
    const second=new FakeResponse();await hub.subscribe(gameId,players[1].userId,second);
    assert.equal(sseData(second.writes)[0]?.revision,1);
    second.end();
  }finally{
    hub.close();await service.pool.query('DELETE FROM gracz_gomoku_games WHERE game_id=$1',[gameId]).catch(()=>{});await Promise.allSettled([service.close(),admin.end()]);
  }
});

test('Wave A C4 PostgreSQL: Checkers lost LISTEN recycles stream and a fresh subscription uses current durable session',{skip:!databaseUrl},async()=>{
  const admin=new Pool({connectionString:databaseUrl});const store=new PostgresSessionStore(databaseUrl);const hub=new PostgresRealtimeHub(databaseUrl);const gameId=unique('checkers_c4').slice(0,120),white=`w_${gameId}`.slice(0,120),black=`b_${gameId}`.slice(0,120);
  try{
    await Promise.all([store.ready,hub.ready]);
    const created=await store.create(createGameSession({gameId,whitePlayerId:white,blackPlayerId:black}));
    const first=new FakeResponse();hub.subscribe(created,white,first);
    const oldPid=hub.listenerBackendPid;await terminate(admin,oldPid);
    await waitFor(()=>first.ended,{label:'Checkers stale SSE recycle'});
    const changed=disconnectPlayer(created,black);await store.save(changed);
    await waitFor(()=>Number.isInteger(hub.listenerBackendPid)&&hub.listenerBackendPid!==oldPid,{label:'Checkers LISTEN reconnect'});
    const current=await store.get(gameId);const second=new FakeResponse();hub.subscribe(current,white,second);
    assert.equal(sseData(second.writes)[0]?.players?.black?.connected,false);
    second.end();
  }finally{
    await store.pool.query('DELETE FROM gracz_game_sessions WHERE game_id=$1',[gameId]).catch(()=>{});await Promise.allSettled([hub.close(),store.close(),admin.end()]);
  }
});

test('Wave A C4 PostgreSQL: Global Chat reconnect replays a message committed while previous SSE was lost',{skip:!databaseUrl},async()=>{
  const admin=new Pool({connectionString:databaseUrl});const pool=new Pool({connectionString:databaseUrl,max:4});const service=new DistributedGlobalChatService({pool});const reader={userId:unique('chat_reader'),displayName:'Chat Reader'},writer={userId:unique('chat_writer'),displayName:'Chat Writer'};
  try{
    await service.ready;
    const first=new FakeResponse();service.subscribe(first,reader);
    await waitFor(()=>sseData(first.writes).some(x=>x?.reconciled===true),{label:'initial chat recovery snapshot'});
    const oldPid=service.listenerBackendPid;await terminate(admin,oldPid);
    await waitFor(()=>first.ended,{label:'Global Chat stale SSE recycle'});
    const missed=await service.send(writer,{body:`lost-signal-${unique('msg')}`});
    await waitFor(()=>Number.isInteger(service.listenerBackendPid)&&service.listenerBackendPid!==oldPid,{label:'Global Chat LISTEN reconnect'});
    const second=new FakeResponse();service.subscribe(second,reader);
    await waitFor(()=>sseData(second.writes).some(x=>x?.message?.messageId===missed.messageId),{label:'Global Chat durable replay'});
    assert.ok(sseData(second.writes).some(x=>x?.message?.messageId===missed.messageId));
    second.end();
    await pool.query('DELETE FROM gracz_global_chat WHERE user_id=ANY($1::text[])',[[reader.userId,writer.userId]]).catch(()=>{});
    await pool.query('DELETE FROM gracz_global_chat_presence WHERE user_id=ANY($1::text[])',[[reader.userId,writer.userId]]).catch(()=>{});
  }finally{await Promise.allSettled([service.close(),pool.end(),admin.end()])}
});

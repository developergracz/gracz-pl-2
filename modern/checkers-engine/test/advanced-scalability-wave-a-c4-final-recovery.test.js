import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';

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
function deferred(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej});return{promise,resolve,reject}}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function waitFor(predicate,{timeout=6_000,label='condition'}={}){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await predicate())return;await sleep(25)}throw new Error(`Timed out waiting for ${label}`)}
class FakeResponse extends EventEmitter{
  constructor(){super();this.writes=[];this.ended=false;this.writableEnded=false;this.statusCode=null}
  writeHead(status){this.statusCode=status}
  write(value){if(this.writableEnded)return false;this.writes.push(String(value));return true}
  end(){if(this.writableEnded)return;this.ended=true;this.writableEnded=true;this.emit('finish');this.emit('close')}
}
function sseEvents(writes){return writes.flatMap(chunk=>chunk.split('\n\n')).map(block=>{let event='message',data='';for(const line of block.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data+=line.slice(5).trim()}if(!data)return null;try{return{event,data:JSON.parse(data)}}catch{return null}}).filter(Boolean)}
function retryValues(writes){return writes.flatMap(chunk=>chunk.split('\n')).filter(line=>line.startsWith('retry: ')).map(line=>Number(line.slice(7))).filter(Number.isFinite)}
async function terminate(admin,pid){assert.ok(Number.isInteger(pid)&&pid>0,'listener backend PID must be known');const result=await admin.query('SELECT pg_terminate_backend($1) AS terminated',[pid]);assert.equal(result.rows[0]?.terminated,true)}

async function thousandToctouCase(){
  const admin=new Pool({connectionString:databaseUrl});
  const repo=new PostgresThousandRepository(databaseUrl);
  const actual=new ThousandGameService({repository:repo,random:()=>0.314159});
  const entered=deferred(),release=deferred();let pauseNext=true;
  const realtimeService={repository:repo,async getView(...args){if(pauseNext){pauseNext=false;entered.resolve();await release.promise}return actual.getView(...args)}};
  const hub=new ThousandRealtimeHub({service:realtimeService});
  const gameId=unique('thousand_c4_toctou').slice(0,90),players=[0,1,2].map(i=>({userId:`tc4_${i}_${gameId}`.slice(0,60),displayName:`TC4 ${i}`}));
  const first=new FakeResponse();
  try{
    await Promise.all([repo.ready,hub.ready]);
    const created=await actual.createGame({gameId,players});
    const oldPid=hub.listenerBackendPid;
    const pending=hub.subscribe(gameId,players[0].userId,first);
    await entered.promise;
    await terminate(admin,oldPid);
    await waitFor(()=>hub.listenerBackendPid===null||hub.listenerBackendPid!==oldPid,{label:'Tysiac listener identity invalidation'});
    const saved=await repo.save(gameId,created.revision,{...created});
    release.resolve();
    await assert.rejects(pending,error=>error?.code==='THOUSAND_REALTIME_UNAVAILABLE'&&error?.status===503);
    assert.equal(first.statusCode,null,'stale in-flight Tysiac subscribe must not expose SSE headers');
    assert.equal(first.writes.length,0,'stale in-flight Tysiac subscribe must not emit SSE data');
    await waitFor(()=>Number.isInteger(hub.listenerBackendPid)&&hub.listenerBackendPid!==oldPid,{label:'Tysiac listener reconnect'});
    const fresh=new FakeResponse();
    await hub.subscribe(gameId,players[0].userId,fresh);
    const snapshot=sseEvents(fresh.writes).find(item=>item.event==='thousand.snapshot');
    assert.equal(snapshot?.data?.revision,saved.revision);
    assert.ok(retryValues(fresh.writes).every(value=>value>=900&&value<=1900));
    fresh.end();
  }finally{
    release.resolve();hub.close();
    await repo.pool.query('DELETE FROM gracz_thousand_games WHERE game_id=$1',[gameId]).catch(()=>{});
    await repo.pool.query(`DELETE FROM gracz_ranking_events WHERE game_type='thousand' AND game_id=$1`,[gameId]).catch(()=>{});
    await Promise.allSettled([repo.close(),admin.end()]);
  }
}

test('Wave A C4-01 PostgreSQL: Tysiac subscribe rejects when LISTEN identity dies during delayed snapshot',{skip:!databaseUrl},thousandToctouCase);

async function gomokuToctouCase(){
  const admin=new Pool({connectionString:databaseUrl});
  const actual=new PostgresGomokuService(databaseUrl);
  const entered=deferred(),release=deferred();let pauseNext=true;
  const realtimeService={pool:actual.pool,async view(...args){if(pauseNext){pauseNext=false;entered.resolve();await release.promise}return actual.view(...args)}};
  const hub=new GomokuRealtimeHub({service:realtimeService});
  const gameId=unique('gomoku_c4_toctou').slice(0,120),players=[{userId:`b_${gameId}`.slice(0,120),displayName:'Black C4'},{userId:`w_${gameId}`.slice(0,120),displayName:'White C4'}];
  const first=new FakeResponse();
  try{
    await Promise.all([actual.ready,hub.ready]);
    await actual.createGame({gameId,players});
    const oldPid=hub.listenerBackendPid;
    const pending=hub.subscribe(gameId,players[1].userId,first);
    await entered.promise;
    await terminate(admin,oldPid);
    await waitFor(()=>hub.listenerBackendPid===null||hub.listenerBackendPid!==oldPid,{label:'Gomoku listener identity invalidation'});
    const moved=await actual.move(gameId,players[0].userId,{row:0,column:0,requestId:unique('move')});
    assert.equal(moved.revision,1);
    release.resolve();
    await assert.rejects(pending,error=>error?.code==='GOMOKU_REALTIME_UNAVAILABLE'&&error?.status===503);
    assert.equal(first.statusCode,null,'stale in-flight Gomoku subscribe must not expose SSE headers');
    assert.equal(first.writes.length,0,'stale in-flight Gomoku subscribe must not emit SSE data');
    await waitFor(()=>Number.isInteger(hub.listenerBackendPid)&&hub.listenerBackendPid!==oldPid,{label:'Gomoku listener reconnect'});
    const fresh=new FakeResponse();
    await hub.subscribe(gameId,players[1].userId,fresh);
    const snapshot=sseEvents(fresh.writes).find(item=>item.event==='gomoku.snapshot');
    assert.equal(snapshot?.data?.revision,1);
    assert.equal(snapshot?.data?.moves?.length,1);
    fresh.end();
  }finally{
    release.resolve();hub.close();
    await actual.pool.query('DELETE FROM gracz_gomoku_games WHERE game_id=$1',[gameId]).catch(()=>{});
    await Promise.allSettled([actual.close(),admin.end()]);
  }
}

test('Wave A C4-01 PostgreSQL: Gomoku subscribe rejects when LISTEN identity dies during delayed view',{skip:!databaseUrl},gomokuToctouCase);

test('Wave A C4-02 contract: reconnect dispersion is bounded for Gomoku and native EventSource streams',async()=>{
  const [gomokuWeb,thousandHub,chatHub]=await Promise.all([
    readFile(new URL('../web/gomoku.js',import.meta.url),'utf8'),
    readFile(new URL('../src/thousand-realtime.js',import.meta.url),'utf8'),
    readFile(new URL('../src/distributed-global-chat.js',import.meta.url),'utf8'),
  ]);
  assert.doesNotMatch(gomokuWeb,/setTimeout\(\(\)=>void connectRealtime\(\),1000\)/);
  assert.match(gomokuWeb,/reconnectAttempt=0/);
  assert.match(gomokuWeb,/2\*\*Math\.min\(reconnectAttempt,4\)/);
  assert.match(gomokuWeb,/Math\.random\(\)/);
  assert.match(gomokuWeb,/Math\.min\(10000,base\+jitter\)/);
  assert.match(thousandHub,/retry: \$\{sseRetryMs\(\)\}/);
  assert.match(chatHub,/retry: \$\{sseRetryMs\(\)\}/);
  assert.match(thousandHub,/SSE_RETRY_MIN_MS=900/);
  assert.match(thousandHub,/SSE_RETRY_MAX_MS=1900/);
  assert.match(chatHub,/SSE_RETRY_MIN_MS=900/);
  assert.match(chatHub,/SSE_RETRY_MAX_MS=1900/);
});

test('Wave A C4-03 PostgreSQL: Global Chat reconnect emits bounded topic reconciliation after a lost durable topic signal',{skip:!databaseUrl},async()=>{
  const admin=new Pool({connectionString:databaseUrl});
  const pool=new Pool({connectionString:databaseUrl,max:4});
  const service=new DistributedGlobalChatService({pool});
  const user={userId:unique('c4_topic_reader'),displayName:'Topic Reader'};
  const topicId=randomUUID(),title=`Recovered topic ${unique('title')}`;
  try{
    await service.ready;
    const first=new FakeResponse();service.subscribe(first,user);
    await waitFor(()=>sseEvents(first.writes).some(item=>item.event==='connected'&&item.data?.reconciled===true),{label:'initial Global Chat reconciliation'});
    const oldPid=service.listenerBackendPid;
    await terminate(admin,oldPid);
    await waitFor(()=>first.ended,{label:'Global Chat stale SSE recycle'});
    await pool.query(`INSERT INTO gracz_chat_topics(topic_id,owner_id,owner_name,title,description,category) VALUES($1,$2,$3,$4,$5,$6)`,[topicId,user.userId,user.displayName,title,'created while LISTEN unavailable','ogólne']);
    await waitFor(()=>Number.isInteger(service.listenerBackendPid)&&service.listenerBackendPid!==oldPid,{label:'Global Chat listener reconnect'});
    const second=new FakeResponse();service.subscribe(second,user);
    await waitFor(()=>sseEvents(second.writes).some(item=>item.event==='topic.created'&&item.data?.reconciled===true),{label:'Global Chat topic reconciliation hint'});
    const events=sseEvents(second.writes),connectedIndex=events.findIndex(item=>item.event==='connected'&&item.data?.reconciled===true),topicIndex=events.findIndex(item=>item.event==='topic.created'&&item.data?.reconciled===true);
    assert.ok(connectedIndex>=0&&topicIndex>connectedIndex,'topic reconciliation must follow connected/reconciled');
    const topics=await service.topics();
    assert.ok(topics.some(topic=>topic.topicId===topicId&&topic.title===title),'bounded topic list must contain topic committed during LISTEN outage');
    const retry=retryValues(second.writes);
    assert.equal(retry.length,1);
    assert.ok(retry[0]>=900&&retry[0]<=1900);
    second.end();
  }finally{
    await pool.query('DELETE FROM gracz_chat_topics WHERE topic_id=$1',[topicId]).catch(()=>{});
    await pool.query('DELETE FROM gracz_global_chat_presence WHERE user_id=$1',[user.userId]).catch(()=>{});
    await Promise.allSettled([service.close(),pool.end(),admin.end()]);
  }
});

test('Wave A C4-03 browser contract: topic reconciliation hint reloads the bounded topic list',async()=>{
  const [web,service]=await Promise.all([
    readFile(new URL('../web/global-chat.js',import.meta.url),'utf8'),
    readFile(new URL('../src/global-chat.js',import.meta.url),'utf8'),
  ]);
  assert.match(web,/addEventListener\("topic\.created",\(\)=>loadTopics/);
  assert.match(service,/ORDER BY created_at DESC LIMIT 100/);
});

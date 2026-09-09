import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import pg from "pg";

import { GomokuRealtimeHub } from "../src/gomoku-realtime.js";
import { PostgresGomokuService } from "../src/postgres-gomoku-service.js";

const { Pool }=pg;
const databaseUrl=process.env.P1_AUD3_04_DATABASE_URL||"";
const admin=databaseUrl?new Pool({connectionString:databaseUrl,ssl:false,max:2}):null;

before(async()=>{
  if(!admin)return;
  const client=await admin.connect();
  try{
    await client.query("SELECT pg_advisory_lock($1)",[731004308]);
    await client.query(`CREATE TABLE IF NOT EXISTS gracz_gomoku_games (
      game_id VARCHAR(128) PRIMARY KEY,
      state JSONB NOT NULL,
      revision INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`);
  }finally{
    await client.query("SELECT pg_advisory_unlock($1)",[731004308]).catch(()=>{});
    client.release();
  }
});

after(async()=>{
  if(!admin)return;
  await admin.query("DELETE FROM gracz_gomoku_games WHERE game_id LIKE 'f08_%'").catch(()=>{});
  await admin.end();
});

class CaptureResponse extends EventEmitter{
  constructor(){super();this.headers={};this.chunks=[];this.ended=false}
  writeHead(status,headers){this.statusCode=status;this.headers=headers||{}}
  write(chunk){const value=String(chunk);this.chunks.push(value);this.emit("chunk",value);return true}
  end(){if(this.ended)return;this.ended=true;this.emit("close")}
}

function waitForChunk(response,predicate,timeoutMs=5_000){
  const existing=response.chunks.find(predicate);if(existing)return Promise.resolve(existing);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{response.off("chunk",onChunk);reject(new Error("Timeout waiting for Gomoku SSE event"))},timeoutMs);
    const onChunk=chunk=>{if(!predicate(chunk))return;clearTimeout(timer);response.off("chunk",onChunk);resolve(chunk)};
    response.on("chunk",onChunk);
  });
}
function parseSse(chunk){const line=String(chunk).split("\n").find(value=>value.startsWith("data: "));return JSON.parse(line.slice(6))}

test("AS-CAN-F08: browser online path has no periodic 1200 ms polling and uses authenticated SSE",async()=>{
  const source=await readFile(new URL("../web/gomoku.js",import.meta.url),"utf8");
  assert.doesNotMatch(source,/setInterval\s*\(\s*refreshOnline\s*,\s*1200\s*\)/);
  assert.doesNotMatch(source,/refreshOnline\s*\(\)/);
  assert.match(source,/\/events/);
  assert.match(source,/response\.body\.getReader\(\)/);
  assert.match(source,/authorization/);
});

test("AS-CAN-F08: PostgreSQL notification is bounded signal-only and reuses supplied service pool",async()=>{
  const notifications=[];
  const listener={on(){},async query(){return{rows:[]}},release(){}};
  const pool={
    async connect(){return listener},
    async query(config){notifications.push(config);return{rows:[]}},
  };
  const service={pool,async view(gameId,userId){return{gameId,userId,revision:0}}};
  const hub=new GomokuRealtimeHub({service});
  try{
    await hub.ready;
    assert.equal(hub.pool,pool);
    assert.equal(await hub.publish("gomoku-f08-signal","gomoku.updated"),true);
    assert.equal(notifications.length,1);
    const payload=JSON.parse(notifications[0].values[1]);
    assert.deepEqual(payload,{gameId:"gomoku-f08-signal",type:"gomoku.updated"});
    assert.equal("state" in payload,false);
    assert.equal("moves" in payload,false);
  }finally{hub.close()}
});

test("AS-CAN-F08: HTTP move path persists before it signals realtime",async()=>{
  const source=await readFile(new URL("../src/gomoku-http.js",import.meta.url),"utf8");
  const persisted=source.indexOf("const view = await service.move");
  const signaled=source.indexOf("await realtime.publish");
  assert.ok(persisted>=0&&signaled>persisted,"Gomoku must persist/resolve the move before signalling realtime");
});

test("AS-CAN-F08 PostgreSQL: Node A move reaches Node B subscriber via signal and authoritative re-read",{skip:!databaseUrl},async()=>{
  const id=`f08_${randomUUID()}`;
  const serviceA=new PostgresGomokuService(databaseUrl);
  const serviceB=new PostgresGomokuService(databaseUrl);
  const hubA=new GomokuRealtimeHub({service:serviceA});
  const hubB=new GomokuRealtimeHub({service:serviceB});
  const responseB=new CaptureResponse();
  try{
    await Promise.all([serviceA.ready,serviceB.ready,hubA.ready,hubB.ready]);
    await serviceA.createGame({gameId:id,players:[
      {userId:"f08-alice",displayName:"Alicja F08"},
      {userId:"f08-bob",displayName:"Robert F08"},
    ]});
    await hubB.subscribe(id,"f08-bob",responseB);
    const snapshot=parseSse(responseB.chunks.find(chunk=>chunk.includes("event: gomoku.snapshot")));
    assert.equal(snapshot.revision,0);
    assert.equal(snapshot.moves.length,0);

    const updatedPromise=waitForChunk(responseB,chunk=>chunk.includes("event: gomoku.updated"));
    const moved=await serviceA.move(id,"f08-alice",{row:7,column:7,requestId:`f08-${randomUUID()}`});
    assert.equal(moved.revision,1);
    assert.equal(await hubA.publish(id,"gomoku.updated"),true);
    const updated=parseSse(await updatedPromise);
    assert.equal(updated.revision,1);
    assert.equal(updated.moves.length,1);
    assert.equal(updated.moves[0].row,7);
    assert.equal(updated.moves[0].column,7);
    assert.equal(updated.canMove,true,"Node B must receive its own freshly projected player view");
  }finally{
    hubA.close();hubB.close();
    responseB.end();
    await Promise.allSettled([serviceA.close(),serviceB.close()]);
    await admin.query("DELETE FROM gracz_gomoku_games WHERE game_id=$1",[id]).catch(()=>{});
  }
});

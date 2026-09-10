import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AuthService } from "../src/auth.js";
import { getLegalMoves } from "../src/index.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createGameHttpServer } from "../src/server.js";
import { createGameSession } from "../src/session.js";

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
const secret="b1-c17-c02-checkers-attribution-secret-32bytes";

function waveBRequestId(runId,gameId,sequence){return `wb:${runId}:checkers:${gameId}:${sequence}`.slice(0,128)}
function uniqueGame(label){return `c02-${label}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function bearer(token){return{authorization:`Bearer ${token}`,accept:"application/json","content-type":"application/json"}}
async function listen(server){await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});const address=server.address();return `http://127.0.0.1:${address.port}`}
async function closeServer(server){if(!server.listening)return;await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
async function json(response){return response.json()}
function durableBenchmarkMoves(session,runId){return session.events.filter(event=>event.type==="move.accepted"&&String(event.payload?.requestId||"").startsWith(`wb:${runId}:checkers:`))}

async function withPostgresGame(label,run){
  if(!databaseUrl)return;
  const store=new PostgresSessionStore(databaseUrl),auth=new AuthService({secret});
  const gameId=uniqueGame(label),white=`${gameId}-w`,black=`${gameId}-b`;
  let server;
  try{
    await store.ready;
    await store.create(createGameSession({gameId,whitePlayerId:white,blackPlayerId:black}));
    server=createGameHttpServer({store,auth});
    const base=await listen(server);
    await run({store,auth,gameId,white,black,base});
  }finally{
    if(server)await closeServer(server);
    await store.pool.query("DELETE FROM gracz_game_sessions WHERE game_id=$1",[gameId]).catch(()=>{});
    await store.close();
  }
}

async function initialMove({base,auth,gameId,white},runId="c02-focused"){
  const token=auth.issue({userId:white,displayName:"White"});
  const viewResponse=await fetch(`${base}/games/${encodeURIComponent(gameId)}`,{headers:bearer(token)});
  assert.equal(viewResponse.status,200);
  const view=await json(viewResponse),moves=getLegalMoves(view.game);
  assert.ok(moves.length>=2,"initial Checkers state should provide multiple legal moves");
  const requestId=waveBRequestId(runId,gameId,view.lastEventSequence+1);
  return{token,view,moves,requestId};
}

test("B1-C17-C02 harness counts only 2xx Checkers responses classified as newly applied",async()=>{
  const source=await readFile(new URL("../perf/k6/scenarios/_runner.js",import.meta.url),"utf8");
  assert.match(source,/function recordCheckersAccepted\(res\)\{if\(!acceptedWrite\(res\)\)return;const body=payload\(res\);if\(body\?\.duplicate===false\)checkersAccepted\.add\(1\)\}/);
  assert.match(source,/recordCheckersAccepted\(res\)/);
  assert.doesNotMatch(source,/recordGameAccepted\(res,checkersAccepted\)/);
});

test("B1-C17-C02 request-id truncation is not causal for the reference Wave B seed but is theoretically unsafe for maximum-length game IDs",()=>{
  const runId="b1-c17-c01-r1-v100",seededGameId=`game-${"a".repeat(36)}`;
  const a=waveBRequestId(runId,seededGameId,2),b=waveBRequestId(runId,seededGameId,3);
  assert.notEqual(a,b);
  assert.ok(a.length<128);
  const longGameId="g".repeat(128);
  assert.equal(waveBRequestId(runId,longGameId,2),waveBRequestId(runId,longGameId,3),"the current slice can truncate the uniqueness-bearing sequence for unrelated maximum-length IDs");
});

test("B1-C17-C02 exact idempotent replay returns 2xx twice but creates one durable move",{skip:!databaseUrl},async()=>withPostgresGame("replay",async ctx=>{
  const runId="c02-replay",{token,moves,requestId}=await initialMove(ctx,runId);
  const url=`${ctx.base}/games/${encodeURIComponent(ctx.gameId)}/moves`,body=JSON.stringify({requestId,move:moves[0]});
  const first=await fetch(url,{method:"POST",headers:bearer(token),body}),firstBody=await json(first);
  const second=await fetch(url,{method:"POST",headers:bearer(token),body}),secondBody=await json(second);
  assert.equal(first.status,200);assert.equal(firstBody.duplicate,false);
  assert.equal(second.status,200);assert.equal(secondBody.duplicate,true);
  assert.equal(secondBody.eventSequence,firstBody.eventSequence);
  const stored=await ctx.store.get(ctx.gameId),durable=durableBenchmarkMoves(stored,runId);
  assert.equal(durable.length,1);assert.equal(durable[0].payload.requestId,requestId);
}));

test("B1-C17-C02 same request id with a different command cannot create a second durable mutation",{skip:!databaseUrl},async()=>withPostgresGame("different-command",async ctx=>{
  const runId="c02-different",{token,moves,requestId}=await initialMove(ctx,runId);
  const url=`${ctx.base}/games/${encodeURIComponent(ctx.gameId)}/moves`;
  const first=await fetch(url,{method:"POST",headers:bearer(token),body:JSON.stringify({requestId,move:moves[0]})}),firstBody=await json(first);
  const replay=await fetch(url,{method:"POST",headers:bearer(token),body:JSON.stringify({requestId,move:moves[1]})}),replayBody=await json(replay);
  assert.equal(first.status,200);assert.equal(firstBody.duplicate,false);
  assert.equal(replay.status,200);assert.equal(replayBody.duplicate,true,"existing Checkers semantics replay the first request-id result rather than applying a different second command");
  const stored=await ctx.store.get(ctx.gameId);
  assert.equal(durableBenchmarkMoves(stored,runId).length,1);
}));

test("B1-C17-C02 concurrent duplicate request produces one authoritative durable mutation",{skip:!databaseUrl},async()=>withPostgresGame("concurrent",async ctx=>{
  const runId="c02-concurrent",{token,moves,requestId}=await initialMove(ctx,runId);
  const url=`${ctx.base}/games/${encodeURIComponent(ctx.gameId)}/moves`,body=JSON.stringify({requestId,move:moves[0]});
  const responses=await Promise.all([1,2].map(()=>fetch(url,{method:"POST",headers:bearer(token),body})));
  const bodies=await Promise.all(responses.map(response=>json(response)));
  assert.ok(responses.every(response=>response.status===200||response.status===409),`unexpected statuses: ${responses.map(r=>r.status).join(",")}`);
  assert.ok(responses.some(response=>response.status===200));
  const stored=await ctx.store.get(ctx.gameId);
  assert.equal(durableBenchmarkMoves(stored,runId).length,1);
  if(responses.filter(response=>response.status===200).length===2)assert.ok(bodies.some(body=>body.duplicate===true));
}));

test("B1-C17-C02 GET after a committed new move exposes the committed event sequence",{skip:!databaseUrl},async()=>withPostgresGame("read-after",async ctx=>{
  const runId="c02-read-after",{token,moves,requestId,view}=await initialMove(ctx,runId);
  const moveResponse=await fetch(`${ctx.base}/games/${encodeURIComponent(ctx.gameId)}/moves`,{method:"POST",headers:bearer(token),body:JSON.stringify({requestId,move:moves[0]})});
  const moved=await json(moveResponse);assert.equal(moveResponse.status,200);assert.equal(moved.duplicate,false);
  const getResponse=await fetch(`${ctx.base}/games/${encodeURIComponent(ctx.gameId)}`,{headers:bearer(token)}),after=await json(getResponse);
  assert.equal(getResponse.status,200);assert.equal(after.lastEventSequence,moved.eventSequence);assert.ok(after.lastEventSequence>view.lastEventSequence);
}));

test("B1-C17-C02 HTTP success is not produced before store.save resolves",async()=>{
  const gameId="c02-deferred-save",white="white",black="black",auth=new AuthService({secret});
  const session=createGameSession({gameId,whitePlayerId:white,blackPlayerId:black});
  let releaseSave,saveStarted=false;
  const saveGate=new Promise(resolve=>{releaseSave=resolve});
  const store={async get(){return session},async save(){saveStarted=true;await saveGate}};
  const server=createGameHttpServer({store,auth}),base=await listen(server),token=auth.issue({userId:white,displayName:"White"});
  try{
    const move=getLegalMoves(session.game)[0],requestId="wb:c02:checkers:c02-deferred-save:2";
    let settled=false;
    const responsePromise=fetch(`${base}/games/${gameId}/moves`,{method:"POST",headers:bearer(token),body:JSON.stringify({requestId,move})}).then(response=>{settled=true;return response});
    for(let i=0;i<50&&!saveStarted;i++)await new Promise(resolve=>setTimeout(resolve,1));
    assert.equal(saveStarted,true);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(settled,false,"response must remain pending while durable save is pending");
    releaseSave();const response=await responsePromise;assert.equal(response.status,200);assert.equal((await json(response)).duplicate,false);
  }finally{releaseSave?.();await closeServer(server)}
});

test("B1-C17-C02 correctness checker compares the Checkers counter with durable RUN_ID move.accepted events and rejects durable duplicate request IDs",async()=>{
  const source=await readFile(new URL("../perf/scripts/wave-b-correctness-check.mjs",import.meta.url),"utf8");
  assert.match(source,/e\.type==='move\.accepted'/);
  assert.match(source,/startsWith\(`wb:\$\{runId\}:checkers:`\)/);
  assert.match(source,/durableC\+=moves\.length/);
  assert.match(source,/ids\.length-new Set\(ids\)\.size/);
  assert.match(source,/durableC===cAccepted/);
});

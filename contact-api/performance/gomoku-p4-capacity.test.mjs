// P4 isolated, non-production capacity probe for the exact Gomoku P2 WebSocket adapter.
// Tests real TCP/WebSocket handshakes, subscriptions and match fan-out at staged occupancy.
// The router is a deterministic in-memory fake; this is NOT a 30,000-player end-to-end test.
// Run explicitly: node --test contact-api/performance/gomoku-p4-capacity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
import {WebSocket} from 'ws';
import {createGomokuRealtime} from '../auth/gomoku-realtime.mjs';

const ORIGIN='https://gracz-contact-api.onrender.com';
const GOAL=30000, CONNECTION_LIMIT=512;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const p95=values=>values.length?Math.round([...values].sort((a,b)=>a-b)[Math.ceil(.95*values.length)-1]*10)/10:null;
const idFor=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');

test('P4: staged local sockets 100/256/500/512, fan-out and rejection at 513', {timeout:115000}, async()=>{
 const versions=new Map(),board=Array(225).fill(0),connections=[],latencies=[],stages=[];
 let hub,requestCount=0;
 const router={handle:async(req,res,url)=>{
  requestCount++;
  const write=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(url.pathname==='/auth/session'){
   const token=String(req.headers.cookie||'').match(/__Host-gracz_session=load-(\d+)/)?.[1];
   if(!token)return write(401,{ok:false,error:'AUTH_REQUIRED'}),true;
   write(200,{ok:true,loggedIn:true,nickname:'load_user_'+token});return true;
  }
  if(url.pathname==='/auth/match'){
   const id=url.searchParams.get('id'),ver=versions.get(id);
   if(ver===undefined)return write(404,{ok:false,error:'NO_ROOM'}),true;
   write(200,{ok:true,serverTime:new Date().toISOString(),match:{
    game:'gomoku',playable:true,version:ver,player:1,
    state:{board:board.map((_,i)=>i===0&&ver>1?1:0),history:[],winner:0,turn:1,
     clock:{since:null,remaining:[420000,420000],incrementMs:0}},
    undoRequest:null
   }});return true;
  }
  if(url.pathname==='/auth/match/chat'){
   write(200,{ok:true,messages:[]});return true;
  }
  write(404,{ok:false});return true;
 }};
 const server=createServer((req,res)=>{res.writeHead(404);res.end();});
 hub=createGomokuRealtime({server,router,maxConnections:CONNECTION_LIMIT,heartbeatMs:25000});
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const url='ws://127.0.0.1:'+server.address().port+'/auth/gomoku/realtime';
 const started=performance.now();
 let latestStage=started;

 function connect(index,allowDenied=false){
  const room=idFor(Math.floor(index/2));
  versions.set(room,versions.get(room)||1);
  const opened=performance.now();
  return new Promise((resolve,reject)=>{
   const ws=new WebSocket(url,{headers:{Origin:ORIGIN,Cookie:'__Host-gracz_session=load-'+index},handshakeTimeout:7000});
   let settled=false;
   const deadline=setTimeout(()=>finish(Error('CONNECT_TIMEOUT')),9000);
   function finish(error,value){
    if(settled)return;
    settled=true;clearTimeout(deadline);
    if(error){ws.terminate();reject(error);}else resolve(value);
   }
   ws.on('error',error=>{if(!allowDenied)finish(error);});
   ws.on('unexpected-response',(_request,response)=>{
    const status=response.statusCode;response.resume();
    if(allowDenied)finish(null,{status});
    else finish(Error('HTTP '+status+' at client '+index));
   });
   ws.on('close',()=>{if(!settled)finish(Error('CLOSED_BEFORE_SNAPSHOT client='+index));});
   ws.on('open',()=>{
    ws.send(JSON.stringify({type:'subscribe',matchId:room,version:-1}));
   });
   ws.on('message',raw=>{
    let m;
    try{m=JSON.parse(String(raw));}catch{return finish(Error('INVALID_JSON'));}
    if(m.type==='snapshot'&&m.matchId===room){
     if(allowDenied){ws.terminate();return finish(Error('UNEXPECTED_EXTRA_ACCEPTED'));}
     latencies.push(performance.now()-opened);
     const connection={index,room,ws};
     connections.push(connection);
     finish(null,connection);
    }
   });
  });
 }
 function awaitVersion(connection,version){
  return new Promise((resolve,reject)=>{
   const start=performance.now();
   const timeout=setTimeout(()=>{cleanup();reject(Error('MISSING_MATCH_DELTA client='+connection.index));},6000);
   function cleanup(){clearTimeout(timeout);connection.ws.off('message',receive);connection.ws.off('close',closed);}
   function closed(){cleanup();reject(Error('FANOUT_DISCONNECTED'));}
   function receive(raw){
    try{
     const m=JSON.parse(String(raw));
     if(m.type!=='match'||m.matchId!==connection.room||m.version!==version)return;
     cleanup();resolve(performance.now()-start);
    }catch(e){cleanup();reject(e);}
   }
   connection.ws.on('message',receive);connection.ws.on('close',closed);
  });
 }
 try{
  for(const size of [100,256,500,512]){
   const from=size===100?0:stages.at(-1).active;
   for(let index=from;index<size;index+=8){
    const wave=Array.from({length:Math.min(8,size-index)},(_,i)=>connect(index+i));
    await Promise.all(wave);
    // The production admission limiter allows <=20 handshakes/s.
    // Deliberately stay below this instead of measuring artificial rate-limit rejects.
    await delay(560);
   }
   assert.equal(connections.length,size,'stage did not reach all active clients');
   const selectedRooms=new Set(Array.from({length:Math.min(24,Math.floor(size/2))},(_,i)=>idFor(i)));
   const recipients=connections.filter(c=>selectedRooms.has(c.room));
   const changes=new Map([...selectedRooms].map(id=>[id,versions.get(id)+1]));
   const awaiting=recipients.map(c=>awaitVersion(c,changes.get(c.room)));
   for(const [id,version] of changes){versions.set(id,version);hub.notify(id);}
   const updateLatencies=await Promise.all(awaiting);
   const stage={active:size,first_snapshot_p95_ms:p95(latencies.slice(from,size)),
    fanout_p95_ms:p95(updateLatencies),fanout_recipients:recipients.length,
    seconds_since_previous_stage:Math.round((performance.now()-latestStage)/1000),
    rss_mb:Math.round(process.memoryUsage().rss/(1024*1024)),router_reads:requestCount};
   latestStage=performance.now();
   stages.push(stage);
   console.log('P4_STAGE '+JSON.stringify(stage));
  }
  const extra=await connect(CONNECTION_LIMIT,true);
  assert.equal(extra.status,503,'513th connection must fail closed at current limit');
  assert.equal(connections.length,CONNECTION_LIMIT);
  const result={goal_players:GOAL,actual_concurrent_connections:connections.length,
   extra_connection_http_status:extra.status,capacity_target_met:false,
   minimum_512_slot_instances_math:Math.ceil(GOAL/CONNECTION_LIMIT),
   scope:'real WebSocket transport, synthetic in-memory authentication and match store; NOT full Postgres or production',
   run_seconds:Math.round((performance.now()-started)/1000),stages};
  console.log('P4_RESULT '+JSON.stringify(result));
 }finally{
  hub.close();
  for(const c of connections)c.ws.terminate();
  await new Promise(resolve=>server.close(resolve));
 }
});

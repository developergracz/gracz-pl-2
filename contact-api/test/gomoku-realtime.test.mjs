import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {fixture,host,challenge,tokenA,tokenB,tokenC} from '../test-support/game-matches-fixture.mjs';
import {createGomokuRealtime} from '../auth/gomoku-realtime.mjs';

async function setup(t,options={}){
 let hub;
 const f=fixture({timeLimitMinutes:7,incrementSeconds:2,onGomokuChange:id=>hub?.notify(id)});
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,host);hub.observe(req,res,url);
  if(!await f.router.handle(req,res,url)){res.writeHead(404);res.end();}
 });
 hub=createGomokuRealtime({server,router:f.router,...options});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{hub.close();await new Promise(resolve=>server.close(resolve));});
 async function open(token,origin=host){
  const socket=new WebSocket(base.replace('http:','ws:')+'/auth/gomoku/realtime',{
   headers:{Origin:origin,Cookie:'__Host-gracz_session='+token}});
  const messages=[],waiters=[];
  socket.on('message',raw=>{const msg=JSON.parse(raw);messages.push(msg);for(const fn of [...waiters])fn();});
  const next=async(type)=>{
   const found=messages.findIndex(m=>m.type===type);if(found>=0)return messages.splice(found,1)[0];
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{waiters.splice(waiters.indexOf(check),1);reject(Error('Missing '+type));},3000);
    function check(){const at=messages.findIndex(m=>m.type===type);if(at<0)return;
     clearTimeout(timer);waiters.splice(waiters.indexOf(check),1);resolve(messages.splice(at,1)[0]);}
    waiters.push(check);
   });
  };
  await once(socket,'open');return {socket,next,messages,subscribe:()=>socket.send(JSON.stringify({type:'subscribe',matchId:challenge,version:-1}))};
 }
 async function post(token,path,body){
  const res=await fetch(base+path,{method:'POST',headers:{Origin:host,Cookie:'__Host-gracz_session='+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {status:res.status,...await res.json()};
 }
 return {...f,hub,base,open,post};
}

test('realtime: two authenticated players receive deltas, chat, clocks, undo and reconnect snapshots',async t=>{
 const f=await setup(t);const a=await f.open(tokenA),b=await f.open(tokenB);
 a.subscribe();const first=await a.next('snapshot');assert.equal(first.match.player,1);
 b.subscribe();const second=await b.next('snapshot');assert.equal(second.match.player,2);
 await a.next('match'); // Both ready: existing server starts the clock.
 const moved=await f.post(tokenA,'/auth/match',{id:challenge,version:second.match.version,move:{to:0}});
 assert.equal(moved.status,200);
 const delta=await b.next('match');assert.deepEqual(delta.changes,[[0,1]]);
 assert.equal(delta.match.state.turn,2);assert.equal(delta.match.state.clock.incrementMs,2000);
 assert.equal('board' in delta.match.state,false);assert.equal(delta.version,moved.match.version);
 const stale=await f.post(tokenA,'/auth/match',{id:challenge,version:second.match.version,move:{to:1}});
 assert.equal(stale.status,409);
 await f.post(tokenA,'/auth/match/chat',{id:challenge,message:'Cześć!'});
 const chat=await b.next('chat');assert.equal(chat.messages[0].body,'Cześć!');
 await f.post(tokenA,'/auth/match/undo',{id:challenge,version:moved.match.version,action:'request'});
 const undo=await b.next('match');assert.equal(undo.match.undoRequest.requester,1);
 assert.equal(undo.match.state.clock.since,null);
 await f.post(tokenB,'/auth/match/undo',{id:challenge,version:undo.version,action:'reject',requestId:undo.match.undoRequest.id});
 const rejected=await b.next('match');assert.equal(rejected.match.undoRequest,null);
 b.socket.terminate();const reconnected=await f.open(tokenB);reconnected.subscribe();
 const snapshot=await reconnected.next('snapshot');assert.equal(snapshot.match.state.board[0],1);
 assert.equal(snapshot.messages.length,1);assert.equal(snapshot.match.version,rejected.version);
});

test('realtime: deny foreign origins, missing session, outsider subscription and revoked access',async t=>{
 const f=await setup(t);
 await assert.rejects(f.open(tokenA,'https://evil.example'));
 await assert.rejects(f.open('invalid'));
 const outsider=await f.open(tokenC);const outsideClosed=once(outsider.socket,'close');outsider.subscribe();
 assert.equal((await outsideClosed)[0],1008);assert.equal(outsider.messages.length,0);
 const a=await f.open(tokenA);a.subscribe();await a.next('snapshot');
 f.setBlocked(true);const closed=once(a.socket,'close');f.hub.notify(challenge);
 assert.equal((await closed)[0],1008);
 f.setBlocked(false);const b=await f.open(tokenB);b.subscribe();await b.next('snapshot');
 f.revoke();const revoked=once(b.socket,'close');f.hub.notify(challenge);
 assert.equal((await revoked)[0],1008);
});

test('realtime: deadline uses authoritative clock validation and heartbeats do not access DB',async t=>{
 const f=await setup(t,{heartbeatMs:30});const a=await f.open(tokenA),b=await f.open(tokenB);
 a.subscribe();await a.next('snapshot');b.subscribe();await b.next('snapshot');await a.next('match');
 const count=f.queries.length;await a.next('heartbeat');await a.next('heartbeat');
 assert.equal(f.queries.length,count);
 f.shiftClockSince(419700);f.hub.notify(challenge);
 // First update schedules the actual server deadline; no subsequent notification.
 const ticking=await b.next('match');assert.equal(ticking.match.state.winner,0);
 const ended=await b.next('match');assert.equal(ended.match.state.winner,2);
 assert.equal(ended.match.state.clock.timeoutLoser,1);
});

test('realtime: bounded connections and incoming rate; shutdown closes upgraded sockets',async t=>{
 const f=await setup(t,{maxConnections:1});const a=await f.open(tokenA);
 await assert.rejects(f.open(tokenB));
 const closed=once(a.socket,'close');
 for(let i=0;i<12;i++)a.socket.send(JSON.stringify({type:'subscribe',matchId:challenge,version:-1}));
 assert.equal((await closed)[0],1008);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {fixture,host,challenge,tokenA,tokenB,tokenC} from '../test-support/game-matches-fixture.mjs';
import {createGomokuRealtime} from '../auth/gomoku-realtime.mjs';

async function setup(t){
 let hub;
 const f=fixture({game:'szachy',timeLimitMinutes:5,onGomokuChange:id=>hub?.notify(id)});
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,host);hub.observe(req,res,url);
  if(!await f.router.handle(req,res,url)){res.writeHead(404);res.end();}
 });
 hub=createGomokuRealtime({server,router:f.router});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{hub.close();await new Promise(resolve=>server.close(resolve));});
 async function open(token){
  const socket=new WebSocket(base.replace('http:','ws:')+'/auth/match/realtime',
   {headers:{Origin:host,Cookie:'__Host-gracz_session='+token}});
  const pending=[],waiters=[];
  socket.on('message',raw=>{pending.push(JSON.parse(raw));for(const fn of [...waiters])fn();});
  const next=async type=>{
   const find=()=>pending.findIndex(m=>m.type===type);
   if(find()>=0)return pending.splice(find(),1)[0];
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{const n=waiters.indexOf(ready);if(n>=0)waiters.splice(n,1);reject(Error('Missing '+type));},3000);
    function ready(){const n=find();if(n<0)return;clearTimeout(timer);waiters.splice(waiters.indexOf(ready),1);resolve(pending.splice(n,1)[0]);}
    waiters.push(ready);
   });
  };
  await once(socket,'open');
  return {socket,next,subscribe:()=>socket.send(JSON.stringify({type:'subscribe',matchId:challenge,version:-1}))};
 }
 async function post(token,path,body){
  const res=await fetch(base+path,{method:'POST',
   headers:{Origin:host,Cookie:'__Host-gracz_session='+token,'Content-Type':'application/json'},
   body:JSON.stringify(body)});
  return {status:res.status,...await res.json()};
 }
 return {...f,base,open,post,hub};
}
test('Chess P4: two authenticated sessions receive initial positions and server-approved move deltas',async t=>{
 const f=await setup(t),a=await f.open(tokenA),b=await f.open(tokenB);
 a.subscribe();const initialA=await a.next('snapshot');
 assert.equal(initialA.match.game,'szachy');assert.equal(initialA.match.player,1);
 assert.equal(initialA.match.state.board.length,128);
 b.subscribe();const initialB=await b.next('snapshot');
 assert.equal(initialB.match.player,2);assert.equal(initialB.match.state.clock.ready.every(Boolean),true);
 await a.next('match'); // Clock readiness causes one delta for player A.
 const invalid=await f.post(tokenB,'/auth/match',{id:challenge,version:initialB.match.version,move:{uci:'e7e5'}});
 assert.equal(invalid.status,409);assert.equal(invalid.error,'NIE_TWOJA_TURA');
 const moved=await f.post(tokenA,'/auth/match',{id:challenge,version:initialB.match.version,move:{uci:'e2e4'}});
 assert.equal(moved.status,200);assert.equal(moved.match.state.turn,2);
 const delta=await b.next('match');
 assert.equal(delta.baseVersion,initialB.match.version);
 assert.equal(delta.version,moved.match.version);
 assert.ok(delta.changes.length>=2); // e2 cleared, e4 filled.
 assert.equal(delta.match.state.turn,2);
 assert.equal('board' in delta.match.state,false);
 assert.equal(delta.historyAppend.at(-1).san,'e4');
 const stale=await f.post(tokenA,'/auth/match',{id:challenge,version:initialB.match.version,move:{uci:'d2d4'}});
 assert.equal(stale.status,409);
 const reply=await f.post(tokenB,'/auth/match',{id:challenge,version:moved.match.version,move:{uci:'e7e5'}});
 assert.equal(reply.status,200);
 const forA=await a.next('match');assert.equal(forA.match.state.turn,2); // First queued move.
 const second=await a.next('match');assert.equal(second.match.state.turn,1);
 b.socket.terminate();
 const reconnected=await f.open(tokenB);reconnected.subscribe();
 const snapshot=await reconnected.next('snapshot');
 assert.equal(snapshot.match.state.history.length,2);
 assert.equal(snapshot.match.state.board.length,128);
});
test('Chess FIDE: server accepts draw claim from player on turn after threefold repetition',async t=>{
 const f=await setup(t),a=await f.open(tokenA),b=await f.open(tokenB);
 a.subscribe();await a.next('snapshot');
 b.subscribe();const joined=await b.next('snapshot');
 let version=joined.match.version;
 const cycle=[[tokenA,'b1c3'],[tokenB,'b8c6'],[tokenA,'c3b1'],[tokenB,'c6b8']];
 for(let i=0;i<2;i++)for(const [token,uci] of cycle){
  const moved=await f.post(token,'/auth/match',{id:challenge,version,move:{uci}});
  assert.equal(moved.status,200,uci);
  version=moved.match.version;
 }
 const wrong=await f.post(tokenB,'/auth/match',{id:challenge,version,move:{claimDraw:true}});
 assert.equal(wrong.status,409);
 assert.equal(wrong.error,'NIE_TWOJA_TURA');
 const claimed=await f.post(tokenA,'/auth/match',{id:challenge,version,move:{claimDraw:true}});
 assert.equal(claimed.status,200);
 assert.equal(claimed.match.state.winner,3);
 assert.equal(claimed.match.state.drawReason,'TRZYKROTNE_POWTORZENIE');
 assert.equal(claimed.match.state.history.length,8);
 const ended=await f.post(tokenA,'/auth/match',{id:challenge,version:claimed.match.version,move:{uci:'e2e4'}});
 assert.equal(ended.status,409);
 assert.equal(ended.error,'PARTIA_ZAKONCZONA');
});
test('Chess P4: outsider cannot subscribe to another chess match',async t=>{
 const f=await setup(t),outsider=await f.open(tokenC);
 const closed=once(outsider.socket,'close');outsider.subscribe();
 assert.equal((await closed)[0],1008);
});

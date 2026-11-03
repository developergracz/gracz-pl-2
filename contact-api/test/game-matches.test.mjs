import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { initialGame, playMove } from '../auth/game-engine.mjs';
import { createPublicIdentityRouter } from '../auth/public-identity.mjs';

test('Gomoku is server-authoritative: turn order, collisions and five-in-row win',()=>{
 let state=initialGame('gomoku');
 assert.equal(state.board.length,225);
 assert.equal(playMove('gomoku',state,2,{to:1}).error,'NIE_TWOJA_TURA');
 assert.equal(playMove('gomoku',state,1,{to:225}).error,'NIEDOZWOLONY_RUCH');
 for(let n=0;n<4;n++){
  state=playMove('gomoku',state,1,{to:n}).state;
  assert.equal(playMove('gomoku',state,1,{to:n+1}).error,'NIE_TWOJA_TURA');
  state=playMove('gomoku',state,2,{to:15+n}).state;
 }
 state=playMove('gomoku',state,1,{to:4}).state;
 assert.equal(state.winner,1);
 assert.equal(playMove('gomoku',state,2,{to:20}).error,'PARTIA_ZAKONCZONA');
});

test('Warcaby require captures and finish multijumps before switching turn',()=>{
 const state=initialGame('warcaby');
 assert.equal(state.board.length,64);
 assert.equal(state.board.filter(x=>x===1).length,12);
 assert.equal(state.board.filter(x=>x===2).length,12);
 const board=Array(64).fill(0);
 board[17]=1;board[21]=1;board[26]=2;board[44]=2;
 let s={board,turn:1,winner:0,moves:0,forced:null,quiet:0};
 assert.equal(playMove('warcaby',s,1,{from:21,to:28}).error,'BICIE_OBOWIAZKOWE');
 s=playMove('warcaby',s,1,{from:17,to:35}).state;
 assert.equal(s.board[26],0);assert.equal(s.forced,35);assert.equal(s.turn,1);
 assert.equal(playMove('warcaby',s,1,{from:21,to:30}).error,'NIEDOZWOLONY_RUCH');
 s=playMove('warcaby',s,1,{from:35,to:53}).state;
 assert.equal(s.forced,null);assert.equal(s.winner,1);
 assert.equal(s.board[44],0);
});

test('Warcaby promotion and short-king backward movement',()=>{
 const board=Array(64).fill(0);board[49]=1;board[0]=2;
 const s={board,turn:1,winner:0,moves:0,forced:null,quiet:0};
 const promoted=playMove('warcaby',s,1,{from:49,to:58});
 assert.equal(promoted.state.board[58],3);
 const other=Array(64).fill(0);other[26]=3;other[63]=2;
 const moved=playMove('warcaby',{board:other,turn:1,winner:0,moves:0,forced:null,quiet:0},1,{from:26,to:19});
 assert.equal(moved.state.board[19],3);
});

const host='https://gracz-contact-api.onrender.com';
const idA='00000000-0000-4000-8000-000000000001',idB='00000000-0000-4000-8000-000000000002';
const idC='00000000-0000-4000-8000-000000000003';
const challenge='b92e5507-609f-42f6-941f-12e8438aace3';
const tokenA='a'.repeat(64),tokenB='b'.repeat(64),tokenC='c'.repeat(64);
const digest=t=>createHash('sha256').update(t).digest('hex');

function fixture({timeLimitMinutes=0,incrementSeconds=0}={}){
 const matches=new Map(),queries=[],messages=[];
 let blocked=false,accepted=true;
 const db={enabled:true,async query(sql,p=[]){
  queries.push({sql,p});
  if(sql.startsWith('CREATE ')||sql.startsWith('ALTER TABLE '))return {rows:[],rowCount:0};
  if(sql.includes('INSERT INTO gracz_public_identity.online_presence')){
   const key=Buffer.from(p[0]||[]).toString('hex');
   const id=key===digest(tokenA)?idA:key===digest(tokenB)?idB:null;
   return {rows:id?[{id}]:[],rowCount:id?1:0};
  }
  if(sql.includes('FROM gracz_public_identity.friend_connections c')&&
     sql.includes('gracz_public_identity.online_presence active'))
   return {rows:[{nickname:'GraczB',online:true},{nickname:'GraczC',online:false}],rowCount:2};
  if(sql.includes('SELECT a.id FROM gracz_public_identity.sessions s')){
   const key=Buffer.from(p[0]||[]).toString('hex');
   const id=key===digest(tokenA)?idA:key===digest(tokenB)?idB:key===digest(tokenC)?idC:null;
   return {rows:id?[{id}]:[],rowCount:id?1:0};
  }
  if(sql.includes('SELECT c.game,c.time_limit_minutes,c.increment_seconds FROM gracz_public_identity.game_challenges c')){
   return {rows:accepted&&p[0]===challenge&&[idA,idB].includes(p[1])?
    [{game:'gomoku',time_limit_minutes:timeLimitMinutes,increment_seconds:incrementSeconds}]:[]};
  }
  if(sql.includes('INSERT INTO gracz_public_identity.game_matches')){
   if(!matches.has(p[0]))matches.set(p[0],{state:JSON.parse(p[1]),version:0});
   return {rows:[],rowCount:1};
  }
  if(sql.includes('SELECT m.state,m.version,c.game')){
   const m=matches.get(p[0]);
   return {rows:m&&[idA,idB].includes(p[1])?[{
    state:m.state,version:m.version,game:'gomoku',sender_id:idA,recipient_id:idB,
    sender_nick:'GraczA',recipient_nick:'GraczB',playable:!blocked
   }]:[]};
  }
  if(sql.includes('SELECT id,sender_id,body,created_at FROM (')){
   const rows=messages.filter(x=>x.matchId===p[0]).map(x=>({
    id:x.id,sender_id:x.sender_id,body:x.body,created_at:x.created_at
   }));
   return {rows,rowCount:rows.length};
  }
  if(sql.includes('INSERT INTO gracz_public_identity.game_match_messages')){
   if(blocked)return {rows:[],rowCount:0};
   const [id,sender_id,body,matchId]=p;
   messages.push({id,sender_id,body,matchId,created_at:'2026-11-01T20:00:00Z'});
   return {rows:[{id,created_at:'2026-11-01T20:00:00Z'}],rowCount:1};
  }
  if(sql.includes('UPDATE gracz_public_identity.game_matches m')){
   const m=matches.get(p[1]);
   if(!m||m.version!==p[2]||blocked)return {rows:[],rowCount:0};
   m.state=JSON.parse(p[0]);m.version++;
   return {rows:[{version:m.version}],rowCount:1};
  }
  throw Error('Unexpected query: '+sql.slice(0,100));
 }};
 const router=createPublicIdentityRouter({database:db,resendKey:'fixture',emailFrom:'no-reply@example.test'});
 async function call(token,method,path,body,origin=host){
  const raw=body===undefined?'':JSON.stringify(body);
  const req=Readable.from(raw?[raw]:[]);
  req.url=path;req.method=method;req.socket={remoteAddress:'127.0.0.1'};
  req.headers={};
  if(token)req.headers.cookie='__Host-gracz_session='+token;
  if(method==='POST'){req.headers.origin=origin;req.headers['sec-fetch-site']='same-origin';}
  const res={status:0,body:'',writeHead(status){this.status=status;},end(v){this.body=String(v||'');}};
  assert.equal(await router.handle(req,res,new URL(path,host)),true);
  return {status:res.status,body:JSON.parse(res.body)};
 }
 return {call,queries,setBlocked:v=>{blocked=v;},setAccepted:v=>{accepted=v;},
  shiftClockSince:ms=>{const m=matches.get(challenge);if(m?.state.clock){
   const t=Date.parse(m.state.clock.since);m.state.clock.since=new Date(t-ms).toISOString();
  }},
  expireUndoBy:ms=>{const m=matches.get(challenge);if(m?.state.undo)
   m.state.undo.createdAt=new Date(Date.now()-ms).toISOString();}};
}
test('match API isolates the two participants and rejects forged or stale moves',async()=>{
 const f=fixture();
 assert.equal((await f.call(null,'GET','/auth/match?id='+challenge)).status,401);
 assert.equal((await f.call(tokenC,'GET','/auth/match?id='+challenge)).status,404);
 assert.equal((await f.call(tokenA,'POST','/auth/match',{id:challenge,version:0,move:{to:0}},'https://evil.example')).status,403);
 const opened=await f.call(tokenA,'GET','/auth/match?id='+challenge);
 assert.equal(opened.status,200);
 assert.equal(opened.body.match.player,1);
 assert.equal(opened.body.match.state.board.length,225);
 assert.equal((await f.call(tokenB,'POST','/auth/match',{id:challenge,version:0,move:{to:15}})).body.error,'NIE_TWOJA_TURA');
 const move=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:0,move:{to:0}});
 assert.equal(move.status,200);assert.equal(move.body.match.version,1);
 assert.deepEqual(move.body.match.state.history,[{player:1,to:0,number:1}]);
 assert.equal((await f.call(tokenA,'POST','/auth/match',{id:challenge,version:0,move:{to:1}})).status,409);
 const opponent=await f.call(tokenB,'GET','/auth/match?id='+challenge);
 assert.equal(opponent.body.match.state.board[0],1);
 assert.equal(opponent.body.match.player,2);
 assert.doesNotMatch(JSON.stringify(opponent.body),/email_key|token_digest|password_digest/);
 const next=await f.call(tokenB,'POST','/auth/match',{id:challenge,version:1,move:{to:15}});
 assert.equal(next.status,200);assert.equal(next.body.match.state.board[15],2);
 assert.deepEqual(next.body.match.state.history,[{player:1,to:0,number:1},{player:2,to:15,number:2}]);
 f.setBlocked(true);
 assert.equal((await f.call(tokenA,'POST','/auth/match',{id:challenge,version:2,move:{to:1}})).status,403);
 assert.match(f.queries.find(q=>q.sql.includes('UPDATE gracz_public_identity.game_matches m')).sql,/m.version=\$3/);
});
test('declined challenges cannot start matches',async()=>{
 const f=fixture();f.setAccepted(false);
 assert.equal((await f.call(tokenA,'GET','/auth/match?id='+challenge)).status,404);
});

test('Gomoku private match chat allows only the two players and blocks unsafe content',async()=>{
 const f=fixture();
 const get=token=>f.call(token,'GET','/auth/match/chat?id='+challenge);
 const post=(token,message,origin=host)=>f.call(token,'POST','/auth/match/chat',{id:challenge,message},origin);
 assert.equal((await get(null)).status,401);
 assert.equal((await get(tokenC)).status,404);
 assert.equal((await post(tokenA,'Cześć!','https://evil.test')).status,403);
 assert.equal((await post(tokenA,'')).status,400);
 assert.equal((await post(tokenA,'x'.repeat(601))).status,400);
 assert.equal((await post(tokenA,'<img src=x onerror=alert(1)>')).status,200);
 assert.equal((await post(tokenB,'Powodzenia!')).status,200);
 const alice=await get(tokenA);
 assert.equal(alice.status,200);
 assert.equal(alice.body.messages.length,2);
 assert.equal(alice.body.messages[0].body,'<img src=x onerror=alert(1)>');
 assert.equal(alice.body.messages[0].player,1);
 assert.equal(alice.body.messages[1].player,2);
 assert.doesNotMatch(JSON.stringify(alice.body),/sender_id|token_digest|password_digest/);
 const bob=await get(tokenB);
 assert.deepEqual(bob.body.messages,alice.body.messages);
 f.setBlocked(true);
 assert.equal((await get(tokenA)).status,403);
 assert.equal((await post(tokenB,'Nie')).status,403);
 assert.match(f.queries.find(q=>q.sql.includes('INSERT INTO gracz_public_identity.game_match_messages')).sql,
  /NOT EXISTS\(SELECT 1 FROM gracz_public_identity.friend_blocks/);
});


test('premium online undo requires opponent consent and removes only requester stone',async()=>{
 const f=fixture();
 const send=(token,body,origin=host)=>f.call(token,'POST','/auth/match/undo',{id:challenge,...body},origin);
 const play=(token,version,to)=>f.call(token,'POST','/auth/match',{id:challenge,version,move:{to}});
 const get=token=>f.call(token,'GET','/auth/match?id='+challenge);
 assert.equal((await send(null,{version:0,action:'request'})).status,401);
 assert.equal((await send(tokenC,{version:0,action:'request'})).status,404);
 assert.equal((await send(tokenA,{version:0,action:'request'},'https://evil.example')).status,403);
 assert.equal((await send(tokenA,{version:0,action:'request'})).status,409); // no own move
 assert.equal((await play(tokenA,0,0)).status,200);
 assert.equal((await play(tokenB,1,15)).status,200);
 const requested=await send(tokenA,{version:2,action:'request'});
 assert.equal(requested.status,200);
 const pending=requested.body.match.undoRequest;
 assert.equal(pending.requester,1);
 assert.equal(pending.targetTo,0);
 assert.equal(pending.requesterName,'GraczA');
 assert.ok(pending.id);
 assert.equal((await send(tokenA,{version:3,action:'accept',requestId:pending.id})).status,409);
 assert.equal((await play(tokenA,3,1)).body.error,'OCZEKUJE_NA_DECYZJE');
 assert.equal((await send(tokenB,{version:3,action:'accept',requestId:'00000000-0000-4000-8000-000000000000'})).status,409);
 assert.equal((await send(tokenB,{version:2,action:'accept',requestId:pending.id})).status,409);
 const opponent=await get(tokenB);
 assert.equal(opponent.body.match.undoRequest.id,pending.id);
 assert.equal(opponent.body.match.state.board[0],1);
 assert.equal(opponent.body.match.state.board[15],2);
 const decided=await send(tokenB,{version:3,action:'accept',requestId:pending.id});
 assert.equal(decided.status,200);
 assert.equal(decided.body.match.state.board[0],0,'black stone removed');
 assert.equal(decided.body.match.state.board[15],2,'white stone preserved');
 assert.equal(decided.body.match.state.turn,1,'requester may play again');
 assert.equal(decided.body.match.state.moves,1);
 assert.deepEqual(decided.body.match.state.history,[{player:2,to:15,number:1}]);
 assert.equal(decided.body.match.undoRequest,null);
 assert.equal((await send(tokenB,{version:4,action:'accept',requestId:pending.id})).status,409);
 assert.equal((await play(tokenA,4,1)).status,200,'game continues after accepted undo');
 assert.match(f.queries.find(x=>x.sql.includes('UPDATE gracz_public_identity.game_matches m')).sql,/m.version=\$3/);
});

test('premium undo rejection leaves stones unchanged and blocking prevents consent',async()=>{
 const f=fixture();
 const play=(token,version,to)=>f.call(token,'POST','/auth/match',{id:challenge,version,move:{to}});
 const request=(token,body)=>f.call(token,'POST','/auth/match/undo',{id:challenge,...body});
 assert.equal((await play(tokenA,0,5)).status,200);
 const pending=(await request(tokenA,{version:1,action:'request'})).body.match.undoRequest;
 assert.equal((await request(tokenB,{version:2,action:'reject',requestId:pending.id})).status,200);
 const match=await f.call(tokenA,'GET','/auth/match?id='+challenge);
 assert.equal(match.body.match.state.board[5],1);
 assert.equal(match.body.match.undoRequest,null);
 assert.equal((await play(tokenB,3,20)).status,200);
 const again=(await request(tokenA,{version:4,action:'request'})).body.match.undoRequest;
 f.setBlocked(true);
 assert.equal((await request(tokenB,{version:5,action:'accept',requestId:again.id})).status,403);
});

test('friend presence shows only a signed-in player and exposes server-observed activity',async()=>{
 const f=fixture();
 assert.equal((await f.call(null,'GET','/auth/friends/presence')).status,401);
 const response=await f.call(tokenA,'GET','/auth/friends/presence');
 assert.equal(response.status,200);
 assert.deepEqual(response.body.friends,[{nickname:'GraczB',online:true},{nickname:'GraczC',online:false}]);
 assert.match(f.queries.find(q=>q.sql.includes('gracz_public_identity.online_presence active')).sql,
  /friend_blocks/,'Blocked relationships must be excluded from presence');
 assert.equal((await f.call(tokenC,'GET','/auth/friends/presence')).status,401);
});


test('timed Gomoku starts only when both players open their accepted private room',async()=>{
 const f=fixture({timeLimitMinutes:7});
 const get=token=>f.call(token,'GET','/auth/match?id='+challenge);
 const first=await get(tokenA);
 assert.equal(first.status,200);
 assert.equal(first.body.match.state.clock.limitMs,420000);
 assert.deepEqual(first.body.match.state.clock.ready,[true,false]);
 assert.equal(first.body.match.state.clock.since,null);
 assert.equal((await f.call(tokenA,'POST','/auth/match',{
  id:challenge,version:first.body.match.version,move:{to:0}
 })).body.error,'OCZEKIWANIE_NA_GRACZA');
 const second=await get(tokenB);
 assert.equal(second.status,200);
 assert.deepEqual(second.body.match.state.clock.ready,[true,true]);
 assert.ok(second.body.match.state.clock.since);
 assert.ok(Number.isFinite(Date.parse(second.body.serverTime)));
 assert.equal(second.body.match.version,2);
 const black=await f.call(tokenA,'POST','/auth/match',{
  id:challenge,version:second.body.match.version,move:{to:0}
 });
 assert.equal(black.status,200);
 assert.equal(black.body.match.state.turn,2);
 assert.ok(black.body.match.state.clock.remaining[0]<=420000);
 assert.equal(black.body.match.state.clock.remaining[1],420000);
 assert.ok(Number.isFinite(Date.parse(black.body.match.state.clock.since)));
 const white=await f.call(tokenB,'GET','/auth/match?id='+challenge);
 assert.equal(white.body.match.version,3);
 assert.equal(white.body.match.state.board[0],1);
});

test('Fischer time bonus is credited after legal moves, never to a timed-out or rejected player',async()=>{
 const f=fixture({timeLimitMinutes:3,incrementSeconds:2});
 const get=token=>f.call(token,'GET','/auth/match?id='+challenge);
 const first=await get(tokenA),second=await get(tokenB);
 assert.equal(first.body.match.state.clock.incrementMs,2000);
 assert.equal(second.body.match.state.clock.incrementMs,2000);
 f.shiftClockSince(4000);
 const black=await f.call(tokenA,'POST','/auth/match',{
  id:challenge,version:second.body.match.version,move:{to:0}});
 assert.equal(black.status,200);
 assert.equal(black.body.match.state.turn,2);
 assert.ok(black.body.match.state.clock.remaining[0]>=177000);
 assert.ok(black.body.match.state.clock.remaining[0]<=178100);
 assert.equal(black.body.match.state.clock.remaining[1],180000);
 const stale=await f.call(tokenA,'POST','/auth/match',{
  id:challenge,version:second.body.match.version,move:{to:1}});
 assert.equal(stale.status,409);
 const next=await get(tokenB);
 assert.equal(next.body.match.state.clock.remaining[0],black.body.match.state.clock.remaining[0],
  'stale move must not mint a second bonus');
 f.shiftClockSince(3000);
 const white=await f.call(tokenB,'POST','/auth/match',{
  id:challenge,version:next.body.match.version,move:{to:15}});
 assert.equal(white.status,200);
 assert.ok(white.body.match.state.clock.remaining[1]>=178000);
 assert.ok(white.body.match.state.clock.remaining[1]<=179100);
 assert.equal(white.body.match.state.clock.incrementMs,2000);
});

test('server ends timed Gomoku when active player exceeds seven minutes, even after reconnect',async()=>{
 const f=fixture({timeLimitMinutes:7});
 const get=token=>f.call(token,'GET','/auth/match?id='+challenge);
 await get(tokenA);await get(tokenB);
 f.shiftClockSince(421000);
 const expired=await get(tokenA);
 assert.equal(expired.status,200);
 assert.equal(expired.body.match.state.clock.remaining[0],0);
 assert.equal(expired.body.match.state.clock.timeoutLoser,1);
 assert.equal(expired.body.match.state.winner,2);
 assert.equal(expired.body.match.state.clock.since,null);
 const opponent=await get(tokenB);
 assert.equal(opponent.body.match.state.winner,2);
 assert.equal(opponent.body.match.version,expired.body.match.version);
 assert.equal((await f.call(tokenA,'POST','/auth/match',{
  id:challenge,version:expired.body.match.version,move:{to:0}
 })).body.error,'PARTIA_ZAKONCZONA');
});

test('untimed Gomoku keeps original turn rules without clocks',async()=>{
 const f=fixture();
 const room=await f.call(tokenA,'GET','/auth/match?id='+challenge);
 assert.equal(room.status,200);
 assert.equal(room.body.match.state.clock,undefined);
 assert.equal(room.body.match.version,0);
 const move=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:0,move:{to:0}});
 assert.equal(move.status,200);
 assert.equal(move.body.match.version,1);
});


test('pending consent pauses both clocks, but its expiry reliably resumes the active timer',async()=>{
 const f=fixture({timeLimitMinutes:7}),get=token=>f.call(token,'GET','/auth/match?id='+challenge);
 await get(tokenA);await get(tokenB);
 let version=2;
 const play=async(token,to)=>{
  const r=await f.call(token,'POST','/auth/match',{id:challenge,version,move:{to}});
  assert.equal(r.status,200);version=r.body.match.version;
 };
 await play(tokenA,0);
 await play(tokenB,15);
 const request=await f.call(tokenA,'POST','/auth/match/undo',{id:challenge,version,action:'request'});
 assert.equal(request.status,200);
 version=request.body.match.version;
 assert.equal(request.body.match.state.clock.since,null,'clock is paused during active consent');
 f.expireUndoBy(190000); // request timed out 10 seconds ago
 const read=await get(tokenB);
 assert.equal(read.status,200);
 assert.equal(read.body.match.state.undo,undefined,'stale request is cleared');
 assert.equal(read.body.match.state.clock.ready[0],true);
 assert.ok(read.body.match.state.clock.since,'active turn resumes automatically');
 assert.ok(read.body.match.state.clock.remaining[0]>=409000,
  'elapsed from consent expiry is accounted on the next server settlement');
});

// CHESS-001 (P0): legitimate fast Online play must never be rejected by the move limiter,
// while floods still get 429 and every other match limit keeps its original 15-minute budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {fixture,host,challenge,tokenA,tokenB,tokenC} from '../test-support/game-matches-fixture.mjs';

// 240 verified legal half-moves of one chess game that neither ends nor repeats five times.
const LEGAL_PLIES=('d2d3 f7f5 d1d2 d7d6 e1d1 c7c5 d2c3 c8e6 a2a4 e6f7 c3b4 c5c4 b1d2 f7d5 g1f3 d5e4 b4d6 e4f3 d3c4 d8c7 '+
 'a1a3 g7g5 g2g3 f3g2 d6a6 c7c5 a6b5 g2c6 f2f4 c5b5 d2f3 b5a4 c1d2 g8f6 d1c1 g5f4 h2h4 a4b5 d2e1 b7b6 a3a6 b8a6 g3f4 f6g4 '+
 'f3h2 a6b8 e1a5 e8d8 b2b3 b5a4 h1g1 d8c7 h4h5 h8g8 a5e1 h7h6 f1h3 a4b4 c2c3 c6d5 c4d5 b4a4 b3a4 b6b5 e1g3 b5b4 h2f3 b8a6 '+
 'g3h2 g4e3 c3b4 e3d1 g1g2 g8g4 c1c2 e7e6 d5e6 g4h4 a4a5 d1c3 e2e3 a6c5 g2g5 c7c8 h3f5 c8c7 f3e1 c3d5 h2g3 d5f6 f5h7 f8e7 '+
 'e1d3 f6d5 g5e5 a8d8 c2c1 d8d6 d3f2 c7c6 c1c2 c6c7 f2h3 h4f4 h3g1 c7c8 e5g5 c8d8 g3f2 d5c3 g5d5 c5e4 f2g3 e7f6 d5g5 e4g5 '+
 'b4b5 d6d7 g3e1 d7d4 g1e2 f6e5 e6e7 d8c7 b5b6 c7c8 e7e8n d4d5 c2b3 d5b5 b3c2 f4f6 e1g3 b5b2 c2b2 c3b1 b2b3 g5e6 e2c3 e5c7 '+
 'h7d3 b1a3 d3a6 c8d7 b6c7 e6d4 e3d4 f6d6 c7c8b d7e8 c3b1 e8f8 g3e1 f8g8 b3c3 g8h8 e1d2 h8g7 d2g5 g7f7 g5e7 d6e6 a6b5 a3b1 '+
 'c3b3 e6e7 c8a6 e7d7 b5d7 b1c3 d7e6 f7f8 a6c8 a7a6 b3a3 f8e8 e6f5 c3a4 f5d3 a4b2 c8d7 e8f7 d3e2 b2c4 a3a4 f7g8 d7e6 g8f8 '+
 'e2d1 c4d6 e6a2 f8e7 d1c2 d6b7 c2b1 b7c5 a4b4 e7d7 b4a3 d7c7 b1h7 c5e6 a3b3 e6d8 b3c2 d8f7 a2b3 c7b7 h7f5 b7c7 f5h3 f7d6 '+
 'h3g2 d6c8 b3a4 c7d8 g2f1 d8e7 c2d1 e7d8 d1e2 c8e7 a4b3 e7f5 b3c4 d8e7 c4d5 f5g3 e2d1 g3e2 d5a2 e2d4 a2c4 e7e8 d1e1 d4f5 '+
 'e1f2 e8d8 c4g8 f5e3').split(' ');
// The limiter is process-wide; each test starts one mocked hour later so earlier windows have expired.
let hour=0;
const startClock=t=>t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-16T12:00:00.000Z')+(++hour)*3600000});
const tokenFor=player=>player===1?tokenA:tokenB;
async function play(f,t,plies,stepMs){
 let version=(await f.call(tokenA,'GET','/auth/match?id='+challenge)).body.match.version;
 version=(await f.call(tokenB,'GET','/auth/match?id='+challenge)).body.match.version;
 const posts={1:0,2:0};let turn=1,last;
 for(const uci of plies){
  const r=await f.call(tokenFor(turn),'POST','/auth/match',{id:challenge,version,move:{uci}});
  assert.equal(r.status,200,'legal move '+uci+' (half-move '+(posts[1]+posts[2]+1)+') must be accepted, got '+JSON.stringify(r.body));
  posts[turn]++;version=r.body.match.version;turn=r.body.match.state.turn;last=r.body.match;
  t.mock.timers.tick(stepMs);
 }
 return {posts,match:last};
}

test('CHESS-001: 240 legal half-moves at bullet pace are never rate-limited (each player > 80 POSTs)',async t=>{
 startClock(t);
 const f=fixture({game:'szachy'});
 const started=Date.now();
 const {posts,match}=await play(f,t,LEGAL_PLIES,700);
 assert.ok(Date.now()-started<15*60000,'whole sequence fits in one old 15-minute window');
 assert.ok(posts[1]>80&&posts[2]>80,'both accounts exceed the old 80-request budget: '+JSON.stringify(posts));
 assert.equal(match.state.moves,240);assert.equal(match.state.winner,0);
});

test('CHESS-001: after 80+ legal moves a new timed game accepts the first move without a false time loss',async t=>{
 startClock(t);
 await play(fixture({game:'szachy'}),t,LEGAL_PLIES.slice(0,170),600); // 85 moves per account
 const f=fixture({game:'szachy',timeLimitMinutes:1});
 await f.call(tokenA,'GET','/auth/match?id='+challenge);
 const ready=(await f.call(tokenB,'GET','/auth/match?id='+challenge)).body.match;
 assert.ok(ready.state.clock.since,'clock runs once both players joined');
 t.mock.timers.tick(1500);
 const first=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:ready.version,move:{uci:'e2e4'}});
 assert.equal(first.status,200,JSON.stringify(first.body));
 assert.equal(first.body.match.state.turn,2);
 assert.equal(first.body.match.state.winner,0);
 assert.equal(first.body.match.state.clock.remaining[0],58500,'white is charged only the 1.5 s actually used');
 assert.equal(first.body.match.state.clock.timeoutLoser,undefined);
 const reply=await f.call(tokenB,'POST','/auth/match',{id:challenge,version:first.body.match.version,move:{uci:'e7e5'}});
 assert.equal(reply.status,200,JSON.stringify(reply.body));
});

test('CHESS-001: a burst still gets 429; fresh match ids and other games share the per-account budget',async t=>{
 startClock(t);
 const f=fixture({game:'szachy'});
 const opened=(await f.call(tokenA,'GET','/auth/match?id='+challenge)).body.match;
 for(let i=1;i<=120;i++){
  const r=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:opened.version+99,move:{uci:'e2e4'}});
  assert.equal(r.status,409,'request '+i+' is inside the anti-flood budget');
 }
 const flooded=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:opened.version,move:{uci:'e2e4'}});
 assert.equal(flooded.status,429);assert.equal(flooded.body.error,'ZBYT_WIELE_PROB');
 assert.equal((await f.call(tokenB,'GET','/auth/match?id='+challenge)).body.match.version,opened.version,'rejected flood never changes the match');
 assert.equal((await f.call(tokenA,'POST','/auth/match',{id:randomUUID(),version:0,move:{uci:'e2e4'}})).status,429,'new match ids cannot bypass');
 const gomoku=fixture({game:'gomoku'});
 assert.equal((await gomoku.call(tokenA,'POST','/auth/match',{id:challenge,version:0,move:{to:0}})).status,429,'Gomoku/Warcaby share the same budget');
 assert.equal((await f.call(tokenA,'POST','/auth/match',{id:challenge,version:opened.version,move:{claimDraw:true}})).status,429,'claimDraw is counted too');
 assert.equal((await f.call(tokenB,'POST','/auth/match',{id:challenge,version:opened.version,move:{uci:'e7e5'}})).body.error,'NIE_TWOJA_TURA','other accounts are unaffected');
 t.mock.timers.tick(60001);
 const resumed=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:opened.version,move:{uci:'e2e4'}});
 assert.equal(resumed.status,200,'the short window expires after 60 s');
});

test('CHESS-001: chat, undo and match reads keep their original 15-minute limits',async t=>{
 startClock(t);
 const f=fixture({game:'szachy'});
 await f.call(tokenA,'GET','/auth/match?id='+challenge);
 for(let i=1;i<=40;i++)assert.equal((await f.call(tokenA,'POST','/auth/match/chat',{id:challenge,message:'wiadomość '+i})).status,200);
 assert.equal((await f.call(tokenA,'POST','/auth/match/chat',{id:challenge,message:'41'})).status,429);
 for(let i=1;i<=20;i++)assert.notEqual((await f.call(tokenB,'POST','/auth/match/undo',{id:challenge,version:0,action:'request'})).status,429);
 assert.equal((await f.call(tokenB,'POST','/auth/match/undo',{id:challenge,version:0,action:'request'})).status,429);
 for(let i=2;i<=240;i++)assert.equal((await f.call(tokenA,'GET','/auth/match?id='+challenge)).status,200);
 assert.equal((await f.call(tokenA,'GET','/auth/match?id='+challenge)).status,429);
 t.mock.timers.tick(61000); // a move-sized window would have reset; these 15-minute budgets must not
 assert.equal((await f.call(tokenA,'POST','/auth/match/chat',{id:challenge,message:'po minucie'})).status,429);
 assert.equal((await f.call(tokenB,'POST','/auth/match/undo',{id:challenge,version:0,action:'request'})).status,429);
 assert.equal((await f.call(tokenA,'GET','/auth/match?id='+challenge)).status,429);
 t.mock.timers.tick(15*60000);
 assert.equal((await f.call(tokenA,'POST','/auth/match/chat',{id:challenge,message:'po kwadransie'})).status,200);
});

test('CHESS-001: move authorization, legality, version, CSRF and body-reader guards are unchanged',async t=>{
 startClock(t);
 const f=fixture({game:'szachy'});
 const m=(await f.call(tokenA,'GET','/auth/match?id='+challenge)).body.match;
 const post=(token,move,version=m.version,origin)=>f.call(token,'POST','/auth/match',{id:challenge,version,move},origin);
 assert.equal((await post(tokenA,{uci:'e2e4'},m.version,'https://evil.example')).status,403);
 assert.equal((await post('f'.repeat(64),{uci:'e2e4'})).status,401);
 assert.equal((await post(tokenC,{uci:'e2e4'})).status,404);
 assert.equal((await post(tokenB,{uci:'e7e5'})).body.error,'NIE_TWOJA_TURA');
 assert.equal((await post(tokenA,{uci:'e2e5'})).body.error,'NIEDOZWOLONY_RUCH');
 assert.equal((await post(tokenA,{uci:'e2e4'},m.version-1)).body.error,'ODSWIEZ_PARTIE');
 const ok=await post(tokenA,{uci:'e2e4'});assert.equal(ok.status,200);
 assert.equal((await post(tokenA,{uci:'e2e4'})).body.error,'ODSWIEZ_PARTIE','duplicate of an accepted move');
 // At most two in-flight request bodies per session, exactly as before.
 const slow=()=>{
  const req=new PassThrough();
  Object.assign(req,{url:'/auth/match',method:'POST',socket:{remoteAddress:'127.0.0.1'},
   headers:{cookie:'__Host-gracz_session='+tokenA,origin:host,'sec-fetch-site':'same-origin'}});
  const res={status:0,body:'',writeHead(s){this.status=s;},end(v){this.body=String(v||'');}};
  return {req,res,done:f.router.handle(req,res,new URL('/auth/match',host))};
 };
 const first=slow(),second=slow(),third=slow();
 await third.done;
 assert.equal(third.res.status,429);
 first.req.end('{');second.req.end('{');
 await Promise.all([first.done,second.done]);
 assert.equal(first.res.status,400);assert.equal(second.res.status,400);
});

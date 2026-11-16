import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFen,chessTimeoutIsDraw} from '../auth/chess-rules.mjs';
import {fixture,challenge,tokenA,tokenB} from '../test-support/game-matches-fixture.mjs';

const positions=[
 // Each board includes one king per side; 'winner' is the player who would win on time.
 ['K-only cannot win against K+queen','7k/8/8/8/8/8/8/KQ6 w - - 0 1',2,true],
 ['K+queen can mate lone K','7k/8/8/8/8/8/8/KQ6 b - - 0 1',1,false],
 ['K+rook can mate lone K','7k/8/8/8/8/8/8/KR6 b - - 0 1',1,false],
 ['K+knight cannot mate lone K','7k/8/8/8/8/8/8/KN6 b - - 0 1',1,true],
 ['K+bishop cannot mate lone K','7k/8/8/8/8/8/8/KB6 b - - 0 1',1,true],
 ['K+two knights can possibly mate lone K','7k/8/8/8/8/8/8/KNN5 b - - 0 1',1,false],
 ['K+bishop+knight can mate lone K','7k/8/8/8/8/8/8/KBN5 b - - 0 1',1,false],
 ['opposite-colour bishops can mate','6bk/8/8/8/8/8/8/KB6 b - - 0 1',1,false],
 ['same-colour bishops cannot mate','7k/6b1/8/8/8/8/8/KB6 b - - 0 1',1,true],
 ['two same-colour bishops cannot mate lone K','7k/8/8/8/4B3/8/8/K1B5 b - - 0 1',1,true],
 ['two opposite-colour bishops may mate','7k/8/8/8/8/8/8/KBB5 b - - 0 1',1,false],
 ['K+knight vs K+knight may mate','6nk/8/8/8/8/8/8/KN6 b - - 0 1',1,false],
 ['K+bishop vs K+knight may mate','6nk/8/8/8/8/8/8/KB6 b - - 0 1',1,false],
 ['K+knight vs K+rook may mate','6rk/8/8/8/8/8/8/KN6 b - - 0 1',1,false],
 ['K+knight vs K+queen cannot mate (FIDE arbiter table)','6qk/8/8/8/8/8/8/KN6 b - - 0 1',1,true],
 ['K+bishop vs K+queen cannot mate (FIDE arbiter table)','6qk/8/8/8/8/8/8/KB6 b - - 0 1',1,true],
 ['K+bishop vs K+rook cannot mate (FIDE arbiter table)','6rk/8/8/8/8/8/8/KB6 b - - 0 1',1,true],
 ['K+bishop vs K+pawn may mate through blocking','6pk/8/8/8/8/8/8/KB6 b - - 0 1',1,false],
 ['K+knight vs K+pawn may mate through blocking','6pk/8/8/8/8/8/8/KN6 b - - 0 1',1,false],
 ['bare white king cannot mate even a rook','6rk/8/8/8/8/8/8/K7 b - - 0 1',1,true],
 ['bare black king cannot mate even a rook','7k/8/8/8/8/8/8/KR6 w - - 0 1',2,true],
];
test('CHESS-005 FIDE 6.9: conservative mating possibility, including helpmates and both colors',()=>{
 for(const [name,fen,winner,draw] of positions){
  const state=parseFen(fen);
  assert.equal(chessTimeoutIsDraw(state.b,winner),draw,name);
 }
 assert.equal(chessTimeoutIsDraw(null,1),false,'invalid board must not award automatic draw');
 assert.equal(chessTimeoutIsDraw(Array(64).fill('.'),1),false,'invalid board size');
 assert.equal(chessTimeoutIsDraw(parseFen().b,0),false,'winner must be a player');
});

function stage(f,fen){
 const state=parseFen(fen);
 f.setMatchState(old=>({...old,board:state.b,turn:state.t===1?1:2,
  c:state.c,ep:state.ep,half:state.half,full:state.full,winner:0,drawReason:undefined,
  clock:{...old.clock,remaining:[60000,60000],ready:[true,true]}}));
 f.shiftClockSince(61000);
}
test('CHESS-005: real authenticated match GET settles server timeout as FIDE 6.9 draw or win',async()=>{
 const scenarios=[
  {name:'white flags, black bare K => draw',fen:'7k/8/8/8/8/8/8/KQ6 w - - 0 1',winner:3,loser:1},
  {name:'black flags, white K+B vs K => draw',fen:'7k/8/8/8/8/8/8/KB6 b - - 0 1',winner:3,loser:2},
  {name:'white flags, black K+B vs K => draw',fen:'5b1k/8/8/8/8/8/8/K7 w - - 0 1',winner:3,loser:1},
  {name:'white flags, black rook => black wins',fen:'6rk/8/8/8/8/8/8/K7 w - - 0 1',winner:2,loser:1},
  {name:'black flags, white queen => white wins',fen:'7k/8/8/8/8/8/8/KQ6 b - - 0 1',winner:1,loser:2},
  {name:'black flags, white two knights may mate => white wins',fen:'7k/8/8/8/8/8/8/KNN5 b - - 0 1',winner:1,loser:2},
 ];
 for(const item of scenarios){
  const f=fixture({game:'szachy',timeLimitMinutes:1}),get=t=>f.call(t,'GET','/auth/match?id='+challenge);
  assert.equal((await get(tokenA)).status,200);
  const started=await get(tokenB);
  assert.equal(started.status,200);
  assert.equal(started.body.match.version,2);
  stage(f,item.fen);
  const expired=await get(item.loser===1?tokenA:tokenB);
  assert.equal(expired.status,200,item.name);
  assert.equal(expired.body.match.state.winner,item.winner,item.name);
  assert.equal(expired.body.match.state.clock.timeoutLoser,item.loser,item.name);
  assert.equal(expired.body.match.state.clock.remaining[item.loser-1],0,item.name);
  assert.equal(expired.body.match.state.clock.since,null,item.name);
  assert.equal(expired.body.match.state.drawReason,item.winner===3?'BRAK_MOZLIWOSCI_MATA':undefined,item.name);
  const other=await get(item.loser===1?tokenB:tokenA);
  assert.equal(other.body.match.version,expired.body.match.version,'stable settled version');
  assert.equal(other.body.match.state.winner,item.winner,'other user sees same result');
  assert.equal(other.body.match.state.clock.since,null,'clock remains stopped');
  const after=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:other.body.match.version,move:{uci:'a2a3'}});
  assert.equal(after.status,409,item.name);
  assert.equal(after.body.error,'PARTIA_ZAKONCZONA',item.name);
 }
});
test('CHESS-005: POST cannot win on time against bare king even if no GET observed timeout',async()=>{
 const f=fixture({game:'szachy',timeLimitMinutes:1});
 await f.call(tokenA,'GET','/auth/match?id='+challenge);
 await f.call(tokenB,'GET','/auth/match?id='+challenge);
 stage(f,'7k/8/8/8/8/8/8/KQ6 w - - 0 1');
 const rejected=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:2,move:{uci:'b1b2'}});
 assert.equal(rejected.status,409);
 const settled=await f.call(tokenB,'GET','/auth/match?id='+challenge);
 assert.equal(settled.body.match.state.winner,3);
 assert.equal(settled.body.match.state.clock.timeoutLoser,1);
 assert.equal(settled.body.match.state.drawReason,'BRAK_MOZLIWOSCI_MATA');
});
test('CHESS-005: Gomoku and Warcaby preserve their own pre-existing timeout winner policy',async()=>{
 for(const game of ['gomoku','warcaby']){
  const f=fixture({game,timeLimitMinutes:1}),get=t=>f.call(t,'GET','/auth/match?id='+challenge);
  await get(tokenA);await get(tokenB);
  f.shiftClockSince(61000);
  const expired=await get(tokenA);
  assert.equal(expired.status,200,game);
  assert.equal(expired.body.match.state.winner,2,game);
  assert.equal(expired.body.match.state.clock.timeoutLoser,1,game);
  assert.equal(expired.body.match.state.drawReason,undefined,game);
 }
});

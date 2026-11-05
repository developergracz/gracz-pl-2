import test from 'node:test';
import assert from 'node:assert/strict';
import {initialChessMatch,playChessMatch} from '../auth/chess-match.mjs';
test('chess match state starts with 32 pieces and white to move',()=>{
 const s=initialChessMatch();
 assert.equal(s.turn,1);assert.equal(s.board.length,128);
 assert.equal(s.board.filter(p=>p!=='.').length,32);assert.equal(s.winner,0);
 assert.equal(s.history.length,0);assert.equal(s.positions.length,1);
});
test('server controls turns and validates every move',()=>{
 const s=initialChessMatch();
 assert.deepEqual(playChessMatch(s,2,{uci:'e7e5'}),{error:'NIE_TWOJA_TURA'});
 assert.deepEqual(playChessMatch(s,1,{uci:'e2e5'}),{error:'NIEDOZWOLONY_RUCH'});
 assert.deepEqual(playChessMatch(s,1,{uci:'e2e4',board:[]}).state.history[0].uci,'e2e4');
 const white=playChessMatch(s,1,{uci:'e2e4'}).state;
 assert.equal(white.turn,2);
 assert.equal(white.history[0].san,'e4');
 assert.deepEqual(playChessMatch(white,1,{uci:'d2d4'}),{error:'NIE_TWOJA_TURA'});
 assert.equal(playChessMatch(white,2,{uci:'e7e5'}).state.turn,1);
});
test('authoritative match finishes on checkmate and rejects subsequent moves',()=>{
 let s=initialChessMatch();
 for(const [player,uci] of [[1,'f2f3'],[2,'e7e5'],[1,'g2g4'],[2,'d8h4']]){
  const r=playChessMatch(s,player,{uci});assert.ok(r.state,uci);s=r.state;
 }
 assert.equal(s.winner,2);
 assert.deepEqual(playChessMatch(s,1,{uci:'a2a3'}),{error:'PARTIA_ZAKONCZONA'});
});
test('reject malformed chess match state',()=>{
 const broken={...initialChessMatch(),board:Array(64).fill('.')};
 assert.deepEqual(playChessMatch(broken,1,{uci:'e2e4'}),{error:'NIEPRAWIDLOWY_STAN'});
});

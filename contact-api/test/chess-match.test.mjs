import test from 'node:test';
import assert from 'node:assert/strict';
import {initialChessMatch,playChessMatch,undoLastChessMove} from '../auth/chess-match.mjs';
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

test('takeback reconstructs the correct legal chess position from history',()=>{
 let state=initialChessMatch();
 for(const [player,uci] of [[1,'e2e4'],[2,'e7e5'],[1,'g1f3']])
  state=playChessMatch(state,player,{uci}).state;
 assert.deepEqual(undoLastChessMove(state,2),{error:'BRAK_RUCHU_DO_COFNIECIA'});
 const restored=undoLastChessMove(state,1).state;
 const expected=playChessMatch(playChessMatch(initialChessMatch(),1,{uci:'e2e4'}).state,2,{uci:'e7e5'}).state;
 assert.deepEqual(restored,expected);
 assert.equal(restored.turn,1);
 assert.ok(playChessMatch(restored,1,{uci:'f1c4'}).state);
 assert.deepEqual(undoLastChessMove({...state,moves:301},1),{error:'BRAK_RUCHU_DO_COFNIECIA'});
});

test('CHESS-014: server preserves 330 numbered halfmoves and replayable position budget',()=>{
 const original=initialChessMatch();
 const state={...original,moves:330,
  history:Array.from({length:330},(_,i)=>({player:i%2+1,uci:'g1f3',san:'Nf3',number:i+1})),
  positions:Array.from({length:331},(_,i)=>'pos-'+i)};
 const outcome=playChessMatch(state,1,{uci:'e2e4'});
 assert.ok(outcome.state,'authoritative legal move remains accepted');
 assert.equal(outcome.state.moves,331);
 assert.equal(outcome.state.history.length,331);
 assert.equal(outcome.state.history[0].number,1);
 assert.equal(outcome.state.history.at(-1).number,331);
 assert.equal(outcome.state.positions.length,332);
});

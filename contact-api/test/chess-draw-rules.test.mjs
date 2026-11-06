import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFen,key,legal,claimableDraw} from '../auth/chess-rules.mjs';
import {initialChessMatch,playChessMatch} from '../auth/chess-match.mjs';

test('FIDE repetition: phantom en passant does not distinguish identical positions',()=>{
 const noEp=parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
 const phantom=parseFen('4k3/8/8/8/8/8/8/4K3 w - a6 0 1');
 assert.equal(key(noEp),key(phantom));
 const pinned=parseFen('4r1k1/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
 const pinNoEp=parseFen('4r1k1/8/8/3pP3/8/8/8/4K3 w - - 0 1');
 assert.equal(legal(pinned).some(m=>m[3]==='ep'),false);
 assert.equal(key(pinned),key(pinNoEp));
 const legalEp=parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
 const withoutEp=parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1');
 assert.notEqual(key(legalEp),key(withoutEp));
});
test('FIDE: no draw claim on ordinary starting position or wrong turn',()=>{
 const state=initialChessMatch();
 assert.deepEqual(playChessMatch(state,1,{claimDraw:true}),{error:'REMIS_NIEDOSTEPNY'});
 assert.deepEqual(playChessMatch(state,2,{claimDraw:true}),{error:'NIE_TWOJA_TURA'});
});
test('FIDE: threefold repetition can be claimed but does not end game without claim',()=>{
 let s=initialChessMatch();
 const cycle=[[1,'b1c3'],[2,'b8c6'],[1,'c3b1'],[2,'c6b8']];
 for(let i=0;i<2;i++)for(const [player,uci] of cycle){
  const r=playChessMatch(s,player,{uci});
  assert.ok(r.state,uci);s=r.state;
 }
 assert.equal(s.winner,0);
 assert.equal(claimableDraw({b:s.board,t:1,c:s.c,ep:s.ep,half:s.half,full:s.full},s.positions),'TRZYKROTNE_POWTORZENIE');
 const claimed=playChessMatch(s,1,{claimDraw:true});
 assert.equal(claimed.state.winner,3);
 assert.equal(claimed.state.drawReason,'TRZYKROTNE_POWTORZENIE');
 assert.equal(claimed.state.moves,s.moves);
 assert.deepEqual(claimed.state.board,s.board);
 assert.deepEqual(playChessMatch(claimed.state,1,{uci:'e2e4'}),{error:'PARTIA_ZAKONCZONA'});
});
test('FIDE: player on turn can claim draw after 50 quiet full moves',()=>{
 const s={...initialChessMatch(),half:100};
 const r=playChessMatch(s,1,{claimDraw:true});
 assert.equal(r.state?.winner,3);
 assert.equal(r.state?.drawReason,'50_RUCHOW');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFen,initial,legal,move,square,coord,check,result} from '../auth/chess-rules.mjs';
import {initialChessMatch,playChessMatch} from '../auth/chess-match.mjs';

const moves=state=>legal(state).map(m=>coord(m[0])+coord(m[1])+m[2]);

test('castling moves king and rook, revokes rights, and is forbidden out of check',()=>{
 const start=parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
 assert.ok(moves(start).includes('e1g1'));
 assert.ok(moves(start).includes('e1c1'));
 const next=move(start,'e1g1');
 assert.ok(next);
 assert.equal(next.b[square('g1')],'K');
 assert.equal(next.b[square('f1')],'R');
 assert.equal(next.b[square('h1')],'.');
 assert.equal(next.c&3,0);
 const inCheck=parseFen('k3r3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
 assert.equal(check(inCheck),true);
 assert.ok(!moves(inCheck).includes('e1g1'));
 assert.ok(!moves(inCheck).includes('e1c1'));
});

test('en passant removes only passed pawn, not the destination piece',()=>{
 const s=parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
 assert.ok(moves(s).includes('e5d6'));
 const n=move(s,'e5d6');
 assert.equal(n.b[square('d6')],'P');
 assert.equal(n.b[square('d5')],'.');
 assert.equal(n.b[square('e5')],'.');
 assert.equal(n.ep,-1);
});

test('promotion offers queen/rook/bishop/knight; player choice is saved',()=>{
 const start=parseFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
 for(const promotion of ['q','r','b','n']){
  assert.ok(moves(start).includes('a7a8'+promotion));
  const promoted=move(start,'a7a8'+promotion);
  assert.equal(promoted.b[square('a8')],promotion.toUpperCase());
  assert.equal(promoted.b[square('a7')],'.');
 }
 assert.equal(move(start,'a7a8'),null,'promotion without a chosen piece is illegal');
});

test('pat is a draw, checkmate rejects further actions and check is detected',()=>{
 const pat=parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
 assert.equal(legal(pat).length,0);
 assert.equal(check(pat),false);
 assert.equal(result([pat]),'Pat — remis');
 let state=initialChessMatch();
 for(const [player,uci] of [[1,'f2f3'],[2,'e7e5'],[1,'g2g4'],[2,'d8h4']]){
  const action=playChessMatch(state,player,{uci});
  assert.ok(action.state,uci);
  state=action.state;
 }
 assert.equal(state.winner,2);
 assert.match(state.history.at(-1).san,/#$/);
 assert.deepEqual(playChessMatch(state,1,{uci:'e2e4'}),{error:'PARTIA_ZAKONCZONA'});
});

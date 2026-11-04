import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,legalCaptures,playMove} from '../auth/game-engine.mjs';

function game(pieces,{turn=1,quiet=0,forced=null}={}){
 const board=Array(64).fill(0);
 for(const [square,piece] of pieces)board[square]=piece;
 return {...initialGame('warcaby'),board,turn,quiet,forced};
}
function play(state,from,to,player=state.turn){return playMove('warcaby',state,player,{from,to})}

test('P1-1: men never capture backwards or force a backward capture',()=>{
 const s=game([[35,1],[26,2]]);
 assert.deepEqual(legalCaptures(s.board,1,35),[]);
 assert.equal(play(s,35,17).error,'NIEDOZWOLONY_RUCH');
 const forward=play(s,35,44);
 assert.ok(forward.state,'valid forward move may not be blocked by backward capture');
 assert.equal(forward.state.quiet,0);
});
test('P1-1: normal forward capture is still mandatory',()=>{
 const s=game([[17,1],[26,2],[40,1]]);
 assert.deepEqual(legalCaptures(s.board,1,17).map(c=>c.to),[35]);
 assert.equal(play(s,40,49).error,'BICIE_OBOWIAZKOWE');
 assert.equal(play(s,17,35).state.board[26],0);
});
test('P1-2: flying king can slide over empty squares but not other pieces',()=>{
 const s=game([[17,3],[63,2]]);
 assert.ok(play(s,17,44).state);
 assert.equal(play(game([[17,3],[26,1],[63,2]]),17,44).error,'NIEDOZWOLONY_RUCH');
});
test('P1-2: flying king captures one opponent and chooses a distant landing square',()=>{
 const s=game([[17,3],[35,2]]);
 const captures=legalCaptures(s.board,1,17);
 assert.ok(captures.some(x=>x.to===53&&x.taken===35));
 const result=play(s,17,53);
 assert.ok(result.state);
 assert.equal(result.state.board[35],0);
 assert.equal(result.state.board[53],3);
});
test('P1-2: no flying king capture through two pieces',()=>{
 const s=game([[17,3],[35,2],[44,2]]);
 assert.ok(!legalCaptures(s.board,1,17).some(x=>x.to===53));
 assert.equal(play(s,17,53).error,'NIEDOZWOLONY_RUCH');
});
test('P1-2: promotion during capture continues as a flying king',()=>{
 const s=game([[40,1],[49,2],[44,2]]);
 const first=play(s,40,58);
 assert.ok(first.state);
 assert.equal(first.state.board[58],3);
 assert.equal(first.state.turn,1);
 assert.equal(first.state.forced,58);
 const second=play(first.state,58,37);
 assert.ok(second.state);
 assert.equal(second.state.board[44],0);
 assert.equal(second.state.forced,null);
 assert.equal(second.state.board[37],3);
});
test('P1-3: pawn move resets 80-ply no-progress count',()=>{
 const s=game([[17,1],[56,2]],{quiet:79});
 const result=play(s,17,26);
 assert.ok(result.state);
 assert.equal(result.state.quiet,0);
 assert.notEqual(result.state.winner,3);
});
test('P1-3: only eighty quiet king moves can trigger draw',()=>{
 const s=game([[17,3],[56,4]],{quiet:79});
 const result=play(s,17,26);
 assert.ok(result.state);
 assert.equal(result.state.quiet,80);
 assert.equal(result.state.winner,3);
});
test('legacy persisted match without forced or quiet still accepts a valid move',()=>{
 const s=game([[17,1],[56,2]]);
 delete s.forced;delete s.quiet;
 const result=play(s,17,26);
 assert.ok(result.state);
 assert.equal(result.state.forced,null);
 assert.equal(result.state.quiet,0);
});
test('Gomoku engine remains server-authoritative and unchanged',()=>{
 const s=initialGame('gomoku');
 const result=playMove('gomoku',s,1,{to:112});
 assert.equal(result.state.board[112],1);
 assert.equal(result.state.turn,2);
});

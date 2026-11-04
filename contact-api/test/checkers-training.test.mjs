import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,playMove,legalMoves,chooseComputerMove} from '../auth/checkers-training-ai.mjs';

test('training uses the online rules and legal starting positions',()=>{
 const initial=initialGame('warcaby');
 assert.equal(initial.board.filter(p=>p===1).length,12);
 assert.equal(initial.board.filter(p=>p===2).length,12);
 assert.equal(initial.turn,1);
 assert.equal(legalMoves(initial).length,7);
 const whiteMove=legalMoves(initial)[0];
 const step=playMove('warcaby',initial,1,whiteMove);
 assert.equal(step.error,undefined);
 assert.equal(step.state.turn,2);
 assert.deepEqual(initialGame('warcaby'),initial);
});

test('AI chooses a real legal move at all four levels',()=>{
 const start=initialGame('warcaby');
 const white=playMove('warcaby',start,1,legalMoves(start)[0]).state;
 for(const level of ['normal','hard','expert','master']){
  const before=JSON.stringify(white);
  const choice=chooseComputerMove(white,level,{maxMs:140,maxNodes:600});
  assert.ok(choice,'no move for '+level);
  assert.ok(legalMoves(white).some(m=>m.from===choice.from&&m.to===choice.to));
  const played=playMove('warcaby',white,2,choice);
  assert.equal(played.error,undefined);
  assert.equal(JSON.stringify(white),before,'AI must not mutate game state');
 }
});

test('AI obeys mandatory captures and short-men backwards restrictions',()=>{
 const board=Array(64).fill(0);
 board[42]=2;board[35]=1;
 const state={board,turn:2,winner:0,moves:3,forced:null,quiet:0};
 const moves=legalMoves(state);
 assert.deepEqual(moves.map(m=>({from:m.from,to:m.to})),[{from:42,to:28}]);
 const choice=chooseComputerMove(state,'expert',{maxMs:140,maxNodes:600});
 assert.equal(choice.from,42);
 assert.equal(choice.to,28);
 const next=playMove('warcaby',state,2,choice);
 assert.equal(next.error,undefined);
 assert.equal(next.state.board[35],0);
});

test('flying kings, promotion and multi-capture are inherited from the main engine',()=>{
 const board=Array(64).fill(0);
 board[42]=4;board[35]=1;
 const state={board,turn:2,winner:0,moves:0,forced:null,quiet:0};
 const destinations=legalMoves(state).map(m=>m.to);
 for(const to of [28,21,14,7])assert.ok(destinations.includes(to),'king landing '+to);
 const chosen=chooseComputerMove(state,'master',{maxMs:140,maxNodes:600});
 assert.equal(playMove('warcaby',state,2,chosen).error,undefined);
 const nextBoard=Array(64).fill(0);nextBoard[10]=2;nextBoard[53]=1;
 const next={board:nextBoard,turn:2,winner:0,moves:0,forced:null,quiet:0};
 const promotion=playMove('warcaby',next,2,{from:10,to:1});
 assert.equal(promotion.error,undefined);
 assert.equal(promotion.state.board[1],4);
});

test('no computer move is produced on the human turn or after a result',()=>{
 const initial=initialGame('warcaby');
 assert.equal(chooseComputerMove(initial,'normal'),null);
 const after={...initial,turn:2,winner:1};
 assert.equal(chooseComputerMove(after,'master'),null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,legal,apply,parseFen,check} from '../auth/chess-rules.mjs';
import {chooseComputerMove} from '../auth/chess-computer.mjs';
test('computer replies with a legal black move after white opening',()=>{
 const state=initial(),white=legal(state).find(m=>m[0]===100&&m[1]===68);
 assert.ok(white);
 const after=apply(state,white);
 for(const level of ['beginner','normal','hard','master']){
  const before=Date.now();
  const answer=chooseComputerMove(after,{level,maxMs:350});
  assert.ok(answer,level);
  assert.ok(legal(after).some(m=>JSON.stringify(m)===JSON.stringify(answer)));
  assert.ok(Date.now()-before<3000,'computer calculation stays bounded');
  assert.equal(apply(after,answer).t,1);
 }
});
test('computer cannot move on a terminal board',()=>{
 const over=parseFen('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');
 assert.equal(legal(over).length,0);
 assert.equal(chooseComputerMove(over,{level:'master'}),null);
});
test('computer supports quiet positions without fabricated moves',()=>{
 const state=parseFen('8/4k3/8/8/8/8/4P3/4K3 w - - 0 1');
 const a=chooseComputerMove(state,{level:'normal',maxMs:250});
 assert.ok(legal(state).some(m=>JSON.stringify(m)===JSON.stringify(a)));
});

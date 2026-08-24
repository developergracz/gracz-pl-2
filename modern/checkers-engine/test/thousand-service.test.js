import test from 'node:test';
import assert from 'node:assert/strict';

import { ThousandGameService } from '../src/thousand-service.js';
import { MemoryThousandRepository } from '../src/thousand-repository.js';

const players=[
  {userId:'anna',displayName:'Anna'},
  {userId:'bartek',displayName:'Bartek'},
  {userId:'celina',displayName:'Celina'},
];

function deterministicRandom(){ return 0.3141592653; }

test('serwis tworzy grę dla dokładnie trzech unikalnych graczy',async()=>{
  const service=new ThousandGameService({repository:new MemoryThousandRepository(),random:deterministicRandom});
  const game=await service.createGame({gameId:'game-0001',players});
  assert.equal(game.players.length,3);
  assert.equal(game.revision,1);
  await assert.rejects(()=>service.createGame({gameId:'game-0002',players:[players[0],players[0],players[2]]}),/innego gracza/);
});

test('widok gracza ukrywa cudze karty',async()=>{
  const service=new ThousandGameService({repository:new MemoryThousandRepository(),random:deterministicRandom});
  await service.createGame({gameId:'game-0003',players});
  const view=await service.getView('game-0003','anna');
  assert.equal(view.viewerIndex,0);
  assert.equal(view.state.hands['player-1'][0].hidden,undefined);
  assert.equal(view.state.hands['player-2'][0].hidden,true);
});

test('serwer wyznacza indeks gracza i ignoruje podszywanie się w akcji',async()=>{
  const service=new ThousandGameService({repository:new MemoryThousandRepository(),random:deterministicRandom});
  await service.createGame({gameId:'game-0004',players,dealerIndex:0});
  await assert.rejects(
    ()=>service.performAction('game-0004','anna',{type:'bid',playerIndex:1,amount:100}),
    /kolej/
  );
  const result=await service.performAction('game-0004','bartek',{type:'bid',playerIndex:0,amount:100});
  assert.equal(result.revision,2);
  assert.equal(result.state.bid.highestBidderIndex,1);
});

test('kontrola revision blokuje ruch na nieaktualnym stanie',async()=>{
  const service=new ThousandGameService({repository:new MemoryThousandRepository(),random:deterministicRandom});
  await service.createGame({gameId:'game-0005',players,dealerIndex:0});
  await service.performAction('game-0005','bartek',{type:'bid',amount:100},{expectedRevision:1});
  await assert.rejects(
    ()=>service.performAction('game-0005','celina',{type:'pass'},{expectedRevision:1}),
    error=>error?.code==='STALE_GAME_REVISION'
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  THOUSAND_MARRIAGE_POINTS,
  cardBeats,
  createThousandDeck,
  createThousandInitialState,
  getThousandMarriageValue,
  handHasMarriage,
  passThousandBid,
  placeThousandBid,
  serializeThousandState,
  deserializeThousandState,
} from '../src/thousand-engine.js';

test('talia Tysiąca ma 24 unikalne karty i 120 punktów', () => {
  const deck=createThousandDeck();
  assert.equal(deck.length,24);
  assert.equal(new Set(deck.map(card=>card.id)).size,24);
  assert.equal(deck.reduce((sum,card)=>sum+card.points,0),120);
});

test('rozdanie daje każdemu 7 kart i 3 karty do musika', () => {
  const state=createThousandInitialState({dealerIndex:0});
  assert.equal(state.status,'bidding');
  assert.equal(state.currentPlayerIndex,1);
  assert.equal(state.hands['player-1'].length,7);
  assert.equal(state.hands['player-2'].length,7);
  assert.equal(state.hands['player-3'].length,7);
  assert.equal(state.talon.length,3);
});

test('licytacja rozpoczyna się od minimum 100 i rośnie co 10', () => {
  let state=createThousandInitialState({dealerIndex:0});
  state=placeThousandBid(state,1,100);
  assert.equal(state.bid.highest,100);
  assert.equal(state.currentPlayerIndex,2);
  assert.throws(()=>placeThousandBid(state,2,100),/wyższa/);
  state=placeThousandBid(state,2,110);
  assert.equal(state.bid.highest,110);
});

test('po dwóch pasach zwycięzca licytacji przechodzi do etapu musika', () => {
  let state=createThousandInitialState({dealerIndex:0});
  state=placeThousandBid(state,1,100);
  state=passThousandBid(state,2);
  state=passThousandBid(state,0);
  assert.equal(state.status,'talon');
  assert.equal(state.declarerIndex,1);
  assert.equal(state.contract,100);
});

test('meldunki mają standardowe wartości 40, 60, 80, 100', () => {
  assert.deepEqual(THOUSAND_MARRIAGE_POINTS,{spades:40,clubs:60,diamonds:80,hearts:100});
  assert.equal(getThousandMarriageValue('hearts'),100);
});

test('wykrywa króla i damę tego samego koloru jako meldunek', () => {
  const hand=[
    {id:'hearts-K',suit:'hearts',rank:'K',points:4},
    {id:'hearts-Q',suit:'hearts',rank:'Q',points:3},
  ];
  assert.equal(handHasMarriage(hand,'hearts'),true);
  assert.equal(handHasMarriage(hand,'clubs'),false);
});

test('atut bije kartę koloru wyjścia, a wyższa karta bije niższą w tym samym kolorze', () => {
  const heartA={id:'hearts-A',suit:'hearts',rank:'A',points:11};
  const heart10={id:'hearts-10',suit:'hearts',rank:'10',points:10};
  const club9={id:'clubs-9',suit:'clubs',rank:'9',points:0};
  assert.equal(cardBeats(heartA,heart10,'hearts'),true);
  assert.equal(cardBeats(club9,heartA,'hearts','clubs'),true);
});

test('stan można bezpiecznie zapisać i odtworzyć', () => {
  const state=createThousandInitialState();
  const restored=deserializeThousandState(serializeThousandState(state));
  assert.deepEqual(restored,state);
  assert.equal(Object.isFrozen(restored),true);
});

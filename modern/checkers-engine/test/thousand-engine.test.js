import test from 'node:test';
import assert from 'node:assert/strict';

import {
  THOUSAND_MARRIAGE_POINTS,
  cardBeats,
  createThousandDeck,
  createThousandInitialState,
  declareThousandContract,
  deserializeThousandState,
  getLegalThousandCards,
  getThousandMarriageValue,
  giveThousandCards,
  handHasMarriage,
  passThousandBid,
  placeThousandBid,
  playThousandCard,
  serializeThousandState,
  takeThousandTalon,
  thousandPublicView,
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

test('rozgrywający bierze musik i przekazuje po jednej karcie przeciwnikom', () => {
  let state=wonAuction();
  state=takeThousandTalon(state,1);
  assert.equal(state.hands['player-2'].length,10);
  assert.equal(state.talon.length,0);
  const [first,second]=state.hands['player-2'];
  state=giveThousandCards(state,1,[
    {toPlayerIndex:0,cardId:first.id},
    {toPlayerIndex:2,cardId:second.id},
  ]);
  assert.equal(state.status,'contract');
  assert.deepEqual(Object.values(state.hands).map(hand=>hand.length),[8,8,8]);
});

test('kontrakt nie może być niższy od wygranej licytacji', () => {
  let state=wonAuction(120);
  state=takeThousandTalon(state,1);
  state=giveThousandCards(state,1,giftsForDeclarer(state,1));
  assert.throws(()=>declareThousandContract(state,1,110),/niższy/);
  state=declareThousandContract(state,1,120);
  assert.equal(state.status,'playing');
  assert.equal(state.currentPlayerIndex,1);
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

test('widok publiczny nie ujawnia kart przeciwników ani musika', () => {
  const state=createThousandInitialState();
  const view=thousandPublicView(state,0);
  assert.equal(view.hands['player-1'][0].hidden,undefined);
  assert.equal(view.hands['player-2'][0].hidden,true);
  assert.equal(view.hands['player-3'][0].hidden,true);
  assert.equal(view.talon.every(card=>card.hidden===true),true);
});

test('pełne rozdanie przechodzi od licytacji do punktacji bez utraty kart', () => {
  let state=wonAuction();
  state=takeThousandTalon(state,1);
  state=giveThousandCards(state,1,giftsForDeclarer(state,1));
  state=declareThousandContract(state,1,100);

  let safety=100;
  while(state.status==='playing'&&safety-->0){
    const player=state.currentPlayerIndex;
    const legal=getLegalThousandCards(state,player);
    assert.ok(legal.length>0);
    state=playThousandCard(state,player,legal[0]);
  }

  assert.ok(['round-ended','game-ended'].includes(state.status));
  assert.equal(state.trickNumber,8);
  assert.equal(Object.values(state.hands).every(hand=>hand.length===0),true);
  assert.equal(Object.values(state.cardPoints).reduce((a,b)=>a+b,0),120);
  assert.ok(state.roundResult);
});

test('stan można bezpiecznie zapisać i odtworzyć', () => {
  const state=createThousandInitialState();
  const restored=deserializeThousandState(serializeThousandState(state));
  assert.deepEqual(restored,state);
  assert.equal(Object.isFrozen(restored),true);
  assert.equal(Object.isFrozen(restored.hands['player-1']),true);
});

function wonAuction(amount=100){
  let state=createThousandInitialState({dealerIndex:0});
  state=placeThousandBid(state,1,amount);
  state=passThousandBid(state,2);
  state=passThousandBid(state,0);
  return state;
}

function giftsForDeclarer(state,declarerIndex){
  const key=`player-${declarerIndex+1}`;
  const cards=state.hands[key].slice(0,2);
  const opponents=[0,1,2].filter(index=>index!==declarerIndex);
  return opponents.map((toPlayerIndex,index)=>({toPlayerIndex,cardId:cards[index].id}));
}

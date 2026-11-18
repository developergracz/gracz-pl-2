import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCheckersDrawAgreement as decide} from '../auth/checkers-draw-agreement.mjs';

const make=()=>({board:Array(64).fill(0),turn:2,moves:4,winner:0,
 clock:{ready:[true,true],since:'2026-11-18T11:00:00Z',remaining:[300000,300000]}});
const offer=(s,player=1)=>decide(s,player,'offerDraw',null,
 ()=> 'fixed-id',()=> '2026-11-18T11:01:00Z');

test('both sides must agree: offer persists with clock running, only opponent accepts',()=>{
 const initial=make(),pending=offer(initial);
 assert.equal(pending.error,undefined);
 assert.deepEqual(pending.state.drawOffer,
  {id:'fixed-id',requester:1,createdAt:'2026-11-18T11:01:00Z'});
 assert.equal(pending.state.clock.since,initial.clock.since);
 assert.equal(initial.drawOffer,undefined,'original state is never mutated');
 assert.equal(decide(pending.state,1,'acceptDraw','fixed-id').error,'BRAK_ZGODY_PRZECIWNIKA');
 const accepted=decide(pending.state,2,'acceptDraw','fixed-id');
 assert.equal(accepted.error,undefined);
 assert.equal(accepted.state.winner,3);
 assert.equal(accepted.state.drawReason,'ZGODA_GRACZY');
 assert.equal(accepted.state.drawOffer,undefined);
 assert.equal(accepted.state.clock.since,null);
 assert.equal(pending.state.winner,0,'past state unchanged');
});
test('opponent may reject; requester may cancel; unauthorized actions are refused',()=>{
 const pending=offer(make()).state;
 assert.equal(decide(pending,2,'offerDraw').error,'PROPOZYCJA_JUZ_ISTNIEJE');
 assert.equal(decide(pending,2,'cancelDraw','fixed-id').error,'NIE_TWOJA_PROPOZYCJA');
 assert.equal(decide(pending,1,'rejectDraw','fixed-id').error,'BRAK_ZGODY_PRZECIWNIKA');
 assert.equal(decide(pending,2,'acceptDraw','wrong-id').error,'PROPOZYCJA_NIEAKTUALNA');
 assert.equal(decide(pending,2,'rejectDraw','fixed-id').state.drawOffer,undefined);
 assert.equal(decide(pending,1,'cancelDraw','fixed-id').state.drawOffer,undefined);
});
test('terminal, pre-start, stale, missing and invalid actions all fail closed',()=>{
 assert.equal(offer({...make(),winner:1}).error,'PARTIA_ZAKONCZONA');
 assert.equal(offer({...make(),moves:0}).error,'PARTIA_NIE_ROZPOCZETA');
 assert.equal(decide(make(),2,'acceptDraw','fixed-id').error,'PROPOZYCJA_NIEAKTUALNA');
 assert.equal(decide(make(),0,'offerDraw').error,'BRAK_GRACZA');
 assert.equal(decide(make(),1,'unknown').error,'BLEDNA_AKCJA');
});

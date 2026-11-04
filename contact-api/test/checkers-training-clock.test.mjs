import test from 'node:test';
import assert from 'node:assert/strict';
import {setupTraining} from '../auth/checkers-training-ui.mjs';
import {legalMoves} from '../auth/checkers-training-ai.mjs';

test('Warcaby clocks start after the first legal white move, not New game',t=>{
 const elements=new Map();
 function $(id){
  if(!elements.has(id)){
   elements.set(id,{
    value:id==='training-time'?'7':id==='training-increment'?'0':id==='ai-level'?'normal':'',
    textContent:'',hidden:false,disabled:false,style:{},dataset:{},selectedOptions:[{textContent:'Normalny'}],
    classList:{toggle(){}},addEventListener(){},setAttribute(){},
    click(){},focus(){},append(){},replaceChildren(){},
   });
  }
  return elements.get(id);
 }
 const oldDocument=globalThis.document,oldStorage=globalThis.localStorage;
 globalThis.document={createElement:()=>({textContent:'',className:'',append(){}})};
 globalThis.localStorage={getItem:()=>null,setItem(){}};
 t.after(()=>{
  if(oldDocument===undefined)delete globalThis.document;
  else globalThis.document=oldDocument;
  if(oldStorage===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=oldStorage;
 });
 let now=0,clockTick,game=null;
 t.mock.method(performance,'now',()=>now);
 t.mock.method(globalThis,'setInterval',callback=>{clockTick=callback;return 0;});
 t.mock.method(globalThis,'setTimeout',()=>0); // keep computer response deterministic
 const training=setupTraining({
  $,validMatch:false,squareLabel:i=>String(i),message(){},
  getCurrent:()=>game,setCurrent:value=>{game=value},setSelected(){},setMode(){},
  renderBoard(){},renderPreview(){},loadRooms(){},refresh(){},refreshChat(){}
 });
 training.setMode('training');
 assert.equal($('clock-2').textContent,'07:00');
 assert.equal($('clock-1').textContent,'07:00');
 now=18000;clockTick();
 assert.equal($('clock-2').textContent,'07:00','white clock must wait before first move');
 assert.equal($('clock-1').textContent,'07:00','black clock must wait before first move');
 // An illegal attempt must not start either clock.
 training.playTrainingMove({from:0,to:1});
 now=25000;clockTick();
 assert.equal($('clock-2').textContent,'07:00');
 assert.equal($('clock-1').textContent,'07:00');
 const move=legalMoves(game.state)[0];
 training.playTrainingMove(move);
 assert.equal(game.state.turn,2,'computer turn follows the first valid white move');
 assert.equal($('clock-2').textContent,'07:00','white did not lose pre-move time');
 now=28000;clockTick();
 assert.equal($('clock-2').textContent,'07:00');
 assert.equal($('clock-1').textContent,'06:57','black clock must now run');
 training.undoTraining();
 assert.equal(game.state.turn,1);
 assert.equal($('clock-1').textContent,'07:00','undo restores computer time');
 now=48000;clockTick();
 assert.equal($('clock-2').textContent,'07:00','undo first turn restores pre-start pause');
 assert.equal($('clock-1').textContent,'07:00');
 training.startTraining();
 now=60000;clockTick();
 assert.equal($('clock-2').textContent,'07:00','New game resets start gate');
 assert.equal($('clock-1').textContent,'07:00');
});

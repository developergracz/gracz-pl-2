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
    textContent:'',hidden:false,disabled:false,
    style:{vars:{},setProperty(name,value){this.vars[name]=value},removeProperty(name){delete this.vars[name]}},
    offsetWidth:0,dataset:{},selectedOptions:[{textContent:'Normalny'}],
    classList:{classes:new Set(),toggle(name,enabled){if(enabled)this.classes.add(name);else this.classes.delete(name)},contains(name){return this.classes.has(name)},add(name){this.classes.add(name)},remove(...names){for(const name of names)this.classes.delete(name)}},addEventListener(event,fn){if(event==='change')this.onChange=fn},setAttribute(){},
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
 $('create-room-time').value='7';
 training.setMode('online');
 assert.equal($('clock-1').textContent,'07:00','waiting black online clock previews default 7 minutes');
 assert.equal($('clock-2').textContent,'07:00','waiting white online clock previews default 7 minutes');
 $('create-room-time').value='10';$('create-room-time').onChange();
 assert.equal($('clock-1').textContent,'10:00','online clock previews changed invite limit');
 $('create-room-time').value='0';$('create-room-time').onChange();
 assert.equal($('clock-2').textContent,'--:--','untimed invitation has no countdown');
 assert.equal($('clock-2').classList.contains('checkers-clock-critical'),false);
 game={state:{clock:{remaining:[30000,31000],ready:[false,false],since:null},turn:1,winner:0}};
 clockTick();
 assert.equal($('clock-2').textContent,'00:30');
 assert.equal($('clock-2').classList.contains('checkers-clock-critical'),true,
  'white time turns red at exactly thirty seconds online');
 assert.equal($('clock-2').style.vars.color,'rgb(95,43,50)','the real digit node receives urgent inline color');
 assert.equal($('clock-2').style.vars['--checkers-clock-shade'],'rgb(95,43,50)',
  'at 30 seconds the digits are only subtly red');
 assert.equal($('clock-2').classList.contains('checkers-clock-pulse-twice'),true,
  '00:30 starts with two pulses');
 assert.equal($('clock-1').classList.contains('checkers-clock-critical'),false,
  'black still has 31 seconds online');
 game.state.clock.remaining=[31000,29000];clockTick();
 assert.equal($('clock-2').classList.contains('checkers-clock-critical'),false);
 assert.equal($('clock-1').classList.contains('checkers-clock-critical'),true,
  'black time is red with 29 seconds');
 assert.equal($('clock-1').classList.contains('checkers-clock-pulse-twice'),true,
  'skipping 30 seconds between ticks still detects the threshold');
 game.state.clock.remaining=[31000,20000];clockTick();
 assert.equal($('clock-1').classList.contains('checkers-clock-pulse-once'),true,'single pulse at 00:20');
 assert.equal($('clock-1').classList.contains('checkers-clock-pulse-twice'),false);
 const at20=$('clock-1').style.vars['--checkers-clock-shade'];
 game.state.clock.remaining=[31000,10000];clockTick();
 assert.equal($('clock-1').classList.contains('checkers-clock-pulse-once'),true,'single pulse at 00:10');
 const at10=$('clock-1').style.vars['--checkers-clock-shade'];
 assert.notEqual(at10,at20,'red becomes progressively stronger between milestones');
 game.state.clock.remaining=[31000,5000];clockTick();
 assert.equal($('clock-1').classList.contains('checkers-clock-pulse-once'),true,'single pulse at 00:05');
 game.state.clock.remaining=[31000,1000];clockTick();
 assert.equal($('clock-1').style.vars['--checkers-clock-shade'],'rgb(255,0,0)',
  'the last second is fully saturated pure red');
 assert.equal($('clock-1').style.vars.color,'rgb(255,0,0)','the actual clock text becomes pure red');
 game.state.clock.remaining=[31000,35000];clockTick();
 assert.equal($('clock-1').classList.contains('checkers-clock-critical'),false);
 assert.equal($('clock-1').style.vars['--checkers-clock-shade'],undefined,
  'time restored above 30 seconds clears the warning color');
 assert.equal($('clock-1').style.vars.color,undefined,'the inline urgency color gets cleared too');
 assert.equal($('clock-1').classList.contains('checkers-clock-pulse-once'),false);
 game=null;
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
 now=415000;clockTick();
 assert.equal($('clock-1').textContent,'00:30');
 assert.equal($('clock-1').classList.contains('checkers-clock-critical'),true,
  'training black clock turns red with 30 seconds left');
 assert.equal($('clock-1').classList.contains('checkers-clock-pulse-twice'),true);
 assert.equal($('clock-2').classList.contains('checkers-clock-critical'),false);
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

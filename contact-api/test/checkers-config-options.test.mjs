import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

function asset(serve,path){
 const response={status:0,body:'',headers:{},
  writeHead(code,headers){this.status=code;this.headers=headers},
  end(body){this.body=String(body||'')}};
 assert.equal(serve({method:'GET'},response,new URL('https://example.com'+path)),true,path);
 assert.equal(response.status,200,path);
 return response.body;
}
const html=asset(serveCheckersConsole,'/konto/warcaby/');
const css=asset(serveCheckersConsole,'/konto/warcaby/styl.css');
const sharedCss=asset(serveGomokuConsole,'/konto/gomoku/styl.css');
const app=asset(serveCheckersConsole,'/konto/warcaby/app.js');
const from=app.indexOf('const consoleLayoutKey=');
const to=app.indexOf('function playTrainingMove(move)',from);
assert.ok(from>=0&&to>from,'extract actual, production configurator, not a test clone');
const configCode=app.slice(from,to);
const names=['sidebar','dock','players','quicklinks','status','bottom','tools',
 'training-settings','training-records','online-settings','replay','chat-history',
 'chat-input','heading','mode'];
const selectors=[
 ['sidebar','class="sidebar"'],['dock','class="side-dock"'],['players','class="players"'],
 ['quicklinks','class="premium-quick-links"'],['status','id="game-state"'],
 ['bottom','class="bottom"'],['tools','class="game-tools checkers-toolbar"'],
 ['training-settings','id="training-settings"'],['training-records','id="training-records"'],
 ['online-settings','id="online-settings"'],['replay','class="replay-shortcut"'],
 ['chat-history','id="chat-messages"'],['chat-input','id="chat-input"'],
 ['heading','class="side-header"'],['mode','class="mode"']
];

function makeHarness(saved=new Map()){
 const elements=new Map();
 const document={activeElement:null,events:Object.create(null)};
 function element(tag='div'){
  const classes=new Set(),events=Object.create(null);
  const result={
   tagName:tag,hidden:false,className:'',textContent:'',attributes:{},children:[],
   classList:{
    toggle(key,force){const enabled=force===undefined?!classes.has(key):Boolean(force);
     if(enabled)classes.add(key);else classes.delete(key);return enabled},
    contains:key=>classes.has(key),add:key=>classes.add(key),remove:key=>classes.delete(key)
   },
   addEventListener(type,listener){(events[type]??=[]).push(listener)},
   dispatch(type,details={}){const e={target:this,preventDefault(){this.prevented=true},
    key:undefined,shiftKey:false,...details};for(const handler of events[type]||[])handler(e);return e},
   click(){return this.dispatch('click')},
   append(...children){this.children.push(...children)},
   replaceChildren(...children){this.children=children},
   setAttribute(key,value){this.attributes[key]=String(value)},
   focus(){document.activeElement=this},
  };
  return result;
 }
 document.createElement=element;
 document.addEventListener=(type,fn)=>{(document.events[type]??=[]).push(fn)};
 document.dispatch=(type,options)=>{for(const fn of document.events[type]||[])fn(options)};
 const $=id=>{
  if(!elements.has(id)){
   const item=element();
   if(id==='console-config-fab'||id==='console-config-modal')item.hidden=true;
   elements.set(id,item);
  }
  return elements.get(id);
 };
 const window={localStorage:{
  getItem:key=>saved.get(key)??null,
  setItem:(key,value)=>saved.set(key,String(value))
 }};
 const context={document,window,$};
 new Script(configCode+"\nglobalThis.__config={consoleParts,consoleHidden,setConsolePreset,applyConsoleLayout,changeConsoleLayout,setBoardFocusMode};").runInNewContext(context);
 const tiles=$('console-config-tiles').children;
 return {document,window,$,tiles,context,storage:saved,
  tap:(i)=>tiles[i].children[2].click(),
  action:(id)=>$(id).click(),
  classes:()=>names.filter(key=>$('game').classList.contains('console-hide-'+key))};
}

test('all 15 configurator tiles exist, have matching page elements and CSS visibility rules',()=>{
 const ui=makeHarness();
 assert.equal(ui.tiles.length,15);
 assert.equal(ui.$('console-config-count').textContent,'Widoczne: 15 z 15');
 assert.deepEqual(Array.from(ui.context.__config.consoleParts,part=>part[0]),names);
 assert.match(html,/id="console-config-fab"/);
 for(const [key,selector] of selectors){
  assert.ok(html.includes(selector),'Missing actual page target '+key+' '+selector);
  assert.ok(sharedCss.includes('console-hide-'+key),'Missing show/hide CSS for '+key);
 }
 assert.equal(ui.$('console-config-fab').hidden,true);
});

for(const [i,key] of names.entries()){
 test('independent configurator option '+String(i+1).padStart(2,'0')+' — '+key,()=>{
  const ui=makeHarness();
  const board=ui.$('board'),clock=ui.$('clock-1');
  board.children=[{piece:'white'},{piece:'black'}];clock.textContent='07:00';
  ui.tap(i);
  assert.deepEqual(ui.classes(),[key],'Only chosen component is hidden');
  assert.equal(ui.tiles[i].children[2].textContent,'Dodaj');
  assert.equal(ui.tiles[i].children[2].attributes['aria-pressed'],'true');
  assert.equal(ui.$('console-config-count').textContent,'Widoczne: 14 z 15');
  assert.equal(ui.tiles[i].classList.contains('is-hidden'),true);
  assert.deepEqual(JSON.parse(ui.storage.get('gracz-warcaby-console-layout-v1')),[key]);
  assert.equal(board.children.length,2,'Board must not be torn down');
  assert.equal(clock.textContent,'07:00','Clock must not reset');
  assert.equal(ui.$('console-config-fab').hidden,key!=='sidebar');
  if(key==='sidebar')assert.equal(ui.$('console-preview-sidebar').classList.contains('is-off'),true);
  if(key==='dock')assert.equal(ui.$('console-preview-dock').classList.contains('is-off'),true);
  ui.tap(i);
  assert.deepEqual(ui.classes(),[]);
  assert.equal(ui.tiles[i].children[2].textContent,'Ukryj');
  assert.equal(ui.tiles[i].children[2].attributes['aria-pressed'],'false');
  assert.equal(ui.$('console-config-count').textContent,'Widoczne: 15 z 15');
  assert.equal(ui.$('console-config-fab').hidden,true);
  assert.deepEqual(JSON.parse(ui.storage.get('gracz-warcaby-console-layout-v1')),[]);
 });
}

test('preset: Full console restores all 15 options without resetting board',()=>{
 const ui=makeHarness();
 ui.tap(1);ui.tap(9);
 ui.action('console-preset-full');
 assert.deepEqual(ui.classes(),[]);
 assert.equal(ui.$('console-config-count').textContent,'Widoczne: 15 z 15');
});
test('preset: Game + chat hides only sidebar, quicklinks and players',()=>{
 const ui=makeHarness();
 ui.action('console-preset-social');
 assert.deepEqual(ui.classes(),['sidebar','players','quicklinks']);
 assert.equal(ui.$('console-config-fab').hidden,false);
 assert.equal(ui.$('game').classList.contains('console-hide-dock'),false);
});
test('preset: Board only hides exactly six non-board areas',()=>{
 const ui=makeHarness();
 ui.action('console-preset-board');
 assert.deepEqual(ui.classes(),['sidebar','dock','players','quicklinks','status','bottom']);
 assert.equal(ui.$('console-config-fab').hidden,false);
 assert.equal(ui.$('game').classList.contains('console-hide-tools'),false);
});
test('Reset brings back every UI component and clears persistent overrides',()=>{
 const ui=makeHarness();
 for(let i=0;i<names.length;i++)ui.tap(i);
 assert.equal(ui.$('console-config-count').textContent,'Widoczne: 0 z 15');
 ui.action('console-config-reset');
 assert.deepEqual(ui.classes(),[]);
 assert.equal(ui.$('console-config-count').textContent,'Widoczne: 15 z 15');
 assert.deepEqual(JSON.parse(ui.storage.get('gracz-warcaby-console-layout-v1')),[]);
});
test('Hidden sidebar can always be restored through floating gear and close focus',()=>{
 const ui=makeHarness();
 ui.tap(0);
 assert.equal(ui.$('console-config-fab').hidden,false);
 ui.action('console-config-fab');
 assert.equal(ui.$('console-config-modal').hidden,false);
 assert.equal(ui.document.activeElement,ui.$('console-config-close'));
 ui.action('console-config-done');
 assert.equal(ui.$('console-config-modal').hidden,true);
 assert.equal(ui.document.activeElement,ui.$('console-config-fab'));
 ui.action('console-config-fab');
 ui.$('console-config-modal').dispatch('click',{target:ui.$('console-config-modal')});
 assert.equal(ui.$('console-config-modal').hidden,true);
});
test('Storage is isolated from Gomoku and restores each saved switch after refresh',()=>{
 const stored=new Map([['gracz-gomoku-console-layout-v1','["dock"]']]);
 const first=makeHarness(stored);first.tap(0);first.tap(8);first.tap(12);
 const second=makeHarness(stored);
 assert.deepEqual(second.classes(),['sidebar','training-records','chat-input']);
 assert.equal(second.$('console-config-count').textContent,'Widoczne: 12 z 15');
 assert.equal(stored.get('gracz-gomoku-console-layout-v1'),'["dock"]');
 const corrupted=makeHarness(new Map([['gracz-warcaby-console-layout-v1','invalid json']]));
 assert.deepEqual(corrupted.classes(),[]);
 const unknown=makeHarness(new Map([['gracz-warcaby-console-layout-v1','["sidebar","fake","dock"]']]));
 assert.deepEqual(unknown.classes(),['sidebar','dock']);
});
test('Modal closes with Escape and traps Tab correctly',()=>{
 const ui=makeHarness();
 ui.action('console-config-open');
 assert.equal(ui.$('console-config-modal').hidden,false);
 ui.$('console-config-done').focus();
 const wrapped=ui.$('console-config-modal').dispatch('keydown',{key:'Tab'});
 assert.equal(wrapped.prevented,true);
 assert.equal(ui.document.activeElement,ui.$('console-config-close'));
 const reverse=ui.$('console-config-modal').dispatch('keydown',{key:'Tab',shiftKey:true});
 assert.equal(reverse.prevented,true);
 assert.equal(ui.document.activeElement,ui.$('console-config-done'));
 const escape=ui.$('console-config-modal').dispatch('keydown',{key:'Escape'});
 assert.equal(escape.prevented,true);
 assert.equal(ui.$('console-config-modal').hidden,true);
});
test('Board focus and Escape leave a usable recovery path',()=>{
 const ui=makeHarness();
 ui.tap(0);ui.context.__config.setBoardFocusMode(true);
 assert.equal(ui.$('game').classList.contains('game-focus'),true);
 assert.equal(ui.$('console-config-fab').hidden,true);
 assert.equal(ui.$('focus-game').attributes['aria-pressed'],'true');
 ui.$('focus-exit').click();
 assert.equal(ui.$('game').classList.contains('game-focus'),false);
 assert.equal(ui.$('console-config-fab').hidden,false);
 ui.context.__config.setBoardFocusMode(true);
 const ev=ui.$('game').dispatch('keydown',{key:'Escape'});
 assert.equal(ev.prevented,true);
 assert.equal(ui.$('game').classList.contains('game-focus'),false);
});
test('CSS keeps chessboard and dock in their actual Gomoku grid tracks',()=>{
 assert.match(css,/R9: Warcaby configurator visual and layout compatibility/);
 assert.match(css,/\.boardarea>\.arena\{\s*display:contents/);
 assert.match(css,/\.side-dock\{\s*grid-column:2;grid-row:1 \/ 5/);
 assert.match(css,/\.board-center\{\s*grid-column:1;grid-row:3/);
 assert.match(css,/grid-template-rows:var\(--console-players-height,60px\)/);
 assert.match(css,/\.layout\.console-hide-dock:not\(\.game-focus\)>\.boardarea/);
 assert.match(css,/@media \(min-width:801px\) and \(max-width:1190px\)/);
 assert.doesNotMatch(css,/container-type:size/);
 // CONSOLE-INTERACTION-1TO1-03: the restore button uses Gomoku's own fixed placement.
 assert.doesNotMatch(css,/#console-config-fab:not\(\[hidden\]\)\{\s*position:fixed/);
});

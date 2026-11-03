import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { serveGomokuConsole } from '../auth/gomoku-console.mjs';

const host='https://gracz-contact-api.onrender.com';
function served(path,method='GET'){
 const res={status:0,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=String(body||'');}};
 const found=serveGomokuConsole({method},res,new URL(path,host));
 return {found,...res};
}
test('Gomoku Full Max Premium serves its dedicated console and assets without login',()=>{
 for(const [path,type] of [['/konto/gomoku/','text/html'],['/konto/gomoku/styl.css','text/css'],
  ['/konto/gomoku/app.js','application/javascript']]){
  const res=served(path);assert.equal(res.found,true);
  assert.equal(res.status,200);assert.match(res.headers['Content-Type'],new RegExp(type));
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.match(res.headers['Content-Security-Policy'],/connect-src 'self'/);
  assert.equal(Number(res.headers['Content-Length']),Buffer.byteLength(res.body));
 }
 assert.equal(served('/konto/gomoku/','POST').found,false);
 assert.equal(served('/konto/gomoku/unknown').found,false);
 const html=served('/konto/gomoku/').body;
 assert.match(html,/noindex,nofollow,noarchive/);
 for(const id of ['board','training-mode','online-mode','room-select','join-room','create-room','create-room-friend','create-room-time','create-room-status','clock-1','clock-2','game-state','restart','refresh-match','undo-move','analyze-position','game-settings','fullscreen-game','analysis-note','history-tab','chat-tab','moves-list','chat-messages','chat-preview','chat-form','chat-input','chat-send','undo-label','undo-request-modal','undo-modal-message','undo-accept','undo-reject','game-result-modal','game-result-close','game-result-title','game-result-description','game-result-new','game-result-review','game-result-online-hint','invite-friend','remove-player','block-player','player-actions-modal','player-actions-close','player-actions-list','player-actions-title','player-actions-status','chat-settings-modal','chat-settings-close','chat-settings-save','chat-settings-reset','chat-sound-test','chat-settings-mode','chat-settings-access','chat-privacy-description','chat-timestamps','chat-compact','chat-auto-scroll','chat-enter-send','chat-font-size','chat-sounds','chat-show-messages','chat-show-preview'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Trening/);assert.match(html,/Ze znajomym/);
 assert.match(html,/id="ai-level"/);
 assert.match(html,/id="create-room-time"/);
 assert.match(html,/value="7" selected>7 minut/);
 assert.match(html,/id="create-room"/);
 assert.match(html,/Czas dla każdego gracza/);
 assert.match(html,/id="clock-1"/);
 assert.match(html,/id="clock-2"/);
 assert.doesNotMatch(html,/class="game-topbar"/);
 assert.match(html,/aria-label="Szybkie odnośniki gracz.pl"/);
 const linkRegion=html.match(/<nav class="premium-quick-links"[^>]*>([\s\S]*?)<\/nav>/);
 assert.ok(linkRegion,'Premium quick navigation should appear within the active game console');
 const quickLinks=[...linkRegion[1].matchAll(/<a class="premium-mini-link" href="([^"]+)" title="([^"]+)" aria-label="([^"]+)" data-tooltip="([^"]+)"/g)];
 assert.equal(quickLinks.length,5,'Exactly five compact premium icons');
 assert.deepEqual(quickLinks.map(x=>x[2]),[
  'Gry gracz.pl','Zasady gry w Gomoku','Społeczność graczy',
  'Aktualności gracz.pl','Panel Gracza']);
 assert.ok(quickLinks.some(x=>x[1]==='https://gracz.pl/gry/gomoku/'&&x[4]==='Zasady gry w Gomoku'));
 assert.ok(quickLinks.every(x=>x[2]===x[3]&&x[3]===x[4]));
 assert.match(html,/href="https:\/\/gracz.pl\/" aria-label="gracz.pl — strona główna"/);
 assert.match(html,/Poproś o cofnięcie ruchu|Cofnij czarny kamień/);
 assert.match(html,/Akceptuj/);assert.match(html,/Odrzuć/);
 assert.match(html,/aria-labelledby="game-result-title"/);
 assert.match(html,/Rozpocznij nową partię/);
 assert.match(html,/Zobacz zakończoną planszę/);
 assert.match(html,/<option value="expert" selected>/);
 assert.match(html,/<option value="hard">/);
 assert.match(html,/<option value="normal">/);
 const css=served('/konto/gomoku/styl.css').body;
 assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/aspect-ratio:1/);
 assert.match(css,/\.cell\.p1\.occupied::after/);
 assert.match(css,/\.cell\.p2\.occupied::after/);
 assert.match(css,/#edf0ec/); // pearl white board, no dark wooden board
 assert.match(css,/\.boardframe\{[^}]*background:linear-gradient/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/\.tool-btn/);
 assert.match(css,/Compact Premium navigation: five golden pictograms/);
 assert.match(css,/\.premium-mini-link::after/);
 assert.match(css,/content:attr\(data-tooltip\)/);
 assert.match(css,/\.layout\{height:100dvh;max-height:100dvh\}/);
 assert.match(css,/\.side-dock/);
 assert.match(css,/Real server-authoritative time controls/);
 assert.match(css,/\.player \.player-clock\.clock-running/);
 assert.match(css,/\.player \.player-clock\.clock-warning/);
 assert.match(css,/Premium Gomoku micro-toolbars/);
 assert.match(css,/Full Max Premium: game outcome announcement/);
 assert.match(css,/\.result-overlay\[hidden\]/);
 assert.match(css,/\.side-dock \.game-tools \.tool-btn::after/);
 assert.match(html,/aria-label="Zaproś znajomego"/);
 assert.match(html,/aria-label="Wyproś gracza z pokoju"/);
 assert.match(html,/aria-label="Zablokuj gracza"/);
 assert.ok(html.indexOf('id="chat-tab"')<html.indexOf('id="history-tab"'), 'Czat is the left tab');
 assert.match(html,/class="versus-emblem" viewBox="0 0 105 70"/);
 assert.match(html,/id="vs-laurel-half"/);
 const emblem=html.match(/<svg class="versus-emblem"[\s\S]*?<\/svg>/)?.[0];
 assert.ok(emblem,'VS remains an inline vector emblem');
 assert.match(emblem,/<use href="#vs-laurel-half" transform="translate\(105 0\) scale\(-1 1\)"/);
 assert.doesNotMatch(emblem,/<(?:ellipse|image|foreignObject|text)\b/);
 assert.match(html,/class="versus" aria-label="VS — kontra"/);
 assert.doesNotMatch(html,/class="versus-medallion"/);
 assert.match(css,/R5: faithful MINIATURE \(vs\) motif/);
 assert.match(css,/Full Max Premium R6: golden laurel VS reference/);
 assert.match(css,/\.chat-settings-sections\{display:grid;grid-template-columns:repeat\(2/);
 assert.match(css,/\.chat-messages\.chat-font-large/);
 assert.match(html,/id="chat-settings-title">Centrum rozmowy/);
 assert.match(html,/id="chat-settings-reset"/);
 assert.match(html,/id="chat-sound-test"/);
 assert.match(css,/R5: one horizontal row of seven tiny golden tool icons/);
 assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/flex-wrap:nowrap/);
 const toolBar=html.match(/<div class="game-tools"[^>]*>([\s\S]*?)<\/div>/);
 assert.ok(toolBar,'Game toolbar exists');
 const tools=[...toolBar[1].matchAll(/<button type="button" class="tool-btn" id="([^"]+)"/g)]
  .map(match=>match[1]).filter(id=>id!=='refresh-match');
 assert.deepEqual(tools,[
  'undo-move','analyze-position','game-settings','fullscreen-game',
  'invite-friend','remove-player','block-player']);
 assert.match(css,/\.move-row/);
 assert.match(css,/\.chat-bubble/);
 assert.match(css,/grid-template-columns:27\.5%/);
 assert.match(css,/\.side-dock\{grid-column:2;grid-row:1 \/ 5/);
 assert.match(css,/\.side-dock \.game-tools\{grid-template-columns:repeat\(4/);
 assert.match(css,/\.boardframe\{width:min\(100%,calc\(100dvh - 270px\)/);
 assert.match(css,/APPROVED REFERENCE R3/);
 assert.match(css,/calc\(112dvh - 286px\)/);
 assert.match(css,/aspect-ratio:1\.12/);
 assert.match(css,/#fff9d8/);
 assert.match(css,/\.cell\.p1\.occupied::after/);
 assert.match(css,/Premium global navigation, crisp vector grid/);
 assert.match(css,/\.board \.cell::before/);
 assert.match(css,/#363b3e/);
 assert.ok(css.includes('Gomoku board viewport fit R4'));
 assert.ok(css.includes('grid-template-rows: minmax(52px,7vh) minmax(34px,5vh) minmax(0,1fr) 45px'));
 assert.ok(css.includes('width:auto;\n  height:100%;'),'Desktop board width is derived from actual row height');
 assert.ok(css.includes('max-height:100%;'),'Board does not overflow available desktop row');
 assert.ok(css.includes('max-width:620px;'),'Mobile retains responsive board width');
 new Script(served('/konto/gomoku/app.js').body);
});
test('Gomoku browser console can play immediately against a computer and join a real accepted room',async()=>{
 const fake=new Map(),queued=[],calls=[],storage=new Map(),navigations=[];
 class Element{
  constructor(){this.children=[];this.listeners={};this.value='';this.hidden=false;this.disabled=false;
   this.textContent='';this.style={};this.classes=new Set();this.focused=false;
   this.classList={add:(...x)=>x.forEach(v=>this.classes.add(v)),
    contains:x=>this.classes.has(x),
    toggle:(x,value)=>{if(value===undefined)value=!this.classes.has(x);if(value)this.classes.add(x);else this.classes.delete(x);}};
  }
  addEventListener(name,handler){this.listeners[name]=handler;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];this.value='';}
  setAttribute(){}
  focus(){this.focused=true;}
  scrollIntoView(){}
 }
 const get=id=>{if(!fake.has(id))fake.set(id,new Element());return fake.get(id);};
 const board=Array(225).fill(0);
 const matchId='d48944ab-106f-4d4b-855b-bcb76e30a112';
 const match={id:matchId,game:'gomoku',version:0,player:1,players:['GraczAlfa','GraczBeta'],
  playable:true,state:{board,turn:1,winner:0,moves:0}};
 const fetch=async(path,options)=>{
  calls.push({path,options});
  if(path==='/auth/profile')return {ok:true,status:200,json:async()=>({ok:true,profile:{nickname:'GraczAlfa'}})};
  if(path==='/auth/social/challenges')return {ok:true,status:200,json:async()=>({ok:true,challenges:[
   {id:matchId,game:'gomoku',status:'accepted',opponent:'GraczBeta'}
  ]})};
  if(path==='/auth/match?id='+encodeURIComponent(matchId))return {ok:true,status:200,
   json:async()=>({ok:true,match})};
  if(path==='/auth/match/chat?id='+matchId)return {ok:true,status:200,json:async()=>({ok:true,messages:[]})};
  if(path==='/auth/match'&&options.method==='POST'){
   const sent=JSON.parse(options.body);
   assert.equal(sent.version,0);assert.equal(sent.id,matchId);
   match.version=1;match.state.board[sent.move.to]=1;match.state.turn=2;match.state.moves=1;
   return {ok:true,status:200,json:async()=>({ok:true,match})};
  }
  throw Error('unexpected fetch '+path);
 };
 const context={
  document:{getElementById:get,createElement:()=>new Element(),visibilityState:'visible'},
  window:{setTimeout:fn=>{queued.push(fn);},setInterval:()=>{},location:{assign:href=>navigations.push(href)},
   localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}},
  location:{search:'',pathname:'/konto/gomoku/'},
  history:{replaceState(){}},
  URLSearchParams,fetch,console
 };
 const executable=served('/konto/gomoku/app.js').body.replace(/\}\)\(\);\s*$/,
  'globalThis.__gomokuTest={state,render,restart};})();');
 assert.match(executable,/__gomokuTest/,'Test harness exposes game state only inside VM');
 new Script(executable).runInNewContext(context);
 assert.equal(get('board').children.length,225);
 assert.equal(get('move-count').textContent,'Ruchy: 12','Reference preview has 12 explicitly labelled sample moves');
 assert.equal(get('history-count').textContent,'12');
 assert.equal(get('board').children.filter(x=>x.classes.has('occupied')).length,12);
 assert.match(get('game-state').textContent,/Przykładowy układ partii/);
 assert.equal(get('chat-preview').children.length,2,'Training sample chat is visible before play');
 assert.equal(get('undo-move').disabled,true,'Sample history cannot be undone as if played');
 get('board').children[112].listeners.click();
 assert.equal(get('move-count').textContent,'Ruchy: 1','First click starts clean real training rather than a 13th fictitious move');
 assert.equal(get('board').children[112].classes.has('p1'),true);
 assert.equal(get('board').children.filter(x=>x.classes.has('occupied')).length,1);
 assert.equal(get('history-count').textContent,'1');
 assert.equal(queued.length,1);queued.pop()();
 assert.equal(get('move-count').textContent,'Ruchy: 2');
 assert.equal(get('board').children.filter(x=>x.classes.has('p2')).length,1);
 assert.equal(get('moves-list').children.length,2,'History includes player and AI response');
 assert.equal(get('history-count').textContent,'2');
 assert.equal(get('moves-list').children[0].children[2].textContent,'H8');
 assert.equal(get('undo-move').disabled,false);
 get('analyze-position').listeners.click();
 assert.equal(get('analysis-note').hidden,false);
 assert.equal(get('board').children.filter(x=>x.classes.has('suggested')).length,1);
 get('game-settings').listeners.click();
 assert.equal(get('chat-settings-modal').hidden,false);
 assert.equal(get('chat-sounds').focused,true);
 assert.equal(get('chat-settings-mode').textContent,'Trening z komputerem');
 get('chat-font-size').value='large';
 get('chat-compact').checked=true;
 get('chat-timestamps').checked=false;
 get('chat-enter-send').checked=false;
 get('chat-auto-scroll').checked=false;
 get('chat-sounds').checked=true;
 get('chat-settings-save').listeners.click();
 assert.equal(get('chat-settings-modal').hidden,true);
 assert.equal(get('chat-messages').classes.has('chat-font-large'),true);
 assert.equal(get('chat-messages').classes.has('chat-compact'),true);
 const savedPrefs=JSON.parse(storage.get('gracz.gomoku.chat-prefs.v1'));
 assert.equal(savedPrefs.fontSize,'large');
 assert.equal(savedPrefs.enterSend,false);
 assert.equal(savedPrefs.autoScroll,false);
 let prevented=false;
 get('chat-input').listeners.keydown({key:'Enter',preventDefault(){prevented=true;}});
 assert.equal(prevented,true,'Enter does not send when disabled in user preferences');
 get('game-settings').listeners.click();
 assert.equal(get('chat-font-size').value,'large');
 get('chat-settings-reset').listeners.click();
 assert.equal(get('chat-font-size').value,'normal');
 assert.equal(get('chat-messages').classes.has('chat-compact'),false);
 assert.equal(JSON.parse(storage.get('gracz.gomoku.chat-prefs.v1')).enterSend,true);
 get('chat-settings-close').listeners.click();
 assert.equal(get('chat-settings-modal').hidden,true);
 get('undo-move').listeners.click();
 assert.equal(get('move-count').textContent,'Ruchy: 1');
 assert.equal(get('board').children.filter(x=>x.classes.has('occupied')).length,1,
   'Undo must remove ONLY black while preserving computer white stone');
 assert.equal(get('board').children.filter(x=>x.classes.has('p1')).length,0);
 assert.equal(get('board').children.filter(x=>x.classes.has('p2')).length,1);
 assert.match(get('analysis-note').textContent,/wyłącznie Twój czarny kamień/);
 assert.equal(get('undo-move').disabled,true);
 assert.equal(get('moves-list').children.length,1);
 assert.equal(get('moves-list').children[0].children[1].children[1].textContent,'Komputer');
 get('chat-tab').listeners.click();
 assert.equal(get('chat-panel').hidden,false);
 assert.equal(get('moves-panel').hidden,true);
 assert.equal(get('chat-input').disabled,false);
 get('chat-input').value='Powodzenia!';
 await get('chat-form').listeners.submit({preventDefault(){}});
 assert.equal(get('chat-messages').children.length,3);
 assert.equal(get('chat-messages').children[2].children[1].textContent,'Dzięki, wzajemnie! 🤝');
 assert.equal(get('chat-preview').children.length,2);
 get('history-tab').listeners.click();
 assert.equal(get('chat-preview').hidden,false);
 assert.equal(get('chat-panel').hidden,true);
 get('online-mode').listeners.click();
 assert.equal(get('chat-input').disabled,true);
 assert.equal(get('undo-move').disabled,true);
 assert.equal(get('undo-label').textContent,'Poproś o cofnięcie ruchu');
 assert.equal(get('analyze-position').disabled,true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('room-select').children.length,2);
 assert.equal(get('join-room').disabled,false);
 get('join-room').listeners.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('board').children.length,225);
 assert.equal(get('black-name').textContent,'GraczAlfa');
 assert.equal(get('room-tag').textContent,'POKÓJ ONLINE');
 assert.equal(get('chat-input').disabled,false);
 get('board').children[44].listeners.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('board').children[44].classes.has('p1'),true);
 assert.equal(get('move-count').textContent,'Ruchy: 1');
 assert.ok(calls.every(x=>x.options.credentials==='same-origin'));
 // Result is derived from the server-authoritative online winner relative to this player.
 match.state.winner=2;
 context.__gomokuTest.render();
 assert.equal(get('game-result-modal').hidden,false);
 assert.equal(get('game-result-title').textContent,'Przegrałeś partię.');
 assert.equal(get('game-result-description').textContent,'Zwycięzca: GraczBeta.');
 assert.equal(get('game-result-online-hint').hidden,false);
 get('game-result-review').listeners.click();
 assert.equal(get('game-result-modal').hidden,true);
 context.__gomokuTest.render();
 assert.equal(get('game-result-modal').hidden,true,'Repeated polling must not reopen dismissed result');
 match.state.winner=1;
 context.__gomokuTest.render();
 assert.equal(get('game-result-title').textContent,'Wygrałeś partię!');
 match.state.winner=3;
 context.__gomokuTest.render();
 assert.equal(get('game-result-title').textContent,'Remis!');
 get('game-result-new').listeners.click();
 assert.equal(navigations[0],'/konto/panel/','Online requires a new invitation, not a local reset');
 get('training-mode').listeners.click();
 const training=context.__gomokuTest.state;
 training.winner=2;training.showcase=false;
 context.__gomokuTest.render();
 assert.equal(get('game-result-title').textContent,'Przegrałeś z komputerem.');
 assert.equal(get('game-result-online-hint').hidden,true);
 get('game-result-new').listeners.click();
 assert.equal(get('game-result-modal').hidden,true);
 assert.equal(get('move-count').textContent,'Ruchy: 0');
 assert.equal(get('board').children.filter(x=>x.classes.has('occupied')).length,0);
 training.winner=1;context.__gomokuTest.render();
 assert.equal(get('game-result-title').textContent,'Wygrałeś z komputerem!');
 training.winner=3;context.__gomokuTest.render();
 assert.equal(get('game-result-title').textContent,'Remis!');
});


function getTrainedAI(){
 const client=served('/konto/gomoku/app.js').body;
 const head=client.indexOf('function victory('),end=client.indexOf('function describe(',head);
 const from=client.indexOf('const axes='),until=client.indexOf('function trainMove(',from);
 assert.ok(head>=0&&end>head&&from>=0&&until>from,'AI components are present');
 const evaluator=[
  'const size=15,count=225;',
  'const inBounds=(r,c)=>r>=0&&r<size&&c>=0&&c<size;',
  client.slice(head,end),client.slice(from,until),
  '({cpuMove,tacticalScore})'
 ].join('\n');
 return new Script(evaluator).runInNewContext({});
}

test('Expert Gomoku AI wins immediately rather than making a merely attractive move',()=>{
 const {cpuMove}=getTrainedAI();
 const board=Array(225).fill(0);
 for(const col of [4,5,6,7])board[7*15+col]=2;
 for(const col of [3,4,5])board[10*15+col]=1;
 const original=board.slice();
 for(const level of ['normal','hard','expert']){
  const move=cpuMove(board,level);
  assert.ok([7*15+3,7*15+8].includes(move),level+' must finish five-in-a-row');
  assert.deepEqual(board,original,'AI cannot mutate active board state');
 }
});

test('Gomoku AI blocks the only immediate human win at all levels',()=>{
 const {cpuMove}=getTrainedAI();
 const board=Array(225).fill(0);
 board[7*15+3]=2; // Close the left end of the human four.
 for(const col of [4,5,6,7])board[7*15+col]=1;
 for(const level of ['normal','hard','expert']){
  assert.equal(cpuMove(board,level),7*15+8,level+' must block human win');
 }
});

test('Expert Gomoku AI builds a decisive crossing double threat',()=>{
 const {cpuMove}=getTrainedAI();
 const board=Array(225).fill(0);
 for(const col of [5,6,8])board[7*15+col]=2;
 board[6*15+7]=2;board[8*15+7]=2;
 for(const level of ['hard','expert'])
  assert.equal(cpuMove(board,level),7*15+7,level+' must find crossing threat');
});

test('Expert Gomoku AI chooses legal, deterministic moves in a midgame position',()=>{
 const {cpuMove}=getTrainedAI();
 const board=Array(225).fill(0);
 for(let n=0;n<32;n++){
  const r=5+(n*3)%6,c=4+(n*7)%7,at=r*15+c;
  if(!board[at])board[at]=n%2+1;
 }
 const first=cpuMove(board,'expert'),second=cpuMove(board,'expert');
 assert.equal(first,second,'Same position must yield same choice');
 assert.ok(Number.isInteger(first)&&first>=0&&first<225);
 assert.equal(board[first],0);
});

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
 for(const id of ['board','training-mode','online-mode','training-time','training-increment','room-select','join-room','create-room','create-room-friend','create-room-time','create-room-increment','create-room-status','clock-1','clock-2','training-records','record-wins','record-draws','record-losses','record-total','record-rate','replay-game','replay-modal','replay-board','replay-counter','replay-status','replay-start','replay-prev','replay-next','replay-end','replay-close','game-state','restart','refresh-match','undo-move','analyze-position','game-settings','fullscreen-game','focus-game','focus-start','focus-exit','focus-nav','analysis-note','history-tab','chat-tab','moves-list','chat-messages','chat-preview','chat-form','chat-input','chat-send','undo-label','undo-request-modal','undo-modal-message','undo-accept','undo-reject','game-result-modal','game-result-close','game-result-title','game-result-description','game-result-new','game-result-review','game-result-online-hint','invite-friend','remove-player','block-player','player-actions-modal','player-actions-close','player-actions-list','player-actions-title','player-actions-status','chat-settings-modal','chat-settings-close','chat-settings-save','chat-settings-reset','chat-sound-test','chat-settings-mode','chat-settings-access','chat-privacy-description','chat-timestamps','chat-compact','chat-auto-scroll','chat-enter-send','chat-font-size','chat-sounds','chat-show-messages','chat-show-preview'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/Trening/);assert.match(html,/Ze znajomym/);
 assert.match(html,/id="ai-level"/);
 assert.match(html,/id="training-time"/);
 assert.match(html,/id="training-increment"/);
 assert.match(html,/Czas na partię dla każdego gracza/);
 assert.match(html,/<option value="7" selected>7 minut<\/option>/);
 assert.match(html,/id="create-room-time"/);
 assert.match(html,/id="create-room-increment"/);
 assert.match(html,/value="7" selected>7 minut/);
 assert.match(html,/id="create-room"/);
 assert.match(html,/Czas dla każdego gracza/);
 assert.match(html,/id="clock-1"/);
 assert.match(html,/id="clock-2"/);
 assert.match(html,/Powtórka partii Gomoku/);
 assert.match(html,/Mój bilans treningu/);
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
 assert.match(html,/<h1 class="gomoku-heading-title">/);
 assert.match(html,/class="gomoku-heading-gold">Gomoku<\/span>/);
 assert.match(html,/class="gomoku-heading-white">Online<\/span>/);
 assert.match(html,/class="gomoku-heading-crown"/);
 const header=html.match(/<header class="side-header">([\s\S]*?)<\/header>/)?.[1]||'';
 assert.doesNotMatch(header,/class="brand"|gracz<span>|badge-premium|premium-info|>PREMIUM</);
 const headerCss=served('/konto/gomoku/styl.css').body;
 assert.match(headerCss,/\.gomoku-heading-title/);
 assert.match(headerCss,/\.gomoku-heading-ornament/);
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
 assert.match(html,/id="focus-game"[^>]*aria-pressed="false"/);
 assert.match(html,/id="focus-exit"[^>]*aria-label="Wróć do pełnego panelu Gomoku"/);
 assert.match(html,/id="focus-start"[^>]*aria-label="Rozpocznij grę"/);
 assert.match(html,/class="focus-actions"/);
 assert.match(html,/class="focus-nav" id="focus-nav"/);
 assert.match(css,/R19: dedicated, reversible board-only browser viewport layout/);
 assert.match(css,/\.layout\.game-focus>\.sidebar\{display:none!important\}/);
 assert.match(css,/\.game-focus \.premium-quick-links,\.game-focus \.side-dock\{display:none!important\}/);
 assert.match(css,/\.game-focus \.boardframe\{[^}]*aspect-ratio:1/);
 assert.match(css,/\.layout\.game-focus>\.focus-nav/);
 assert.match(css,/R20: visible premium start control in the slim board-only toolbar/);
 assert.match(css,/\.focus-nav \.focus-start\{display:inline-flex/);
 assert.match(css,/\.focus-nav \.focus-start\[hidden\]\{display:none!important\}/);
 assert.match(css,/R14: Full Max Premium chat and move-history tabs with embedded vector miniatures/);
 assert.match(css,/R15: Dock composer stays beside the bottom Premium tools, not above empty space/);
 assert.match(css,/R16: move the existing fine gold separator directly above message input/);
 assert.match(css,/\.mini-chat\{[^}]*border-top:0[^}]*\}/,
  'No gold divider at the top of the chat composer section');
 assert.match(css,/\.mini-chat \.chat-form\{border-top:1px solid #b785327d;padding-top:2px\}/,
  'Gold divider is relocated onto the message form');
 assert.match(css,/\.mini-chat \.chat-compose\{margin-top:5px\}/,
  'Input stays directly below the relocated divider');
 assert.match(css,/\.mini-chat \.chat-form\{flex:0 0 auto;margin-top:auto\}/,
  'Composer is pushed to the bottom when chat preview is hidden');
 assert.match(css,/\.mini-chat \.chat-footnote\{flex:0 0 auto;margin-top:4px\}/,
  'Chat status stays immediately below the composer');
 assert.match(css,/\.dock-tabs \.dock-tab \.dock-tab-icon svg/);
 assert.match(css,/\.dock-tabs \.dock-tab\.active \.dock-tab-icon/);
 assert.match(css,/\.dock-tabs \.dock-tab:focus-visible/);
 assert.match(css,/@media\(max-width:420px\)\{\.dock-tabs/);
 assert.match(css,/Real server-authoritative time controls/);
 assert.match(css,/\.replay-overlay\[hidden\]/);
 assert.match(css,/\.records-grid/);
 assert.match(css,/Local, independent time controls for the non-ranking computer training mode/);
 assert.match(css,/\.player \.player-clock\.clock-running/);
 assert.match(css,/\.player \.player-clock\.clock-warning/);
 assert.match(css,/R18: slightly larger clock BOXES, with the R17 digits and alarms preserved/);
 assert.match(css,/min-width:clamp\(67px,5vw,78px\);min-height:clamp\(36px,2.5vw,42px\)/,
  'Clock boxes have responsive minimum dimensions on desktop');
 assert.match(css,/min-width:0;min-height:30px;font-size:11\.2px/,
  'Narrow-layout clocks reduce width to protect player names');
 assert.match(css,/\.player \.player-clock\.clock-critical/,
  'Red time-pressure warning remains intact');
 assert.match(css,/Premium Gomoku micro-toolbars/);
 assert.match(css,/Full Max Premium: game outcome announcement/);
 assert.match(css,/\.result-overlay\[hidden\]/);
 assert.match(css,/\.side-dock \.game-tools \.tool-btn::after/);
 assert.match(html,/aria-label="Zaproś znajomego"/);
 assert.match(html,/aria-label="Wyproś gracza z pokoju"/);
 assert.match(html,/aria-label="Zablokuj gracza"/);
 assert.ok(html.indexOf('id="chat-tab"')<html.indexOf('id="history-tab"'), 'Czat is the left tab');
 const premiumTabs=html.match(/<div class="dock-tabs"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
 assert.equal((premiumTabs.match(/class="dock-tab-icon"/g)||[]).length,2,
  'Each premium tab has a dedicated integrated vector miniature');
 assert.equal((premiumTabs.match(/<svg\s+viewBox="0 0 24 24"[^>]*aria-hidden/g)||[]).length,0,
  'Decorative icons are hidden through their parent wrappers');
 assert.equal((premiumTabs.match(/<svg\s+viewBox="0 0 24 24"/g)||[]).length,2);
 assert.match(premiumTabs,/id="chat-tab"[^>]*aria-selected="true"[^>]*aria-controls="chat-panel"/);
 assert.match(premiumTabs,/id="history-tab"[^>]*aria-selected="false"[^>]*aria-controls="moves-panel"/);
 assert.match(premiumTabs,/class="dock-tab-text">Czat<\/span>/);
 assert.match(premiumTabs,/class="dock-tab-text">Ruchy<\/span>/);
 assert.match(premiumTabs,/class="chat-led" aria-hidden="true"/);
 assert.doesNotMatch(premiumTabs,/▣|☷|&nbsp;/);
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
 const fake=new Map(),queued=[],calls=[],storage=new Map(),navigations=[],intervals=[];
 let fakeTime=0;
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
  window:{performance:{now:()=>fakeTime},setTimeout:fn=>{queued.push(fn);},
   setInterval:fn=>{intervals.push(fn);},location:{assign:href=>navigations.push(href)},
   localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}},
  location:{search:'',pathname:'/konto/gomoku/'},
  history:{replaceState(){}},
  URLSearchParams,fetch,console
 };
 get('training-time').value='7'; // Browser <select> defaults to the selected 7-minute option.
 const executable=served('/konto/gomoku/app.js').body.replace(/\}\)\(\);\s*$/,
  'globalThis.__gomokuTest={state,render,restart};})();');
 assert.match(executable,/__gomokuTest/,'Test harness exposes game state only inside VM');
 new Script(executable).runInNewContext(context);
 assert.equal(get('board').children.length,225);
 const openingCells=get('board').children.length;
 const openingClock=get('clock-1').textContent;
 assert.equal(get('game').classes.has('game-focus'),false);
 get('focus-game').listeners.click();
 assert.equal(get('game').classes.has('game-focus'),true,'Board-only mode enters without reset');
 assert.equal(get('focus-exit').focused,true,'Exit button receives keyboard focus');
 assert.equal(get('board').children.length,openingCells);
 assert.equal(get('clock-1').textContent,openingClock);
 get('focus-exit').listeners.click();
 assert.equal(get('game').classes.has('game-focus'),false,'Original console is restored');
 assert.equal(get('focus-game').focused,true);
 get('focus-game').listeners.click();
 let preventedFocusEscape=false;
 get('game').listeners.keydown({key:'Escape',preventDefault(){preventedFocusEscape=true;}});
 assert.equal(preventedFocusEscape,true,'Escape exits from within the game');
 assert.equal(get('game').classes.has('game-focus'),false);
 assert.equal(get('board').children.length,225,'Toggling the view does not restart gameplay');
 assert.equal(get('clock-1').hidden,false,'Training clocks appear in the player bars');
 assert.equal(get('clock-1').textContent,'07:00');
 assert.equal(get('clock-2').textContent,'07:00');
 fakeTime+=60000;intervals[0]();
 assert.equal(get('clock-1').textContent,'07:00','Reference preview is not a timed match');
 assert.equal(get('move-count').textContent,'Ruchy: 12','Reference preview has 12 explicitly labelled sample moves');
 assert.equal(get('history-count').textContent,'12');
 assert.equal(get('board').children.filter(x=>x.classes.has('occupied')).length,12);
 assert.match(get('game-state').textContent,/Przykładowy układ partii/);
 assert.equal(get('chat-preview').children.length,2,'Training sample chat is visible before play');
 assert.equal(get('undo-move').disabled,true,'Sample history cannot be undone as if played');
 get('focus-game').listeners.click();
 get('focus-start').listeners.click();
 assert.equal(get('game').classes.has('game-focus'),true,'Start remains within board-only mode');
 assert.equal(get('move-count').textContent,'Ruchy: 0','Start begins a clean training match');
 assert.equal(get('board').children.filter(x=>x.classes.has('occupied')).length,0);
 assert.equal(get('clock-1').textContent,'07:00');
 assert.equal(get('clock-2').textContent,'07:00');
 assert.equal(get('clock-1').classes.has('clock-running'),false,'No timer until first stone');
 assert.equal(get('clock-2').classes.has('clock-running'),false,'CPU timer starts only after first stone');
 get('focus-exit').listeners.click();
 get('board').children[112].listeners.click();
 assert.equal(get('move-count').textContent,'Ruchy: 1','First click after pressing Start places the first legal stone');
 assert.equal(get('board').children[112].classes.has('p1'),true);
 assert.equal(get('board').children.filter(x=>x.classes.has('occupied')).length,1);
 assert.equal(get('history-count').textContent,'1');
 assert.equal(queued.length,1);
 assert.equal(get('clock-2').classes.has('clock-running'),true,'Computer clock runs during its turn');
 fakeTime+=5000;intervals[0]();
 assert.equal(get('clock-1').textContent,'07:00');
 assert.equal(get('clock-2').textContent,'06:55');
 queued.pop()();
 assert.equal(get('move-count').textContent,'Ruchy: 2');
 fakeTime+=30000;intervals[0]();
 assert.equal(get('clock-1').textContent,'06:30','Human clock runs only on their turn');
 assert.equal(get('clock-2').textContent,'06:55','Computer clock stops after its move');
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
 assert.equal(get('chat-tab').classes.has('active'),true,'Czat tab becomes selected');
 assert.equal(get('history-tab').classes.has('active'),false);
 assert.equal(get('chat-panel').hidden,false);
 assert.equal(get('moves-panel').hidden,true);
 assert.equal(get('chat-input').disabled,false);
 get('chat-input').value='Powodzenia!';
 await get('chat-form').listeners.submit({preventDefault(){}});
 assert.equal(get('chat-messages').children.length,3);
 assert.equal(get('chat-messages').children[2].children[1].textContent,'Dzięki, wzajemnie! 🤝');
 assert.equal(get('chat-preview').children.length,2);
 get('history-tab').listeners.click();
 assert.equal(get('history-tab').classes.has('active'),true,'Ruchy tab becomes selected');
 assert.equal(get('chat-tab').classes.has('active'),false);
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
 const longNickname='BardzoDlugiNickGracza1234567890';
 match.players[1]=longNickname;context.__gomokuTest.render();
 assert.equal(get('white-name').textContent,longNickname);
 assert.equal(get('white-name').title,longNickname,'Ellipsized online names retain their full title');
 match.players[1]='GraczBeta';context.__gomokuTest.render();
 assert.equal(get('white-name').title,'GraczBeta','Title follows the current opponent');
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
 assert.equal(get('focus-start').hidden,false,'Training makes the Start control available');
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
 // Both clocks end the game on time and prevent further moves.
 get('restart').listeners.click();
 assert.equal(get('clock-1').textContent,'07:00','New match resets each clock');
 fakeTime+=600000;intervals[0]();
 assert.equal(get('clock-1').textContent,'07:00','Ten idle minutes before the opening must cost no human time');
 assert.equal(get('clock-2').textContent,'07:00','Computer clock also waits for the opening');
 assert.equal(get('clock-1').classes.has('clock-running'),false);
 assert.equal(get('clock-2').classes.has('clock-running'),false);
 assert.equal(training.winner,0);
 get('board').children[112].listeners.click();
 assert.equal(get('clock-1').textContent,'07:00','First legal black move costs no time');
 assert.equal(get('clock-2').classes.has('clock-running'),true);
 queued.pop()();
 assert.equal(get('clock-1').classes.has('clock-running'),true);
 assert.equal(get('clock-2').classes.has('clock-running'),false);
 fakeTime+=420001;intervals[0]();
 assert.equal(training.winner,2);
 assert.equal(training.trainClock.timeoutLoser,1);
 assert.equal(get('clock-1').textContent,'00:00');
 assert.equal(get('clock-1').classes.has('clock-expired'),true);
 assert.equal(get('game-result-title').textContent,'Przegrałeś na czas.');
 assert.equal(get('board').children.every(cell=>cell.disabled),true);
 assert.equal(get('game-result-online-hint').hidden,true);
 get('restart').listeners.click();
 get('board').children[112].listeners.click(); // Human makes a move, CPU clock starts.
 assert.equal(training.thinking,true);
 fakeTime+=420001;intervals[0]();
 assert.equal(training.winner,1);
 assert.equal(training.trainClock.timeoutLoser,2);
 assert.equal(get('game-result-title').textContent,'Wygrałeś na czas!');
 assert.equal(get('clock-2').textContent,'00:00');
 assert.equal(training.thinking,false);
 const terminalMoveCount=training.moves;
 queued.pop()();
 assert.equal(training.moves,terminalMoveCount,'An old AI timeout cannot move after time forfeiture');
 get('training-time').value='0';get('training-time').listeners.change();
 assert.equal(get('clock-1').hidden,true,'Unlimited training has no timers');
 assert.equal(get('clock-2').hidden,true);
 get('training-time').value='3';get('training-time').listeners.change();
 assert.equal(get('clock-1').textContent,'03:00','Selecting a new limit starts a fresh timed match');
 assert.equal(get('clock-2').textContent,'03:00');
 for(const minutes of ['1','2','3','5','7','10','15','30']){
  get('training-time').value=minutes;get('training-time').listeners.change();
  fakeTime+=120000;intervals[0]();
  const label=minutes.padStart(2,'0')+':00';
  assert.equal(get('clock-1').textContent,label,'Changing the time control resets to an idle clock');
  assert.equal(get('clock-2').textContent,label);
  assert.equal(get('clock-1').classes.has('clock-running'),false);
  assert.equal(get('clock-2').classes.has('clock-running'),false);
  assert.equal(training.winner,0);
 }
 get('training-time').value='3';get('training-time').listeners.change();
 // Fischer bonus is awarded after an accepted move to each player independently.
 get('training-increment').value='2';get('training-increment').listeners.change();
 assert.equal(training.trainClock.incrementMs,2000);
 fakeTime+=240000;intervals[0]();
 assert.equal(get('clock-1').textContent,'03:00','Changing the increment leaves both clocks idle');
 assert.equal(get('clock-2').textContent,'03:00');
 get('board').children[112].listeners.click();
 assert.equal(get('clock-1').textContent,'03:02','Human receives +2 sec only after moving');
 assert.equal(get('clock-2').textContent,'03:00');
 queued.pop()();
 assert.equal(get('clock-2').textContent,'03:02','CPU receives the same bonus after its legal move');
 get('undo-move').listeners.click();
 assert.equal(get('clock-1').textContent,'03:00','Undo cannot be used to farm clock bonuses');
 get('restart').listeners.click();
 get('board').children[112].listeners.click();
 get('restart').listeners.click();
 fakeTime+=600000;intervals[0]();queued.pop()();
 assert.equal(training.moves,0,'Restart invalidates a pending AI move');
 assert.equal(training.winner,0);
 assert.equal(get('clock-1').textContent,'03:00','Restart during AI thinking returns to waiting for the opening');
 assert.equal(get('clock-2').textContent,'03:00');
 // A completed training match gets a visible replay and counts exactly once.
 get('restart').listeners.click();
 get('board').children[112].listeners.click();
 queued.pop()();
 training.winner=1;context.__gomokuTest.render();
 assert.equal(get('replay-game').disabled,false,'Completed match enables replay');
 const beforeCount=Number(get('record-wins').textContent);
 assert.ok(beforeCount>=1,'Training wins are recorded on this device');
 context.__gomokuTest.render();
 assert.equal(Number(get('record-wins').textContent),beforeCount,'Repeated render cannot inflate results');
 get('replay-game').listeners.click();
 assert.equal(get('replay-modal').hidden,false);
 assert.equal(get('replay-board').children.length,225);
 assert.equal(get('replay-counter').textContent,'2 / 2');
 get('replay-prev').listeners.click();
 assert.equal(get('replay-counter').textContent,'1 / 2');
 assert.equal(get('replay-board').children.filter(el=>el.className.includes('stone-black')).length,1);
 assert.equal(get('replay-board').children.filter(el=>el.className.includes('stone-white')).length,0);
 get('replay-start').listeners.click();
 assert.equal(get('replay-counter').textContent,'0 / 2');
 get('replay-end').listeners.click();
 assert.equal(get('replay-counter').textContent,'2 / 2');
 get('replay-close').listeners.click();
 assert.equal(get('replay-modal').hidden,true);
 assert.equal(get('board').children.filter(el=>el.classes.has('occupied')).length,2,'Replay cannot modify active board');
 assert.ok(storage.get('gracz.gomoku.training-records.v1'),'Training record survives a page reload');
 // Boundary colors follow only the active clock, in training and server-supplied rooms.
 for(const mode of ['training','online']){
  training.mode=mode;training.showcase=false;
  if(mode==='online'){training.match=match;match.state.turn=1;}
  for(const [ms,critical,warning] of [[30000,false,true],[10000,false,true],[9000,true,false],[5000,true,false],[1000,true,false]]){
   training.winner=0;match.state.winner=0;
   const clock={remaining:[ms,5000],incrementMs:2000,turn:1,ready:[true,true],
    since:mode==='training'?fakeTime:new Date(Date.now()+60000).toISOString(),timeoutLoser:0};
   if(mode==='training')training.trainClock=clock;else match.state.clock=clock;
   context.__gomokuTest.render();
   assert.equal(get('clock-1').classes.has('clock-critical'),critical,mode+' alarm at '+ms);
   assert.equal(get('clock-1').classes.has('clock-warning'),warning);
   assert.equal(get('clock-2').classes.has('clock-critical'),false,'Stopped opponent never pulses');
   clock.remaining[0]=31000;context.__gomokuTest.render();
   assert.equal(get('clock-1').classes.has('clock-critical'),false,'Bonus above threshold clears alarm');
  }
  const clock=mode==='training'?training.trainClock:match.state.clock;
  clock.remaining[0]=0;clock.timeoutLoser=1;training.winner=2;match.state.winner=2;
  context.__gomokuTest.render();
  assert.equal(get('clock-1').textContent,'00:00');
  assert.equal(get('clock-1').classes.has('clock-critical'),false,'Finished game never pulses');
  assert.equal(get('clock-1').classes.has('clock-expired'),true);
 }
 training.mode='training';get('restart').listeners.click();
 assert.equal(get('clock-1').classes.has('clock-critical'),false,'Reset clears alarm');

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

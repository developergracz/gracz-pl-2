import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {chooseComputerMove,initialGame,playMove} from '../auth/checkers-training-ai.mjs';

function load(path,method='GET'){
 let status=0,headers={},body='';
 const response={writeHead(code,values){status=code;headers=values},end(value){body=String(value)}};
 const served=serveCheckersConsole({method},response,new URL('https://example.com'+path));
 return {served,status,headers,body};
}
test('Warcaby AI moves for either color; default black engine stays backwards-compatible',()=>{
 const initial=initialGame('warcaby');
 const white=chooseComputerMove(initial,'normal',{computerSide:1,maxNodes:400,maxMs:70});
 assert.ok(white&&Number.isInteger(white.from)&&Number.isInteger(white.to),'computer can open with white');
 const started=playMove('warcaby',initial,1,white);
 assert.equal(started.error,undefined);
 assert.equal(started.state.turn,2);
 assert.equal(started.state.moves,1);
 const black=chooseComputerMove(started.state,'normal',{computerSide:2,maxNodes:400,maxMs:70});
 assert.ok(black&&Number.isInteger(black.from)&&Number.isInteger(black.to),'computer still plays black');
 assert.equal(playMove('warcaby',started.state,2,black).error,undefined);
 assert.equal(chooseComputerMove(initial,'normal'),null,'old default never plays white without the explicit side');
 assert.ok(chooseComputerMove(started.state,'normal'),'old default still plays black');
 const view=load('/konto/warcaby/bot.mjs').body;
 assert.ok(view.includes('options.computerSide===1?1:2'),'served bot matches the real dual-side engine');
 const ctrl=load('/konto/warcaby/training-ui.mjs').body;
 assert.ok(ctrl.includes('{computerSide:computerSide()}'),'training forwards the selected AI color');
});
test('premium checkers console serves isolated assets with strict CSP',()=>{
 const page=load('/konto/warcaby/');
 assert.equal(page.served,true);
 assert.equal(page.status,200);
 assert.match(page.body,/Warcaby Online/);
 assert.match(page.body,/class="layout"/);
 assert.match(page.body,/class="board checkers-grid"/);
 assert.doesNotMatch(page.body,/id="start-checkers"/);
 assert.match(page.body,/id="chat-panel"/);
 assert.match(page.body,/id="moves-panel"/);
 assert.match(page.body,/id="console-config-modal"/);
 assert.match(page.body,/\/konto\/gomoku\/styl\.css/);
 assert.doesNotMatch(page.body,/src="\/konto\/gomoku\/app\.js"/);
 assert.match(page.body,/\/konto\/warcaby\/app\.js/);
 assert.match(page.headers['Content-Security-Policy'],/script-src 'self'/);
 assert.doesNotMatch(page.headers['Content-Security-Policy'],/unsafe-inline/);
 const js=load('/konto/warcaby/app.js');
 assert.equal(js.status,200);
 assert.doesNotThrow(()=>new Script(js.body));
 assert.match(js.body,/\/auth\//);
 assert.match(js.body,/credentials:'same-origin'/);
 assert.match(js.body,/version:current.version/);
 assert.match(js.body,/function renderPreview\(/);
 assert.match(js.body,/game:'warcaby'/);
 assert.match(js.body,/renderBoard\(/);
 const style=load('/konto/warcaby/styl.css');
 assert.equal(style.status,200);
 for(const id of ['rotate-board','checkers-history','checkers-settings','fullscreen-game','invite-friend','checkers-chat','checkers-refresh']){
  assert.match(page.body,new RegExp('id="'+id+'"'));
 }
 assert.match(page.body,/role="toolbar" aria-label="Narzędzia Warcabów"/);
 assert.match(style.body,/\.game-tools\.checkers-toolbar/);
 assert.match(style.body,/repeat\(7,minmax\(0,1fr\)\)/);
 // Full Max Premium pieces: CSS bodies, vector gold crown medallion for kings, decorative SVG only.
 for(const piece of ['.piece.white{','.piece.black{','.piece.king:after,.warcaby-console .checkers-drag-ghost.king:after{content:none}','.piece .crown{'])assert.ok(style.body.includes(piece),piece);
 assert.doesNotMatch(style.body,/♛/);
 assert.match(page.body,/<svg class="checkers-piece-defs" aria-hidden="true" focusable="false"[^>]*>[\s\S]*?<symbol id="checkers-crown"/);
 assert.match(js.body,/if\(p>=3\)token\.append\(crownEmblem\(\)\)/);
 assert.match(js.body,/setAttribute\('aria-hidden','true'\)/);
 for(const id of ['checkers-history','checkers-settings','checkers-chat','checkers-refresh'])assert.match(js.body,new RegExp(id));
 // The chosen match clock must be visible and sent to the authoritative invitation API.
 assert.match(page.body,/id="create-room-time"/);
 assert.match(page.body,/id="create-room-increment"/);
 assert.match(js.body,/timeLimitMinutes:Number\(\$\('create-room-time'\)\.value\)/);
 assert.match(js.body,/incrementSeconds:Number\(\$\('create-room-increment'\)\.value\)/);
 assert.match(js.body,/function syncInvitationClock\(\)/);
 assert.match(js.body,/bonus\.disabled=untimed/);
 assert.match(style.body,/\.room-creator details\{display:block!important/);
 assert.match(style.body,/\.warcaby-console #online-settings #create-room-time/);
 assert.match(style.body,/\.warcaby-console #online-settings #create-room-increment/);
 assert.doesNotMatch(style.body,/\.warcaby-console label\[for="create-room-time"\],\.warcaby-console #create-room-time,\s*\.warcaby-console label\[for="create-room-increment"\],\.warcaby-console #create-room-increment,/);
 assert.match(page.body,/Pokoje i zaproszenia/);
 assert.match(page.body,/checkers-room-subtitle/);
 assert.match(style.body,/\.warcaby-console \.layout:not\(\.game-focus\)/);
 assert.match(style.body,/\.warcaby-console \.boardframe/);
 assert.match(style.body,/Reference parity with Gomoku console/);

 assert.match(style.body,/R7 pixel alignment: polished checkers/);

 // Regression: old R8 size containment collapsed the board and displaced panels.
 assert.doesNotMatch(style.body,/container-type:size/);
 assert.doesNotMatch(style.body,/100cqh/);
 assert.match(style.body,/grid-template-rows:var\(--console-players-height,60px\)/);
 assert.match(js.body,/gracz-warcaby-console-layout-v1/);
 assert.match(js.body,/console-config-fab/);
 assert.match(js.body,/setBoardFocusMode/);
 for(const k of ['sidebar','dock','players','quicklinks','status','bottom','tools',
    'training-settings','training-records','online-settings','replay','chat-history',
    'chat-input','heading','mode']){
  assert.match(js.body,new RegExp("'"+k+"'"),k);
 }
 assert.match(js.body,/consoleHidden=new Set/);
 assert.match(js.body,/saveConsoleLayout\(\)/);
 assert.match(js.body,/localStorage\?\.getItem\(consoleLayoutKey\)/);
 assert.match(js.body,/console-preset-board/);
 assert.match(js.body,/changeConsoleLayout\(key\)/);

 // CONSOLE-INTERACTION-1TO1-03: the left panel keeps Gomoku's own button, field and footer
 // heights (no fixed-height copies) and one stable training ⇄ online settings slot.
 assert.doesNotMatch(style.body,/height:55px;min-height:55px;max-height:55px/);
 assert.doesNotMatch(style.body,/min-height:28px;height:28px/);
 assert.doesNotMatch(style.body,/min-height:38px;height:38px/);
 assert.match(page.body,/<div class="console-settings-slot"><section class="sidecard" id="training-settings">/);
 assert.match(page.body,/<\/section>\n<\/div>\n<div class="sidebar-footer">/);
 assert.match(style.body,/\.console-settings-slot>#online-settings\{grid-area:1\/1\/3\/2\}/);
 assert.match(style.body,/#online-settings\[hidden\]\{display:block!important;visibility:hidden!important/);
 assert.equal((style.body.match(/#console-config-fab:not\(\[hidden\]\)\{position/g)||[]).length,1,'one restore-gear placement rule');
 assert.match(style.body,/console-hide-dock:not\(\.game-focus\):not\(\.console-hide-quicklinks\) \.premium-quick-links\{position:relative;[^}]*grid-row:2/,'hidden chat keeps navigation in the status row');
 assert.doesNotMatch(style.body,/console-hide-dock[^{]*\{\s*grid-template-rows:var\(--console-players-height,60px\) 43px/,'hidden chat must not shrink the board with an extra row');
 assert.match(js.body,/\$\('match-panel'\)\.classList\.toggle\('moves-only',!chat\)/);
 assert.match(js.body,/document\.documentElement\.requestFullscreen\(\)/);
 assert.doesNotMatch(js.body,/querySelector\('\.layout'\)\.requestFullscreen/);
 assert.match(style.body,/background:linear-gradient\(115deg,#fffcf4/);
 assert.match(style.body,/border:2px solid #967c54/);
 assert.match(style.body,/margin-bottom:48px/);
 assert.match(style.body,/@media \(max-width:800px\)/);

 assert.match(style.body,/grid-template-columns:27\.5% minmax\(0,1fr\)/);
 assert.match(style.body,/grid-template-columns:minmax\(0,1fr\) clamp\(315px,23vw,390px\)/);
 assert.match(style.body,/aspect-ratio:1\.12/);
 assert.match(style.body,/\.boardframe>\.board\.checkers-grid\{/);
 assert.match(style.body,/aspect-ratio:1;min-width:0;min-height:0/);
 assert.match(style.body,/margin:72px 0 58px/);
 assert.match(style.body,/@media \(max-width:800px\)/);
 assert.match(style.body,/grid-template-columns:minmax\(0,1fr\) clamp\(285px,21\.5vw,360px\)/);
 assert.match(style.body,/@media \(max-width:800px\)/);
 assert.doesNotMatch(style.body,/\.warcaby-console \.mode\{grid-template-columns/,'mode buttons use the Gomoku grid');
 for(const id of ['training-mode','online-mode','ai-level','training-time','training-increment','training-records','training-undo','training-hint','restart','game-result-modal']){
  assert.match(page.body,new RegExp('id="'+id+'"'));
 }
 assert.match(page.body,/Gra z komputerem/);
 for(const path of ['/konto/warcaby/rules.mjs','/konto/warcaby/bot.mjs','/konto/warcaby/training-ui.mjs']){
  const asset=load(path);
  assert.equal(asset.status,200,path);
  assert.match(asset.headers['Content-Type'],/javascript/);
  assert.equal(asset.headers['Content-Length'],Buffer.byteLength(asset.body));
 }
 assert.match(load('/konto/warcaby/rules.mjs').body,/export function playMove/);
 assert.equal(load('/konto/warcaby/rules.mjs').body,readFileSync(new URL('../auth/game-engine.mjs',import.meta.url),'utf8'));
 assert.equal(load('/konto/warcaby/bot.mjs').body,readFileSync(new URL('../auth/checkers-training-ai.mjs',import.meta.url),'utf8').replace("from './game-engine.mjs'","from '/konto/warcaby/rules.mjs'"));
 assert.equal(load('/konto/warcaby/training-ui.mjs').body,readFileSync(new URL('../auth/checkers-training-ui.mjs',import.meta.url),'utf8').replace("from './checkers-training-ai.mjs'","from '/konto/warcaby/bot.mjs'"));
 assert.match(load('/konto/warcaby/bot.mjs').body,/\/konto\/warcaby\/rules\.mjs/);
 assert.match(load('/konto/warcaby/training-ui.mjs').body,/\/konto\/warcaby\/bot\.mjs/);
 assert.match(js.body,/initializeWarcaby\(/);
 assert.match(js.body,/playTrainingMove\(/);
 assert.match(js.body,/mode!=='online'/);
 assert.doesNotMatch(page.body,/src="\/konto\/gomoku\/app\.js"/);
 assert.equal(load('/konto/warcaby/').headers['Content-Length'],Buffer.byteLength(page.body));
 assert.equal(load('/konto/warcaby/', 'POST').served,false);
 assert.equal(load('/konto/warcaby/no-such').served,false);
});

test('Warcaby loss dialog uses the signed-in nickname and an authenticated tables lobby',()=>{
 const page=load('/konto/warcaby/'),style=load('/konto/warcaby/styl.css'),script=load('/konto/warcaby/app.js');
 for(const id of ['warcaby-loss-overlay','warcaby-loss-player','warcaby-loss-name',
  'warcaby-loss-rematch','warcaby-loss-others','warcaby-tables-overlay',
  'warcaby-tables-code','warcaby-loss-tables','warcaby-tables-create','warcaby-tables-refresh'])
  assert.match(page.body,new RegExp('id="'+id+'"'));
 assert.ok(page.body.includes('<span id="warcaby-loss-verb">Przegrałeś</span> <span id="warcaby-loss-player">gracz</span> tę grę z <span id="warcaby-loss-name">komputerem</span>.'),'whole result headline stays on the beige panel');
 assert.match(page.body,/id="warcaby-loss-emotion"/);
 assert.ok(page.body.includes('warcaby-loss-face--sad')&&page.body.includes('warcaby-loss-face--happy'),
  'both emotion states use matching, tear-free inline SVG');
 assert.doesNotMatch(page.body,/warcaby-loss-emotion"[^>]*>😢/,'no platform emoji');
 assert.match(style.body,/#warcaby-loss-player/);
 assert.match(style.body,/font-size:1\.08em!important/);
 assert.match(script.body,/toLocaleLowerCase\('pl-PL'\)/);
 assert.match(style.body,/width:min\(840px,100%\)/);
 assert.match(style.body,/font:800 clamp\(25px,3\.05vw,38px\)/);
 assert.match(style.body,/font:800 clamp\(21px,2\.1vw,27px\)/);
 assert.match(style.body,/warcaby-loss-overlay\[data-outcome="win"\] \.warcaby-loss-face--happy/);
 assert.match(page.body,/role="dialog" aria-modal="true"/);
 assert.match(page.body,/>Rewanż<\/button>/);
 assert.match(page.body,/>Stoły<\/button>/);
 assert.match(page.body,/>Utwórz stół<\/button>/);
 assert.match(page.body,/Wolne stoły/);
 assert.match(page.body,/W trakcie gry/);
 assert.match(page.body,/Moje stoły/);
 assert.match(script.body,/gracz:warcaby:position/);
 assert.match(script.body,/winner:s.winner,turn:s.turn,playable:current.playable,drawOffer:s.drawOffer\|\|null,moves:s.moves,players:current.players/);
 assert.match(script.body,/fetch\('\/auth\/session'/);
 assert.match(script.body,/setText\('warcaby-loss-player'/);
 assert.match(script.body,/\/auth\/warcaby\/tables/);
 assert.match(script.body,/action:editId\?'edit':'create'/);
 assert.match(script.body,/action:'join'/);
 assert.match(script.body,/action:'close'/);
 assert.match(script.body,/if\(!d\|\|!\[1,2\]\.includes\(d.player\)/);
 assert.match(style.body,/\.warcaby-console \.warcaby-tables-overlay/);
 assert.doesNotMatch(page.body,/Szachista_PL|Mistrz_Andrzej|Stół #1284/,'no invented opponents or rooms');
 assert.doesNotThrow(()=>new Script(script.body));
});

test('Warcaby retain their original engine and controls inside the owner-approved chess console',()=>{
 const page=load('/konto/warcaby/'),style=load('/konto/warcaby/styl.css'),script=load('/konto/warcaby/app.js');
 assert.match(page.body,/<html lang="pl" class="checkers-shell-loading">/);
 assert.match(page.body,/class="warcaby-console chess-console cc-owner checkers-shell-loading"/);
 assert.match(page.body,/class="board checkers-grid"/,'the original 8x8 board element is not replaced');
 assert.match(page.body,/id="training-undo"/);
 assert.match(page.body,/id="training-hint"/);
 assert.match(page.body,/id="create-room-friend"/);
 assert.match(style.body,/checkers-owner-mode/);
 assert.match(style.body,/checkers-shell-loading/);
 assert.match(script.body,/gracz:warcaby:position/);
 assert.match(script.body,/checkers-shell-loading/);
 assert.match(script.body,/checkers-bots-mode/,'dedicated button for named opponents');
 assert.match(script.body,/Graj z botem/,'bot entry shows own title');
 assert.match(style.body,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/,'three equal mode columns');
 assert.match(script.body,/botButton\.addEventListener\('click',openPicker\)/,'picker only from bot button');
 assert.match(script.body,/training-undo/);
 assert.match(script.body,/create-room-friend/);
 assert.match(script.body,/board.querySelectorAll\('\.square'\)\.length===64/);
 assert.doesNotMatch(script.body,/\/konto\/szachy\/rules\.mjs/,'never run chess rules in Warcaby');
 assert.equal(page.headers['Content-Security-Policy'].includes("script-src 'self'"),true);
});

test('Warcaby owner parity: recorded history drives replay, coordinates and mobile chrome without changing the engine',()=>{
 const page=load('/konto/warcaby/');
 const script=load('/konto/warcaby/app.js');
 const style=load('/konto/warcaby/styl.css');
 assert.equal(page.status,200);
 assert.equal(script.status,200);
 assert.equal(style.status,200);
 assert.doesNotThrow(()=>new Script(script.body),'controller and presentation scripts must parse');
 assert.ok(script.body.includes("new CustomEvent('gracz:warcaby:history'"),'live history notification');
 assert.ok(script.body.includes("board.dataset.checkersRotated=rotated?'true':'false'"));
 assert.ok(script.body.includes('checkers-coordinate-rank'));
 assert.ok(script.body.includes('checkers-coordinate-file'));
 assert.ok(script.body.includes('checkers-mobile-heading'));
 assert.ok(script.body.includes('checkers-history-turn'));
 assert.ok(script.body.includes("import('/konto/warcaby/rules.mjs')"),'replay uses original checkers rules');
 assert.ok(script.body.includes("mod.playMove('warcaby'"),'recorded moves replayed with unchanged rules');
 assert.ok(script.body.includes("frame?.append(replay)"),'preview does not replace real board');
 assert.ok(script.body.includes("replay.hidden=true"),'live play remains available');
 assert.ok(script.body.includes("data.checkersRotated")===false,'no alternate game state introduced');
 assert.ok(style.body.includes('background:#002529!important'),'deep chess turquoise canvas replaces the pale previous Warcaby variant');
 assert.doesNotMatch(style.body,/background:#e3ebe7!important|background:#e2f2ef!important/,'pale canvas no longer painted');
 assert.ok(style.body.includes('width:clamp(75.9px,6.6vw,99px)!important'),'clock box keeps original physical width');
 assert.ok(style.body.includes('font-size:clamp(21px,1.7vw,27px)!important'),'only clock digits become smaller');
 assert.ok(script.body.includes("fetch('/auth/session'"),'authenticated nickname sourced from existing session API');
 assert.ok(script.body.includes("wrapper.insertAdjacentElement('afterend',label)"),'name remains directly below the original-sized clock');
 assert.ok(script.body.includes("checkers-turn-token"),'real white/black turn markers exist');
 assert.ok(script.body.includes("dataset.checkersTurn=String(current.state.turn)"),'active indicator uses actual rules engine turn');
 assert.ok(script.body.includes("document.body.append(d.ghost)"),'drag ghost uses viewport coordinates');
 assert.ok(script.body.includes("sourceFont=getComputedStyle(source).fontSize"),'ghost maintains exactly the same piece-size units');
 assert.ok(style.body.includes('.checkers-drag-ghost.white'), 'white dragged pawn receives the premium gradient');
 assert.ok(style.body.includes('.checkers-drag-ghost.black'), 'black dragged pawn receives the premium gradient');
 assert.ok(style.body.includes('.checkers-drag-ghost:before'), 'drag clone renders face/inner ring');
 assert.ok(script.body.includes("checkers-offer-draw"),'Remis action is present');
 assert.ok(script.body.includes("sendDraw('acceptDraw')"),'acceptance sends explicit consent');
 assert.ok(script.body.includes("sendDraw('rejectDraw')"),'rejection is possible');
 assert.ok(script.body.includes("suppressDragClickTo=to"),'drag release never double-clicks its target');
 assert.ok(style.body.includes('#game:not(.game-focus)>.boardarea'),'board canvas overrides included');
 assert.ok(style.body.includes('checkers-history-columns'));
 assert.ok(style.body.includes('checkers-history-nav'));
 assert.ok(style.body.includes('checkers-mobile-menu-panel'));
 assert.ok(style.body.includes('pointer-events:none!important'),'coordinates never swallow gameplay clicks');
 const classic=load('/konto/warcaby/?konsola=klasyczna');
 assert.equal(classic.status,200);
 assert.doesNotMatch(classic.body,/chess-console cc-owner/,'classic URL remains original');
 const classicJs=load('/konto/warcaby/app.js?konsola=klasyczna');
 assert.doesNotMatch(classicJs.body,/checkers-history-nav/,'classic script remains unchanged');
});

test('Seat-to-play gate exists only in modern Warcaby and does not start clocks early',()=>{
 const modern=load('/konto/warcaby/');
 const classic=load('/konto/warcaby/?konsola=klasyczna');
 const js=load('/konto/warcaby/app.js');
 const training=load('/konto/warcaby/training-ui.mjs');
 const css=load('/konto/warcaby/styl.css');
 assert.match(modern.body,/id="checkers-start-gate"[^>]+role="dialog"[^>]+aria-modal="true"/);
 assert.match(modern.body,/data-checkers-side="1" aria-label="Wybierz białe pionki"/);
 assert.match(modern.body,/data-checkers-side="2" aria-label="Wybierz czarne pionki"/);
 assert.match(modern.body,/Gra rozpocznie się, gdy wybierzesz kolor pionków\./);
 assert.doesNotMatch(modern.body,/Zegar ruszy dopiero/);
 assert.doesNotMatch(classic.body,/id="checkers-start-gate"/,'classic game is unchanged');
 assert.ok(css.body.includes('checkers-start-gate[hidden]'),'hidden overlay stays hidden on initial load');
 assert.ok(js.body.includes("board.addEventListener('pointerover',showSeatGate)"));
 assert.ok(js.body.includes("board.addEventListener('pointerover',showMandatoryCaptureOnHover)"),'mandatory capture announced on hover');
 assert.ok(js.body.includes("board.addEventListener('focusin',showMandatoryCaptureOnHover)"),'keyboard focus announces mandatory capture');
 assert.ok(js.body.includes("if(sources.length&&(piece===current.player||piece===current.player+2)&&!sources.includes(from))syncCaptureNotice(true)"),'only another own non-capturing piece triggers the warning');
 assert.ok(!js.body.includes("syncCaptureNotice(true,d.from)"),'invalid drop does not raise an unsolicited warning');
 assert.ok(js.body.includes("seatPending=false;seatModal.hidden=true"));
 assert.ok(js.body.includes("trainingController?.activateSeat?.(side)"),'user chooses actual engine side, not CSS-only skin');
 assert.ok(js.body.includes("chatSignature='',rotated=true"),'initial board places white at bottom');
 assert.ok(js.body.includes('const i=rotated?63-pos:pos'),'preview honors orientation');
 assert.ok(training.body.includes("a.resetSeatGate?.()"));
 assert.ok(training.body.includes("playable:!a.isSeatPending?.()"),'unseated game blocks moves');
 assert.ok(training.body.includes("if(!clockStarted&&actor===1)clockStarted=true"),
   'first legal white move starts clock even if white is controlled by computer');
 assert.ok(training.body.includes("if(side===2)scheduleComputer(generation)"),'computer opens as white when human chooses black');
 assert.ok(training.body.includes("player:humanSide"),'actual human side is wired into engine');
 assert.ok(css.body.includes('outline:3px solid transparent!important'),'active turn badge has thicker ring');
 assert.ok(js.body.includes("sessionNickname||'Gość'"),'signed-out visitors are guests, never Gracz');
 // Legacy static clock-start contract retained:
 assert.ok(training.body.includes("if(!clockStarted&&actor===1)clockStarted=true"),
  'only first valid white move starts existing timer');
 assert.doesNotThrow(()=>new Script(js.body));
});

test('Warcaby dark chat styling and drag controls are isolated from chess/Gomoku',()=>{
 const style=load('/konto/warcaby/styl.css');
 const script=load('/konto/warcaby/app.js');
 const classic=load('/konto/warcaby/styl.css?konsola=klasyczna');
 assert.equal(style.status,200);
 assert.ok(style.body.includes('#game #chat-messages .game-chat-message'));
 assert.ok(style.body.includes('width:fit-content!important'));
 assert.ok(style.body.includes('max-width:min(88%,calc(100% - 12px))!important'));
 assert.ok(style.body.includes('#game #chat-messages .game-chat-message.own'));
 assert.ok(style.body.includes('#game #chat-input:focus-visible'));
 assert.ok(style.body.includes('outline:none!important'));
 assert.ok(style.body.includes('border:1px solid #a5b5b5!important'));
 assert.ok(style.body.includes('background:#fff!important'));
 assert.doesNotMatch(classic.body,/width:fit-content!important/,'classic rescue style unchanged');
 assert.doesNotMatch(script.body,/chat-messages\.replaceChildren\(mine/,'no chat controller modifications');
 assert.ok(style.body.includes('.game-chat-message.own')); 
 assert.ok(style.body.includes('align-self:flex-start!important')); 
 assert.ok(style.body.includes('checkers-drag-target'));
 assert.ok(style.body.includes('checkers-drag-ghost'));
 assert.ok(script.body.includes('b.dataset.index=String(i)'));
 assert.ok(script.body.includes("board.addEventListener('pointerdown'"));
 assert.ok(script.body.includes("board.addEventListener('pointermove'"));
 assert.ok(script.body.includes('void choose(to)'),'drop uses original game rules');
 assert.ok(script.body.includes('captureSources(state,current.player)'));
 assert.ok(script.body.includes('d.targets.includes(to)'));
 assert.ok(script.body.includes("if(document.body?.classList?.contains?.('chess-console'))"),'pointer handlers only activate inside modern console');
 assert.doesNotMatch(load('/konto/warcaby/?konsola=klasyczna').body,/class="warcaby-console chess-console/,'classic fallback remains a separate UI');
});

test('Modern Warcaby serves a four-profile bot catalog backed by its existing offline AI',()=>{
 const html=load('/konto/warcaby/'),css=load('/konto/warcaby/styl.css'),js=load('/konto/warcaby/app.js');
 for(const id of ['checkers-bots-overlay','checkers-bots-title','checkers-bots-play','checkers-bots-time','checkers-bots-bonus'])
  assert.ok(html.body.includes('id="'+id+'"'),id);
 for(const id of ['mila','bruno','nela','leon'])
  assert.ok(html.body.includes('data-bot="'+id+'"'),id);
 assert.ok(js.body.includes("level:'hard'"),'real engine difficulty selected');
 assert.ok(js.body.includes("botButton.addEventListener('click',openPicker)"),'dedicated Graj z botami button opens selector');
 assert.ok(js.body.includes("modeButton.addEventListener('click',()=>"),'Komputer remains an independent quick training mode');
 assert.ok(js.body.includes("document.body.dataset.checkersTrainingReady='yes'"),'selection waits for engine');
 assert.ok(css.body.includes('#checkers-bots-overlay:not([hidden])'));
 assert.ok(!load('/konto/warcaby/?konsola=klasyczna').body.includes('id="checkers-bots-overlay"'),
  'the legacy console remains unchanged');
});

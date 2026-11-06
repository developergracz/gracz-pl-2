import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,parseFen,legal,move,check,result,square,san} from '../auth/chess-rules.mjs';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {readFileSync} from 'node:fs';
function load(path,method='GET'){let status=0,headers={},body='';const res={writeHead(code,h){status=code;headers=h},end(text){body=String(text)}};const served=serveChessConsole({method},res,new URL('https://example.com'+path));return {served,status,headers,body};}
test('Szachy P3 premium console exposes authenticated online controls',()=>{
 const page=load('/konto/szachy/'),app=load('/konto/szachy/app.js'),style=load('/konto/szachy/styl.css'),rules=load('/konto/szachy/rules.mjs');
 assert.equal(page.served,true);assert.equal(page.status,200);
 assert.match(page.body,/Szachy Online/);assert.match(page.body,/class="board chess-board"/);
 assert.match(page.body,/type="module" src="\/konto\/szachy\/app\.js"/);
 assert.equal(app.status,200);assert.equal(rules.status,200);assert.equal(style.status,200);
 assert.equal(rules.body,readFileSync(new URL('../auth/chess-rules.mjs',import.meta.url),'utf8'),'browser and server rules must stay identical');
 assert.match(app.body,/import \{initial,legal,apply,san/);
 assert.match(app.body,/Gra lokalna/);
 assert.match(app.body,/fetch\('/);assert.match(app.body,/social\/challenges/);assert.match(app.body,/version:online.version/);
 assert.match(style.body,/repeat\(8,minmax\(0,1fr\)\)/);
 assert.match(page.headers['Content-Security-Policy'],/script-src 'self'/);
 assert.equal(load('/konto/szachy','POST').served,false);
 assert.equal(load('/konto/szachy/unknown').served,false);
});
test('Chess Premium invitation windows load as isolated same-origin assets',()=>{
 const page=load('/konto/szachy/'),script=load('/konto/szachy/invitations.js'),style=load('/konto/szachy/invitations.css');
 assert.equal(script.status,200);assert.equal(style.status,200);
 assert.match(page.body,/id="chess-invite-overlay"/);
 assert.match(page.body,/id="chess-invite-received"/);
 assert.match(page.body,/id="chess-invite-schedule-form"/);
 assert.match(page.body,/src="\/konto\/szachy\/invitations.js"/);
 assert.match(page.body,/href="\/konto\/szachy\/invitations.css"/);
 assert.match(script.body,/friends\/presence/);
 assert.match(script.body,/action,\.\.\.options/);
 assert.match(script.body,/sendReminder/);
 assert.match(script.body,/scheduledAt/);
 assert.match(script.body,/Akceptuj i przejdź do gry/);
 assert.match(script.body,/location\.assign\(gameUrl\(row\.id\)\)/);
 assert.match(style.body,/\.chess-invite-window/);
 assert.match(style.body,/\.chess-invite-received/);
 assert.equal(load('/konto/szachy/invitations.js','POST').served,false);
});
test('chess UI uses native side panels without secondary actions under the board',()=>{
 const page=load('/konto/szachy/'),app=load('/konto/szachy/app.js'),css=load('/konto/szachy/styl.css');
 assert.match(page.body,/id="training-mode"/);
 assert.match(page.body,/id="online-mode"/);
 assert.match(page.body,/id="chat-input"/);
 assert.match(app.body,/chatForm.addEventListener\('submit'/);
 assert.match(app.body,/match\/chat/);
 assert.match(app.body,/history-tab/);
 assert.match(app.body,/sideTraining\.hidden=mode/);
 assert.doesNotMatch(app.body,/board\.parentElement\.after\(notice,toolbar/);
 assert.match(css.body,/\.chess-console \.boardframe/);
 assert.match(css.body,/aspect-ratio:1/);
 assert.match(css.body,/\.chess-console \.layout/);
});
test('Chess labels, sidebar sizing and additive WebSocket chat match the premium console',()=>{
 const page=load('/konto/szachy/'),app=load('/konto/szachy/app.js'),style=load('/konto/szachy/styl.css');
 assert.match(page.body,/Czarne — drugi ruch/);
 assert.match(page.body,/Białe — zaczynają/);
 assert.doesNotMatch(page.body,/Czarne — zaczynają/);
 assert.match(style.body,/\.chess-console \.sidebar \.sidebar-footer \.side-links a/);
 assert.match(style.body,/white-space:normal!important/);
 assert.match(app.body,/onlineMessages=mergeChat\(m\.messages\)/);
 assert.match(app.body,/online\?\.players\?\.\[m\.player-1\]/);
});
test('premium chess panels include real clocks, six top icons and right dock tools',()=>{
 const page=load('/konto/szachy/'),app=load('/konto/szachy/app.js'),css=load('/konto/szachy/styl.css');
 for(const id of ['training-time','training-increment','training-records','clock-1','clock-2','focus-game','fullscreen-game','invite-friend','undo-move','analyze-position','game-settings'])assert.match(page.body,new RegExp('id="'+id+'"'));
 assert.match(app.body,/function updateClocks\(\)/);
 assert.match(app.body,/timeLimitMinutes:Number/);
 assert.match(app.body,/clock\.remaining/);
 assert.match(app.body,/localTimeout/);
 assert.match(app.body,/focusButton\?\.addEventListener/);
 assert.match(app.body,/game-settings/);
 assert.match(css.body,/premium-quick-links/);
 assert.match(css.body,/game-tools/);
 assert.match(css.body,/clock:not\(\[hidden\]\)/);
});
test('computer mode and premium layout reuse Gomoku without duplicated focus navigation',()=>{
 const page=load('/konto/szachy/'),app=load('/konto/szachy/app.js'),styles=load('/konto/szachy/styl.css'),ai=load('/konto/szachy/computer.mjs');
 assert.equal(ai.status,200);
 assert.match(ai.body,/export function chooseComputerMove/);
 assert.match(app.body,/import \{chooseComputerMove\} from '\/konto\/szachy\/computer\.mjs'/);
 assert.match(app.body,/scheduleComputer/);
 assert.match(app.body,/textContent='Komputer'/);
 assert.match(app.body,/id='chess-opponent'/);
 assert.match(app.body,/layout\.classList\.toggle\('game-focus'/);
 assert.match(app.body,/console-config-open/);
 assert.match(app.body,/howto-open/);
 assert.match(styles.body,/\.layout\.game-focus/);
 assert.match(styles.body,/\.chess-square\.white-piece/);
 assert.match(styles.body,/grid-template-columns:clamp\(355px,26vw,465px\)/);
 assert.match(page.body,/id="focus-nav"/);
});
test('online lobby renders a disabled initial board when no accepted match is selected',()=>{
 const app=load('/konto/szachy/app.js');
 assert.equal(app.status,200);
 assert.match(app.body,/return g\?\{b:g\.board.*\}:initial\(\)/);
 assert.match(app.body,/const preview=mode==='online'&&!online\?\.state/);
 assert.match(app.body,/Szachy Online — plansza poglądowa/);
 assert.match(app.body,/Oczekiwanie na partię/);
 assert.match(app.body,/online&&mode==='online'&&online\.playable/);
});
test('online preview preserves full opacity while keeping moves disabled',()=>{
 const css=load('/konto/szachy/styl.css').body;
 const js=load('/konto/szachy/app.js').body;
 assert.match(css,/\.chess-board \.chess-square:disabled\{opacity:1!important/);
 assert.match(js,/cell\.disabled=!!terminal\|\|!allowed\|\|!!promotion/);
});
test('chess draw claim is exposed only for valid FIDE local or authenticated online positions',()=>{
 const app=load('/konto/szachy/app.js'),styles=load('/konto/szachy/styl.css');
 assert.match(app.body,/claimButton\.addEventListener\('click'/);
 assert.match(app.body,/claimableDraw\(state,states\.map\(key\)\)/);
 assert.match(app.body,/online\.player===online\.state\.turn&&claimableDraw/);
 assert.match(app.body,/move:\{claimDraw:true\}/);
 assert.match(app.body,/localDrawReason/);
 assert.match(styles.body,/\.chess-claim-draw\[hidden\]/);
 assert.equal(load('/konto/szachy/rules.mjs').body,readFileSync(new URL('../auth/chess-rules.mjs',import.meta.url),'utf8'));
});
test('standard position and illegal moves',()=>{
 const s=initial();assert.equal(legal(s).length,20);
 assert.ok(move(s,'e2e4'));assert.equal(move(s,'e2e5'),null);
 assert.equal(move(s,'e1g1'),null);assert.equal(move(s,'a7a6'),null);
});
test('fools mate, check and terminal status',()=>{
 const states=[initial()];
 for(const u of ['f2f3','e7e5','g2g4','d8h4']){const next=move(states.at(-1),u);assert.ok(next,u);states.push(next);}
 assert.equal(check(states.at(-1)),true);
 assert.match(result(states),/Mat/);
 assert.equal(legal(states.at(-1)).length,0);
});
test('castling both sides, prohibited through attack',()=>{
 const s=parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
 assert.ok(move(s,'e1g1'));assert.ok(move(s,'e1c1'));
 const blocked=parseFen('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
 assert.equal(move(blocked,'e1g1'),null);
});
test('en passant and all four promotion choices',()=>{
 const s=parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'),ep=move(s,'e5d6');
 assert.ok(ep);assert.equal(ep.b[square('d5')],'.');
 const p=parseFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
 for(const x of ['q','r','b','n'])assert.equal(move(p,'a7a8'+x).b[square('a8')],x.toUpperCase());
});
test('stalemate and insufficient material',()=>{
 assert.match(result([parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')]),/Pat/);
 assert.match(result([parseFen('7k/8/6K1/8/8/8/8/8 w - - 0 1')]),/materiału/);
});

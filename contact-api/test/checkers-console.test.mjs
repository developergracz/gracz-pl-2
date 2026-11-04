import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';

function load(path,method='GET'){
 let status=0,headers={},body='';
 const response={writeHead(code,values){status=code;headers=values},end(value){body=String(value)}};
 const served=serveCheckersConsole({method},response,new URL('https://example.com'+path));
 return {served,status,headers,body};
}
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
 for(const id of ['checkers-history','checkers-settings','checkers-chat','checkers-refresh'])assert.match(js.body,new RegExp(id));
 assert.match(page.body,/Pokoje i zaproszenia/);
 assert.match(page.body,/checkers-room-subtitle/);
 assert.match(style.body,/\.warcaby-console \.layout:not\(\.game-focus\)/);
 assert.match(style.body,/\.warcaby-console \.boardframe/);
 assert.match(style.body,/grid-template-columns:minmax\(0,1fr\) clamp\(285px,21\.5vw,360px\)/);
 assert.match(style.body,/@media \(max-width:800px\)/);
 assert.match(style.body,/\.warcaby-console \.mode\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
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

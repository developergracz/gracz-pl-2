import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
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
 // Full Max Premium pieces: CSS bodies, vector gold crown medallion for kings, decorative SVG only.
 for(const piece of ['.piece.white{','.piece.black{','.piece.king:after{content:none}','.piece .crown{'])assert.ok(style.body.includes(piece),piece);
 assert.doesNotMatch(style.body,/♛/);
 assert.match(page.body,/<svg class="checkers-piece-defs" aria-hidden="true" focusable="false"[^>]*>[\s\S]*?<symbol id="checkers-crown"/);
 assert.match(js.body,/if\(p>=3\)token\.append\(crownEmblem\(\)\)/);
 assert.match(js.body,/setAttribute\('aria-hidden','true'\)/);
 for(const id of ['checkers-history','checkers-settings','checkers-chat','checkers-refresh'])assert.match(js.body,new RegExp(id));
 assert.match(page.body,/Pokoje i zaproszenia/);
 assert.match(page.body,/checkers-room-subtitle/);
 assert.match(style.body,/\.warcaby-console \.layout:not\(\.game-focus\)/);
 assert.match(style.body,/\.warcaby-console \.boardframe/);
 assert.match(style.body,/Reference parity with Gomoku console/);

 assert.match(style.body,/R7 pixel alignment: polished checkers/);
 assert.match(style.body,/height:55px;min-height:55px;max-height:55px/);
 assert.match(style.body,/min-height:28px;height:28px/);
 assert.match(style.body,/min-height:38px;height:38px/);
 assert.match(style.body,/background:linear-gradient\(115deg,#fffcf4/);
 assert.match(style.body,/border:2px solid #967c54/);
 assert.match(style.body,/margin-bottom:48px/);
 assert.match(style.body,/@media \(min-width:801px\) and \(max-height:800px\)/);
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

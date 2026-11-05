import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {serveChessConsole} from '../auth/chess-console.mjs';
function load(path,method='GET'){let status=0,headers={},body='';const res={writeHead(code,h){status=code;headers=h},end(text){body=String(text)}};const served=serveChessConsole({method},res,new URL('https://example.com'+path));return {served,status,headers,body};}
test('Szachy P1 reuses premium shell and exposes only a disabled preview',()=>{
 const page=load('/konto/szachy/');
 assert.equal(page.served,true);assert.equal(page.status,200);
 assert.match(page.body,/Szachy Online/);assert.match(page.body,/class="board chess-board"/);
 assert.match(page.body,/\/konto\/szachy\/app\.js/);assert.match(page.body,/\/konto\/gomoku\/styl\.css/);
 assert.doesNotMatch(page.body,/src="\/konto\/gomoku\/app\.js"/);
 assert.match(page.headers['Content-Security-Policy'],/script-src 'self'/);
 const app=load('/konto/szachy/app.js'),style=load('/konto/szachy/styl.css');
 assert.equal(app.status,200);assert.equal(style.status,200);
 assert.doesNotThrow(()=>new Script(app.body));
 assert.match(app.body,/gra w przygotowaniu/);assert.doesNotMatch(app.body,/fetch\(|WebSocket|auth\/match/);
 assert.match(style.body,/repeat\(8,minmax\(0,1fr\)\)/);
 assert.equal(load('/konto/szachy','POST').served,false);
 assert.equal(load('/konto/szachy/unknown').served,false);
});

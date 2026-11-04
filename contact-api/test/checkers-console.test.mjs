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
 assert.match(page.body,/\/konto\/warcaby\/app\.js/);
 assert.match(page.headers['Content-Security-Policy'],/script-src 'self'/);
 assert.doesNotMatch(page.headers['Content-Security-Policy'],/unsafe-inline/);
 const js=load('/konto/warcaby/app.js');
 assert.equal(js.status,200);
 assert.doesNotThrow(()=>new Script(js.body));
 assert.match(js.body,/\/auth\//);
 assert.match(js.body,/credentials:'same-origin'/);
 assert.match(js.body,/version:current.version/);
 assert.match(page.body,/id="begin-match"[^>]*href="\/konto\/panel\/#challenges"/);
 assert.match(js.body,/function renderPreviewBoard\(\)/);
 assert.match(js.body,/if\(!validMatch\)\{renderPreviewBoard\(\)/);
 assert.match(js.body,/r<3\?1:r>4\?2:0/);
 assert.equal(load('/konto/warcaby/styl.css').status,200);
 assert.equal(load('/konto/warcaby/').headers['Content-Length'],Buffer.byteLength(page.body));
 assert.equal(load('/konto/warcaby/', 'POST').served,false);
 assert.equal(load('/konto/warcaby/no-such').served,false);
});

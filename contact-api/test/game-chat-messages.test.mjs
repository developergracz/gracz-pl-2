import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveChessConsole} from '../auth/chess-console.mjs';

function asset(serve,path){
 let body='';
 assert.equal(serve({method:'GET'},{writeHead(){},end(value){body=String(value)}},new URL(path,'https://example.test')),true,path+' is served');
 return body;
}
const node=tagName=>({tagName,children:[],append(...items){this.children.push(...items)}});

test('all consoles load the common message renderer before their controllers',()=>{
 for(const [serve,slug] of [[serveGomokuConsole,'gomoku'],[serveCheckersConsole,'warcaby'],[serveChessConsole,'szachy']]){
  const html=asset(serve,'/konto/'+slug+'/');
  assert.ok(html.indexOf('src="/konto/game-chat.js"')>=0,slug+' loads shared renderer');
  assert.ok(html.indexOf('src="/konto/game-chat.js"')<html.indexOf('src="/konto/'+slug+'/app.js"'));
  assert.match(html,/href="\/konto\/game-chat.css"/);
 }
});
test('sender identity determines bubble color even when an opponent is named Ty or GRACZ AI',()=>{
 const window={},document={createElement:node};
 runInNewContext(asset(serveGomokuConsole,'/konto/game-chat.js'),{window,document});
 for(const sender of ['Ty','GRACZ AI','Przeciwnik']){
  const bubble=window.GraczChat.createMessage({sender,body:'witam\nDłuższa wiadomość <b>tekst</b>',mine:false,createdAt:'2026-11-09T12:15:00Z'});
  assert.equal(bubble.className,'chat-bubble game-chat-message');
  assert.equal(bubble.children[0].textContent,sender+':');
  assert.equal(bubble.children[1].textContent,'witam\nDłuższa wiadomość <b>tekst</b>');
  assert.equal(bubble.children[2].dateTime,'2026-11-09T12:15:00.000Z');
  assert.ok(bubble.children[2].textContent);
 }
 const own=window.GraczChat.createMessage({sender:'Ty',body:'witam',mine:true,createdAt:'2026-11-09T12:15:00Z',timestamps:false});
 assert.equal(own.className,'chat-bubble game-chat-message own');
 assert.equal(own.children[2].hidden,true);
});

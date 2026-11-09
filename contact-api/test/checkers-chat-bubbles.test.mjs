import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {gameChatJs} from '../auth/game-chat-messages.mjs';
import assert from 'node:assert/strict';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

function asset(serve,path){
 let body='',status=0;
 const handled=serve({method:'GET'},{
  writeHead(code){status=code},
  end(value){body=String(value)}
 },new URL('https://gracz-contact-api.onrender.com'+path));
 assert.equal(handled,true);
 assert.equal(status,200);
 return body;
}
function node(tagName){
 return {
  tagName,children:[],className:'',textContent:'',scrollTop:0,scrollHeight:200,
  append(...items){for(const item of items){
   if(item.tagName==='#fragment')this.children.push(...item.children);
   else this.children.push(item);
  }},
  replaceChildren(...items){this.children=[];this.append(...items);}
 };
}

test('Warcaby renders player and AI messages in the same premium bubble structure as Gomoku',()=>{
 const js=asset(serveCheckersConsole,'/konto/warcaby/app.js');
 const gomokuCss=asset(serveGomokuConsole,'/konto/gomoku/styl.css');
 assert.match(gomokuCss,/\.chat-bubble\{/);
 assert.match(asset(serveGomokuConsole,'/konto/game-chat.css'),/#chat-panel \.game-chat-message\.own/);
 const from=js.indexOf('function makeChatBubble(');
 const to=js.indexOf('async function refreshChat()',from);
 const trainStart=js.indexOf('function renderTrainingAiChat()');
 const trainEnd=js.indexOf('async function sendTrainingAi(',trainStart);
 assert.ok(from>0&&to>from&&trainStart>to&&trainEnd>trainStart);
 const messages=node('section'),preview=node('section');
 const boxes={'chat-messages':messages,'chat-preview':preview};
 const document={createElement:node,createDocumentFragment:()=>node('#fragment')};
 const window={};runInNewContext(gameChatJs,{document,window});
 const run=new Function('document','$','window',[
  "let mode='training',current=null,chatSignature='',trainingAiMessages=[];",
  js.slice(from,to),js.slice(trainStart,trainEnd),
  "return {training(rows){mode='training';trainingAiMessages=rows;renderTrainingAiChat()},online(rows,match){mode='online';current=match;drawChat(rows)}};"
 ].join('\n'))(document,id=>boxes[id],window);
 const at='2026-11-09T02:56:00.000Z';
 run.training([
  {role:'user',content:'witam',createdAt:at},
  {role:'assistant',content:'Witaj! Zasady warcabów opisuję w kolejnych akapitach.\nDrugie zdanie.',createdAt:at}
 ]);
 assert.equal(messages.children.length,2);
 assert.equal(messages.children[0].tagName,'div');
 assert.equal(messages.children[0].className,'chat-bubble game-chat-message own');
 assert.equal(messages.children[0].children[0].textContent,'Ty:');
 assert.equal(messages.children[0].children[1].textContent,'witam');
 assert.equal(messages.children[0].children[2].tagName,'time');
 assert.equal(messages.children[1].className,'chat-bubble game-chat-message');
 assert.equal(messages.children[1].children[0].textContent,'GRACZ AI:');
 assert.match(messages.children[1].children[1].textContent,/Drugie zdanie/);
 assert.equal(preview.children.length,2);
 assert.equal(preview.children[1].className,'chat-bubble game-chat-message');
 assert.ok(!messages.children[1].children[1].textContent.startsWith('GRACZ AI:'));

 run.online([
  {id:'a',player:2,body:'Oponent',createdAt:at},
  {id:'b',player:1,body:'Moja wiadomość',createdAt:at}
 ],{player:1,players:['Ala','Bartek']});
 assert.equal(messages.children.length,2);
 assert.equal(messages.children[0].children[0].textContent,'Bartek:');
 assert.equal(messages.children[0].className,'chat-bubble game-chat-message');
 assert.equal(messages.children[1].children[0].textContent,'Ty:');
 assert.equal(messages.children[1].className,'chat-bubble game-chat-message own');
 assert.equal(preview.children[1].children[1].textContent,'Moja wiadomość');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
const id='11111111-1111-4111-8111-111111111111';
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
function setup(){
 const elements=new Map(),events={},intervals=[],calls=[],sockets=[];
 class Element{
  constructor(){this.children=[];this.value='';this.textContent='';this.listeners={};this.style={};this.dataset={};
   this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}
  setAttribute(){} focus(){} addEventListener(k,fn){this.listeners[k]=fn;}
  append(...x){this.children.push(...x);} replaceChildren(...x){this.children=x;}
 }
 const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const document={hidden:false,visibilityState:'visible',getElementById:$,querySelector:()=>new Element(),
  createElement:()=>new Element(),createElementNS:()=>new Element(),createTextNode:x=>x,createDocumentFragment:()=>new Element(),
  addEventListener:(k,fn)=>events[k]=fn};
 class Socket{
  constructor(){sockets.push(this);}send(raw){this.sent=JSON.parse(raw);}close(){this.onclose?.();}
  receive(m){this.onmessage({data:JSON.stringify(m)});}
 }
 const match={id,game:'warcaby',version:0,player:1,players:['A','B'],playable:true,
  state:{board:Array(64).fill(0),turn:1,moves:0,winner:0,forced:null,history:[]}};
 const window={WebSocket:Socket,navigator:{onLine:true},localStorage:{getItem:()=>null,setItem(){}},
  setTimeout:()=>1,clearTimeout(){},addEventListener:(k,fn)=>events[k]=fn};
 const context={window,document,URLSearchParams,location:{search:'?match='+id,protocol:'https:',host:'example.test'},
  setInterval:(fn,ms)=>intervals.push({fn,ms}),setTimeout:()=>1,clearTimeout(){},
  fetch:async path=>{calls.push(path);return {ok:true,json:async()=>({ok:true,match:structuredClone(match),messages:[],challenges:[]})};}};
 let js;serveCheckersConsole({method:'GET'},{writeHead(){},end(x){js=x;}},new URL('https://example.test/konto/warcaby/app.js'));
 js=js.replace(/\}\)\(\);\s*$/,';globalThis.currentMatch=()=>current;})();');
 new Script(js).runInNewContext(context);
 return {context,document,events,intervals,calls,sockets,match};
}
test('checkers: pushed snapshots/deltas/chat replace polling and a sequence gap restores HTTP',async()=>{
 const c=setup();await flush();
 assert.equal(c.sockets.length,1,'online console must open shared realtime transport');
 const socket=c.sockets[0];socket.onopen();assert.equal(socket.sent.matchId,id);
 socket.receive({type:'snapshot',matchId:id,seq:1,match:c.match,messages:[]});
 c.calls.length=0;for(const i of c.intervals)if(i.ms===4000)i.fn();await flush();assert.equal(c.calls.length,0);
 socket.receive({type:'match',matchId:id,seq:2,baseVersion:0,version:1,
  match:{...c.match,version:1,state:{...c.match.state,turn:2,moves:1}},changes:[[24,1]],historyFrom:0,historyAppend:[{from:17,to:24,player:1}]});
 assert.equal(c.context.currentMatch().state.board[24],1);
 assert.equal(c.context.currentMatch().version,1);
 socket.receive({type:'chat',matchId:id,seq:3,messages:[{id:'chat-1',player:2,body:'Hello'}]});
 socket.receive({type:'match',matchId:id,seq:5});await flush();
 assert.ok(c.calls.some(x=>x.startsWith('/auth/match?id=')),'gap reloads the database snapshot');
 assert.equal(c.context.currentMatch().version,1,'a stale HTTP reply cannot replace a newer pushed state');
 c.document.hidden=true;c.events.visibilitychange();
});

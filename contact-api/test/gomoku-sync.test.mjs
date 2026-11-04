import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

const id='00000000-0000-4000-8000-000000000001';
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function backend(){
 return {version:0,players:['A','B'],state:{board:Array(225).fill(0),turn:1,winner:0,moves:0,history:[],
  clock:{remaining:[420000,420000],since:new Date(1700000000000).toISOString(),ready:[true,true],incrementMs:0}},undoRequest:null};
}
function client(shared=backend(),player=1,source,WebSocketImpl){
 const elements=new Map(),intervals=[],timeouts=new Map(),events={},calls=[];
 let now=1700000000000,sequence=0,fail=false,hold=null;
 class Element{
  constructor(){this.children=[];this.listeners={};this.value='';this.hidden=false;this.disabled=false;
   this.textContent='';this.style={};this.dataset={};this.classes=new Set();
   this.classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),contains:x=>this.classes.has(x),
    toggle:(x,on)=>{if(on===undefined)on=!this.classes.has(x);if(on)this.classes.add(x);else this.classes.delete(x);}};}
  addEventListener(k,fn){this.listeners[k]=fn;}
  append(...xs){this.children.push(...xs);}
  replaceChildren(...xs){this.children=xs;}
  setAttribute(k,v){this[k]=v;}
  focus(){} scrollIntoView(){}
 }
 const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const document={getElementById:get,createElement:()=>new Element(),visibilityState:'visible',
  addEventListener:(k,fn)=>{events[k]=fn;}};
 const window={WebSocket:WebSocketImpl,navigator:{onLine:true},performance:{now:()=>now},
  setInterval:(fn,ms)=>{intervals.push({fn,ms,next:now+ms});},
  setTimeout:(fn,ms)=>{const key=++sequence;timeouts.set(key,{fn,at:now+ms});return key;},
  clearTimeout:key=>timeouts.delete(key),addEventListener:(k,fn)=>{events[k]=fn;},
  localStorage:{getItem:()=>null,setItem(){}},location:{assign(){}}};
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const fetch=async(path,options={})=>{
  calls.push({path,method:options.method||'GET'});
  if(hold&&hold.path===path){const pending=hold;hold=null;await new Promise((resolve,reject)=>{
   pending.release=resolve;options.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});}
  if(fail)throw new Error('offline');
  let body={ok:true};
  if(path==='/auth/profile')body.profile={nickname:'A'};
  else if(path==='/auth/social/challenges')body.challenges=[{id,game:'gomoku',status:'accepted',opponent:'B'}];
  else if(path==='/auth/friends/presence')body.friends=[];
  else if(path.startsWith('/auth/match/chat'))body.messages=[];
  else if(path.startsWith('/auth/match')){
   if(options.method==='POST'){
    const input=JSON.parse(options.body);
    if(path==='/auth/match'){
     assert.equal(input.version,shared.version);assert.equal(shared.state.turn,player);
     shared.state.board[input.move.to]=player;shared.state.moves++;shared.state.last=input.move.to;
     shared.state.history.push({player,to:input.move.to,number:shared.state.moves});
     const previous=shared.state.clock;
     previous.remaining[player-1]-=now-Date.parse(previous.since);previous.since=new Date(now).toISOString();
     shared.state.turn=3-player;
    }else if(input.action==='request')shared.undoRequest={id:'undo-1',requester:player,targetTo:0,requesterName:'A'};
    else shared.undoRequest=null;
    shared.version++;
   }
   body={ok:true,serverTime:new Date(now).toISOString(),match:{...structuredClone(shared),id,game:'gomoku',player,playable:true}};
  }else throw new Error('Unexpected request '+path);
  return {ok:true,status:200,json:async()=>body};
 };
 const context={document,window,fetch,Date:ClockDate,AbortController,URLSearchParams,console,
  location:{search:''},history:{replaceState(){}},renderCount:0};
 get('training-time').value='7';
 let script=source;
 if(!script)serveGomokuConsole({method:'GET'},{writeHead(){},end(s){script=s;}},new URL('http://local/konto/gomoku/app.js'));
 script=script.replace('function render(){','function render(){globalThis.renderCount++;')
  .replace(/\}\)\(\);\s*$/,'globalThis.hooks={state,setMode,loadMatch,refreshOnline,refreshRoomChat,api,rooms,onlineMove,sendUndoAction};})();');
 new Script(script).runInNewContext(context);
 return {context,get,calls,shared,events,document,window,hooks:context.hooks,
  fail(value){fail=value;},hold(path){const pending={path,release:null};hold=pending;return pending;},
  async join(){context.hooks.setMode('online');await flush();await context.hooks.loadMatch(id);await flush();},
  async tick(ms){const end=now+ms;while(now<end){now=Math.min(end,now+250);
   for(const timer of intervals)if(now>=timer.next){timer.next+=timer.ms;timer.fn();}
   for(const [key,timer]of timeouts)if(now>=timer.at){timeouts.delete(key);timer.fn();}
   await flush();}},
 };
}

test('P1: training makes no presence requests; online keeps 4s/8s cadence and skips unchanged board renders',async()=>{
 const c=client();await c.tick(90000);
 assert.equal(c.calls.length,0);
 await c.join();assert.equal(c.calls.filter(x=>x.path==='/auth/profile').length,0);
 c.calls.length=0;const rendered=c.context.renderCount;
 await c.tick(8000);
 assert.equal(c.calls.filter(x=>x.path.startsWith('/auth/match?id')).length,2);
 assert.equal(c.calls.filter(x=>x.path.startsWith('/auth/match/chat?id')).length,1);
 assert.equal(c.context.renderCount,rendered);
 // Session/participant projection may change even at the same durable version.
 c.hooks.state.match.player=2;
 await c.hooks.refreshOnline();
 assert.equal(c.hooks.state.match.player,1);
 assert.equal(c.context.renderCount,rendered+1);
});

test('P1: coalesce concurrent reads, release failed/timed out requests, prevent double chat submits',async()=>{
 const c=client();const held=c.hold('/auth/friends/presence');
 const a=c.hooks.api('friends/presence'),b=c.hooks.api('friends/presence');
 await flush();assert.equal(c.calls.length,1);held.release();await Promise.all([a,b]);
 c.fail(true);await assert.rejects(c.hooks.api('friends/presence'));c.fail(false);
 await c.hooks.api('friends/presence');
 const timed=c.hold('/auth/friends/presence');
 const pending=assert.rejects(c.hooks.api('friends/presence'));await c.tick(15000);await pending;
 assert.ok(timed.release);await c.hooks.api('friends/presence');
 await c.join();c.get('chat-input').value='hello';const send=c.get('chat-form').listeners.submit;
 const post=c.hold('/auth/match/chat');const first=send({preventDefault(){}});await flush();
 await send({preventDefault(){}});
 assert.equal(c.calls.filter(x=>x.path==='/auth/match/chat'&&x.method==='POST').length,1);
 post.release();await first;
});

test('P1: two clients preserve optimistic moves, clocks, undo, result and reconnect synchronization',async()=>{
 const shared=backend(),a=client(shared,1),b=client(shared,2);await a.join();await b.join();
 const move=a.hold('/auth/match');const sending=a.hooks.onlineMove(0);await flush();
 assert.equal(a.get('board').children[0].classes.has('pending'),true);
 assert.equal(shared.state.board[0],0);move.release();await sending;await b.tick(4000);
 assert.equal(b.get('board').children[0].classes.has('p1'),true);
 assert.equal(b.get('clock-2').textContent,'06:56');
 await b.hooks.onlineMove(15);await a.hooks.refreshOnline();
 assert.equal(a.get('board').children[15].classes.has('p2'),true);
 await a.hooks.sendUndoAction('request');await b.hooks.refreshOnline();
 assert.equal(b.get('undo-request-modal').hidden,false);
 await b.hooks.sendUndoAction('reject');await a.hooks.refreshOnline();
 assert.equal(a.hooks.state.match.undoRequest,null);
 b.document.visibilityState='hidden';b.calls.length=0;await b.tick(90000);assert.equal(b.calls.length,0);
 shared.state.winner=1;shared.version++;
 b.document.visibilityState='visible';b.events.visibilitychange();await flush();
 assert.equal(b.hooks.state.match.state.winner,1);
 b.window.navigator.onLine=false;b.calls.length=0;await b.tick(90000);assert.equal(b.calls.length,0);
 b.window.navigator.onLine=true;b.fail(true);b.events.online();await flush();
 b.fail(false);b.events.online();await flush();assert.equal(b.hooks.state.busy,false);
 assert.ok(b.calls.some(x=>x.path.startsWith('/auth/match?id')));
});

export {client};


test('P2: pushed state replaces polling; version gaps restore HTTP and hidden tabs close transport',async()=>{
 const sockets=[];
 class Socket{
  constructor(){sockets.push(this);}
  send(raw){this.sent=JSON.parse(raw);}
  close(){this.onclose?.();}
  receive(m){this.onmessage({data:JSON.stringify(m)});}
 }
 const shared=backend(),c=client(shared,2,undefined,Socket);await c.join();
 const socket=sockets[0];socket.onopen();assert.equal(socket.sent.type,'subscribe');
 socket.receive({type:'snapshot',matchId:id,seq:1,match:structuredClone(c.hooks.state.match),messages:[],serverTime:new Date(1700000000000).toISOString()});
 await flush();c.calls.length=0;
 const rendered=c.context.renderCount;await c.tick(8000);
 assert.equal(c.calls.filter(x=>x.path.startsWith('/auth/match')).length,0);
 assert.equal(c.context.renderCount,rendered);
 assert.equal(c.get('clock-1').textContent,'06:52');
 shared.version=1;shared.state.board[0]=1;shared.state.turn=2;shared.state.moves=1;
 shared.state.history=[{player:1,to:0,number:1}];shared.state.clock.since=new Date(1700000008000).toISOString();
 const {board,history,...state}=structuredClone(shared.state);
 socket.receive({type:'match',matchId:id,seq:2,baseVersion:0,version:1,
  match:{...structuredClone(c.hooks.state.match),version:1,state},changes:[[0,1]],historyFrom:0,historyAppend:history,
  serverTime:new Date(1700000008000).toISOString()});
 assert.equal(c.get('board').children[0].classes.has('p1'),true);
 assert.equal(c.hooks.state.match.state.history.length,1);
 socket.receive({type:'chat',matchId:id,seq:3,messages:[{id:'message',player:1,body:'hello',createdAt:new Date().toISOString()}]});
 assert.equal(c.get('chat-input').disabled===false,true);
 // Losing an event cannot silently advance the local revision.
 socket.receive({type:'match',matchId:id,seq:5});await flush();
 assert.ok(c.calls.some(x=>x.path.startsWith('/auth/match?id')));
 c.document.visibilityState='hidden';c.events.visibilitychange();c.calls.length=0;await c.tick(8000);
 assert.equal(c.calls.length,0);
 c.document.visibilityState='visible';c.events.visibilitychange();await flush();assert.equal(sockets.length,2);
 assert.ok(c.calls.some(x=>x.path.startsWith('/auth/match?id')));
});

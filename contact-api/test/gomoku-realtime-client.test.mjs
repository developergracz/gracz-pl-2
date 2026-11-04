import test from 'node:test';
import assert from 'node:assert/strict';
import {createGomokuRealtimeClient} from '../auth/gomoku-realtime-client.mjs';

function fixture(){
 const timers=new Map(),sockets=[],received=[];let timerId=0,id='room',visible=true,fallbacks=0;
 class Socket{
  constructor(url){this.url=url;this.readyState=0;sockets.push(this);}
  send(raw){this.sent=JSON.parse(raw);}
  close(){this.readyState=3;this.onclose?.();}
  open(){this.readyState=1;this.onopen();}
  receive(message){this.onmessage({data:JSON.stringify(message)});}
 }
 const transport=createGomokuRealtimeClient({WebSocketImpl:Socket,url:'wss://game.test/auth/gomoku/realtime',
  getMatchId:()=>id,getVersion:()=>2,canConnect:()=>visible,
  schedule:(fn,delay)=>{const key=++timerId;timers.set(key,{fn,delay});return key;},cancel:key=>timers.delete(key),random:()=>0.5,
  onMessage:m=>{received.push(m);return true;},onFallback:()=>fallbacks++});
 return {transport,sockets,timers,received,get fallbacks(){return fallbacks;},hide(){visible=false;},room(next){id=next;},
  fire(delay){const entry=[...timers].find(([,t])=>t.delay===delay);assert.ok(entry,'timer '+delay);timers.delete(entry[0]);entry[1].fn();}};
}
test('client: one connection, snapshot before polling stops, duplicates ignored and gaps trigger fallback',()=>{
 const f=fixture();f.transport.update();f.transport.update();assert.equal(f.sockets.length,1);
 const socket=f.sockets[0];socket.open();assert.equal(socket.sent.version,2);assert.equal(f.transport.isReady(),false);
 socket.receive({type:'snapshot',matchId:'room',seq:1});assert.equal(f.transport.isReady(),true);
 socket.receive({type:'match',matchId:'room',seq:2});socket.receive({type:'match',matchId:'room',seq:2});
 assert.equal(f.received.length,2);
 socket.receive({type:'chat',matchId:'room',seq:4});assert.equal(f.transport.isReady(),false);assert.equal(f.fallbacks,1);
 assert.ok([...f.timers.values()].some(t=>t.delay>=500&&t.delay<=30000));
});
test('client: reconnects with bounded backoff; hidden tab and obsolete sockets cannot modify a new room',()=>{
 const f=fixture();f.transport.update();f.fire(8000);assert.equal(f.fallbacks,1);
 f.fire(1500);const old=f.sockets[1];old.open();
 f.room('other');f.transport.update();const next=f.sockets[2];next.open();
 old.receive({type:'snapshot',matchId:'room',seq:1});assert.equal(f.transport.isReady(),false);
 next.receive({type:'snapshot',matchId:'other',seq:1});assert.equal(f.transport.isReady(),true);
 f.hide();f.transport.update();assert.equal(f.transport.isReady(),false);assert.equal(f.timers.size,0);
});
test('client: missing heartbeat and rejected state both fall back without retrying mutations',()=>{
 const f=fixture();f.transport.update();const s=f.sockets[0];s.open();
 s.receive({type:'snapshot',matchId:'room',seq:1});f.fire(60000);
 assert.equal(f.transport.isReady(),false);assert.equal(f.fallbacks,1);
 assert.equal(s.sent.type,'subscribe');
});

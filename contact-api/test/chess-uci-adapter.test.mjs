import test from 'node:test';
import assert from 'node:assert/strict';
import {createChessUciAdapter} from '../auth/chess-uci-adapter.mjs';
const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function fakeWorker({answer='e2e4',hang=false}={}){
 const sent=[];const worker={sent,terminated:false,onmessage:null,onerror:null,postMessage(m){
  sent.push(m);
  if(hang)return;
  if(m==='uci')queueMicrotask(()=>worker.onmessage?.({data:'uciok'}));
  if(m==='isready')queueMicrotask(()=>worker.onmessage?.({data:'readyok'}));
  if(m.startsWith('go '))queueMicrotask(()=>worker.onmessage?.({data:'bestmove '+answer}));
 },terminate(){this.terminated=true;}};
 return worker;
}
test('UCI worker handshakes and validates bestmove before accepting',async()=>{
 const w=fakeWorker();const a=createChessUciAdapter({workerFactory:()=>w,validateMove:(_,m)=>m==='e2e4'});
 assert.equal(await a.bestMove(fen),'e2e4');
 assert.deepEqual(w.sent.slice(0,4),['uci','isready','ucinewgame','position fen '+fen]);
 assert.equal(w.terminated,true);a.dispose();
});
test('Rejects illegal worker output',async()=>{
 const w=fakeWorker({answer:'e2e5'}),a=createChessUciAdapter({workerFactory:()=>w,validateMove:()=>false});
 await assert.rejects(a.bestMove(fen),/UCI_ILLEGAL_MOVE/);
 assert.equal(w.terminated,true);
});
test('Rejects timed-out worker and terminates it',async()=>{
 const w=fakeWorker({hang:true}),a=createChessUciAdapter({workerFactory:()=>w,validateMove:()=>true,timeoutMs:100});
 await assert.rejects(a.bestMove(fen,{thinkMs:20}),/UCI_TIMEOUT/);
 assert.equal(w.terminated,true);
});
test('Explicit cancellation rejects in-flight task and blocks stale result',async()=>{
 const w=fakeWorker({hang:true}),a=createChessUciAdapter({workerFactory:()=>w,validateMove:()=>true});
 const pending=a.bestMove(fen);a.cancel();
 await assert.rejects(pending,/UCI_CANCELLED/);
 w.onmessage?.({data:'bestmove e2e4'});assert.equal(w.terminated,true);
});
test('Cannot use disposed worker or invalid position',async()=>{
 const a=createChessUciAdapter({workerFactory:()=>fakeWorker(),validateMove:()=>true});
 await assert.rejects(a.bestMove('bad'),/INVALID_UCI_FEN/);
 a.dispose();await assert.rejects(a.bestMove(fen),/UCI_CLOSED/);
});

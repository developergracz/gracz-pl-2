// CHESS-STOCKFISH-P1: UCI adapter (fake worker, manual timers), verified vendor assets and console wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initial,move,legal,coord,parseFen,START_FEN} from '../auth/chess-rules.mjs';
import {STOCKFISH,createStockfishEngine,stockfishFen,stockfishAvailable} from '../auth/chess-stockfish.mjs';
import {serveChessConsole} from '../auth/chess-console.mjs';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function manualTimers(){
 let now=0,next=1;const queue=new Map();
 return {
  set:(fn,ms)=>{const id=next++;queue.set(id,{fn,at:now+ms});return id;},
  clear:id=>queue.delete(id),
  async advance(ms){
   const end=now+ms;
   for(;;){
    const due=[...queue].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!due)break;
    queue.delete(due[0]);now=due[1].at;due[1].fn();await flush();
   }
   now=end;await flush();
  },
 };
}
// Answers the handshake like stockfish.js; searches are answered by the test with emit().
function fakeWorkers({handshake=true}={}){
 const created=[];
 class FakeWorker{
  constructor(url,options){this.url=url;this.options=options;this.posted=[];this.terminated=false;created.push(this);}
  postMessage(command){
   this.posted.push(command);
   if(!handshake)return;
   if(command==='uci')queueMicrotask(()=>{this.emit('id name Stockfish 19');this.emit('uciok');});
   if(command==='isready')queueMicrotask(()=>this.emit('readyok'));
  }
  emit(line){this.onmessage?.({data:line});}
  terminate(){this.terminated=true;}
 }
 return {FakeWorker,created};
}
const position=move(initial(),'e2e4');
const validateFor=state=>uci=>legal(state).find(m=>coord(m[0])+coord(m[1])+m[2]===uci)||null;
const request=(extra={})=>({fen:stockfishFen(position),validate:validateFor(position),movetimeMs:400,elo:1600,...extra});
async function engineWith(options={}){
 const timers=manualTimers(),{FakeWorker,created}=fakeWorkers(options);
 const engine=createStockfishEngine({WorkerImpl:FakeWorker,url:'/sf.js',timers,...options});
 return {engine,timers,created};
}

test('legal bestmove: UCI handshake, limits, position fen and validation by the rules engine',async()=>{
 const {engine,created}=await engineWith();
 const pending=engine.bestMove(request());
 await flush();
 assert.equal(created.length,1);
 const worker=created[0];
 assert.equal(worker.url,'/sf.js');
 assert.deepEqual(worker.posted,['uci','setoption name Threads value 1','setoption name Hash value 16','setoption name MultiPV value 1','isready',
  'setoption name UCI_LimitStrength value true','setoption name UCI_Elo value 1600',
  'position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1','go movetime 400']);
 assert.equal(engine.state,'thinking');
 worker.emit('info depth 8 score cp -30 pv e7e5');worker.emit('bestmove e7e5 ponder g1f3');
 const answer=await pending;
 assert.equal(answer.source,'stockfish');assert.equal(answer.uci,'e7e5');
 assert.deepEqual(answer.move,legal(position).find(m=>coord(m[0])+coord(m[1])===`e7e5`));
 assert.equal(engine.state,'ready');
 // Full strength: no Elo cap; promotion moves are validated like any other move.
 const promotion=parseFen('4k3/8/8/8/8/8/p7/4K3 b - - 0 1');
 const second=engine.bestMove({fen:stockfishFen(promotion),validate:validateFor(promotion),elo:0,movetimeMs:99999});
 await flush();
 assert.deepEqual(worker.posted.slice(-3),['setoption name UCI_LimitStrength value false','position fen 4k3/8/8/8/8/8/p7/4K3 b - - 0 1','go movetime 3000']);
 worker.emit('bestmove a2a1q');
 assert.equal((await second).uci,'a2a1q');
 assert.equal(created.length,1,'one worker per tab');
});

test('illegal or malformed bestmove is rejected so the local engine moves instead',async()=>{
 const {engine,created}=await engineWith();
 for(const line of ['bestmove e2e4','bestmove zz99','bestmove e7e8q']){
  const pending=engine.bestMove(request());await flush();
  created[0].emit(line);
  assert.deepEqual(await pending,{fallback:true,reason:'ILLEGAL_BESTMOVE',uci:line.split(' ')[1]});
 }
 const pending=engine.bestMove(request());await flush();created[0].emit('bestmove (none)');
 assert.deepEqual(await pending,{move:null,reason:'NO_MOVE',source:'stockfish'});
});

test('timeout falls back, sends stop, and the late bestmove of that search is dropped',async()=>{
 const {engine,timers,created}=await engineWith();
 const warm=engine.bestMove(request());await flush();created[0].emit('bestmove e7e5');await warm;
 // Once loaded, the budget is the think time plus a 1.5 s margin.
 let first;engine.bestMove(request()).then(a=>{first=a;});
 await flush();
 await timers.advance(400+1500-1);
 assert.equal(first,undefined,'still waiting inside the time budget');
 await timers.advance(1);
 assert.deepEqual(first,{fallback:true,reason:'TIMEOUT'});
 assert.equal(created[0].posted.at(-1),'stop');
 // The next request waits for the stopped search to drain; the late answer cannot leak into it.
 let second;engine.bestMove(request()).then(a=>{second=a;});
 await flush();
 const goes=()=>created[0].posted.filter(c=>c.startsWith('go ')).length;
 assert.equal(goes(),2,'no new go before the stopped search ends');
 created[0].emit('bestmove d7d5');await flush();
 assert.equal(second,undefined,'late bestmove of the timed-out search is ignored');
 assert.equal(goes(),3);
 created[0].emit('bestmove c7c5');await flush();
 assert.equal(second.uci,'c7c5');
});

test('cancel and terminate stop the search; a restart after terminate keeps at most one worker',async()=>{
 const {engine,created}=await engineWith();
 const cancelled=engine.bestMove(request());await flush();
 engine.cancel();
 assert.deepEqual(await cancelled,{cancelled:true});
 assert.equal(created[0].posted.at(-1),'stop');
 created[0].emit('bestmove e7e5');await flush();
 const hidden=engine.bestMove(request());await flush();
 engine.terminate('HIDDEN');
 assert.deepEqual(await hidden,{fallback:true,reason:'HIDDEN'});
 assert.equal(created[0].terminated,true);assert.ok(created[0].posted.includes('quit'));
 assert.equal(engine.running,false);assert.equal(engine.state,'off');
 const again=engine.bestMove(request());await flush();
 assert.equal(created.length,2);assert.equal(created.filter(w=>!w.terminated).length,1);
 created[1].emit('bestmove g8f6');
 assert.equal((await again).uci,'g8f6');
});

test('a search that ignores stop is replaced by a fresh worker',async()=>{
 const {engine,timers,created}=await engineWith();
 engine.bestMove(request());await flush();
 engine.cancel();
 let next;engine.bestMove(request()).then(a=>{next=a;});await flush();
 await timers.advance(1000);
 assert.equal(created[0].terminated,true);assert.equal(created.length,2);
 await flush();
 assert.ok(created[1].posted.includes('go movetime 400'));
 created[1].emit('bestmove b8c6');await flush();
 assert.equal(next.uci,'b8c6');
});

test('unsupported, failing or slow engines fall back and never block the game',async()=>{
 const none=createStockfishEngine({WorkerImpl:null,url:'/sf.js'});
 assert.deepEqual(await none.bestMove(request()),{fallback:true,reason:'UNSUPPORTED'});
 const broken=await engineWith();
 const failing=broken.engine.bestMove(request());await flush();
 broken.created[0].onerror({preventDefault(){}});
 assert.deepEqual(await failing,{fallback:true,reason:'WORKER_ERROR'});
 assert.equal(broken.engine.failure,'WORKER_ERROR');assert.equal(broken.created[0].terminated,true);
 assert.deepEqual(await broken.engine.bestMove(request()),{fallback:true,reason:'WORKER_ERROR'});
 assert.equal(broken.created.length,1,'no new worker after a hard failure');
 // Slow first load: the move falls back after the load budget, loading continues, then the hard limit gives up.
 const slow=await engineWith({handshake:false});
 let first;slow.engine.bestMove(request()).then(a=>{first=a;});await flush();
 await slow.timers.advance(5000+400+1500);
 assert.deepEqual(first,{fallback:true,reason:'TIMEOUT'});
 assert.equal(slow.created[0].terminated,false);
 await slow.timers.advance(20000);
 assert.equal(slow.engine.failure,'LOAD_TIMEOUT');assert.equal(slow.created[0].terminated,true);
 // A failed .wasm preflight never starts a worker; a terminate during the preflight cancels the start.
 const noWasm=await engineWith({preflight:()=>Promise.reject(Error('404'))});
 assert.deepEqual(await noWasm.engine.bestMove(request()),{fallback:true,reason:'WASM_UNAVAILABLE'});
 assert.equal(noWasm.created.length,0);assert.equal(noWasm.engine.failure,'WASM_UNAVAILABLE');
 let release;const gated=await engineWith({preflight:()=>new Promise(resolve=>{release=resolve;})});
 const pending=gated.engine.bestMove(request());await flush();
 gated.engine.terminate('HIDDEN');release();await flush();
 assert.deepEqual(await pending,{fallback:true,reason:'HIDDEN'});
 assert.equal(gated.created.length,0);assert.equal(gated.engine.failure,'');
 const bad=await engineWith();
 assert.deepEqual(await bad.engine.bestMove({fen:'not a fen',validate:()=>null}),{fallback:true,reason:'BAD_REQUEST'});
 assert.equal(bad.created.length,0);
});

test('FEN for the worker comes from the shared rules state',()=>{
 assert.equal(stockfishFen(initial()),START_FEN);
 for(const fen of ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1','8/8/8/8/8/8/8/K6k b - - 12 40'])
  assert.equal(stockfishFen(parseFen(fen)),fen);
});

function load(path,method='GET'){let status=0,headers={},body='';const served=serveChessConsole({method},{writeHead(c,h){status=c;headers=h;},end(b){body=b;}},new URL('https://example.com'+path));return {served,status,headers,body};}
test('verified Stockfish files are served same-origin with worker CSP, wasm MIME and immutable cache',async()=>{
 assert.equal(stockfishAvailable(),true);
 for(const [name,[type,sha256]] of Object.entries(STOCKFISH.files)){
  const disk=await readFile(new URL('../vendor/stockfish-19.0.1/'+name,import.meta.url));
  if(sha256)assert.equal(createHash('sha256').update(disk).digest('hex'),sha256,name+' matches the verified hash');
  const asset=load(STOCKFISH.base+name);
  assert.equal(asset.status,200);assert.equal(asset.headers['Content-Type'],type);
  assert.ok(Buffer.from(asset.body).equals(disk),name+' is served unmodified');
  assert.equal(asset.headers['X-Content-Type-Options'],'nosniff');
  assert.equal(asset.headers['Cross-Origin-Resource-Policy'],'same-origin');
 }
 const script=load(STOCKFISH.base+STOCKFISH.script);
 assert.equal(script.headers['Cache-Control'],'public, max-age=31536000, immutable');
 assert.match(script.headers['Content-Security-Policy'],/script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'/);
 assert.doesNotMatch(script.headers['Content-Security-Policy'],/'unsafe-eval'|https?:/,'no eval and no external hosts');
 const source=load(STOCKFISH.base+'ZRODLA.txt').body.toString();
 for(const fact of ['GPLv3','stockfish.js/tree/v19.0.1','0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6','Stockfish/tree/sf_19','edb0d9db6731067ec50ce619ff372b463bc4dd5d',STOCKFISH.files['stockfish-19-lite-single.wasm'][1]])
  assert.ok(source.includes(fact),fact);
 assert.match(load(STOCKFISH.base+'COPYING.txt').body.toString(),/GNU GENERAL PUBLIC LICENSE\s+Version 3/);
 assert.equal(load(STOCKFISH.base+STOCKFISH.script,'POST').served,false);
 assert.equal(load(STOCKFISH.base+'../../../server.mjs').served,false);
 assert.equal(load('/konto/szachy/stockfish/19.0.1/other.js').served,false);
});

test('console wiring: one lazy worker for local computer games only, with local-engine fallback',async()=>{
 const served=load('/konto/szachy/stockfish-engine.mjs');
 assert.equal(served.status,200);
 // The served adapter is self-contained: it runs from its own source text.
 const adapter=await import('data:text/javascript,'+encodeURIComponent(served.body));
 assert.equal(adapter.stockfishFen(initial()),START_FEN);
 const {FakeWorker,created}=fakeWorkers();
 const engine=adapter.createStockfishEngine({WorkerImpl:FakeWorker,url:'/sf.js'});
 const pending=engine.bestMove(request());await flush();created[0].emit('bestmove e7e5');
 assert.equal((await pending).uci,'e7e5');
 const app=load('/konto/szachy/app.js').body;
 assert.match(app,/import \{createStockfishEngine,stockfishFen\} from '\/konto\/szachy\/stockfish-engine\.mjs';/);
 assert.match(app,/\['computer','Komputer · Stockfish 19'\],\['local','Komputer · silnik lokalny'\],\['human','Drugi gracz lokalnie'\]/);
 assert.match(app,/const stockfish=createStockfishEngine\(\{url:stockfishBase\+'stockfish-19-lite-single\.js'/);
 assert.match(app,/const wantsStockfish=\(\)=>computerEnabled&&opponentSelect\.value==='computer';/);
 const schedule=app.slice(app.indexOf(' function scheduleComputer(){'),app.indexOf(' async function refreshMatch('));
 assert.match(schedule,/if\(!computerEnabled\|\|mode!=='local'\|\|computerThinking/,'never in online or two-player games');
 assert.match(schedule,/validate:uci=>legal\(position\)\.find\(m=>coord\(m\[0\]\)\+coord\(m\[1\]\)\+m\[2\]===uci\)\|\|null/);
 assert.match(schedule,/if\(answer\.fallback\)localMove\(\);else play\(answer\.move\);/);
 assert.match(schedule,/chooseComputerMove\(position/,'existing local engine stays the fallback');
 assert.match(app,/stockfish\.terminate\('ONLINE'\);mode='online'/);
 assert.match(app,/if\(document\.hidden\)stockfish\.terminate\('HIDDEN'\)/);
 assert.match(app,/window\.addEventListener\('pagehide',\(\)=>stockfish\.terminate\('PAGEHIDE'\)\)/);
 assert.match(app,/if\(wantsStockfish\(\)\)stockfish\.cancel\(\);else stockfish\.terminate\('OFF'\);/);
 // Integration with PGN/FEN (#793): an import is a new local game and also stops a running search.
 assert.ok(app.includes('computerGeneration++;computerThinking=false;stockfish.cancel();hideChessLoss();\n  states.splice(0,states.length,...game.states);'),'import cancels Stockfish');
 for(const hook of ["hideChessLoss();computerGeneration++;computerThinking=false;stockfish.cancel();","computerThinking=false;stockfish.cancel();localDrawReason=reason;","computerGeneration++;computerThinking=false;stockfish.cancel();\n   localTimeout="])
  assert.ok(app.includes(hook),hook);
 assert.doesNotMatch(app,/https?:\/\/[^'"]*stockfish/i,'no CDN or external engine URL');
});

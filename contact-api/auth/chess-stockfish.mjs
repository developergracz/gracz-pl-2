// CHESS-STOCKFISH-P1: Stockfish 19 (stockfish.js 19.0.1, lite single-threaded WASM, GPLv3) for the chess console.
// The engine runs only in the player's browser as ONE same-origin Web Worker. No CDN, SaaS, tokens or server-side engine.
// The server only serves verified, unmodified vendor files; a hash mismatch disables Stockfish (local engine fallback).
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const STOCKFISH=Object.freeze({
 name:'Stockfish 19',package:'stockfish.js 19.0.1',flavor:'lite, single-threaded',license:'GPL-3.0',
 base:'/konto/szachy/stockfish/19.0.1/',script:'stockfish-19-lite-single.js',
 files:Object.freeze({
  'stockfish-19-lite-single.js':['text/javascript; charset=utf-8','ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a'],
  'stockfish-19-lite-single.wasm':['application/wasm','ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de'],
  'COPYING.txt':['text/plain; charset=utf-8','0b383d5a63da644f628d99c33976ea6487ed89aaa59f0b3257992deac1171e6b'],
  'ZRODLA.txt':['text/plain; charset=utf-8',null],
 }),
});
const vendor=new URL('../vendor/stockfish-19.0.1/',import.meta.url);
async function loadVendorFile(name,expected){
 try{
  const body=await readFile(new URL(name,vendor));
  return !expected||createHash('sha256').update(body).digest('hex')===expected?body:null;
 }catch{return null;}
}
const assets=new Map();
for(const [name,[type,sha256]] of Object.entries(STOCKFISH.files)){
 const body=await loadVendorFile(name,sha256);
 if(body)assets.set(STOCKFISH.base+name,{type,body});
}
// The worker script gets its own CSP: WebAssembly compilation and a same-origin fetch of the .wasm only.
const workerCsp="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; base-uri 'none'; form-action 'none'";
export function serveStockfishAsset(req,res,url){
 if(req.method!=='GET'||!url.pathname.startsWith(STOCKFISH.base))return false;
 const asset=assets.get(url.pathname);
 if(!asset)return false;
 const engine=!asset.type.startsWith('text/plain');
 res.writeHead(200,{'Content-Type':asset.type,'Content-Length':asset.body.length,
  // Versioned URL: one download per browser, no repeated transfer per game.
  'Cache-Control':engine?'public, max-age=31536000, immutable':'public, max-age=86400',
  'Content-Security-Policy':engine?workerCsp:"default-src 'none'",
  'Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 res.end(asset.body);
 return true;
}
export const stockfishAvailable=()=>Object.entries(STOCKFISH.files).every(([name])=>assets.has(STOCKFISH.base+name));

// ---- Browser code below. Both functions are served as source with toString(), so they must not use outer names. ----

// FEN of the shared rules state ({b:0x88 board,t,c,ep,half,full}) for "position fen".
export function stockfishFen(s){
 const rows=[];
 for(let r=0;r<8;r++){
  let row='',empty=0;
  for(let f=0;f<8;f++){const p=s.b[r*16+f];if(p==='.'){empty++;continue;}if(empty)row+=empty;empty=0;row+=p;}
  rows.push(row+(empty||''));
 }
 const castling=(s.c&1?'K':'')+(s.c&2?'Q':'')+(s.c&4?'k':'')+(s.c&8?'q':'')||'-';
 const ep=s.ep>=0?'abcdefgh'[s.ep&7]+(8-(s.ep>>4)):'-';
 return rows.join('/')+' '+(s.t===1?'w':'b')+' '+castling+' '+ep+' '+s.half+' '+s.full;
}

// UCI adapter: uci/isready/setoption/position fen/go movetime/bestmove/stop/quit over postMessage.
// At most one worker and one search. Every request has its own id; a bestmove that belongs to a cancelled,
// timed-out or superseded request is dropped. Every bestmove is checked by the caller's legality function.
// loadBudgetMs: how long one move may wait for the first load (then that move falls back, loading continues);
// loadTimeoutMs: hard limit after which Stockfish is treated as unavailable for this page view.
// preflight: optional check before the worker starts (the console fetches the .wasm: a failed download would
// otherwise leave the stockfish.js loader waiting forever without an error event).
export function createStockfishEngine({WorkerImpl,url,preflight=null,loadBudgetMs=5000,loadTimeoutMs=20000,stopTimeoutMs=1000,marginMs=1500,hashMb=16,
 timers={set:(fn,ms)=>setTimeout(fn,ms),clear:id=>clearTimeout(id)},onStatus=()=>{}}={}){
 const UCI_MOVE=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
 const FEN=/^[1-8pnbrqkPNBRQK]+(?:\/[1-8pnbrqkPNBRQK]+){7} [wb] (?:-|K?Q?k?q?) (?:-|[a-h][36]) \d+ [1-9]\d*$/;
 let worker=null,booting=null,ready=false,failure='',seq=0,request=null,searching=0,bootTimer=0,bootReject=null,bootRun=0,state='off';
 const drainWaiters=[];
 const status=(next,detail='')=>{state=next;try{onStatus({state:next,detail});}catch{}};
 const send=command=>{try{worker?.postMessage(command);}catch{}};
 const lines=data=>String(data??'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 function kill(){
  timers.clear(bootTimer);bootRun++;
  if(worker){send('quit');try{worker.terminate();}catch{}}
  worker=null;booting=null;ready=false;searching=0;
  for(const wake of drainWaiters.splice(0))wake();
 }
 function fail(reason){
  // Loading or runtime failure: Stockfish stays off for this page view and the local engine takes over.
  failure=reason;const reject=bootReject;bootReject=null;kill();
  reject?.(Error(reason));
  if(request&&!request.done)request.finish({fallback:true,reason});
  status('failed',reason);
 }
 function onLine(line){
  if(!line.startsWith('bestmove'))return;
  const id=searching;searching=0;
  for(const wake of drainWaiters.splice(0))wake();
  const current=request;
  if(!current||current.done||current.id!==id)return;
  const uci=line.split(/\s+/)[1]||'';
  if(uci==='(none)'||uci==='0000'){current.finish({move:null,reason:'NO_MOVE',source:'stockfish'});return;}
  const move=UCI_MOVE.test(uci)?current.validate(uci):null;
  current.finish(move?{move,uci,source:'stockfish'}:{fallback:true,reason:'ILLEGAL_BESTMOVE',uci});
 }
 function boot(){
  if(failure)return Promise.reject(Error(failure));
  if(booting)return booting;
  if(typeof WorkerImpl!=='function'){failure='UNSUPPORTED';status('failed',failure);return Promise.reject(Error(failure));}
  status('loading');
  const run=++bootRun;
  bootTimer=timers.set(()=>fail('LOAD_TIMEOUT'),loadTimeoutMs);
  booting=Promise.resolve().then(()=>preflight?.()).then(()=>spawn(run),()=>{
   if(run===bootRun)fail('WASM_UNAVAILABLE');
   throw Error(failure||'OFF');
  });
  booting.catch(()=>{});
  return booting;
 }
 function spawn(run){
  if(run!==bootRun)return Promise.reject(Error(failure||'OFF')); // terminated while the preflight ran
  return new Promise((resolve,reject)=>{
   bootReject=reject;let phase='uci';
   try{worker=new WorkerImpl(url,{name:'gracz-stockfish'});}catch{fail('WORKER_BLOCKED');return;}
   worker.onerror=event=>{event?.preventDefault?.();fail('WORKER_ERROR');};
   worker.onmessageerror=()=>fail('WORKER_ERROR');
   worker.onmessage=event=>{
    for(const line of lines(event?.data)){
     if(phase==='uci'&&line==='uciok'){
      phase='ready';
      send('setoption name Threads value 1');send('setoption name Hash value '+hashMb);send('setoption name MultiPV value 1');
      send('isready');
     }else if(phase==='ready'&&line==='readyok'){
      phase='on';timers.clear(bootTimer);bootReject=null;ready=true;status('ready');resolve();
     }else if(phase==='on')onLine(line);
    }
   };
   send('uci');
  });
 }
 // A previous search must deliver its bestmove before the next one starts; otherwise restart the worker.
 function drain(){
  if(!searching)return Promise.resolve();
  send('stop');
  return new Promise(resolve=>{
   const wake=()=>{timers.clear(timer);resolve(false);};
   const timer=timers.set(()=>{const at=drainWaiters.indexOf(wake);if(at>=0)drainWaiters.splice(at,1);kill();resolve(true);},stopTimeoutMs);
   drainWaiters.push(wake);
  }).then(restart=>restart?boot():undefined);
 }
 function cancel(){
  const current=request;
  if(current&&!current.done)current.finish({cancelled:true});
  if(searching)send('stop');
 }
 function terminate(reason='OFF'){
  const current=request;
  if(current&&!current.done)current.finish({fallback:true,reason});
  kill();
  if(!failure)status('off',reason);
 }
 function bestMove({fen,validate,movetimeMs=500,elo=0}={}){
  cancel();
  if(failure)return Promise.resolve({fallback:true,reason:failure});
  if(typeof fen!=='string'||!FEN.test(fen)||typeof validate!=='function')return Promise.resolve({fallback:true,reason:'BAD_REQUEST'});
  const movetime=Math.max(50,Math.min(3000,Math.round(Number(movetimeMs)||500)));
  const strength=Number(elo)>0?Math.max(1320,Math.min(3190,Math.round(Number(elo)))):0;
  const id=++seq;
  return new Promise(resolve=>{
   const current={id,validate,done:false,timer:0};
   current.finish=result=>{
    if(current.done)return;
    current.done=true;timers.clear(current.timer);
    if(request===current)request=null;
    if(!failure&&state==='thinking')status(worker?'ready':'off');
    resolve(result);
   };
   request=current;
   // Waiting for the first load is capped by loadBudgetMs; the search itself by think time + margin from "go".
   const timeout=()=>{current.finish({fallback:true,reason:'TIMEOUT'});if(searching===id)send('stop');};
   current.timer=timers.set(timeout,(ready?0:loadBudgetMs)+movetime+marginMs);
   boot().then(drain).then(()=>{
    if(current.done||request!==current)return;
    send('setoption name UCI_LimitStrength value '+(strength>0));
    if(strength)send('setoption name UCI_Elo value '+strength);
    send('position fen '+fen);
    searching=id;status('thinking');
    timers.clear(current.timer);current.timer=timers.set(timeout,movetime+marginMs);
    send('go movetime '+movetime);
   },error=>current.finish({fallback:true,reason:failure||error?.message||'LOAD_FAILED'}));
  });
 }
 return {bestMove,cancel,terminate,
  get state(){return state;},get failure(){return failure;},get running(){return !!worker;}};
}

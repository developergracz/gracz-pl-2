// Stockfish UCI transport only. Does not load or bundle a Stockfish binary.
// One worker per adapter; failure closes the worker. Never use for active online games.
const UCI_MOVE=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const UCI_BEST=/^bestmove\s+([^\s]+)/;
const UCI_FEN=/^[prnbqkPRNBQK1-8/]+ [wb] (?:-|K?Q?k?q?) (?:-|[a-h][36]) \d+ [1-9]\d*$/;
export function createChessUciAdapter({workerFactory,validateMove,timeoutMs=1500}={}){
 if(typeof workerFactory!=='function'||typeof validateMove!=='function')throw Error('INVALID_UCI_ADAPTER');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000)throw Error('INVALID_UCI_TIMEOUT');
 let worker=null,task=null,generation=0,closed=false;
 function closeWorker(){
  if(worker){try{worker.postMessage('stop');worker.postMessage('quit');}catch{}try{worker.terminate();}catch{}worker=null;}
 }
 function cancel(reason='UCI_CANCELLED'){
  generation++;
  if(task){clearTimeout(task.timer);const reject=task.reject;task=null;reject(Error(reason));}
  closeWorker();
 }
 async function bestMove(fen,{thinkMs=350}={}){
  if(closed)throw Error('UCI_CLOSED');
  if(!UCI_FEN.test(fen)||fen.length>120)throw Error('INVALID_UCI_FEN');
  if(!Number.isSafeInteger(thinkMs)||thinkMs<20||thinkMs>3000)throw Error('INVALID_UCI_THINK_TIME');
  cancel();
  const id=++generation;
  let w;
  try{w=workerFactory();if(!w||typeof w.postMessage!=='function'||typeof w.terminate!=='function')throw Error('INVALID_UCI_WORKER');}
  catch(e){throw Error('UCI_WORKER_UNAVAILABLE',{cause:e});}
  worker=w;
  return new Promise((resolve,reject)=>{
   const fail=(msg)=>{if(generation!==id)return;cancel(msg);};
   const timer=setTimeout(()=>fail('UCI_TIMEOUT'),timeoutMs+thinkMs);
   task={reject,timer};
   let stage='uci';
   w.onerror=()=>fail('UCI_WORKER_ERROR');
   w.onmessage=(event)=>{
    if(generation!==id||worker!==w||!task)return;
    const line=String(event?.data??'').trim();
    if(stage==='uci'&&line==='uciok'){stage='ready';w.postMessage('isready');return;}
    if(stage==='ready'&&line==='readyok'){
     stage='thinking';w.postMessage('ucinewgame');w.postMessage('position fen '+fen);w.postMessage('go movetime '+thinkMs);return;
    }
    if(stage!=='thinking')return;
    const match=UCI_BEST.exec(line);
    if(!match)return;
    const uci=match[1];
    if(!UCI_MOVE.test(uci)||!validateMove(fen,uci)){fail('UCI_ILLEGAL_MOVE');return;}
    clearTimeout(timer);task=null;
    // Terminating avoids dangling CPU usage and late responses.
    closeWorker();generation++;resolve(uci);
   };
   try{w.postMessage('uci');}catch{fail('UCI_WORKER_ERROR');}
  });
 }
 function dispose(){if(closed)return;closed=true;cancel('UCI_CLOSED');}
 return Object.freeze({bestMove,cancel,dispose});
}

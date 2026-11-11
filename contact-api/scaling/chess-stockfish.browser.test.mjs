// CHESS-STOCKFISH-P1 acceptance in real Chromium: the vendored Stockfish 19 lite worker, its limits and the local fallback.
// Local fixture only: the real chess console modules, no accounts, database or external services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

const ENGINE='/konto/szachy/stockfish/19.0.1/stockfish-19-lite-single.js';
const index=s=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
const squares=page=>page.locator('#board .chess-square');
const position=page=>squares(page).evaluateAll(cells=>cells.map(c=>c.querySelector('svg')?.dataset.piece||'.'));
const moves=async page=>Number((await page.locator('#move-count').textContent()).replace(/\D+/g,''));
const waitMoves=(page,n,timeout=15000)=>page.waitForFunction(n=>document.querySelector('#move-count').textContent==='Ruchy: '+n,n,{timeout});
const click=async(page,from,to)=>{await squares(page).nth(index(from)).click();await squares(page).nth(index(to)).click();};
const hint=page=>page.locator('#ai-hint').textContent();
// Stand-in worker for timing cases: answers the UCI handshake, then replies to "go" only after `delay` ms.
const stub=delay=>"onmessage=e=>{const c=String(e.data);if(c==='uci')postMessage('uciok');else if(c==='isready')postMessage('readyok');"+
 "else if(c.startsWith('go '))setTimeout(()=>postMessage('bestmove a7a6'),"+delay+");};";

function fixture(t){
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveChessConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,items:[],friends:[],challenges:[]}));
 });
 server.listen(0,'127.0.0.1');
 t.after(()=>{server.close();server.closeAllConnections();});
 return once(server,'listening').then(()=>'http://127.0.0.1:'+server.address().port);
}
async function open(browser,base,{route}={}){
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 if(route)await context.route(route.url,route.handler);
 const page=await context.newPage(),errors=[],workers=[],hosts=new Set();
 page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>hosts.add(new URL(r.url()).host));
 page.on('worker',worker=>{const entry={url:worker.url(),closed:false};workers.push(entry);worker.on('close',()=>{entry.closed=true;});});
 await page.goto(base+'/konto/szachy/');
 await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
 return {context,page,errors,workers,hosts};
}
const live=workers=>workers.filter(w=>!w.closed).length;

test('Stockfish 19 answers in one same-origin worker; click, drag and clocks keep working',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const {page,errors,workers,hosts}=await open(browser,base);
 assert.deepEqual(await page.locator('#chess-opponent option').allTextContents(),['Komputer · Stockfish 19','Komputer · silnik lokalny','Drugi gracz lokalnie']);
 assert.equal(workers.length,0,'the worker is created lazily, not on page load');
 assert.deepEqual(await page.locator('#ai-level option').allTextContents(),['Początkujący','Normalny','Zaawansowany','Maksymalny']);
 assert.match(await hint(page),/Stockfish 19 \(stockfish\.js 19\.0\.1, wersja lite\)/);
 assert.equal(await page.locator('#ai-hint a[href$="/COPYING.txt"]').count(),1);
 assert.equal(await page.locator('#ai-hint a[href$="/ZRODLA.txt"]').count(),1);

 await click(page,'e2','e4');
 await waitMoves(page,2);
 assert.doesNotMatch(await hint(page),/silnik lokalny:/,'the reply came from Stockfish, not the fallback');
 assert.equal((await position(page))[index('e4')],'P');
 await page.waitForFunction(()=>document.getElementById('clock-2').classList.contains('clock-running'),null,{timeout:3000});

 // Drag & drop still uses the same move path; the second reply reuses the same worker.
 const from=await squares(page).nth(index('d2')).boundingBox(),to=await squares(page).nth(index('d4')).boundingBox();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
 await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await page.mouse.up();
 await waitMoves(page,4);
 assert.equal(workers.length,1,'one worker for the whole game');
 assert.equal(workers[0].url,base+ENGINE);
 assert.deepEqual([...hosts],[new URL(base).host],'no CDN, SaaS or other host');

 // Leaving for online play ends the worker.
 await page.locator('#online-mode').click();
 await page.waitForFunction(()=>true);await page.waitForTimeout(200);
 assert.equal(live(workers),0);
 assert.deepEqual(errors,[]);
});

test('no engine worker in two-player or online games',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const {page,errors,workers}=await open(browser,base);
 await page.locator('#chess-opponent').selectOption('human');
 assert.match(await hint(page),/To nie jest Stockfish/);
 await click(page,'e2','e4');await click(page,'e7','e5');await click(page,'g1','f3');
 assert.equal(await moves(page),3);
 await page.locator('#online-mode').click();
 await page.waitForTimeout(500);
 await page.locator('#training-mode').click();
 await page.locator('#chess-opponent').selectOption('local');
 assert.match(await hint(page),/Silnik lokalny GRACZ\.PL/);
 assert.deepEqual(await page.locator('#ai-level option').allTextContents(),['Początkujący','Normalny','Zaawansowany','Najmocniejszy lokalny']);
 await waitMoves(page,4);
 assert.equal(workers.length,0,'two-player, online and the local engine never start Stockfish');
 assert.deepEqual(errors,[]);
});

test('missing WebAssembly or a broken engine script falls back to the local engine at once',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const {page,workers}=await open(browser,base,{route:{url:'**/stockfish-19-lite-single.wasm',handler:route=>route.abort()}});
 const started=Date.now();
 await click(page,'e2','e4');
 await waitMoves(page,2,5000);
 assert.ok(Date.now()-started<3000,'no waiting for a timeout');
 assert.match(await hint(page),/Stockfish jest niedostępny \(nie udało się pobrać pliku WebAssembly\)\. Ruchy komputera wykonuje silnik lokalny/);
 assert.deepEqual(await page.locator('#ai-level option').allTextContents(),['Początkujący','Normalny','Zaawansowany','Najmocniejszy lokalny']);
 await click(page,'g1','f3');
 await waitMoves(page,4);
 assert.equal(workers.length,0,'no worker without WebAssembly and no retry loop');
 const broken=await open(browser,base,{route:{url:'**'+ENGINE,handler:route=>route.fulfill({status:200,contentType:'text/javascript',body:'throw new Error("broken engine build")'})}});
 await click(broken.page,'e2','e4');
 await waitMoves(broken.page,2,5000);
 assert.match(await hint(broken.page),/nie udało się uruchomić silnika/);
 assert.equal(live(broken.workers),0,'the failed worker is closed');
});

test('timeout, late bestmove, hidden tab and new game never corrupt the game',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const slow=route=>route.fulfill({status:200,contentType:'text/javascript',body:stub(3000)});
 // 1. Timeout (400 ms think + 1.5 s margin): local engine moves, the UI and the computer clock keep running.
 const {page,workers}=await open(browser,base,{route:{url:'**'+ENGINE,handler:slow}});
 await click(page,'e2','e4');
 await page.waitForFunction(()=>document.getElementById('game-state').textContent==='Stockfish analizuje pozycję…');
 assert.equal(await page.locator('#clock-1').evaluate(e=>e.classList.contains('clock-running')),true,'black clock runs while the engine thinks');
 await page.locator('#history-tab').click();
 assert.equal(await page.locator('#moves-panel').isVisible(),true,'UI responds during the search');
 await waitMoves(page,2);
 assert.match(await hint(page),/Ostatni ruch komputera wykonał silnik lokalny: silnik nie odpowiedział w limicie czasu\./);
 const afterFallback=await position(page);
 // 2. The stub answers "a7a6" at 3 s; that late answer must be dropped.
 await page.waitForTimeout(1800);
 assert.equal(await moves(page),2);assert.deepEqual(await position(page),afterFallback);
 // 3. New game while the engine thinks: the search is cancelled and its answer ignored.
 await click(page,'g1','f3');
 await page.waitForFunction(()=>document.getElementById('game-state').textContent==='Stockfish analizuje pozycję…');
 await page.locator('#restart').click();
 assert.equal(await moves(page),0);
 await page.waitForTimeout(3500);
 assert.equal(await moves(page),0,'a cancelled search never moves');
 assert.ok(live(workers)<=1);

 // 4. Hidden tab: the worker is closed at once and the pending move comes from the local engine.
 const hidden=await open(browser,base,{route:{url:'**'+ENGINE,handler:route=>route.fulfill({status:200,contentType:'text/javascript',body:stub(60000)})}});
 await click(hidden.page,'e2','e4');
 await hidden.page.waitForFunction(()=>document.getElementById('game-state').textContent==='Stockfish analizuje pozycję…');
 await hidden.page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await waitMoves(hidden.page,2,5000);
 await hidden.page.waitForFunction(()=>true);await hidden.page.waitForTimeout(200);
 assert.equal(live(hidden.workers),0,'no engine work in a hidden tab');
 assert.match(await hint(hidden.page),/karta była ukryta/);
});

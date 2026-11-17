// CHESS-006 P1 — run the real Chess console with its WebSocket unavailable.
// Simulate fifteen minutes of browser fallback timer ticks without waiting 15 real
// minutes. The authenticated production router retains the *actual* 15-minute
// per-account GET rate limit, so the pre-fix 4s interval demonstrably fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {fixture,challenge,tokenA,tokenB} from '../test-support/game-matches-fixture.mjs';

const square=name=>(8-Number(name[1]))*16+'abcdefgh'.indexOf(name[0]);

test('CHESS-006: 15-minute fallback-only polling stays within real GET limits and keeps chess/chat fresh',
 {timeout:90000},async t=>{
 const f=fixture({game:'szachy'});
 const counts={match:0,chat:0,limited:0};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveChessConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  if(url.pathname==='/auth/match'||url.pathname==='/auth/match/chat'){
   const name=url.pathname==='/auth/match'?'match':'chat';
   counts[name]++;
   try{
    const response=await f.call(tokenA,req.method,url.pathname+url.search);
    if(response.status===429)counts.limited++;
    res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(response.body));
   }catch(err){
    res.writeHead(500);res.end(JSON.stringify({ok:false,error:String(err)}));
   }
   return;
  }
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({ok:true,challenges:[],friends:[],items:[],unreadCount:0,messages:[]}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:1600,height:900}});
 t.after(()=>context.close());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Only the periodic poll timer is captured and driven virtually. Other browser
 // behavior and the backend limiter are the genuine production implementations.
 await page.addInitScript(()=>{
  const nativeInterval=window.setInterval.bind(window),nativeFetch=window.fetch.bind(window);
  window.__chessFallbackTimers=[];
  window.__chessFallbackStats={pending:0,rateLimited:0};
  window.WebSocket=undefined; // Simulates a proxy/enterprise network with WS unavailable.
  window.setInterval=function(fn,ms,...rest){
   if((ms===4000||ms===8000)&&/refreshMatch/.test(String(fn))&&/refreshChat/.test(String(fn))){
    window.__chessFallbackTimers.push({fn,ms});return 190006;
   }
   return nativeInterval(fn,ms,...rest);
  };
  window.fetch=function(resource,options){
   const pathname=new URL(String(resource),location.href).pathname;
   if(!['/auth/match','/auth/match/chat'].includes(pathname))return nativeFetch(resource,options);
   window.__chessFallbackStats.pending++;
   return nativeFetch(resource,options).then(response=>{
    if(response.status===429)window.__chessFallbackStats.rateLimited++;
    return response;
   }).finally(()=>{window.__chessFallbackStats.pending--;});
  };
 });
 await page.goto(base+'/konto/szachy/?match='+challenge,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__chessFallbackTimers?.length===1
  &&document.querySelectorAll('#board .chess-square').length===64
  &&document.querySelector('#board')?.dataset.consoleGame==='new',{timeout:12000});
 await page.waitForFunction(()=>window.__chessFallbackStats.pending===0);
 const origin=await page.evaluate(()=>{
  const timers=window.__chessFallbackTimers;
  return {interval:timers[0].ms,initialMatch:document.querySelector('#board').dataset.consoleGame};
 });
 assert.equal(origin.interval,8000,'fixed 4-second poll would cause >180 chat GETs per 15min');
 assert.equal(origin.initialMatch,'new');
 // Stage an authenticated legal move and chat through the real server; then
 // the fallback must synchronize both without any WebSocket messages.
 const first=await f.call(tokenA,'POST','/auth/match',{id:challenge,version:0,move:{uci:'e2e4'}});
 assert.equal(first.status,200,JSON.stringify(first));
 const second=await f.call(tokenB,'POST','/auth/match',{id:challenge,version:1,move:{uci:'e7e5'}});
 assert.equal(second.status,200,JSON.stringify(second));
 const message=await f.call(tokenB,'POST','/auth/match/chat',{id:challenge,message:'Wiadomość przez awaryjny odczyt'});
 assert.equal(message.status,200,JSON.stringify(message));
 // Advance a logical clock in 4000ms increments. Both new and old interval
 // implementations are driven faithfully: at 4s the old one issues 225 GETs
 // (chat reaches 429), at 8s the new one issues 112 GETs each. Do not
 // override backend Date.now, so its genuine 15m limit remains active.
 const simulation=await page.evaluate(async()=>{
  const timer=window.__chessFallbackTimers[0],stats=window.__chessFallbackStats;
  const pauses=()=>new Promise(done=>setTimeout(done,0));
  let callbacks=0;
  for(let elapsed=4000;elapsed<=900000;elapsed+=4000){
   if(elapsed%timer.ms===0){timer.fn();callbacks++;}
   for(let n=0;stats.pending>0&&n<250;n++)await pauses();
   if(stats.pending!==0)throw Error('FALLBACK_HTTP_DID_NOT_SETTLE');
  }
  return {callbacks,limited:stats.rateLimited,
   board:document.querySelector('#board')?.dataset.consoleGame,
   whitePawn:document.querySelector('#board [data-square="'+((8-4)*16+4)+'"] svg')?.dataset.piece,
   blackPawn:document.querySelector('#board [data-square="'+((8-5)*16+4)+'"] svg')?.dataset.piece,
   chat:document.querySelector('#chat-messages')?.textContent||''};
 });
 assert.ok(simulation.callbacks>=110&&simulation.callbacks<=113,'15min at 8s is 112-113 polls');
 assert.ok(counts.chat<=150,'chat budget: 180 GETs / 15min; actual '+counts.chat);
 assert.ok(counts.match<=175,'match budget: 240 GETs / 15min; actual '+counts.match);
 assert.equal(counts.limited,0,'no server-side 429 from genuine limiter');
 assert.equal(simulation.limited,0,'no browser-side 429');
 assert.equal(simulation.whitePawn,'P','fallback brought the latest white move to the board');
 assert.equal(simulation.blackPawn,'p','fallback brought the latest black move to the board');
 assert.match(simulation.chat,/Wiadomość przez awaryjny odczyt/,'chat remains current without WS');
 // Explicit refresh and reconnection-related UI events must still work.
 const before={...counts};
 await page.evaluate(()=>document.querySelector('#refresh-match')?.click());
 await page.waitForFunction(()=>window.__chessFallbackStats.pending===0);
 assert.ok(counts.match>before.match&&counts.chat>before.chat,'manual refresh still fetches both');
 assert.equal(counts.limited,0);
 assert.equal(await page.locator('#board .chess-square').count(),64);
 assert.deepEqual(errors,[],'no client runtime errors');
});

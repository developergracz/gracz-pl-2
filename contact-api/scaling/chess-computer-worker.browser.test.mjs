// CHESS-007: acceptance with genuine Chromium module Worker, not a mocked scheduler.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

test('CHESS-007: strongest local engine replies legally without blocking Chromium UI',{timeout:60000},async t=>{
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveChessConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,items:[]}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const workerUrls=[];
 page.on('worker',worker=>workerUrls.push(worker.url()));
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/konto/szachy/');
 await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
 await page.locator('#ai-level').evaluate(select=>{
  select.value='master';select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 // Heartbeat runs on main thread: synchronous 750ms calculation would delay it.
 await page.evaluate(()=>{
  window.__chessHeartbeat={last:performance.now(),maxGap:0,ticks:0};
  window.__chessHeartbeatTimer=setInterval(()=>{
   const t=performance.now(),h=window.__chessHeartbeat;
   h.maxGap=Math.max(h.maxGap,t-h.last);h.last=t;h.ticks++;
  },20);
 });
 await page.locator('#board .chess-square[data-square="100"]').click(); // e2
 await page.locator('#board .chess-square[data-square="68"]').click(); // e4
 await page.waitForFunction(()=>document.querySelector('#move-count')?.textContent==='Ruchy: 2',null,{timeout:12000});
 const heartbeat=await page.evaluate(()=>{
  clearInterval(window.__chessHeartbeatTimer);return window.__chessHeartbeat;
 });
 assert.ok(workerUrls.some(url=>url.endsWith('/konto/szachy/computer-worker.mjs')),
  'real same-origin worker must start');
 assert.ok(heartbeat.ticks>=3,'main-thread heartbeat ran during computation');
 assert.ok(heartbeat.maxGap<450,'main thread must not be blocked by 750ms engine calculation: '+heartbeat.maxGap);
 assert.deepEqual(errors,[],'no browser runtime errors');
 // Explicit restart prevents a stale worker result from moving a piece in the new match.
 await page.locator('#board .chess-square[data-square="99"]').click(); // d2
 await page.locator('#board .chess-square[data-square="67"]').click(); // d4
 await page.locator('#restart').evaluate(el=>el.click());
 await page.waitForTimeout(1100);
 assert.equal(await page.locator('#move-count').textContent(),'Ruchy: 0','restart cancels a pending engine reply');
 assert.deepEqual(errors,[]);
});

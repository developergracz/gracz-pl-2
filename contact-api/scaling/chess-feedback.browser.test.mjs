// CHESS-002 P1 — actual chess controller rendered in Chromium; no production credentials or services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {initialChessMatch} from '../auth/chess-match.mjs';

const MATCH='33333333-3333-4333-8333-333333333333';
async function start(t,model={}){
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveChessConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname==='/auth/match'){
   if(req.method==='POST')return send(429,{ok:false,error:'ZBYT_WIELE_PROB'});
   return send(200,{ok:true,match:{
    id:MATCH,version:4,game:'szachy',player:model.player||1,players:['BiałeTest','CzarneTest'],
    playable:true,state:{...initialChessMatch(),winner:model.winner||0}
   }});
  }
  if(url.pathname==='/auth/social/challenges')return send(200,{ok:true,challenges:[]});
  if(url.pathname==='/auth/message-center')return send(200,{ok:true,conversations:[]});
  if(/\.(?:js|css|mjs)$/.test(url.pathname)){
   res.writeHead(200,{'Content-Type':/\.css$/.test(url.pathname)?'text/css':'application/javascript'});
   res.end('');return;
  }
  return send(200,{ok:true,challenges:[],friends:[],items:[]});
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 return 'http://127.0.0.1:'+server.address().port;
}
const idx=s=>(8-Number(s[1]))*16+'abcdefgh'.indexOf(s[0]);
async function move(page,from,to){
 await page.locator('#board [data-square="'+idx(from)+'"]').click();
 await page.locator('#board [data-square="'+idx(to)+'"]').click();
}
async function launch(t){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());return browser;
}
const geometry=page=>page.evaluate(()=>{
 const q=s=>{const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,width:r.width,height:r.height};};
 return {board:q('#board'),dock:q('.side-dock')};
});

test('CHESS-002: real local moves show turn and check, then result; board and dock geometry unchanged',{timeout:100000},async t=>{
 const base=await start(t),browser=await launch(t);
 for(const viewport of [{width:1600,height:900},{width:390,height:844}]){
  const ctx=await browser.newContext({viewport,hasTouch:viewport.width<600,isMobile:viewport.width<600});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/konto/szachy/');await page.locator('#board .chess-square').first().waitFor();
  assert.equal(await page.locator('#board .chess-square').count(),64);
  assert.equal(await page.locator('#chess-feedback-pill').isVisible(),false,'default console is visually unchanged');
  await page.evaluate(()=>{
   const opponent=document.querySelector('#chess-opponent');opponent.value='human';
   opponent.dispatchEvent(new Event('change',{bubbles:true}));
   const time=document.querySelector('#training-time');time.value='0';
   time.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.querySelector('#chess-feedback-pill')?.hidden===false);
  assert.match(await page.locator('#chess-feedback-pill').innerText(),/na ruchu/i);
  const before=await geometry(page);
  await move(page,'e2','e4');await move(page,'f7','f6');await move(page,'d1','h5');
  await page.waitForFunction(()=>document.querySelector('#chess-feedback-pill')?.textContent.includes('SZACH'));
  assert.match(await page.locator('#chess-feedback-pill').innerText(),/SZACH/);
  const after=await geometry(page);
  for(const kind of ['board','dock']){
   assert.ok(Math.abs(before[kind].left-after[kind].left)<2,kind+' moves horizontally');
   assert.ok(Math.abs(before[kind].width-after[kind].width)<2,kind+' width changes');
  }
  assert.equal(await page.locator('#board .chess-square').count(),64);
  await page.evaluate(()=>document.querySelector('#restart').click());
  await move(page,'f2','f3');await move(page,'e7','e5');
  await move(page,'g2','g4');await move(page,'d8','h4');
  await page.locator('#chess-feedback-overlay').waitFor({state:'visible'});
  assert.equal(await page.locator('#chess-feedback-title').innerText(),'Partia zakończona');
  assert.match(await page.locator('#chess-feedback-description').innerText(),/Mat.*czarne wygrywają/i);
  assert.equal(await page.locator('#game-result-modal').isVisible(),false,'existing loss dialog is untouched');
  await page.locator('#chess-feedback-review').click();
  assert.equal(await page.locator('#chess-feedback-overlay').isVisible(),false);
  assert.equal(await page.locator('#board .chess-square').count(),64);
  assert.deepEqual(errors,[],'no browser errors');
  await ctx.close();
 }
});

test('CHESS-002: server-confirmed winner/draw open new result; loss keeps original modal; 429 stays visible',{timeout:85000},async t=>{
 const model={winner:1,player:1},base=await start(t,model),browser=await launch(t);
 const ctx=await browser.newContext({viewport:{width:1366,height:768}});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [winner,title] of [[1,'Zwycięstwo!'],[3,'Remis'],[2,'']]){
  model.winner=winner;
  await page.goto(base+'/konto/szachy/?match='+MATCH);
  await page.waitForFunction(()=>document.querySelector('#board')?.dataset.chessFeedbackOutcome!==undefined&&document.querySelector('#board')?.dataset.consoleGame==='finished');
  if(title){
   await page.locator('#chess-feedback-overlay').waitFor({state:'visible'});
   assert.equal(await page.locator('#chess-feedback-title').innerText(),title);
   assert.equal(await page.locator('#game-result-modal').isVisible(),false);
  }else{
   await page.locator('#game-result-modal').waitFor({state:'visible'});
   assert.equal(await page.locator('#chess-feedback-overlay').isVisible(),false,'do not replace the approved defeat dialog');
  }
 }
 model.winner=0;
 await page.goto(base+'/konto/szachy/?match='+MATCH);
 await page.waitForFunction(()=>document.querySelector('#board')?.dataset.consoleGame==='new');
 assert.equal(await page.locator('#chess-feedback-overlay').isVisible(),false);
 await move(page,'e2','e4');
 await page.waitForFunction(()=>document.querySelector('#chess-feedback-pill')?.textContent.includes('ZBYT_WIELE_PROB'));
 await page.waitForTimeout(350);
 assert.equal(await page.locator('#chess-feedback-pill').isVisible(),true,'429 error remains visible across refresh');
 assert.equal(await page.locator('#chess-feedback-pill').getAttribute('data-kind'),'error');
 assert.equal(await page.locator('#board .chess-square').count(),64);
 assert.deepEqual(errors,[],'no JavaScript runtime errors');
 await ctx.close();
});

test('CHESS-005: actual local chess timer shows a draw when the opponent has only a king',{timeout:45000},async t=>{
 const base=await start(t),browser=await launch(t),page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Use the authentic chess controller with an isolated, test-only starting endgame.
 // Never change production rules or persisted positions.
 let rules='',code=0;
 serveChessConsole({method:'GET'},{writeHead(status){code=status},end(data){rules=String(data)}},
  new URL(base+'/konto/szachy/rules.mjs'));
 assert.equal(code,200);
 const original='export const initial=()=>parseFen();';
 assert.ok(rules.includes(original));
 const testRules=rules.replace(original,
  "export const initial=()=>parseFen('7k/8/8/8/8/8/8/KQ6 w - - 0 1');");
 await page.route('**/konto/szachy/rules.mjs',route=>route.fulfill({
  status:200,contentType:'application/javascript',body:testRules
 }));
 await page.goto(base+'/konto/szachy/');
 await page.locator('#board .chess-square').first().waitFor();
 await page.evaluate(()=>{
  const human=document.querySelector('#chess-opponent');
  human.value='human';human.dispatchEvent(new Event('change',{bubbles:true}));
  const time=document.querySelector('#training-time');
  time.value='1';time.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.querySelector('#clock-2')?.textContent?.trim()==='01:00');
 const originalRect=await page.locator('#board').boundingBox();
 await move(page,'a1','a2');
 await move(page,'h8','g8');
 await page.waitForFunction(()=>document.querySelector('#move-count')?.textContent?.trim()==='Ruchy: 2');
 await page.evaluate(()=>{const previous=Date.now.bind(Date);Date.now=()=>previous()+70000;});
 await page.waitForFunction(()=>document.querySelector('#game-state')?.textContent?.includes('Koniec czasu — remis'),null,{timeout:6000});
 await page.locator('#chess-feedback-overlay').waitFor({state:'visible'});
 assert.equal(await page.locator('#chess-feedback-title').innerText(),'Remis');
 assert.match(await page.locator('#chess-feedback-description').innerText(),/brak możliwości zamatowania/);
 assert.equal(await page.locator('#game-result-modal').isVisible(),false,'draw is not a loss');
 assert.equal(await page.locator('#board .chess-square:not([disabled])').count(),0,'finished board cannot accept moves');
 assert.equal(await page.locator('#record-draws').innerText(),'1','draw counted in local record');
 const finalRect=await page.locator('#board').boundingBox();
 assert.ok(Math.abs(originalRect.x-finalRect.x)<2&&Math.abs(originalRect.width-finalRect.width)<2,
  'chess board geometry remains unchanged by timeout');
 assert.deepEqual(errors,[]);
 await page.close();
});

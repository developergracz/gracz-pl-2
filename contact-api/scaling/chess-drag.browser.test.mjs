// CHESS-DRAG-P1 acceptance in real Chromium: drag & drop (mouse, touch) next to click-to-move.
// Local fixture only: the real chess console modules, no accounts, database or external services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

const index=s=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
const squares=page=>page.locator('#board .chess-square');
const position=page=>squares(page).evaluateAll(cells=>cells.map(c=>c.querySelector('svg')?.dataset.piece||'.'));
const moves=async page=>Number((await page.locator('#move-count').textContent()).replace(/\D+/g,''));
async function center(page,square){
 const box=await squares(page).nth(index(square)).boundingBox();
 return {x:box.x+box.width/2,y:box.y+box.height/2};
}
async function mouseDrag(page,from,to,{release=true}={}){
 const a=await center(page,from),b=typeof to==='string'?await center(page,to):to;
 await page.mouse.move(a.x,a.y);await page.mouse.down();
 await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:6});
 await page.mouse.move(b.x,b.y,{steps:6});
 if(release)await page.mouse.up();
}
async function clickMove(page,from,to){
 await squares(page).nth(index(from)).click();
 await squares(page).nth(index(to)).click();
}
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function noGhost(page){
 await page.waitForFunction(()=>!document.querySelector('.chess-drag-ghost'),null,{timeout:2000});
 assert.equal(await page.locator('#board .chess-drag-origin').count(),0,'no hidden piece is left behind');
}
async function twoPlayers(page){
 await page.locator('#chess-opponent').selectOption('human');
 await page.locator('#restart').click();
 assert.equal(await moves(page),0);
}
const layoutRects=page=>page.evaluate(()=>Object.fromEntries(
 ['#board','.boardframe','.sidebar','.side-dock','.players','#clock-1','#clock-2','#game-state','.bottom']
  .map(s=>{const r=document.querySelector(s)?.getBoundingClientRect();return [s,r?[r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10):null];})));

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
async function open(browser,base,options={}){
 const context=await browser.newContext({viewport:{width:1600,height:900},...options});
 const page=await context.newPage(),errors=[];
 page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/konto/szachy/');
 await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
 return {context,page,errors};
}

test('mouse drag & drop uses the existing move path next to click-to-move',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const {page,errors}=await open(browser,base);

 // 1. Legal drag against the computer: exactly one move, the computer answers, clocks run.
 const before=await layoutRects(page);
 await mouseDrag(page,'e2','e4',{release:false});
 await frames(page);
 const ghost=await page.locator('.chess-drag-ghost').boundingBox(),pointer=await center(page,'e4');
 assert.ok(Math.abs(ghost.x+ghost.width/2-pointer.x)<=1.5&&Math.abs(ghost.y+ghost.height/2-pointer.y)<=1.5,'ghost follows the pointer');
 assert.equal(await page.locator('.chess-drag-ghost').count(),1);
 assert.equal(await page.locator('#board .chess-square.chess-drag-origin .chess-piece').evaluate(e=>getComputedStyle(e).visibility),'hidden','no doubled piece');
 assert.equal(await page.locator('#board .chess-square.chess-target').count(),2,'legal targets stay highlighted');
 assert.deepEqual(await layoutRects(page),before,'board, panels and clocks do not move while dragging');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll');
 await page.mouse.up();
 await noGhost(page);
 await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 2',null,{timeout:12000});
 let board=await position(page);
 assert.equal(board[index('e4')],'P');assert.equal(board[index('e2')],'.');
 await page.waitForFunction(()=>document.getElementById('clock-2').classList.contains('clock-running'));
 assert.deepEqual(errors,[]);

 // 2. Click-to-move still works (default "both").
 await clickMove(page,'d2','d4');
 await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 4',null,{timeout:12000});
 assert.equal((await position(page))[index('d4')],'P');

 // 3. Illegal drop, own square, drop outside the board and Escape all return the piece.
 board=await position(page);
 await mouseDrag(page,'b1','b4');await noGhost(page);
 assert.deepEqual(await position(page),board,'illegal drop does not move');
 assert.equal(await moves(page),4);
 assert.equal(await page.locator('#board .chess-square.chess-selected').count(),1,'piece stays selected after an illegal drop');
 await mouseDrag(page,'g1','g1');await noGhost(page);
 const outside=await page.locator('.sidebar').boundingBox();
 await mouseDrag(page,'g1',{x:outside.x+outside.width/2,y:outside.y+outside.height/2});await noGhost(page);
 assert.equal(await page.locator('#board .chess-square.chess-selected').count(),0,'drop outside cancels');
 await mouseDrag(page,'g1','f3',{release:false});
 await page.keyboard.press('Escape');await noGhost(page);await page.mouse.up();
 await mouseDrag(page,'g1','f3',{release:false});
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await noGhost(page);await page.mouse.up();
 await frames(page);
 assert.deepEqual(await position(page),board,'cancelled drags never move');
 assert.equal(await moves(page),4,'no move from cancelled drags or their trailing clicks');

 // 4. Opponent pieces cannot be dragged; undo and history stay intact.
 await mouseDrag(page,'e7','e5');await noGhost(page);
 assert.deepEqual(await position(page),board);
 await page.locator('#undo-move').click();
 assert.equal(await moves(page),2);
 assert.equal((await position(page))[index('d4')],'.');

 // 5. Special rules via drag, two local players: castling, en passant, promotion choice, mate.
 await twoPlayers(page);
 for(const [a,b] of [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4'],['g8','f6']])await clickMove(page,a,b);
 await mouseDrag(page,'e1','g1');await noGhost(page);
 board=await position(page);
 assert.equal(board[index('g1')],'K');assert.equal(board[index('f1')],'R');assert.equal(await moves(page),7,'castling is one move');

 await twoPlayers(page);
 for(const [a,b] of [['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5']])await clickMove(page,a,b);
 await mouseDrag(page,'e5','d6');await noGhost(page);
 board=await position(page);
 assert.equal(board[index('d6')],'P');assert.equal(board[index('d5')],'.','en passant removes the pawn');

 await twoPlayers(page);
 for(const [a,b] of [['a2','a4'],['b7','b5'],['a4','b5'],['a7','a6'],['b5','a6'],['c8','b7'],['a6','b7'],['b8','c6']])await clickMove(page,a,b);
 await mouseDrag(page,'b7','b8');await noGhost(page);
 assert.equal(await page.locator('.chess-promote').count(),4,'promotion offers all four pieces');
 assert.equal((await position(page))[index('b8')],'.','no piece is promoted before the choice');
 await page.locator('.chess-promote[aria-label="Promocja na skoczka"]').click();
 assert.equal((await position(page))[index('b8')],'N','chosen piece, not an automatic queen');
 assert.equal(await moves(page),9);

 await twoPlayers(page);
 for(const [a,b] of [['e2','e4'],['e7','e5'],['f1','c4'],['b8','c6'],['d1','h5'],['g8','f6']])await clickMove(page,a,b);
 await mouseDrag(page,'h5','f7');await noGhost(page);
 assert.match(await page.locator('#game-state').innerText(),/Mat/);
 assert.equal(await squares(page).filter({has:page.locator('svg')}).evaluateAll(c=>c.filter(x=>!x.disabled).length),0);
 board=await position(page);
 await mouseDrag(page,'c6','d4');await noGhost(page);
 assert.deepEqual(await position(page),board,'no move after the game is over');
 assert.deepEqual(errors,[]);
});

test('touch drag, input modes, keyboard, focus, fullscreen and zoom',{timeout:120000},async t=>{
 const base=await fixture(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());

 // Touch on a phone: Pointer Events drag without scrolling the page; empty squares keep scrolling.
 {
  const {page,errors}=await open(browser,base,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await squares(page).nth(index('e4')).scrollIntoViewIfNeeded();
  const scroll=await page.evaluate(()=>scrollY);
  assert.equal(await squares(page).nth(index('e2')).evaluate(e=>getComputedStyle(e).touchAction),'none');
  assert.equal(await squares(page).nth(index('e4')).evaluate(e=>getComputedStyle(e).touchAction),'auto','no global scroll lock');
  assert.notEqual(await page.evaluate(()=>getComputedStyle(document.body).touchAction),'none');
  const cdp=await page.context().newCDPSession(page);
  const touch=async(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p.x,y:p.y,id:1}]:[]});
  const a=await center(page,'e2'),b=await center(page,'e4');
  await touch('touchStart',a);
  for(let s=1;s<=8;s++)await touch('touchMove',{x:a.x,y:a.y+(b.y-a.y)*s/8});
  assert.equal(await page.locator('.chess-drag-ghost').count(),1);
  assert.equal(await page.evaluate(()=>scrollY),scroll,'page does not scroll while a piece is dragged');
  await touch('touchEnd');await noGhost(page);
  await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 2',null,{timeout:12000});
  // pointercancel (interrupted gesture) returns the piece.
  const board=await position(page),c=await center(page,'d2'),d=await center(page,'d4');
  await touch('touchStart',c);
  for(let s=1;s<=6;s++)await touch('touchMove',{x:c.x,y:c.y+(d.y-c.y)*s/6});
  await touch('touchCancel');await noGhost(page);
  assert.deepEqual(await position(page),board,'pointercancel never moves');
  // Tap-to-move keeps working on touch screens.
  await squares(page).nth(index('d2')).tap();await squares(page).nth(index('d4')).tap();
  await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 4',null,{timeout:12000});
  assert.deepEqual(errors,[]);
  await page.context().close();
 }

 // Three input modes in the existing studio, validated and remembered; keyboard always works.
 {
  const {page,errors}=await open(browser,base);
  await page.evaluate(()=>localStorage.setItem('gracz-chess-input-mode-v1','nonsense'));
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
  await page.locator('#console-config-open').click();
  assert.equal(await page.locator('#chess-input-mode-both').isChecked(),true,'invalid stored value falls back to both');
  await page.locator('#chess-input-mode-both').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#chess-input-mode-click').isChecked(),true,'radio group works with the keyboard');
  await page.locator('#console-config-done').click();
  await mouseDrag(page,'e2','e4');await noGhost(page);
  assert.equal(await moves(page),0,'click-only mode ignores drags');
  await clickMove(page,'e2','e4');
  await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 2',null,{timeout:12000});

  await page.locator('#console-config-open').click();
  await page.locator('label[for],label.chess-input-mode').filter({hasText:'Tylko przeciąganie'}).click();
  await page.locator('#console-config-done').click();
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
  assert.equal(await page.evaluate(()=>localStorage.getItem('gracz-chess-input-mode-v1')),'drag');
  await clickMove(page,'e2','e4');
  assert.equal(await moves(page),0,'drag-only mode ignores pointer clicks');
  await squares(page).nth(index('d2')).focus();await page.keyboard.press('Enter');
  await squares(page).nth(index('d4')).focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 2',null,{timeout:12000});
  await mouseDrag(page,'e2','e4');await noGhost(page);
  await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 4',null,{timeout:12000});

  // "Sama gra", fullscreen and page zoom keep an exact hit-test.
  await page.evaluate(()=>localStorage.setItem('gracz-chess-input-mode-v1','both'));
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
  await page.locator('#focus-game').click();
  assert.equal(await page.locator('#game').evaluate(e=>e.classList.contains('game-focus')),true);
  await mouseDrag(page,'e2','e4');await noGhost(page);
  await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 2',null,{timeout:12000});
  await page.locator('#focus-exit').click();
  await page.locator('#fullscreen-game').click();
  await page.waitForFunction(()=>!!document.fullscreenElement,null,{timeout:3000});
  await mouseDrag(page,'d2','d4');await noGhost(page);
  await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 4',null,{timeout:12000});
  await page.evaluate(()=>document.exitFullscreen());
  await page.evaluate(()=>{document.documentElement.style.zoom='1.25';});
  await frames(page);
  await mouseDrag(page,'g1','f3');await noGhost(page);
  await page.waitForFunction(()=>document.querySelector('#move-count').textContent==='Ruchy: 6',null,{timeout:12000});
  assert.equal((await position(page))[index('f3')],'N','zoomed hit-test lands on the intended square');
  assert.deepEqual(errors,[]);
 }

 // prefers-reduced-motion: an illegal drop returns immediately, without the return animation.
 {
  const {page}=await open(browser,base,{reducedMotion:'reduce'});
  await mouseDrag(page,'b1','b4');
  await frames(page);
  assert.equal(await page.locator('.chess-drag-ghost').count(),0);
  assert.equal(await moves(page),0);
 }
});

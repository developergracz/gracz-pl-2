// Warcaby board + engine mounted inside the exact chess-style owner console.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

async function serverFor(t){
 const requests=[];
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(serveCheckersConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  if(url.pathname==='/auth/message-center'){
   res.writeHead(401,{'Content-Type':'application/json'});res.end('{"ok":false}');return;
  }
  if(url.pathname==='/auth/social/challenges'){
   if(req.method==='POST'){
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
     try{requests.push(JSON.parse(body));}catch{}
     res.writeHead(200,{'Content-Type':'application/json'});
     res.end('{"ok":true}');
    });return;
   }
   res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"challenges":[]}');return;
  }
  res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true,"items":[]}');
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 return {base:'http://127.0.0.1:'+server.address().port,requests};
}

test('Warcaby use the chess console with untouched 24 pieces, AI moves, undo, online invitation and mobile',{timeout:110000},async t=>{
 const {base,requests}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const size of [{width:1366,height:768},{width:390,height:844}]){
  const mobile=size.width<=800;
  const context=await browser.newContext({viewport:size,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.body.classList.contains('checkers-shell-loading'),{timeout:15000});
  const view=await page.evaluate(()=>{
   const board=document.getElementById('board'),dock=document.querySelector('#game > .boardarea > .side-dock');
   const rect=el=>el?.getBoundingClientRect();
   const a=rect(board),d=rect(dock);
   return {
    squares:board.querySelectorAll('.square').length,
    white:board.querySelectorAll('.piece.white').length,
    black:board.querySelectorAll('.piece.black').length,
    mode:document.querySelector('#training-mode')?.classList.contains('active'),
    top:!!dock?.querySelector(':scope > .cc-top'),
    actions:!!dock?.querySelector(':scope > .chess-reference-actions'),
    tools:!!dock?.querySelector(':scope > .cc-tools'),
    tabs:[...dock.querySelectorAll('.dock-tabs [role=tab]')].map(el=>el.textContent.trim()),
    boardX:a.x,dockX:d.x,boardWidth:a.width,boardHeight:a.height,
    background:getComputedStyle(document.documentElement).backgroundColor
   };
  });
  assert.equal(view.squares,64,'existing 8x8 game board');
  assert.equal(view.white,12,'12 original white checkers');
  assert.equal(view.black,12,'12 original black checkers');
  assert.equal(view.mode,true,'original computer game starts normally');
  assert.equal(view.top&&view.actions&&view.tools,true,'same approved chess-style right panel');
  assert.deepEqual(view.tabs,['Czat','Ruchy','Info']);
  await page.getByRole('tab',{name:'Info'}).click();
  await page.locator('#checkers-owner-info').waitFor({state:'visible'});
  assert.equal(await page.getByRole('button',{name:'Odśwież partię online'}).isDisabled(),true,
    'online refresh cannot interfere with a computer game');
  await page.locator('#chat-tab').click();
  assert.ok(Math.abs(view.boardWidth-view.boardHeight)<3,'board stays square');
  if(!mobile)assert.ok(view.boardX<view.dockX,'board left, controls right');
  await page.locator('#board .square').nth(17).click();
  await page.locator('#board .square').nth(24).click();
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0');
  assert.ok((await page.locator('#moves-list li').count())>=1,'existing move history');
  const undo=page.getByRole('button',{name:'Cofnij',exact:true});
  assert.equal(await undo.isEnabled(),true);
  await undo.click();
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent==='Ruch 0');
  await page.getByRole('button',{name:'Ustawienia',exact:true}).click();
  await page.locator('#cc-sheet-settings').waitFor({state:'visible'});
  assert.equal(await page.locator('#ai-level').count(),1,'original AI difficulty remains present');
  assert.equal(await page.locator('#training-time').count(),1,'original clocks remain present');
  await page.locator('#training-time').selectOption('0');
  assert.equal(await page.locator('#clock-1').isVisible(),false,'untimed game hides black clock');
  assert.equal(await page.locator('#clock-2').isVisible(),false,'untimed game hides white clock');
  await page.locator('#training-time').selectOption('7');
  assert.equal(await page.locator('#clock-1').isVisible(),true,'timed game restores clock');
  await page.locator('#cc-sheet-settings button.cc-button').filter({hasText:'Obróć planszę'}).click();
  await page.locator('#cc-sheet-settings').waitFor({state:'hidden'});
  await page.locator('#online-mode').click();
  await page.getByRole('button',{name:'Zaproś',exact:true}).click();
  await page.locator('#cc-sheet-online').waitFor({state:'visible'});
  assert.equal(await page.locator('#create-room-friend').isVisible(),true,'friend field was NOT hidden by inherited chess CSS');
  await page.locator('#create-room-friend').fill('TestowyRywal');
  await page.locator('#create-room-time').selectOption('5');
  await page.locator('#create-room').click();
  await page.waitForFunction(()=>document.getElementById('create-room-status')?.textContent.includes('wysłane'));
  assert.equal(requests.at(-1)?.game,'warcaby','invitation still uses original Warcaby API');
  assert.equal(requests.at(-1)?.nickname,'TestowyRywal');
  assert.deepEqual(errors,[],'no browser runtime errors');
  await context.close();
 }
});

test('Warcaby render no legacy page or loading text during a delayed checkers app request',{timeout:60000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/konto/warcaby/app.js',async route=>{await gate;await route.continue();});
 await page.goto(base+'/konto/warcaby/',{waitUntil:'commit'});
 await page.waitForFunction(()=>!!document.querySelector('#game'));
 await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/konto/warcaby/styl.css')));
 try{
  const state=await page.evaluate(()=>({
   root:document.documentElement.classList.contains('checkers-shell-loading'),
   body:document.body.classList.contains('checkers-shell-loading'),
   opacity:getComputedStyle(document.getElementById('game')).opacity,
   visibility:getComputedStyle(document.getElementById('game')).visibility,
   fallback:getComputedStyle(document.getElementById('checkers-shell-fallback')).opacity
  }));
  assert.deepEqual(state,{root:true,body:true,opacity:'0',visibility:'hidden',fallback:'0'});
 }finally{release();}
 await page.waitForFunction(()=>!document.body.classList.contains('checkers-shell-loading'),{timeout:15000});
 assert.equal(await page.locator('#board .square').count(),64);
});

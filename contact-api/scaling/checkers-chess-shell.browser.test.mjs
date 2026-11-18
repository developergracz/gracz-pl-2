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
  assert.ok((await page.locator('#moves-list .checkers-history-move').count())>=1,'existing move history');
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

test('P0: visible checker is clickable by real cursor/touch after cold load and reload on desktop/mobile',{timeout:105000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const viewport of [{width:1649,height:928},{width:1366,height:768},{width:390,height:844}]){
  const mobile=viewport.width<800;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const iteration of ['cold','refresh']){
   if(iteration==='cold')await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
   else await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64);
   await page.waitForFunction(()=>!document.body.classList.contains('checkers-shell-loading'));
   await page.waitForTimeout(2400); // also cross the formerly indefinite CSS-boot mask
   const first=page.locator('#board .square').nth(17),dest=page.locator('#board .square').nth(24);
   await first.scrollIntoViewIfNeeded();
   const preflight=await first.evaluate(cell=>{
    const piece=cell.querySelector('.piece'),rect=piece?.getBoundingClientRect();
    const hit=rect?document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2):null;
    const board=document.getElementById('board'),game=document.getElementById('game');
    return {
     piece:!!piece,visible:!!rect&&rect.width>8&&rect.height>8,
     hit:hit===piece||piece?.contains(hit)||hit===cell||cell.contains(hit),
     visibleGame:getComputedStyle(game).visibility==='visible',
     pointer:getComputedStyle(game).pointerEvents,
     inert:!!piece?.closest('[inert]'),
     boardPointer:getComputedStyle(board).pointerEvents
    };
   });
   assert.equal(preflight.piece,true,'a real player piece exists: '+JSON.stringify(viewport));
   assert.equal(preflight.visible,true,'piece must occupy a visible click target');
   assert.equal(preflight.hit,true,'the checkerpiece must be the topmost hit-test element');
   assert.equal(preflight.visibleGame,true,'bootstrap mask must be released');
   assert.notEqual(preflight.pointer,'none','owner shell must not swallow input');
   assert.notEqual(preflight.boardPointer,'none','board must receive pointer events');
   assert.equal(preflight.inert,false,'no overlay may make the board inert');
   await first.locator('.piece').click({timeout:5000});
   await dest.click({timeout:5000});
   await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0',{timeout:10000});
   assert.ok(await page.locator('#moves-list .checkers-history-move').count()>=1,'move committed by a real piece click');
  }
  assert.deepEqual(errors,[],'no JavaScript errors on a real browser and refresh');
  await context.close();
 }
});

test('P0: console remains playable when web-font readiness never resolves',{timeout:30000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.addInitScript(()=>{
  // Simulate a browser/font subsystem whose ready promise never settles.
  const pending=new Promise(()=>{});
  try{Object.defineProperty(document.fonts,'ready',{configurable:true,get:()=>pending});}catch{}
 });
 await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64);
 await page.waitForFunction(()=>!document.body.classList.contains('checkers-shell-loading'),{timeout:6000});
 await page.locator('#board .square').nth(17).locator('.piece').click();
 await page.locator('#board .square').nth(24).click();
 await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0');
});

test('P0: same service always offers a fully playable classic Warcaby fallback',{timeout:30000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/konto/warcaby/?konsola=klasyczna',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64);
 const state=await page.evaluate(()=>({
  classic:document.body.classList.contains('warcaby-console')&&
   !document.body.classList.contains('chess-console'),
  noBootBlock:!document.body.classList.contains('checkers-shell-loading'),
  boardSquares:document.querySelectorAll('#board .square').length,
  pawns:document.querySelectorAll('#board .piece').length,
  js:[...document.scripts].map(x=>x.src).filter(Boolean).some(x=>x.includes('/konto/warcaby/app.js?konsola=klasyczna')),
  css:[...document.querySelectorAll('link[rel=stylesheet]')].some(x=>x.href.includes('/konto/warcaby/styl.css?konsola=klasyczna'))
 }));
 assert.deepEqual(state,{classic:true,noBootBlock:true,boardSquares:64,pawns:24,js:true,css:true});
 await page.locator('#board .square').nth(17).locator('.piece').click();
 await page.locator('#board .square').nth(24).click();
 await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0',{timeout:10000});
 assert.deepEqual(errors,[]);
});

test('Owner parity: chess-dark background, correctly oriented coordinates, chess-style move history and mobile topbar',{timeout:120000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const mobile=viewport.width<=800;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.body.classList.contains('checkers-shell-loading'));
  await page.locator('#board .square').first().waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelectorAll('#board .checkers-coordinate').length===16);
  assert.equal(await page.locator('#board .checkers-coordinate-rank').count(),8);
  assert.equal(await page.locator('#board .checkers-coordinate-file').count(),8);
  const labels=await page.locator('#board .square').evaluateAll(cells=>({
   first:cells[0].querySelector('.checkers-coordinate-rank')?.textContent,
   last:cells.at(-1).querySelector('.checkers-coordinate-file')?.textContent,
   pointer:getComputedStyle(cells[0].querySelector('.checkers-coordinate-rank')).pointerEvents
  }));
  assert.deepEqual(labels,{first:'8',last:'h',pointer:'none'});
  const visuals=await page.evaluate(()=>{
   const game=document.getElementById('game'),body=document.body,area=game.querySelector('.boardarea');
   const mobileBar=area.querySelector('.checkers-mobile-heading');
   return {
    root:getComputedStyle(document.documentElement).backgroundColor,
    body:getComputedStyle(body).backgroundColor,
    game:getComputedStyle(game).backgroundColor,
    boardarea:getComputedStyle(area).backgroundColor,
    shadow:getComputedStyle(game).boxShadow,
    mobileBar:mobileBar&&getComputedStyle(mobileBar).display!=='none',
    header:mobileBar?.textContent?.includes('GRACZ.PL')&&mobileBar?.textContent?.includes('Warcaby'),
    width:document.documentElement.scrollWidth,
    viewport:document.documentElement.clientWidth
   };
  });
  assert.equal(visuals.root,'rgb(0, 0, 0)','document root is black');
  assert.equal(visuals.body,'rgb(0, 0, 0)','Owner requested pure black page');
  assert.equal(visuals.boardarea,'rgb(0, 0, 0)','no green board surroundings');
  assert.equal(visuals.game,'rgb(0, 0, 0)','Owner requested pure black game canvas');
  assert.equal(visuals.shadow,'none','no surrounding game frame shadow');
  assert.equal(visuals.mobileBar,mobile,'mobile navigation bar only on phones');
  assert.equal(visuals.header,true);
  assert.ok(visuals.width<=visuals.viewport+2,'no horizontal overflow');
  if(mobile){
   await page.locator('.checkers-mobile-menu-toggle').click();
   assert.equal(await page.locator('.checkers-mobile-menu-panel a').count(),4);
   assert.equal(await page.locator('.checkers-mobile-menu').evaluate(e=>e.open),true);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.checkers-mobile-menu').evaluate(e=>e.open),false);
  }
  await page.locator('#board .square').nth(17).locator('.piece').click();
  await page.locator('#board .square').nth(24).click();
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0');
  await page.locator('#history-tab').click();
  await page.locator('#moves-panel').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelectorAll('#moves-list .checkers-history-move').length>=1);
  assert.equal(await page.locator('.checkers-history-columns').textContent(),'NrBiałeCzarne');
  const recorded=Number(await page.locator('#history-count').textContent());
  assert.ok(recorded>=1,'count from the real game history');
  await page.locator('#moves-list .checkers-history-move').first().waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#moves-list .checkers-history-move')?.disabled,{timeout:15000});
  await page.locator('#moves-list .checkers-history-move').first().click();
  await page.locator('.checkers-replay-board').waitFor({state:'visible'});
  assert.equal(await page.locator('.checkers-replay-board .square').count(),64,'position preview uses 64 squares');
  assert.equal(await page.locator('#board .square').count(),64,'actual playable board untouched');
  assert.ok((await page.locator('.checkers-history-nav-status').textContent()).includes('Pozycja 1'));
  await page.getByRole('button',{name:'Pierwsza pozycja'}).click();
  assert.ok((await page.locator('.checkers-history-nav-status').textContent()).includes('Pozycja 0'));
  await page.getByRole('button',{name:'Następny ruch'}).click();
  await page.getByRole('button',{name:'Powrót do bieżącej partii'}).click();
  assert.equal(await page.locator('.checkers-replay-board').isVisible(),false);
  await page.locator('#checkers-owner-info').count();
  // Check board-rotation metadata and labels without changing the actual rules.
  await page.locator('#rotate-board').evaluate(button=>button.click());
  await page.waitForFunction(()=>document.getElementById('board')?.dataset.checkersRotated==='true');
  const flipped=await page.locator('#board .square').first().locator('.checkers-coordinate-rank').textContent();
  assert.equal(flipped,'1','rank labels follow rotation');
  assert.deepEqual(errors,[],'no browser JS errors');
  await context.close();
 }
});

test('Move-history rewind resets after a new match and classic fallback remains functional',{timeout:60000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64);
 await page.locator('#board .square').nth(17).locator('.piece').click();
 await page.locator('#board .square').nth(24).click();
 await page.waitForFunction(()=>Number(document.getElementById('history-count')?.textContent)>0);
 await page.locator('#history-tab').click();
 await page.getByRole('button',{name:'Pierwsza pozycja'}).click();
 await page.locator('.checkers-replay-board').waitFor({state:'visible'});
 await page.locator('#training-mode').click();
 await page.locator('#restart').evaluate(el=>el.click());
 await page.waitForFunction(()=>document.getElementById('history-count')?.textContent==='0');
 assert.equal(await page.locator('.checkers-replay-board').isVisible(),false,'new game hides old preview');
 assert.equal(await page.locator('#moves-list .checkers-history-move').count(),0,'new game clears notation');
 await page.goto(base+'/konto/warcaby/?konsola=klasyczna');
 await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64);
 assert.equal(await page.locator('.checkers-mobile-heading').count(),0,'classic route unchanged');
});

test('Warcaby chat uses content-sized bubbles and no red focus border on desktop/mobile',{timeout:50000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const mobile=viewport.width<=800;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.body.classList.contains('checkers-shell-loading')&&
    typeof window.GraczChat?.createMessage==='function');
  await page.locator('#chat-tab').click();
  await page.locator('#chat-panel').waitFor({state:'visible'});
  const bubbles=await page.evaluate(()=>{
   const container=document.getElementById('chat-messages');
   const mine=window.GraczChat.createMessage({sender:'Ty',body:'Witam',mine:true,
      createdAt:new Date().toISOString(),timestamps:false});
   const long=window.GraczChat.createMessage({sender:'Gość',
      body:'To jest dłuższa wiadomość do sprawdzenia zawijania tekstu w dymku. '.repeat(9),
      mine:false,createdAt:new Date().toISOString(),timestamps:false});
   container.replaceChildren(mine,long);
   const cr=container.getBoundingClientRect(),a=mine.getBoundingClientRect(),b=long.getBoundingClientRect();
   return {
    container:cr.width,short:a.width,long:b.width,
    ownLeftGap:Math.round(a.left-cr.left),otherLeftGap:Math.round(b.left-cr.left),
    wraps:b.height>a.height,
    align:getComputedStyle(mine).alignSelf,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
   };
  });
  assert.ok(bubbles.container>200,'chat has real usable width');
  assert.ok(bubbles.short<bubbles.container*.72,'short text must not fill the row: '+JSON.stringify(bubbles));
  assert.ok(bubbles.long<=bubbles.container*.9,'long messages are bounded');
  assert.equal(bubbles.wraps,true,'long text must wrap');
  assert.ok(bubbles.ownLeftGap<25,'own bubble aligns to the left');
  assert.ok(bubbles.otherLeftGap<25,'opponent bubble aligns to the left');
  assert.equal(bubbles.align,'flex-start');
  assert.ok(bubbles.overflow<=2,'chat must not cause horizontal page scroll');
  const focus=await page.locator('#chat-input').evaluate(input=>{
   input.focus();
   const css=getComputedStyle(input);
   return {outline:css.outlineStyle,shadow:css.boxShadow,border:css.borderColor,
     background:css.backgroundColor,focused:document.activeElement===input};
  });
  assert.equal(focus.focused,true,'input remains keyboard accessible');
  assert.equal(focus.outline,'none','no red or browser-default focus frame');
  assert.equal(focus.shadow,'none','no focus halo');
  assert.equal(focus.border,'rgb(165, 181, 181)','input focus border is neutral');
  assert.equal(focus.background,'rgb(255, 255, 255)','input stays white when focused');
  assert.deepEqual(errors,[],'no JavaScript errors');
  await context.close();
 }
});

test('P0: real mouse/touch drag onto highlighted destination, invalid snapback and old click controls',{timeout:95000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const mobile=viewport.width<=800;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const drag=async(from,to)=>{
   const source=page.locator('#board .square[data-index="'+from+'"] .piece');
   const target=page.locator('#board .square[data-index="'+to+'"]');
   await source.scrollIntoViewIfNeeded();
   const a=await source.boundingBox(),b=await target.boundingBox();
   assert.ok(a&&b,'source piece and destination square are visible');
   const x=a.x+a.width/2,y=a.y+a.height/2,u=b.x+b.width/2,v=b.y+b.height/2;
   if(mobile){
    const cdp=await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let n=1;n<=8;n++){
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',
      touchPoints:[{x:x+(u-x)*n/8,y:y+(v-y)*n/8,id:1}]});
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
   }else{
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(u,v,{steps:12});await page.mouse.up();
   }
  };
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#board .piece.white').length===12);
  assert.equal(await page.locator('#board .square[data-index="17"] .piece').count(),1);
  await drag(17,19); // Illegal sideways drag, source must snap back.
  assert.equal(await page.locator('#move-count').textContent(),'Ruch 0');
  assert.equal(await page.locator('#board .square[data-index="17"] .piece').count(),1);
  assert.equal(await page.locator('.checkers-drag-ghost').count(),0);
  await drag(17,24); // Real legal white opening.
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0',{timeout:12000});
  assert.ok(Number(await page.locator('#history-count').textContent())>=1);
  assert.equal(await page.locator('.checkers-drag-ghost').count(),0);
  assert.equal(await page.locator('#board .square').count(),64);
  await page.locator('#restart').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent==='Ruch 0');
  await page.locator('#board .square[data-index="17"]').click();
  await page.locator('#board .square[data-index="24"]').click();
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0');
  assert.deepEqual(errors,[]);
  await context.close();
 }
});

test('P0: forced two-step capture is draggable only from required pawn and to legal highlighted squares',{timeout:65000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const id='12345678-1234-4234-8234-1234567890ab';
 const board=Array(64).fill(0);
 board[17]=1;board[21]=1;board[26]=2;board[44]=2;
 let match={id,game:'warcaby',version:10,player:1,players:['Ty','Rywal'],playable:true,
  state:{board,turn:1,winner:0,forced:17,moves:0,quiet:0,history:[]}};
 const calls=[];
 await page.route('**/auth/match?*',route=>route.fulfill({json:{ok:true,match}}));
 await page.route('**/auth/match',route=>{
  const payload=route.request().postDataJSON(),move=payload?.move;
  if(payload?.version!==match.version||!move||move.from!==(calls.length?35:17)||
      move.to!==(calls.length?53:35)){
   return route.fulfill({status:400,json:{ok:false,error:'ILLEGAL_MOVE'}});
  }
  const next=match.state.board.slice();next[move.to]=next[move.from];
  next[move.from]=0;next[calls.length?44:26]=0;
  calls.push([move.from,move.to]);
  match={...match,version:match.version+1,state:{...match.state,
   board:next,forced:calls.length===1?35:null,turn:calls.length===1?1:2,
   moves:calls.length,history:[...match.state.history,{player:1,from:move.from,to:move.to}]}};
  return route.fulfill({json:{ok:true,match}});
 });
 await page.goto(base+'/konto/warcaby/?match='+id,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#board .square[data-index="17"].must-continue'));
 const drag=async(from,to)=>{
  const a=await page.locator('#board .square[data-index="'+from+'"] .piece').boundingBox();
  const b=await page.locator('#board .square[data-index="'+to+'"]').boundingBox();
  assert.ok(a&&b);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();
 };
 await drag(21,28);
 assert.deepEqual(calls,[],'unmarked pawn cannot move during forced capture');
 await drag(17,35);
 await page.waitForFunction(()=>document.querySelector('#board .square[data-index="35"].must-continue'));
 assert.deepEqual(calls,[[17,35]],'first capture accepted through original server API');
 await drag(35,53);
 await page.waitForFunction(()=>document.querySelector('#board .square[data-index="53"] .piece.white')&&
  document.getElementById('move-count')?.textContent==='Ruch 2');
 assert.deepEqual(calls,[[17,35],[35,53]],'second mandatory capture also via original API');
 assert.equal(await page.locator('.checkers-drag-ghost').count(),0);
});

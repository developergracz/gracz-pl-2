// Warcaby board + engine mounted inside the exact chess-style owner console.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveCheckersConsole} from '../auth/checkers-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';

async function serverFor(t,{nickname=null}={}){
 const requests=[];
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(serveCheckersConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  if(url.pathname==='/auth/session'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify(nickname?{ok:true,loggedIn:true,nickname}:{ok:true,loggedIn:false}));return;
  }
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

async function takeSeat(page){
 await page.waitForFunction(()=>document.querySelectorAll('#board .piece.white').length>0&&
  document.querySelector('#board')?.dataset.checkersPlayable==='false');
 // Pointer can remain over a pawn after restart; in that case the dialog
 // has already opened automatically, which is correct user-facing behavior.
 if(await page.locator('#checkers-start-gate').isHidden()){
  await page.locator('#board .piece.white').first().evaluate(el=>{
   el.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
  });
 }
 await page.locator('#checkers-start-gate').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Wybierz białe pionki'}).click();
 await page.locator('#checkers-start-gate').waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.querySelector('#board')?.dataset.checkersPlayable==='true');
}

test('Seat-to-play modal is centered on first hover/tap and clocks start only after first valid move',{timeout:95000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const mobile=viewport.width<=800;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#board')?.dataset.checkersPlayable==='false'&&
   document.querySelectorAll('#board .piece.white').length===12);
  const gate=page.locator('#checkers-start-gate');
  assert.equal(await gate.isVisible(),false,'no modal before hovering a pawn');
  assert.equal(await page.locator('#move-count').textContent(),'Ruch 0');
  await page.locator('#training-time').evaluate(el=>{el.value='7';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.waitForFunction(()=>document.querySelector('#board')?.dataset.checkersPlayable==='false');
  const source=page.locator('#board .square[data-index="17"] .piece');
  const a=await source.boundingBox(),x=a.x+a.width/2,y=a.y+a.height/2;
  if(mobile){
   const cdp=await context.newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await cdp.detach();
  }else{
   await page.mouse.move(x,y,{steps:5});
  }
  await gate.waitFor({state:'visible'});
  assert.equal(await gate.getAttribute('role'),'dialog');
  assert.equal(await gate.getAttribute('aria-modal'),'true');
  assert.match(await gate.textContent(),/Wybierz kolor pionków/);
  const bbox=await page.locator('.checkers-start-card').boundingBox();
  assert.ok(Math.abs(bbox.x+bbox.width/2-viewport.width/2)<5,'prompt horizontally centered');
  assert.ok(Math.abs(bbox.y+bbox.height/2-viewport.height/2)<5,'prompt vertically centered');
  assert.equal(await page.locator('#board').getAttribute('data-checkers-playable'),'false');
  // Dispatching a board click without using the dialog must never bypass activation.
  await page.locator('#board .square[data-index="17"]').evaluate(el=>el.click());
  await page.locator('#board .square[data-index="24"]').evaluate(el=>el.click());
  assert.equal(await page.locator('#move-count').textContent(),'Ruch 0');
  const initial=await Promise.all(['clock-1','clock-2'].map(id=>page.locator('#'+id).textContent()));
  assert.deepEqual(initial,['07:00','07:00']);
  await page.getByRole('button',{name:'Wybierz białe pionki'}).click();
  await gate.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#board')?.dataset.checkersPlayable==='true');
  await page.waitForTimeout(1250);
  assert.deepEqual(await Promise.all(['clock-1','clock-2'].map(id=>page.locator('#'+id).textContent())),initial,
   'clicking start does not consume either clock');
  await page.locator('#board .square[data-index="17"]').click();
  await page.locator('#board .square[data-index="24"]').click();
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0');
  await page.waitForFunction(initial=>
   ['clock-1','clock-2'].some((id,i)=>document.getElementById(id)?.textContent!==initial[i]),
   initial,{timeout:7000});
  await page.locator('#restart').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('#board')?.dataset.checkersPlayable==='false');
  assert.equal(await page.locator('#move-count').textContent(),'Ruch 0','new game is still unseated');
  assert.deepEqual(errors,[],'no browser errors');
  await context.close();
 }
});

test('signed-in loss result and real tables navigation, creation, join and mobile',{timeout:95000},async t=>{
 const {base}=await serverFor(t,{nickname:'gracz'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const context=await browser.newContext({viewport,isMobile:viewport.width<=800,hasTouch:viewport.width<=800});
  const page=await context.newPage(),errors=[],calls=[];
  const id='12345678-1234-4234-8234-1234567890ab';
  let tables=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/auth/warcaby/tables*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()==='GET')return route.fulfill({json:{ok:true,
    tables:tables.filter(row=>url.searchParams.get('scope')==='mine'?row.mine:true)}});
   const body=req.postDataJSON();calls.push(body);
   if(body.action==='create')tables=[{id,title:body.title,host:'gracz',
    guest:null,minutes:body.minutes,incrementSeconds:body.incrementSeconds,
    status:'waiting',visibility:body.visibility,mine:true,joined:false,color:body.color}];
   if(body.action==='edit')tables=tables.map(row=>row.id===body.id?{...row,title:body.title,
    minutes:body.minutes,incrementSeconds:body.incrementSeconds,
    color:body.color,visibility:body.visibility}:row);
   if(body.action==='join')return route.fulfill({json:{ok:true,matchId:id}});
   if(body.action==='close')tables=[];
   return route.fulfill({json:{ok:true,id}});
  });
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#game')&&!document.body.classList.contains('checkers-shell-loading'));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gracz:warcaby:position',
   {detail:{mode:'training',player:1,winner:2,players:['Ty','Komputer'],version:1}})));
  await page.locator('#warcaby-loss-overlay').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#warcaby-loss-player')?.textContent==='gracz');
  assert.equal(await page.locator('#warcaby-loss-name').textContent(),'Komputer');
  assert.match(await page.locator('#warcaby-loss-title').textContent(),/Przegrałeś gracz tę grę z/);
  assert.deepEqual(await page.locator('.warcaby-loss-actions button').allTextContents(),['Rewanż','Stoły']);
  await page.locator('#warcaby-loss-others').click();
  await page.locator('#warcaby-tables-overlay').waitFor({state:'visible'});
  assert.deepEqual(await page.locator('.warcaby-tables-menu button').allTextContents(),
   ['Wolne stoły','W trakcie gry','Moje stoły']);
  await page.waitForFunction(()=>document.querySelector('#warcaby-loss-tables')?.textContent.includes('Nie ma obecnie wolnych stołów'));
  await page.locator('#warcaby-tables-create-toggle').click();
  await page.locator('input[name="title"]').fill('Warcaby Test');
  await page.locator('select[name="minutes"]').selectOption('5');
  await page.locator('select[name="incrementSeconds"]').selectOption('2');
  await page.locator('select[name="visibility"]').selectOption('public');
  await page.locator('#warcaby-tables-create button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#warcaby-loss-tables')?.textContent.includes('Warcaby Test'));
  assert.equal(calls.at(-1).action,'create');
  assert.equal(calls.at(-1).minutes,5);
  assert.equal(calls.at(-1).incrementSeconds,2);
  assert.match(await page.locator('#warcaby-loss-tables').textContent(),/Gospodarz: gracz/);
  const actions=page.locator('#warcaby-loss-tables');
  assert.deepEqual(await actions.locator('button').allTextContents(),
   ['Zamknij','Edytuj','Kod QR','Wyślij']);
  await actions.getByRole('button',{name:'Edytuj'}).click();
  assert.equal(await page.locator('#warcaby-tables-form-heading').textContent(),'Edytuj stół');
  assert.equal(await page.locator('input[name="title"]').inputValue(),'Warcaby Test');
  await page.locator('input[name="title"]').fill('Warcaby Nowe');
  await page.locator('select[name="visibility"]').selectOption('private');
  await page.locator('#warcaby-tables-save').click();
  await page.waitForFunction(()=>document.querySelector('#warcaby-loss-tables')?.textContent.includes('Warcaby Nowe'));
  assert.equal(calls.at(-1).action,'edit');
  assert.equal(calls.at(-1).id,id);
  assert.equal(calls.at(-1).visibility,'private');
  await actions.getByRole('button',{name:'Kod QR'}).click();
  await page.locator('#warcaby-share-overlay').waitFor({state:'visible'});
  await page.locator('#warcaby-share-qr svg').waitFor({state:'visible'});
  assert.equal(new URL(await page.locator('#warcaby-share-link').inputValue()).searchParams.get('table'),id);
  await page.locator('#warcaby-share-close').click();
  await page.locator('#warcaby-share-overlay').waitFor({state:'hidden'});
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:undefined,configurable:true}));
  await actions.getByRole('button',{name:'Wyślij'}).click();
  await page.locator('#warcaby-share-overlay').waitFor({state:'visible'});
  assert.equal(new URL(await page.locator('#warcaby-share-link').inputValue()).searchParams.get('table'),id);
  await page.locator('#warcaby-share-close').click();
  assert.equal(await actions.getByRole('button',{name:'Zamknij',exact:true}).textContent(),'Zamknij');
  await page.locator('#warcaby-loss-tables').getByRole('button',{name:'Zamknij',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#warcaby-loss-tables')?.textContent.includes('Brak stołów'));
  assert.equal(calls.at(-1).action,'close');
  await page.locator('#warcaby-tables-close').click();
  await page.locator('#warcaby-tables-overlay').waitFor({state:'hidden'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gracz:warcaby:position',
   {detail:{mode:'online',player:1,winner:2,
   players:['gracz','Rywal123'],matchId:'other',version:4}})));
  await page.locator('#warcaby-loss-overlay').waitFor({state:'visible'});
  assert.equal(await page.locator('#warcaby-loss-name').textContent(),'Rywal123');
  assert.deepEqual(errors,[],'no browser JavaScript errors');
  await context.close();
 }
});

test('Anonymous guest and color picker: white below; black side triggers computer white opener and clock',{timeout:95000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const context=await browser.newContext({viewport,isMobile:viewport.width<500,hasTouch:viewport.width<500});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#board')?.dataset.checkersPlayable==='false'&&
   document.querySelectorAll('#board .piece.white').length===12);
  const check=()=>page.evaluate(()=>{
   const $=id=>document.getElementById(id),labels=['black-name','white-name'].map(id=>
    $(id)?.closest('.player')?.querySelector('.cc-side')?.textContent);
   const center=i=>{const r=document.querySelector('#board .square[data-index="'+i+'"]').getBoundingClientRect();return r.top+r.height/2};
   return {labels,white:center(17),black:center(49),rotation:$('board').dataset.checkersRotated};
  });
  await page.waitForFunction(()=>document.getElementById('white-name')?.closest('.player')?.querySelector('.cc-side')?.textContent==='Gość');
  const initial=await check();
  assert.deepEqual(initial.labels,['Komputer','Gość']);
  assert.equal(initial.rotation,'true');
  assert.ok(initial.white>initial.black,'opening screen displays white pieces at the bottom');
  const pawn=page.locator('#board .square[data-index="17"] .piece');
  // Hover opens a blocking modal immediately. Dispatch the hover event as
  // a real DOM pointer event, otherwise Playwright keeps retrying hover
  // because the newly opened dialog correctly intercepts the pointer.
  await pawn.evaluate((el,viewportWidth)=>el.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:viewportWidth<500?'touch':'mouse'})),viewport.width);
  const gate=page.locator('#checkers-start-gate');
  await gate.waitFor({state:'visible'});
  assert.deepEqual(await gate.locator('button').allTextContents(),['Białe','Czarne']);
  assert.deepEqual(await Promise.all(['clock-1','clock-2'].map(id=>page.locator('#'+id).textContent())),['07:00','07:00']);
  await gate.getByRole('button',{name:'Wybierz czarne pionki'}).click();
  await gate.waitFor({state:'hidden'});
  await page.locator('#checkers-color-confirmation').waitFor({state:'visible'});
  assert.match(await page.locator('#checkers-color-confirmation').textContent(),/Świetnie! Grasz teraz czarnymi pionkami/);
  await page.waitForFunction(()=>document.querySelector('#board')?.dataset.checkersHumanSide==='2');
  const chosen=await check();
  assert.deepEqual(chosen.labels,['Gość','Komputer']);
  assert.equal(chosen.rotation,'false');
  assert.ok(chosen.black>chosen.white,'black is now on the bottom for human black player');
  await page.waitForFunction(()=>document.querySelector('#move-count')?.textContent!=='Ruch 0');
  await page.waitForFunction(()=>document.getElementById('history-count')?.textContent==='1'&&
   document.getElementById('board')?.dataset.checkersTurn==='2');
  assert.equal(await page.locator('#board').getAttribute('data-checkers-human-side'),'2',
   'computer has completed the first legal white move and it is now the black player turn');
  await page.waitForFunction(()=>document.getElementById('clock-1')?.textContent!=='07:00',null,{timeout:7000});
  // Regression: the previous test clicked 49→40, which is blocked by a
  // black pawn already occupying 40. It therefore passed without a move.
  assert.equal(await page.locator('#board .square[data-index="33"] .piece').count(),0,
   'the actual black destination must be empty before the move');
  assert.equal(await page.locator('#turn-label').textContent(),'Twój ruch',
   'after the white AI opener it is the black human player turn');
  assert.match(await page.locator('#board-help').textContent(),/grasz czarnymi pionkami/);
  await page.locator('#board .square[data-index="40"] .piece.black').click();
  await page.locator('#board .square[data-index="33"]').click();
  await page.waitForFunction(()=>!!document.querySelector('#board .square[data-index="33"] .piece.black')&&
   !document.querySelector('#board .square[data-index="40"] .piece'));
  await page.waitForFunction(()=>Number(document.getElementById('history-count')?.textContent)>=2);
  // Observe the black move and subsequent AI reply before opening the
  // history preview; otherwise a new live move can close the preview.
  await page.waitForFunction(()=>document.getElementById('turn-label')?.textContent==='Twój ruch'&&
   Number(document.getElementById('history-count')?.textContent)>=3);
  await page.locator('#history-tab').click();
  await page.locator('#moves-panel').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelectorAll('#moves-list .checkers-history-move').length>=3);
  const blackEntry=page.locator('#moves-list .checkers-history-move').nth(1);
  assert.match(await blackEntry.getAttribute('aria-label'),/Czarne/,
   'second recorded move is a real black move, not an existing pawn');
  await blackEntry.click();
  await page.locator('.checkers-replay-board').waitFor({state:'visible'});
  assert.match(await page.locator('.checkers-history-nav-status').textContent(),/Pozycja 2/,
   'history replay shows the position after the actual black move');
  assert.deepEqual(errors,[]);
  await context.close();
 }
});

test('Small signed-in nickname sits below the unchanged clock boxes on desktop and mobile',{timeout:90000},async t=>{
 const {base}=await serverFor(t,{nickname:'ZalogowanyGracz'});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const mobile=viewport.width<=800;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#white-name')?.closest('.player')?.querySelector('.cc-side')?.textContent==='ZalogowanyGracz');
  const info=await page.evaluate(()=>{
   const card=id=>document.getElementById(id)?.closest('.player');
   const black=card('black-name'),white=card('white-name');
   const clock=black.querySelector('.player-clock');
   const name=black.querySelector('.cc-side'),other=white.querySelector('.cc-side');
   const st=getComputedStyle(clock),ns=getComputedStyle(name);
   return {
    labels:[name.textContent,other.textContent],
    order:clock.parentElement.nextElementSibling===name&&white.querySelector('.player-clock').parentElement.nextElementSibling===other,
    fontSize:parseFloat(st.fontSize),labelSize:parseFloat(ns.fontSize),labelColor:ns.color,
    pawns:[black.querySelector('.checkers-turn-token')?.className,white.querySelector('.checkers-turn-token')?.className],
    pawnIcons:[black.querySelector('.checkers-turn-token'),white.querySelector('.checkers-turn-token')].map(el=>{
     const css=getComputedStyle(el),r=el.getBoundingClientRect();
     return {width:r.width,height:r.height,borderWidth:css.borderTopWidth,
      outlineWidth:css.outlineWidth,outline:css.outlineColor,
      leftOfClock:r.right<el.parentElement.querySelector('.player-clock').getBoundingClientRect().left};
    }),
    clockWidth:parseFloat(st.width),clockHeight:parseFloat(st.minHeight),
    playerWidth:black.getBoundingClientRect().width,
    docWidth:document.documentElement.scrollWidth,viewportWidth:document.documentElement.clientWidth
   };
  });
  assert.deepEqual(info.labels,['Komputer','ZalogowanyGracz'],'real signed-in nickname, not placeholder');
  assert.equal(info.order,true,'name is immediately after the clock in each existing player box');
  assert.ok(info.pawns[0].includes('black')&&info.pawns[1].includes('white'),'correct colours: black computer / white signed-in player');
  assert.ok(!info.pawns[0].includes('is-turn')&&!info.pawns[1].includes('is-turn'),
   'no active turn ring before taking a seat');
  await takeSeat(page);
  assert.equal(await page.locator('.checkers-turn-token.white.is-turn').count(),1,
   'after seating white is next to move, without starting clock');
  for(const icon of info.pawnIcons){
   assert.equal(icon.width,15);assert.equal(icon.height,15);
   assert.equal(icon.borderWidth,'1px','thin pawn border');
   assert.equal(icon.outlineWidth,'3px','highlight ring thicker without resizing the clock token');
   assert.equal(icon.leftOfClock,true,'pawn left of clock without changing its box');
  }
  assert.equal(info.labelSize,11,'compact name text');
  assert.equal(info.labelColor,'rgb(10, 58, 61)','dark readable clock labels on the pale chess-style panel');
  assert.ok(info.fontSize>=21&&info.fontSize<=27,'clock digits are slightly smaller');
  const originalWidth=Math.min(99,Math.max(75.9,viewport.width*.066));
  const originalHeight=Math.min(33.5,Math.max(26.15,viewport.width*.021+2));
  assert.ok(Math.abs(info.clockWidth-originalWidth)<2,'original clock width is retained');
  assert.ok(Math.abs(info.clockHeight-originalHeight)<2,'original clock height is retained');
  assert.ok(info.docWidth<=info.viewportWidth+2,'names do not introduce horizontal overflow');
  assert.deepEqual(errors,[],'no browser JavaScript errors');
  await context.close();
 }
});

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
  await takeSeat(page);
  await page.locator('#board .square[data-index="17"]').click();
  await page.locator('#board .square[data-index="24"]').click();
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
  assert.equal(await page.locator('#clock-1').isVisible(),true,'untimed game keeps black clock visible');
  assert.equal(await page.locator('#clock-2').isVisible(),true,'untimed game keeps white clock visible');
  assert.equal(await page.locator('#clock-1').textContent(),'--:--','untimed black clock shows no fake time');
  assert.equal(await page.locator('#clock-2').textContent(),'--:--','untimed white clock shows no fake time');
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
   const first=page.locator('#board .square[data-index="17"]'),dest=page.locator('#board .square[data-index="24"]');
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
   await takeSeat(page);
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
 await takeSeat(page);
 await page.locator('#board .square[data-index="17"]').locator('.piece').click();
 await page.locator('#board .square[data-index="24"]').click();
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
 await page.locator('#board .square[data-index="17"]').locator('.piece').click();
 await page.locator('#board .square[data-index="24"]').click();
 await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0',{timeout:10000});
 assert.deepEqual(errors,[]);
});

test('Owner parity: exact chess desktop/mobile background, coordinates, move history and mobile topbar',{timeout:120000},async t=>{
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
  assert.deepEqual(labels,{first:'1',last:'a',pointer:'none'},'white pawns shown at bottom change visible coordinate order');
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
  const expectedChess='rgb(0, 37, 41)';
  assert.equal(visuals.root,expectedChess,'document root matches Szachy');
  assert.equal(visuals.body,expectedChess,'body matches Szachy');
  assert.equal(visuals.boardarea,expectedChess,'board surroundings match Szachy');
  assert.equal(visuals.game,expectedChess,'game canvas matches Szachy');
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
  await takeSeat(page);
  await page.locator('#board .square[data-index="17"]').locator('.piece').click();
  await page.locator('#board .square[data-index="24"]').click();
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0');
  // Wait for the computer's immediate reply. A new live move legitimately
  // resets a historical preview; do not race that state transition.
  await page.waitForFunction(()=>document.getElementById('turn-label')?.textContent==='Twój ruch'&&
    Number(document.getElementById('history-count')?.textContent)>=2,{timeout:18000});
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
  await page.waitForFunction(()=>document.getElementById('board')?.dataset.checkersRotated==='false');
  const flipped=await page.locator('#board .square').first().locator('.checkers-coordinate-rank').textContent();
  assert.equal(flipped,'8','rank labels follow the manual flip back from white-bottom view');
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
 await takeSeat(page);
 await page.locator('#board .square[data-index="17"]').locator('.piece').click();
 await page.locator('#board .square[data-index="24"]').click();
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
    const touchCaptured=await page.evaluate(from=>{
     const probe=window.__checkersPointerProbe||[];
     const down=[...probe].reverse().find(item=>item.type==='pointerdown');
     return !!down&&!!document.querySelector('#board .square[data-index="'+from+'"]')?.hasPointerCapture(down.pointerId);
    },from);
    assert.equal(touchCaptured,true,'touch capture begins on the source square, before movement');
    for(let n=1;n<=8;n++){
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',
      touchPoints:[{x:x+(u-x)*n/8,y:y+(v-y)*n/8,id:1}]});
    }
    const touchGhost=await page.evaluate(()=>{
     const node=document.querySelector('.checkers-drag-ghost');
     return node?{background:getComputedStyle(node).backgroundImage,
      sourceOpacity:getComputedStyle(document.querySelector('#board .square.checkers-drag-source .piece')).opacity}:null;
    });
    assert.ok(touchGhost&&touchGhost.background!=='none','visible skinned pawn follows touch');
    assert.equal(touchGhost.sourceOpacity,'0','stationary source is hidden during touch drag');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
   }else{
    await page.mouse.move(x,y);await page.mouse.down();
    const mouseCaptured=await page.evaluate(from=>{
     const probe=window.__checkersPointerProbe||[];
     const down=[...probe].reverse().find(item=>item.type==='pointerdown');
     return !!down&&!!document.querySelector('#board .square[data-index="'+from+'"]')?.hasPointerCapture(down.pointerId);
    },from);
    assert.equal(mouseCaptured,true,'mouse capture begins on the source square, before movement');
    await page.mouse.move(u,v,{steps:12});await page.mouse.up();
   }
  };
  await page.goto(base+'/konto/warcaby/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#board .piece.white').length===12);
  await takeSeat(page);
  await page.evaluate(()=>{
   window.__checkersPointerProbe=[];
   const target=document.getElementById('board');
   for(const type of ['pointerdown','pointermove','pointerup','lostpointercapture','click']){
    target.addEventListener(type,e=>{
     const a=window.__checkersPointerProbe;if(a.length>70)return;
     const at=document.elementFromPoint(e.clientX??0,e.clientY??0);
     a.push({type,pointerId:e.pointerId,from:e.target?.className?.baseVal||e.target?.className,
      physical:at?.closest?.('.square[data-index]')?.dataset.index||null,
      ghost:document.querySelectorAll('.checkers-drag-ghost').length,
      targets:document.querySelectorAll('.checkers-drag-target').length});
    },true);
   }
  });
  assert.equal(await page.locator('#board .square[data-index="17"] .piece').count(),1);
  // Clicking a pawn must NOT leave a yellow square border; valid moves still
  // show their original small dots. Click-to-select must still work.
  await page.locator('#board .square[data-index="17"]').click();
  const selected=await page.evaluate(()=>{
   const square=document.querySelector('#board .square[data-index="17"]');
   return {selected:square.classList.contains('selected'),shadow:getComputedStyle(square).boxShadow,
    possible:document.querySelectorAll('#board .square.possible').length,
    dot:getComputedStyle(document.querySelector('#board .square.possible'),'::before').content};
  });
  assert.equal(selected.selected,true,'click still selects the pawn');
  assert.equal(selected.shadow,'none','no yellow selection frame');
  assert.ok(selected.possible>0,'legal targets remain visible');
  assert.notEqual(selected.dot,'none','small target dots remain');
  if(!mobile){
   // The ghost must use viewport coordinates, not a transformed board's origin.
   const box=await page.locator('#board .square[data-index="17"] .piece').boundingBox();
   const x=box.x+box.width/2,y=box.y+box.height/2;
   await page.mouse.move(x,y);await page.mouse.down();
   await page.mouse.move(x+28,y+24,{steps:5});
   const ghost=await page.evaluate(()=>{
    const el=document.querySelector('.checkers-drag-ghost');
    if(!el)return null;const r=el.getBoundingClientRect();
    const css=getComputedStyle(el),rim=getComputedStyle(el,'::before');
    const source=document.querySelector('#board .square[data-index="17"] .piece');
    return {onBody:el.parentElement===document.body,x:r.x+r.width/2,y:r.y+r.height/2,
     background:css.backgroundImage,shadow:css.boxShadow,edge:rim.backgroundImage,
     sourceOpacity:getComputedStyle(source).opacity};

   });
   assert.ok(ghost?.onBody,'ghost is mounted in viewport layer');
   assert.notEqual(ghost.background,'none','dragged pawn preserves metal skin rather than invisible blank clone');
   assert.notEqual(ghost.shadow,'none','dragged pawn retains premium shadow');
   assert.notEqual(ghost.edge,'none','dragged pawn keeps its inner face');
   assert.equal(ghost.sourceOpacity,'0','original pawn is hidden during drag');
   assert.ok(Math.abs(ghost.x-(x+28))<3&&Math.abs(ghost.y-(y+24))<3,'ghost tracks mouse position');
   await page.mouse.up();
   assert.equal(await page.locator('.checkers-drag-ghost').count(),0,'ghost always removed on release');
   // Move completely outside the board with ONE pointermove frame. Capture
   // must retain pointerup and snap back instead of leaving a stuck ghost.
   const bb=await page.locator('#board').boundingBox();
   await page.mouse.move(x,y);await page.mouse.down();
   await page.mouse.move(Math.min(viewport.width-15,bb.x+bb.width+22),y,{steps:1});
   await page.mouse.up();
   assert.equal(await page.locator('.checkers-drag-ghost').count(),0,'outside-board fast release cleans ghost');
   assert.equal(await page.locator('#move-count').textContent(),'Ruch 0','outside-board drop never moves');
  }
  await drag(17,19); // Illegal sideways drag, source must snap back.
  assert.equal(await page.locator('#move-count').textContent(),'Ruch 0');
  assert.equal(await page.locator('#board .square[data-index="17"] .piece').count(),1);
  assert.equal(await page.locator('.checkers-drag-ghost').count(),0);
  await drag(17,24); // Real legal white opening.
  try{
   await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0',{timeout:6500});
  }catch(err){
   const snapshot=await page.evaluate(()=>({
    state:document.getElementById('move-count')?.textContent,
    status:document.getElementById('game-state')?.textContent,
    notices:document.getElementById('checkers-capture-notice')?.hidden,
    start:document.querySelector('#board .square[data-index="17"]')?.className,
    target:document.querySelector('#board .square[data-index="24"]')?.className,
    ghostCount:document.querySelectorAll('.checkers-drag-ghost').length,
    highlighted:document.querySelectorAll('#board .square.possible').length,
    pointerProbe:window.__checkersPointerProbe
   }));
   throw Error('Legal mouse/touch drag failed: '+JSON.stringify({viewport,snapshot,errors}));
  }
  assert.ok(Number(await page.locator('#history-count').textContent())>=1);
  assert.equal(await page.locator('.checkers-drag-ghost').count(),0);
  assert.equal(await page.locator('#board .square').count(),64);
  await page.locator('#restart').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent==='Ruch 0');
  await takeSeat(page);
  await page.locator('#board .square[data-index="17"]').click();
  await page.locator('#board .square[data-index="24"]').click();
  await page.waitForFunction(()=>document.getElementById('move-count')?.textContent!=='Ruch 0');
  assert.deepEqual(errors,[]);
  await context.close();
 }
});

test('Remis action sits below Cofnij and requests a two-player draw, never a unilateral result',{timeout:65000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const id='12345678-1234-4234-8234-1234567890ab';
 const board=Array(64).fill(0);board[17]=1;board[26]=2;
 let match={id,game:'warcaby',version:10,player:1,
  players:['Zalogowany','Rywal'],playable:true,
  state:{board,turn:1,winner:0,forced:null,moves:2,quiet:0,history:[]}};
 const calls=[];
 await page.route('**/auth/match?*',route=>route.fulfill({json:{ok:true,match}}));
 await page.route('**/auth/match',route=>{
  const payload=route.request().postDataJSON();calls.push(payload);
  if(payload.version!==match.version)return route.fulfill({status:409,json:{ok:false,error:'ODSWIEZ_PARTIE'}});
  let next={...match.state};
  if(payload.action==='offerDraw')next.drawOffer={id:'draw-1',requester:match.player};
  if(payload.action==='rejectDraw')delete next.drawOffer;
  if(payload.action==='acceptDraw'){delete next.drawOffer;next.winner=3;}
  match={...match,version:match.version+1,state:next};
  return route.fulfill({json:{ok:true,match}});
 });
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(base+'/konto/warcaby/?match='+id,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#checkers-offer-draw')?.title==='Zaproponuj remis przeciwnikowi');
 const positions=await page.evaluate(()=>{
  const actions=document.querySelector('.chess-reference-actions');
  return {children:actions?.children.length,stack:actions?.lastElementChild?.className,
   names:[...actions?.lastElementChild?.querySelectorAll('button')||[]].map(b=>b.textContent.trim())};
 });
 assert.equal(positions.children,4,'four existing action columns are preserved');
 assert.match(positions.stack,/checkers-undo-draw/);
 assert.deepEqual(positions.names,['Cofnij','Remis']);
 await page.locator('#checkers-offer-draw').click();
 await page.waitForFunction(()=>document.querySelector('.checkers-draw-text')?.textContent.includes('Czekamy'));
 assert.equal(match.state.winner,0,'offering a draw does not end the game');
 assert.equal(calls.at(-1).action,'offerDraw');
 assert.equal(calls.at(-1).version,10);
 assert.equal(calls.at(-1).id,id);
 match={...match,player:2,version:match.version+1};
 await page.evaluate(()=>window.dispatchEvent(new Event('gracz:warcaby:refresh-requested')));
 await page.waitForFunction(()=>!document.querySelector('.checkers-draw-banner').hidden&&
  document.querySelector('.checkers-draw-text')?.textContent.includes('Przeciwnik'));
 await page.getByRole('button',{name:'Przyjmij'}).click();
 await page.waitForFunction(()=>document.querySelector('#session-heading')?.textContent.includes('Remis'));
 assert.equal(match.state.winner,3,'two-party acceptance ends as server-reported draw');
 assert.equal(calls.at(-1).action,'acceptDraw');
 assert.equal(calls.at(-1).offerId,'draw-1');
});


test('P0: mandatory capture warns on wrong pawn, pulses red and keeps illegal moves blocked',{timeout:65000},async t=>{
 const {base}=await serverFor(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const id='12345678-1234-4234-8234-1234567890ab',board=Array(64).fill(0);
 board[17]=1;board[21]=1;board[26]=2; // Only 17 can capture, exactly once: 17->35.
 let match={id,game:'warcaby',version:10,player:1,players:['Ty','Rywal'],playable:true,
  state:{board,turn:1,winner:0,forced:null,moves:3,quiet:0,history:[]}};
 const calls=[];
 await page.route('**/auth/match?*',route=>route.fulfill({json:{ok:true,match}}));
 await page.route('**/auth/match',route=>{
  const payload=route.request().postDataJSON(),move=payload?.move;
  calls.push(move);
  if(move?.from!==17||move?.to!==35)return route.fulfill({status:400,json:{ok:false,error:'ILLEGAL_MOVE'}});
  const next=match.state.board.slice();next[17]=0;next[26]=0;next[35]=1;
  match={...match,version:11,state:{...match.state,board:next,turn:2,moves:4,
   history:[{player:1,from:17,to:35}]}};
  return route.fulfill({json:{ok:true,match}});
 });
 await page.goto(base+'/konto/warcaby/?match='+id,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#board .square[data-index="17"].capture-source')&&
   document.querySelector('#board')?.dataset.checkersPlayable==='true');
 const notice=page.locator('#checkers-capture-notice');
 assert.equal(await notice.isVisible(),false,'single capture is initially quiet before hovering');
 await page.locator('#board .square[data-index="17"] .piece').evaluate(el=>
   el.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'})));
 assert.equal(await notice.isVisible(),false,'hover on correct capturing pawn is silent');
 await page.locator('#board .square[data-index="21"] .piece').evaluate(el=>
   el.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'})));
 await notice.waitFor({state:'visible'});
 assert.match(await notice.textContent(),/Bicie obowiązkowe/,'hovering wrong own pawn warns');
 assert.match(await notice.textContent(),/Ten pionek musi bić/);
 assert.equal(await page.locator('#board .square[data-index="17"] .piece.capture-alert').count(),1,
  'capturing pawn becomes red after warning');
 await page.locator('#checkers-capture-dismiss').click();
 await page.locator('#board .square[data-index="21"]').evaluate(el=>
  el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',button:0,pointerId:12,isPrimary:true})));
 await notice.waitFor({state:'visible'});
 assert.deepEqual(calls,[],'another pawn cannot bypass mandatory capture');
 await page.locator('#checkers-capture-dismiss').click();
 await page.locator('#board .square[data-index="17"]').evaluate(el=>el.click());
 assert.equal(await notice.isVisible(),false,'correct pawn selection is silent');
 await page.locator('#board .square[data-index="24"]').evaluate(el=>el.click());
 assert.equal(await notice.isVisible(),false,'illegal empty-square click does not warn');
 assert.deepEqual(calls,[],'invalid click must not reach online API');
 // Empty-square attempts stay silent; no duplicate warning is expected.
 const drag=async(from,to)=>{
  const a=await page.locator('#board .square[data-index="'+from+'"] .piece').boundingBox();
  const b=await page.locator('#board .square[data-index="'+to+'"]').boundingBox();
  assert.ok(a&&b);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();
 };
 await drag(17,24);
 assert.equal(await notice.isVisible(),false,'illegal drop to empty square is silent');
 assert.deepEqual(calls,[],'illegal drag snaps back without reaching API');
 await drag(17,35);
 await page.waitForFunction(()=>document.querySelector('#board .square[data-index="35"] .piece.white')&&
  document.getElementById('move-count')?.textContent==='Ruch 4');
 assert.deepEqual(calls,[{from:17,to:35}],'only real legal capture is sent to server');
 assert.equal(await notice.isVisible(),false,'notice clears after capture');
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
 assert.equal(await page.locator('.checkers-turn-token.white.is-turn').count(),1,'forced multi-capture keeps white turn ring');
 assert.deepEqual(calls,[[17,35]],'first capture accepted through original server API');
 await drag(35,53);
 try{
  await page.waitForFunction(()=>document.querySelector('#board .square[data-index="53"] .piece.white')&&
   document.getElementById('move-count')?.textContent==='Ruch 2',{timeout:7000});
 }catch(err){
  const debug=await page.evaluate(()=>({
   count:document.getElementById('move-count')?.textContent,
   forced:[...document.querySelectorAll('#board .must-continue')].map(e=>e.dataset.index),
   status:document.getElementById('game-state')?.textContent,
   target53:document.querySelector('#board .square[data-index="53"]')?.className,
   notice:document.getElementById('checkers-capture-notice')?.hidden
  }));
  throw Error('Forced follow-on capture failed: '+JSON.stringify({calls,debug}));
 }
 assert.deepEqual(calls,[[17,35],[35,53]],'second mandatory capture also via original API');
 await page.waitForFunction(()=>document.querySelectorAll('.checkers-turn-token.black.is-turn').length===1);
 assert.equal(await page.locator('.checkers-turn-token.white.is-turn').count(),0,'turn outline moves to black after final capture');
 assert.equal(await page.locator('.checkers-drag-ghost').count(),0);
});

// Real renderer acceptance without production accounts or external services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {mkdir} from 'node:fs/promises';
import {readChessLayout} from '../console-layout-agent/chess-contract.mjs';

async function inspectPieces(page,count=32){
 const pieces=await page.locator('#board .chess-piece').evaluateAll(nodes=>nodes.map(svg=>{
  const box=svg.getBoundingClientRect(),cell=svg.parentElement.getBoundingClientRect(),body=svg.querySelector('[data-body]');
  const b=body.getBBox(),paint=getComputedStyle(body);
  return {piece:svg.dataset.piece,color:svg.dataset.color,inside:box.left>=cell.left&&box.top>=cell.top&&box.right<=cell.right&&box.bottom<=cell.bottom,
   centered:Math.abs((box.left+box.right)-(cell.left+cell.right))<1&&Math.abs((box.top+box.bottom)-(cell.top+cell.bottom))<1,
   unclipped:b.x>2&&b.y>2&&b.x+b.width<94&&b.y+b.height<94,
   opaque:paint.fillOpacity==='1'&&paint.opacity==='1'&&paint.fill!=='none',label:svg.parentElement.getAttribute('aria-label')};
 }));
 assert.equal(pieces.length,count);
 for(const p of pieces){assert.ok(p.inside&&p.centered&&p.unclipped&&p.opaque,JSON.stringify(p));assert.match(p.label,/^[a-h][1-8] (biały|biała|czarny|czarna) /);}
 const ids=await page.locator('svg.chess-piece linearGradient').evaluateAll(nodes=>nodes.map(n=>n.id));
 assert.equal(new Set(ids).size,ids.length,'no duplicate paint IDs after redraws');
}
async function snapshot(page,name){
 if(!process.env.CHESS_SCREENSHOT_DIR)return;
 await mkdir(process.env.CHESS_SCREENSHOT_DIR,{recursive:true});
 await page.screenshot({path:process.env.CHESS_SCREENSHOT_DIR+'/'+name+'.png',fullPage:true});
}

test('premium SVGs fit desktop/mobile/HiDPI, lobby, keyboard moves, capture and fullscreen', {timeout:60000},async t=>{
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveChessConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,items:[],friends:[],challenges:[]}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 for(const viewport of [{width:1600,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:2,isMobile:viewport.width<800,hasTouch:viewport.width<800});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  // Real inbox API contract: count unread from active (not archived) friend conversations.
  let unread=4;
  await page.route('**/auth/message-center',route=>route.fulfill({
   status:200,contentType:'application/json',
   body:JSON.stringify({ok:true,conversations:[{nickname:'Zawodnik',unread,archived:false},
     {nickname:'Archiwum',unread:7,archived:true}]})
  }));
  await page.goto(base+'/konto/szachy/');await page.locator('.chess-piece').first().waitFor();
  // CHESS-CONSOLE-OWNER-P1: one envelope + profile in the console's top row on every viewport.
  const badge=page.locator('.side-dock .cc-top .cc-mail-badge');
  await badge.waitFor({state:'visible'});
  assert.equal(await badge.textContent(),'4','red badge uses live unread count, not a hardcoded number');
  assert.equal(await page.locator('.side-dock .cc-mail').getAttribute('href'),'/konto/panel/?sekcja=messages');
  assert.equal(await page.locator('.side-dock .cc-profile').getAttribute('href'),'/konto/panel/?sekcja=profile');
  assert.equal(await page.locator('.cc-mail:visible').count(),1,'exactly one envelope entry point');
  assert.equal(await page.locator('.chess-mobile-mode-symbol').count(),2);
  if(viewport.width<800){
   assert.equal(await page.locator('.chess-mobile-brand-link').textContent(),'GRACZ.PL');
   assert.equal(await page.locator('.chess-mobile-game-name').textContent(),'Szachy');
   assert.equal(await page.locator('.chess-mobile-topbar .chess-mobile-mail-link').count(),0,'no second envelope in the phone header');
   const boxes=await page.evaluate(()=>{
    const rect=q=>{const r=document.querySelector(q).getBoundingClientRect();return {top:r.top,bottom:r.bottom}};
    return [rect('.chess-mobile-topbar'),rect('#board'),rect('.side-dock .cc-top'),rect('.side-dock .mode')];
   });
   for(let i=0;i<boxes.length-1;i++)assert.ok(boxes[i].bottom<=boxes[i+1].top+2,'mobile header, board, clocks row and modes are ordered');
   assert.equal(await page.locator('.chess-mobile-menu-panel').isVisible(),false,'menu starts closed');
   await page.locator('.chess-mobile-menu-toggle').click();
   assert.equal(await page.locator('.chess-mobile-menu-panel a:visible').count(),4);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.chess-mobile-menu').evaluate(el=>el.open),false);
  }
  unread=0;
  // Returning from the inbox (back/forward cache) re-reads the real count.
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await badge.waitFor({state:'hidden'});
  assert.equal(await badge.textContent(),'','zero unread messages must not show a red counter');
  // The owner's approved minimal design has neither decorative arc nor gold panel rail.
  const decoration=await page.locator('.boardarea').evaluate(el=>{
   const arc=getComputedStyle(el,'::after');
   const frame=getComputedStyle(document.querySelector('.side-dock'));
   return {arcContent:arc.content,arcDisplay:arc.display,frameBorderWidth:frame.borderTopWidth};
  });
  assert.ok(decoration.arcContent==='none'||decoration.arcDisplay==='none',
   'stray golden curved arc still visible: '+JSON.stringify(decoration));
  assert.equal(decoration.frameBorderWidth,'0px','owner-approved right panel has no border');
  await inspectPieces(page);
  assert.deepEqual((await readChessLayout(page)).issues,[],'approved chess layout contract');
  // "Ruchy" must never show the chat/AI welcome text or composer below moves.
  const panelBefore=await page.locator('#match-panel').boundingBox();
  await page.locator('#history-tab').click();
  assert.equal(await page.locator('#match-panel').evaluate(el=>el.classList.contains('moves-only')),true);
  assert.equal(await page.locator('.mini-chat').isVisible(),false);
  assert.equal(await page.locator('#chat-panel').isVisible(),false);
  assert.equal(await page.locator('#moves-panel').isVisible(),true);
  const historyBounds=await page.locator('#moves-list').evaluate(el=>{
   const dock=el.closest('#match-panel');
   const nav=dock.querySelector('.chess-history-nav');
   return {height:el.getBoundingClientRect().height,
    navHeight:nav?.getBoundingClientRect().height||0,
    gap:dock.getBoundingClientRect().bottom-(nav||el).getBoundingClientRect().bottom};
  });
  assert.ok(historyBounds.height>100&&historyBounds.navHeight>=30&&historyBounds.gap<24,
   'Moves and navigation should fill dock to bottom: '+JSON.stringify(historyBounds));
  // Prove that the new chess-specific gate still rejects the original 26px bug.
  const savedStyle=await page.locator('#moves-list').getAttribute('style');
  await page.locator('#moves-list').evaluate(el=>{
   for(const [key,value] of Object.entries({height:'26px','max-height':'26px',flex:'none'}))el.style.setProperty(key,value,'important');
  });
  assert.ok((await readChessLayout(page)).issues.includes('historia ruchów zwinięta do jednego wiersza'));
  await page.locator('#moves-list').evaluate((el,style)=>style===null?el.removeAttribute('style'):el.setAttribute('style',style),savedStyle);
  assert.deepEqual((await readChessLayout(page)).issues,[]);
  const panelHistory=await page.locator('#match-panel').boundingBox();
  assert.ok(Math.abs(panelBefore.height-panelHistory.height)<2,'switching tabs must preserve panel height');
  // A long history scrolls inside the same allocation on desktop AND mobile.
  const longHistory=await page.locator('#moves-list').evaluate(el=>{
   const saved=[...el.childNodes];
   for(let i=0;i<80;i++){const row=document.createElement('div');row.className='chess-move-row';row.textContent=(i+1)+'. e4 e5';el.append(row);}
   el.scrollTop=el.scrollHeight;
   const result={height:el.getBoundingClientRect().height,scrolls:el.scrollHeight>el.clientHeight&&el.scrollTop>0};
   el.replaceChildren(...saved);return result;
  });
  assert.ok(longHistory.scrolls&&Math.abs(longHistory.height-historyBounds.height)<2,'long history must scroll without resizing the console');
  await page.locator('#chat-tab').click();
  assert.equal(await page.locator('#match-panel').evaluate(el=>el.classList.contains('moves-only')),false);
  assert.equal(await page.locator('.mini-chat').isVisible(),true);
  assert.equal(new Set(await page.locator('.chess-piece').evaluateAll(nodes=>nodes.map(n=>n.dataset.piece))).size,12);
  await snapshot(page,'premium-'+viewport.width);
  const initial=await page.locator('#board .chess-piece').evaluateAll(nodes=>nodes.map(n=>n.dataset.piece));
  await page.locator('.chess-reference-invite').click();
  await page.locator('#chess-invite-overlay').waitFor({state:'visible'});
  await page.locator('#chess-invite-close').click();
  await page.locator('#online-mode').click();await inspectPieces(page);
  // On mobile the mode switch is moved above the board; all three Online actions must stay visible.
  await page.waitForFunction(()=>document.querySelector('.chess-owner-online-new')?.hidden===false);
  assert.equal(await page.locator('.chess-owner-online-new').isVisible(),true,'Online New game should work on desktop and mobile');
  assert.equal(await page.locator('.chess-reference-actions button:visible').count(),3,'Online keeps three owner-approved actions');
  assert.equal(await page.locator('.chess-square:enabled').count(),0);
  assert.deepEqual(await page.locator('#board .chess-piece').evaluateAll(nodes=>nodes.map(n=>n.dataset.piece)),initial);
  await page.locator('#training-mode').click();
  await page.locator('#chess-opponent').evaluate(el=>{el.value='human';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const square=label=>page.getByRole('gridcell',{name:label,exact:true});
  // Native keyboard activation uses the same cells and labels as pointer moves.
  await square('e2 biały pionek').focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('.chess-selected').getAttribute('aria-label'),'e2 biały pionek');
  assert.equal(await page.locator('.chess-target').count(),2);
  await square('e4 puste').focus();await page.keyboard.press('Enter');
  assert.equal(await square('e4 biały pionek').locator('svg').getAttribute('data-piece'),'P');
  assert.equal(await square('e2 puste').locator('svg').count(),0);
  await square('d7 czarny pionek').click();await square('d5 puste').click();
  await square('e4 biały pionek').click();
  assert.ok(await square('d5 czarny pionek').evaluate(n=>n.classList.contains('chess-target')));
  await snapshot(page,'capture-'+viewport.width);
  await square('d5 czarny pionek').click();await inspectPieces(page,31);
  assert.equal(await square('d5 biały pionek').locator('svg').getAttribute('data-piece'),'P');
  assert.equal(await page.locator('.chess-minimal-more').isVisible(),false,'extra settings removed from approved layout');
  await page.locator('#focus-game').evaluate(el=>el.click());await inspectPieces(page,31);
  for(const selector of ['#clock-1','#clock-2','.players .versus'])assert.equal(await page.locator(selector).isVisible(),true,selector+' must remain visible in focus mode');
  await page.locator('#focus-exit').click();
  await page.locator('#fullscreen-game').evaluate(el=>el.click());
  await page.waitForFunction(()=>!!document.fullscreenElement);await inspectPieces(page,31);
  await page.evaluate(()=>document.exitFullscreen());
  assert.deepEqual(errors,[]);
  await context.close();
 }
 const reversed=await browser.newPage({viewport:{width:1600,height:900}});
 await reversed.route('**/app.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  assert.ok(source.includes('orientation=false'));
  await route.fulfill({response,body:source.replace('orientation=false','orientation=true')});
 });
 await reversed.goto(base+'/konto/szachy/');await reversed.locator('.chess-piece').first().waitFor();
 assert.equal(await reversed.locator('.chess-square').first().getAttribute('aria-label'),'h1 biała wieża');
 assert.equal(await reversed.locator('.chess-square').last().getAttribute('aria-label'),'a8 czarna wieża');
 await inspectPieces(reversed);await reversed.close();
 // Render actual promotion choices for both colors and every legal promotion.
 for(const color of ['white','black'])for(const promotion of ['q','r','b','n']){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  page.setDefaultTimeout(8000);
  // Start this isolated promotion fixture in human mode before initialization,
  // so the computer cannot promote black's pawn while Playwright selects it.
  await page.route('**/app.js',async route=>{
   const response=await route.fetch(),source=await response.text();
   const hook="opponentSelect.addEventListener('change',()=>{updateOpponent();saveTrainingHistory();});";
   assert.ok(source.includes(hook));
   await route.fulfill({response,body:source.replace(hook,"opponentSelect.value='human';"+hook)});
  });
  const fen=color==='white'?'7k/P7/8/8/8/8/8/7K w - - 0 1':'7k/8/8/8/8/8/p7/7K b - - 0 1';
  await page.route('**/rules.mjs',async route=>{
   const response=await route.fetch();const body=(await response.text()).replace(/export const START_FEN='[^']+';/,"export const START_FEN='"+fen+"';");
   await route.fulfill({response,body});
  });
  await page.goto(base+'/konto/szachy/');await page.locator('#chess-opponent').evaluate(el=>{el.value='human';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const from=color==='white'?'a7 biały pionek':'a2 czarny pionek',to=color==='white'?'a8':'a1';
  await page.getByRole('gridcell',{name:from,exact:true}).click();
  await page.getByRole('gridcell',{name:to+' puste',exact:true}).click();
  assert.equal(await page.locator('.chess-promote svg').count(),4);
  const choices=await page.locator('.chess-promote').evaluateAll(buttons=>buttons.map(b=>{
   const r=b.getBoundingClientRect(),s=b.querySelector('svg').getBoundingClientRect();
   return {color:b.querySelector('svg').dataset.color,visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&s.left>=r.left&&s.right<=r.right,label:b.getAttribute('aria-label')};
  }));
  assert.ok(choices.every(c=>c.visible&&c.color===color&&c.label.startsWith('Promocja na ')),JSON.stringify(choices));
  const piece=color==='white'?promotion.toUpperCase():promotion;
  await page.locator('.chess-promote').filter({has:page.locator('svg[data-piece="'+piece+'"]')}).click();
  assert.equal(await page.locator('.chess-square[aria-label^="'+to+' "] svg').getAttribute('data-piece'),piece);
  assert.equal(await page.locator('.chess-promote').count(),0);
  await inspectPieces(page,3);
  await page.close();
 }
});


test('recorded local chess SAN remains visible and survives reload on desktop/mobile', {timeout:90000},async t=>{
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveChessConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,items:[],friends:[],challenges:[]}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const base='http://127.0.0.1:'+server.address().port;
 for(const width of [390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:width===390?844:900}});
  const page=await ctx.newPage();page.setDefaultTimeout(10000);
  await page.goto(base+'/konto/szachy/');
  await page.locator('.chess-piece').first().waitFor();
  await page.locator('#chess-opponent').evaluate(el=>{el.value='human';el.dispatchEvent(new Event('change',{bubbles:true}));});
  const square=label=>page.getByRole('gridcell',{name:label,exact:true});
  await square('e2 biały pionek').click();
  await square('e4 puste').click();
  // A recorded move should expose the history automatically, not leave Chat selected.
  await page.locator('#moves-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#history-tab').getAttribute('aria-selected'),'true');
  assert.deepEqual(await page.locator('.chess-history-columns span').allTextContents(),['Nr','Białe','Czarne']);
  assert.equal(await page.locator('#moves-list .chess-move-row').first().textContent(),'e4');
  await square('d7 czarny pionek').click();
  await square('d5 puste').click();
  assert.equal(await page.locator('#moves-panel').isVisible(),true);
  // The player can still open Chat manually without it being replaced by History.
  await page.locator('#chat-tab').click();
  assert.equal(await page.locator('#chat-panel').isVisible(),true);
  await page.locator('#chess-opponent').evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));
  assert.equal(await page.locator('#chat-panel').isVisible(),true);
  await page.locator('#history-tab').click();
  assert.equal(await page.locator('#moves-panel').isVisible(),true);
  assert.equal(await page.locator('#history-count').textContent(),'2');
  assert.deepEqual(await page.locator('#moves-list .chess-move-row').allTextContents(),['e4','d5']);
  // Select arbitrary plies; the real match must not be mutated.
  assert.equal(await page.locator('.chess-history-turn').count(),1);
  assert.equal(await page.locator('.chess-history-number').first().textContent(),'1.');
  await page.locator('.chess-move-row[data-ply="1"]').click();
  assert.equal(await page.locator('#board').getAttribute('data-review-ply'),'1');
  assert.equal(await square('e4 biały pionek').count(),1);
  assert.equal(await square('d7 czarny pionek').count(),1);
  assert.equal(await square('d5 puste').count(),1);
  assert.equal(await page.locator('.chess-square:enabled').count(),0);
  await page.locator('.chess-move-row[data-ply="2"]').click();
  assert.equal(await page.locator('#board').getAttribute('data-review-ply'),'2');
  assert.equal(await square('d5 czarny pionek').count(),1);
  assert.equal(await page.locator('.chess-move-row.chess-history-selected').getAttribute('data-ply'),'2');
  await page.locator('.chess-history-action[data-action="first"]').click();
  assert.equal(await page.locator('#board').getAttribute('data-review-ply'),'0');
  assert.equal(await square('e2 biały pionek').count(),1);
  await page.locator('.chess-history-action[data-action="next"]').click();
  assert.equal(await square('e4 biały pionek').count(),1);
  await page.locator('.chess-history-action[data-action="last"]').click();
  assert.equal(await square('d5 czarny pionek').count(),1);
  await page.locator('.chess-history-action[data-action="prev"]').click();
  assert.equal(await square('d7 czarny pionek').count(),1);
  await page.locator('.chess-history-action[data-action="live"]').click();
  assert.equal(await page.locator('#board').getAttribute('data-review-ply'),'live');
  assert.equal(await page.locator('.chess-square:enabled').count(),64);
  assert.equal(await page.locator('.chess-history-action[data-action="pgn"]').isEnabled(),true);
  // Regression: notation previously inherited white text on the pale cream panel.
  const contrast=await page.locator('#moves-list .chess-move-row').first().evaluate(el=>{
   const rgb=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
   const lum=color=>{
    const channels=rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
   };
   const a=lum(getComputedStyle(el).color);
   const b=lum(getComputedStyle(document.querySelector('#moves-list')).backgroundColor);
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  assert.ok(contrast>=4.5,'chess SAN text must be legible on the approved pale background: '+contrast);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('gracz-chess-training-history-v1')));
  assert.deepEqual(before.moves,['e2e4','d7d5']);
  await page.reload();await page.locator('.chess-piece').first().waitFor();
  await page.locator('#moves-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#history-tab').getAttribute('aria-selected'),'true','restored chess game opens move history by default');
  assert.equal(await square('e4 biały pionek').count(),1,'white move restored after reload');
  assert.equal(await square('d5 czarny pionek').count(),1,'black move restored after reload');
  await page.locator('#history-tab').click();
  assert.deepEqual(await page.locator('#moves-list .chess-move-row').allTextContents(),['e4','d5']);
  await page.locator('#restart').click();
  assert.equal(await page.locator('#history-count').textContent(),'0');
  assert.equal(await page.evaluate(()=>localStorage.getItem('gracz-chess-training-history-v1')),null);
  await ctx.close();
 }
});

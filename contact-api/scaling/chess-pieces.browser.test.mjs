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
  await page.goto(base+'/konto/szachy/');await page.locator('.chess-piece').first().waitFor();
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
   return {height:el.getBoundingClientRect().height,
    gap:dock.getBoundingClientRect().bottom-el.getBoundingClientRect().bottom};
  });
  assert.ok(historyBounds.height>100&&historyBounds.gap<24,
   'Moves should fill the dock to the bottom: '+JSON.stringify(historyBounds));
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
   const hook="opponentSelect.addEventListener('change',updateOpponent);";
   assert.ok(source.includes(hook));
   await route.fulfill({response,body:source.replace(hook,"opponentSelect.value='human';"+hook)});
  });
  const fen=color==='white'?'7k/P7/8/8/8/8/8/7K w - - 0 1':'7k/8/8/8/8/8/p7/7K b - - 0 1';
  await page.route('**/rules.mjs',async route=>{
   const response=await route.fetch();const body=(await response.text()).replace(/export const START_FEN='[^']+';/,"export const START_FEN='"+fen+"';");
   await route.fulfill({response,body});
  });
  await page.goto(base+'/konto/szachy/');await page.locator('#chess-opponent').selectOption('human');
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

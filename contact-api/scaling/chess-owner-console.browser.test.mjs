// CHESS-CONSOLE-OWNER-P1 (#814): the owner-approved right console in real Chromium.
// Every API is mocked locally (no accounts, no production data, no external services).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {serveChessConsole} from '../auth/chess-console.mjs';
import {serveGomokuConsole} from '../auth/gomoku-console.mjs';
import {initialChessMatch} from '../auth/chess-match.mjs';
import {readChessLayout} from '../console-layout-agent/chess-contract.mjs';

const PREF_KEY='gracz-chess-appearance-v1';
const MATCH='3f2c8a4e-6b1d-4c2a-9e7f-1a2b3c4d5e6f';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function startServer(t){
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(serveChessConsole(req,res,url)||serveGomokuConsole(req,res,url))return;
  if(url.pathname.startsWith('/konto/panel')){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><title>Panel</title><h1>Panel gracza</h1>');return;
  }
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({ok:true,items:[],friends:[],challenges:[]}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 return 'http://127.0.0.1:'+server.address().port;
}
async function launch(t){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(()=>browser.close());
 return browser;
}
async function snapshot(page,name){
 if(!process.env.CHESS_SCREENSHOT_DIR)return;
 await mkdir(process.env.CHESS_SCREENSHOT_DIR,{recursive:true});
 await page.screenshot({path:process.env.CHESS_SCREENSHOT_DIR+'/'+name+'.png',fullPage:true});
}
const inbox=(...unread)=>({status:200,body:{ok:true,conversations:unread.map((n,i)=>({nickname:'Gracz'+i,unread:n,archived:false}))
 .concat([{nickname:'Archiwum',unread:500,archived:true}])}});
async function until(check,message,ms=6000){
 const end=Date.now()+ms;
 while(Date.now()<end){if(await check())return;await sleep(25);}
 assert.fail(message);
}
const squareStyle=page=>page.evaluate(()=>{
 const cells=document.querySelectorAll('#board .chess-square');
 const light=cells[0],dark=cells[1];
 return {light:getComputedStyle(light).backgroundColor,dark:getComputedStyle(dark).backgroundColor,
  coordinate:getComputedStyle(light.querySelector('.chess-coordinate')).color};
});

test('envelope badge shows the real unread total (0, 1, 9, 99, 99+), keeps it on errors and hides it on 401',{timeout:90000},async t=>{
 const base=await startServer(t),browser=await launch(t);
 for(const viewport of [{width:1366,height:768},{width:375,height:667}]){
  const mobile=viewport.width<800;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));
  let reply=inbox(),fail=false,hits=0;
  await page.route('**/auth/message-center',route=>{
   hits++;
   return fail?route.abort('failed'):route.fulfill({status:reply.status,contentType:'application/json',body:JSON.stringify(reply.body)});
  });
  await page.goto(base+'/konto/szachy/');await page.locator('.chess-piece').first().waitFor();
  const mail=page.locator('.side-dock .cc-top .cc-mail'),badge=mail.locator('.cc-mail-badge');
  await page.waitForFunction(()=>document.querySelector('.cc-mail')?.dataset.unread==='0');
  assert.equal(await mail.isVisible(),true,'the envelope is always visible');
  assert.equal(await badge.isVisible(),false,'0 unread: no red counter');
  assert.equal(await mail.getAttribute('aria-label'),'Wiadomości — brak nieprzeczytanych');
  // Returning to the tab from the inbox (back/forward cache) re-reads the real count.
  const refresh=async()=>{
   const before=hits;
   await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
   await until(()=>hits>before,'the inbox must be requested');
   await sleep(150);
  };
  for(const [values,text] of [[[1],'1'],[[4,5],'9'],[[90,9],'99'],[[99,1],'99+'],[[250],'99+']]){
   reply=inbox(...values);await refresh();
   assert.equal(await badge.textContent(),text,'sum of non-archived unread for '+values.join('+'));
   assert.equal(await badge.isVisible(),true);
   const total=values.reduce((a,b)=>a+b,0);
   assert.match(await mail.getAttribute('aria-label'),new RegExp('^Wiadomości — '+total+' nieprzeczytan'));
  }
  assert.deepEqual((await readChessLayout(page)).issues,[],'99+ badge, envelope and clocks do not overlap');
  fail=true;await refresh();
  assert.equal(await badge.textContent(),'99+','a network error keeps the last verified count');
  fail=false;reply={status:500,body:{ok:false,error:'SYSTEM_NIEDOSTEPNY'}};await refresh();
  assert.equal(await badge.textContent(),'99+','a server error never shows an invented 0');
  reply={status:200,body:{ok:true,conversations:'nieprawidłowe'}};await refresh();
  assert.equal(await badge.textContent(),'99+','an invalid payload is ignored');
  reply={status:401,body:{ok:false,error:'BRAK_SESJI'}};await refresh();
  assert.equal(await badge.isVisible(),false,'401: no private data');
  assert.match(await mail.getAttribute('aria-label'),/zaloguj/);
  reply=inbox(3);await refresh();
  assert.equal(await badge.textContent(),'3');
  // After the player reads the messages, the next read resets the counter.
  reply=inbox(0);await refresh();
  assert.equal(await badge.isVisible(),false);
  assert.equal(await page.locator('.cc-mail:visible').count(),1,'one envelope entry point');
  assert.equal(await page.locator('.side-dock .cc-profile').getAttribute('href'),'/konto/panel/?sekcja=profile');
  await Promise.all([page.waitForURL('**/konto/panel/?sekcja=messages'),mobile?mail.tap():mail.click()]);
  assert.equal(new URL(page.url()).searchParams.get('sekcja'),'messages','the envelope opens the existing Messages section');
  assert.deepEqual(errors,[]);
  await context.close();
 }
});

test('unread polling is single, moderate (50 s) and paused while the tab is hidden',{timeout:60000},async t=>{
 const base=await startServer(t),browser=await launch(t);
 const context=await browser.newContext({viewport:{width:1366,height:768}});
 const page=await context.newPage();
 await page.clock.install();
 let hits=0;
 await page.route('**/auth/message-center',route=>{hits++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(inbox(2).body)});});
 await page.goto(base+'/konto/szachy/');
 await until(()=>hits===1,'one request on page load');
 await until(async()=>await page.evaluate(()=>document.querySelector('.cc-mail-badge')?.textContent)==='2','badge from the first read');
 await page.clock.runFor(45000);await sleep(200);
 assert.equal(hits,1,'no extra request before the interval');
 await page.clock.runFor(6000);
 await until(()=>hits===2,'one request per interval');
 await page.clock.runFor(1000);await sleep(200);
 assert.equal(hits,2,'no duplicated timers or listeners');
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
 await page.clock.runFor(160000);await sleep(200);
 assert.equal(hits,2,'no polling while the tab is hidden');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await until(()=>hits===3,'refresh when the tab becomes visible again');
 await context.close();
});

test('five configuration icons open their own function, persist validated choices and restore the original look',{timeout:120000},async t=>{
 const base=await startServer(t),browser=await launch(t);
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const mobile=viewport.width<800;
  const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/auth/message-center',route=>route.fulfill({status:401,contentType:'application/json',body:'{"ok":false,"error":"BRAK_SESJI"}'}));
  await page.goto(base+'/konto/szachy/');await page.locator('.chess-piece').first().waitFor();
  const press=locator=>mobile?locator.tap():locator.click();
  const tools=page.locator('.side-dock > .cc-tools > .cc-tool');
  assert.deepEqual(await tools.evaluateAll(nodes=>nodes.map(b=>[b.querySelector('.cc-tool-label').textContent,b.getAttribute('aria-label'),b.title])),[
   ['Ustawienia','Ustawienia gry','Ustawienia gry'],['Plansza','Plansza — wygląd szachownicy','Plansza — wygląd szachownicy'],
   ['Figury','Figury — wygląd figur','Figury — wygląd figur'],['Motyw','Motyw prawego panelu','Motyw prawego panelu'],
   ['Pełny ekran','Pełny ekran','Pełny ekran']]);
  assert.deepEqual((await readChessLayout(page)).issues,[],'owner console geometry contract');
  const original=await squareStyle(page);
  assert.deepEqual(original,{light:'rgb(227, 216, 189)',dark:'rgb(71, 155, 153)',coordinate:mobile?'rgb(30, 102, 101)':'rgb(38, 90, 85)'},'default board is exactly the original');
  for(const [kind,title,control] of [['settings','Ustawienia gry','#ai-level'],['board','Wygląd planszy','input[name="cc-board"]'],
   ['pieces','Wygląd figur','input[name="cc-pieces"]'],['theme','Motyw panelu','input[name="cc-theme"]']]){
   const tool=page.locator('.cc-tool[data-tool="'+kind+'"]'),sheet=page.locator('#cc-sheet-'+kind);
   await press(tool);
   await sheet.waitFor({state:'visible'});
   assert.equal(await sheet.locator('.cc-sheet-title').textContent(),title);
   assert.equal(await tool.getAttribute('aria-expanded'),'true');
   assert.equal(await page.locator('.cc-sheet:visible').count(),1,'each icon opens its own sheet, one at a time');
   assert.equal(await sheet.locator(control).first().isVisible(),true,kind+' shows its real controls');
   await page.keyboard.press('Escape');
   await sheet.waitFor({state:'hidden'});
   assert.equal(await tool.getAttribute('aria-expanded'),'false');
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.tool),kind,'Escape returns focus to the icon');
  }
  // Keyboard: Tab to "Plansza", Enter opens it, arrow keys pick a variant on the native radios.
  await page.locator('.cc-tool[data-tool="settings"]').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.tool),'board');
  await page.keyboard.press('Enter');
  await page.locator('#cc-sheet-board').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.activeElement?.value),'original','focus starts on the checked board variant');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('body').getAttribute('data-cc-board'),'walnut');
  const walnut=await squareStyle(page);
  assert.equal(walnut.light,'rgb(236, 216, 182)');assert.equal(walnut.dark,'rgb(167, 122, 82)');
  assert.deepEqual(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),PREF_KEY)),{board:'walnut',pieces:'original',theme:'light',chat:'normal'});
  await page.keyboard.press('Escape');
  // Ustawienia hosts the existing computer-game settings: a new time reaches the real clocks.
  await press(page.locator('.cc-tool[data-tool="settings"]'));
  await page.locator('#cc-sheet-settings #training-time').selectOption('5');
  assert.equal(await page.locator('#clock-2').textContent(),'05:00','time setting drives the real clocks');
  await press(page.locator('#cc-sheet-settings .cc-sheet-close'));
  await press(page.locator('.cc-tool[data-tool="pieces"]'));
  await press(page.locator('#cc-sheet-pieces .cc-option').filter({hasText:'Kontrastowe'}));
  assert.equal(await page.locator('body').getAttribute('data-cc-pieces'),'flat');
  const paint=await page.locator('#board svg.chess-piece[data-color="white"] path[data-body]').first().evaluate(n=>{const s=getComputedStyle(n);return [s.fill,s.fillOpacity,s.opacity];});
  assert.deepEqual(paint,['rgb(251, 250, 246)','1','1'],'flat white pieces stay opaque');
  assert.equal(await page.locator('#cc-sheet-pieces .cc-preview svg.chess-piece').count(),6,'local previews of each set');
  await press(page.locator('.cc-tool[data-tool="theme"]'));
  await press(page.locator('#cc-sheet-theme .cc-option').filter({hasText:'Ciemny'}));
  assert.equal(await page.locator('.side-dock').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(15, 42, 45)');
  assert.equal((await squareStyle(page)).light,walnut.light,'the panel theme never changes the board');
  await page.keyboard.press('Escape');
  await snapshot(page,'owner-variants-'+viewport.width);
  assert.deepEqual((await readChessLayout(page)).issues,[],'variants keep the layout contract (coordinates in squares)');
  await page.reload();await page.locator('.chess-piece').first().waitFor();
  for(const [name,value] of [['board','walnut'],['pieces','flat'],['theme','dark']]){
   assert.equal(await page.locator('body').getAttribute('data-cc-'+name),value,name+' persists locally');
   assert.equal(await page.locator('input[name="cc-'+name+'"][value="'+value+'"]').isChecked(),true);
  }
  await press(page.locator('.cc-tool[data-tool="theme"]'));
  await press(page.locator('#cc-sheet-theme .cc-reset'));
  for(const name of ['board','pieces','theme'])assert.equal(await page.locator('body').getAttribute('data-cc-'+name),null);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),PREF_KEY),null,'reset clears the stored choice');
  assert.deepEqual(await squareStyle(page),original,'reset restores the original board');
  assert.match(await page.locator('#board svg.chess-piece path[data-body]').first().evaluate(n=>n.getAttribute('fill')),/^url\(#chess-piece-/);
  // Stored values are validated: unknown or hostile values fall back to the original look.
  await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({board:'neon',pieces:'flat',theme:'<img src=x>',chat:42})),PREF_KEY);
  await page.reload();await page.locator('.chess-piece').first().waitFor();
  assert.equal(await page.locator('body').getAttribute('data-cc-board'),null);
  assert.equal(await page.locator('body').getAttribute('data-cc-pieces'),'flat');
  assert.equal(await page.locator('body').getAttribute('data-cc-theme'),null);
  await page.evaluate(k=>localStorage.setItem(k,'{nie-json'),PREF_KEY);
  await page.reload();await page.locator('.chess-piece').first().waitFor();
  assert.equal(await page.locator('body').getAttribute('data-cc-pieces'),null,'invalid JSON keeps the original look');
  if(!mobile){
   const fullscreen=page.locator('.cc-tool[data-tool="fullscreen"]');
   await fullscreen.click();
   await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);
   await page.waitForFunction(()=>document.querySelector('.cc-tool[data-tool="fullscreen"]').getAttribute('aria-pressed')==='true');
   assert.equal(await fullscreen.getAttribute('aria-label'),'Zamknij pełny ekran');
   await fullscreen.click();
   await page.waitForFunction(()=>!document.fullscreenElement);
   await page.waitForFunction(()=>document.querySelector('.cc-tool[data-tool="fullscreen"]').getAttribute('aria-pressed')==='false');
   assert.equal(await fullscreen.getAttribute('aria-label'),'Pełny ekran');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  assert.deepEqual(errors,[]);
  await context.close();
 }
});

test('actions, tabs and Info follow the real game: Rewanż only after a finished game, Online sheet, invitation',{timeout:90000},async t=>{
 const base=await startServer(t),browser=await launch(t);
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];page.setDefaultTimeout(8000);
 page.on('pageerror',error=>errors.push(error.message));
 // Isolated two-player fixture with a back-rank mate in one, so a real game can finish.
 await page.route('**/konto/szachy/app.js',async route=>{
  const response=await route.fetch(),source=await response.text();
  const hook="opponentSelect.addEventListener('change',()=>{updateOpponent();saveTrainingHistory();});";
  assert.ok(source.includes(hook));
  await route.fulfill({response,body:source.replace(hook,"opponentSelect.value='human';"+hook)});
 });
 await page.route('**/konto/szachy/rules.mjs',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:(await response.text()).replace(/export const START_FEN='[^']+';/,"export const START_FEN='6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';")});
 });
 await page.route('**/auth/message-center',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(inbox(1).body)}));
 await page.route(url=>url.pathname==='/auth/social/challenges',route=>route.fulfill({status:200,contentType:'application/json',
  body:JSON.stringify({ok:true,challenges:[{id:MATCH,game:'szachy',status:'accepted',opponent:'Rywal'}]})}));
 await page.goto(base+'/konto/szachy/');await page.locator('.chess-piece').first().waitFor();
 await page.locator('#chess-opponent').evaluate(el=>{el.value='human';el.dispatchEvent(new Event('change',{bubbles:true}));});
 const actions=page.locator('.side-dock > .chess-reference-actions > button:visible');
 assert.deepEqual(await actions.allTextContents(),['Nowa gra','Rewanż','Zaproś']);
 const rematch=page.locator('.chess-owner-rematch');
 assert.equal(await rematch.isDisabled(),true,'Rewanż is blocked during a game');
 assert.equal(await rematch.getAttribute('title'),'Rewanż będzie dostępny po zakończeniu partii');
 // Tabs: Czat | Ruchy | Info with one stable content height.
 assert.deepEqual(await page.locator('#match-panel .dock-tabs > .dock-tab').allTextContents(),['Czat','Ruchy','Info']);
 const height=async()=>Math.round((await page.locator('#match-panel').boundingBox()).height);
 const heights=[await height()];
 await page.locator('#history-tab').click();heights.push(await height());
 assert.equal(await page.locator('.mini-chat').isVisible(),false,'Ruchy shows no chat form');
 await page.locator('#chess-final-info-tab').click();heights.push(await height());
 assert.equal(new Set(heights).size,1,'switching tabs never changes the panel height: '+heights);
 const info=key=>page.locator('#chess-final-info-panel dd[data-info="'+key+'"]');
 assert.equal(await info('mode').textContent(),'Dwie osoby przy jednym urządzeniu');
 assert.equal(await info('moves').textContent(),'0');
 assert.equal(await info('clock').textContent(),'7 minut');
 assert.equal(await page.locator('#chess-final-info-panel .cc-info-links a[href="https://pl.wikipedia.org/wiki/Szachy"]').count(),1);
 await page.locator('#chess-final-info-panel .cc-info-links button').click();
 await page.locator('#howto-modal').waitFor({state:'visible'});
 await page.keyboard.press('Escape');
 await page.locator('#chat-tab').click();
 // Ra8# finishes the real game.
 await page.getByRole('gridcell',{name:'a1 biała wieża',exact:true}).click();
 await page.getByRole('gridcell',{name:'a8 puste',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('board').dataset.consoleGame==='finished');
 assert.equal(await rematch.isEnabled(),true,'Rewanż becomes available after the game');
 await page.locator('#chess-final-info-tab').click();
 assert.match(await info('state').textContent(),/Mat/);
 assert.equal(await info('moves').textContent(),'1');
 await rematch.click();
 await page.waitForFunction(()=>document.getElementById('board').dataset.consoleGame==='new');
 assert.equal(await page.locator('#history-count').textContent(),'0','Rewanż starts a new game with the same settings');
 assert.equal(await rematch.isDisabled(),true);
 // Online: the accepted-game list opens in its sheet; no fictitious public rooms.
 await page.locator('#online-mode').click();
 const sheet=page.locator('#cc-sheet-online');
 await sheet.waitFor({state:'visible'});
 await sheet.locator('.chess-final-room-name',{hasText:'Szachy · Rywal'}).waitFor();
 assert.equal(await sheet.locator('#create-room-friend').isVisible(),false,'the real friend picker replaces a free-text nickname');
 assert.doesNotMatch(await sheet.textContent(),/Turniejowy|Rankingowy|Pokój ogólny/);
 assert.deepEqual(await actions.allTextContents(),['Nowa gra','Rewanż','Zaproś']);
 await sheet.locator('.cc-sheet-close').click();
 await sheet.waitFor({state:'hidden'});
 await page.locator('.chess-owner-online-new').click();
 await sheet.waitFor({state:'visible'});
 assert.equal(await page.locator('.chess-owner-online-new').getAttribute('aria-expanded'),'true');
 await page.locator('.chess-reference-invite').click();
 await page.locator('#chess-invite-overlay').waitFor({state:'visible'});
 await page.locator('#chess-invite-close').click();
 await page.locator('#training-mode').click();
 await sheet.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);
});

test('Online Rewanż re-invites the same opponent with the same clock through the existing invitation window',{timeout:60000},async t=>{
 const base=await startServer(t),browser=await launch(t);
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],sent=[];page.setDefaultTimeout(8000);
 page.on('pageerror',error=>errors.push(error.message));
 const finished={...initialChessMatch(),winner:1,clock:{limitMs:300000,incrementMs:2000,remaining:[120000,90000],since:null,ready:[true,true]}};
 await page.route('**/auth/message-center',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(inbox(0).body)}));
 await page.route(url=>url.pathname==='/auth/match',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,
  match:{id:MATCH,game:'szachy',version:4,player:1,players:['Ja','Rywal'],playable:true,state:finished,undoRequest:null}})}));
 await page.route(url=>url.pathname==='/auth/match/chat',route=>route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"messages":[]}'}));
 await page.route(url=>url.pathname==='/auth/friends/presence',route=>route.fulfill({status:200,contentType:'application/json',
  body:JSON.stringify({ok:true,friends:[{nickname:'Inny',online:true},{nickname:'Rywal',online:true}]})}));
 await page.route(url=>url.pathname==='/auth/social/challenges',route=>{
  if(route.request().method()==='POST'){sent.push(route.request().postDataJSON());return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"id":"2b0c1f4e-5a6d-4e7f-8a9b-0c1d2e3f4a5b"}'});}
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,challenges:[]})});
 });
 await page.goto(base+'/konto/szachy/?match='+MATCH);await page.locator('.chess-piece').first().waitFor();
 await page.waitForFunction(()=>document.getElementById('board').dataset.consoleGame==='finished');
 const rematch=page.locator('.chess-owner-rematch');
 assert.equal(await page.locator('#board').getAttribute('data-console-opponent'),'Rywal');
 assert.equal(await rematch.isEnabled(),true);
 assert.equal(await rematch.getAttribute('title'),'Rewanż: ponowne zaproszenie dla Rywal');
 assert.equal(await page.locator('#cc-sheet-online').isVisible(),false,'a live or finished match does not open the lobby by itself');
 await rematch.click();
 await page.locator('#chess-invite-overlay').waitFor({state:'visible'});
 assert.equal(await page.locator('#chess-invite-search').inputValue(),'Rywal');
 await page.locator('#chess-invite-friends .chess-invite-friend[aria-selected="true"]').filter({hasText:'Rywal'}).waitFor();
 assert.equal(await page.locator('#create-room-time').inputValue(),'5');
 assert.equal(await page.locator('#create-room-increment').inputValue(),'2');
 await page.locator('#chess-invite-send').click();
 await until(()=>sent.length===1,'the player confirms the invitation');
 assert.deepEqual(sent[0],{action:'send',nickname:'Rywal',game:'szachy',timeLimitMinutes:5,incrementSeconds:2});
 assert.deepEqual(errors,[]);
});

test('owner acceptance views: badge 3 and 0, short clock labels and the Online form reachable to its end',{timeout:120000},async t=>{
 const base=await startServer(t),browser=await launch(t);
 for(const viewport of [{width:1366,height:768},{width:390,height:844},{width:375,height:667}]){
  const mobile=viewport.width<800,w=viewport.width;
  const context=await browser.newContext({viewport,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));
  let unread=3;
  await page.route('**/auth/message-center',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(inbox(unread).body)}));
  await page.route(url=>url.pathname==='/auth/social/challenges',route=>route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({ok:true,challenges:[{id:MATCH,game:'szachy',status:'accepted',opponent:'Rywal'}]})}));
  await page.goto(base+'/konto/szachy/');await page.locator('.chess-piece').first().waitFor();
  const badge=page.locator('.side-dock .cc-top .cc-mail-badge');
  await page.waitForFunction(()=>document.querySelector('.cc-mail')?.dataset.unread==='3');
  assert.equal(await badge.textContent(),'3');
  // Clocks show only the side; the full name stays for screen readers, in the title and in Info.
  assert.deepEqual(await page.locator('.cc-top .player .cc-side').allTextContents(),['Czarne','Białe']);
  assert.equal(await page.locator('.cc-top .player.first').getAttribute('title'),'Komputer · Czarne');
  assert.equal(await page.locator('#black-name').textContent(),'Komputer · Czarne');
  assert.deepEqual((await readChessLayout(page)).issues,[],'badge 3: no overlap with clocks or profile, labels fit');
  await page.locator('.side-dock').scrollIntoViewIfNeeded();
  await snapshot(page,'owner-badge-3-'+w);
  unread=0;
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await badge.waitFor({state:'hidden'});
  assert.deepEqual((await readChessLayout(page)).issues,[]);
  await snapshot(page,'owner-badge-0-'+w);
  // Online: the sheet scrolls inside the panel and its last control stays reachable and usable.
  await (mobile?page.locator('#online-mode').tap():page.locator('#online-mode').click());
  const sheet=page.locator('#cc-sheet-online'),body=sheet.locator('.cc-sheet-body'),submit=sheet.locator('#create-room');
  await sheet.waitFor({state:'visible'});
  await body.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  const reach=await page.evaluate(()=>{
   const body=document.querySelector('#cc-sheet-online .cc-sheet-body'),button=document.getElementById('create-room');
   const b=body.getBoundingClientRect(),r=button.getBoundingClientRect();
   return {inside:r.top>=b.top-1&&r.bottom<=b.bottom+1&&r.left>=b.left-1&&r.right<=b.right+1,atEnd:body.scrollTop+body.clientHeight>=body.scrollHeight-1,height:r.height};
  });
  assert.ok(reach.inside&&reach.atEnd&&reach.height>=30,'the Online form is reachable to its end: '+JSON.stringify(reach));
  await page.locator('.side-dock').scrollIntoViewIfNeeded();
  await snapshot(page,'owner-online-sheet-end-'+w);
  await (mobile?submit.tap():submit.click());
  await page.locator('#chess-invite-overlay').waitFor({state:'visible'});
  await page.locator('#chess-invite-close').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  assert.deepEqual(errors,[]);
  await context.close();
 }
});

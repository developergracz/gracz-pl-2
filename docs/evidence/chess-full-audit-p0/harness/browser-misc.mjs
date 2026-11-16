// AUDIT ONLY — §7 clock colours, §8.13 zoom, §13 performance/leaks, Online "Nowa gra" sheet and Info tab.
import fs from 'node:fs';
import {chromium,startServer,user,friends,challenge,context,open,log,save,cleanup,sq,pieces,clickMove,sleep,saveKey,injected,SHOTS,AUDIT} from './bh.mjs';
const srv=await startServer();const base=srv.base;
const browser=await chromium.launch({headless:true});
const T=async(id,area,desc,fn)=>{try{const r=await fn();log(id,area,desc,r.pass,r.actual,r.extra||{});}catch(e){log(id,area,desc,false,'EXCEPTION '+String(e.message).slice(0,300));}};
const long=JSON.parse(fs.readFileSync(AUDIT+'/evidence/long-game.json')).ucis;
async function inject(page,moves,o){await page.evaluate(([k,v])=>localStorage.setItem(k,v),[saveKey,injected(moves,o)]);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.classList.contains('cc-owner')&&document.querySelectorAll('#board .chess-square').length===64);}
try{
 const ctx=await context(browser,base,null);const page=await open(ctx,base+'/konto/szachy/');const cdp=await ctx.newCDPSession(page);await cdp.send('Performance.enable');
 const metric=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 // clock colours / warning thresholds
 await T('Z10','zegary','Kolory i progi zegara: aktywny, ≤30 s ostrzeżenie, ≤10 s krytyczny; kontrast cyfr',async()=>{
  await inject(page,['e2e4','e7e5'],{opponent:'human',minutes:'1',remaining:[60000,25000]});await clickMove(page,'g1','f3');await sleep(400);
  const a=await page.evaluate(()=>{const s=e=>{const c=getComputedStyle(e);return {cls:e.className,color:c.color,bg:c.backgroundColor,font:c.fontSize,weight:c.fontWeight};};return {black:s(document.getElementById('clock-1')),white:s(document.getElementById('clock-2'))};});
  await page.screenshot({path:SHOTS+'/40-clock-warning.png',clip:await page.locator('.players').boundingBox()});
  await sleep(15500);const b=await page.evaluate(()=>document.getElementById('clock-1').className);await page.screenshot({path:SHOTS+'/41-clock-critical.png',clip:await page.locator('.players').boundingBox()});
  return {pass:/clock-running/.test(a.black.cls)&&/clock-warning/.test(a.black.cls)&&/clock-critical/.test(b),actual:{a,critical:b}};});
 // long game performance
 await T('P01','wydajność','Długa partia lokalna (330 półruchów): czas render() po ruchu i koszt cyklicznego updateClocks (CPU w spoczynku)',async()=>{
  await inject(page,long,{opponent:'human',minutes:'30',remaining:[1800000,1800000]});
  const legal=await page.evaluate(()=>{const c=[...document.querySelectorAll('#board .chess-square')].filter(x=>x.classList.contains('chess-draggable'));return c.map(x=>Number(x.dataset.square));});
  // make a move with any legal piece: click first draggable then first target
  let moved=false,ms=0;for(const s of legal){const idx=await page.evaluate(s=>[...document.querySelectorAll('#board .chess-square')].findIndex(c=>Number(c.dataset.square)===s),s);await page.locator('#board .chess-square').nth(idx).click();const t=await page.evaluate(()=>[...document.querySelectorAll('#board .chess-target')].map(c=>[...c.parentElement.children].indexOf(c)));if(t.length){const t0=Date.now();await page.locator('#board .chess-square').nth(t[0]).click();ms=Date.now()-t0;moved=true;break;}}
  await sleep(500);const m0=await metric();await sleep(5000);const m1=await metric();const cpu=(m1.TaskDuration-m0.TaskDuration)/5;
  const short=await context(browser,base,null);const sp=await open(short,base+'/konto/szachy/');const c2=await short.newCDPSession(sp);await c2.send('Performance.enable');
  await sp.evaluate(([k,v])=>localStorage.setItem(k,v),[saveKey,injected(['e2e4','e7e5'],{opponent:'human',minutes:'30',remaining:[1800000,1800000]})]);await sp.reload();await sp.waitForFunction(()=>document.body.classList.contains('cc-owner'));await clickMove(sp,'g1','f3');await sleep(500);
  const s0=Object.fromEntries((await c2.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));await sleep(5000);const s1=Object.fromEntries((await c2.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));await short.close();
  const cpuShort=(s1.TaskDuration-s0.TaskDuration)/5;
  return {pass:cpu<0.10,actual:{moved,clickToRenderMs:ms,mainThreadBusyLongGamePct:Math.round(cpu*1000)/10,mainThreadBusyShortGamePct:Math.round(cpuShort*1000)/10}};});
 // DOM / heap growth during 300 history navigations
 await T('P02','wydajność','Brak wycieku: 300 przejść po historii nie zwiększa liczby węzłów DOM ani listenerów; sterta stabilna',async()=>{
  await page.locator('#history-tab').click();const n0=await page.evaluate(()=>document.querySelectorAll('*').length);await cdp.send('HeapProfiler.collectGarbage');const h0=(await metric()).JSHeapUsedSize;const l0=(await metric()).JSEventListeners;
  for(let i=0;i<150;i++){await page.locator('.chess-history-action[data-action="first"]').click();await page.locator('.chess-history-action[data-action="last"]').click();}
  await page.locator('.chess-history-action[data-action="live"]').click().catch(()=>{});
  const n1=await page.evaluate(()=>document.querySelectorAll('*').length);await cdp.send('HeapProfiler.collectGarbage');const m=await metric();
  return {pass:Math.abs(n1-n0)<50&&m.JSEventListeners-l0<200&&m.JSHeapUsedSize-h0<5e6,actual:{domBefore:n0,domAfter:n1,listenersBefore:l0,listenersAfter:m.JSEventListeners,heapBeforeMB:Math.round(h0/1e5)/10,heapAfterMB:Math.round(m.JSHeapUsedSize/1e5)/10}};});
 await T('P03','wydajność','Render pełnej planszy: liczba przebudowanych pól na jeden ruch',async()=>{
  await inject(page,['e2e4'],{opponent:'human'});const n=await page.evaluate(async()=>{let added=0;const o=new MutationObserver(l=>{for(const r of l)for(const x of r.addedNodes)if(x.classList?.contains('chess-square'))added++;});o.observe(document.getElementById('board'),{childList:true});document.querySelectorAll('#board .chess-square')[12].click();document.querySelectorAll('#board .chess-square')[28].click();await new Promise(r=>setTimeout(r,200));o.disconnect();return added;});
  return {pass:true,actual:{squaresRecreatedForSelectAndMove:n,note:'render() odtwarza 64 przyciski + SVG przy każdym kliknięciu/zaznaczeniu'}};});
 await ctx.close();
 // zoom 200% emulation: CSS viewport 800x450 at DPR 2 (equivalent of browser zoom on 1600x900)
 await T('B20','plansza','Powiększenie 200% (800×450 CSS px, DPR 2): przeciąganie myszą trafia w poprawne pole',async()=>{const z=await context(browser,base,null,{viewport:{width:800,height:450},deviceScaleFactor:2});const p=await open(z,base+'/konto/szachy/');
  const a=await p.locator('#board .chess-square').nth(sq('g1')).boundingBox(),b=await p.locator('#board .chess-square').nth(sq('f3')).boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await p.mouse.up();await sleep(400);const pc=await pieces(p);await p.screenshot({path:SHOTS+'/42-zoom200.png'});await z.close();
  return {pass:pc[sq('f3')]==='N',actual:{f3:pc[sq('f3')]}};});
 // Online "Nowa gra" sheet and Info tab with real match data
 const A=await user('Inf'),B=await user('Ing');await friends(A,B);const id=await challenge(A,B,10,5);
 const ca=await context(browser,base,A);const pa=await open(ca,base+'/konto/szachy/?match='+id);await sleep(1500);
 await T('K20','konsola','Online „Nowa gra” otwiera arkusz „Partie online” z prawdziwą listą przyjętych partii (bez fikcyjnych pokoi)',async()=>{await pa.locator('.chess-owner-online-new').click();const a=await pa.evaluate(()=>({visible:!document.getElementById('cc-sheet-online').hidden,rows:[...document.querySelectorAll('#chess-final-room-list .chess-final-room-row .chess-final-room-name')].map(e=>e.textContent),empty:document.querySelector('.chess-final-no-rooms')?.textContent||null}));await pa.screenshot({path:SHOTS+'/43-online-new-game-sheet.png'});await pa.keyboard.press('Escape');return {pass:a.visible&&a.rows.length===1&&a.rows[0].includes(B.nick),actual:a};});
 await T('K21','konsola','Zakładka Info pokazuje rzeczywiste dane partii (tryb, przeciwnik, czas 10+5, posunięcia)',async()=>{await pa.locator('#chess-final-info-tab').click();const a=await pa.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.cc-info-list dd')].map(d=>[d.dataset.info,d.textContent])));await pa.screenshot({path:SHOTS+'/44-info-tab.png'});return {pass:/Online/.test(a.mode)&&a.opponent===B.nick&&/10 min \+ 5 s/.test(a.clock)&&a.moves==='0',actual:a};});
 await T('K22','konsola','Link „Zasady i pomoc” w zakładce Info (warstwa mountApprovedPanel) — cel linku',async()=>{const a=await pa.evaluate(()=>[...document.querySelectorAll('#chess-final-info-panel a')].map(x=>({t:x.textContent,h:x.getAttribute('href')})));return {pass:true,actual:a};});
 await ca.close();
}catch(e){log('X00','harness','Wyjątek',false,String(e.stack).slice(0,600));}
finally{await browser.close();srv.child.kill('SIGKILL');await cleanup();save('browser-misc');process.exit(0);}

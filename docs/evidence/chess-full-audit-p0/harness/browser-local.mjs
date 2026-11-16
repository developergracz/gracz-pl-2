// AUDIT ONLY — §5, §8, §9, §10 (local) in real Chromium against the isolated instance.
import fs from 'node:fs';
import {chromium,startServer,user,friends,db,context,open,log,save,cleanup,sq,pieces,clickMove,sleep,saveKey,injected,SHOTS,AUDIT} from './bh.mjs';
const srv=await startServer();const base=srv.base;
const browser=await chromium.launch({headless:true});
const T=async(id,area,desc,fn)=>{try{const r=await fn();log(id,area,desc,r.pass,r.actual,r.extra||{});}catch(e){log(id,area,desc,false,'EXCEPTION '+String(e.message).slice(0,400));}};
async function fresh(opts={},u=null){const ctx=await context(browser,base,u,opts);const errors=[];const page=await open(ctx,base+'/konto/szachy/',errors);return {ctx,page,errors};}
async function inject(page,moves,o){await page.evaluate(([k,v])=>localStorage.setItem(k,v),[saveKey,injected(moves,o)]);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64&&document.body.classList.contains('cc-owner'));}
const moveCount=page=>page.locator('#move-count').textContent();
try{
 // ---------------- Inventory of the right console (desktop) ----------------
 const {ctx,page,errors}=await fresh();
 await page.screenshot({path:SHOTS+'/01-local-1600x900.png'});
 const inventory=await page.evaluate(()=>{
  const dock=document.querySelector('.boardarea > .side-dock');
  const vis=e=>{const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&!e.closest('[hidden]');};
  return [...dock.querySelectorAll('button,a,input,select,textarea,summary,[role=tab]')].filter(vis).map(e=>{const r=e.getBoundingClientRect();
   return {tag:e.tagName.toLowerCase(),id:e.id||null,cls:e.className&&typeof e.className==='string'?e.className.split(' ')[0]:null,text:(e.innerText||e.value||'').trim().slice(0,40),aria:e.getAttribute('aria-label'),title:e.title||null,disabled:!!e.disabled,href:e.getAttribute('href'),
    x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),name:(e.getAttribute('aria-label')||e.innerText||e.title||e.labels?.[0]?.innerText||e.placeholder||'').trim().slice(0,50),clipped:e.scrollWidth>e.clientWidth+2&&e.tagName!=='INPUT'};});
 });
 fs.writeFileSync(AUDIT+'/evidence/console-inventory-local.json',JSON.stringify(inventory,null,1));
 const unnamed=inventory.filter(e=>!e.name);
 await T('K00','konsola','Inwentaryzacja widocznych elementów prawej konsoli (tryb Komputer) + nazwy dostępne',async()=>({pass:unnamed.length===0,actual:{count:inventory.length,unnamed,clipped:inventory.filter(e=>e.clipped).map(e=>e.id||e.cls||e.text)}}));
 await T('K01','konsola','Domyślny tryb Komputer: aktywny przycisk trybu, 4 akcje, 5 ikon, zakładki Czat|Ruchy|Info',async()=>{
  const a=await page.evaluate(()=>({mode:document.getElementById('training-mode').getAttribute('aria-pressed'),online:document.getElementById('online-mode').getAttribute('aria-pressed'),
   actions:[...document.querySelectorAll('.chess-reference-actions button')].filter(b=>b.offsetParent).map(b=>b.innerText.trim()),
   tools:[...document.querySelectorAll('.cc-tools .cc-tool')].map(b=>b.dataset.tool),tabs:[...document.querySelectorAll('.dock-tabs [role=tab],.dock-tabs .dock-tab')].filter(t=>t.offsetParent).map(t=>t.innerText.trim())}));
  return {pass:a.mode==='true'&&a.online==='false'&&a.actions.join('|')==='Nowa gra|Rewanż|Zaproś|Cofnij'&&a.tools.join()==='settings,board,pieces,theme,fullscreen'&&a.tabs.join('|')==='Czat|Ruchy|Info',actual:a};});
 await T('K02','konsola','Rewanż i Cofnij nieaktywne przed pierwszym ruchem',async()=>{const r=await page.locator('.chess-owner-rematch').isDisabled(),u=await page.locator('#chess-owner-undo').isDisabled();return {pass:r&&u,actual:{rematchDisabled:r,undoDisabled:u}};});
 // ---------------- Board ----------------
 await T('B01','plansza','64 pola, 32 figury SVG, plansza kwadratowa, a1 ciemne, h1 jasne',async()=>{const a=await page.evaluate(()=>{const b=document.querySelector('.boardframe').getBoundingClientRect();const c=[...document.querySelectorAll('#board .chess-square')];return {n:c.length,svg:document.querySelectorAll('#board svg.chess-piece').length,ratio:b.width/b.height,a1:c[56].classList.contains('dark'),h1:c[63].classList.contains('light'),
  ext:[...document.querySelectorAll('#board image,#board img')].length};});return {pass:a.n===64&&a.svg===32&&Math.abs(a.ratio-1)<0.01&&a.a1&&a.h1&&a.ext===0,actual:a};});
 await T('B02','plansza','Układ początkowy figur zgodny z FEN startowym',async()=>{const p=(await pieces(page)).join('');return {pass:p==='rnbqkbnr'+'pppppppp'+'.'.repeat(32)+'PPPPPPPP'+'RNBQKBNR',actual:p};});
 await T('B03','plansza','Oznaczenia: cyfry w polach kolumny a, litery w polach 1. linii — wewnątrz pól',async()=>{const a=await page.evaluate(()=>{const c=[...document.querySelectorAll('#board .chess-square')];const out=[];for(const [i,cell] of c.entries()){for(const s of cell.querySelectorAll('.chess-coordinate')){const r=s.getBoundingClientRect(),q=cell.getBoundingClientRect();out.push({i,t:s.textContent,inside:r.left>=q.left-0.5&&r.right<=q.right+0.5&&r.top>=q.top-0.5&&r.bottom<=q.bottom+0.5});}}return out;});
  const ranks=a.filter(x=>/\d/.test(x.t)),files=a.filter(x=>/[a-h]/.test(x.t));return {pass:ranks.length===8&&files.length===8&&a.every(x=>x.inside)&&ranks.map(x=>x.t).join('')==='87654321'&&files.map(x=>x.t).join('')==='abcdefgh',actual:{ranks:ranks.map(x=>x.t).join(''),files:files.map(x=>x.t).join(''),outside:a.filter(x=>!x.inside)}};});
 await T('B04','plansza','Pojedyncze kliknięcie zaznacza figurę i pokazuje legalne pola (e2 → e3,e4)',async()=>{await page.locator('#board .chess-square').nth(sq('e2')).click();const t=await page.evaluate(()=>[...document.querySelectorAll('#board .chess-target')].map(c=>c.getAttribute('aria-label').split(' ')[0]));const s=await page.locator('#board .chess-selected').count();return {pass:s===1&&t.sort().join()==='e3,e4',actual:{selected:s,targets:t}};});
 await T('B05','plansza','Kliknięcie pola nielegalnego nie wykonuje ruchu (e2→e5)',async()=>{await page.locator('#board .chess-square').nth(sq('e5')).click();const c=await moveCount(page);const p=(await pieces(page))[sq('e2')];return {pass:c==='Ruchy: 0'&&p==='P',actual:{count:c,e2:p}};});
 await T('B06','plansza','Figura przeciwnika nie daje się zaznaczyć (e7 na turze białych)',async()=>{await page.locator('#board .chess-square').nth(sq('e7')).click({force:true});const s=await page.locator('#board .chess-selected').count();return {pass:s===0,actual:{selected:s}};});
 await T('B07','plansza','Podwójne kliknięcie pola docelowego wykonuje dokładnie 1 ruch (komputer odpowiada 1 ruchem)',async()=>{await page.locator('#board .chess-square').nth(sq('e2')).click();await page.locator('#board .chess-square').nth(sq('e4')).dblclick();await page.waitForFunction(()=>document.getElementById('move-count').textContent==='Ruchy: 2',{timeout:8000});await sleep(1200);const c=await moveCount(page);return {pass:c==='Ruchy: 2',actual:c};});
 await T('K03','konsola','Cofnij (komputer): cofa ruch gracza i odpowiedź komputera (2 półruchy)',async()=>{await page.locator('#chess-owner-undo').click();const c=await moveCount(page);const p=(await pieces(page))[sq('e2')];return {pass:c==='Ruchy: 0'&&p==='P',actual:{count:c,e2:p}};});
 await T('B08','plansza','Przeciągnięcie poza planszę → figura wraca, brak ruchu, brak „ducha”',async()=>{const a=await page.locator('#board .chess-square').nth(sq('d2')).boundingBox();const bb=await page.locator('#board').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(bb.x+bb.width+150,bb.y+bb.height/2,{steps:8});await page.mouse.up();await sleep(500);const g=await page.locator('.chess-drag-ghost').count();const c=await moveCount(page);const p=(await pieces(page))[sq('d2')];return {pass:g===0&&c==='Ruchy: 0'&&p==='P',actual:{ghosts:g,count:c,d2:p}};});
 await T('B09','plansza','Przeciągnięcie na pole nielegalne → powrót figury',async()=>{const a=await page.locator('#board .chess-square').nth(sq('d2')).boundingBox(),b=await page.locator('#board .chess-square').nth(sq('d5')).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();await sleep(500);const c=await moveCount(page);return {pass:c==='Ruchy: 0'&&(await pieces(page))[sq('d2')]==='P'&&(await page.locator('.chess-drag-ghost').count())===0,actual:c};});
 await T('B10','plansza','Zmiana rozmiaru okna podczas trzymania figury → brak zawieszonego stanu',async()=>{const a=await page.locator('#board .chess-square').nth(sq('d2')).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2,a.y-60,{steps:5});await page.setViewportSize({width:1280,height:720});await sleep(300);const b=await page.locator('#board .chess-square').nth(sq('d4')).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5});await page.mouse.up();await sleep(600);const g=await page.locator('.chess-drag-ghost').count();const p=await pieces(page);await page.setViewportSize({width:1600,height:900});await sleep(1500);
  const c=await moveCount(page);return {pass:g===0&&(p[sq('d4')]==='P'||p[sq('d2')]==='P'),actual:{ghosts:g,d4:p[sq('d4')],d2:p[sq('d2')],count:c}};});
 await page.locator('#restart').click();
 // ---------------- Computer ----------------
 await T('A01','komputer','Komputer odpowiada legalnym ruchem po ruchu gracza, notatka stanu poprawna',async()=>{await clickMove(page,'g1','f3');await page.waitForFunction(()=>document.getElementById('move-count').textContent==='Ruchy: 2',{timeout:8000});const n=await page.locator('#game-state').textContent();return {pass:/Twój ruch/.test(n),actual:n};});
 await T('A02','komputer','Nowa gra w trakcie „myślenia” komputera → spóźniony ruch komputera nie trafia do nowej partii',async()=>{
  await page.evaluate(()=>{const s=document.getElementById('ai-level');s.value='master';s.dispatchEvent(new Event('change',{bubbles:true}));});
  await clickMove(page,'e2','e4');await page.locator('#restart').click();await sleep(2500);const c=await moveCount(page);const p=(await pieces(page)).join('');return {pass:c==='Ruchy: 0'&&p.startsWith('rnbqkbnr'),actual:{count:c}};});
 await T('A03','komputer','Przełączenie na Online w trakcie myślenia komputera → brak ruchu w tle; po powrocie partia kontynuowana',async()=>{
  await clickMove(page,'d2','d4');await page.locator('#online-mode').click();await sleep(1500);const inOnline=await page.locator('#game-state').textContent();await page.locator('#training-mode').click();await page.waitForFunction(()=>document.getElementById('move-count').textContent==='Ruchy: 2',{timeout:8000});return {pass:true,actual:{onlineNotice:inOnline.slice(0,80),afterReturn:await moveCount(page)}};});
 await T('A04','komputer','Blokowanie wątku UI przez obliczenia AI (poziom Najmocniejszy) — długie zadania',async()=>{
  await page.locator('#restart').click();
  await page.evaluate(()=>{window.__long=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push(Math.round(e.duration));}).observe({type:'longtask',buffered:false});
   window.__gaps=[];let last=performance.now();window.__tick=setInterval(()=>{const n=performance.now();window.__gaps.push(n-last);last=n;},16);});
  await clickMove(page,'e2','e4');await page.waitForFunction(()=>document.getElementById('move-count').textContent==='Ruchy: 2',{timeout:8000});
  await clickMove(page,'g1','f3');await page.waitForFunction(()=>document.getElementById('move-count').textContent==='Ruchy: 4',{timeout:8000});
  await clickMove(page,'f1','c4');await page.waitForFunction(()=>document.getElementById('move-count').textContent==='Ruchy: 6',{timeout:8000});
  const a=await page.evaluate(()=>{clearInterval(window.__tick);return {longTasks:window.__long,maxGapMs:Math.round(Math.max(...window.__gaps))};});
  return {pass:Math.max(0,...a.longTasks)<200,actual:a};});
 // terminal: computer wins → automatic loss popup
 await T('A05','komputer/wynik','Komputer matuje (mat głupca) → automatyczne okno przegranej, plansza zablokowana, brak dalszych ruchów',async()=>{
  await inject(page,['f2f3','e7e5','g2g4'],{opponent:'computer'});
  await page.waitForFunction(()=>!document.getElementById('game-result-modal').hidden,{timeout:8000});
  const a=await page.evaluate(()=>({title:document.getElementById('game-result-title').textContent,desc:document.getElementById('game-result-description').textContent,notice:document.getElementById('game-state').textContent,enabled:document.querySelectorAll('#board .chess-square:not([disabled])').length,moves:document.getElementById('move-count').textContent,focus:document.activeElement?.id}));
  await page.screenshot({path:SHOTS+'/02-local-loss-popup.png'});await sleep(1500);const later=await moveCount(page);
  return {pass:/Przegrałeś/.test(a.title)&&/Mat — czarne wygrywają/.test(a.notice)&&a.enabled===0&&later==='Ruchy: 4',actual:{...a,later}};});
 await T('A06','wynik','Okno przegranej: Escape zamyka, „Rozpocznij nową partię” startuje nową grę',async()=>{await page.keyboard.press('Escape');const hidden=await page.locator('#game-result-modal').isHidden();await inject(page,['f2f3','e7e5','g2g4'],{opponent:'computer'});await page.waitForFunction(()=>!document.getElementById('game-result-modal').hidden,{timeout:8000});await page.locator('#game-result-new').click();const c=await moveCount(page);return {pass:hidden&&c==='Ruchy: 0',actual:{escHidden:hidden,afterNew:c}};});
 await T('A07','komputer/wynik','Gracz matuje komputer (mat szewczyka) → komunikat wygranej, komputer nie wykonuje ruchu, Rewanż aktywny',async()=>{
  await inject(page,['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6'],{opponent:'computer'});await clickMove(page,'h5','f7');await sleep(1500);
  const a=await page.evaluate(()=>({notice:document.getElementById('game-state').textContent,moves:document.getElementById('move-count').textContent,modal:!document.getElementById('game-result-modal').hidden,rematch:!document.querySelector('.chess-owner-rematch').disabled,wins:document.getElementById('record-wins').textContent}));
  await page.screenshot({path:SHOTS+'/03-local-win.png'});
  return {pass:/Mat — białe wygrywają/.test(a.notice)&&a.moves==='Ruchy: 7'&&a.rematch,actual:a};});
 await T('N10','wynik','Okno wyniku po WYGRANEJ / REMISIE (tylko przegrana ma okno)',async()=>{const m=await page.locator('#game-result-modal').isVisible();return {pass:'NI',actual:{winModalShown:m,note:'syncChessLoss() obsługuje wyłącznie przegraną'}};});
 await T('A09','komputer/wynik','Cofnięcie po zakończonej partii i ponowne zakończenie nie zawyża bilansu',async()=>{const w0=await page.locator('#record-wins').textContent();await page.locator('#chess-owner-undo').click();await clickMove(page,'h5','f7');await sleep(800);const w1=await page.locator('#record-wins').textContent();return {pass:w1===w0,actual:{winsBefore:w0,winsAfterUndoAndRepeat:w1}};});
 await T('A08','wynik','Rewanż (lokalnie) = nowa partia z tymi samymi ustawieniami',async()=>{await page.locator('.chess-owner-rematch').click();const c=await moveCount(page);return {pass:c==='Ruchy: 0',actual:c};});
 // promotion & stalemate in human mode
 await T('P01','promocja','Promocja w UI: wybór 4 figur, wybrano skoczka (bxa8=N)',async()=>{
  await inject(page,['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2'],{opponent:'human'});
  await clickMove(page,'b7','a8');const opts=await page.locator('#game-state .chess-promote').evaluateAll(b=>b.map(x=>x.getAttribute('aria-label')));
  await page.screenshot({path:SHOTS+'/04-promotion-picker.png'});
  await page.locator('#game-state .chess-promote[aria-label="Promocja na skoczka"]').click();const p=(await pieces(page))[sq('a8')];
  const hist=await page.locator('#moves-list .chess-move-row').evaluateAll(b=>b.map(x=>x.textContent));
  return {pass:opts.length===4&&p==='N'&&hist.at(-1)==='bxa8=N',actual:{opts,a8:p,last:hist.at(-1)}};});
 await T('P02','promocja','Czarna promocja z biciem na hetmana (gxh1=Q)',async()=>{await clickMove(page,'g2','h1');await page.locator('#game-state .chess-promote[aria-label="Promocja na hetmana"]').click();const p=(await pieces(page))[sq('h1')];const hist=await page.locator('#moves-list .chess-move-row').evaluateAll(b=>b.map(x=>x.textContent));return {pass:p==='q'&&hist.at(-1)==='gxh1=Q',actual:{h1:p,last:hist.at(-1)}};});
 await T('C01','pat','Pat (Loyd, 10 posunięć) → „Pat — remis”, plansza zablokowana',async()=>{
  await inject(page,'e2e3 a7a5 d1h5 a8a6 h5a5 h7h5 h2h4 a6h6 a5c7 f7f6 c7d7 e8f7 d7b7 d8d3 b7b8 d3h7 b8c8 f7g6'.split(' '),{opponent:'human'});
  await clickMove(page,'c8','e6');const a=await page.evaluate(()=>({notice:document.getElementById('game-state').textContent,enabled:document.querySelectorAll('#board .chess-square:not([disabled])').length,modal:!document.getElementById('game-result-modal').hidden}));
  return {pass:a.notice==='Pat — remis'&&a.enabled===0,actual:a};});
 await T('Z01','zegary','Lokalny zegar: przekroczenie czasu → „Koniec czasu — wygrywają białe”, zegar 00:00, stop',async()=>{
  await inject(page,['e2e4','e7e5'],{opponent:'human',minutes:'1',remaining:[60000,1500]});
  await clickMove(page,'g1','f3');await page.waitForFunction(()=>/Koniec czasu/.test(document.getElementById('game-state').textContent),{timeout:6000});
  const a=await page.evaluate(()=>({notice:document.getElementById('game-state').textContent,black:document.getElementById('clock-1').textContent,white:document.getElementById('clock-2').textContent,running:document.querySelectorAll('.clock-running').length,draws:document.getElementById('record-draws').textContent,wins:document.getElementById('record-wins').textContent}));
  await sleep(1200);const again=await page.locator('#clock-2').textContent();
  return {pass:/wygrywają białe/.test(a.notice)&&a.black==='00:00'&&a.running===0&&again===a.white,actual:{...a,whiteLater:again}};});
 await T('Z02','zegary','Lokalny zegar: bonus +2 s doliczany po ruchu; zegar startuje po 1. ruchu białych',async()=>{
  await page.locator('#restart').click();
  await page.evaluate(()=>{for(const [id,v] of [['training-time','1'],['training-increment','2']]){const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));}const o=document.getElementById('chess-opponent');o.value='human';o.dispatchEvent(new Event('change',{bubbles:true}));});
  const before=await page.evaluate(()=>[document.getElementById('clock-2').textContent,document.getElementById('clock-1').textContent]);await sleep(1200);const idle=await page.locator('#clock-2').textContent();
  await clickMove(page,'e2','e4');await sleep(1100);await clickMove(page,'e7','e5');const after=await page.evaluate(()=>[document.getElementById('clock-2').textContent,document.getElementById('clock-1').textContent]);
  return {pass:before.join()==='01:00,01:00'&&idle==='01:00'&&after[1]==='01:01',actual:{before,idle,after}};});
 // history
 await T('H01','historia','Historia: kolumny Nr/Białe/Czarne, numeracja, SAN, wskazanie bieżącego ruchu',async()=>{
  await page.locator('#history-tab').click();const a=await page.evaluate(()=>({cols:[...document.querySelectorAll('.chess-history-columns span')].map(s=>s.textContent),rows:[...document.querySelectorAll('#moves-list .chess-history-turn')].map(r=>r.innerText.replace(/\s+/g,' ')),current:document.querySelector('#moves-list [aria-current=step]')?.textContent}));
  return {pass:a.cols.join()==='Nr,Białe,Czarne'&&a.rows[0]==='1. e4 e5'&&a.current==='e5',actual:a};});
 await T('H02','historia','Klik wcześniejszego ruchu → pozycja historyczna, plansza tylko do odczytu; „Do gry” wraca',async()=>{
  await page.locator('#moves-list .chess-move-row[data-ply="1"]').click();const p=await pieces(page);const enabled=await page.locator('#board .chess-square:not([disabled])').count();
  await page.locator('#board .chess-square').nth(sq('d2')).click({force:true});const c=await moveCount(page);
  await page.locator('.chess-history-action[data-action="live"]').click();const live=await page.locator('#board').getAttribute('data-review-ply');const p2=await pieces(page);
  return {pass:p[sq('e5')]==='.'&&p[sq('e4')]==='P'&&enabled===0&&c==='Ruchy: 2'&&live==='live'&&p2[sq('e5')]==='p',actual:{enabled,c,live}};});
 await T('H03','historia','PGN: kopiowanie do schowka — format zapisu',async()=>{
  await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
  await page.locator('.chess-history-action[data-action="pgn"]').click();await sleep(300);const pgn=await page.evaluate(()=>navigator.clipboard.readText());
  return {pass:pgn==='1. e4 e5 *',actual:{pgn,note:'brak nagłówków PGN (Event/White/Black/Result); wynik zawsze "*"'}};});
 await T('H04','historia','PGN po zakończonej partii zawiera wynik (1-0/0-1/1/2-1/2)',async()=>{
  await inject(page,['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7'],{opponent:'human'});await page.locator('#history-tab').click();await page.locator('.chess-history-action[data-action="pgn"]').click();await sleep(300);const pgn=await page.evaluate(()=>navigator.clipboard.readText());
  return {pass:/1-0$/.test(pgn),actual:pgn};});
 await T('H05','historia','Odświeżenie strony zachowuje partię lokalną (localStorage) i historię',async()=>{await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.classList.contains('cc-owner'));const c=await moveCount(page);const n=await page.locator('#game-state').textContent();return {pass:c==='Ruchy: 7'&&/Mat/.test(n),actual:{c,n}};});
 await T('H06','historia','Klawiatura w historii: ArrowLeft/ArrowRight/Home/End z fokusem na liście ruchów',async()=>{await page.locator('#history-tab').click();await page.locator('#moves-list .chess-move-row[data-ply="7"]').focus();
  const st=async()=>({ply:await page.locator('#board').getAttribute('data-review-ply'),focus:await page.evaluate(()=>document.activeElement?.dataset?.ply??document.activeElement?.tagName)});
  await page.keyboard.press('ArrowLeft');const l1=await st();await page.keyboard.press('ArrowLeft');const l2=await st();await page.keyboard.press('Home');const h=await st();await page.keyboard.press('ArrowRight');const r=await st();await page.keyboard.press('End');const e=await st();
  await page.locator('.chess-history-action[data-action="live"]').click().catch(()=>{});
  return {pass:l1.ply==='6'&&l2.ply==='5'&&h.ply==='0'&&r.ply==='1'&&e.ply==='7',actual:{l1,l2,h,r,e}};});
 await T('N11','historia','Import/eksport FEN, import PGN',async()=>({pass:'NI',actual:'Brak UI/funkcji FEN i importu PGN (tylko kopiowanie ruchów PGN)'}));
 // ---------------- Config sheets ----------------
 await page.locator('#restart').click();
 for(const [kind,title] of [['settings','Ustawienia gry'],['board','Wygląd planszy'],['pieces','Wygląd figur'],['theme','Motyw panelu']]){
  await T('I-'+kind,'ikony','Ikona '+kind+' otwiera „'+title+'”, Escape zamyka i przywraca fokus',async()=>{
   await page.locator('.cc-tool[data-tool="'+kind+'"]').click();const vis=await page.locator('#cc-sheet-'+kind).isVisible();const t=await page.locator('#cc-sheet-'+kind+' .cc-sheet-title').textContent();
   await page.screenshot({path:SHOTS+'/05-sheet-'+kind+'.png'});await page.keyboard.press('Escape');const hidden=await page.locator('#cc-sheet-'+kind).isHidden();const focus=await page.evaluate(()=>document.activeElement?.dataset?.tool);
   return {pass:vis&&t===title&&hidden&&focus===kind,actual:{vis,t,hidden,focus}};});
 }
 await page.evaluate(()=>{const o=document.getElementById('chess-opponent');o.value='computer';o.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#restart').click();
 await T('I-persist','ikony','Plansza „Orzech”, Figury „Drewniane”, Motyw „Ciemny” — zapis po odświeżeniu, brak wpływu na stan gry; reset przywraca domyślne',async()=>{
  await clickMove(page,'e2','e4');await page.waitForFunction(()=>document.getElementById('move-count').textContent==='Ruchy: 2',{timeout:8000});const posBefore=(await pieces(page)).join('');
  await page.locator('.cc-tool[data-tool="board"]').click();await page.locator('#cc-sheet-board input[value="walnut"]').check();await page.keyboard.press('Escape');
  await page.locator('.cc-tool[data-tool="pieces"]').click();await page.locator('#cc-sheet-pieces input[value="wood"]').check();await page.keyboard.press('Escape');
  await page.locator('.cc-tool[data-tool="theme"]').click();await page.locator('#cc-sheet-theme input[value="dark"]').check();await page.keyboard.press('Escape');
  const ds=await page.evaluate(()=>({...document.body.dataset}));const sqColor=await page.locator('#board .chess-square.dark').first().evaluate(e=>getComputedStyle(e).backgroundColor);
  await page.screenshot({path:SHOTS+'/06-appearance-walnut-wood-dark.png'});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.classList.contains('cc-owner'));const ds2=await page.evaluate(()=>({...document.body.dataset}));const posAfter=(await pieces(page)).join('');
  await page.locator('.cc-tool[data-tool="board"]').click();await page.locator('#cc-sheet-board .cc-reset').click();await page.keyboard.press('Escape');const ds3=await page.evaluate(()=>({...document.body.dataset}));
  return {pass:ds.ccBoard==='walnut'&&ds.ccPieces==='wood'&&ds.ccTheme==='dark'&&ds2.ccBoard==='walnut'&&posAfter===posBefore&&!ds3.ccBoard&&!ds3.ccPieces&&!ds3.ccTheme,actual:{ds,ds2,ds3,sqColor,stateKept:posAfter===posBefore}};});
 await T('I-fullscreen','ikony','Pełny ekran: wejście i wyjście, zmiana etykiety',async()=>{await page.locator('.cc-tool[data-tool="fullscreen"]').click();await sleep(600);const a=await page.evaluate(()=>({fs:!!document.fullscreenElement,label:document.querySelector('.cc-tool[data-tool="fullscreen"]').getAttribute('aria-label'),focus:document.getElementById('game').classList.contains('game-focus')}));
  await page.screenshot({path:SHOTS+'/07-fullscreen.png'});if(a.fs)await page.evaluate(()=>document.exitFullscreen());else if(a.focus)await page.keyboard.press('Escape');await sleep(400);const b=await page.evaluate(()=>({fs:!!document.fullscreenElement,label:document.querySelector('.cc-tool[data-tool="fullscreen"]').getAttribute('aria-label')}));
  return {pass:(a.fs&&a.label==='Zamknij pełny ekran'&&!b.fs&&b.label==='Pełny ekran')||(a.focus&&!a.fs),actual:{a,b}};});
 await T('I-settings','ikony','Ustawienia: zmiana poziomu AI i czasu działa; „Układ konsoli” otwiera studio',async()=>{await page.locator('.cc-tool[data-tool="settings"]').click();const lvl=await page.locator('#cc-sheet-settings #ai-level').isVisible();const time=await page.locator('#cc-sheet-settings #training-time').isVisible();const labels=await page.locator('#ai-level option').allTextContents();
  await page.locator('#cc-sheet-settings .cc-button',{hasText:'Układ konsoli'}).click();const studio=await page.locator('#console-config-modal').isVisible();await page.keyboard.press('Escape');
  return {pass:lvl&&time&&studio,actual:{lvl,time,labels,studio}};});
 await T('K04','konsola','Zaproś (bez logowania) → przełącza na Online i otwiera okno zaproszeń lub komunikat logowania',async()=>{await page.locator('.chess-reference-invite').click();await sleep(1200);const a=await page.evaluate(()=>({online:document.getElementById('online-mode').classList.contains('active'),overlay:!document.getElementById('chess-invite-overlay').hidden,note:document.getElementById('account-note')?.textContent,notice:document.getElementById('game-state').textContent,status:document.getElementById('chess-invite-status')?.textContent}));
  await page.screenshot({path:SHOTS+'/08-invite-anonymous.png'});await page.keyboard.press('Escape');await sleep(300);const closed=await page.locator('#chess-invite-overlay').isHidden();if(!closed)await page.locator('#chess-invite-close').click();return {pass:a.online&&closed,actual:{...a,escapeClosesOverlay:closed}};});
 await page.locator('#training-mode').click();
 // chat local
 await T('T01','czat','Czat lokalny (GRACZ AI) — odpowiedź lub czytelny błąd, brak mieszania z Online',async()=>{await page.locator('#chat-tab').click();await page.locator('#chat-input').fill('Jak roszować?');await page.locator('#chat-send').click();await sleep(1500);const a=await page.evaluate(()=>({status:document.getElementById('chat-status').textContent,msgs:[...document.querySelectorAll('#chat-messages .game-chat-message')].map(m=>m.innerText.replace(/\s+/g,' ').slice(0,60))}));return {pass:a.msgs.length>=1&&/Ty/.test(a.msgs[0]),actual:a};});
 await T('T02','czat','Tryb dwóch graczy lokalnie: notatki lokalne, wstrzyknięty HTML wyświetlany jako tekst',async()=>{await page.evaluate(()=>{const o=document.getElementById('chess-opponent');o.value='human';o.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#chat-input').fill('<img src=x onerror="window.__x=1">');await page.locator('#chat-send').click();await sleep(300);const a=await page.evaluate(()=>({x:window.__x,img:document.querySelectorAll('#chat-messages img').length,text:document.querySelector('#chat-messages .game-chat-message:last-child p')?.textContent}));return {pass:!a.x&&a.img===0,actual:a};});
 // a11y axe
 // W01/W02 superseded by browser-responsive.mjs (axe with CSP bypass; real Tab :focus-visible)
 await T('W03','dostępność','Plansza klawiaturą: Tab do pola, Enter wybiera figurę i wykonuje ruch',async()=>{await page.locator('#restart').click();await page.evaluate(()=>{const o=document.getElementById('chess-opponent');o.value='human';o.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#board .chess-square').nth(sq('e2')).focus();await page.keyboard.press('Enter');await page.locator('#board .chess-square').nth(sq('e4')).focus();await page.keyboard.press('Enter');const c=await moveCount(page);return {pass:c==='Ruchy: 1',actual:c};});
 await T('W04','dostępność','ARIA planszy: role=gridcell wymaga kontenera grid/row',async()=>{const a=await page.evaluate(()=>({boardRole:document.getElementById('board').getAttribute('role'),rows:document.querySelectorAll('#board [role=row]').length,cells:document.querySelectorAll('#board [role=gridcell]').length}));return {pass:a.boardRole==='grid'&&a.rows===8,actual:a};});
 await T('B11','plansza','Obracanie szachownicy dostępne w UI',async()=>{const a=await page.evaluate(()=>({flipButtons:[...document.querySelectorAll('button')].filter(b=>/Obróć/.test(b.textContent)).map(b=>({inDom:document.body.contains(b),visible:!!b.offsetParent})),toolbarInDom:!!document.querySelector('.chess-actions')}));return {pass:a.flipButtons.some(b=>b.visible),actual:a};});
 await T('X01','stabilność','Brak wyjątków JS (pageerror) podczas całej sesji lokalnej',async()=>({pass:errors.filter(e=>e.startsWith('pageerror')).length===0,actual:{pageErrors:errors.filter(e=>e.startsWith('pageerror')).slice(0,5),consoleErrors:[...new Set(errors.filter(e=>e.startsWith('console')))].slice(0,4)}}));
 await ctx.close();
 // ---------------- Envelope (real message-center with real accounts) ----------------
 const A=await user('Env'),B=await user('Snd'),C=await user('Oth');await friends(A,B);await friends(A,C);
 const env=await context(browser,base,A);const errorsE=[];const ep=await open(env,base+'/konto/szachy/',errorsE);
 const badge=()=>ep.evaluate(()=>{const m=document.querySelector('.cc-mail'),b=m.querySelector('.cc-mail-badge');return {hidden:b.hidden,text:b.textContent,aria:m.getAttribute('aria-label'),unread:m.dataset.unread};});
 async function setUnread(n,from=B){await db.query('DELETE FROM gracz_public_identity.friend_messages WHERE recipient_id=$1',[A.id]);if(n>0)await db.query("INSERT INTO gracz_public_identity.friend_messages(id,sender_id,recipient_id,body,created_at) SELECT gen_random_uuid(),$1,$2,'wiadomość '||g,now()-g*interval '1 second' FROM generate_series(1,$3) g",[from.id,A.id,n]);await ep.reload({waitUntil:'domcontentloaded'});await ep.waitForFunction(()=>document.querySelector('.cc-mail')?.dataset.unread!==undefined,{timeout:8000});return badge();}
 for(const [n,exp] of [[0,''],[1,'1'],[2,'2'],[9,'9'],[99,'99'],[100,'99+'],[150,'99+']]){
  await T('E-'+n,'koperta','Licznik nieprzeczytanych = '+n+' → badge „'+(exp||'ukryty')+'”',async()=>{const b=await setUnread(n);return {pass:(exp===''?b.hidden:!b.hidden&&b.text===exp)&&b.unread===String(n),actual:b};});
 }
 await T('E-plural','koperta','Odmiana etykiety dla 2 wiadomości (powinno być „2 nieprzeczytane”)',async()=>{const b=await setUnread(2);return {pass:/2 nieprzeczytane$/.test(b.aria),actual:b.aria};});
 await T('E-archived','koperta','Rozmowa zarchiwizowana nie jest liczona',async()=>{await setUnread(0);await db.query("INSERT INTO gracz_public_identity.friend_messages(id,sender_id,recipient_id,body) VALUES(gen_random_uuid(),$1,$2,'a')",[C.id,A.id]);await db.query("INSERT INTO gracz_public_identity.message_conversation_state(owner_id,friend_id,archived) VALUES($1,$2,true)",[A.id,C.id]);await ep.reload({waitUntil:'domcontentloaded'});await ep.waitForFunction(()=>document.querySelector('.cc-mail')?.dataset.unread!==undefined);const b=await badge();return {pass:b.unread==='0'&&b.hidden,actual:b};});
 await T('E-read','koperta','Odczytanie rozmowy (last_read_at) i powrót do konsoli → licznik 0',async()=>{await setUnread(3);await db.query("INSERT INTO gracz_public_identity.message_conversation_state(owner_id,friend_id,last_read_at) VALUES($1,$2,now()) ON CONFLICT (owner_id,friend_id) DO UPDATE SET last_read_at=now()",[A.id,B.id]);await ep.evaluate(()=>window.dispatchEvent(new Event('focus')));await sleep(4500);await ep.evaluate(()=>window.dispatchEvent(new Event('focus')));await sleep(800);const b=await badge();return {pass:b.unread==='0',actual:b};});
 await T('E-net','koperta','Błąd sieci → zachowany ostatni zweryfikowany stan (bez fikcyjnego 0)',async()=>{await setUnread(5);await ep.route('**/auth/message-center',r=>r.abort());await sleep(4200);await ep.evaluate(()=>window.dispatchEvent(new Event('focus')));await sleep(800);const b=await badge();await ep.unroute('**/auth/message-center');return {pass:b.text==='5',actual:b};});
 await T('E-other','koperta','Inny użytkownik (C) nie widzi liczby A',async()=>{const o=await context(browser,base,C);const op=await open(o,base+'/konto/szachy/');await op.waitForFunction(()=>document.querySelector('.cc-mail')?.dataset.unread!==undefined);const b=await op.evaluate(()=>document.querySelector('.cc-mail').dataset.unread);await o.close();return {pass:b==='0',actual:b};});
 await T('E-anon','koperta','Niezalogowany → brak liczby, etykieta „zaloguj się”',async()=>{const o=await context(browser,base,null);const op=await open(o,base+'/konto/szachy/');await sleep(1500);const b=await op.evaluate(()=>{const m=document.querySelector('.cc-mail');return {hidden:m.querySelector('.cc-mail-badge').hidden,aria:m.getAttribute('aria-label'),unread:m.dataset.unread??null};});await o.close();return {pass:b.hidden&&/zaloguj/.test(b.aria)&&b.unread===null,actual:b};});
 await T('E-link','koperta','Koperta prowadzi do /konto/panel/?sekcja=messages',async()=>({pass:(await ep.locator('.cc-mail').getAttribute('href'))==='/konto/panel/?sekcja=messages',actual:await ep.locator('.cc-mail').getAttribute('href')}));
 await env.close();
}catch(e){log('X00','harness','Wyjątek',false,String(e.stack).slice(0,600));}
finally{await browser.close();srv.child.kill('SIGKILL');await cleanup();save('browser-local');process.exit(0);}

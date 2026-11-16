// AUDIT ONLY — §6, §7, §9.4, §10 Online with two authenticated accounts in independent Chromium contexts.
import {chromium,startServer,user,friends,challenge,db,setState,readMatch,context,open,log,save,cleanup,sq,pieces,visible,clickMove,sleep,SHOTS} from './bh.mjs';
import {createHash} from 'node:crypto';
const srv=await startServer();const base=srv.base;
const browser=await chromium.launch({headless:true});
const T=async(id,area,desc,fn)=>{try{const r=await fn();log(id,area,desc,r.pass,r.actual,r.extra||{});}catch(e){log(id,area,desc,false,'EXCEPTION '+String(e.message).slice(0,350));}};
const hash=x=>createHash('sha256').update(x).digest();
const waitPos=(page,state,timeout=12000)=>page.waitForFunction(exp=>{const c=[...document.querySelectorAll('#board .chess-square')];return c.length===64&&c.every((n,i)=>(n.querySelector('svg')?.dataset.piece||'.')===exp[i]);},visible(state),{timeout});
const clocks=page=>page.evaluate(()=>({white:document.getElementById('clock-2').textContent,black:document.getElementById('clock-1').textContent,running:[...document.querySelectorAll('.clock-running')].map(e=>e.id)}));
const toSec=t=>{const [m,s]=t.split(':').map(Number);return m*60+s;};
async function drag(page,from,to){const a=await page.locator('#board .chess-square').nth(sq(from)).boundingBox(),b=await page.locator('#board .chess-square').nth(sq(to)).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();}
async function dbMatch(id){const r=await db.query('SELECT state,version FROM gracz_public_identity.game_matches WHERE challenge_id=$1',[id]);return r.rows[0]?{state:r.rows[0].state,version:r.rows[0].version}:null;}
async function untilVersion(u,id,v,ms=12000){const end=Date.now()+ms;while(Date.now()<end){const r=await dbMatch(id);if(r&&r.version>=v)return r;await sleep(100);}throw Error('version '+v+' not reached');}
const readM=async(u,id)=>({match:await dbMatch(id)});
try{
 const A=await user('Wht'),B=await user('Blk'),C=await user('Thr');await friends(A,B);await friends(A,C);
 const ctxA=await context(browser,base,A),ctxB=await context(browser,base,B);const errA=[],errB=[];
 // ---------- 1. Invitation through the UI ----------
 const pa=await open(ctxA,base+'/konto/szachy/',errA),pb=await open(ctxB,base+'/konto/szachy/',errB);
 let matchId;
 await T('OB01','online','Zaproszenie przez UI (3 min + 2 s): wysłanie przez A, odbiór i akceptacja przez B, obaj w tej samej partii',async()=>{
  await pa.locator('#online-mode').click();
  await pa.evaluate(()=>{for(const [id,v] of [['create-room-time','3'],['create-room-increment','2']]){const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}));}});
  await sleep(2000);
  await pa.locator('.chess-reference-invite').click();await pa.locator('#chess-invite-overlay').waitFor({state:'visible'});
  const friend=pa.locator('#chess-invite-friends .chess-invite-friend').filter({hasText:B.nick});await friend.waitFor({state:'visible',timeout:10000});
  for(let i=0;i<10&&!/Dostępny teraz/.test(await friend.innerText());i++){await pa.locator('#chess-invite-refresh').click();await sleep(800);}
  await friend.click();
  const summary=await pa.locator('#chess-invite-clock-summary').textContent();
  await pa.screenshot({path:SHOTS+'/20-invite-window.png'});
  await pa.locator('#chess-invite-send').click();
  await pb.locator('#chess-invite-received').waitFor({state:'visible',timeout:20000});const from=await pb.locator('#chess-invite-from').textContent();
  await pb.screenshot({path:SHOTS+'/21-invite-received.png'});
  await pb.locator('#chess-invite-accept').click();
  await pb.waitForURL(/match=/,{timeout:15000});await pa.waitForURL(/match=/,{timeout:20000});
  matchId=new URL(pb.url()).searchParams.get('match');
  return {pass:matchId===new URL(pa.url()).searchParams.get('match')&&from.includes(A.nick),actual:{summary,from,matchId}};});
 await Promise.all([pa,pb].map(p=>p.waitForFunction(()=>document.body.classList.contains('cc-owner')&&document.querySelectorAll('#board .chess-square').length===64)));
 let m=await untilVersion(A,matchId,0);
 await T('OB02','online','Kolory: A (zapraszający) = białe, B = czarne; nazwy przeciwników poprawne',async()=>{await sleep(1500);m=(await readMatch(base,A,matchId)).match;const mb=(await readMatch(base,B,matchId)).match;const ta=await pa.locator('#session-heading').textContent(),tb=await pb.locator('#session-heading').textContent();return {pass:m.player===1&&mb.player===2&&ta.includes(A.nick)&&ta.includes(B.nick),actual:{A:m.player,B:mb.player,headingA:ta,headingB:tb}};});
 await T('OB03','online/plansza','Czarne (B) widzą planszę od swojej strony (czarne figury na dole)',async()=>{const p=await pieces(pb);await pb.screenshot({path:SHOTS+'/22-black-player-view.png'});return {pass:p[63]==='r'||p[60]==='k'||p[59]==='k',actual:{bottomRow:p.slice(56).join(''),note:'orientacja zawsze od strony białych; brak przycisku obrotu'}};});
 await T('OZ01','zegary','Zegar startuje dopiero po wejściu obu graczy; aktywny zegar białych u obu (3:00)',async()=>{m=(await readM(A,matchId)).match;await sleep(1200);const ca=await clocks(pa),cb=await clocks(pb);return {pass:!!m.state.clock.since&&m.state.clock.ready.every(Boolean)&&ca.running.join()==='clock-2'&&cb.running.join()==='clock-2'&&toSec(ca.white)<=180&&toSec(ca.white)>=175,actual:{ca,cb,since:m.state.clock.since}};});
 // ---------- 2. Moves, sync and latency ----------
 await T('OB04','online','Ruch A (klik) → aktualizacja planszy B przez WebSocket; zmiana tury i zegarów u obu',async()=>{const t=Date.now();await clickMove(pa,'e2','e4');m=await untilVersion(A,matchId,m.version+1);await waitPos(pb,m.state);const lat=Date.now()-t;await sleep(600);const ca=await clocks(pa),cb=await clocks(pb);
  return {pass:m.state.history.at(-1).uci==='e2e4'&&ca.running.join()==='clock-1'&&cb.running.join()==='clock-1'&&toSec(ca.white)>=toSec('03:00')-6,actual:{latencyMs:lat,ca,cb,serverRemaining:m.state.clock.remaining}};});
 await T('OB05','online','Ruch B (przeciągnięcie) → aktualizacja u A; bonus +2 s',async()=>{await drag(pb,'e7','e5');m=await untilVersion(A,matchId,m.version+1);await waitPos(pa,m.state);return {pass:m.state.history.at(-1).uci==='e7e5'&&m.state.turn===1,actual:{remaining:m.state.clock.remaining}};});
 await T('OB06','online','Gracz nie może ruszać na turze przeciwnika (plansza B zablokowana)',async()=>{const en=await pb.locator('#board .chess-square:not([disabled])').count();return {pass:en===0,actual:{enabledSquaresB:en}};});
 // ---------- 3. Network loss on B ----------
 await T('OE01','awarie','Utrata internetu u B, ruch A, powrót sieci → B synchronizuje się',async()=>{await ctxB.setOffline(true);await sleep(500);await clickMove(pa,'g1','f3');m=await untilVersion(A,matchId,m.version+1);await sleep(2500);const stale=(await pieces(pb))[sq('f3')]==='.';const t=Date.now();await ctxB.setOffline(false);await waitPos(pb,m.state,20000);return {pass:true,actual:{staleWhileOffline:stale,resyncMs:Date.now()-t}};});
 await T('OE02','awarie','Odświeżenie strony B w trakcie partii → identyczna pozycja i zegary z serwera',async()=>{await pb.reload({waitUntil:'domcontentloaded'});await waitPos(pb,m.state);const cb=await clocks(pb);return {pass:true,actual:cb};});
 // ---------- 4. WebSocket severed (proxy) ----------
 let severed=[];
 const pb2=await ctxB.newPage();await pb2.routeWebSocket('**/auth/match/realtime',ws=>{const server=ws.connectToServer();severed.push(ws);});
 await pb2.goto(base+'/konto/szachy/?match='+matchId,{waitUntil:'domcontentloaded'});await waitPos(pb2,m.state);
 await T('OE03','awarie','Zerwanie WebSocket → fallback + automatyczne ponowne połączenie; ruch przeciwnika dociera',async()=>{await sleep(1500);const before=severed.length;for(const w of severed)await w.close().catch(()=>{});await drag(pb,'b8','c6');m=await untilVersion(A,matchId,m.version+1);await clickMove(pa,'f1','c4');m=await untilVersion(A,matchId,m.version+1);const t=Date.now();await waitPos(pb2,m.state,20000);await sleep(5000);return {pass:severed.length>before,actual:{connectionsBefore:before,connectionsAfter:severed.length,syncMs:Date.now()-t}};});
 await pb2.close();
 // ---------- 5. Same match in two tabs of A ----------
 const pa2=await open(ctxA,base+'/konto/szachy/?match='+matchId,errA);await waitPos(pa2,m.state);
 await T('OE04','awarie','Ta sama partia w dwóch kartach A: równoczesne różne ruchy → serwer przyjmuje 1, druga karta dostaje błąd i resynchronizuje',async()=>{
  await clickMove(pb,'g8','f6');m=await untilVersion(A,matchId,m.version+1);await waitPos(pa,m.state);await waitPos(pa2,m.state);
  const fc=(p,x)=>p.locator('#board .chess-square').nth(sq(x)).click({force:true,timeout:2000}).catch(()=>'blocked');
  await Promise.all([fc(pa,'d2'),fc(pa2,'c2')]);
  const clicks=await Promise.all([fc(pa,'d4'),fc(pa2,'c3')]);
  await sleep(2500);const r=(await readM(A,matchId)).match;const notices=[await pa.locator('#game-state').textContent(),await pa2.locator('#game-state').textContent()];
  await waitPos(pa,r.state);await waitPos(pa2,r.state);await waitPos(pb,r.state);m=r;
  const pa1p=await pieces(pa),pa2p=await pieces(pa2);return {pass:r.state.history.length===7&&['d2d4','c2c3'].includes(r.state.history.at(-1).uci)&&pa1p.join()===pa2p.join(),actual:{serverLast:r.state.history.at(-1).uci,history:r.state.history.length,notices,clicks,tabsEqual:pa1p.join()===pa2p.join()}};});
 await pa2.close();
 // ---------- 6. Slow API + rapid second move attempt ----------
 await T('OE05','awarie','Spóźniona odpowiedź API (2,5 s) + szybkie kolejne kliknięcia → dokładnie 1 POST, brak podwójnego ruchu',async()=>{
  let posts=0;await pb.route('**/auth/match',async route=>{if(route.request().method()==='POST'){posts++;await sleep(2500);}await route.continue();});
  await clickMove(pb,'d7','d6');const fc=async(f,t)=>{for(const x of [f,t])await pb.locator('#board .chess-square').nth(sq(x)).click({force:true,timeout:1500}).catch(()=>{});};await sleep(150);await fc('h7','h6');await sleep(150);await fc('a7','a6');
  m=await untilVersion(A,matchId,m.version+1);await sleep(3500);const r=(await readM(A,matchId)).match;await pb.unroute('**/auth/match');
  return {pass:posts===1&&r.version===m.version&&r.state.history.length===m.state.history.length,actual:{posts,last:r.state.history.at(-1).uci,history:r.state.history.length}};});
 m=(await readM(A,matchId)).match;await waitPos(pa,m.state);
 // ---------- 7. Chat ----------
 await T('OT01','czat','Czat: wysłanie/odbiór, kolejność, tożsamość nadawcy; HTML wyświetlony jako tekst',async()=>{
  for(const [p,t] of [[pa,'Pierwsza'],[pb,'Druga'],[pa,'<img src=x onerror="window.__xss=1"><b>pogrubienie</b>']]){await p.locator('#chat-tab').click();await p.locator('#chat-input').fill(t);await p.locator('#chat-send').click();await sleep(400);}
  await pb.waitForFunction(()=>document.querySelectorAll('#chat-messages .game-chat-message').length>=3,{timeout:10000});
  const rows=await pb.evaluate(()=>[...document.querySelectorAll('#chat-messages .game-chat-message')].map(m=>({who:m.querySelector('strong').textContent,body:m.querySelector('p').textContent,own:m.classList.contains('own')})));
  const xss=await pb.evaluate(()=>({flag:window.__xss??null,imgs:document.querySelectorAll('#chat-messages img,#chat-preview img').length,bold:document.querySelectorAll('#chat-messages b').length}));
  await pb.screenshot({path:SHOTS+'/23-online-chat.png'});
  return {pass:rows.map(r=>r.body).join('|')==='Pierwsza|Druga|<img src=x onerror="window.__xss=1"><b>pogrubienie</b>'&&rows[0].who===A.nick+':'&&rows[1].who==='Ty:'&&rows[1].own&&!xss.flag&&xss.imgs===0&&xss.bold===0,actual:{rows,xss}};});
 await T('OT02','czat','Przełączenie zakładek Czat→Ruchy→Info→Czat nie gubi wiadomości',async()=>{await pb.locator('#history-tab').click();await pb.locator('#chess-final-info-tab').click();await pb.locator('#chat-tab').click();const n=await pb.locator('#chat-messages .game-chat-message').count();const info=await pb.locator('#chess-final-info-panel').count();return {pass:n===3,actual:{messages:n}};});
 await T('OT03','czat','Rozdzielenie: czat Online nie trafia do lokalnych notatek / GRACZ AI',async()=>{await pb.locator('#training-mode').click();const local=await pb.evaluate(()=>[...document.querySelectorAll('#chat-messages .game-chat-message p')].map(p=>p.textContent));await pb.locator('#online-mode').click();await sleep(800);return {pass:!local.includes('Pierwsza'),actual:{localMessages:local}};});
 m=(await readM(A,matchId)).match;
 // ---------- 8. Foreign match ----------
 await T('OS01','bezpieczeństwo','Trzecie konto otwiera URL cudzej partii → brak dostępu, brak danych graczy',async()=>{const ctxC=await context(browser,base,C);const pc=await open(ctxC,base+'/konto/szachy/?match='+matchId);await sleep(2500);const a=await pc.evaluate(()=>({notice:document.getElementById('game-state').textContent,heading:document.getElementById('session-heading').textContent,enabled:document.querySelectorAll('#board .chess-square:not([disabled])').length,body:document.body.innerText}));await pc.screenshot({path:SHOTS+'/24-foreign-match.png'});await ctxC.close();
  return {pass:!a.body.includes(B.nick)&&a.enabled===0,actual:{notice:a.notice,heading:a.heading,enabled:a.enabled,leaksOpponent:a.body.includes(B.nick)}};});
 // ---------- 9. Clock skew on B's device ----------
 await T('OZ02','zegary','Zegar systemowy urządzenia B przesunięty o +60 s → wyświetlany czas vs serwer',async()=>{
  const ctxS=await context(browser,base,B);await ctxS.addInitScript(()=>{const off=60000,N=Date.now;Date.now=()=>N()+off;const D=Date;globalThis.Date=class extends D{constructor(...a){super(...(a.length?a:[N()+off]));}static now(){return N()+off;}};});
  const ps=await open(ctxS,base+'/konto/szachy/?match='+matchId);await waitPos(ps,m.state);await sleep(1200);
  const truth=await clocks(pa),skew=await clocks(ps);await ps.screenshot({path:SHOTS+'/25-clock-skew.png'});await ctxS.close();
  const running=truth.running[0]==='clock-2'?'white':'black';const diff=toSec(truth[running])-toSec(skew[running]);
  return {pass:Math.abs(diff)<=2,actual:{runningSide:running,trueDisplay:truth[running],skewedDisplay:skew[running],differenceSec:diff}};});
 // ---------- 10. Session lost mid-game ----------
 await T('OE06','awarie','Utrata sesji B w trakcie gry → ruch odrzucony z komunikatem, brak zmiany stanu',async()=>{
  await db.query('UPDATE gracz_public_identity.sessions SET expires_at=now()-interval \'1 second\' WHERE token_digest=$1',[hash(B.token)]);
  m=(await readM(A,matchId)).match;
  const turnB=m.state.turn===2;if(!turnB){await clickMove(pa,'h2','h3');m=await untilVersion(A,matchId,m.version+1);}
  await pb.reload({waitUntil:'domcontentloaded'}).catch(()=>{});await sleep(2500);
  const a=await pb.evaluate(()=>({notice:document.getElementById('game-state').textContent,enabled:document.querySelectorAll('#board .chess-square:not([disabled])').length}));
  await db.query('UPDATE gracz_public_identity.sessions SET expires_at=now()+interval \'3 hours\' WHERE token_digest=$1',[hash(B.token)]);
  const after=(await readM(A,matchId)).match;await pb.reload({waitUntil:'domcontentloaded'});await waitPos(pb,after.state);
  return {pass:a.enabled===0&&after.version===m.version,actual:{...a,versionUnchanged:after.version===m.version}};});
 m=(await readM(A,matchId)).match;
 // ---------- 11. Natural time forfeit (no DB manipulation) ----------
 await T('OZ03','zegary','Naturalne przekroczenie czasu (partia 1 min, B nie gra): koniec u obu, wynik zgodny, okno przegranej u B, zegary zatrzymane',async()=>{
  const id=await challenge(A,B,1,0);const qa=await open(ctxA,base+'/konto/szachy/?match='+id),qb=await open(ctxB,base+'/konto/szachy/?match='+id);
  let mm=await untilVersion(A,id,0);await sleep(1500);await clickMove(qa,'e2','e4');mm=await untilVersion(A,id,mm.version+1);
  await qb.waitForFunction(()=>/Partia zakończona/.test(document.getElementById('game-state').textContent),null,{timeout:90000});await qa.waitForFunction(()=>/Partia zakończona/.test(document.getElementById('game-state').textContent),{timeout:10000});
  const s=(await readM(A,id)).match.state;const a={A:await qa.locator('#game-state').textContent(),B:await qb.locator('#game-state').textContent(),popupB:await qb.locator('#game-result-modal').isVisible(),popupA:await qa.locator('#game-result-modal').isVisible(),titleB:await qb.locator('#game-result-title').textContent(),clocksA:await clocks(qa),clocksB:await clocks(qb)};
  await qb.screenshot({path:SHOTS+'/26-online-timeout-loser.png'});await qa.screenshot({path:SHOTS+'/27-online-timeout-winner.png'});
  await qa.close();await qb.close();
  return {pass:s.winner===1&&s.clock.timeoutLoser===2&&/wygrywają białe/.test(a.A)&&/wygrywają białe/.test(a.B)&&a.popupB&&!a.popupA&&a.clocksA.running.length===0&&a.clocksB.black==='00:00',actual:{...a,server:{winner:s.winner,loser:s.clock.timeoutLoser}}};});
 await T('OZ04','zegary','Wynik po przekroczeniu czasu opisany jako przekroczenie czasu (nie ogólnie)',async()=>({pass:false,actual:'Komunikat: „Partia zakończona — wygrywają białe” — bez przyczyny (czas/mat/remis); okno przegranej: „Przeciwnik wygrał partię online.”'}));
 // ---------- 12. Checkmate, result for both, rematch ----------
 await T('OR01','wynik','Mat online: wynik u obu, okno przegranej automatycznie tylko u przegranego, Rewanż aktywny u obu',async()=>{
  const id=await challenge(A,B,0,0);const qa=await open(ctxA,base+'/konto/szachy/?match='+id),qb=await open(ctxB,base+'/konto/szachy/?match='+id);
  let mm=await untilVersion(A,id,0);
  for(const [p,f,t] of [[qa,'e2','e4'],[qb,'e7','e5'],[qa,'f1','c4'],[qb,'b8','c6'],[qa,'d1','h5'],[qb,'g8','f6'],[qa,'h5','f7']]){await p.waitForFunction(s=>!document.querySelectorAll('#board .chess-square')[s].disabled,sq(f),{timeout:10000});await clickMove(p,f,t);mm=await untilVersion(A,id,mm.version+1);await waitPos(qa,mm.state);await waitPos(qb,mm.state);}
  await qb.waitForFunction(()=>!document.getElementById('game-result-modal').hidden,null,{timeout:10000});
  const a={A:await qa.locator('#game-state').textContent(),B:await qb.locator('#game-state').textContent(),popupB:await qb.locator('#game-result-modal').isVisible(),popupA:await qa.locator('#game-result-modal').isVisible(),descB:await qb.locator('#game-result-description').textContent(),newBtnB:await qb.locator('#game-result-new').textContent(),rematchA:await qa.locator('.chess-owner-rematch').isEnabled(),rematchB:await qb.locator('.chess-owner-rematch').isEnabled(),san:mm.state.history.at(-1).san};
  await qb.screenshot({path:SHOTS+'/28-online-mate-loser-popup.png'});await qa.screenshot({path:SHOTS+'/29-online-mate-winner.png'});
  await qb.keyboard.press('Escape');
  // rematch from loser: invitation window with the real opponent preselected
  await qb.locator('.chess-owner-rematch').click();await qb.locator('#chess-invite-overlay').waitFor({state:'visible'});await sleep(1500);
  const sel=await qb.evaluate(()=>({name:document.getElementById('chess-invite-name').textContent,items:[...document.querySelectorAll('#chess-invite-friends .chess-invite-friend .chess-invite-friend-name')].map(e=>e.textContent)}));
  await qb.screenshot({path:SHOTS+'/30-online-rematch.png'});await qb.keyboard.press('Escape');
  await qa.close();await qb.close();
  return {pass:/wygrywają białe/.test(a.A)&&/wygrywają białe/.test(a.B)&&a.popupB&&!a.popupA&&a.rematchA&&a.rematchB&&sel.name===A.nick&&sel.items.every(n=>[A.nick].includes(n)),actual:{...a,rematchSelection:sel}};});
 // ---------- 13. Draw claim online via UI ----------
 await T('OD01','remis','Zgłoszenie remisu (3-krotne powtórzenie) przez UI Online → remis u obu, brak okna przegranej',async()=>{
  const id=await challenge(A,B,0,0);const qa=await open(ctxA,base+'/konto/szachy/?match='+id),qb=await open(ctxB,base+'/konto/szachy/?match='+id);let mm=await untilVersion(A,id,0);
  const seq=[[qa,'g1','f3'],[qb,'g8','f6'],[qa,'f3','g1'],[qb,'f6','g8'],[qa,'g1','f3'],[qb,'g8','f6'],[qa,'f3','g1'],[qb,'f6','g8']];
  for(const [p,f,t] of seq){await p.waitForFunction(s=>!document.querySelectorAll('#board .chess-square')[s].disabled,sq(f),{timeout:10000});await clickMove(p,f,t);mm=await untilVersion(A,id,mm.version+1);await waitPos(qa,mm.state);await waitPos(qb,mm.state);}
  const claim=qa.locator('.chess-owner-claim-draw');await claim.waitFor({state:'visible',timeout:8000});const label=await claim.textContent();await claim.click();mm=await untilVersion(A,id,mm.version+1);await waitPos(qb,mm.state);await sleep(800);
  const a={A:await qa.locator('#game-state').textContent(),B:await qb.locator('#game-state').textContent(),popupA:await qa.locator('#game-result-modal').isVisible(),popupB:await qb.locator('#game-result-modal').isVisible()};
  await qa.close();await qb.close();
  return {pass:mm.state.winner===3&&/remis/.test(a.A)&&/remis/.test(a.B)&&!a.popupA&&!a.popupB,actual:{label,...a,reason:mm.state.drawReason}};});
 await T('ON01','funkcje','Poddanie partii / propozycja remisu za zgodą w konsoli Online',async()=>{const a=await pa.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/Poddaj|rezygn|Zaproponuj remis|Propozycja remisu/i.test(b.textContent)).length);return {pass:'NI',actual:{buttons:a}};});
 // ---------- 14. Close and reopen browser ----------
 await T('OE07','awarie','Zamknięcie przeglądarki B i ponowne otwarcie (nowy kontekst, ta sama sesja) → pozycja z serwera',async()=>{await ctxB.close();const nb=await context(browser,base,B);const p=await open(nb,base+'/konto/szachy/?match='+matchId);m=(await readM(A,matchId)).match;await waitPos(p,m.state);await nb.close();return {pass:true,actual:{version:m.version}};});
 await T('OX01','stabilność','Brak wyjątków JS (pageerror) u A i B',async()=>{const ex=[...errA,...errB].filter(e=>e.startsWith('pageerror'));const consoleErr=[...errA,...errB].filter(e=>e.startsWith('console'));return {pass:ex.length===0,actual:{pageErrors:ex.slice(0,8),consoleErrors:consoleErr.length,consoleSample:[...new Set(consoleErr)].slice(0,4)}};});
 await ctxA.close();
}catch(e){log('X00','harness','Wyjątek',false,String(e.stack).slice(0,700));}
finally{await browser.close();srv.child.kill('SIGKILL');await cleanup();save('browser-online');process.exit(0);}

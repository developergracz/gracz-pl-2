// Chess P4: two independent Chromium contexts click actual chessboard squares.
// All services are disposable localhost-only PostgreSQL, Valkey and HTTP/WebSocket.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {assertDisposableDatabaseUrl} from '../integration/test-database-guard.mjs';

const origin='https://gracz-contact-api.onrender.com',hash=x=>createHash('sha256').update(x).digest();
assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const redis=new URL(process.env.GAME_REDIS_URL||'');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(redis.hostname),'Only local disposable Valkey permitted');
async function spawn(t){
 const child=fork(new URL('./browser-instance.mjs',import.meta.url),{
  env:{...process.env},stdio:['ignore','pipe','pipe','ipc']});
 let errors='';child.stderr.on('data',x=>errors+=x.toString());
 t.after(async()=>{if(child.exitCode!==null||child.signalCode)return;const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;});
 const ready=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('Browser server died: '+errors.slice(-1200));})]);
 return 'http://localhost:'+ready[0].port;
}
async function read(base,token,id){
 const r=await fetch(base+'/auth/match?id='+encodeURIComponent(id),{
  headers:{Cookie:'__Host-gracz_session='+token,Origin:origin}});
 return {status:r.status,...await r.json()};
}
function visible(state){
 const out=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)out.push(state.board[r*16+c]);
 return out;
}
async function waitForPosition(page,state){
 await page.waitForFunction(expected=>{
  const squares=[...document.querySelectorAll('#board .chess-square')];
  return squares.length===64&&squares.every((node,i)=>{
   const piece=node.querySelector('svg.chess-piece'),expectedPiece=expected[i];
   if(expectedPiece==='.')return !piece&&[...node.children].every(child=>child.classList.contains('chess-coordinate'));
   return piece?.dataset.piece===expectedPiece&&piece.dataset.color===(expectedPiece===expectedPiece.toUpperCase()?'white':'black')&&!!piece.querySelector('path[data-body]');
  });
 },visible(state),{timeout:10000});
}
test('two isolated Chromium windows play chess by clicking squares with WebSocket updates and reconnect', {timeout:180000},async t=>{
 const db=createDatabase(),users=[];
 t.after(async()=>{try{for(const u of users)await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[u.id]);}finally{await db.close();}});
 await createPublicIdentityRouter({database:db,emailFrom:'browser@example.invalid',resendKey:'local-only'}).probe();
 for(const player of [1,2]){
  const id=randomUUID(),token=randomBytes(32).toString('hex'),nick='Chess'+player+'_'+id.replaceAll('-','').slice(0,10);
  await db.query('INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES($1,$2,$3,$4,$5,$5,now())',
   [id,nick,nick.toLowerCase(),nick.toLowerCase()+'@example.invalid',Buffer.alloc(64)]);
  await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash(token),id]);
  users.push({id,token,player,nickname:nick});
 }
 await db.query("INSERT INTO gracz_public_identity.friend_connections(account_a,account_b,requested_by,status) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,'accepted')", [users[0].id,users[1].id]);
 const id=randomUUID();
 await db.query("INSERT INTO gracz_public_identity.game_challenges(id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds) VALUES($1,$2,$3,'szachy','accepted',5,2)",
  [id,users[0].id,users[1].id]);
 const base=await spawn(t),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(async()=>browser.close());
 const pages=[];
 for(const u of users){
  const ctx=await browser.newContext({viewport:{width:1600,height:900}});
  t.after(async()=>ctx.close());
  await ctx.addCookies([{name:'__Host-gracz_session',value:u.token,url:base.replace('http:','https:')+'/',
   httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await ctx.newPage();pages.push(page);
  page.on('pageerror',err=>console.error('CHESS_PAGE_ERROR',u.player,err.message));
  await page.goto(base+'/konto/szachy/?match='+id,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64,{timeout:12000});
 }
 const local=await pages[0].context().newPage();
 await local.goto(base+'/konto/szachy/',{waitUntil:'domcontentloaded'});
 await local.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
 // Regression: switching to Online without a selected match must never blank the board.
 await local.locator('#online-mode').click();
 await local.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
 assert.equal(await local.locator('#board .chess-square').count(),64);
 assert.equal(await local.locator('#board .chess-square.white-piece').count(),16);
 assert.equal(await local.locator('#board .chess-square.black-piece').count(),16);
 assert.equal(await local.locator('#board .chess-square:not([disabled])').count(),0);
 assert.equal(await local.locator('#board .chess-square').first().evaluate(e=>getComputedStyle(e).opacity),'1','preview squares must remain fully opaque');
 assert.match(await local.locator('#game-state').innerText(),/plansza poglądowa/i);
 assert.match(await local.locator('#turn-label').innerText(),/Oczekiwanie na grę/);
 // The idle preview shows configured clocks for both sides, without starting either timer.
 assert.equal(await local.locator('#clock-1').innerText(),'07:00');
 assert.equal(await local.locator('#clock-2').innerText(),'07:00');
 assert.match(await local.locator('#clock-1').getAttribute('aria-label'),/Czas czarnych przed rozpoczęciem/);
 await local.locator('#create-room-time').selectOption('10');
 assert.equal(await local.locator('#clock-1').innerText(),'10:00');
 assert.equal(await local.locator('#clock-2').innerText(),'10:00');
 await local.locator('#create-room-time').selectOption('7');
 const rails=await local.evaluate(()=>{
  const ids=['game-state','turn-label','move-count'];
  return ids.map(id=>{
   const node=document.getElementById(id),outer=node.getBoundingClientRect(),
     boardarea=document.querySelector('.boardarea').getBoundingClientRect();
   return {id,clipped:node.scrollWidth>node.clientWidth+2,
     rightOverflow:outer.right>boardarea.right+2,leftOverflow:outer.left<boardarea.left-2,
     text:node.textContent};
  });
 });
 for(const rail of rails){
  assert.equal(rail.clipped,false,rail.id+' text must fit within its gold frame');
  assert.equal(rail.rightOverflow,false,rail.id+' must not stick out to the right');
  assert.equal(rail.leftOverflow,false,rail.id+' must not stick out to the left');
 }
 await local.locator('#training-mode').click();
 assert.equal(await local.locator('#board .chess-square:not([disabled])').count(),64);

 // Owner-approved layout hides unused controls but keeps clock state in the engine.
 for(const id of ['training-settings','training-records','training-time','training-increment'])
  assert.equal(await local.locator('#'+id).isVisible(),false,id+' should not occupy the panel');
 for(const id of ['clock-1','clock-2'])
  assert.equal(await local.locator('#'+id).isVisible(),true,id+' must remain visible');
 assert.equal(await local.locator('.chess-minimal-more').isVisible(),false);
 assert.equal(await local.locator('.side-dock > .game-tools').isVisible(),false);
 assert.equal(await local.locator('.chess-reference-actions button:visible').count(),3);
 assert.equal(await local.locator('.premium-quick-links .premium-mini-link:visible').count(),0);
 await local.evaluate(()=>{
  for(const [id,value] of [['training-time','1'],['training-increment','2']]){
   const sel=document.getElementById(id);sel.value=value;
   sel.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await local.locator('#board .chess-square').nth(52).click();
 await local.locator('#board .chess-square').nth(36).click();
 await local.waitForFunction(()=>document.getElementById('clock-1')?.textContent!=='01:00',{timeout:5000});
 await local.waitForFunction(()=>document.querySelector('#move-count')?.textContent==='Ruchy: 2',{timeout:12000});
 assert.match(await local.locator('#black-name').textContent(),/Komputer/);
 assert.match(await local.locator('#white-name').textContent(),/Ty/);
 assert.equal(await local.locator('#training-mode strong').textContent(),'Komputer');
 const white=local.locator('.chess-square.white-piece').first();
 assert.equal(await white.locator('svg').getAttribute('data-color'),'white');
 assert.equal(await white.locator('linearGradient stop').nth(1).getAttribute('stop-color'),'#ffffff');
 assert.equal(await white.locator('[data-body]').evaluate(e=>getComputedStyle(e).fillOpacity),'1');
 const layout=await local.locator('#game').boundingBox(),
  board=await local.locator('.boardframe').boundingBox(),right=await local.locator('.side-dock').boundingBox();
 assert.ok(board&&right,'board and right console must both render');
 assert.ok(Math.abs(board.width-board.height)<=2,'chessboard must stay square');
 assert.ok(board.width>=580,'desktop chessboard fills a large square');
 assert.ok(right.x>=board.x+board.width-3,'compact console must be to the right of the board');
 assert.ok(right.width>=345&&right.width<=520,'approved right panel has responsive width');
 assert.ok(right.x+right.width<=layout.x+layout.width+2,'console stays inside the viewport');
 for(const clock of ['clock-1','clock-2']){
  const pos=await local.locator('#'+clock).boundingBox();
  assert.ok(pos&&pos.x>=right.x&&pos.x+pos.width<=right.x+right.width+2,clock+' must be inside the right console');
 }
 assert.equal(await local.locator('.boardframe').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px','board must be frameless');
 await local.locator('#howto-open').evaluate(el=>el.click());
 assert.equal(await local.locator('#howto-modal').isVisible(),true);
 assert.match(await local.locator('#howto-title').textContent(),/Szachy/);
 await local.locator('#howto-close').click();
 await local.locator('#console-config-open').evaluate(el=>el.click());
 assert.equal(await local.locator('#console-config-modal').isVisible(),true);
 await local.locator('#console-config-close').click();
 await local.locator('#undo-move').evaluate(el=>el.click());
 assert.equal(await local.locator('#move-count').textContent(),'Ruchy: 0');
 // FIDE draw claim: two complete knight cycles yield the third identical position.
 await local.locator('#chess-opponent').evaluate(el=>{el.value='human';el.dispatchEvent(new Event('change',{bubbles:true}));});
 const toIndex=s=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
 const repeatedKnights=[['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8'],
                       ['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8']];
 for(const [from,to] of repeatedKnights){
  await local.locator('#board .chess-square').nth(toIndex(from)).click();
  await local.locator('#board .chess-square').nth(toIndex(to)).click();
 }
 const drawClaim=local.locator('.chess-owner-claim-draw');
 await drawClaim.waitFor({state:'visible',timeout:7000});
 assert.match(await drawClaim.innerText(),/trzykrotne powtórzenie/i);
 await drawClaim.click();
 assert.match(await local.locator('#game-state').textContent(),/Remis/);
 assert.equal(await local.locator('#board .chess-square:not([disabled])').count(),0);
 await local.locator('#focus-game').evaluate(el=>el.click());
 assert.equal(await local.locator('body').evaluate(x=>x.classList.contains('chess-board-focus')),true);
 assert.equal(await local.locator('#game').evaluate(x=>x.classList.contains('game-focus')),true);
 assert.equal(await local.locator('#focus-nav').isVisible(),true);
 assert.equal(await local.locator('.sidebar').isVisible(),false);
 assert.equal(await local.locator('.side-dock').isVisible(),false);
 await local.locator('#focus-exit').click();
 await local.close();
 // Full premium layout: controls belong to the sidebars, not below the board.
 for(const page of pages){
  assert.equal(await page.locator('.chess-actions').count(),0);
  assert.equal(await page.locator('#training-mode').isEnabled(),true);
  assert.equal(await page.locator('#online-mode').isEnabled(),true);
  assert.equal(await page.locator('#chat-input').isEnabled(),true);
  assert.equal(await page.locator('#online-settings').isVisible(),true);
  const boardFrame=await page.locator('.boardframe').boundingBox();
  assert.ok(boardFrame&&boardFrame.width>=490,'full viewport board should be at least 490px wide');
 }
 await pages[0].locator('#chat-input').fill('Witaj przy szachownicy!');
 await pages[0].locator('#chat-send').click();
 await pages[1].waitForFunction(()=>document.querySelector('#chat-messages')?.textContent.includes('Witaj przy szachownicy!'),{timeout:10000});
 // Follow-up WebSocket events contain only new messages; the client must retain old ones.
 await pages[1].locator('#chat-input').fill('Cześć, zaczynajmy!');
 await pages[1].locator('#chat-send').click();
 await pages[0].locator('#chat-input').fill('Powodzenia!');
 await pages[0].locator('#chat-send').click();
 for(const page of pages){
  await page.waitForFunction(()=>document.querySelectorAll('#chat-messages .game-chat-message').length===3,{timeout:10000});
  const chat=await page.locator('#chat-messages').innerText();
  assert.match(chat,/Witaj przy szachownicy!/);
  assert.match(chat,/Cześć, zaczynajmy!/);
  assert.match(chat,/Powodzenia!/);
  assert.match(chat,/Ty:/);
  assert.ok(chat.includes(users[page===pages[0]?1:0].nickname),'opponent keeps their real nickname');
  assert.equal(await page.locator('#chat-messages .own').count(),page===pages[0]?2:1);
  assert.equal(await page.locator('#chat-messages time[datetime]').count(),3);
  assert.match(await page.locator('.player.first small').innerText(),/Czarne — drugi ruch/);
  assert.match(await page.locator('.player.second small').innerText(),/Białe — zaczynają/);
  for(const link of await page.locator('.sidebar-footer .side-links a').all()){
   const ok=await link.evaluate(el=>el.scrollWidth<=el.clientWidth+2);
   assert.ok(ok,'Sidebar link text must fit without horizontal clipping');
  }
 }
 await pages[1].locator('#history-tab').click();
 assert.equal(await pages[1].locator('#moves-panel').isVisible(),true);
 await pages[1].locator('#chat-tab').click();
 assert.equal(await pages[1].locator('#chat-panel').isVisible(),true);
 let result=await read(base,users[0].token,id);
 assert.equal(result.status,200);
 assert.equal(result.match.game,'szachy');
 assert.deepEqual(result.match.state.clock.ready,[true,true]);
 assert.ok(result.match.state.clock.since);
 let state=result.match.state,version=result.match.version;
 await Promise.all(pages.map(page=>waitForPosition(page,state)));
 // Scholar's mate: two independent browser users finish a full game.
 const opening=[
  {player:1,from:'e2',to:'e4'},{player:2,from:'e7',to:'e5'},
  {player:1,from:'f1',to:'c4'},{player:2,from:'b8',to:'c6'},
  {player:1,from:'d1',to:'h5'},{player:2,from:'g8',to:'f6'},
  {player:1,from:'h5',to:'f7'}
 ];
 const index=s=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
 // Once synchronized, browser GET snapshots are blocked: updates must arrive over WebSocket.
 for(const page of pages)await page.route('**/auth/match?*',route=>route.abort());
 for(const step of opening){
  const active=pages[step.player-1];
  const from=active.locator('#board .chess-square').nth(index(step.from));
  await from.waitFor({state:'visible'});
  await active.waitForFunction(s=>{const cell=document.querySelectorAll('#board .chess-square')[s];return cell&&!cell.disabled;},index(step.from));
  if(step.player===2){
   // CHESS-DRAG-P1: black plays by mouse drag & drop through the same authoritative POST.
   const a=await from.boundingBox(),b=await active.locator('#board .chess-square').nth(index(step.to)).boundingBox();
   await active.mouse.move(a.x+a.width/2,a.y+a.height/2);await active.mouse.down();
   await active.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await active.mouse.up();
  }else{
   await from.click();
   await active.locator('#board .chess-square').nth(index(step.to)).click();
  }
  let observed;
  const deadline=Date.now()+7000;
  while(Date.now()<deadline){
   observed=await read(base,users[0].token,id);
   if(observed.status===200&&observed.match.version>version)break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(observed.status,200);
  assert.equal(observed.match.version,version+1,'one click pair or one drag commits exactly one move');
  assert.equal(observed.match.state.history.at(-1).uci,step.from+step.to);
  state=observed.match.state;version=observed.match.version;
  await Promise.all(pages.map(page=>waitForPosition(page,state)));
 }
 assert.equal(state.winner,1,'server must detect white checkmate');
 assert.equal(state.history.length,opening.length);
 assert.match(state.history.at(-1).san,/#$/,'last move must be checkmate SAN');
 for(const page of pages){
  await page.waitForFunction(()=>/Partia zakończona|mat|wygrywają/i.test(document.querySelector('#game-state')?.textContent||'')||
   /Partia zakończona|mat|wygrywają/i.test(document.querySelector('#turn-label')?.textContent||''));
  assert.equal(await page.locator('#board .chess-square:not([disabled])').count(),0,
   'after checkmate neither player may move');
 }
 await pages[0].locator('#history-tab').click();
 await pages[0].waitForFunction(()=>document.querySelector('#moves-list')?.textContent.includes('e4'));
 await pages[0].locator('#chat-tab').click();
 // Reconnect restores the final persisted position with a full snapshot.
 await pages[1].reload({waitUntil:'domcontentloaded'});
 await waitForPosition(pages[1],state);
 const renderedPosition=page=>page.locator('#board .chess-square').evaluateAll(cells=>cells.map(cell=>cell.querySelector('svg')?.dataset.piece||'.'));
 assert.deepEqual(await renderedPosition(pages[0]),visible(state));
 assert.deepEqual(await renderedPosition(pages[1]),visible(state));

 // Premium invitations: two separate authenticated browser contexts, no mocked invitation API.
 const sender=await pages[0].context().newPage(),receiver=await pages[1].context().newPage();
 await Promise.all([sender.goto(base+'/konto/szachy/',{waitUntil:'domcontentloaded'}),
                    receiver.goto(base+'/konto/szachy/',{waitUntil:'domcontentloaded'})]);
 await Promise.all([sender.locator('#chess-invite-overlay').waitFor({state:'attached'}),
                    receiver.locator('#chess-invite-received').waitFor({state:'attached'})]);
 // Presence is derived from a real authenticated request, never fabricated.
 const recipientPresence=await receiver.evaluate(async()=>await (await fetch('/auth/friends/presence')).json());
 assert.equal(recipientPresence.ok,true);
 await sender.locator('#online-mode').click();
 await sender.locator('#create-room').click();
 await sender.locator('#chess-invite-overlay').waitFor({state:'visible'});
 const recipient=sender.locator('#chess-invite-friends .chess-invite-friend').filter({hasText:users[1].nickname});
 await recipient.waitFor({state:'visible',timeout:10000});
 assert.match(await recipient.innerText(),/Dostępny teraz/);
 await recipient.click();
 await sender.locator('#chess-invite-send').click();
 await sender.waitForFunction(()=>document.getElementById('chess-invite-status')?.textContent.includes('Zaproszenie wysłane'),{timeout:10000});
 await receiver.locator('#chess-invite-received').waitFor({state:'visible',timeout:16000});
 assert.match(await receiver.locator('#chess-invite-from').textContent(),new RegExp(users[0].nickname));
 await receiver.locator('#chess-invite-accept').click();
 await receiver.waitForURL(/\/konto\/szachy\/\?match=/,{timeout:15000});
 await sender.waitForURL(/\/konto\/szachy\/\?match=/,{timeout:16000});
 assert.equal(new URL(sender.url()).searchParams.get('match'),new URL(receiver.url()).searchParams.get('match'),'accepted invitation must navigate both participants into one match');
 // Offline appointment: use persisted presence (privacy-respecting friend status).
 await db.query("UPDATE gracz_public_identity.online_presence SET last_seen=now()-interval '1 hour' WHERE account_id=$1",[users[1].id]);
 await sender.locator('#create-room').click();
 const offline=sender.locator('#chess-invite-friends .chess-invite-friend').filter({hasText:users[1].nickname});
 await offline.waitFor({state:'visible'});
 assert.match(await offline.innerText(),/Niedostępny/);
 await offline.click();
 await sender.locator('#chess-invite-scheduled-view').waitFor({state:'visible'});
 const appointment=new Date(Date.now()+2*86400000);
 const date=[appointment.getFullYear(),String(appointment.getMonth()+1).padStart(2,'0'),String(appointment.getDate()).padStart(2,'0')].join('-');
 await sender.locator('#chess-invite-date').fill(date);
 await sender.locator('#chess-invite-time').fill('19:30');
 await sender.locator('#chess-invite-minutes').selectOption('10');
 await sender.locator('#chess-invite-bonus').selectOption('5');
 await sender.locator('#chess-invite-note').fill('Zapraszam w niedzielę na szachy.');
 await sender.locator('#chess-invite-schedule-send').click();
 await sender.waitForFunction(()=>document.getElementById('chess-invite-status')?.textContent.includes('Zaproszenie na'),{timeout:10000});
 const stored=await db.query("SELECT id,scheduled_at,time_limit_minutes,increment_seconds,invite_message,send_reminder,status FROM gracz_public_identity.game_challenges WHERE sender_id=$1 AND recipient_id=$2 AND scheduled_at IS NOT NULL ORDER BY created_at DESC LIMIT 1",[users[0].id,users[1].id]);
 assert.equal(stored.rowCount,1);
 const planned=stored.rows[0];
 assert.equal(planned.status,'pending');
 assert.equal(planned.time_limit_minutes,10);assert.equal(planned.increment_seconds,5);
 assert.equal(planned.invite_message,'Zapraszam w niedzielę na szachy.');
 assert.equal(planned.send_reminder,true);
 await receiver.locator('#chess-invite-received').waitFor({state:'visible',timeout:16000});
 await receiver.waitForFunction(()=>document.getElementById('chess-invite-received-text')?.textContent.includes('Zaproszenie na'),{timeout:16000});
 assert.equal(await receiver.locator('#chess-invite-accept').innerText(),'Akceptuj termin');
 await receiver.locator('#chess-invite-accept').click();
 await receiver.waitForFunction(()=>document.getElementById('chess-invite-status')?.textContent.includes('Termin zaakceptowany'),{timeout:10000});
 const booked=await db.query("SELECT status FROM gracz_public_identity.game_challenges WHERE id=$1",[planned.id]);
 assert.equal(booked.rows[0].status,'accepted');
 const early=await read(base,users[0].token,planned.id);
 assert.equal(early.status,409);
 assert.equal(early.error,'PARTIA_ZAPLANOWANA');
 await sender.close();await receiver.close();
 console.log('CHESS_TWO_CHROMIUM_WINDOWS_PASS',{clickedMoves:opening.length,contexts:2,version,clock:'5m+2s',transport:'WebSocket',winner:state.winner,checkmate:true});
});

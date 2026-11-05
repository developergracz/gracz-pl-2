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
const glyph={r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',p:'♟',R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔',P:'♙'};
function visible(state){
 const out=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)out.push(glyph[state.board[r*16+c]]||'');
 return out;
}
async function waitForPosition(page,state){
 await page.waitForFunction(expected=>{
  const squares=[...document.querySelectorAll('#board .chess-square')];
  return squares.length===64&&squares.every((node,i)=>node.textContent===expected[i]);
 },visible(state),{timeout:10000});
}
test('two isolated Chromium windows play chess by clicking squares with WebSocket updates and reconnect', {timeout:120000},async t=>{
 const db=createDatabase(),users=[];
 t.after(async()=>{try{for(const u of users)await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[u.id]);}finally{await db.close();}});
 await createPublicIdentityRouter({database:db,emailFrom:'browser@example.invalid',resendKey:'local-only'}).probe();
 for(const player of [1,2]){
  const id=randomUUID(),token=randomBytes(32).toString('hex'),nick='Chess'+player+'_'+id.replaceAll('-','');
  await db.query('INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES($1,$2,$2,$3,$4,$4,now())',
   [id,nick,nick+'@example.invalid',Buffer.alloc(64)]);
  await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash(token),id]);
  users.push({id,token,player});
 }
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
 for(const id of ['training-settings','training-records','training-time','training-increment','clock-1','clock-2']){
  assert.equal(await local.locator('#'+id).isVisible(),true,id+' should be visible');
 }
 assert.equal(await local.locator('.premium-quick-links .premium-mini-link:visible').count(),6);
 assert.equal(await local.locator('.side-dock > .game-tools .tool-btn').count(),7);
 await local.locator('#training-time').selectOption('1');
 await local.locator('#training-increment').selectOption('2');
 await local.locator('#board .chess-square').nth(52).click();
 await local.locator('#board .chess-square').nth(36).click();
 await local.waitForFunction(()=>document.getElementById('clock-1')?.textContent!=='01:00',{timeout:5000});
 await local.locator('#undo-move').click();
 assert.equal(await local.locator('#move-count').textContent(),'Ruchy: 0');
 await local.locator('#focus-game').click();
 assert.equal(await local.locator('body').evaluate(x=>x.classList.contains('chess-board-focus')),true);
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
  await page.waitForFunction(()=>document.querySelectorAll('.chess-chat-message').length===3,{timeout:10000});
  const chat=await page.locator('#chat-messages').innerText();
  assert.match(chat,/Witaj przy szachownicy!/);
  assert.match(chat,/Cześć, zaczynajmy!/);
  assert.match(chat,/Powodzenia!/);
  assert.match(chat,/Chess1_/);
  assert.match(chat,/Chess2_/);
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
 const opening=[
  {player:1,from:'e2',to:'e4'},{player:2,from:'e7',to:'e5'},
  {player:1,from:'g1',to:'f3'},{player:2,from:'b8',to:'c6'}
 ];
 const index=s=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
 // Once synchronized, browser GET snapshots are blocked: updates must arrive over WebSocket.
 for(const page of pages)await page.route('**/auth/match?*',route=>route.abort());
 for(const step of opening){
  const active=pages[step.player-1];
  const from=active.locator('#board .chess-square').nth(index(step.from));
  await from.waitFor({state:'visible'});
  await active.waitForFunction(s=>{const cell=document.querySelectorAll('#board .chess-square')[s];return cell&&!cell.disabled;},index(step.from));
  await from.click();
  await active.locator('#board .chess-square').nth(index(step.to)).click();
  let observed;
  const deadline=Date.now()+7000;
  while(Date.now()<deadline){
   observed=await read(base,users[0].token,id);
   if(observed.status===200&&observed.match.version>version)break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(observed.status,200);
  assert.equal(observed.match.version,version+1,'one click pair commits exactly one move');
  assert.equal(observed.match.state.history.at(-1).uci,step.from+step.to);
  state=observed.match.state;version=observed.match.version;
  await Promise.all(pages.map(page=>waitForPosition(page,state)));
 }
 await pages[0].locator('#history-tab').click();
 await pages[0].waitForFunction(()=>document.querySelector('#moves-list')?.textContent.includes('e4'));
 await pages[0].locator('#chat-tab').click();
 // Reconnect restores the final persisted position with a full snapshot.
 await pages[1].reload({waitUntil:'domcontentloaded'});
 await waitForPosition(pages[1],state);
 assert.deepEqual(await pages[0].locator('#board .chess-square').allTextContents(),
  await pages[1].locator('#board .chess-square').allTextContents());
 console.log('CHESS_TWO_CHROMIUM_WINDOWS_PASS',{clickedMoves:opening.length,contexts:2,version,clock:'5m+2s',transport:'WebSocket'});
});

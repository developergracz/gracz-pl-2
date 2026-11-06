// Two real Chromium browser windows click actual console squares (not synthetic API moves).
// The only network is local PostgreSQL, Valkey and the disposable HTTP+WebSocket service.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {assertDisposableDatabaseUrl} from '../integration/test-database-guard.mjs';
import {playMove} from '../auth/game-engine.mjs';

const origin='https://gracz-contact-api.onrender.com';
assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const redis=new URL(process.env.GAME_REDIS_URL||'');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(redis.hostname),'Only a disposable local Valkey is allowed');
const hash=x=>createHash('sha256').update(x).digest();
async function spawn(t){
 const child=fork(new URL('./browser-instance.mjs',import.meta.url),{
  env:{...process.env},stdio:['ignore','pipe','pipe','ipc']});
 let errors='';child.stderr.on('data',x=>errors+=x.toString());
 t.after(async()=>{
  if(child.exitCode!==null||child.signalCode)return;
  const ended=once(child,'exit');child.kill('SIGKILL');await ended;
 });
 const ready=await Promise.race([once(child,'message'),
  once(child,'exit').then(()=>{throw Error('Browser server died: '+errors.slice(-800));})]);
 return 'http://localhost:'+ready[0].port;
}
async function api(base,token,path){
 const r=await fetch(base+path,{headers:{Cookie:'__Host-gracz_session='+token,Origin:origin}});
 return {status:r.status,...await r.json()};
}
function legal(state,ply){
 const options=[];
 for(let from=0;from<64;from++)if([state.turn,state.turn+2].includes(state.board[from])){
  for(let to=0;to<64;to++){
   if(Math.abs(Math.floor(to/8)-Math.floor(from/8))!==Math.abs(to%8-from%8)||state.board[to])continue;
   const tested=playMove('warcaby',state,state.turn,{from,to});
   if(tested.error)continue;
   const captured=state.board.filter(Boolean).length-tested.state.board.filter(Boolean).length;
   const crown=state.board[from]<=2&&tested.state.board[to]>2?1:0;
   options.push({from,to,expected:tested.state,score:captured*100+crown*25+(from*73+to*37+ply*23+11)%47});
  }
 }
 assert.ok(options.length,'an active agent must have a legal move');
 options.sort((a,b)=>b.score-a.score||a.from-b.from||a.to-b.to);
 return options[0];
}
async function visibleBoard(page){
 return page.locator('#board .square').evaluateAll(items=>items.map(x=>{
  const piece=x.querySelector('.piece');if(!piece)return 0;
  const p=piece.classList.contains('white')?1:2;
  return piece.classList.contains('king')?p+2:p;
 }));
}
async function waitForBoard(page,expected){
 await page.waitForFunction(board=>{
  const squares=[...document.querySelectorAll('#board .square')];
  if(squares.length!==64)return false;
  return squares.every((x,i)=>{
   const piece=x.querySelector('.piece');
   const n=piece?(piece.classList.contains('white')?1:2)+(piece.classList.contains('king')?2:0):0;
   return n===board[i];
  });
 },expected,{timeout:7500});
}

test('two independent Chromium windows click Warcaby moves with shared live board and clocks',
 {timeout:180000},async t=>{
 const db=createDatabase(),users=[];
 t.after(async()=>{try{for(const u of users)
   await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[u.id]);}
   finally{await db.close();}});
 await createPublicIdentityRouter({database:db,emailFrom:'browser@example.invalid',resendKey:'local-only'}).probe();
 for(const role of [1,2]){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  const nick='Chrome'+role+'_'+id.replaceAll('-','');
  await db.query('INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES($1,$2,$2,$3,$4,$4,now())',
   [id,nick,nick+'@example.invalid',Buffer.alloc(64)]);
  await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash(token),id]);
  users.push({id,token,role});
 }
 const matchId=randomUUID();
 await db.query("INSERT INTO gracz_public_identity.game_challenges(id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds) VALUES($1,$2,$3,'warcaby','accepted',7,2)",
  [matchId,users[0].id,users[1].id]);
 const base=await spawn(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(async()=>browser.close());
 // Two isolated Chrome browser contexts: their cookies/localStorage cannot leak.
 const contexts=[],pages=[];
 for(const user of users){
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  contexts.push(context);t.after(async()=>context.close());
  await context.addCookies([{name:'__Host-gracz_session',value:user.token,url:base.replace('http:','https:')+'/',
   httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>console.error('BROWSER_PAGE_ERROR',user.role,e.message));
  await page.goto(base+'/konto/warcaby/?match='+matchId,{waitUntil:'domcontentloaded'});
  await page.locator('#board .square').first().waitFor({timeout:12000});
  await page.waitForFunction(()=>document.querySelectorAll('#board .square').length===64);
 }
 // Check the premium invitation form in a real browser (no new DB challenges).
 const form=pages[0];
 assert.equal(await form.locator('#create-room-time').isVisible(),true);
 assert.equal(await form.locator('#create-room-increment').isVisible(),true);
 await form.locator('#create-room-time').selectOption('0');
 assert.equal(await form.locator('#create-room-increment').isDisabled(),true);
 assert.equal(await form.locator('#create-room-increment').inputValue(),'0');
 await form.locator('#create-room-time').selectOption('7');
 assert.equal(await form.locator('#create-room-increment').isEnabled(),true);
 await form.locator('#create-room-increment').selectOption('2');
 await form.locator('#create-room-friend').fill('ClockContractGuest');
 let invitationPayload=null;
 await form.route('**/auth/social/challenges',async route=>{
  if(route.request().method()!=='POST')return route.continue();
  invitationPayload=route.request().postDataJSON();
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,id:randomUUID()})});
 });
 await form.locator('#create-room').click();
 await form.waitForFunction(()=>document.getElementById('create-room-status')?.textContent.includes('Zaproszenie wysłane'));
 assert.deepEqual({game:invitationPayload?.game,timeLimitMinutes:invitationPayload?.timeLimitMinutes,
   incrementSeconds:invitationPayload?.incrementSeconds},{game:'warcaby',timeLimitMinutes:7,incrementSeconds:2});
 await form.unroute('**/auth/social/challenges');
 let response=await api(base,users[0].token,'/auth/match?id='+matchId);
 assert.equal(response.status,200);
 assert.deepEqual(response.match.state.clock.ready,[true,true]);
 assert.ok(response.match.state.clock.since,'both authenticated browser windows joined a timed game');
 let state=response.match.state,version=response.match.version;
 await Promise.all(pages.map(p=>waitForBoard(p,state.board)));
 assert.equal((await visibleBoard(pages[0])).filter(Boolean).length,24);
 assert.equal((await visibleBoard(pages[1])).filter(Boolean).length,24);
 const firstClock=await pages[0].locator('#clock-2').textContent();
 assert.match(firstClock,/\d\d:\d\d/,'visible clock on browser console');

 let plies=0,captures=0,consecutive=0;
 for(;plies<180&&!state.winner;plies++){
  const active=pages[state.turn-1],passive=pages[2-state.turn];
  const candidate=legal(state,plies);
  if(state.forced!==null)consecutive++;
  if(state.board.filter(Boolean).length>candidate.expected.board.filter(Boolean).length)captures++;
  // Real mouse clicks on two DOM gridcell buttons; no direct move API request here.
  await active.locator('#board .square').nth(candidate.from).click({timeout:5000});
  await active.locator('#board .square').nth(candidate.to).click({timeout:5000});
  const targetVersion=version+1;
  const start=Date.now();
  do{
   response=await api(base,users[0].token,'/auth/match?id='+matchId);
   if(response.status===200&&response.match.version>=targetVersion)break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }while(Date.now()-start<6000);
  assert.equal(response.status,200);
  assert.equal(response.match.version,targetVersion,'mouse clicks must commit exactly one move');
  assert.deepEqual(response.match.state.board,candidate.expected.board,'browser move follows server rules');
  state=response.match.state;version=response.match.version;
  await Promise.all([waitForBoard(active,state.board),waitForBoard(passive,state.board)]);
  assert.deepEqual(await visibleBoard(passive),state.board,'second window visually synchronizes board');
 }
 assert.ok(plies>=12,'agents clicked a meaningful sequence of moves');
 assert.ok(captures>0,'real mouse clicks included compulsory captures');
 assert.ok(state.winner,'agents reached the final result');
 assert.deepEqual(await visibleBoard(pages[0]),await visibleBoard(pages[1]));
 console.log('TWO_CHROMIUM_WINDOWS_PASS',{
  clickedMoves:plies,captures,multiCaptureSteps:consecutive,
  winner:state.winner,version,contexts:2,browser:'Chromium',clock:'7m+2s'});
});

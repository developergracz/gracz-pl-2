// Browser acceptance: real mouse clicks in two separate Chromium sessions.
// Uses ONLY disposable localhost PostgreSQL/Valkey, not production accounts/data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {assertDisposableDatabaseUrl} from '../integration/test-database-guard.mjs';

assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const redis=new URL(process.env.GAME_REDIS_URL||'');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(redis.hostname),'local disposable Valkey required');
const origin='https://gracz-contact-api.onrender.com';
const digest=x=>createHash('sha256').update(x).digest();

async function serve(t){
 const child=fork(new URL('./browser-instance.mjs',import.meta.url),{
  env:{...process.env},stdio:['ignore','pipe','pipe','ipc']
 });
 let errors='';child.stderr.on('data',chunk=>errors+=chunk.toString());
 t.after(async()=>{
  if(child.exitCode!==null||child.signalCode)return;
  const end=once(child,'exit');child.kill('SIGKILL');await end;
 });
 const ready=await Promise.race([
  once(child,'message'),
  once(child,'exit').then(()=>{throw Error('local browser API exited: '+errors.slice(-1000));})
 ]);
 return 'http://localhost:'+ready[0].port;
}
async function read(base,token,id){
 const response=await fetch(base+'/auth/match?id='+id,{
  headers:{Cookie:'__Host-gracz_session='+token,Origin:origin}
 });
 return {status:response.status,...await response.json()};
}
async function visible(page){
 return page.locator('#board .cell').evaluateAll(nodes=>nodes.map(node=>
  node.classList.contains('p1')?1:node.classList.contains('p2')?2:0));
}
async function boardIs(page,expected){
 await page.waitForFunction(board=>{
  const cells=[...document.querySelectorAll('#board .cell')];
  return cells.length===225&&cells.every((c,i)=>
   (c.classList.contains('p1')?1:c.classList.contains('p2')?2:0)===board[i]);
 },expected,{timeout:10000});
}
test('two Chromium users click full online Gomoku game, see sync and 5-in-line winner',
 {timeout:120000},async t=>{
 const db=createDatabase(),accounts=[];
 t.after(async()=>{try{
  for(const a of accounts)await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[a.id]);
 }finally{await db.close();}});
 await createPublicIdentityRouter({database:db,emailFrom:'browser@example.invalid',resendKey:'local-only'}).probe();
 for(const side of [1,2]){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  const nick='GomokuChrome'+side+'_'+id.replaceAll('-','');
  await db.query('INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES($1,$2,$2,$3,$4,$4,now())',
   [id,nick,nick+'@example.invalid',Buffer.alloc(64)]);
  await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[digest(token),id]);
  accounts.push({id,token,side});
 }
 const matchId=randomUUID();
 await db.query("INSERT INTO gracz_public_identity.game_challenges(id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds) VALUES($1,$2,$3,'gomoku','accepted',7,2)",
  [matchId,accounts[0].id,accounts[1].id]);
 const base=await serve(t);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 t.after(async()=>browser.close());
 const pages=[];
 for(const a of accounts){
  const context=await browser.newContext({viewport:{width:1600,height:900}});
  t.after(async()=>context.close());
  await context.addCookies([{name:'__Host-gracz_session',value:a.token,
   url:base.replace('http:','https:')+'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  page.on('pageerror',error=>console.error('GOMOKU_BROWSER_PAGE_ERROR',a.side,error.message));
  await page.goto(base+'/konto/gomoku/?match='+matchId,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#board .cell').length===225);
  await page.locator('#room-select').selectOption(matchId,{timeout:12000});
  await page.locator('#join-room').click();
  pages.push(page);
 }
 let current=await read(base,accounts[0].token,matchId);
 assert.equal(current.status,200);
 assert.deepEqual(current.match.state.clock.ready,[true,true]);
 assert.equal(current.match.state.clock.incrementMs,2000);
 assert.ok(current.match.state.clock.since);
 let board=current.match.state.board,version=current.match.version;
 await Promise.all(pages.map(page=>boardIs(page,board)));
 // White/black order is determined by the authoritative server: player 1 begins.
 // Player 1 makes five along a middle row; player 2 replies in a remote row.
 const sequence=[112,0,113,1,114,2,115,3,116];
 let clicks=0;
 for(const to of sequence){
  const player=current.match.state.turn,active=pages[player-1],passive=pages[2-player];
  assert.equal(board[to],0);
  await active.locator('#board .cell').nth(to).click({timeout:6000});
  const expectedVersion=version+1;
  const start=Date.now();
  do{
   current=await read(base,accounts[0].token,matchId);
   if(current.match?.version>=expectedVersion)break;
   await new Promise(resolve=>setTimeout(resolve,80));
  }while(Date.now()-start<6000);
  assert.equal(current.status,200);
  assert.equal(current.match.version,expectedVersion,'one browser click creates exactly one move');
  assert.equal(current.match.state.board[to],player,'clicked stone is persisted by server');
  board=current.match.state.board;version=current.match.version;clicks++;
  await Promise.all([boardIs(active,board),boardIs(passive,board)]);
  assert.deepEqual(await visible(passive),board,'remote Chromium window shows each stone');
 }
 assert.equal(current.match.state.winner,1,'five stones in a row must end the match');
 assert.equal(current.match.state.moves,9);
 assert.deepEqual(await visible(pages[0]),await visible(pages[1]));
 assert.equal(await pages[0].locator('#board .cell.win-line').count(),5,
  'premium console highlights the five decisive stones');
 console.log('TWO_CHROMIUM_GOMOKU_PASS',{clicks,winner:1,version,
  windows:2,cells:225,clock:'7m+2s',winLine:5});
});

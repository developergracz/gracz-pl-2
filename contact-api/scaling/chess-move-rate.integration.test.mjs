// CHESS-001 (P0): disposable PostgreSQL + Valkey + the production router/console/WebSocket hub.
// Legal fast play must not be rate-limited; floods, forged and stale moves must still be rejected.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {connect} from 'node:net';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {assertDisposableDatabaseUrl} from '../integration/test-database-guard.mjs';

const origin='https://gracz-contact-api.onrender.com',hash=x=>createHash('sha256').update(x).digest();
assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const redis=new URL(process.env.GAME_REDIS_URL||'');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(redis.hostname),'Only local disposable Valkey permitted');
// Verified legal sequence (no mate, stalemate, 5-fold or 75-move end within 240 half-moves).
const PLIES=('d2d3 f7f5 d1d2 d7d6 e1d1 c7c5 d2c3 c8e6 a2a4 e6f7 c3b4 c5c4 b1d2 f7d5 g1f3 d5e4 b4d6 e4f3 d3c4 d8c7 '+
 'a1a3 g7g5 g2g3 f3g2 d6a6 c7c5 a6b5 g2c6 f2f4 c5b5 d2f3 b5a4 c1d2 g8f6 d1c1 g5f4 h2h4 a4b5 d2e1 b7b6 a3a6 b8a6 g3f4 f6g4 '+
 'f3h2 a6b8 e1a5 e8d8 b2b3 b5a4 h1g1 d8c7 h4h5 h8g8 a5e1 h7h6 f1h3 a4b4 c2c3 c6d5 c4d5 b4a4 b3a4 b6b5 e1g3 b5b4 h2f3 b8a6 '+
 'g3h2 g4e3 c3b4 e3d1 g1g2 g8g4 c1c2 e7e6 d5e6 g4h4 a4a5 d1c3 e2e3 a6c5 g2g5 c7c8 h3f5 c8c7 f3e1 c3d5 h2g3 d5f6 f5h7 f8e7 '+
 'e1d3 f6d5 g5e5 a8d8 c2c1 d8d6 d3f2 c7c6 c1c2 c6c7 f2h3 h4f4 h3g1 c7c8 e5g5 c8d8 g3f2 d5c3 g5d5 c5e4 f2g3 e7f6 d5g5 e4g5 '+
 'b4b5 d6d7 g3e1 d7d4 g1e2 f6e5 e6e7 d8c7 b5b6 c7c8 e7e8n d4d5 c2b3 d5b5 b3c2 f4f6 e1g3 b5b2 c2b2 c3b1 b2b3 g5e6 e2c3 e5c7 '+
 'h7d3 b1a3 d3a6 c8d7 b6c7 e6d4 e3d4 f6d6 c7c8b d7e8 c3b1 e8f8 g3e1 f8g8 b3c3 g8h8 e1d2 h8g7 d2g5 g7f7 g5e7 d6e6 a6b5 a3b1 '+
 'c3b3 e6e7 c8a6 e7d7 b5d7 b1c3 d7e6 f7f8 a6c8 a7a6 b3a3 f8e8 e6f5 c3a4 f5d3 a4b2 c8d7 e8f7 d3e2 b2c4 a3a4 f7g8 d7e6 g8f8 '+
 'e2d1 c4d6 e6a2 f8e7 d1c2 d6b7 c2b1 b7c5 a4b4 e7d7 b4a3 d7c7 b1h7 c5e6 a3b3 e6d8 b3c2 d8f7 a2b3 c7b7 h7f5 b7c7 f5h3 f7d6 '+
 'h3g2 d6c8 b3a4 c7d8 g2f1 d8e7 c2d1 e7d8 d1e2 c8e7 a4b3 e7f5 b3c4 d8e7 c4d5 f5g3 e2d1 g3e2 d5a2 e2d4 a2c4 e7e8 d1e1 d4f5 '+
 'e1f2 e8d8 c4g8 f5e3').split(' ');

async function spawn(t){
 const child=fork(new URL('./browser-instance.mjs',import.meta.url),{env:{...process.env},stdio:['ignore','pipe','pipe','ipc']});
 let errors='';child.stderr.on('data',x=>errors+=x.toString());
 t.after(async()=>{if(child.exitCode!==null||child.signalCode)return;const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;});
 const ready=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error('Server died: '+errors.slice(-1200));})]);
 return 'http://localhost:'+ready[0].port;
}
async function accounts(t,db,n){
 const users=[];
 t.after(async()=>{for(const u of users)await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[u.id]);});
 for(let i=0;i<n;i++){
  const id=randomUUID(),token=randomBytes(32).toString('hex'),nick='Rate'+i+'_'+id.replaceAll('-','').slice(0,10);
  await db.query('INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES($1,$2,$3,$4,$5,$5,now())',
   [id,nick,nick.toLowerCase(),nick.toLowerCase()+'@example.invalid',Buffer.alloc(64)]);
  await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[hash(token),id]);
  users.push({id,token,nickname:nick});
 }
 return users;
}
async function challenge(db,a,b,minutes=0){
 await db.query("INSERT INTO gracz_public_identity.friend_connections(account_a,account_b,requested_by,status) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,'accepted') ON CONFLICT DO NOTHING",[a.id,b.id]);
 const id=randomUUID();
 await db.query("INSERT INTO gracz_public_identity.game_challenges(id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds) VALUES($1,$2,$3,'szachy','accepted',$4,0)",[id,a.id,b.id,minutes]);
 return id;
}
function api(base){
 return async(u,method,path,body,{headerOrigin=origin,cookie}={})=>{
  const headers={Origin:headerOrigin,Cookie:cookie??'__Host-gracz_session='+u.token};
  if(body!==undefined)headers['Content-Type']='application/json';
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,...await r.json()};
 };
}
const stored=async(db,id)=>(await db.query('SELECT state,version FROM gracz_public_identity.game_matches WHERE challenge_id=$1',[id])).rows[0];

test('CHESS-001: 200+ legal half-moves in < 15 min without 429; floods and forged moves still rejected',{timeout:120000},async t=>{
 const db=createDatabase();t.after(()=>db.close());
 await createPublicIdentityRouter({database:db,emailFrom:'rate@example.invalid',resendKey:'local-only'}).probe();
 const base=await spawn(t),call=api(base);
 const [P,Q,F,G,U]=await accounts(t,db,5);
 const started=Date.now();
 // Game 1 (untimed): 180 half-moves -> 90 POSTs per account, above the old 80/15 min budget.
 const g1=await challenge(db,P,Q);
 let m=(await call(P,'GET','/auth/match?id='+g1)).match;
 const statuses=[];
 for(const uci of PLIES.slice(0,180)){
  const r=await call(m.state.turn===1?P:Q,'POST','/auth/match',{id:g1,version:m.version,move:{uci}});
  statuses.push(r.status);assert.equal(r.status,200,'half-move '+statuses.length+' '+uci+': '+JSON.stringify(r).slice(0,160));
  m=r.match;
 }
 // Game 2 (1 minute): the first move after 90 legal moves is accepted and the clock is charged correctly.
 const g2=await challenge(db,P,Q,1);
 await call(P,'GET','/auth/match?id='+g2);
 m=(await call(Q,'GET','/auth/match?id='+g2)).match;
 assert.ok(m.state.clock.since,'clock starts when both players opened the room');
 const first=await call(P,'POST','/auth/match',{id:g2,version:m.version,move:{uci:'e2e4'}});
 assert.equal(first.status,200,JSON.stringify(first));
 assert.equal(first.match.state.turn,2);assert.equal(first.match.state.winner,0);
 assert.ok(first.match.state.clock.remaining[0]>50000&&first.match.state.clock.remaining[0]<=60000,'only the time actually used is charged');
 m=first.match;
 for(const uci of ['e7e5','g1f3','b8c6','f1c4','g8f6','d2d3','f8c5','e1g1','e8g8','c2c3','d7d6','b1d2','a7a6','a2a4','c8e6','c4e6','f7e6','d1b3','d8d7']){
  const r=await call(m.state.turn===1?P:Q,'POST','/auth/match',{id:g2,version:m.version,move:{uci}});
  statuses.push(r.status);assert.equal(r.status,200,uci+': '+JSON.stringify(r).slice(0,160));m=r.match;
 }
 statuses.push(first.status);
 assert.ok(statuses.length>=200,'at least 200 legal half-moves');
 assert.ok(Date.now()-started<15*60000);
 assert.equal(statuses.filter(s=>s===429).length,0,'no legal move hit the limiter');
 assert.equal(m.state.winner,0);
 // Flood from one account: 120 requests pass the limiter (stale version -> 409), the 121st is 429.
 const gf=await challenge(db,F,G);
 const fm=(await call(F,'GET','/auth/match?id='+gf)).match;
 for(let i=0;i<120;i++)assert.equal((await call(F,'POST','/auth/match',{id:gf,version:fm.version+7,move:{uci:'e2e4'}})).status,409);
 const flooded=await call(F,'POST','/auth/match',{id:gf,version:fm.version,move:{uci:'e2e4'}});
 assert.equal(flooded.status,429);assert.equal(flooded.error,'ZBYT_WIELE_PROB');
 assert.equal((await call(F,'POST','/auth/match',{id:randomUUID(),version:0,move:{uci:'e2e4'}})).status,429,'fresh match ids do not bypass the budget');
 assert.equal((await stored(db,gf)).version,fm.version,'a throttled request never changes the match');
 assert.equal((await call(G,'POST','/auth/match',{id:gf,version:fm.version,move:{uci:'e7e5'}})).error,'NIE_TWOJA_TURA','other accounts are unaffected');
 // Unchanged guards for moves.
 const v=m.version,side=m.state.turn===1?P:Q,other=side===P?Q:P;
 assert.equal((await call(side,'POST','/auth/match',{id:g2,version:v,move:{uci:'a1a1'}},{headerOrigin:'https://evil.example'})).status,403,'CSRF');
 assert.equal((await call(side,'POST','/auth/match',{id:g2,version:v,move:{uci:'a2a3'}},{cookie:'__Host-gracz_session='+'0'.repeat(64)})).status,401,'bad token');
 assert.equal((await call(F,'POST','/auth/match',{id:g2,version:v,move:{uci:'a2a3'}})).status,429,'flooded account stays throttled');
 assert.equal((await call(G,'POST','/auth/match',{id:g2,version:v,move:{uci:'a2a3'}})).status,404,'foreign match');
 assert.equal((await call(other,'POST','/auth/match',{id:g2,version:v,move:{uci:'a7a6'}})).error,'NIE_TWOJA_TURA');
 assert.equal((await call(side,'POST','/auth/match',{id:g2,version:v,move:{uci:'h2h5'}})).error,'NIEDOZWOLONY_RUCH');
 assert.equal((await call(side,'POST','/auth/match',{id:g2,version:v-1,move:{uci:'h2h3'}})).error,'ODSWIEZ_PARTIE','stale version');
 const ok=await call(side,'POST','/auth/match',{id:g2,version:v,move:{uci:side===P?'h2h3':'h7h6'}});
 assert.equal(ok.status,200);
 assert.equal((await call(side,'POST','/auth/match',{id:g2,version:v,move:{uci:side===P?'h2h3':'h7h6'}})).error,'ODSWIEZ_PARTIE','duplicate');
 // Chat (40) and undo (20) keep their 15-minute budgets.
 const gu=await challenge(db,U,G);await call(U,'GET','/auth/match?id='+gu);
 for(let i=1;i<=40;i++)assert.equal((await call(U,'POST','/auth/match/chat',{id:gu,message:'test '+i})).status,200);
 assert.equal((await call(U,'POST','/auth/match/chat',{id:gu,message:'41'})).status,429);
 for(let i=1;i<=20;i++)assert.notEqual((await call(U,'POST','/auth/match/undo',{id:gu,version:0,action:'request'})).status,429);
 assert.equal((await call(U,'POST','/auth/match/undo',{id:gu,version:0,action:'request'})).status,429);
 // At most two in-flight request bodies per session.
 const url=new URL(base);
 const slow=()=>new Promise(resolve=>{const s=connect(Number(url.port),'127.0.0.1',()=>{s.write('POST /auth/match HTTP/1.1\r\nHost: localhost\r\nOrigin: '+origin+'\r\nCookie: __Host-gracz_session='+G.token+'\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{"id":');resolve(s);});});
 const held=[await slow(),await slow()];
 await new Promise(r=>setTimeout(r,300));
 const third=await call(G,'POST','/auth/match',{id:gf,version:0,move:{uci:'e7e5'}});
 assert.equal(third.status,429,'third concurrent body from one session is rejected');
 for(const s of held)s.destroy();
 console.log('CHESS_001_API_PASS',{halfMoves:statuses.length,postsPerAccount:{P:Math.ceil(statuses.length/2),Q:Math.floor(statuses.length/2)},seconds:Math.round((Date.now()-started)/1000)});
});

test('CHESS-001: two Chromium players over WebSocket after 85+ moves each; a throttled click is explicit and harmless',{timeout:150000},async t=>{
 const db=createDatabase();t.after(()=>db.close());
 await createPublicIdentityRouter({database:db,emailFrom:'rate@example.invalid',resendKey:'local-only'}).probe();
 const base=await spawn(t),call=api(base);
 const [A,B]=await accounts(t,db,2);
 const warm=await challenge(db,A,B);
 let m=(await call(A,'GET','/auth/match?id='+warm)).match;
 for(const uci of PLIES.slice(0,172)){const r=await call(m.state.turn===1?A:B,'POST','/auth/match',{id:warm,version:m.version,move:{uci}});assert.equal(r.status,200,uci);m=r.match;}
 const id=await challenge(db,A,B,1);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(()=>browser.close());
 const pages=[],pageErrors=[];
 for(const u of [A,B]){
  const ctx=await browser.newContext({viewport:{width:1600,height:900}});t.after(()=>ctx.close());
  await ctx.addCookies([{name:'__Host-gracz_session',value:u.token,url:base.replace('http:','https:')+'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await ctx.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base+'/konto/szachy/?match='+id,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#board .chess-square').length===64);
  pages.push(page);
 }
 // CHESS-003: both real sessions see different orientations. Always use 0x88 logical square identity.
 const index=s=>(8-Number(s[1]))*16+'abcdefgh'.indexOf(s[0]);
 const square=(page,s)=>page.locator('#board .chess-square[data-square="'+index(s)+'"]');
 const piece=(page,s)=>square(page,s).evaluate(c=>c.querySelector('svg')?.dataset.piece||'.');
 let deadline=Date.now()+10000,row;
 while(Date.now()<deadline&&!(row=await stored(db,id))?.state?.clock?.since)await new Promise(r=>setTimeout(r,100));
 assert.ok(row.state.clock.since,'both browsers joined, clock running');
 for(const page of pages)await page.route('**/auth/match?*',route=>route.abort()); // updates must arrive via WebSocket
 async function click(page,from,to){
  await page.waitForFunction(s=>!document.querySelector('#board .chess-square[data-square="'+s+'"]').disabled,index(from),{timeout:10000});
  await square(page,from).click();
  await square(page,to).click();
 }
 async function nextVersion(v){const end=Date.now()+10000;while(Date.now()<end){const r=await stored(db,id);if(r.version>v)return r;await new Promise(x=>setTimeout(x,100));}throw Error('no update');}
 let s=await stored(db,id);
 for(const [p,from,to] of [[0,'e2','e4'],[1,'e7','e5'],[0,'g1','f3'],[1,'b8','c6']]){
  await click(pages[p],from,to);s=await nextVersion(s.version);
  assert.equal(s.state.history.at(-1).uci,from+to);assert.equal(s.state.winner,0);
  for(const page of pages)await page.waitForFunction(s=>(document.querySelector('#board .chess-square[data-square="'+s+'"]')?.querySelector('svg')?.dataset.piece||'.')!=='.',index(to),{timeout:10000});
 }
 assert.ok(s.state.clock.remaining.every(x=>x>45000),'no false time loss after earlier fast games: '+JSON.stringify(s.state.clock.remaining));
 assert.deepEqual(await pages[1].locator('.clock-running').evaluateAll(n=>n.map(x=>x.id)),['clock-2'],'white to move on both screens');
 // Burst from the same account in another tool exhausts the 60 s budget; the next click is refused explicitly.
 for(let i=0;i<120;i++)await call(A,'POST','/auth/match',{id,version:s.version+50,move:{uci:'f1c4'}});
 const before=await stored(db,id);
 await click(pages[0],'f1','c4');
 await pages[0].waitForFunction(()=>/Zbyt wiele żądań/.test(document.getElementById('game-state').textContent),null,{timeout:10000});
 const after=await stored(db,id);
 assert.equal(after.version,before.version,'throttled click does not change the authoritative match');
 assert.equal(after.state.clock.since,before.state.clock.since,'clock keeps running for the side to move (server-authoritative)');
 assert.equal(await piece(pages[0],'f1'),'B','board resynchronised to the server position');
 assert.equal(await piece(pages[0],'c4'),'.');
 assert.match(await pages[0].locator('#game-state').textContent(),/Ruch nieprzyjęty: Zbyt wiele żądań/,'explicit error state (its visibility is tracked as CHESS-002)');
 assert.equal(await piece(pages[1],'c4'),'.','opponent sees no phantom move');
 assert.deepEqual(pageErrors,[],'no uncaught browser errors');
 console.log('CHESS_001_BROWSER_PASS',{warmupHalfMoves:172,version:after.version,remaining:after.state.clock.remaining});
});

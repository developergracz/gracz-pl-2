import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {createServer,connect} from 'node:net';
import {createClient} from '@redis/client';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {assertDisposableDatabaseUrl} from '../integration/test-database-guard.mjs';
const host='https://gracz-contact-api.onrender.com';
const hash=x=>createHash('sha256').update(x).digest();
assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const redis=new URL(process.env.GAME_REDIS_URL);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(redis.hostname),'Local disposable Valkey required');
async function instance(t,redisUrl=process.env.GAME_REDIS_URL){
 const child=fork(new URL('./instance.mjs',import.meta.url),{stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,GAME_REDIS_URL:redisUrl}});
 let logs='';child.stderr.on('data',x=>logs+=x);
 t.after(async()=>{if(child.exitCode!==null||child.signalCode)return;const done=once(child,'exit');child.kill('SIGKILL');await done;});
 const ready=await Promise.race([once(child,'message'),once(child,'exit').then(()=>{throw Error(logs||'instance exited');})]);
 return {child,base:'http://127.0.0.1:'+ready[0].port};
}
async function open(t,base,token,id,game='gomoku'){
 const socket=new WebSocket(base.replace('http:','ws:')+'/auth/'+(game==='warcaby'?'match':'gomoku')+'/realtime',{
  headers:{Origin:host,Cookie:'__Host-gracz_session='+token}});
 t.after(()=>socket.terminate());
 const messages=[],waiters=new Set();
 socket.on('message',raw=>{messages.push(JSON.parse(raw));for(const fn of waiters)fn();});
 const next=(type,predicate=()=>true,timeout=2000)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{waiters.delete(check);reject(Error('Missing '+type+' across independent instances'));},timeout);
  function check(){const at=messages.findIndex(m=>m.type===type&&predicate(m));if(at<0)return;
   clearTimeout(timer);waiters.delete(check);resolve(messages.splice(at,1)[0]);}
  waiters.add(check);check();
 });
 await once(socket,'open');
 socket.send(JSON.stringify({type:'subscribe',matchId:id,version:-1}));
 return {socket,messages,next};
}
async function request(base,token,path,body){
 const res=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:host,Cookie:'__Host-gracz_session='+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,...await res.json()};
}
async function transportProxy(t){
 const sockets=new Set();
 const server=createServer(client=>{
  const upstream=connect(Number(redis.port)||6379,redis.hostname);
  for(const s of [client,upstream]){sockets.add(s);s.on('close',()=>sockets.delete(s));s.on('error',()=>{client.destroy();upstream.destroy();});}
  client.pipe(upstream).pipe(client);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;
 const down=async()=>{for(const s of sockets)s.destroy();if(server.listening)await new Promise(r=>server.close(r));};
 t.after(down);
 return {url:'redis://127.0.0.1:'+port,down,up:async()=>{server.listen(port,'127.0.0.1');await once(server,'listening');}};
}
test('P3: independent instances share durable moves and private chat for both games', {timeout:30000},async t=>{
 const db=createDatabase(),players=[];
 t.after(async()=>{try{for(const p of players)await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[p.id]);}finally{await db.close();}});
 await createPublicIdentityRouter({database:db,emailFrom:'p3@example.test',resendKey:'not-used'}).probe();
 for(let i=0;i<3;i++){
  const id=randomUUID(),token=randomBytes(32).toString('hex'),name='P3'+id.replaceAll('-','');
  await db.query(`INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at)
   VALUES($1,$2,$2,$3,$4,$4,now())`,[id,name,name+'@example.test',Buffer.alloc(64)]);
  await db.query(`INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')`,[hash(token),id]);
  players.push({id,token});
 }
 const observer=createClient({url:process.env.GAME_REDIS_URL});await observer.connect();t.after(()=>observer.destroy());
 const proxy=await transportProxy(t);
 const a=await instance(t,proxy.url),b=await instance(t,proxy.url);
 let lastId,lastVersion;
 assert.notEqual(a.child.pid,b.child.pid);
 for(const game of ['gomoku','warcaby'])await t.test(game,async t=>{
  const id=randomUUID();
  await db.query(`INSERT INTO gracz_public_identity.game_challenges(id,sender_id,recipient_id,game,status) VALUES($1,$2,$3,$4,'accepted')`,[id,players[0].id,players[1].id,game]);
  const wa=await open(t,a.base,players[0].token,id,game),wb=await open(t,b.base,players[1].token,id,game);
  const sa=await wa.next('snapshot'),sb=await wb.next('snapshot');
  assert.equal(sa.match.player,1);assert.equal(sb.match.player,2);
  const body={id,version:sa.match.version,move:game==='gomoku'?{to:0}:{from:17,to:24}};
  const moved=await request(a.base,players[0].token,'/auth/match',body);
  assert.equal(moved.status,200);
  const event=await wb.next('match',x=>x.version===moved.match.version);
  assert.equal(event.match.state.turn,2);
  assert.equal((await request(b.base,players[0].token,'/auth/match',body)).status,409);
  assert.equal((await request(a.base,players[0].token,'/auth/match/chat',{id,message:'P3 cross-instance'})).status,200);
  assert.equal((await wb.next('chat')).messages[0].body,'P3 cross-instance');
  const outsider=await open(t,b.base,players[2].token,id,game);
  assert.equal((await once(outsider.socket,'close'))[0],1008);assert.equal(outsider.messages.length,0);
  if(game==='gomoku'){
   const undo=await request(a.base,players[0].token,'/auth/match/undo',{id,version:moved.match.version,action:'request'});
   assert.equal(undo.status,200);
   const pending=await wb.next('match',x=>Boolean(x.match.undoRequest));
   const accepted=await request(b.base,players[1].token,'/auth/match/undo',{id,version:pending.version,action:'accept',requestId:pending.match.undoRequest.id});
   assert.equal(accepted.status,200);
   assert.equal((await wa.next('match',x=>x.version===accepted.match.version)).changes[0][1],0);
  }
  const current=await request(b.base,players[0].token,'/auth/match?id='+id);
  const actor=game==='gomoku'?players[0]:players[1];
  const simultaneous={id,version:current.match.version,move:game==='gomoku'?{to:0}:{from:40,to:33}};
  const results=await Promise.all([request(a.base,actor.token,'/auth/match',simultaneous),request(b.base,actor.token,'/auth/match',simultaneous)]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409],'one durable commit for duplicate concurrent commands');
  lastVersion=results.find(x=>x.status===200).match.version;lastId=id;
  await wb.next('match',x=>x.version===lastVersion);
  // Lose the FINAL notification (no following writes); periodic reconciliation must repair it.
  await proxy.down();
  const unavailableMove={id,version:lastVersion,move:game==='gomoku'?{to:1}:{from:10,to:17}};
  const nextActor=game==='gomoku'?players[1]:players[0];
  const outage=await request(a.base,nextActor.token,'/auth/match',unavailableMove);
  assert.equal(outage.status,200,'Redis outage cannot falsify PostgreSQL commit');
  lastVersion=outage.match.version;
  const recovered=await wb.next('match',x=>x.version===lastVersion,2500);
  assert.equal(recovered.version,lastVersion,'lost final event recovered from PostgreSQL');
  assert.equal((await request(b.base,nextActor.token,'/auth/match',unavailableMove)).status,409);
  assert.equal((await request(b.base,players[0].token,'/auth/match?id='+id)).match.version,lastVersion);
  await proxy.up();
  const until=Date.now()+10000;
  let subscribers=0;
  while(Date.now()<until){
   const counts=await observer.pubSubNumSub('gracz:match:invalidate:v1');
   subscribers=Number(counts['gracz:match:invalidate:v1']||0);
   if(subscribers===2)break;
   await delay(50);
  }
  assert.equal(subscribers,2,'both Redis subscriptions recover after outage');
  wb.socket.terminate();const reconnected=await open(t,a.base,players[1].token,id,game);
  assert.equal((await reconnected.next('snapshot')).match.version,lastVersion);
 });
 await t.test('shared authoritative Gomoku clock',async t=>{
  const id=randomUUID();
  await db.query(`INSERT INTO gracz_public_identity.game_challenges(id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds)
   VALUES($1,$2,$3,'gomoku','accepted',1,2)`,[id,players[0].id,players[1].id]);
  const wa=await open(t,a.base,players[0].token,id);
  const first=await wa.next('snapshot');assert.equal(first.match.state.clock.since,null);
  const wb=await open(t,b.base,players[1].token,id);
  const second=await wb.next('snapshot');assert.ok(second.match.state.clock.since);
  const start=await wa.next('match',x=>Boolean(x.match.state.clock.since));
  assert.equal(start.match.state.clock.since,second.match.state.clock.since);
  const move=await request(a.base,players[0].token,'/auth/match',{id,version:second.match.version,move:{to:0}});
  assert.equal(move.status,200);assert.equal(move.match.state.clock.incrementMs,2000);
  const delivered=await wb.next('match',x=>x.version===move.match.version);
  assert.deepEqual(delivered.match.state.clock,move.match.state.clock);
  // Fixture advances elapsed time; two independent reconcilers race to finalize one timeout.
  await db.query(`UPDATE gracz_public_identity.game_matches SET state=jsonb_set(state,'{clock,since}',to_jsonb((now()-interval '2 minutes')::text)) WHERE challenge_id=$1`,[id]);
  const expired=await wb.next('match',x=>x.match.state.winner===1,2500);
  assert.equal(expired.match.state.clock.timeoutLoser,2);
  const saved=await request(a.base,players[0].token,'/auth/match?id='+id);
  assert.equal(saved.match.version,move.match.version+1,'one timeout committed despite both instances observing it');
 });
 // Abrupt process death after durable writes; the surviving process reconstructs state.
 const stopped=once(a.child,'exit');a.child.kill('SIGKILL');await stopped;
 const survivor=await open(t,b.base,players[0].token,lastId,'warcaby');
 assert.equal((await survivor.next('snapshot')).match.version,lastVersion);
 // Revoke on the shared DB; the remaining instance must close before sending data.
 const revoked=once(survivor.socket,'close');
 await db.query('DELETE FROM gracz_public_identity.sessions WHERE token_digest=$1',[hash(players[0].token)]);
 assert.equal((await revoked)[0],1008);
});

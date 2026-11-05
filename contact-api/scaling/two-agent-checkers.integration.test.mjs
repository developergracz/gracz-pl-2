// Two autonomous, independently authenticated players against real disposable API instances.
// No production credentials, databases, mail providers or public services are contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {WebSocket} from 'ws';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {assertDisposableDatabaseUrl} from '../integration/test-database-guard.mjs';
import {playMove} from '../auth/game-engine.mjs';

const origin='https://gracz-contact-api.onrender.com';
const hash=value=>createHash('sha256').update(value).digest();
assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const redis=new URL(process.env.GAME_REDIS_URL||'');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(redis.hostname),'Redis must be disposable and local');

async function startInstance(t){
 const child=fork(new URL('./instance.mjs',import.meta.url),{
  stdio:['ignore','pipe','pipe','ipc'],env:{...process.env}
 });
 let errorOutput='';
 child.stderr.on('data',chunk=>{errorOutput+=chunk.toString();});
 t.after(async()=>{
  if(child.exitCode!==null||child.signalCode)return;
  const stopped=once(child,'exit');child.kill('SIGKILL');await stopped;
 });
 const ready=await Promise.race([
  once(child,'message'),
  once(child,'exit').then(()=>{throw Error('Agent instance failed: '+errorOutput.slice(-1000));})
 ]);
 return {child,base:'http://127.0.0.1:'+ready[0].port};
}

async function request(base,token,path,body){
 const res=await fetch(base+path,{
  method:body===undefined?'GET':'POST',
  headers:{Origin:origin,Cookie:token?'__Host-gracz_session='+token:'',
   'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 return {status:res.status,...await res.json()};
}

async function createAgent(t,processInfo,account,matchId){
 const socket=new WebSocket(processInfo.base.replace('http:','ws:')+'/auth/match/realtime',{
  headers:{Origin:origin,Cookie:'__Host-gracz_session='+account.token}
 });
 t.after(()=>socket.terminate());
 const backlog=[],waiters=new Set();
 socket.on('message',raw=>{
  backlog.push(JSON.parse(raw));
  for(const check of waiters)check();
 });
 async function next(type,predicate=()=>true){
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{
    waiters.delete(check);
    reject(Error('Agent '+account.role+': missing '+type+' via WebSocket'));
   },3500);
   function check(){
    const index=backlog.findIndex(item=>item.type===type&&predicate(item));
    if(index<0)return;
    clearTimeout(timer);waiters.delete(check);resolve(backlog.splice(index,1)[0]);
   }
   waiters.add(check);check();
  });
 }
 await once(socket,'open');
 socket.send(JSON.stringify({type:'subscribe',matchId,version:-1}));
 const snapshot=await next('snapshot');
 assert.equal(snapshot.match.player,account.role);
 return {
  ...account,base:processInfo.base,snapshot, next,
  read:()=>request(processInfo.base,account.token,'/auth/match?id='+matchId),
  move:(version,move)=>request(processInfo.base,account.token,'/auth/match',{id:matchId,version,move}),
  chat:message=>request(processInfo.base,account.token,'/auth/match/chat',{id:matchId,message})
 };
}

// Deliberately avoid submitting arbitrary board states. Both agents only pick
// candidate coordinates, while the actual server authorizes each move.
function candidates(state){
 const player=state.turn,found=[];
 for(let from=0;from<64;from++){
  const piece=state.board[from];
  if(piece!==player&&piece!==player+2)continue;
  const row=Math.floor(from/8),col=from%8;
  for(let tr=0;tr<8;tr++)for(let tc=0;tc<8;tc++){
   const dr=Math.abs(tr-row),dc=Math.abs(tc-col);
   if(dr!==dc||dr===0)continue;
   const to=tr*8+tc;
   if(state.board[to]!==0)continue;
   const result=playMove('warcaby',state,player,{from,to});
   if(!result.error)found.push({from,to,result:result.state});
  }
 }
 return found;
}
function chooseMove(state,ply){
 const legal=candidates(state);
 assert.ok(legal.length,'active player has at least one legal action');
 // Stable human-like variation: alternate opening preference and captures.
 const ranked=legal.map(item=>{
  const before=state.board.filter(Boolean).length;
  const after=item.result.board.filter(Boolean).length;
  const capture=before>after?100:0;
  const crown=state.board[item.from]<=2&&item.result.board[item.to]>2?25:0;
  const noise=((item.from*73+item.to*37+ply*23+11)%47);
  return {item,score:capture+crown+noise};
 }).sort((a,b)=>b.score-a.score||a.item.from-b.item.from||a.item.to-b.item.to);
 return ranked[0].item;
}

test('two agents independently play timed Warcaby to a final result through two live API processes', {timeout:120000},async t=>{
 const database=createDatabase(),accounts=[];
 t.after(async()=>{
  try{
   for(const account of accounts)
    await database.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[account.id]);
  }finally{await database.close();}
 });
 await createPublicIdentityRouter({database,emailFrom:'agents@example.invalid',resendKey:'local-only'}).probe();
 for(const role of [1,2]){
  const id=randomUUID(),token=randomBytes(32).toString('hex');
  const nick='Agent'+role+'_'+id.replaceAll('-','');
  await database.query(
   'INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) VALUES($1,$2,$2,$3,$4,$4,now())',
   [id,nick,nick+'@example.invalid',Buffer.alloc(64)]
  );
  await database.query(
   'INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) VALUES($1,$2,now()+interval \'1 hour\')',
   [hash(token),id]
  );
  accounts.push({id,token,role});
 }
 const room=randomUUID();
 await database.query(
  'INSERT INTO gracz_public_identity.game_challenges(id,sender_id,recipient_id,game,status,time_limit_minutes,increment_seconds) VALUES($1,$2,$3,\'warcaby\',\'accepted\',7,2)',
  [room,accounts[0].id,accounts[1].id]
 );
 const instanceA=await startInstance(t),instanceB=await startInstance(t);
 assert.notEqual(instanceA.child.pid,instanceB.child.pid);
 const a=await createAgent(t,instanceA,accounts[0],room);
 const b=await createAgent(t,instanceB,accounts[1],room);
 const agents=[a,b];
 let view=await a.read();
 assert.equal(view.status,200);
 assert.deepEqual(view.match.state.clock.ready,[true,true]);
 assert.equal(view.match.state.clock.limitMs,7*60*1000);
 assert.equal(view.match.state.clock.incrementMs,2000);
 assert.ok(view.match.state.clock.since);

 const guest=await request(instanceA.base,'','/auth/match?id='+room);
 assert.equal(guest.status,401);
 const message=await a.chat('Agent A: gotowy do partii');
 assert.equal(message.status,200);
 const incoming=await b.next('chat',event=>event.messages.some(m=>m.body.includes('Agent A')));
 assert.ok(incoming.messages.some(m=>m.body.includes('gotowy')));
 const chatReply=await b.chat('Agent B: zaczynamy');
 assert.equal(chatReply.status,200);
 assert.ok((await a.next('chat',event=>event.messages.some(m=>m.body.includes('Agent B')))).messages.length>0);

 let state=view.match.state,version=view.match.version,plies=0;
 for(;plies<320&&!state.winner;plies++){
  const active=agents[state.turn-1],passive=agents[2-state.turn];
  const move=chooseMove(state,plies);
  if(plies===0){
   assert.equal((await passive.move(version,move)).status,409,'opponent cannot move out of turn');
   assert.equal((await active.move(version,{from:0,to:0})).status,409,'illegal move is rejected');
  }
  const committed=await active.move(version,{from:move.from,to:move.to});
  assert.equal(committed.status,200,'legal move accepted by server');
  assert.equal(committed.match.version,version+1);
  assert.deepEqual(committed.match.state.board,move.result.board,'authoritative board agrees with local rules');
  assert.equal(committed.match.state.turn,move.result.turn);
  const notified=await passive.next('match',event=>event.version===committed.match.version);
  assert.equal(notified.version,committed.match.version,'remote player observes same version');
  assert.deepEqual(notified.match.state.board,committed.match.state.board,'remote player sees same board');
  if(plies===0)assert.equal((await active.move(version,{from:move.from,to:move.to})).status,409,'replay rejected');
  state=committed.match.state;
  version=committed.match.version;
 }
 assert.ok(state.winner!==0,'a complete game must finish before the bounded move cap');
 assert.ok(plies>10,'agents must play a meaningful game');
 const finalA=await a.read(),finalB=await b.read();
 assert.equal(finalA.status,200);assert.equal(finalB.status,200);
 assert.equal(finalA.match.version,finalB.match.version);
 assert.deepEqual(finalA.match.state.board,finalB.match.state.board);
 assert.equal(finalA.match.state.winner,state.winner);
 assert.equal(finalB.match.state.winner,state.winner);
 assert.ok([1,2,3].includes(state.winner));
 assert.ok(Array.isArray(state.history)&&state.history.length>0);
 assert.equal((await a.move(version,{from:17,to:24})).status,409,'completed match cannot accept moves');
 console.log('TWO_AGENTS_PASS',{plies,winner:state.winner,version,instances:2,clock:'7m+2s'});
});

// Real disposable PostgreSQL 16/18 acceptance: Warcaby table creation,
// privacy, atomic two-player join and existing match reuse. Never production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {createDatabase} from '../persistence/database.mjs';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';

assertDisposableDatabaseUrl(process.env.DATABASE_URL);
const origin='https://gracz-contact-api.onrender.com';
const hash=value=>createHash('sha256').update(value).digest();
test('real PG: public/private tables create, strict auth, atomic join and existing /auth/match', {timeout:65000},async t=>{
 const db=createDatabase(),accounts=[];
 t.after(async()=>{
  try{
   for(const a of accounts)await db.query('DELETE FROM gracz_public_identity.accounts WHERE id=$1',[a.id]);
  }finally{await db.close();}
 });
 const router=createPublicIdentityRouter({database:db,emailFrom:'tables@example.invalid',resendKey:'test-only'});
 await router.probe();
 for(let i=0;i<3;i++){
  const id=randomUUID(),token=randomBytes(32).toString('hex'),nickname='TableTest'+i+id.replaceAll('-','').slice(0,10);
  await db.query("INSERT INTO gracz_public_identity.accounts(id,nickname,nickname_key,email_key,salt,password_digest,verified_at) "+
   "VALUES($1,$2,$3,$4,$5,$6,now())",
   [id,nickname,nickname.toLowerCase(),nickname.toLowerCase()+'@example.invalid',Buffer.alloc(16),Buffer.alloc(64)]);
  await db.query("INSERT INTO gracz_public_identity.sessions(token_digest,account_id,expires_at) "+
   "VALUES($1,$2,now()+interval '1 hour')",[hash(token),id]);
  accounts.push({id,token,nickname});
 }
 const call=async(account,method,path,body,customOrigin=origin)=>{
  const raw=body===undefined?'':JSON.stringify(body);
  const req=Readable.from(raw?[raw]:[]);
  req.url=path;req.method=method;req.socket={remoteAddress:'127.0.0.1'};
  req.headers={};if(account)req.headers.cookie='__Host-gracz_session='+account.token;
  if(method!=='GET'){req.headers.origin=customOrigin;req.headers['sec-fetch-site']='same-origin';}
  const res={status:0,body:'',writeHead(status){this.status=status},end(raw){this.body=String(raw||'')}};
  const handled=await router.handle(req,res,new URL(path,origin));
  assert.equal(handled,true);
  return {status:res.status,...JSON.parse(res.body)};
 };
 const [host,guest,other]=accounts;
 assert.equal((await call(null,'GET','/auth/warcaby/tables')).status,401);
 const cfg={action:'create',title:'Warcaby 7 minut',minutes:7,incrementSeconds:2,color:'white',visibility:'public'};
 assert.equal((await call(host,'POST','/auth/warcaby/tables',cfg,'https://evil.example')).status,403);
 const created=await call(host,'POST','/auth/warcaby/tables',cfg);
 assert.equal(created.status,201);assert.match(created.id,/^[0-9a-f-]{36}$/i);
 assert.equal((await call(host,'POST','/auth/warcaby/tables',cfg)).status,409,'only one waiting table per host');
 const listed=await call(guest,'GET','/auth/warcaby/tables?scope=waiting');
 assert.equal(listed.status,200);
 assert.ok(listed.tables.some(x=>x.id===created.id&&x.host===host.nickname),'real host nickname from accounts');
 assert.equal((await call(host,'POST','/auth/warcaby/tables',{action:'join',id:created.id})).status,409,'owner cannot take second seat');
 const take=await call(guest,'POST','/auth/warcaby/tables',{action:'join',id:created.id});
 assert.equal(take.status,200);assert.equal(take.matchId,created.id);
 assert.equal((await call(other,'POST','/auth/warcaby/tables',{action:'join',id:created.id})).status,409);
 const gameA=await call(host,'GET','/auth/match?id='+created.id);
 const gameB=await call(guest,'GET','/auth/match?id='+created.id);
 assert.equal(gameA.status,200);assert.equal(gameB.status,200);
 assert.equal(gameA.match.game,'warcaby');assert.equal(gameB.match.game,'warcaby');
 assert.equal(gameA.match.player,1);assert.equal(gameB.match.player,2);
 assert.equal(gameA.match.state.board.length,64);
 assert.equal(gameA.match.state.clock.limitMs,420000);
 assert.equal(gameA.match.state.clock.incrementMs,2000);
 assert.equal((await call(other,'GET','/auth/match?id='+created.id)).status,404,'third party cannot read match');
 const secret=await call(host,'POST','/auth/warcaby/tables',
  {...cfg,title:'Prywatne Warcaby',minutes:0,incrementSeconds:0,visibility:'private',color:'black'});
 assert.equal(secret.status,201);
 const publicList=await call(other,'GET','/auth/warcaby/tables?scope=waiting');
 assert.ok(!publicList.tables.some(x=>x.id===secret.id),'private table hidden from discovery');
 const byCode=await call(other,'GET','/auth/warcaby/tables?scope=waiting&code='+secret.id);
 assert.ok(byCode.tables.some(x=>x.id===secret.id));
 const joinPrivate=await call(other,'POST','/auth/warcaby/tables',{action:'join',id:secret.id});
 assert.equal(joinPrivate.status,200);
 const privateGame=await call(other,'GET','/auth/match?id='+secret.id);
 assert.equal(privateGame.status,200);assert.equal(privateGame.match.player,1,'host chooses black');
 assert.equal((await call(guest,'GET','/auth/match?id='+secret.id)).status,404);
 const contest=await call(host,'POST','/auth/warcaby/tables',{...cfg,title:'Wyścig o miejsce'});
 assert.equal(contest.status,201);
 const answers=await Promise.all([guest,other].map(account=>call(account,'POST','/auth/warcaby/tables',{action:'join',id:contest.id})));
 assert.deepEqual(answers.map(a=>a.status).sort(),[200,409],'one and only one participant claims last seat');
 const count=await db.query('SELECT count(*)::int AS n FROM gracz_public_identity.game_challenges WHERE id=$1',[contest.id]);
 assert.equal(count.rows[0].n,1,'exactly one accepted challenge created');
});

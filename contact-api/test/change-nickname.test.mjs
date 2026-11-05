import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes,randomUUID,createHash,scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';

// POST /auth/change-nickname: only the signed-in account, confirmed by its password, may take a
// free nick. Account id, e-mail, password and sessions stay; the new nick and e-mail log in.
const scrypt=promisify(scryptCallback);
const host='https://gracz-contact-api.onrender.com';
const ownerToken='a'.repeat(64),otherToken='b'.repeat(64);
const password='Owner Passphrase 2026 GRACZ!';
const digest=x=>createHash('sha256').update(x).digest();
const hash=async(pwd,salt)=>Buffer.from(await scrypt(pwd,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}));

async function fixture(){
 // Fresh account ids per test: the per-account attempt limit lives for the whole process.
 const ownerId=randomUUID(),otherId=randomUUID();
 const account=async(id,nickname,email)=>{const salt=randomBytes(16);
  return {id,nickname,nickname_key:nickname.toLowerCase(),email_key:email,salt,password_digest:await hash(password,salt),verified_at:new Date()};};
 const accounts=[await account(ownerId,'TesterGracz478114','owner@example.test'),await account(otherId,'zajety','other@example.test')];
 const sessions=new Map([[digest(ownerToken).toString('hex'),ownerId],[digest(otherToken).toString('hex'),otherId]]);
 const byId=id=>accounts.find(a=>a.id===id);
 const database={enabled:true,async query(sql,params=[]){
  if(sql.includes('SELECT a.id,a.nickname,a.salt,a.password_digest FROM gracz_public_identity.sessions')){
   const a=byId(sessions.get(Buffer.from(params[0]).toString('hex')));
   return {rows:a?[{id:a.id,nickname:a.nickname,salt:a.salt,password_digest:a.password_digest}]:[]};
  }
  if(sql.includes('UPDATE gracz_public_identity.accounts SET nickname=$2,nickname_key=$3')){
   const [id,nickname,key,oldHash]=params;
   if(accounts.some(a=>a.nickname_key===key&&a.id!==id))throw Object.assign(Error('duplicate key'),{code:'23505'});
   const a=byId(id);
   if(!a||!a.verified_at||!Buffer.from(oldHash).equals(a.password_digest))return {rows:[],rowCount:0};
   a.nickname=nickname;a.nickname_key=key;
   return {rows:[{nickname}],rowCount:1};
  }
  if(sql.includes('FROM gracz_public_identity.accounts WHERE email_key=$1 OR nickname_key=$1')){
   const a=accounts.find(x=>x.email_key===params[0]||x.nickname_key===params[0]);
   return {rows:a?[a]:[]};
  }
  if(sql.includes('INSERT INTO gracz_public_identity.sessions')){
   sessions.set(Buffer.from(params[0]).toString('hex'),params[1]);return {rows:[],rowCount:1};
  }
  return {rows:[],rowCount:0};
 }};
 const router=createPublicIdentityRouter({database,emailFrom:'test@example.test',resendKey:'synthetic-key'});
 async function call(method,pathname,{origin=host,cookie=ownerToken,body}={}){
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);
  req.method=method;req.headers={origin,'sec-fetch-site':'same-origin'};
  if(cookie)req.headers.cookie='__Host-gracz_session='+cookie;
  req.socket={remoteAddress:'127.0.0.3'};
  const result={status:null,body:''};
  const res={writeHead(code){result.status=code},end(data){result.body=String(data||'')},setHeader(){}};
  assert.equal(await router.handle(req,res,new URL(pathname,host)),true);
  return {status:result.status,data:JSON.parse(result.body)};
 }
 const change=(nickname,opts={})=>call('POST','/auth/change-nickname',{...opts,body:{nickname,currentPassword:opts.currentPassword??password}});
 return {call,change,accounts,sessions,byId,ownerId,otherId};
}

test('nickname change requires POST, same origin and a signed-in session',async()=>{
 const f=await fixture();
 assert.equal((await f.call('GET','/auth/change-nickname')).status,405);
 assert.equal((await f.change('bestgamer',{origin:'https://evil.example'})).status,403);
 assert.equal((await f.change('bestgamer',{cookie:null})).status,401);
 assert.equal((await f.change('bestgamer',{cookie:'c'.repeat(64)})).status,401);
 assert.equal(f.byId(f.ownerId).nickname,'TesterGracz478114');
});

test('wrong password, invalid or unchanged nick and another player\'s nick never change the account',async()=>{
 const f=await fixture();
 assert.deepEqual((await f.change('bestgamer',{currentPassword:'Wrong Passphrase 2026 GRACZ!'})).data,{ok:false,error:'BLEDNE_AKTUALNE_HASLO'});
 assert.equal((await f.change('1abc')).data.error,'POPRAW_NICK');
 assert.equal((await f.change('ab')).data.error,'POPRAW_NICK');
 assert.equal((await f.change('TesterGracz478114')).data.error,'NICK_BEZ_ZMIAN');
 for(const taken of ['zajety','ZAJETY']){
  const x=await f.change(taken);
  assert.equal(x.status,409);
  assert.equal(x.data.error,'NICK_ZAJETY');
 }
 assert.equal(f.byId(f.ownerId).nickname,'TesterGracz478114');
 assert.equal(f.byId(f.otherId).nickname,'zajety','the other player keeps their nick');
});

test('TesterGracz478114 becomes bestgamer and keeps id, e-mail, password and sessions; new nick and e-mail log in',async()=>{
 const f=await fixture(),before={...f.byId(f.ownerId)},sessionsBefore=f.sessions.size;
 const x=await f.change('bestgamer');
 assert.equal(x.status,200);
 assert.deepEqual(x.data,{ok:true,nickname:'bestgamer'});
 const after=f.byId(f.ownerId);
 assert.equal(after.nickname,'bestgamer');
 assert.equal(after.nickname_key,'bestgamer');
 assert.equal(after.id,before.id);
 assert.equal(after.email_key,before.email_key);
 assert.equal(after.salt.equals(before.salt),true);
 assert.equal(after.password_digest.equals(before.password_digest),true);
 assert.equal(f.sessions.size,sessionsBefore,'no session is revoked');
 assert.equal(f.accounts.length,2,'no second account');
 for(const login of ['bestgamer','BestGamer','owner@example.test']){
  const r=await f.call('POST','/auth/login',{cookie:null,body:{login,password}});
  assert.equal(r.status,200,login);
  assert.equal(r.data.nickname,'bestgamer');
 }
 assert.equal((await f.call('POST','/auth/login',{cookie:null,body:{login:'TesterGracz478114',password}})).status,401);
});

test('two accounts racing for the same free nick: exactly one wins, the other gets NICK_ZAJETY',async()=>{
 const f=await fixture();
 const [a,b]=await Promise.all([f.change('bestgamer'),f.change('bestgamer',{cookie:otherToken})]);
 assert.deepEqual([a.status,b.status].sort(),[200,409]);
 assert.equal(f.accounts.filter(x=>x.nickname_key==='bestgamer').length,1);
});

test('player panel offers the nick change form in the existing premium card style',()=>{
 const read=pathname=>{
  const r={status:0,body:''};
  assert.equal(servePlayerPanel({method:'GET'},{writeHead(s){r.status=s},end(b){r.body=String(b)}},new URL(pathname,host)),true);
  assert.equal(r.status,200);
  return r.body;
 };
 const html=read('/konto/panel/'),js=read('/konto/panel/app.js');
 assert.match(html,/<div class="card profile-password-card" id="profile-nickname-section">[\s\S]*?<h2>Zmiana nicku<\/h2>/);
 for(const id of ['nick-change-form','nick-next','nick-password','nick-change-status','nick-change-submit'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/id="nick-password" autocomplete="current-password"/);
 assert.match(js,/api\('change-nickname',\{method:'POST'/);
 assert.match(js,/NICK_ZAJETY:'Ten nick jest już zajęty\. Wybierz inny\.'/);
});

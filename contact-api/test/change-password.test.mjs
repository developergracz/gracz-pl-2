import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';

const scrypt=promisify(scryptCallback);
const host='https://gracz-contact-api.onrender.com',accountId='00000000-0000-4000-8000-000000000001';
const token='a'.repeat(64),otherToken='b'.repeat(64);
const digest=x=>createHash('sha256').update(x).digest();
async function hash(password,salt){return Buffer.from(await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}))}
const current='Current Passphrase 2026!';
const next='New Secure Phrase 2026!';
async function fixture(){
 const salt=randomBytes(16);
 const state={salt,passwordDigest:await hash(current,salt),sessions:[digest(token),digest(otherToken)],changed:0};
 const queries=[];
 const database={enabled:true,async query(sql,params=[]){
  queries.push(sql);
  if(sql.includes('SELECT a.id,a.salt,a.password_digest FROM gracz_public_identity.sessions')){
   return {rows:state.sessions.some(x=>x.equals(params[0]))?[{id:accountId,salt:state.salt,password_digest:state.passwordDigest}]:[]};
  }
  if(sql.includes('WITH updated AS (UPDATE gracz_public_identity.accounts')){
   const [id,oldHash,newSalt,newHash,activeDigest]=params;
   if(id!==accountId||!Buffer.from(oldHash).equals(state.passwordDigest))return {rows:[{changed:0,revoked:0}]};
   state.salt=Buffer.from(newSalt);state.passwordDigest=Buffer.from(newHash);state.changed++;
   const before=state.sessions.length;
   state.sessions=state.sessions.filter(x=>x.equals(activeDigest));
   return {rows:[{changed:1,revoked:before-state.sessions.length}]};
  }
  // Schema initialization runs once per test fixture.
  return {rows:[],rowCount:0};
 }};
 const router=createPublicIdentityRouter({database,emailFrom:'test@example.test',resendKey:'synthetic-key'});
 async function call(method,pathname,{origin=host,cookie=token,body}={}){
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);
  req.method=method;req.headers={origin,'sec-fetch-site':'same-origin'};
  if(cookie)req.headers.cookie='__Host-gracz_session='+cookie;
  req.socket={remoteAddress:'127.0.0.1'};
  const result={status:null,headers:{},body:''};
  const res={writeHead(code,headers){result.status=code;result.headers=headers},
   end(data){result.body=String(data||'')},setHeader(name,value){result.headers[name]=value}};
  const handled=await router.handle(req,res,new URL(pathname,host));assert.equal(handled,true);
  return {status:result.status,data:JSON.parse(result.body)};
 }
 return {call,state,queries};
}
test('password changes require authenticated session, same origin, and POST',async()=>{
 const x=await fixture(),body={currentPassword:current,newPassword:next,repeatPassword:next};
 assert.equal((await x.call('GET','/auth/change-password')).status,405);
 assert.equal((await x.call('POST','/auth/change-password',{origin:'https://invalid.example',body})).status,403);
 assert.equal((await x.call('POST','/auth/change-password',{cookie:null,body})).status,401);
 assert.equal(x.state.changed,0);
});
test('wrong current password, weak new password and mismatched confirmation cannot mutate account',async()=>{
 const x=await fixture();
 const change=body=>x.call('POST','/auth/change-password',{body});
 assert.equal((await change({currentPassword:'Wrong Current Password!',newPassword:next,repeatPassword:next})).data.error,'BLEDNE_AKTUALNE_HASLO');
 assert.equal((await change({currentPassword:current,newPassword:'short',repeatPassword:'short'})).status,400);
 assert.equal((await change({currentPassword:current,newPassword:next,repeatPassword:next+'!'})).status,400);
 assert.equal((await change({currentPassword:current,newPassword:current,repeatPassword:current})).status,400);
 assert.equal(x.state.changed,0);
 assert.equal(x.state.sessions.length,2);
});
test('valid password change uses fresh salt, changes hash and atomically revokes other sessions',async()=>{
 const x=await fixture(),oldSalt=Buffer.from(x.state.salt),oldHash=Buffer.from(x.state.passwordDigest);
 const changed=await x.call('POST','/auth/change-password',{body:{currentPassword:current,newPassword:next,repeatPassword:next}});
 assert.equal(changed.status,200);
 assert.equal(changed.data.otherSessionsRevoked,1);
 assert.equal(x.state.changed,1);
 assert.equal(x.state.sessions.length,1);
 assert.equal(x.state.sessions[0].equals(digest(token)),true);
 assert.equal(x.state.salt.equals(oldSalt),false);
 assert.equal(x.state.passwordDigest.equals(oldHash),false);
 assert.equal(timingSafeEqual(await hash(next,x.state.salt),x.state.passwordDigest),true);
 assert.equal(timingSafeEqual(await hash(current,x.state.salt),x.state.passwordDigest),false);
 assert.equal((await x.call('POST','/auth/change-password',{cookie:otherToken,body:{currentPassword:next,newPassword:current,repeatPassword:current}})).status,401);
});
test('premium player profile renders password form and sends only the authenticated same-origin request',()=>{
 const result={status:null,body:''};
 const res={writeHead(code){result.status=code},end(body){result.body=String(body)}};
 assert.equal(servePlayerPanel({method:'GET'},res,new URL('/konto/panel/',host)),true);
 assert.equal(result.status,200);
 for(const id of ['pw-change-form','pw-current','pw-next','pw-confirm','pw-change-status'])assert.match(result.body,new RegExp('id="'+id+'"'));
 assert.match(result.body,/autocomplete="current-password"/);
 assert.match(result.body,/autocomplete="new-password"/);
 const js={body:''};
 assert.equal(servePlayerPanel({method:'GET'},{writeHead(){},end(body){js.body=String(body)}},new URL('/konto/panel/app.js',host)),true);
 assert.match(js.body,/api\('change-password'/);
 assert.match(js.body,/otherSessionsRevoked/);
});

test('premium confirmation dialog is hidden by default, accessible, and shown only after API success',()=>{
 const read=pathname=>{
  const r={body:'',status:0};
  const response={writeHead(status){r.status=status},end(body){r.body=String(body)}};
  assert.equal(servePlayerPanel({method:'GET'},response,new URL(pathname,host)),true);
  assert.equal(r.status,200);
  return r.body;
 };
 const html=read('/konto/panel/');
 const js=read('/konto/panel/app.js');
 const css=read('/konto/panel/styl.css');
 assert.match(html,/id="pw-success-overlay" hidden/);
 assert.match(html,/class="pw-success-modal" role="dialog" aria-modal="true"/);
 assert.match(html,/id="pw-success-title">Hasło zostało zmienione/);
 assert.match(html,/id="pw-success-close" type="button">Zamknij/);
 assert.match(css,/\.pw-success-modal/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(js,/function showPasswordSuccessModal\(revokedCount\)/);
 assert.match(js,/function closePasswordSuccessModal\(\)/);
 assert.match(js,/showPasswordSuccessModal\(result\.otherSessionsRevoked\)/);
 assert.match(js,/try\{\s*const result=await api\('change-password'/);
 assert.match(js,/catch\(error\)\{label\.textContent=error\.message;\}/);
 assert.doesNotMatch(js,/catch\(error\)\{showPasswordSuccessModal/);
});

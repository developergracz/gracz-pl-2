import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes,createHash,scrypt as rawScrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {serveIdentityPage} from '../auth/page.mjs';

const host='https://gracz-contact-api.onrender.com';
const hashPassword=promisify(rawScrypt);
const digest=x=>createHash('sha256').update(x).digest();
const validToken='a'.repeat(64),accountId='00000000-0000-4000-8000-000000000101';
const newPassword='Long and Unique 2026 Password!';
const fixture=()=>{
 const state={tokenDigest:digest(validToken),sessions:2,resets:0,salt:null,passwordDigest:null,queries:[]};
 const database={enabled:true,async query(sql,params=[]){
  state.queries.push(sql);
  if(sql.includes('SELECT id FROM gracz_public_identity.accounts WHERE email_key='))return {rows:[]};
  if(sql.includes('WITH updated AS (')&&sql.includes('reset_digest=NULL')){
   if(!state.tokenDigest || !state.tokenDigest.equals(params[0]))return {rows:[],rowCount:0};
   state.tokenDigest=null;state.salt=Buffer.from(params[1]);
   state.passwordDigest=Buffer.from(params[2]);state.sessions=0;state.resets++;
   return {rows:[{id:accountId}],rowCount:1};
  }
  return {rows:[],rowCount:0};
 }};
 const router=createPublicIdentityRouter({database,emailFrom:'test@example.test',resendKey:'synthetic-key'});
 async function request(method,path,body,{origin=host}={}){
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);
  req.method=method;req.headers={origin,'sec-fetch-site':'same-origin'};
  req.socket={remoteAddress:'127.0.0.1'};
  const result={code:0,body:'',headers:{}};
  const res={writeHead(code,headers){result.code=code;result.headers=headers;},end(body){result.body=String(body||'')},setHeader(){}};
  assert.equal(await router.handle(req,res,new URL(path,host)),true);
  return {status:result.code,data:JSON.parse(result.body)};
 }
 return {request,state};
};
test('password recovery never reveals whether an email is registered',async()=>{
 const f=fixture();
 const x=await f.request('POST','/auth/forgot-password',{email:'unknown@example.test'});
 assert.equal(x.status,200);
 assert.match(x.data.message,/Jeżeli adres należy/);
 assert.equal(f.state.resets,0);
});
test('password reset enforces same-origin, single-use and strong confirmation',async()=>{
 const f=fixture(),send=body=>f.request('POST','/auth/reset-password',body);
 assert.equal((await f.request('POST','/auth/reset-password',{token:validToken,password:newPassword,repeatPassword:newPassword},{origin:'https://bad.test'})).status,403);
 assert.equal((await send({token:validToken,password:'short',repeatPassword:'short'})).status,400);
 assert.equal((await send({token:validToken,password:newPassword,repeatPassword:'different'})).status,400);
 assert.equal(f.state.resets,0);
 const x=await send({token:validToken,password:newPassword,repeatPassword:newPassword});
 assert.equal(x.status,200);
 assert.equal(f.state.resets,1);
 assert.equal(f.state.sessions,0);
 assert.equal((await send({token:validToken,password:newPassword,repeatPassword:newPassword})).status,400);
 const check=Buffer.from(await hashPassword(newPassword,f.state.salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024}));
 assert.equal(check.equals(f.state.passwordDigest),true);
});
test('premium login has working recovery controls on secure account origin',()=>{
 const read=path=>{
  const r={status:0,body:''};
  const res={writeHead(status){r.status=status},end(body){r.body=String(body)}};
  assert.equal(serveIdentityPage({method:'GET'},res,new URL(path,host)),true);
  assert.equal(r.status,200);
  return r.body;
 };
 const html=read('/konto/'),css=read('/konto/styl.css'),js=read('/konto/app.js');
 for(const id of ['login-form','forgot-form','reset-form','loginPassword','forgotEmail','newPassword','newPasswordRepeat'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/class="login-close"/);
 assert.match(html,/Zapomniałem hasła/);
 assert.match(css,/body\.auth-login-mode \.panel/);
 assert.match(js,/api\('forgot-password'/);
 assert.match(js,/api\('reset-password'/);
 assert.match(js,/resetFromLink=hash\.get\('nowe-haslo'\)/);
 assert.match(html,/autocomplete="current-password"/);
});

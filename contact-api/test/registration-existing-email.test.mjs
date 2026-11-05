import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {serveIdentityPage} from '../auth/page.mjs';

// /auth/register: an existing address gets the same answer as a new one, a new address
// always triggers the Resend activation call, and a failed send never looks like success.
const host='https://gracz-contact-api.onrender.com';
const password='Long and Unique 2026 Password!';
const originalFetch=globalThis.fetch;
test.afterEach(()=>{globalThis.fetch=originalFetch;});

function fixture(accounts=[]){
 const rows=accounts.map(a=>({...a})),sent=[];
 const database={enabled:true,async query(sql,params=[]){
  if(sql.includes('INSERT INTO gracz_public_identity.accounts')){
   assert.match(sql,/ON CONFLICT DO NOTHING/);
   const [id,nickname,nickname_key,email_key]=params;
   if(rows.some(r=>r.email_key===email_key||r.nickname_key===nickname_key))return {rows:[],rowCount:0};
   rows.push({id,nickname,nickname_key,email_key,verified_at:null,verify_expires_at:new Date(Date.now()+1800000)});
   return {rows:[],rowCount:1};
  }
  if(sql.includes('DELETE FROM gracz_public_identity.accounts')&&sql.includes('verify_expires_at<=now()')){
   const [email,nick]=params,before=rows.length;
   for(let i=rows.length-1;i>=0;i--){
    const r=rows[i];
    if((r.email_key===email||r.nickname_key===nick)&&!r.verified_at&&(!r.verify_expires_at||r.verify_expires_at<=new Date()))rows.splice(i,1);
   }
   return {rows:[],rowCount:before-rows.length};
  }
  if(sql.includes('DELETE FROM gracz_public_identity.accounts WHERE id=$1')){
   const before=rows.length,i=rows.findIndex(r=>r.id===params[0]&&!r.verified_at);
   if(i>=0)rows.splice(i,1);
   return {rows:[],rowCount:before-rows.length};
  }
  if(sql.includes('SELECT 1 FROM gracz_public_identity.accounts WHERE nickname_key=$1')){
   const hit=rows.filter(r=>r.nickname_key===params[0]).map(()=>({'?column?':1}));
   return {rows:hit,rowCount:hit.length};
  }
  return {rows:[],rowCount:0};
 }};
 const router=createPublicIdentityRouter({database,emailFrom:'gracz.pl <konto@example.test>',resendKey:'synthetic-key'});
 const resend=(reply=()=>({ok:true,status:200}))=>{
  globalThis.fetch=async(url,init)=>{
   assert.equal(url,'https://api.resend.com/emails');
   sent.push(JSON.parse(init.body));
   return reply();
  };
 };
 async function register(nickname,email){
  const body={nickname,email,password,repeatPassword:password,terms:true,privacy:true};
  const req=Readable.from([JSON.stringify(body)]);
  req.method='POST';req.headers={origin:host,'sec-fetch-site':'same-origin'};
  req.socket={remoteAddress:'127.0.0.2'};
  const result={code:0,body:''};
  const res={writeHead(code){result.code=code;},end(raw){result.body=String(raw||'');},setHeader(){}};
  assert.equal(await router.handle(req,res,new URL('/auth/register',host)),true);
  return {status:result.code,data:JSON.parse(result.body)};
 }
 return {register,rows,sent,resend};
}

test('new address is saved and the activation e-mail is sent through Resend',async()=>{
 const f=fixture();f.resend();
 const x=await f.register('NowyGracz','Nowy@Example.test');
 assert.equal(x.status,200);
 assert.equal(x.data.ok,true);
 assert.match(x.data.message,/Jeżeli to nowe konto, wysłaliśmy link aktywacyjny/);
 assert.equal(f.rows.length,1);
 assert.equal(f.rows[0].email_key,'nowy@example.test');
 assert.equal(f.sent.length,1);
 assert.deepEqual(f.sent[0].to,'nowy@example.test');
 assert.match(f.sent[0].html,/\/konto\/#potwierdz=[a-f0-9]{64}/);
});

test('existing address gets exactly the same answer as a new one (no enumeration)',async()=>{
 const f=fixture([{id:'a1',nickname:'Stary',nickname_key:'stary',email_key:'zajety@example.test',verified_at:new Date(),verify_expires_at:null}]);
 f.resend();
 const fresh=await f.register('Inny1','wolny@example.test');
 const taken=await f.register('Inny2','zajety@example.test');
 assert.equal(taken.status,fresh.status);
 assert.deepEqual(taken.data,fresh.data);
 assert.equal(f.sent.length,1,'only the new address receives a message');
 assert.equal(f.rows.find(r=>r.email_key==='zajety@example.test').id,'a1','existing account untouched');
});

test('failed Resend delivery is reported and leaves no half-created account',async()=>{
 const failures=[()=>({ok:false,status:422}),()=>{throw Object.assign(Error('aborted'),{name:'AbortError'});}];
 for(const [i,reply] of failures.entries()){
  const f=fixture();f.resend(reply);
  const x=await f.register('Pechowiec','pech'+i+'@example.test');
  assert.equal(x.status,503);
  assert.deepEqual(x.data,{ok:false,error:'NIE_UDALO_SIE_WYSLAC_EMAIL'});
  assert.equal(f.rows.length,0,'a retry must be able to register the same nick and address');
 }
});

test('taken nickname is reported the same way whatever e-mail is used',async()=>{
 const f=fixture([{id:'a1',nickname:'Mistrz',nickname_key:'mistrz',email_key:'mistrz@example.test',verified_at:new Date(),verify_expires_at:null}]);
 f.resend();
 const own=await f.register('MISTRZ','mistrz@example.test');
 const other=await f.register('mistrz','ktos@example.test');
 assert.equal(own.status,409);
 assert.deepEqual(own.data,{ok:false,error:'NICK_ZAJETY'});
 assert.deepEqual(other.data,own.data);
 assert.equal(f.sent.length,0);
});

test('expired unconfirmed registration is released so the owner gets a fresh activation link',async()=>{
 const f=fixture([{id:'old',nickname:'Zapominalski',nickname_key:'zapominalski',email_key:'wraca@example.test',verified_at:null,verify_expires_at:new Date(Date.now()-60000)}]);
 f.resend();
 const x=await f.register('Zapominalski','wraca@example.test');
 assert.equal(x.status,200);
 assert.equal(f.sent.length,1);
 assert.equal(f.rows.length,1);
 assert.notEqual(f.rows[0].id,'old');
 // A pending (not yet expired) confirmation is never replaced by someone else.
 const g=fixture([{id:'live',nickname:'Czeka',nickname_key:'czeka',email_key:'czeka@example.test',verified_at:null,verify_expires_at:new Date(Date.now()+60000)}]);
 g.resend();
 const y=await g.register('Ktos','czeka@example.test');
 assert.equal(y.status,200);
 assert.equal(g.sent.length,0);
 assert.equal(g.rows[0].id,'live');
});

test('registration form offers login and password recovery without a false confirmation',()=>{
 const read=path=>{
  const r={status:0,body:''};
  const res={writeHead(status){r.status=status},end(body){r.body=String(body)}};
  assert.equal(serveIdentityPage({method:'GET'},res,new URL(path,host)),true);
  return r.body;
 };
 const html=read('/konto/'),js=read('/konto/app.js'),css=read('/konto/styl.css');
 const hint=html.match(/<div id="account-hint" class="account-hint" hidden>([\s\S]*?)<\/div><\/div>/);
 assert.ok(hint,'hint is hidden until the server answers');
 assert.match(hint[1],/Jeżeli posiadasz już konto GRACZ\.PL, możesz się zalogować lub odzyskać hasło\./);
 assert.match(hint[1],/<button type="button" class="account-hint-login" data-view="login">Zaloguj się<\/button>/);
 assert.match(hint[1],/<button type="button" class="account-hint-forgot" data-view="forgot">Odzyskaj hasło<\/button>/);
 assert.match(js,/form\.reset\(\);hidePasswordFeedback\(\);msg\(b\.message\);accountHint\.hidden=false;/);
 assert.match(js,/NIE_UDALO_SIE_WYSLAC_EMAIL:'Nie udało się wysłać wiadomości aktywacyjnej/);
 assert.match(js,/NICK_ZAJETY:'Ten nick jest zajęty\. Wybierz inny\.'/);
 assert.match(js,/accountHint\.hidden=true;\n heading/,'switching views hides the hint');
 assert.match(css,/\.account-hint\{/);
});

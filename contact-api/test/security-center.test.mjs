import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSecurityCenterRouter,ensureSecuritySchema,recordSecurityEvent,recordSessionBrowser} from '../auth/security-center.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const second='22222222-2222-4222-8222-222222222222';
const token1='a'.repeat(64),tokenOther='b'.repeat(64),token2='c'.repeat(64),host='https://gracz-contact-api.onrender.com';
const hash=token=>createHash('sha256').update(token).digest();
const id=dig=>createHash('sha256').update(dig).digest('hex');
function fixture(){
 const sessions=[
  {account_id:owner,token_digest:hash(token1),browser_label:'Chrome · Windows',created_at:'2026-11-05T08:00:00.000Z',expires_at:'2026-11-12T08:00:00.000Z'},
  {account_id:owner,token_digest:hash(tokenOther),browser_label:'Firefox · Android',created_at:'2026-11-04T08:00:00.000Z',expires_at:'2026-11-11T08:00:00.000Z'},
  {account_id:second,token_digest:hash(token2),browser_label:'Safari · macOS',created_at:'2026-11-03T08:00:00.000Z',expires_at:'2026-11-10T08:00:00.000Z'}
 ];
 const events=[{account_id:owner,event_code:'login_success',created_at:'2026-11-05T08:00:00.000Z'}],prefs=new Map();
 const queries=[];
 const db={async query(sql,params=[]){
  queries.push({sql,params});
  if(sql.startsWith('SELECT a.id,a.verified_at FROM')){
   const row=sessions.find(s=>s.token_digest.equals(params[0]));
   return {rows:row?[{id:row.account_id,verified_at:'2026-11-04'}]:[]};
  }
  if(sql.startsWith('SELECT new_session_alert,password_alert')){
   return {rows:prefs.has(params[0])?[prefs.get(params[0])]:[]};
  }
  if(sql.startsWith('SELECT s.token_digest,s.created_at,s.expires_at')){
   return {rows:sessions.filter(s=>s.account_id===params[0])};
  }
  if(sql.startsWith('SELECT event_code,created_at')){
   return {rows:events.filter(e=>e.account_id===params[0])};
  }
  if(sql.startsWith('SELECT s.token_digest FROM')){
   return {rows:sessions.filter(s=>s.account_id===params[0]&&!s.token_digest.equals(params[1])).map(x=>({token_digest:x.token_digest}))};
  }
  if(sql.startsWith('DELETE FROM gracz_public_identity.sessions')){
   const [account,dig,current]=params;
   let removed=0;
   for(let k=sessions.length-1;k>=0;k--){
    if(sessions[k].account_id!==account)continue;
    if((dig&&current)?sessions[k].token_digest.equals(dig)&&!sessions[k].token_digest.equals(current):
       !sessions[k].token_digest.equals(dig)){
      sessions.splice(k,1);removed++;
    }
   }
   return {rowCount:removed,rows:Array(removed).fill({token_digest:Buffer.from('0')})};
  }
  if(sql.startsWith('INSERT INTO gracz_public_identity.security_preferences')){
   prefs.set(params[0],{new_session_alert:params[1],password_alert:params[2]});
   return {rowCount:1,rows:[]};
  }
  if(sql.startsWith('INSERT INTO gracz_public_identity.security_events')){
   events.unshift({account_id:params[1],event_code:params[2],created_at:'2026-11-05T10:00:00.000Z'});
   return {rowCount:1,rows:[]};
  }
  if(sql.startsWith('INSERT INTO gracz_public_identity.security_session_agents')){
   const found=sessions.find(s=>s.token_digest.equals(params[0]));
   if(found)found.browser_label=params[1];
   return {rowCount:1,rows:[]};
  }
  throw Error('Unexpected SQL '+sql.slice(0,100));
 }};
 const api=createSecurityCenterRouter({database:db,ready:async()=>{},
  sessionToken:req=>req.headers.cookieToken||'',digest:hash,
  authorizedOrigin:req=>req.headers.origin===host,readBody:async req=>req.payload,
  allow:()=>true});
 async function call(cookieToken,method='GET',path='/auth/security-center',payload={},origin=host){
  const req={method,headers:{cookieToken,origin},payload};
  const response={status:0,body:'',writeHead(status){this.status=status},end(data){this.body=String(data)}};
  assert.equal(await api.handle(req,response,new URL(path,host)),true);
  return {status:response.status,data:JSON.parse(response.body)};
 }
 return {call,db,events,prefs,sessions,queries};
}
test('security schema is account-scoped with durable events and cascade device labels',async()=>{
 const statements=[];
 await ensureSecuritySchema({query:async sql=>{statements.push(sql);return {rows:[]}}});
 assert.equal(statements.length,4);
 assert.match(statements[0],/account_id uuid PRIMARY KEY REFERENCES/);
 assert.match(statements[1],/event_code text NOT NULL CHECK/);
 assert.match(statements[2],/account_id,created_at DESC/);
 assert.match(statements[3],/token_digest bytea PRIMARY KEY REFERENCES/);
});
test('session and origin checks reject unauthenticated and cross-site requests',async()=>{
 const f=fixture();
 assert.equal((await f.call('')).status,401);
 assert.equal((await f.call(token1,'POST')).status,405);
 assert.equal((await f.call(token1,'PUT','/auth/security-center',{newSessionAlert:true,passwordAlert:true},'https://attacker.example')).status,403);
 assert.equal((await f.call(token1,'POST','/auth/security-center/revoke-others',{},'https://attacker.example')).status,403);
 assert.equal(f.sessions.length,3);
});
test('read exposes only current owner sessions, opaque handles, and verified events',async()=>{
 const f=fixture();
 const one=await f.call(token1);
 assert.equal(one.status,200);
 assert.equal(one.data.verifiedEmail,true);
 assert.equal(one.data.secondFactor.available,false);
 assert.equal(one.data.secondFactor.enabled,false);
 assert.equal(one.data.sessions.length,2);
 assert.equal(one.data.sessions.filter(x=>x.current).length,1);
 assert.equal(one.data.sessions[0].id,id(hash(token1)));
 assert.equal(one.data.events.length,1);
 assert.equal(one.data.events[0].code,'login_success');
 assert.equal(JSON.stringify(one.data).includes(token1),false);
 assert.equal(JSON.stringify(one.data).includes(owner),false);
 const other=await f.call(token2);
 assert.equal(other.data.sessions.length,1);
 assert.equal(other.data.sessions[0].label,'Safari · macOS');
 assert.equal(other.data.events.length,0);
});
test('revoke only another session of the same account, never current or other owner',async()=>{
 const f=fixture();
 assert.equal((await f.call(token1,'POST','/auth/security-center/revoke-session',{id:'x'.repeat(64)})).status,400);
 assert.equal((await f.call(token1,'POST','/auth/security-center/revoke-session',{id:id(hash(token1))})).status,404);
 assert.equal((await f.call(token1,'POST','/auth/security-center/revoke-session',{id:id(hash(token2))})).status,404);
 const revoked=await f.call(token1,'POST','/auth/security-center/revoke-session',{id:id(hash(tokenOther))});
 assert.equal(revoked.status,200);
 assert.equal(revoked.data.revoked,1);
 assert.equal(f.sessions.length,2);
 assert.equal(f.sessions.some(s=>s.token_digest.equals(hash(token1))),true);
 assert.equal(f.sessions.some(s=>s.token_digest.equals(hash(token2))),true);
 assert.equal(f.events[0].event_code,'session_revoked');
});
test('revoke other sessions keeps current access and removes only owner sessions',async()=>{
 const f=fixture();
 const revoked=await f.call(token1,'POST','/auth/security-center/revoke-others');
 assert.equal(revoked.status,200);
 assert.equal(revoked.data.revoked,1);
 assert.equal(f.sessions.length,2);
 assert.equal((await f.call(token1)).status,200);
 assert.equal((await f.call(tokenOther)).status,401);
 assert.equal((await f.call(token2)).status,200);
});
test('alert preferences persist with boolean-only validation and never promise emails',async()=>{
 const f=fixture();
 assert.equal((await f.call(token1,'PUT','/auth/security-center',{newSessionAlert:'yes',passwordAlert:false})).status,400);
 const saved=await f.call(token1,'PUT','/auth/security-center',{newSessionAlert:false,passwordAlert:true});
 assert.equal(saved.status,200);
 assert.equal(saved.data.preferences.newSessionAlert,false);
 assert.equal(saved.data.preferences.passwordAlert,true);
 assert.match(saved.data.notificationsNote,/e-mail nie jest uruchomiona/);
 assert.equal((await f.call(token2)).data.preferences.newSessionAlert,true);
});
test('browser labels are bounded and event types are allowlisted',async()=>{
 const f=fixture();
 await recordSessionBrowser(f.db,hash(token1),'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537 Chrome/141.0');
 assert.equal(f.sessions[0].browser_label,'Chrome · Windows');
 assert.equal(await recordSecurityEvent(f.db,owner,'arbitrary'),false);
 assert.equal(await recordSecurityEvent(f.db,owner,'password_changed'),true);
 assert.equal(f.events[0].event_code,'password_changed');
});
test('security UI retains original logout and change-password flows',()=>{
 const payload=[];
 for(const path of ['/konto/panel/','/konto/panel/app.js','/konto/panel/styl.css']){
  const res={status:0,body:'',writeHead(status){this.status=status},end(body){this.body=String(body)}};
  assert.equal(servePlayerPanel({method:'GET'},res,new URL(path,host)),true);
  assert.equal(res.status,200);
  payload.push(res.body);
 }
 const [html,js,css]=payload;
 assert.equal((html.match(/data-sec-tab="/g)||[]).length,5);
 assert.equal((html.match(/data-sec-pane="/g)||[]).length,5);
 for(const marker of ['sec-device-list','sec-event-list','sec-alert-form','sec-change-password',
   'sec-revoke-others','security-logout','sec-export-events','sec-recovery-password'])
  assert.match(html,new RegExp('id="'+marker+'"'));
 assert.match(js,/security-center\/revoke-session/);
 assert.match(js,/security-center\/revoke-others/);
 assert.match(js,/switchSection\('profile'\)/);
 assert.match(js,/async function securityLoad\(/);
 assert.match(css,/GRACZ.PL security center/);
 assert.match(html,/2FA i kody odzyskiwania/);
});

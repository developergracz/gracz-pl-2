import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPrivacyRouter,ensurePrivacySchema} from '../auth/privacy-center.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';

const ownerA='11111111-1111-4111-8111-111111111111';
const ownerB='22222222-2222-4222-8222-222222222222';
const tokenA='a'.repeat(64),tokenB='b'.repeat(64);
const host='https://gracz-contact-api.onrender.com';
const current={
 discoverable:true,friendRequests:true,friendMessages:true,gameInvites:true,showOnline:true,
 publicProfile:false,showStats:false,showCountry:false,showBadges:false
};
function mock(){
 const saved=new Map(),calls=[];
 const database={async query(sql,params=[]){
  calls.push({sql,params});
  if(sql.includes('SELECT a.id FROM gracz_public_identity.sessions s JOIN gracz_public_identity.accounts a')){
   return {rows:params[0]===tokenA?[{id:ownerA}]:params[0]===tokenB?[{id:ownerB}]:[]};
  }
  if(sql.startsWith('WITH privacy_saved AS (')){
   const [account,discoverable,friendRequests,friendMessages,gameInvites,showOnline,
    publicProfile,showStats,showCountry,showBadges]=params;
   saved.set(account,{discoverable,friend_requests:friendRequests,friend_messages:friendMessages,
    game_invites:gameInvites,show_online:showOnline,public_profile:publicProfile,show_stats:showStats,
    show_country:showCountry,show_badges:showBadges});
   assert.match(sql,/FROM privacy_saved WHERE TRUE ON CONFLICT/);
   assert.match(sql,/DO UPDATE SET public_profile=EXCLUDED.public_profile/);
   return {rowCount:1,rows:[]};
  }
  if(sql.includes('FROM (SELECT $1::uuid AS id) self')){
   return {rows:[saved.get(params[0])||{}]};
  }
  if(sql.startsWith('SELECT a.nickname,a.email_key,a.created_at')){
   return {rows:[{nickname:params[0]===ownerA?'alpha':'beta',
    email_key:params[0]===ownerA?'alpha@example.test':'beta@example.test',
    created_at:'2026-11-05',display_name:'Gracz',bio:'Opis',country:'PL',language:'pl',
    avatar:'crown',cover:'wave',accent:'turquoise',motto:'Gra',city:'Tychy'}]};
  }
  throw Error('Unexpected SQL: '+sql.slice(0,110));
 }};
 const api=createPrivacyRouter({database,ready:async()=>{},sessionToken:req=>req.headers.auth||'',
  digest:x=>x,authorizedOrigin:req=>req.headers.origin===host,
  readBody:async req=>req.body,allow:()=>true});
 async function call(auth=tokenA,method='GET',path='/auth/privacy-center',body={},origin=host){
  const req={method,headers:{auth,origin},body,socket:{remoteAddress:'127.0.0.1'}};
  const res={code:0,headers:null,text:'',writeHead(code,headers){this.code=code;this.headers=headers},end(body){this.text=String(body)}};
  const handled=await api.handle(req,res,new URL(path,host));
  assert.equal(handled,true);
  return {status:res.code,body:JSON.parse(res.text),headers:res.headers};
 }
 return {call,calls,saved};
}
test('privacy schema is owner-scoped and has compatible defaults',async()=>{
 const queries=[];
 await ensurePrivacySchema({query:async sql=>{queries.push(sql);return {rows:[]}}});
 assert.equal(queries.length,1);
 assert.match(queries[0],/account_id uuid PRIMARY KEY REFERENCES gracz_public_identity.accounts/);
 for(const key of ['discoverable','friend_requests','friend_messages','game_invites','show_online'])
  assert.match(queries[0],new RegExp(key+' boolean NOT NULL DEFAULT true'));
});
test('unauthenticated, cross-origin, malformed or method-invalid requests never write',async()=>{
 const x=mock();
 assert.equal((await x.call('')).status,401);
 assert.equal((await x.call(tokenA,'POST')).status,405);
 assert.equal((await x.call(tokenA,'PUT','/auth/privacy-center',current,'https://attacker.example')).status,403);
 assert.equal((await x.call(tokenA,'PUT','/auth/privacy-center',{...current,showOnline:'yes'})).status,400);
 assert.equal((await x.call(tokenA,'PUT','/auth/privacy-center',{...current,secret:'extra'})).status,400);
 assert.equal(x.saved.size,0);
});
test('privacy updates atomically persist both private relationship flags and public profile permissions',async()=>{
 const x=mock();
 const privatePrefs=Object.fromEntries(Object.keys(current).map(k=>[k,false]));
 const put=await x.call(tokenA,'PUT','/auth/privacy-center',privatePrefs);
 assert.equal(put.status,200);
 assert.deepEqual(put.body.preferences,privatePrefs);
 assert.equal(x.calls.filter(x=>x.sql.startsWith('WITH privacy_saved AS (')).length,1);
 const reread=await x.call(tokenA);
 assert.deepEqual(reread.body.preferences,privatePrefs);
 assert.deepEqual((await x.call(tokenB)).body.preferences,current);
});
test('settings export is authenticated, owner-specific and does not claim full account archive',async()=>{
 const x=mock();
 const a=await x.call(tokenA,'GET','/auth/privacy-center/export');
 assert.equal(a.status,200);
 assert.equal(a.headers['Cache-Control'],'private, no-store');
 assert.equal(a.body.format,'gracz-privacy-settings-v1');
 assert.match(a.body.scope,/nie pełne archiwum danych konta/);
 assert.equal(a.body.profile.email,'alpha@example.test');
 assert.equal(JSON.stringify(a.body).includes(ownerA),false);
 const b=await x.call(tokenB,'GET','/auth/privacy-center/export');
 assert.equal(b.body.profile.email,'beta@example.test');
 assert.equal((await x.call('','GET','/auth/privacy-center/export')).status,401);
});
test('server social pathways actually check target privacy flags at database boundary',()=>{
 const source=readFileSync(new URL('../auth/public-identity.mjs',import.meta.url),'utf8');
 for(const column of ['discoverable','friend_requests','friend_messages','game_invites','show_online'])
  assert.match(source,new RegExp('p\\.'+column+' FROM gracz_public_identity\\.privacy_preferences'));
 assert.match(source,/AND COALESCE\(\(SELECT p\.friend_messages/);
 assert.match(source,/AND COALESCE\(\(SELECT p\.game_invites/);
 assert.match(source,/WHERE COALESCE\(\(SELECT p\.friend_requests/);
});
test('privacy center serves six compact tabs, nine effective controls, presets and existing module navigation',()=>{
 const result=[];
 for(const path of ['/konto/panel/','/konto/panel/app.js','/konto/panel/styl.css']){
  const res={status:0,text:'',writeHead(status){this.status=status},end(text){this.text=String(text)}};
  assert.equal(servePlayerPanel({method:'GET'},res,new URL(path,host)),true);
  assert.equal(res.status,200);result.push(res.text);
 }
 const [html,js,css]=result;
 assert.equal((html.match(/data-priv-tab="/g)||[]).length,6);
 assert.equal((html.match(/data-priv-pane="/g)||[]).length,6);
 for(const id of Object.keys(current))assert.match(html,new RegExp('id="priv-'+id+'"'));
 for(const id of ['priv-save','priv-reset','priv-export','priv-manage-blocks','priv-preview-profile'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/async function privacyLoad\(\)/);
 assert.match(js,/api\('privacy-center',\{method:'PUT'/);
 assert.match(js,/const privacyPresets=/);
 assert.match(css,/Privacy Center Full Max Premium/);
 assert.match(html,/nie są jeszcze połączone/);
});

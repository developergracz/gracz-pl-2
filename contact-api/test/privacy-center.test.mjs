import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPrivacyRouter,ensurePrivacySchema,privacyDefaults} from '../auth/privacy-center.mjs';
import {servePlayerPanel} from '../auth/panel.mjs';
import {createPremiumProfileRouter} from '../auth/premium-profile.mjs';

const ownerA='11111111-1111-4111-8111-111111111111';
const ownerB='22222222-2222-4222-8222-222222222222';
const tokenA='a'.repeat(64),tokenB='b'.repeat(64);
const host='https://gracz-contact-api.onrender.com';
const current={...privacyDefaults};
const persistedKeys=['discoverable','friendRequests','friendMessages','gameInvites','showOnline',
 'exactSearchOnly','mutualFriendsOnlyRequests','trustedMessagesOnly','trustedInvitesOnly','trustedPresenceOnly',
 'showDisplayName','showBio','showMotto','showJoined','showCity','showWinRate'];
const publicKeys=['publicProfile','showStats','showCountry','showBadges'];
const snake=key=>key.replace(/[A-Z]/g,letter=>'_'+letter.toLowerCase());
function mock(){
 const saved=new Map(),calls=[];
 const database={async query(sql,params=[]){
  calls.push({sql,params});
  if(sql.includes('SELECT a.id FROM gracz_public_identity.sessions s JOIN gracz_public_identity.accounts a')){
   return {rows:params[0]===tokenA?[{id:ownerA}]:params[0]===tokenB?[{id:ownerB}]:[]};
  }
  if(sql.startsWith('WITH privacy_saved AS (')){
   assert.equal(params.length,1+persistedKeys.length+publicKeys.length);
   const account=params[0];
   const row=Object.fromEntries(persistedKeys.map((key,i)=>[snake(key),params[i+1]]));
   for(const [i,key] of publicKeys.entries())row[snake(key)]=params[1+persistedKeys.length+i];
   saved.set(account,row);
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
 assert.equal(queries.length,12);
 assert.match(queries[0],/account_id uuid PRIMARY KEY REFERENCES gracz_public_identity.accounts/);
 for(const key of ['discoverable','friend_requests','friend_messages','game_invites','show_online'])
  assert.match(queries[0],new RegExp(key+' boolean NOT NULL DEFAULT true'));
 for(const key of persistedKeys.slice(5))assert.ok(queries.some(sql=>
  sql.includes('ADD COLUMN IF NOT EXISTS '+snake(key)+' boolean NOT NULL DEFAULT')),
  'missing privacy migration for '+key);
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
 for(const column of ['discoverable','friend_requests','friend_messages','game_invites','show_online',
 'exact_search_only','mutual_friends_only_requests','trusted_messages_only','trusted_invites_only','trusted_presence_only'])
  assert.match(source,new RegExp('p\\.'+column+' FROM gracz_public_identity\\.privacy_preferences'));
 assert.match(source,/AND COALESCE\(\(SELECT p\.friend_messages/);
 assert.match(source,/AND COALESCE\(\(SELECT p\.game_invites/);
 assert.match(source,/WHERE COALESCE\(\(SELECT p\.friend_requests/);
 assert.match(source,/FROM gracz_public_identity\.player_address_book ab WHERE ab\.owner_id=\$3 AND ab\.friend_id=\$2 AND ab\.favorite=true/);
 assert.match(source,/FROM gracz_public_identity\.player_address_book ab WHERE ab\.owner_id=a\.id AND ab\.friend_id=\$1 AND ab\.favorite=true/);
 assert.match(source,/FROM gracz_public_identity\.friend_connections f1/);
 assert.match(source,/THEN a\.nickname_key=\$2 ELSE starts_with/);
});
test('privacy center serves eight compact tabs, twenty enforceable controls and presets',()=>{
 const result=[];
 for(const path of ['/konto/panel/','/konto/panel/app.js','/konto/panel/styl.css']){
  const res={status:0,text:'',writeHead(status){this.status=status},end(text){this.text=String(text)}};
  assert.equal(servePlayerPanel({method:'GET'},res,new URL(path,host)),true);
  assert.equal(res.status,200);result.push(res.text);
 }
 const [html,js,css]=result;
 assert.equal((html.match(/data-priv-tab="/g)||[]).length,8);
 assert.equal((html.match(/data-priv-pane="/g)||[]).length,8);
 assert.equal(Object.keys(current).length,20);
 for(const id of Object.keys(current))assert.match(html,new RegExp('id="priv-'+id+'"'));
 for(const id of ['priv-save','priv-reset','priv-export','priv-manage-blocks','priv-preview-profile'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/async function privacyLoad\(\)/);
 assert.match(js,/api\('privacy-center',\{method:'PUT'/);
 assert.match(js,/const privacyPresets=/);
 assert.match(js,/gracz:privacy-updated/);
 assert.match(html,/Maksymalna prywatność/);
 assert.match(html,/Zapisz ustawienia/);
 assert.match(html,/Pełne archiwum|pełny eksport archiwum/);
 assert.match(css,/Privacy Center Full Max Premium/);
 assert.match(html,/Po uruchomieniu forum będzie można/);
});

test('granular public data options are enforced before sending a public profile',()=>{
 const source=readFileSync(new URL('../auth/premium-profile.mjs',import.meta.url),'utf8');
 assert.match(source,/LEFT JOIN gracz_public_identity\.privacy_preferences privacy ON privacy.account_id=a.id/);
 for(const key of ['show_display_name','show_bio','show_motto','show_joined','show_city','show_win_rate'])
  assert.ok(source.includes('privacy.'+key),'missing public consent '+key);
 assert.match(source,/row\.show_display_name===false\?row\.nickname/);
 assert.match(source,/row\.show_bio===false\?'':/);
 assert.match(source,/row\.show_joined===false\?null:/);
 assert.match(source,/row\.show_motto===false\?'':/);
 assert.match(source,/delete publicData\.stats\.totals\.winRate/);
});

test('public profile response hides private fields, masks joined date and suppresses win rate',async()=>{
 const settings={id:ownerA,nickname:'alpha',display_name:'Nazwa prywatna',bio:'Opis prywatny',
  country:'PL',created_at:'2026-01-01T00:00:00Z',avatar:'crown',cover:'wave',accent:'turquoise',
  motto:'Moje motto',city:'Tychy',public_profile:true,show_stats:true,show_country:true,
  show_badges:false,show_display_name:false,show_bio:false,show_motto:false,
  show_joined:false,show_city:false,show_win_rate:false};
 const sqls=[];
 const database={async query(sql,args){
  sqls.push({sql,args});
  if(sql.includes('WHERE a.nickname_key=$1'))return {rows:[settings]};
  if(sql.includes('GROUP BY c.game'))return {rows:[{game:'gomoku',played:10,wins:6,losses:3,draws:1,active:0}]};
  if(sql.includes('ORDER BY m.updated_at DESC LIMIT 12'))return {rows:[]};
  throw Error('Unexpected query '+sql.slice(0,80));
 }};
 const router=createPremiumProfileRouter({database,ready:async()=>{},sessionToken:()=>'',digest:x=>x,
  authorizedOrigin:()=>true,readBody:async()=>({}),allow:()=>true,validNick:x=>x==='alpha'});
 async function read(){
  const req={method:'GET',socket:{remoteAddress:'127.0.0.1'}};
  const response={status:0,body:'',writeHead(code){this.status=code},end(body){this.body=String(body)}};
  const handled=await router.handle(req,response,new URL('/auth/public-profile?nick=alpha',host));
  assert.equal(handled,true);assert.equal(response.status,200);
  return JSON.parse(response.body).profile;
 }
 const hidden=await read();
 assert.equal(hidden.nickname,'alpha');
 assert.equal(hidden.displayName,'alpha');
 assert.equal(hidden.bio,'');assert.equal(hidden.motto,'');
 assert.equal(hidden.createdAt,null);
 assert.equal(hidden.city,'');
 assert.equal(hidden.country,'PL');
 assert.equal(Object.hasOwn(hidden.stats.totals,'winRate'),false);
 assert.equal(hidden.stats.totals.wins,6);
 assert.ok(sqls[0].sql.includes('LEFT JOIN gracz_public_identity.privacy_preferences privacy'));
 Object.assign(settings,{show_display_name:true,show_bio:true,show_motto:true,
  show_joined:true,show_city:true,show_win_rate:true});
 const shown=await read();
 assert.equal(shown.displayName,'Nazwa prywatna');
 assert.equal(shown.bio,'Opis prywatny');
 assert.equal(shown.motto,'Moje motto');
 assert.equal(shown.createdAt,'2026-01-01T00:00:00Z');
 assert.equal(shown.city,'Tychy');
 assert.equal(shown.stats.totals.winRate,60);
});

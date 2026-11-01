import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { Script } from 'node:vm';
import { createPublicIdentityRouter } from '../auth/public-identity.mjs';
import { servePlayerPanel } from '../auth/panel.mjs';

function response() {
  return {
    status: 0, headers: {}, body: '',
    writeHead(status, headers) { this.status=status; this.headers=headers; },
    end(body) { this.body=String(body || ''); },
  };
}
function request(method, path, {cookie, origin, body}={}) {
  const raw=body===undefined?'':JSON.stringify(body);
  const req=Readable.from(raw?[raw]:[]);
  req.method=method;
  req.url=path;
  req.headers={};
  if(cookie)req.headers.cookie='__Host-gracz_session='+cookie;
  if(origin){req.headers.origin=origin;req.headers['sec-fetch-site']='same-origin';}
  req.socket={remoteAddress:'127.0.0.1'};
  return req;
}
const cookie='a'.repeat(64);
const account={id:'00000000-0000-4000-8000-000000000001',nickname:'TestowyGracz',
  email_key:'testowy@example.test',created_at:'2026-11-01T00:00:00Z'};
function fixture(){
  let profile=null;
  let preferences=null;
  let otherSessions=1;
  const queries=[];
  const database={enabled:true,async query(sql,params=[]){
    queries.push({sql,params});
    if(sql.includes('SELECT a.id, a.nickname, a.email_key')){
      if(!params[0] || Buffer.from(params[0]).length!==32)return {rows:[]};
      return {rows:[{...account,display_name:profile?.displayName||null,
        bio:profile?.bio||null,country:profile?.country||null,language:profile?.language||null}]};
    }
    if(sql.includes('SELECT a.id FROM gracz_public_identity.sessions s')){
      if(!params[0]||Buffer.from(params[0]).length!==32)return {rows:[]};
      return {rows:[{id:account.id}],rowCount:1};
    }
    if(sql.includes('SELECT density,reduce_motion,large_text,favorite_games')){
      return {rows:preferences?[preferences]:[]};
    }
    if(sql.includes('SELECT created_at,expires_at,(token_digest=$2)')){
      return {rows:[
        {created_at:'2026-11-01T09:00:00Z',expires_at:'2026-11-08T09:00:00Z',current:true},
        ...(otherSessions?[{created_at:'2026-11-01T08:00:00Z',expires_at:'2026-11-08T08:00:00Z',current:false}]:[])
      ]};
    }
    if(sql.includes('INSERT INTO gracz_public_identity.player_preferences')){
      preferences={density:params[1],reduce_motion:params[2],large_text:params[3],favorite_games:params[4]};
      return {rows:[],rowCount:1};
    }
    if(sql.includes('DELETE FROM gracz_public_identity.sessions')&&sql.includes('token_digest<>')){
      const count=otherSessions;otherSessions=0;return {rows:[],rowCount:count};
    }
    if(sql.includes('INSERT INTO gracz_public_identity.profiles')){
      profile={displayName:params[1],bio:params[2],country:params[3],language:params[4]};
    }
    return {rows:[],rowCount:1};
  }};
  const router=createPublicIdentityRouter({database,emailFrom:'test@example.test',resendKey:'synthetic-key'});
  async function call(method,path,options={}){
    const req=request(method,path,options),res=response();
    const handled=await router.handle(req,res,new URL(path,'https://gracz-contact-api.onrender.com'));
    assert.equal(handled,true);
    return {status:res.status,body:JSON.parse(res.body),headers:res.headers};
  }
  return {call,queries};
}

test('panel renders nine documented sections and syntactically valid browser JavaScript',()=>{
  for(const [path,type] of [['/konto/panel/','text/html'],['/konto/panel/styl.css','text/css'],['/konto/panel/app.js','application/javascript']]){
    const res=response();
    assert.equal(servePlayerPanel({method:'GET'},res,new URL(path,'https://gracz-contact-api.onrender.com')),true);
    assert.equal(res.status,200);
    assert.match(res.headers['Content-Type'],new RegExp(type));
    assert.equal(res.headers['Cache-Control'],'no-store');
    if(path.endsWith('/')) {
      assert.match(res.body,/noindex,nofollow,noarchive/);
      assert.equal((res.body.match(/data-section="/g)||[]).length,13);
    }
    if(path.endsWith('.js'))new Script(res.body);
    if(path.endsWith('.css'))assert.match(res.body,/@media\(max-width:610px\)/);
  }
  const res=response();
  assert.equal(servePlayerPanel({method:'POST'},res,new URL('/konto/panel/','https://gracz-contact-api.onrender.com')),false);
});

test('profile fails closed without a valid session',async()=>{
  const {call}=fixture();
  const result=await call('GET','/auth/profile');
  assert.equal(result.status,401);
  assert.equal(result.body.error,'BRAK_SESJI');
});

test('profile GET returns only current verified session account data',async()=>{
  const {call,queries}=fixture();
  const result=await call('GET','/auth/profile',{cookie});
  assert.equal(result.status,200);
  assert.deepEqual(result.body.profile,{
    nickname:'TestowyGracz',email:'testowy@example.test',
    displayName:'TestowyGracz',bio:'',country:'PL',language:'pl',
    createdAt:'2026-11-01T00:00:00Z',
  });
  assert.match(queries.find(q=>q.sql.includes('SELECT a.id')).sql,/s\.token_digest=\$1 AND s\.expires_at>now\(\) AND a\.verified_at IS NOT NULL/);
});

test('profile PUT validates origin and persists only allowed profile fields',async()=>{
  const {call,queries}=fixture();
  const denied=await call('PUT','/auth/profile',{cookie,origin:'https://evil.example.test',
    body:{displayName:'Nie',bio:'',country:'PL',language:'pl'}});
  assert.equal(denied.status,403);
  const bad=await call('PUT','/auth/profile',{cookie,origin:'https://gracz-contact-api.onrender.com',
    body:{displayName:'A',bio:'',country:'PL',language:'pl'}});
  assert.equal(bad.status,400);
  const saved=await call('PUT','/auth/profile',{cookie,origin:'https://gracz-contact-api.onrender.com',
    body:{displayName:'Mistrz Warcabów',bio:'Lubię ♟',country:'PL',language:'pl'}});
  assert.equal(saved.status,200);
  assert.equal(saved.body.profile.displayName,'Mistrz Warcabów');
  assert.equal(saved.body.profile.bio,'Lubię ♟');
  const insert=queries.find(q=>q.sql.includes('INSERT INTO gracz_public_identity.profiles'));
  assert.deepEqual(insert.params,[account.id,'Mistrz Warcabów','Lubię ♟','PL','pl']);
  const reread=await call('GET','/auth/profile',{cookie});
  assert.equal(reread.body.profile.displayName,'Mistrz Warcabów');
});


// Browser-like regression: the session gate must not flash a private account and redirect.
async function simulatePanel(status,profile) {
  const served=response();
  servePlayerPanel({method:'GET'},served,new URL('/konto/panel/app.js','https://gracz-contact-api.onrender.com'));
  const nodes=new Map();
  const document={
    getElementById(id){
      if(!nodes.has(id))nodes.set(id,{
        hidden:id==='player-shell',textContent:'',value:'',disabled:false,
        classList:{toggle(){},add(){},remove(){}},
        addEventListener(){},focus(){},setAttribute(){}
      });
      return nodes.get(id);
    },
    querySelectorAll(){return[];}
  };
  let navigations=0;
  const fetch=async(path,options)=>{
    assert.equal(path,'/auth/profile');
    assert.equal(options.credentials,'same-origin');
    return {status,ok:status===200,json:async()=>status===200?{ok:true,profile}:{ok:false,error:'BRAK_SESJI'}};
  };
  new Script(served.body).runInNewContext({
    document,fetch,location:{replace(){navigations++;},assign(){navigations++;}},
  });
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,navigations};
}

test('unauthorized panel stays on page with an explicit login link and no private data flash',async()=>{
  const {nodes,navigations}=await simulatePanel(401);
  assert.equal(nodes.get('player-shell').hidden,true);
  assert.equal(nodes.get('access-screen').hidden,false);
  assert.equal(nodes.get('access-login').hidden,false);
  assert.match(nodes.get('access-title').textContent,/Zaloguj/);
  assert.equal(navigations,0);
});

test('authorized panel becomes visible after successful profile fetch',async()=>{
  const profile={nickname:'Gracz123',email:'test@example.test',displayName:'Mistrz',
    bio:'Warcaby',country:'PL',language:'pl'};
  const {nodes,navigations}=await simulatePanel(200,profile);
  assert.equal(nodes.get('player-shell').hidden,false);
  assert.equal(nodes.get('access-screen').hidden,true);
  assert.equal(nodes.get('nickname').value,'Gracz123');
  assert.equal(nodes.get('profile-heading').textContent,'Mistrz');
  assert.equal(navigations,0);
});

test('login page verifies server-side session cookie before opening player panel',async()=>{
  const {serveIdentityPage}=await import('../auth/page.mjs');
  const res=response();
  assert.equal(serveIdentityPage({method:'GET'},res,new URL('/konto/app.js','https://gracz-contact-api.onrender.com')),true);
  assert.match(res.body,/const session=await api\('session'\)/);
  assert.match(res.body,/if\(!session\.loggedIn \|\| session\.nickname!==b\.nickname\)/);
});


test('Full Max Premium center rejects unauthenticated requests and unsafe origins',async()=>{
  const {call}=fixture();
  const noSession=await call('GET','/auth/player-center');
  assert.equal(noSession.status,401);
  const invalidOrigin=await call('PUT','/auth/player-center',{cookie,origin:'https://attacker.test',
    body:{density:'compact',reduceMotion:true,largeText:false,favoriteGames:[]}});
  assert.equal(invalidOrigin.status,403);
  const missing=await call('POST','/auth/player-center/revoke-others');
  assert.equal(missing.status,403);
  const wrongMethod=await call('POST','/auth/player-center',{cookie,origin:'https://gracz-contact-api.onrender.com'});
  assert.equal(wrongMethod.status,405);
});

test('premium settings and game favorites persist for the owning account',async()=>{
  const {call,queries}=fixture();
  const first=await call('GET','/auth/player-center',{cookie});
  assert.equal(first.status,200);
  assert.deepEqual(first.body.center.preferences,
    {density:'comfortable',reduceMotion:false,largeText:false,favoriteGames:[]});
  assert.equal(first.body.center.sessions.length,2);
  assert.equal(first.body.center.sessions.filter(x=>x.current).length,1);
  assert.equal(JSON.stringify(first.body).includes('token_digest'),false);
  const origin='https://gracz-contact-api.onrender.com';
  const unsafe=await call('PUT','/auth/player-center',{cookie,origin,
    body:{density:'full',reduceMotion:false,largeText:false,favoriteGames:[]}});
  assert.equal(unsafe.status,400);
  const duplicate=await call('PUT','/auth/player-center',{cookie,origin,
    body:{density:'compact',reduceMotion:true,largeText:true,favoriteGames:['warcaby','warcaby']}});
  assert.equal(duplicate.status,400);
  const save=await call('PUT','/auth/player-center',{cookie,origin,
    body:{density:'compact',reduceMotion:true,largeText:true,favoriteGames:['warcaby','gomoku']}});
  assert.equal(save.status,200);
  assert.deepEqual(save.body.center.preferences,
    {density:'compact',reduceMotion:true,largeText:true,favoriteGames:['warcaby','gomoku']});
  const entry=queries.find(x=>x.sql.includes('INSERT INTO gracz_public_identity.player_preferences'));
  assert.deepEqual(entry.params,[account.id,'compact',true,true,['warcaby','gomoku']]);
  const reread=await call('GET','/auth/player-center',{cookie});
  assert.deepEqual(reread.body.center.preferences,save.body.center.preferences);
});

test('revoking other sessions retains current session and is idempotent',async()=>{
  const {call,queries}=fixture();
  const options={cookie,origin:'https://gracz-contact-api.onrender.com',body:{}};
  const revoked=await call('POST','/auth/player-center/revoke-others',options);
  assert.equal(revoked.status,200);
  assert.equal(revoked.body.revoked,1);
  const sql=queries.find(x=>x.sql.includes('token_digest<>'));
  assert.equal(sql.params[0],account.id);
  assert.equal(Buffer.from(sql.params[1]).byteLength,32);
  const remaining=await call('GET','/auth/player-center',{cookie});
  assert.equal(remaining.body.center.sessions.length,1);
  assert.equal(remaining.body.center.sessions[0].current,true);
  const again=await call('POST','/auth/player-center/revoke-others',options);
  assert.equal(again.body.revoked,0);
});

test('dashboard includes real controls for sessions, favorites, preferences and limited data export',()=>{
 const htmlRes=response(),jsRes=response();
 servePlayerPanel({method:'GET'},htmlRes,new URL('/konto/panel/','https://gracz-contact-api.onrender.com'));
 servePlayerPanel({method:'GET'},jsRes,new URL('/konto/panel/app.js','https://gracz-contact-api.onrender.com'));
 for(const id of ['dashboard-sessions','dashboard-favorites','dashboard-joined','setting-density',
   'setting-large','setting-motion','sessions-revoke','export-profile']){
   assert.match(htmlRes.body,new RegExp('id="'+id+'"'));
 }
 assert.match(jsRes.body,/api\('player-center'/);
 assert.match(jsRes.body,/player-center\/revoke-others/);
 assert.match(htmlRes.body,/Poker treningowy/);
 assert.match(htmlRes.body,/gracz\.pl\/gry\/warcaby/);
 assert.match(htmlRes.body,/nie jest pełny eksport/i);
});


test('friends endpoints fail closed without a verified session and reject cross-origin mutation',async()=>{
  const {call}=fixture();
  assert.equal((await call('GET','/auth/friends')).status,401);
  assert.equal((await call('GET','/auth/friends/search?nick=gracz')).status,401);
  const missing=await call('POST','/auth/friends/action',{origin:'https://gracz-contact-api.onrender.com',body:{action:'send',nickname:'GraczBeta'}});
  assert.equal(missing.status,401);
  const crossOrigin=await call('POST','/auth/friends/action',{cookie,origin:'https://evil.example.test',
    body:{action:'send',nickname:'GraczBeta'}});
  assert.equal(crossOrigin.status,403);
  assert.equal((await call('GET','/auth/friends/action')).status,405);
  assert.equal((await call('POST','/auth/friends',{cookie,origin:'https://gracz-contact-api.onrender.com',body:{}})).status,405);
});

test('friends relationship mutations bind account IDs and do not accept client-supplied account IDs',async()=>{
  const other={id:'00000000-0000-4000-8000-000000000002',nickname:'GraczBeta'};
  const recorded=[],relations=new Map(),blocks=new Set();
  const db={enabled:true,async query(sql,params=[]){
    recorded.push({sql,params});
    if(sql.includes('SELECT a.id')&&sql.includes('FROM gracz_public_identity.sessions s'))
      return {rows:[{id:account.id}],rowCount:1};
    if(sql.includes('SELECT id FROM gracz_public_identity.accounts')&&sql.includes('WHERE nickname_key='))
      return {rows:params[0]==='graczbeta'?[other]:[],rowCount:params[0]==='graczbeta'?1:0};
    if(sql.includes('INSERT INTO gracz_public_identity.friend_connections')){
      if(relations.has('pair')||blocks.size)return {rows:[],rowCount:0};
      relations.set('pair',{from:account.id,status:'pending'});return {rows:[{account_a:account.id}],rowCount:1};
    }
    if(sql.includes('UPDATE gracz_public_identity.friend_connections')){
      const r=relations.get('pair');
      if(!r||r.from!==params[1]||r.status!=='pending')return {rows:[],rowCount:0};
      r.status='accepted';return {rows:[{account_a:account.id}],rowCount:1};
    }
    if(sql.includes('INSERT INTO gracz_public_identity.friend_blocks')){
      blocks.add(params[0]+'|'+params[1]);return {rows:[],rowCount:1};
    }
    if(sql.includes('DELETE FROM gracz_public_identity.friend_connections')){
      const exists=relations.has('pair');
      relations.delete('pair');return {rows:exists?[{account_a:account.id}]:[],rowCount:exists?1:0};
    }
    if(sql.includes('SELECT a.nickname,c.status,')){
      const r=relations.get('pair');
      return {rows:r?[{nickname:other.nickname,status:r.status,direction:'outgoing'}]:[],rowCount:r?1:0};
    }
    if(sql.includes('SELECT a.nickname FROM gracz_public_identity.friend_blocks')){
      return {rows:blocks.size?[{nickname:other.nickname}]:[],rowCount:blocks.size};
    }
    if(sql.includes('starts_with(a.nickname_key')){
      return {rows:blocks.size?[]:[{nickname:other.nickname}]};
    }
    return {rows:[],rowCount:0};
  }};
  const router=createPublicIdentityRouter({database:db,emailFrom:'test@example.test',resendKey:'synthetic-key'});
  async function action(name,nickname){
    const req=request('POST','/auth/friends/action',{cookie,origin:'https://gracz-contact-api.onrender.com',
      body:{action:name,nickname,accountId:'00000000-0000-4000-8000-00000000ffff'}});
    const res=response();
    assert.equal(await router.handle(req,res,new URL('/auth/friends/action','https://gracz-contact-api.onrender.com')),true);
    return {status:res.status,body:JSON.parse(res.body)};
  }
  assert.equal((await action('send','GraczBeta')).status,200);
  assert.equal((await action('send','GraczBeta')).status,409);
  assert.equal((await action('accept','GraczBeta')).status,409);
  assert.equal((await action('block','GraczBeta')).status,200);
  assert.equal((await action('send','GraczBeta')).status,409);
  assert.equal((await action('send','TestowyGracz')).status,404);
  const sent=recorded.find(x=>x.sql.includes('INSERT INTO gracz_public_identity.friend_connections'));
  assert.deepEqual(sent.params,[account.id,other.id]);
  assert.match(sent.sql,/ON CONFLICT DO NOTHING/);
  assert.match(sent.sql,/friend_blocks/);
});

test('friends UI has real action handlers, no fabricated presence and all requested sections',()=>{
  const r=response(),script=response();
  servePlayerPanel({method:'GET'},r,new URL('/konto/panel/','https://gracz-contact-api.onrender.com'));
  servePlayerPanel({method:'GET'},script,new URL('/konto/panel/app.js','https://gracz-contact-api.onrender.com'));
  for(const id of ['friends-search-form','friends-search-results','friends-list','friends-incoming',
    'friends-outgoing','friends-blocked','friends-status'])
    assert.match(r.body,new RegExp('id="'+id+'"'));
  assert.match(r.body,/Status online wymaga przyszłej integracji/);
  assert.match(r.body,/Prywatne wiadomości są dostępne w osobnej zakładce/);
  assert.match(script.body,/api\('friends\/action'/);
  assert.match(script.body,/refreshFriends/);
  new Script(script.body);
});


test('social message and game challenge APIs enforce session, origin and actual friendship',async()=>{
 const {createHash}=await import('node:crypto');
 const idA='00000000-0000-4000-8000-000000000001';
 const idB='00000000-0000-4000-8000-000000000002';
 const tkA='a'.repeat(64),tkB='b'.repeat(64);
 const digest=x=>createHash('sha256').update(x).digest('hex');
 const messages=[],challenges=[];
 let friends=true,blocked=false;
 const now='2026-11-01T19:00:00Z';
 const db={enabled:true,async query(sql,params=[]){
  if(sql.startsWith('CREATE '))return {rows:[],rowCount:0};
  if(sql.includes('SELECT a.id FROM gracz_public_identity.sessions s')){
   const d=Buffer.from(params[0]||[]).toString('hex');
   const id=d===digest(tkA)?idA:d===digest(tkB)?idB:null;
   return {rows:id?[{id}]:[],rowCount:id?1:0};
  }
  if(sql.includes('SELECT a.id,a.nickname')&&sql.includes('friend_connections')){
   const valid=friends&&!blocked;
   const other=params[0]===idA?{id:idB,nickname:'GraczBeta'}:{id:idA,nickname:'TestowyGracz'};
   return {rows:valid&&other.nickname.toLowerCase()===params[1]?[other]:[]};
  }
  if(sql.includes('INSERT INTO gracz_public_identity.friend_messages')){
   if(!friends||blocked)return {rows:[],rowCount:0};
   const [id,sender,recipient,body]=params;
   messages.push({id,sender_id:sender,recipient_id:recipient,body,created_at:now});
   return {rows:[{id,created_at:now}],rowCount:1};
  }
  if(sql.includes('SELECT id,sender_id,body,created_at FROM (')){
   const [one,two]=params;
   const rows=messages.filter(m=>[one,two].includes(m.sender_id)&&[one,two].includes(m.recipient_id));
   return {rows,rowCount:rows.length};
  }
  if(sql.includes('SELECT c.id,c.game,')&&sql.includes('game_challenges')){
   const rows=challenges.filter(c=>[c.sender_id,c.recipient_id].includes(params[0]))
    .map(c=>({...c,opponent:c.sender_id===params[0]?'TestowyGracz':'GraczBeta',
      outgoing:c.sender_id===params[0]}));
   return {rows,rowCount:rows.length};
  }
  if(sql.includes('SET status=\'expired\''))return {rows:[],rowCount:0};
  if(sql.includes('INSERT INTO gracz_public_identity.game_challenges')){
   if(!friends||blocked||challenges.some(c=>c.game===params[3]&&c.status==='pending'))
    return {rows:[],rowCount:0};
   const [id,sender_id,recipient_id,game]=params;
   challenges.push({id,sender_id,recipient_id,game,status:'pending',
    created_at:now,expires_at:'2026-11-08T19:00:00Z'});
   return {rows:[{id}],rowCount:1};
  }
  if(sql.includes('UPDATE gracz_public_identity.game_challenges c')){
   const [status,id,actor]=params,c=challenges.find(v=>v.id===id&&v.status==='pending');
   if(!c||!friends||blocked||
     ((status==='cancelled'?c.sender_id:c.recipient_id)!==actor))
     return {rows:[],rowCount:0};
   c.status=status;return {rows:[{id}],rowCount:1};
  }
  throw Error('Unexpected query: '+sql.slice(0,130));
 }};
 const router=createPublicIdentityRouter({database:db,emailFrom:'test@example.test',resendKey:'synthetic'});
 async function call(token,method,path,body,origin='https://gracz-contact-api.onrender.com'){
  const req=request(method,path,{cookie:token,origin:method==='POST'?origin:undefined,body});
  const res=response();
  assert.equal(await router.handle(req,res,new URL(path,'https://gracz-contact-api.onrender.com')),true);
  return {status:res.status,data:JSON.parse(res.body)};
 }
 assert.equal((await call(undefined,'GET','/auth/social/messages?nick=GraczBeta')).status,401);
 assert.equal((await call(tkA,'POST','/auth/social/messages',{nickname:'GraczBeta',message:'Hi'},'https://bad.test')).status,403);
 assert.equal((await call(tkA,'POST','/auth/social/messages',{nickname:'GraczBeta',message:''})).status,400);
 assert.equal((await call(tkA,'POST','/auth/social/messages',{nickname:'GraczBeta',message:'X'.repeat(1001)})).status,400);
 assert.equal((await call(tkA,'POST','/auth/social/messages',{nickname:'GraczBeta',message:'Cześć!'})).status,200);
 const reply=await call(tkB,'GET','/auth/social/messages?nick=TestowyGracz');
 assert.equal(reply.status,200);
 assert.deepEqual(reply.data.messages.map(m=>({own:m.own,body:m.body})),[{own:false,body:'Cześć!'}]);
 assert.doesNotMatch(JSON.stringify(reply.data),/sender_id|recipient_id|token_digest/);
 const invalidGame=await call(tkA,'POST','/auth/social/challenges',{action:'send',nickname:'GraczBeta',game:'poker'});
 assert.equal(invalidGame.status,400);
 const sent=await call(tkA,'POST','/auth/social/challenges',{action:'send',nickname:'GraczBeta',game:'gomoku'});
 assert.equal(sent.status,200);
 assert.equal((await call(tkA,'POST','/auth/social/challenges',{action:'send',nickname:'GraczBeta',game:'gomoku'})).status,409);
 assert.equal((await call(tkA,'POST','/auth/social/challenges',{action:'accept',id:sent.data.id})).status,409);
 assert.equal((await call(tkB,'POST','/auth/social/challenges',{action:'accept',id:sent.data.id})).status,200);
 const accepted=await call(tkA,'GET','/auth/social/challenges');
 assert.equal(accepted.data.challenges[0].status,'accepted');
 assert.equal(accepted.data.challenges[0].game,'gomoku');
 blocked=true;
 assert.equal((await call(tkA,'POST','/auth/social/messages',{nickname:'GraczBeta',message:'Stop'})).status,403);
 assert.equal((await call(tkB,'GET','/auth/social/messages?nick=TestowyGracz')).status,403);
 assert.equal((await call(tkA,'POST','/auth/social/challenges',{action:'send',nickname:'GraczBeta',game:'warcaby'})).status,403);
});

test('social UI declares limited game integration and renders safe message text without HTML injection',()=>{
 const html=response(),js=response();
 servePlayerPanel({method:'GET'},html,new URL('/konto/panel/','https://gracz-contact-api.onrender.com'));
 servePlayerPanel({method:'GET'},js,new URL('/konto/panel/app.js','https://gracz-contact-api.onrender.com'));
 for(const id of ['message-recipient','message-thread','message-form','challenge-friend',
   'challenge-game','challenge-list','challenges-refresh']){
  assert.match(html.body,new RegExp('id="'+id+'"'));
 }
 assert.match(html.body,/Ruchy są zatwierdzane i zapisywane na serwerze/);
 assert.match(html.body,/data-panel="play"/);
 assert.match(js.body,/api\('match'/);
 assert.match(js.body,/text\.textContent=item\.body/);
 assert.match(js.body,/social\/messages/);
 assert.match(js.body,/social\/challenges/);
 new Script(js.body);
});

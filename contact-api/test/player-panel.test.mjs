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
  const queries=[];
  const database={enabled:true,async query(sql,params=[]){
    queries.push({sql,params});
    if(sql.includes('SELECT a.id, a.nickname, a.email_key')){
      if(!params[0] || Buffer.from(params[0]).length!==32)return {rows:[]};
      return {rows:[{...account,display_name:profile?.displayName||null,
        bio:profile?.bio||null,country:profile?.country||null,language:profile?.language||null}]};
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
      assert.equal((res.body.match(/data-section="/g)||[]).length,9);
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

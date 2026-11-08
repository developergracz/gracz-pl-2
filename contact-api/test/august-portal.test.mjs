import test from 'node:test';
import assert from 'node:assert/strict';
import {createAugustPortal} from '../auth/august-portal.mjs';

function setup(user=null,enabled=true,previewAllowedNicknames=['PrzykładowyGracz'],lobbyPublic=false){
 const portal=createAugustPortal({
  database:{enabled:false},
  enabled,
  previewAllowedNicknames,
  lobbyPublic,
  publicIdentity:{
   authenticateGameRequest:async()=>user,
   probe:async()=>{}
  }
 });
 function response(){
  return {status:0,headers:null,body:'',
   writeHead(code,headers){this.status=code;this.headers=headers},
   end(data=''){this.body=String(data)}
  };
 }
 async function run(method,path,origin){
  const req={method,headers:{...(origin?{origin}:{})},socket:{remoteAddress:'127.0.0.1'}};
  const res=response();
  const handled=await portal.handle(req,res,new URL(path,'https://gracz-contact-api.onrender.com'));
  return {handled,res};
 }
 return {run};
}

test('anonymous access to august API is denied',async()=>{
 const {res}=await setup().run('GET','/auth/august/whoami');
 assert.equal(res.status,401);
 assert.match(res.body,/Zaloguj/);
});

test('identity comes from current authenticated session',async()=>{
 const {res}=await setup({userId:'account-uuid',displayName:'PrzykładowyGracz'}).run('GET','/auth/august/whoami');
 assert.equal(res.status,200);
 assert.deepEqual(JSON.parse(res.body).user,{userId:'account-uuid',displayName:'PrzykładowyGracz'});
});

test('same-origin is required for August mutations',async()=>{
 const {res}=await setup({userId:'account-uuid',displayName:'PrzykładowyGracz'}).run('POST','/auth/august/chat','https://evil.example');
 assert.equal(res.status,403);
});

test('historical pages are available only under isolated path',async()=>{
 const {run}=setup({userId:'account-uuid',displayName:'PrzykładowyGracz'});
 const {res}=await run('GET','/konto/sierpien/turnieje.html');
 assert.equal(res.status,200);
 assert.match(res.headers['Content-Type'],/text\/html/);
 assert.match(res.body,/Utwórz turniej/);
 const unknown=await run('GET','/konto/sierpien/nieistniejaca.html');
 assert.equal(unknown.handled,false);
});

test('preview and API remain disabled until explicitly enabled',async()=>{
 const {run}=setup({userId:'account-uuid',displayName:'Gracz'},false);
 for(const path of ['/konto/sierpien/turnieje.html','/auth/august/whoami','/auth/august/chat']){
  const {handled,res}=await run('GET',path);
  assert.equal(handled,false);
  assert.equal(res.status,0);
 }
});

test('private preview never exposes pages or API to another verified account',async()=>{
 const {run}=setup({userId:'account-uuid',displayName:'CudzyGracz'});
 const html=await run('GET','/konto/sierpien/settings.html');
 const data=await run('GET','/auth/august/whoami');
 assert.equal(html.res.status,404);
 assert.equal(data.res.status,404);
});

test('preview requires allowlist and a verified session even when feature flag is on',async()=>{
 const noList=setup({userId:'account-uuid',displayName:'PrzykładowyGracz'},true,[]);
 assert.equal((await noList.run('GET','/konto/sierpien/settings.html')).res.status,404);
 assert.equal((await noList.run('GET','/auth/august/whoami')).res.status,404);
 const anonymous=setup();
 assert.equal((await anonymous.run('GET','/konto/sierpien/settings.html')).res.status,401);
});

test('private preview does not activate production panel routing',async()=>{
 const portal=setup({userId:'account-uuid',displayName:'PrzykładowyGracz'});
 assert.equal((await portal.run('GET','/konto/panel/')).handled,false);
});

test('public lobby requires first-party verified session but does not expose private modules',async()=>{
 const invited={userId:'verified-id',displayName:'NieOwner'};
 const {run}=setup(invited,false,[],true);
 const lobby=await run('GET','/konto/lobby/');
 assert.equal(lobby.res.status,200);
 assert.match(lobby.res.body,/Lobby/);
 assert.match(lobby.res.body,/Gomoku/);
 assert.equal((await run('GET','/konto/sierpien/players.html')).res.status,200);
 assert.equal((await run('GET','/konto/sierpien/settings.html')).res.status,404);
 assert.equal((await run('GET','/auth/august/whoami')).handled,false);
 assert.equal((await run('GET','/konto/panel/')).handled,false);
});
test('public lobby redirects unauthenticated visitors to existing login',async()=>{
 const {run}=setup(null,false,[],true);
 const result=await run('GET','/konto/lobby/');
 assert.equal(result.res.status,302);
 assert.equal(result.res.headers.Location,'/konto/?widok=login');
});
test('public lobby cannot be accessed if rollout switch is off',async()=>{
 const {run}=setup({userId:'verified-id',displayName:'NieOwner'},false,[],false);
 assert.equal((await run('GET','/konto/lobby/')).handled,false);
});

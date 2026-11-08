import test from 'node:test';
import assert from 'node:assert/strict';
import {createAugustPortal} from '../auth/august-portal.mjs';

function setup(user=null,enabled=true){
 const portal=createAugustPortal({
  database:{enabled:false},
  enabled,
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
 const {run}=setup();
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

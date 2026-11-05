import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createSearchAccessRouter} from '../auth/search-access.mjs';

function req(method,url,{origin,body,cookie}={}){
 const r=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
 r.method=method;r.url=url;
 r.headers={...origin?{origin}:{},...cookie?{cookie}:{}};
 return r;
}
function response(){
 return {
  statusCode:0,headers:{},body:'',
  writeHead(status,headers){this.statusCode=status;this.headers=headers;return this;},
  end(value=''){this.body=String(value);return this;}
 };
}
async function call(router,method,path,opts){
 const r=req(method,path,opts),s=response();
 const handled=await router.handle(r,s,new URL('https://gracz-contact-api.onrender.com'+path));
 return {handled,status:s.statusCode,headers:s.headers,body:s.body};
}

test('guest search entry shows the premium dialog, preserving safe query only',async()=>{
 const router=createSearchAccessRouter({isAuthenticated:async()=>false});
 const answer=await call(router,'GET','/auth/search-entry?q=gomoku&return=https%3A%2F%2Fevil.example');
 assert.equal(answer.handled,true);
 assert.equal(answer.status,302);
 assert.equal(answer.headers['Cache-Control'],'no-store');
 const location=new URL(answer.headers.Location);
 assert.equal(location.origin,'https://gracz.pl');
 assert.equal(location.pathname,'/szukaj/');
 assert.equal(location.searchParams.get('q'),'gomoku');
 assert.equal(location.searchParams.has('return'),false);
 assert.equal(location.hash,'#gate=guest');
});

test('valid host-only session yields one anonymous, single-use search ticket',async()=>{
 const router=createSearchAccessRouter({isAuthenticated:async request=>request.headers.cookie==='test-valid-cookie'});
 const entry=await call(router,'GET','/auth/search-entry',{cookie:'test-valid-cookie'});
 const redirect=new URL(entry.headers.Location);
 const ticket=new URLSearchParams(redirect.hash.substring(1)).get('gate');
 assert.match(ticket,/^[a-f0-9]{48}$/);
 assert.equal(entry.headers['Referrer-Policy'],'no-referrer');
 const headers={origin:'https://gracz.pl'};
 const allowed=await call(router,'POST','/auth/search-ticket',{...headers,body:{ticket}});
 assert.equal(allowed.status,200);
 assert.deepEqual(JSON.parse(allowed.body),{ok:true,allowed:true});
 assert.equal(allowed.headers['Access-Control-Allow-Origin'],'https://gracz.pl');
 const replay=await call(router,'POST','/auth/search-ticket',{...headers,body:{ticket}});
 assert.deepEqual(JSON.parse(replay.body),{ok:true,allowed:false});
});

test('invalid origin, fake ticket and expired session are not accepted',async()=>{
 const router=createSearchAccessRouter({isAuthenticated:async()=>{throw Error('AUTH_OFF');}});
 const entry=await call(router,'GET','/auth/search-entry');
 assert.equal(new URL(entry.headers.Location).hash,'#gate=unavailable');
 const unauthorized=await call(router,'POST','/auth/search-ticket',{
  origin:'https://other.example',body:{ticket:'a'.repeat(48)}
 });
 assert.equal(unauthorized.status,403);
 const fake=await call(router,'POST','/auth/search-ticket',{
  origin:'https://gracz.pl',body:{ticket:'a'.repeat(48)}
 });
 assert.deepEqual(JSON.parse(fake.body),{ok:true,allowed:false});
 const preflight=await call(router,'OPTIONS','/auth/search-ticket',{origin:'https://gracz.pl'});
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers['Access-Control-Allow-Methods'],'POST, OPTIONS');
});

test('only search routes are handled',async()=>{
 const router=createSearchAccessRouter({isAuthenticated:async()=>true});
 const ignored=await call(router,'GET','/auth/session');
 assert.equal(ignored.handled,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {fixture,host,challenge,tokenA,tokenB} from '../test-support/game-matches-fixture.mjs';

test('unfinished POST bodies cannot occupy every gameplay/database slot',async()=>{
 const f=fixture();await f.call(tokenA,'GET','/auth/match?id='+challenge);
 const streams=[],pending=[],responses=[];
 try{
  for(let i=0;i<32;i++){
   const req=new PassThrough();req.method='POST';
   req.headers={cookie:'__Host-gracz_session='+tokenA,origin:host};
   const response={writeHead(status){this.status=status;},end(){}};
   streams.push(req);responses.push(response);
   pending.push(f.router.handle(req,response,new URL('/auth/match',host)));
  }
  for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));
  const other=await f.call(tokenB,'GET','/auth/match?id='+challenge);
  assert.equal(other.status,200,'slow request bodies must leave gameplay reads available');
  assert.equal(responses.filter(x=>x.status===429).length,30,'two incomplete bodies maximum per session');
 }finally{
  for(const stream of streams)stream.end('{}');await Promise.all(pending);
 }
});

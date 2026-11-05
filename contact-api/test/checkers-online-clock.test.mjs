import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
import {initialGame} from '../auth/game-engine.mjs';

const matchId='11111111-1111-4111-8111-111111111111';
const alice='22222222-2222-4222-8222-222222222222';
const bob='33333333-3333-4333-8333-333333333333';
const outsider='44444444-4444-4444-8444-444444444444';
const cookies=[['a'.repeat(64),alice],['b'.repeat(64),bob],['c'.repeat(64),outsider]];
const digest=value=>createHash('sha256').update(value).digest('hex');
function mockDatabase(){
 let state=null,version=0,blocked=false;
 const messages=[];
 return {enabled:true,
 async query(sql,params=[]){
  if(/^(CREATE |ALTER TABLE )/.test(sql))return {rows:[],rowCount:0};
  if(sql.includes('FROM gracz_public_identity.sessions s')){
   const hash=Buffer.from(params[0]).toString('hex'),found=cookies.find(([key])=>digest(key)===hash);
   return {rows:found?[{id:found[1]}]:[],rowCount:found?1:0};
  }
  if(sql.includes('SELECT c.game,c.time_limit_minutes')){
   const valid=params[0]===matchId&&[alice,bob].includes(params[1]);
   return {rows:valid?[{game:'warcaby',time_limit_minutes:7,increment_seconds:2}]:[]};
  }
  if(sql.includes('INSERT INTO gracz_public_identity.game_matches')){
   if(!state)state=JSON.parse(params[1]);
   return {rows:[],rowCount:0};
  }
  if(sql.includes('SELECT m.state,m.version,c.game,')){
   const valid=params[0]===matchId&&[alice,bob].includes(params[1]);
   return {rows:valid?[{state,version,game:'warcaby',sender_id:alice,recipient_id:bob,sender_nick:'Alice',recipient_nick:'Bob',playable:!blocked}]:[]};
  }
  if(sql.includes('UPDATE gracz_public_identity.game_matches m')){
   const [raw,id,expected,actor]=params;
   if(id!==matchId||expected!==version||![alice,bob].includes(actor)||blocked)return {rows:[],rowCount:0};
   state=JSON.parse(raw);version++;return {rows:[{version}],rowCount:1};
  }
  if(sql.includes('INSERT INTO gracz_public_identity.game_match_messages')){
   if(blocked)return {rows:[],rowCount:0};
   const [id,actor,body,room]=params;
   if(room!==matchId||![alice,bob].includes(actor))return {rows:[],rowCount:0};
   const created_at='2026-11-04T17:00:00.000Z';
   messages.push({id,sender_id:actor,body,created_at});
   return {rows:[{id,created_at}],rowCount:1};
  }
  if(sql.includes('FROM gracz_public_identity.game_match_messages')&&sql.includes('ORDER BY created_at DESC')){
   return {rows:messages.map(m=>({...m})),rowCount:messages.length};
  }
  throw new Error('Unexpected query: '+sql.slice(0,160));
 },
 snapshot:()=>({state,version}),setState:value=>{state=value;version=0},setBlocked:value=>{blocked=value}
 };
}
async function request(router,session,method,path,body){
 const raw=body===undefined?'':JSON.stringify(body);
 const req=Readable.from(raw?[raw]:[]);
 req.method=method;
 req.headers={cookie:session?'__Host-gracz_session='+session:'',origin:'https://gracz-contact-api.onrender.com','sec-fetch-site':'same-origin'};
 const res={status:0,body:'',writeHead(code){this.status=code},end(value){this.body=String(value||'')}};
 assert.equal(await router.handle(req,res,new URL(path,'https://gracz-contact-api.onrender.com')),true);
 return {status:res.status,body:JSON.parse(res.body)};
}

test('timed checkers: accepted friends start authoritative clocks and increments only after completed turns',async()=>{
 const db=mockDatabase();
 const router=createPublicIdentityRouter({database:db,emailFrom:'test@example.invalid',resendKey:'test-key'});
 const path='/auth/match?id='+matchId;
 const firstRead=await request(router,'a'.repeat(64),'GET',path);
 assert.equal(firstRead.status,200);
 assert.deepEqual(firstRead.body.match.state.clock.ready,[true,false]);
 const secondRead=await request(router,'b'.repeat(64),'GET',path);
 assert.equal(secondRead.status,200);
 assert.deepEqual(secondRead.body.match.state.clock.ready,[true,true]);
 assert.equal(secondRead.body.match.state.clock.limitMs,420000);
 assert.equal(secondRead.body.match.state.clock.incrementMs,2000);
 const version=secondRead.body.match.version;
 assert.equal((await request(router,'b'.repeat(64),'POST','/auth/match',{id:matchId,version,move:{from:17,to:24}})).status,409);
 const played=await request(router,'a'.repeat(64),'POST','/auth/match',{id:matchId,version,move:{from:17,to:24}});
 assert.equal(played.status,200);
 assert.equal(played.body.match.state.turn,2);
 assert.ok(played.body.match.state.clock.remaining[0]>=420000);
 assert.ok(played.body.match.state.clock.remaining[0]<=422000);
 const replay=await request(router,'a'.repeat(64),'POST','/auth/match',{id:matchId,version,move:{from:17,to:24}});
 assert.equal(replay.status,409);
});

test('timed checkers: forced multiple capture consumes time and grants one increment at the end',async()=>{
 const db=mockDatabase(),router=createPublicIdentityRouter({database:db,emailFrom:'test@example.invalid',resendKey:'test-key'});
 const state=initialGame('warcaby');
 state.board=Array(64).fill(0);
 for(const [square,piece] of [[40,1],[49,2],[44,2],[55,2]])state.board[square]=piece;
 state.clock={limitMs:420000,incrementMs:2000,remaining:[420000,420000],
  ready:[true,true],since:new Date().toISOString()};
 state.history=[];
 db.setState(state);
 const first=await request(router,'a'.repeat(64),'POST','/auth/match',
  {id:matchId,version:0,move:{from:40,to:58}});
 assert.equal(first.status,200);
 assert.equal(first.body.match.state.turn,1);
 assert.equal(first.body.match.state.forced,58);
 assert.ok(first.body.match.state.clock.remaining[0]<=420000,'no increment during ongoing capture');
 const second=await request(router,'a'.repeat(64),'POST','/auth/match',
  {id:matchId,version:first.body.match.version,move:{from:58,to:37}});
 assert.equal(second.status,200);
 assert.equal(second.body.match.state.turn,2);
 assert.equal(second.body.match.state.forced,null);
 assert.ok(second.body.match.state.clock.remaining[0]>420000,'one increment on full turn completion');
 assert.ok(second.body.match.state.clock.remaining[0]<=422000);
});

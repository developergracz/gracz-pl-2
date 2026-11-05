import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {createPublicIdentityRouter} from '../auth/public-identity.mjs';
const host='https://gracz-contact-api.onrender.com';
const idA='00000000-0000-4000-8000-000000000001',idB='00000000-0000-4000-8000-000000000002';
const idC='00000000-0000-4000-8000-000000000003';
const challenge='b92e5507-609f-42f6-941f-12e8438aace3';
const tokenA='a'.repeat(64),tokenB='b'.repeat(64),tokenC='c'.repeat(64);
const digest=t=>createHash('sha256').update(t).digest('hex');

function fixture({timeLimitMinutes=0,incrementSeconds=0,onGomokuChange,game='gomoku'}={}){
 const matches=new Map(),queries=[],messages=[];
 let blocked=false,accepted=true,revoked=false;
 const db={enabled:true,async query(sql,p=[]){
  queries.push({sql,p});
  if(sql.startsWith('CREATE ')||sql.startsWith('ALTER TABLE '))return {rows:[],rowCount:0};
  if(sql.includes('SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint'))return {rows:[{definition:"CHECK ((game = ANY (ARRAY['warcaby', 'gomoku', 'szachy'])))"}],rowCount:1};
  if(sql.includes('INSERT INTO gracz_public_identity.online_presence')){
   const key=Buffer.from(p[0]||[]).toString('hex');
   const id=key===digest(tokenA)?idA:key===digest(tokenB)?idB:null;
   return {rows:id?[{id}]:[],rowCount:id?1:0};
  }
  if(sql.includes('FROM gracz_public_identity.friend_connections c')&&
     sql.includes('gracz_public_identity.online_presence active'))
   return {rows:[{nickname:'GraczB',online:true},{nickname:'GraczC',online:false}],rowCount:2};
  if(sql.includes('SELECT a.nickname FROM gracz_public_identity.sessions s')){
   const key=Buffer.from(p[0]||[]).toString('hex');
   const nickname=!revoked&&(key===digest(tokenA)?'GraczA':key===digest(tokenB)?'GraczB':key===digest(tokenC)?'GraczC':null);
   return {rows:nickname?[{nickname}]:[]};
  }
  if(sql.includes('SELECT a.id FROM gracz_public_identity.sessions s')){
   if(revoked)return {rows:[],rowCount:0};
   const key=Buffer.from(p[0]||[]).toString('hex');
   const id=key===digest(tokenA)?idA:key===digest(tokenB)?idB:key===digest(tokenC)?idC:null;
   return {rows:id?[{id}]:[],rowCount:id?1:0};
  }
  if(sql.includes('SELECT c.game,c.time_limit_minutes,c.increment_seconds FROM gracz_public_identity.game_challenges c')){
   return {rows:accepted&&p[0]===challenge&&[idA,idB].includes(p[1])?
    [{game,time_limit_minutes:timeLimitMinutes,increment_seconds:incrementSeconds}]:[]};
  }
  if(sql.includes('INSERT INTO gracz_public_identity.game_matches')){
   if(!matches.has(p[0]))matches.set(p[0],{state:JSON.parse(p[1]),version:0});
   return {rows:[],rowCount:1};
  }
  if(sql.includes('SELECT m.state,m.version,c.game')){
   const m=matches.get(p[0]);
   return {rows:m&&[idA,idB].includes(p[1])?[{
    state:m.state,version:m.version,game,sender_id:idA,recipient_id:idB,
    sender_nick:'GraczA',recipient_nick:'GraczB',playable:!blocked
   }]:[]};
  }
  if(sql.includes('SELECT id,sender_id,body,created_at FROM (')){
   const rows=messages.filter(x=>x.matchId===p[0]).map(x=>({
    id:x.id,sender_id:x.sender_id,body:x.body,created_at:x.created_at
   }));
   return {rows,rowCount:rows.length};
  }
  if(sql.includes('INSERT INTO gracz_public_identity.game_match_messages')){
   if(blocked)return {rows:[],rowCount:0};
   const [id,sender_id,body,matchId]=p;
   messages.push({id,sender_id,body,matchId,created_at:'2026-11-01T20:00:00Z'});
   return {rows:[{id,created_at:'2026-11-01T20:00:00Z'}],rowCount:1};
  }
  if(sql.includes('UPDATE gracz_public_identity.game_matches m')){
   const m=matches.get(p[1]);
   if(!m||m.version!==p[2]||blocked)return {rows:[],rowCount:0};
   m.state=JSON.parse(p[0]);m.version++;
   return {rows:[{version:m.version}],rowCount:1};
  }
  throw Error('Unexpected query: '+sql.slice(0,100));
 }};
 const router=createPublicIdentityRouter({database:db,onGomokuChange,resendKey:'fixture',emailFrom:'no-reply@example.test'});
 async function call(token,method,path,body,origin=host){
  const raw=body===undefined?'':JSON.stringify(body);
  const req=Readable.from(raw?[raw]:[]);
  req.url=path;req.method=method;req.socket={remoteAddress:'127.0.0.1'};
  req.headers={};
  if(token)req.headers.cookie='__Host-gracz_session='+token;
  if(method==='POST'){req.headers.origin=origin;req.headers['sec-fetch-site']='same-origin';}
  const res={status:0,body:'',writeHead(status){this.status=status;},end(v){this.body=String(v||'');}};
  assert.equal(await router.handle(req,res,new URL(path,host)),true);
  return {status:res.status,body:JSON.parse(res.body)};
 }
 return {router,call,queries,revoke:()=>{revoked=true;},setBlocked:v=>{blocked=v;},setAccepted:v=>{accepted=v;},
  clockExpiresIn:ms=>{const m=matches.get(challenge);if(m?.state.clock){
   m.state.clock.since=new Date(Date.now()+ms-m.state.clock.remaining[m.state.turn-1]).toISOString();
  }},
  shiftClockSince:ms=>{const m=matches.get(challenge);if(m?.state.clock){
   const t=Date.parse(m.state.clock.since);m.state.clock.since=new Date(t-ms).toISOString();
  }},
  expireUndoBy:ms=>{const m=matches.get(challenge);if(m?.state.undo)
   m.state.undo.createdAt=new Date(Date.now()-ms).toISOString();}};
}

export {fixture,host,idA,idB,idC,challenge,tokenA,tokenB,tokenC};

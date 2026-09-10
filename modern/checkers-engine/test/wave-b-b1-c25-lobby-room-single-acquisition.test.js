import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AuthService } from "../src/auth.js";
import { LobbyService } from "../src/lobby.js";
import { createPlatformLobbyHttpHandler } from "../src/platform-lobby-http.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
const authSecret="b1-c25-focused-auth-secret-with-more-than-32-characters";

function prefixFor(label){return `c25_${label}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}

async function cleanup(pool,prefix){
  await pool.query(`DELETE FROM gracz_lobby_invitations WHERE invitation_id LIKE $1 OR room_id LIKE $1 OR from_id LIKE $1 OR to_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_rooms WHERE room_id LIKE $1 OR owner_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_presence WHERE user_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_game_sessions WHERE game_id LIKE $1`,[`game-${prefix}%`]).catch(()=>{});
}

async function insertPresence(pool,{userId,displayName="Old name",age="10 minutes"}){
  await pool.query(`INSERT INTO gracz_lobby_presence(user_id,display_name,seen_at) VALUES($1,$2,NOW()-$3::interval) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,seen_at=EXCLUDED.seen_at`,[userId,displayName,age]);
}

async function insertRoom(pool,{roomId,ownerId,ownerName="Owner",maxPlayers=3,seats,status="waiting",gameType="thousand",gameLabel="Tysiąc"}){
  const resolvedSeats=seats??Array.from({length:maxPlayers},(_,index)=>index===0?{id:ownerId,name:ownerName}:null);
  await pool.query(`INSERT INTO gracz_lobby_rooms(room_id,room_name,game_type,game_label,max_players,status,seats,game_id,owner_id,owner_name) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,NULL,$8,$9)`,[roomId,roomId,gameType,gameLabel,maxPlayers,status,JSON.stringify(resolvedSeats),ownerId,ownerName]);
}

async function insertInvitation(pool,{id,roomId,fromId,toId}){
  await pool.query(`INSERT INTO gracz_lobby_invitations(invitation_id,status,room_id,room_name,game_type,game_label,from_id,from_name,to_id) VALUES($1,'pending',$2,$2,'thousand','Tysiąc',$3,'Owner',$4)`,[id,roomId,fromId,toId]);
}

function installAcquisitionCounter(pool){
  const original=pool.connect.bind(pool);
  let acquisitions=0,releases=0;
  pool.connect=async(...args)=>{
    acquisitions+=1;
    const client=await original(...args);
    const release=client.release.bind(client);
    let counted=false;
    client.release=(...releaseArgs)=>{
      if(!counted){counted=true;releases+=1}
      return release(...releaseArgs);
    };
    return client;
  };
  return{
    snapshot:()=>({acquisitions,releases}),
    restore(){pool.connect=original},
  };
}

async function withRoute(label,run){
  if(!databaseUrl)return;
  const prefix=prefixFor(label);
  const store=new PostgresSessionStore(databaseUrl);
  let server;
  try{
    await store.ready;
    await cleanup(store.pool,prefix);
    let id=0;
    const lobby=new LobbyService({sessionStore:store,pool:store.pool,idGenerator:()=>`${prefix}_room_${++id}`});
    await lobby.ready;
    const auth=new AuthService({secret:authSecret});
    const handler=createPlatformLobbyHttpHandler({lobby,auth});
    server=createServer(async(request,response)=>{
      try{
        const handled=await handler(request,response);
        if(!handled&&!response.writableEnded){response.writeHead(404);response.end()}
      }catch(error){
        if(!response.writableEnded){response.writeHead(500,{"content-type":"application/json"});response.end(JSON.stringify({error:{code:error.code||"TEST_ERROR",message:error.message}}))}
      }
    });
    await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
    const baseUrl=`http://127.0.0.1:${server.address().port}`;
    const postRoom=async({ownerId,displayName="Owner",body={}})=>{
      const token=auth.issue({userId:ownerId,displayName});
      const response=await fetch(`${baseUrl}/lobby/rooms`,{
        method:"POST",
        headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
        body:JSON.stringify(body),
      });
      const payload=await response.json();
      return{response,payload};
    };
    await run({prefix,store,lobby,postRoom});
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await cleanup(store.pool,prefix);
    await store.close();
  }
}

function assertPoolReleased(pool){
  assert.equal(pool.waitingCount,0,"C25 must leave no client waiting after focused request completion");
  assert.equal(pool.idleCount,pool.totalCount,"all shared pool clients must be idle after request completion");
}

test("B1-C25 successful POST /lobby/rooms uses exactly one real shared-pool acquisition, persists presence, creates room and performs stale cleanup",{skip:!databaseUrl},async()=>withRoute("success",async({prefix,store,postRoom})=>{
  const owner=`${prefix}_owner`,stale=`${prefix}_stale`;
  await insertPresence(store.pool,{userId:owner,displayName:"Old Owner",age:"2 minutes"});
  await insertPresence(store.pool,{userId:stale,displayName:"Stale",age:"10 minutes"});
  const counter=installAcquisitionCounter(store.pool);
  const{response,payload}=await postRoom({ownerId:owner,displayName:"Fresh Owner",body:{roomName:"C25 room",gameType:"thousand",maxPlayers:3}});
  const measured=counter.snapshot();counter.restore();
  assert.equal(response.status,201);
  assert.equal(measured.acquisitions,1,"successful route must perform one Pool.connect acquisition total");
  assert.equal(measured.releases,1,"the one checked-out client must be released exactly once");
  assert.equal(payload.gameType,"thousand");assert.equal(payload.maxPlayers,3);assert.equal(payload.status,"waiting");
  const presence=(await store.pool.query(`SELECT display_name,seen_at FROM gracz_lobby_presence WHERE user_id=$1`,[owner])).rows[0];
  assert.equal(presence.display_name,"Fresh Owner");
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_presence WHERE user_id=$1`,[stale])).rows[0].count),0,"legacy 5-minute stale cleanup remains active on room POST");
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_rooms WHERE room_id=$1 AND owner_id=$2`,[payload.roomId,owner])).rows[0].count),1);
  assertPoolReleased(store.pool);
}));

test("B1-C25 room rejection rolls back only room mutation while already committed presence survives and client is released",{skip:!databaseUrl},async()=>withRoute("rollback",async({prefix,store,postRoom})=>{
  const owner=`${prefix}_owner`,other=`${prefix}_other`,oldRoom=`${prefix}_old`;
  await insertPresence(store.pool,{userId:owner,displayName:"Old",age:"2 minutes"});
  await insertRoom(store.pool,{roomId:oldRoom,ownerId:owner,maxPlayers:2,seats:[{id:owner,name:"Old"},{id:other,name:"Other"}]});
  const counter=installAcquisitionCounter(store.pool);
  const{response,payload}=await postRoom({ownerId:owner,displayName:"Committed Presence",body:{roomName:"Rejected variant",gameType:"thousand",maxPlayers:3}});
  const measured=counter.snapshot();counter.restore();
  assert.equal(response.status,409);assert.equal(payload.error.code,"ROOM_VARIANT_LOCKED");
  assert.equal(measured.acquisitions,1);assert.equal(measured.releases,1);
  const presence=(await store.pool.query(`SELECT display_name,seen_at>NOW()-INTERVAL '45 seconds' AS fresh FROM gracz_lobby_presence WHERE user_id=$1`,[owner])).rows[0];
  assert.deepEqual({displayName:presence.display_name,fresh:presence.fresh},{displayName:"Committed Presence",fresh:true},"presence must remain committed outside room rollback domain");
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_rooms WHERE room_id=$1`,[oldRoom])).rows[0].count),1,"rejected variant transaction must not delete existing room");
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_rooms WHERE owner_id=$1 AND game_type='thousand'`,[owner])).rows[0].count),1,"rejection must not create a duplicate room");
  assertPoolReleased(store.pool);
}));

test("B1-C25 exact waiting room remains idempotent, refreshes presence and uses one acquisition",{skip:!databaseUrl},async()=>withRoute("exact",async({prefix,store,postRoom})=>{
  const owner=`${prefix}_owner`,oldRoom=`${prefix}_exact`;
  await insertPresence(store.pool,{userId:owner,displayName:"Old",age:"2 minutes"});
  await insertRoom(store.pool,{roomId:oldRoom,ownerId:owner,maxPlayers:3});
  const counter=installAcquisitionCounter(store.pool);
  const{response,payload}=await postRoom({ownerId:owner,displayName:"Exact Owner",body:{roomName:"Ignored because exact exists",gameType:"thousand",maxPlayers:3}});
  const measured=counter.snapshot();counter.restore();
  assert.equal(response.status,201);assert.equal(payload.roomId,oldRoom);
  assert.deepEqual(measured,{acquisitions:1,releases:1});
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_rooms WHERE owner_id=$1 AND game_type='thousand' AND status='waiting'`,[owner])).rows[0].count),1);
  assert.equal((await store.pool.query(`SELECT display_name FROM gracz_lobby_presence WHERE user_id=$1`,[owner])).rows[0].display_name,"Exact Owner");
  assertPoolReleased(store.pool);
}));

test("B1-C25 eligible room variant replacement cleans old invitations, preserves uniqueness and uses one acquisition",{skip:!databaseUrl},async()=>withRoute("replace",async({prefix,store,postRoom})=>{
  const owner=`${prefix}_owner`,target=`${prefix}_target`,oldRoom=`${prefix}_old`,inv=`${prefix}_inv`;
  await insertRoom(store.pool,{roomId:oldRoom,ownerId:owner,maxPlayers:2,seats:[{id:owner,name:"Owner"},null]});
  await insertInvitation(store.pool,{id:inv,roomId:oldRoom,fromId:owner,toId:target});
  const counter=installAcquisitionCounter(store.pool);
  const{response,payload}=await postRoom({ownerId:owner,displayName:"Replacement Owner",body:{roomName:"New variant",gameType:"thousand",maxPlayers:3}});
  const measured=counter.snapshot();counter.restore();
  assert.equal(response.status,201);assert.notEqual(payload.roomId,oldRoom);assert.equal(payload.maxPlayers,3);
  assert.deepEqual(measured,{acquisitions:1,releases:1});
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_rooms WHERE room_id=$1`,[oldRoom])).rows[0].count),0);
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_invitations WHERE invitation_id=$1`,[inv])).rows[0].count),0);
  const waiting=(await store.pool.query(`SELECT room_id,max_players FROM gracz_lobby_rooms WHERE owner_id=$1 AND game_type='thousand' AND status='waiting'`,[owner])).rows;
  assert.equal(waiting.length,1);assert.equal(waiting[0].room_id,payload.roomId);assert.equal(Number(waiting[0].max_players),3);
  assertPoolReleased(store.pool);
}));

test("B1-C25 ROOM_VARIANT_LOCKED preserves old room and presence with one acquisition",{skip:!databaseUrl},async()=>withRoute("locked",async({prefix,store,postRoom})=>{
  const owner=`${prefix}_owner`,other=`${prefix}_other`,oldRoom=`${prefix}_locked`;
  await insertRoom(store.pool,{roomId:oldRoom,ownerId:owner,maxPlayers:2,seats:[{id:owner,name:"Owner"},{id:other,name:"Other"}]});
  const counter=installAcquisitionCounter(store.pool);
  const{response,payload}=await postRoom({ownerId:owner,displayName:"Locked Owner",body:{roomName:"Blocked",gameType:"thousand",maxPlayers:4}});
  const measured=counter.snapshot();counter.restore();
  assert.equal(response.status,409);assert.equal(payload.error.code,"ROOM_VARIANT_LOCKED");assert.deepEqual(measured,{acquisitions:1,releases:1});
  const rows=(await store.pool.query(`SELECT room_id,max_players,seats FROM gracz_lobby_rooms WHERE owner_id=$1 AND game_type='thousand'`,[owner])).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].room_id,oldRoom);assert.equal(Number(rows[0].max_players),2);assert.equal(rows[0].seats.length,2);
  assert.equal((await store.pool.query(`SELECT display_name FROM gracz_lobby_presence WHERE user_id=$1`,[owner])).rows[0].display_name,"Locked Owner");
  assertPoolReleased(store.pool);
}));

test("B1-C25 concurrent same-owner room POSTs retain advisory-lock idempotency with one acquisition each",{skip:!databaseUrl},async()=>withRoute("same_owner",async({prefix,store,postRoom})=>{
  const owner=`${prefix}_owner`;
  const counter=installAcquisitionCounter(store.pool);
  const results=await Promise.all(Array.from({length:8},()=>postRoom({ownerId:owner,displayName:"Concurrent Owner",body:{roomName:"Concurrent",gameType:"thousand",maxPlayers:3}})));
  const measured=counter.snapshot();counter.restore();
  assert.ok(results.every(({response})=>response.status===201));
  const ids=new Set(results.map(({payload})=>payload.roomId));assert.equal(ids.size,1,"same owner/game variant must converge on one waiting room");
  assert.equal(measured.acquisitions,8,"each concurrent successful POST must use exactly one acquisition");assert.equal(measured.releases,8);
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_rooms WHERE owner_id=$1 AND game_type='thousand' AND status='waiting'`,[owner])).rows[0].count),1);
  assertPoolReleased(store.pool);
}));

test("B1-C25 concurrent different owners create independently without unintended global serialization key",{skip:!databaseUrl},async()=>withRoute("different_owner",async({prefix,store,postRoom})=>{
  const owners=Array.from({length:6},(_,index)=>`${prefix}_owner_${index}`);
  const counter=installAcquisitionCounter(store.pool);
  const results=await Promise.all(owners.map((ownerId,index)=>postRoom({ownerId,displayName:`Owner ${index}`,body:{roomName:`Room ${index}`,gameType:"thousand",maxPlayers:3}})));
  const measured=counter.snapshot();counter.restore();
  assert.ok(results.every(({response})=>response.status===201));assert.equal(new Set(results.map(({payload})=>payload.roomId)).size,owners.length);
  assert.equal(measured.acquisitions,owners.length);assert.equal(measured.releases,owners.length);
  assert.equal(Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_rooms WHERE owner_id=ANY($1::text[]) AND game_type='thousand' AND status='waiting'`,[owners])).rows[0].count),owners.length);
  assertPoolReleased(store.pool);
}));

test("B1-C25 source guardrail keeps body parsing before checkout, presence outside transaction and owner-scoped advisory locking",async()=>{
  const http=await readFile(new URL("../src/platform-lobby-http.js",import.meta.url),"utf8");
  const lobby=await readFile(new URL("../src/lobby.js",import.meta.url),"utf8");
  const postStart=http.indexOf("if(request.method==='POST')",http.indexOf("if(url.pathname==='/lobby/rooms')"));
  const readBody=http.indexOf("const body=await readJson(request);",postStart);
  const createCall=http.indexOf("await lobby.createRoomForActiveUser",postStart);
  assert.ok(postStart>=0&&readBody>postStart&&createCall>readBody,"HTTP body must be fully parsed before the Lobby method can acquire a DB client");
  const combinedStart=lobby.indexOf("async #createRoomForActiveUserDatabase(prepared)");
  const combinedEnd=lobby.indexOf("async #createRoomDatabase(prepared)",combinedStart);
  const combined=lobby.slice(combinedStart,combinedEnd);
  assert.ok(combined.indexOf("await this.#touchUserDatabase")<combined.indexOf("#createRoomDatabaseWithClient"));
  assert.equal((combined.match(/this\.pool\.connect\(/g)||[]).length,1,"combined POST path owns one explicit shared-pool checkout");
  assert.match(combined,/finally\{client\.release\(\)\}/);
  assert.doesNotMatch(combined,/\bfetch\s*\(|https?:\/\//,"no external network operation is introduced while the client is held");
  const roomTxStart=lobby.indexOf("async #createRoomDatabaseWithClient");
  const roomTxEnd=lobby.indexOf("createInvitation(input)",roomTxStart);
  const roomTx=lobby.slice(roomTxStart,roomTxEnd);
  assert.match(roomTx,/await client\.query\("BEGIN"\)/);assert.match(roomTx,/await client\.query\("COMMIT"\)/);assert.match(roomTx,/await client\.query\("ROLLBACK"\)/);
  assert.match(roomTx,/lobby-owner:\$\{ownerId\}:\$\{canonicalGameType\}/,"advisory lock remains scoped by owner and game type");
  assert.doesNotMatch(roomTx,/gracz_lobby_presence/,"presence statements must remain outside the room rollback domain");
});

import assert from "node:assert/strict";
import test from "node:test";

import { LobbyService } from "../src/lobby.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;

function uniquePrefix(label){return `asf02_${label}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function ids(prefix){let n=0;return()=>`${prefix}_${++n}`}
async function cleanup(pool,prefix){
  await pool.query(`DELETE FROM gracz_lobby_invitations WHERE room_id LIKE $1 OR from_id LIKE $1 OR to_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_rooms WHERE room_id LIKE $1 OR owner_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_presence WHERE user_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_game_sessions WHERE game_id LIKE $1`,[`game-${prefix}%`]).catch(()=>{});
}
function makeLobby(store,{prefix,thousandService=null}={}){
  return new LobbyService({sessionStore:store,pool:store.pool,thousandService,idGenerator:ids(prefix)});
}

async function withStore(label,run){
  const prefix=uniquePrefix(label);const store=new PostgresSessionStore(databaseUrl);
  try{await store.ready;await cleanup(store.pool,prefix);await run({prefix,store})}
  finally{await cleanup(store.pool,prefix);await store.close()}
}

test("AS-CAN-F02 PostgreSQL: room created on Node A is visible on Node B",{skip:!databaseUrl},async()=>withStore("visible",async({prefix,store})=>{
  const a=makeLobby(store,{prefix:`${prefix}_a`}),b=makeLobby(store,{prefix:`${prefix}_b`});await Promise.all([a.ready,b.ready]);
  const owner=`${prefix}_owner`;const room=await a.createRoom({ownerId:owner,ownerName:"Alicja",roomName:"Shared room",gameType:"thousand",maxPlayers:3});
  const rooms=await b.listRooms();const observed=rooms.find(item=>item.roomId===room.roomId);
  assert.ok(observed);assert.equal(observed.roomName,"Shared room");assert.equal(observed.filledSeats,1);
}));

test("AS-CAN-F02 PostgreSQL: invitation created on Node A can be accepted on Node B",{skip:!databaseUrl},async()=>withStore("invite",async({prefix,store})=>{
  const a=makeLobby(store,{prefix:`${prefix}_a`}),b=makeLobby(store,{prefix:`${prefix}_b`});await Promise.all([a.ready,b.ready]);
  const owner=`${prefix}_owner`,bob=`${prefix}_bob`;
  await Promise.all([a.touchUser({userId:owner,displayName:"Alicja"}),b.touchUser({userId:bob,displayName:"Robert"})]);
  const room=await a.createRoom({ownerId:owner,ownerName:"Alicja",roomName:"Invite room",gameType:"thousand",maxPlayers:3});
  const invitation=await a.createInvitation({fromId:owner,fromName:"Alicja",toId:bob,roomId:room.roomId});
  assert.ok((await b.listInvitations(bob)).some(item=>item.invitationId===invitation.invitationId));
  const accepted=await b.respondInvitation({invitationId:invitation.invitationId,userId:bob,userName:"Robert",accept:true});
  assert.equal(accepted.accepted,true);assert.equal(accepted.room.filledSeats,2);assert.equal(accepted.room.status,"waiting");
  assert.equal((await a.listInvitations(bob)).length,0);
}));

test("AS-CAN-F02 PostgreSQL: concurrent final-seat join across nodes has one winner",{skip:!databaseUrl},async()=>withStore("finalseat",async({prefix,store})=>{
  const starts=[];const thousandService={async createGame(input){starts.push(structuredClone(input));return{gameId:input.gameId,revision:1}}};
  const a=makeLobby(store,{prefix:`${prefix}_a`,thousandService}),b=makeLobby(store,{prefix:`${prefix}_b`,thousandService});await Promise.all([a.ready,b.ready]);
  const room=await a.createRoom({ownerId:`${prefix}_owner`,ownerName:"Alicja",roomName:"Race",gameType:"thousand",maxPlayers:3});
  await a.joinRoom({roomId:room.roomId,playerId:`${prefix}_p2`,playerName:"P2"});
  const outcomes=await Promise.allSettled([
    a.joinRoom({roomId:room.roomId,playerId:`${prefix}_p3`,playerName:"P3"}),
    b.joinRoom({roomId:room.roomId,playerId:`${prefix}_p4`,playerName:"P4"}),
  ]);
  assert.equal(outcomes.filter(item=>item.status==="fulfilled").length,1);
  assert.equal(outcomes.filter(item=>item.status==="rejected").length,1);
  assert.match(outcomes.find(item=>item.status==="rejected").reason?.code||"",/ROOM_NOT_JOINABLE|ROOM_FULL/);
  const current=(await b.listRooms()).find(item=>item.roomId===room.roomId);
  assert.equal(current.status,"playing");assert.equal(current.filledSeats,3);assert.equal(starts.length,1);
}));

test("AS-CAN-F02 PostgreSQL: duplicate same-user join across nodes cannot consume two seats",{skip:!databaseUrl},async()=>withStore("duplicate",async({prefix,store})=>{
  const a=makeLobby(store,{prefix:`${prefix}_a`}),b=makeLobby(store,{prefix:`${prefix}_b`});await Promise.all([a.ready,b.ready]);
  const room=await a.createRoom({ownerId:`${prefix}_owner`,ownerName:"Alicja",roomName:"Duplicate",gameType:"thousand",maxPlayers:4});
  const playerId=`${prefix}_same`;
  const outcomes=await Promise.allSettled([
    a.joinRoom({roomId:room.roomId,playerId,playerName:"Same"}),
    b.joinRoom({roomId:room.roomId,playerId,playerName:"Same"}),
  ]);
  assert.equal(outcomes.filter(item=>item.status==="fulfilled").length,1);
  assert.equal(outcomes.filter(item=>item.status==="rejected").length,1);
  assert.equal(outcomes.find(item=>item.status==="rejected").reason?.code,"DUPLICATE_PLAYER");
  const current=(await a.listRooms()).find(item=>item.roomId===room.roomId);
  assert.equal(current.filledSeats,2);assert.equal(current.seats.filter(seat=>seat?.id===playerId).length,1);
}));

test("AS-CAN-F02 PostgreSQL: reconstructed service sees authoritative waiting room",{skip:!databaseUrl},async()=>withStore("restart",async({prefix,store})=>{
  const a=makeLobby(store,{prefix:`${prefix}_a`});await a.ready;
  const room=await a.createRoom({ownerId:`${prefix}_owner`,ownerName:"Alicja",roomName:"Persistent",gameType:"thousand",maxPlayers:4});
  const reconstructed=makeLobby(store,{prefix:`${prefix}_restart`});await reconstructed.ready;
  const observed=(await reconstructed.listRooms()).find(item=>item.roomId===room.roomId);
  assert.ok(observed);assert.equal(observed.status,"waiting");assert.equal(observed.filledSeats,1);
}));

test("AS-CAN-F02 PostgreSQL: stale presence expires predictably across nodes",{skip:!databaseUrl},async()=>withStore("presence",async({prefix,store})=>{
  const a=makeLobby(store,{prefix:`${prefix}_a`}),b=makeLobby(store,{prefix:`${prefix}_b`});await Promise.all([a.ready,b.ready]);
  const userId=`${prefix}_user`;await a.touchUser({userId,displayName:"Alicja"});
  assert.ok((await b.listPlayers()).some(player=>player.userId===userId));
  await store.pool.query(`UPDATE gracz_lobby_presence SET seen_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1`,[userId]);
  assert.equal((await b.listPlayers()).some(player=>player.userId===userId),false);
}));

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LobbyService } from "../src/lobby.js";
import { PostgresCommunityPool } from "../src/postgres-community-pool.js";

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL||"";
const pgTest=databaseUrl?test:test.skip;

function memorySessionStore(){return{async create(){}}}
function prefix(label){return `c41_${label}_${randomUUID().replaceAll("-","").slice(0,12)}`}

async function cleanup(pool,p){
  await pool.query(`DELETE FROM gracz_lobby_invitations WHERE invitation_id LIKE $1 OR room_id LIKE $1 OR from_id LIKE $1 OR to_id LIKE $1`,[`${p}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_rooms WHERE room_id LIKE $1 OR owner_id LIKE $1`,[`${p}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_presence WHERE user_id LIKE $1`,[`${p}%`]).catch(()=>{});
}

async function insertRoom(pool,{roomId,ownerId,status="waiting",gameType="checkers",gameLabel="Warcaby",seats,gameId=null,age="0 seconds"}){
  await pool.query(`INSERT INTO gracz_lobby_rooms(room_id,room_name,game_type,game_label,max_players,status,seats,game_id,owner_id,owner_name,created_at,updated_at)
    VALUES($1,$1,$2,$3,$4,$5,$6::jsonb,$7,$8,$8,NOW()-$9::interval,NOW()-$9::interval)`,
    [roomId,gameType,gameLabel,seats.length,status,JSON.stringify(seats),gameId,ownerId,age]);
}
async function insertPresence(pool,userId,name,age="1 second"){
  await pool.query(`INSERT INTO gracz_lobby_presence(user_id,display_name,seen_at) VALUES($1,$2,NOW()-$3::interval)
    ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,seen_at=EXCLUDED.seen_at`,[userId,name,age]);
}
async function insertInvitation(pool,{id,roomId,fromId,toId,age="1 second"}){
  await pool.query(`INSERT INTO gracz_lobby_invitations(invitation_id,status,room_id,room_name,game_type,game_label,from_id,from_name,to_id,created_at)
    VALUES($1,'pending',$2,$2,'checkers','Warcaby',$3,'Owner',$4,NOW()-$5::interval)`,[id,roomId,fromId,toId,age]);
}

async function withLobby(label,run){
  const p=prefix(label);
  const community=new PostgresCommunityPool(databaseUrl);
  const lobby=new LobbyService({sessionStore:memorySessionStore(),pool:community.pool});
  try{
    await lobby.ready;
    await cleanup(community.pool,p);
    await run({p,pool:community.pool,lobby});
  }finally{
    await cleanup(community.pool,p);
    await community.close();
  }
}

function measureRead(pool){
  let directQueries=0,acquisitions=0;
  const original=pool.query.bind(pool);
  const onAcquire=()=>{acquisitions+=1};
  pool.on("acquire",onAcquire);
  pool.query=(...args)=>{directQueries+=1;return original(...args)};
  return{
    snapshot:()=>({directQueries,acquisitions}),
    restore(){pool.query=original;pool.off("acquire",onAcquire)},
  };
}

test("B1-C41 structural proof keeps one room snapshot and removes player_rooms SQL/result dependency",async()=>{
  const source=await readFile(new URL("../src/lobby.js",import.meta.url),"utf8");
  const start=source.indexOf("async #readStateDatabase");
  const end=source.indexOf("\n  listRooms()",start);
  assert.ok(start>=0&&end>start);
  const method=source.slice(start,end);
  assert.equal((method.match(/FROM gracz_lobby_rooms/g)||[]).length,1,"readState must contain one gracz_lobby_rooms base-table snapshot only");
  assert.match(method,/\), rooms AS \(\s*SELECT \* FROM gracz_lobby_rooms ORDER BY updated_at DESC,created_at DESC LIMIT 500\s*\)/);
  assert.doesNotMatch(method,/\bplayer_rooms\s+AS\s*\(/i);
  assert.doesNotMatch(method,/\bAS\s+player_rooms\b/i);
  assert.doesNotMatch(method,/requireRowArray\(stateRow\.player_rooms/);
  assert.equal((method.match(/roomRows\.map\(databaseRoom\)/g)||[]).length,1,"canonical room rows must become internal rooms exactly once");
  assert.match(method,/const rooms=internalRooms\.map\(publicRoom\)/);
  assert.match(method,/for\(const room of internalRooms\)/);
  assert.equal((method.match(/this\.pool\.query\(/g)||[]).length,1);
  assert.equal((method.match(/this\.pool\.connect\(/g)||[]).length,0);
});

pgTest("B1-C41 one real readState acquisition reuses canonical rooms for public rooms, player projection, caller presence and invitations",{timeout:20_000},async()=>withLobby("canonical",async({p,pool,lobby})=>{
  const me=`${p}_me`,waiting=`${p}_waiting`,playing=`${p}_playing`,mate=`${p}_mate`;
  const waitRoom=`${p}_room_wait`,playRoom=`${p}_room_play`;
  await insertPresence(pool,waiting,"Waiting");
  await insertPresence(pool,playing,"Playing");
  await insertPresence(pool,mate,"Mate");
  await insertRoom(pool,{roomId:waitRoom,ownerId:waiting,status:"waiting",seats:[{id:waiting,name:"Waiting"},null],age:"20 seconds"});
  await insertRoom(pool,{roomId:playRoom,ownerId:playing,status:"playing",gameType:"gomoku",gameLabel:"Gomoku",seats:[{id:playing,name:"Playing"},{id:mate,name:"Mate"}],gameId:`gomoku-${playRoom}`,age:"5 seconds"});
  await insertInvitation(pool,{id:`${p}_inv`,roomId:waitRoom,fromId:waiting,toId:me});

  const meter=measureRead(pool);
  let state;
  try{state=await lobby.readState({userId:me,displayName:"Caller"});}
  finally{meter.restore()}
  assert.deepEqual(meter.snapshot(),{directQueries:1,acquisitions:1},"one readState must equal one direct Pool.query and one physical acquisition");

  const ours=state.rooms.filter(room=>room.roomId.startsWith(p));
  assert.deepEqual(ours.map(room=>room.roomId),[playRoom,waitRoom]);
  assert.equal(ours.find(room=>room.roomId===waitRoom).status,"waiting");
  assert.equal(ours.find(room=>room.roomId===playRoom).status,"playing");

  const waitingProjection=state.players.find(player=>player.userId===waiting);
  const playingProjection=state.players.find(player=>player.userId===playing);
  const caller=state.players.filter(player=>player.userId===me);
  assert.deepEqual({status:waitingProjection.status,roomId:waitingProjection.roomId},{status:"przy stole",roomId:waitRoom});
  assert.deepEqual({status:playingProjection.status,roomId:playingProjection.roomId},{status:"w grze",roomId:playRoom});
  assert.equal(caller.length,1,"current caller must be present immediately");
  assert.equal(caller[0].displayName,"Caller");
  assert.equal(caller[0].status,"dostępny");
  assert.deepEqual(state.invitations.map(inv=>inv.invitationId),[`${p}_inv`]);
}));

pgTest("B1-C41 concurrent same-user reads remain correct",{timeout:20_000},async()=>withLobby("same",async({p,pool,lobby})=>{
  const me=`${p}_me`;
  const meter=measureRead(pool);
  let states;
  try{states=await Promise.all(Array.from({length:8},(_,i)=>lobby.readState({userId:me,displayName:`Same ${i}`})));}
  finally{meter.restore()}
  assert.deepEqual(meter.snapshot(),{directQueries:8,acquisitions:8});
  for(const state of states)assert.equal(state.players.filter(player=>player.userId===me).length,1);
  const count=Number((await pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_presence WHERE user_id=$1`,[me])).rows[0].count);
  assert.equal(count,1);
}));

pgTest("B1-C41 concurrent different-user reads remain isolated and correct",{timeout:20_000},async()=>withLobby("different",async({p,pool,lobby})=>{
  const users=Array.from({length:6},(_,i)=>`${p}_u${i}`);
  const meter=measureRead(pool);
  let states;
  try{states=await Promise.all(users.map((userId,i)=>lobby.readState({userId,displayName:`User ${i}`})));}
  finally{meter.restore()}
  assert.deepEqual(meter.snapshot(),{directQueries:users.length,acquisitions:users.length});
  states.forEach((state,i)=>assert.equal(state.players.filter(player=>player.userId===users[i]).length,1));
  const count=Number((await pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_presence WHERE user_id=ANY($1::text[])`,[users])).rows[0].count);
  assert.equal(count,users.length);
}));

pgTest("B1-C41 cross-replica LobbyService instances observe committed room and presence state",{timeout:20_000},async()=>{
  const p=prefix("replica");
  const communityA=new PostgresCommunityPool(databaseUrl);
  const communityB=new PostgresCommunityPool(databaseUrl);
  const a=new LobbyService({sessionStore:memorySessionStore(),pool:communityA.pool});
  const b=new LobbyService({sessionStore:memorySessionStore(),pool:communityB.pool});
  try{
    await Promise.all([a.ready,b.ready]);
    await cleanup(communityA.pool,p);
    const owner=`${p}_owner`,observer=`${p}_observer`,room=`${p}_room`;
    await insertPresence(communityA.pool,owner,"Owner");
    await insertRoom(communityA.pool,{roomId:room,ownerId:owner,status:"waiting",seats:[{id:owner,name:"Owner"},null]});
    const fromB=await b.readState({userId:observer,displayName:"Observer"});
    assert.ok(fromB.rooms.some(candidate=>candidate.roomId===room));
    const ownerProjection=fromB.players.find(player=>player.userId===owner);
    assert.deepEqual({status:ownerProjection.status,roomId:ownerProjection.roomId},{status:"przy stole",roomId:room});
    const fromA=await a.readState({userId:owner,displayName:"Owner"});
    assert.equal(fromA.players.filter(player=>player.userId===observer).length,1);
  }finally{
    await cleanup(communityA.pool,p);
    await Promise.all([communityA.close(),communityB.close()]);
  }
});

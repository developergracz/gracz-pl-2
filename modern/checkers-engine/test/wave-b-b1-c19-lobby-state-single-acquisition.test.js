import assert from "node:assert/strict";
import test from "node:test";

import { LobbyService } from "../src/lobby.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;

function memorySessionStore(){return{async create(){}}}
function emptyState(){return{rooms:[],presence:[],player_rooms:[],invitations:[]}}

async function fakeLobby({state=emptyState(),fail=false}={}){
  const metrics={connects:0,releases:0,queries:[]};
  const client={async query(){return{rows:[]}},release(){metrics.releases+=1}};
  const pool={
    async connect(){metrics.connects+=1;return client},
    async query(text,params){
      const sql=typeof text==="string"?text:String(text?.text??"");
      metrics.queries.push({sql,params});
      if(fail)throw new Error("forced C19 database failure");
      return{rows:[state]};
    },
  };
  const lobby=new LobbyService({sessionStore:memorySessionStore(),pool});
  await lobby.ready;
  metrics.connects=0;metrics.releases=0;metrics.queries.length=0;
  return{lobby,metrics};
}

function projectedState(){
  const now="2026-09-10T10:00:00.000Z";
  const waiting={room_id:"room-w",room_name:"Waiting",game_type:"checkers",game_label:"Warcaby",max_players:2,status:"waiting",seats:[{id:"alice",name:"Alicja"},null],game_id:null,owner_id:"alice",owner_name:"Alicja",created_at:now,updated_at:now};
  const playing={room_id:"room-p",room_name:"Playing",game_type:"gomoku",game_label:"Gomoku",max_players:2,status:"playing",seats:[{id:"bob",name:"Robert"},{id:"dave",name:"Dawid"}],game_id:"gomoku-room-p",owner_id:"bob",owner_name:"Robert",created_at:now,updated_at:now};
  return{
    rooms:[waiting,playing],
    presence:[
      {user_id:"alice",display_name:"Alicja",seen_at:now},
      {user_id:"bob",display_name:"Robert",seen_at:now},
      {user_id:"carol",display_name:"Karolina",seen_at:now},
    ],
    player_rooms:[waiting,playing],
    invitations:[{invitation_id:"inv-a",status:"pending",room_id:"room-w",room_name:"Waiting",game_type:"checkers",game_label:"Warcaby",from_id:"owner",from_name:"Czeslaw",to_id:"alice",created_at:now}],
  };
}

test("B1-C19 readState uses exactly one pool.query, zero explicit pool.connect and one bounded parameterized statement",async()=>{
  const{lobby,metrics}=await fakeLobby({state:projectedState()});
  const state=await lobby.readState({userId:"alice",displayName:"Czeslaw"});
  assert.equal(metrics.connects,0);
  assert.equal(metrics.releases,0);
  assert.equal(metrics.queries.length,1);
  const[{sql,params}]=metrics.queries;
  assert.deepEqual(params,["alice","Czesław"]);
  assert.match(sql,/^\s*WITH touched AS \(/);
  assert.match(sql,/INSERT INTO gracz_lobby_presence\(user_id,display_name,seen_at\)/);
  assert.match(sql,/ON CONFLICT\(user_id\) DO UPDATE/);
  assert.match(sql,/RETURNING user_id,display_name,seen_at/);
  assert.match(sql,/WHERE user_id<>\$1 AND seen_at>=NOW\(\)-INTERVAL '45 seconds'/);
  assert.match(sql,/ORDER BY seen_at DESC LIMIT 499/);
  assert.match(sql,/SELECT user_id,display_name,seen_at FROM touched\s+UNION ALL/);
  assert.match(sql,/ORDER BY updated_at DESC,created_at DESC LIMIT 500/);
  assert.match(sql,/WHERE to_id=\$1 AND status='pending'/);
  assert.match(sql,/ORDER BY created_at ASC LIMIT 200/);
  assert.doesNotMatch(sql,/DELETE FROM gracz_lobby_presence/);
  assert.doesNotMatch(sql,/\b(BEGIN|COMMIT|ROLLBACK)\b/i);
  assert.deepEqual(Object.keys(state),["rooms","players","invitations"]);
});

test("B1-C19 public projection preserves room contract, statuses and invitation shape",async()=>{
  const{lobby}=await fakeLobby({state:projectedState()});
  const state=await lobby.readState({userId:"alice",displayName:"Alicja"});
  assert.deepEqual(state.rooms[0],{
    roomId:"room-w",roomName:"Waiting",gameType:"checkers",gameLabel:"Warcaby",maxPlayers:2,filledSeats:1,status:"waiting",
    seats:[{id:"alice",name:"Alicja"},null],white:{id:"alice",name:"Alicja"},black:null,gameId:null,
  });
  assert.deepEqual(state.players.map(({userId,status,roomId})=>({userId,status,roomId})),[
    {userId:"alice",status:"przy stole",roomId:"room-w"},
    {userId:"bob",status:"w grze",roomId:"room-p"},
    {userId:"carol",status:"dostępny",roomId:null},
  ]);
  assert.equal(state.invitations.length,1);
  assert.deepEqual(state.invitations[0],{
    invitationId:"inv-a",status:"pending",roomId:"room-w",roomName:"Waiting",gameType:"checkers",gameLabel:"Warcaby",
    fromId:"owner",fromName:"Czesław",toId:"alice",createdAt:Date.parse("2026-09-10T10:00:00.000Z"),
  });
});

test("B1-C19 database failure and malformed datasets fail closed",async()=>{
  const failed=await fakeLobby({fail:true});
  await assert.rejects(()=>failed.lobby.readState({userId:"alice",displayName:"Alicja"}),/forced C19 database failure/);
  assert.equal(failed.metrics.queries.length,1);

  for(const field of["rooms","presence","player_rooms","invitations"]){
    const malformed=emptyState();malformed[field]=null;
    const{lobby}=await fakeLobby({state:malformed});
    await assert.rejects(()=>lobby.readState({userId:"alice",displayName:"Alicja"}),new RegExp(`nieprawidłowe pole ${field}`));
  }
});

test("B1-C19 caller data is parameterized rather than interpolated into SQL",async()=>{
  const displayName="Robert '); DROP TABLE gracz_lobby_presence; --";
  const{lobby,metrics}=await fakeLobby();
  await lobby.readState({userId:"safe-user",displayName});
  assert.equal(metrics.queries.length,1);
  assert.equal(metrics.queries[0].sql.includes(displayName),false);
  assert.deepEqual(metrics.queries[0].params,["safe-user",displayName]);
});

function uniquePrefix(label){return `c19_${label}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
async function cleanup(pool,prefix){
  await pool.query(`DELETE FROM gracz_lobby_invitations WHERE invitation_id LIKE $1 OR room_id LIKE $1 OR from_id LIKE $1 OR to_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_rooms WHERE room_id LIKE $1 OR owner_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_presence WHERE user_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_game_sessions WHERE game_id LIKE $1`,[`game-${prefix}%`]).catch(()=>{});
}

async function withPostgresLobby(label,run){
  if(!databaseUrl)return;
  const prefix=uniquePrefix(label),store=new PostgresSessionStore(databaseUrl);
  try{
    await store.ready;await cleanup(store.pool,prefix);
    const lobby=new LobbyService({sessionStore:store,pool:store.pool});await lobby.ready;
    await run({prefix,store,lobby});
  }finally{await cleanup(store.pool,prefix);await store.close()}
}

async function insertRoom(pool,{roomId,ownerId,ownerName,status="waiting",gameType="checkers",gameLabel="Warcaby",seats,gameId=null,age="0 seconds"}){
  await pool.query(`INSERT INTO gracz_lobby_rooms(room_id,room_name,game_type,game_label,max_players,status,seats,game_id,owner_id,owner_name,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,NOW()-$11::interval,NOW()-$11::interval)`,[roomId,roomId,gameType,gameLabel,seats.length,status,JSON.stringify(seats),gameId,ownerId,ownerName,age]);
}

async function insertPresence(pool,userId,displayName,age){
  await pool.query(`INSERT INTO gracz_lobby_presence(user_id,display_name,seen_at) VALUES($1,$2,NOW()-$3::interval) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,seen_at=EXCLUDED.seen_at`,[userId,displayName,age]);
}

async function insertInvitation(pool,{id,roomId,fromId,toId,age,status="pending"}){
  await pool.query(`INSERT INTO gracz_lobby_invitations(invitation_id,status,room_id,room_name,game_type,game_label,from_id,from_name,to_id,created_at) VALUES($1,$2,$3,$3,'checkers','Warcaby',$4,'Owner',$5,NOW()-$6::interval)`,[id,status,roomId,fromId,toId,age]);
}

test("B1-C19 PostgreSQL current caller is immediately visible exactly once while stale users stay hidden and stale rows are not physically deleted",{skip:!databaseUrl},async()=>withPostgresLobby("visibility",async({prefix,store,lobby})=>{
  const me=`${prefix}_me`,stale=`${prefix}_stale`;
  await insertPresence(store.pool,me,"Old name","2 minutes");
  await insertPresence(store.pool,stale,"Stale","10 minutes");
  const before=(await store.pool.query(`SELECT seen_at FROM gracz_lobby_presence WHERE user_id=$1`,[me])).rows[0].seen_at;
  const state=await lobby.readState({userId:me,displayName:"Fresh name"});
  const mine=state.players.filter(player=>player.userId===me);
  assert.equal(mine.length,1);
  assert.equal(mine[0].displayName,"Fresh name");
  assert.equal(mine[0].status,"dostępny");
  assert.equal(state.players.some(player=>player.userId===stale),false);
  const rows=(await store.pool.query(`SELECT user_id,display_name,seen_at FROM gracz_lobby_presence WHERE user_id=ANY($1::text[]) ORDER BY user_id`,[[me,stale]])).rows;
  assert.equal(rows.length,2,"C19 must not physically delete stale rows on readState");
  const current=rows.find(row=>row.user_id===me);
  assert.equal(current.display_name,"Fresh name");
  assert.ok(new Date(current.seen_at)>new Date(before),"presence UPSERT must refresh seen_at authoritatively");
}));

test("B1-C19 PostgreSQL preserves room ordering/status projection and isolates ordered invitations to the caller",{skip:!databaseUrl},async()=>withPostgresLobby("projection",async({prefix,store,lobby})=>{
  const me=`${prefix}_me`,waitingUser=`${prefix}_wait`,playingUser=`${prefix}_play`,other=`${prefix}_other`;
  const oldRoom=`${prefix}_room_old`,newRoom=`${prefix}_room_new`;
  await insertPresence(store.pool,waitingUser,"Waiting user","1 second");
  await insertPresence(store.pool,playingUser,"Playing user","2 seconds");
  await insertPresence(store.pool,other,"Other","3 seconds");
  await insertRoom(store.pool,{roomId:oldRoom,ownerId:waitingUser,ownerName:"Waiting user",status:"waiting",seats:[{id:waitingUser,name:"Waiting user"},null],age:"20 seconds"});
  await insertRoom(store.pool,{roomId:newRoom,ownerId:playingUser,ownerName:"Playing user",status:"playing",gameType:"gomoku",gameLabel:"Gomoku",seats:[{id:playingUser,name:"Playing user"},{id:other,name:"Other"}],gameId:`gomoku-${newRoom}`,age:"5 seconds"});
  await insertInvitation(store.pool,{id:`${prefix}_inv_old`,roomId:oldRoom,fromId:waitingUser,toId:me,age:"20 seconds"});
  await insertInvitation(store.pool,{id:`${prefix}_inv_new`,roomId:newRoom,fromId:playingUser,toId:me,age:"5 seconds"});
  await insertInvitation(store.pool,{id:`${prefix}_inv_other`,roomId:oldRoom,fromId:waitingUser,toId:other,age:"10 seconds"});
  await insertInvitation(store.pool,{id:`${prefix}_inv_declined`,roomId:oldRoom,fromId:waitingUser,toId:me,age:"30 seconds",status:"declined"});

  const state=await lobby.readState({userId:me,displayName:"Me"});
  const ourRooms=state.rooms.filter(room=>room.roomId.startsWith(prefix));
  assert.deepEqual(ourRooms.map(room=>room.roomId),[newRoom,oldRoom]);
  const waiting=state.players.find(player=>player.userId===waitingUser),playing=state.players.find(player=>player.userId===playingUser),free=state.players.find(player=>player.userId===me);
  assert.deepEqual({status:waiting.status,roomId:waiting.roomId,gameType:waiting.gameType},{status:"przy stole",roomId:oldRoom,gameType:"checkers"});
  assert.deepEqual({status:playing.status,roomId:playing.roomId,gameType:playing.gameType},{status:"w grze",roomId:newRoom,gameType:"gomoku"});
  assert.equal(free.status,"dostępny");
  assert.deepEqual(state.invitations.map(inv=>inv.invitationId),[`${prefix}_inv_old`,`${prefix}_inv_new`]);
  assert.ok(state.invitations.every(inv=>inv.toId===me&&inv.status==="pending"));
  assert.equal(ourRooms[1].white.id,waitingUser);assert.equal(ourRooms[1].black,null);
}));

test("B1-C19 PostgreSQL empty lobby returns only the freshly touched caller in players",{skip:!databaseUrl},async()=>withPostgresLobby("empty",async({prefix,lobby})=>{
  const me=`${prefix}_me`,state=await lobby.readState({userId:me,displayName:"Empty caller"});
  assert.ok(Array.isArray(state.rooms)&&Array.isArray(state.players)&&Array.isArray(state.invitations));
  assert.deepEqual(state.rooms,[]);
  assert.deepEqual(state.invitations,[]);
  assert.equal(state.players.filter(player=>player.userId===me).length,1);
}));

test("B1-C19 concurrent same-user PostgreSQL reads upsert safely and never duplicate the caller",{skip:!databaseUrl},async()=>withPostgresLobby("same",async({prefix,store,lobby})=>{
  const me=`${prefix}_me`;
  const states=await Promise.all(Array.from({length:16},(_,index)=>lobby.readState({userId:me,displayName:`Same ${index}`})));
  for(const state of states)assert.equal(state.players.filter(player=>player.userId===me).length,1);
  const count=Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_presence WHERE user_id=$1`,[me])).rows[0].count);
  assert.equal(count,1);
}));

test("B1-C19 concurrent different-user PostgreSQL reads remain authoritative and isolated",{skip:!databaseUrl},async()=>withPostgresLobby("different",async({prefix,store,lobby})=>{
  const users=Array.from({length:12},(_,index)=>`${prefix}_u${index}`);
  const states=await Promise.all(users.map((userId,index)=>lobby.readState({userId,displayName:`User ${index}`})));
  states.forEach((state,index)=>assert.equal(state.players.filter(player=>player.userId===users[index]).length,1));
  const count=Number((await store.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_lobby_presence WHERE user_id=ANY($1::text[])`,[users])).rows[0].count);
  assert.equal(count,users.length);
}));

test("B1-C19 cross-replica LobbyService instances observe committed PostgreSQL presence",{skip:!databaseUrl},async()=>{
  const prefix=uniquePrefix("replica"),storeA=new PostgresSessionStore(databaseUrl),storeB=new PostgresSessionStore(databaseUrl);
  try{
    await Promise.all([storeA.ready,storeB.ready]);await cleanup(storeA.pool,prefix);
    const a=new LobbyService({sessionStore:storeA,pool:storeA.pool}),b=new LobbyService({sessionStore:storeB,pool:storeB.pool});
    await Promise.all([a.ready,b.ready]);
    const userA=`${prefix}_a`,userB=`${prefix}_b`;
    const aState=await a.readState({userId:userA,displayName:"Replica A"});
    assert.equal(aState.players.filter(player=>player.userId===userA).length,1);
    const bState=await b.readState({userId:userB,displayName:"Replica B"});
    assert.equal(bState.players.filter(player=>player.userId===userA).length,1);
    assert.equal(bState.players.filter(player=>player.userId===userB).length,1);
    const again=await a.readState({userId:userA,displayName:"Replica A"});
    assert.equal(again.players.filter(player=>player.userId===userB).length,1);
  }finally{await cleanup(storeA.pool,prefix);await Promise.all([storeA.close(),storeB.close()])}
});

test("B1-C19 readState issues exactly one direct pool.query against a real pg Pool",{skip:!databaseUrl},async()=>withPostgresLobby("count",async({prefix,store,lobby})=>{
  const originalQuery=store.pool.query.bind(store.pool);
  let queries=0;
  store.pool.query=(...args)=>{queries+=1;return originalQuery(...args)};
  try{
    const state=await lobby.readState({userId:`${prefix}_me`,displayName:"Counted"});
    assert.equal(state.players.filter(player=>player.userId===`${prefix}_me`).length,1);
    assert.equal(queries,1);
  }finally{store.pool.query=originalQuery}
}));

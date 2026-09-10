import assert from "node:assert/strict";
import test from "node:test";

import { AuthService } from "../src/auth.js";
import { LobbyService } from "../src/lobby.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { createPlatformLobbyHttpHandler } from "../src/platform-lobby-http.js";

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;

function emptyState(){return{rooms:[],presence:[],player_rooms:[],invitations:[]}}

function createPool({state=emptyState(),failWhen=null}={}){
  const metrics={connects:0,releases:0,poolQueries:[]};
  const client={
    async query(){return{rows:[]}},
    release(){metrics.releases+=1},
  };
  const pool={
    async connect(){metrics.connects+=1;return client},
    async query(text,params){
      const sql=typeof text==="string"?text:String(text?.text??"");
      metrics.poolQueries.push({sql,params});
      if(failWhen?.test(sql))throw new Error("forced query failure");
      if(/WITH touched AS/.test(sql))return{rows:[state]};
      return{rows:[]};
    },
  };
  return{pool,metrics,reset(){metrics.connects=0;metrics.releases=0;metrics.poolQueries.length=0}};
}

function memorySessionStore(){return{async create(){}}}

function makeState(){
  const now="2026-09-10T08:00:00.000Z";
  return{
    rooms:[
      {room_id:"waiting-room",room_name:"Waiting",game_type:"checkers",game_label:"Warcaby",max_players:2,status:"waiting",seats:[{id:"alice",name:"Alicja"},null],game_id:null,owner_id:"alice",owner_name:"Alicja",created_at:now,updated_at:now},
      {room_id:"playing-room",room_name:"Playing",game_type:"gomoku",game_label:"Gomoku",max_players:2,status:"playing",seats:[{id:"bob",name:"Robert"},{id:"dave",name:"Dawid"}],game_id:"gomoku-playing-room",owner_id:"bob",owner_name:"Robert",created_at:now,updated_at:now},
    ],
    presence:[
      {user_id:"alice",display_name:"Alicja",seen_at:now},
      {user_id:"bob",display_name:"Robert",seen_at:now},
      {user_id:"carol",display_name:"Karolina",seen_at:now},
    ],
    player_rooms:[
      {room_id:"waiting-room",room_name:"Waiting",game_type:"checkers",game_label:"Warcaby",max_players:2,status:"waiting",seats:[{id:"alice",name:"Alicja"},null],game_id:null,owner_id:"alice",owner_name:"Alicja",created_at:now,updated_at:now},
      {room_id:"playing-room",room_name:"Playing",game_type:"gomoku",game_label:"Gomoku",max_players:2,status:"playing",seats:[{id:"bob",name:"Robert"},{id:"dave",name:"Dawid"}],game_id:"gomoku-playing-room",owner_id:"bob",owner_name:"Robert",created_at:now,updated_at:now},
    ],
    invitations:[
      {invitation_id:"inv-a",status:"pending",room_id:"waiting-room",room_name:"Waiting",game_type:"checkers",game_label:"Warcaby",from_id:"owner",from_name:"Czeslaw",to_id:"alice",created_at:now},
    ],
  };
}

async function readyFixture(options){
  const fixture=createPool(options);
  const lobby=new LobbyService({sessionStore:memorySessionStore(),pool:fixture.pool});
  await lobby.ready;
  fixture.reset();
  return{fixture,lobby};
}

test("B1-C17 safety / C19 /lobby/state uses one short pool.query and no request-long client",async()=>{
  const{fixture,lobby}=await readyFixture();
  const state=await lobby.readState({userId:"alice",displayName:"Alicja"});
  assert.deepEqual(state,{rooms:[],players:[],invitations:[]});
  assert.equal(fixture.metrics.connects,0,"readState must not manually acquire a client");
  assert.equal(fixture.metrics.releases,0,"readState must not own a request-long client");
  assert.equal(fixture.metrics.poolQueries.length,1,"C19 collapses touch + read into one statement");
  const sql=fixture.metrics.poolQueries[0].sql;
  assert.match(sql,/WITH touched AS/);
  assert.match(sql,/INSERT INTO gracz_lobby_presence/);
  assert.doesNotMatch(sql,/DELETE FROM gracz_lobby_presence/);
  assert.equal(/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql),false);
});

test("B1-C17/C19 consolidated read preserves rooms, players, statuses and invitations",async()=>{
  const{fixture,lobby}=await readyFixture({state:makeState()});
  const state=await lobby.readState({userId:"alice",displayName:"Czeslaw"});
  assert.equal(state.rooms.length,2);
  assert.deepEqual(state.rooms[0],{
    roomId:"waiting-room",roomName:"Waiting",gameType:"checkers",gameLabel:"Warcaby",maxPlayers:2,filledSeats:1,status:"waiting",
    seats:[{id:"alice",name:"Alicja"},null],white:{id:"alice",name:"Alicja"},black:null,gameId:null,
  });
  assert.deepEqual(state.players.map(({userId,status,roomId})=>({userId,status,roomId})),[
    {userId:"alice",status:"przy stole",roomId:"waiting-room"},
    {userId:"bob",status:"w grze",roomId:"playing-room"},
    {userId:"carol",status:"dostępny",roomId:null},
  ]);
  assert.equal(state.invitations.length,1);
  assert.equal(state.invitations[0].toId,"alice");
  assert.equal(state.invitations[0].fromName,"Czesław");
  const consolidated=fixture.metrics.poolQueries.find(item=>/WITH touched AS/.test(item.sql));
  assert.ok(consolidated);
  assert.deepEqual(consolidated.params,["alice","Czesław"]);
  assert.match(consolidated.sql,/WHERE to_id=\$1 AND status='pending'/);
  assert.match(consolidated.sql,/seen_at>=NOW\(\)-INTERVAL '45 seconds'/);
  assert.match(consolidated.sql,/LIMIT 500/);
  assert.match(consolidated.sql,/LIMIT 200/);
});

test("B1-C17 fail-closed invariant survives C19 single-statement failure",async()=>{
  const{fixture,lobby}=await readyFixture({failWhen:/WITH touched AS/});
  await assert.rejects(()=>lobby.readState({userId:"alice",displayName:"Alicja"}),/forced query failure/);
  assert.equal(fixture.metrics.poolQueries.length,1);
});

test("B1-C17-C01 per-read stale cleanup is superseded without reintroducing a held client",async()=>{
  const{fixture,lobby}=await readyFixture();
  await lobby.readState({userId:"alice",displayName:"Alicja"});
  assert.equal(fixture.metrics.poolQueries.length,1);
  assert.equal(fixture.metrics.poolQueries.some(item=>/DELETE FROM gracz_lobby_presence/.test(item.sql)),false);
  assert.equal(fixture.metrics.connects,0);
});

test("B1-C17/C19 single read failure returns no partial lobby state",async()=>{
  const{fixture,lobby}=await readyFixture({failWhen:/WITH touched AS/});
  await assert.rejects(()=>lobby.readState({userId:"alice",displayName:"Alicja"}),/forced query failure/);
  assert.equal(fixture.metrics.poolQueries.length,1);
});

test("B1-C17/C19 malformed consolidated datasets fail closed instead of becoming empty arrays",async()=>{
  const{lobby}=await readyFixture({state:{rooms:null,presence:[],player_rooms:[],invitations:[]}});
  await assert.rejects(()=>lobby.readState({userId:"alice",displayName:"Alicja"}),/nieprawidłowe pole rooms/);
});

test("B1-C17-C01 GET /lobby/state keeps routing and response contract",async()=>{
  const auth=new AuthService({secret:"b1-c17-c01-test-secret-with-at-least-32-characters"});
  const token=auth.issue({userId:"alice",displayName:"Alicja"});
  let readStateCalls=0;
  const forbidden=()=>{throw new Error("legacy lobby state path must not be called")};
  const lobby={
    async readState(user){readStateCalls+=1;assert.equal(user.userId,"alice");return{rooms:[],players:[],invitations:[]}},
    touchUser:forbidden,listRooms:forbidden,listPlayers:forbidden,listInvitations:forbidden,
  };
  const handler=createPlatformLobbyHttpHandler({lobby,auth});
  const response={statusCode:null,body:null,writeHead(statusCode){this.statusCode=statusCode},end(body){this.body=body}};
  const request={method:"GET",url:"/lobby/state",headers:{authorization:`Bearer ${token}`}};
  assert.equal(await handler(request,response),true);
  assert.equal(readStateCalls,1);
  assert.equal(response.statusCode,200);
  assert.deepEqual(JSON.parse(response.body),{rooms:[],players:[],invitations:[]});
});

function uniquePrefix(label){return `c17c01_${label}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function ids(prefix){let n=0;return()=>`${prefix}_${++n}`}
async function cleanup(pool,prefix){
  await pool.query(`DELETE FROM gracz_lobby_invitations WHERE room_id LIKE $1 OR from_id LIKE $1 OR to_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_rooms WHERE room_id LIKE $1 OR owner_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_presence WHERE user_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_game_sessions WHERE game_id LIKE $1`,[`game-${prefix}%`]).catch(()=>{});
}

test("B1-C17-C01 PostgreSQL cross-node readState preserves visibility, active presence and invitation isolation",{skip:!databaseUrl},async()=>{
  const prefix=uniquePrefix("pg");
  const store=new PostgresSessionStore(databaseUrl);
  try{
    await store.ready;await cleanup(store.pool,prefix);
    const a=new LobbyService({sessionStore:store,pool:store.pool,idGenerator:ids(`${prefix}_a`)});
    const b=new LobbyService({sessionStore:store,pool:store.pool,idGenerator:ids(`${prefix}_b`)});
    await Promise.all([a.ready,b.ready]);
    const owner=`${prefix}_owner`,bob=`${prefix}_bob`,carol=`${prefix}_carol`;
    await Promise.all([
      a.touchUser({userId:owner,displayName:"Alicja"}),
      b.touchUser({userId:bob,displayName:"Robert"}),
      b.touchUser({userId:carol,displayName:"Karolina"}),
    ]);
    const room=await a.createRoom({ownerId:owner,ownerName:"Alicja",roomName:"Shared C17-C01",gameType:"checkers"});
    const bobInvite=await a.createInvitation({fromId:owner,fromName:"Alicja",toId:bob,roomId:room.roomId});
    await a.createInvitation({fromId:owner,fromName:"Alicja",toId:carol,roomId:room.roomId});

    const bobState=await b.readState({userId:bob,displayName:"Robert"});
    assert.ok(bobState.rooms.some(item=>item.roomId===room.roomId));
    assert.ok(bobState.players.some(item=>item.userId===bob&&item.status==="dostępny"));
    assert.deepEqual(bobState.invitations.map(item=>item.invitationId),[bobInvite.invitationId]);
    assert.ok(bobState.invitations.every(item=>item.toId===bob));

    await store.pool.query(`UPDATE gracz_lobby_presence SET seen_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1`,[bob]);
    const ownerState=await a.readState({userId:owner,displayName:"Alicja"});
    assert.equal(ownerState.players.some(item=>item.userId===bob),false);
  }finally{
    await cleanup(store.pool,prefix);await store.close();
  }
});

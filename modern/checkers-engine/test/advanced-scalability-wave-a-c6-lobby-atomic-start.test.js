import assert from "node:assert/strict";
import test from "node:test";

import { LobbyService, lobbyTestOptions } from "../src/lobby.js";
import { createGameSession } from "../src/session.js";
import { PostgresSessionStore } from "../src/postgres-session-store.js";
import { PostgresThousandRepository } from "../src/thousand-repository.js";
import { ThousandGameService } from "../src/thousand-service.js";
import { PostgresGomokuService } from "../src/postgres-gomoku-service.js";

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;

function unique(label){return `asc6_${label}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}
function roomIds(prefix){let n=0;return()=>`${prefix}_room_${++n}`}

async function cleanup(pool,prefix){
  await pool.query(`DELETE FROM gracz_lobby_invitations WHERE room_id LIKE $1 OR from_id LIKE $1 OR to_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_rooms WHERE room_id LIKE $1 OR owner_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_lobby_presence WHERE user_id LIKE $1`,[`${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_game_sessions WHERE game_id LIKE $1`,[`game-${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_thousand_games WHERE game_id LIKE $1`,[`thousand-${prefix}%`]).catch(()=>{});
  await pool.query(`DELETE FROM gracz_gomoku_games WHERE game_id LIKE $1`,[`gomoku-${prefix}%`]).catch(()=>{});
}

async function services(label){
  const prefix=unique(label);
  const store=new PostgresSessionStore(databaseUrl);
  const thousandRepository=new PostgresThousandRepository(databaseUrl);
  const thousandService=new ThousandGameService({repository:thousandRepository,random:()=>0.3141592653});
  const gomokuService=new PostgresGomokuService(databaseUrl);
  await Promise.all([store.ready,thousandRepository.ready,gomokuService.ready]);
  await cleanup(store.pool,prefix);
  return{
    prefix,store,thousandRepository,thousandService,gomokuService,
    async close(){
      await cleanup(store.pool,prefix);
      await Promise.allSettled([gomokuService.close(),thousandRepository.close(),store.close()]);
    },
  };
}

function lobby(ctx,{failAfterGame=false}={}){
  return new LobbyService({
    sessionStore:ctx.store,
    thousandService:ctx.thousandService,
    gomokuService:ctx.gomokuService,
    pool:ctx.store.pool,
    idGenerator:roomIds(ctx.prefix),
    ...(failAfterGame?lobbyTestOptions(async()=>{const error=new Error("C6 forced failure after game persistence");error.code="C6_FAILPOINT";throw error}):{}),
  });
}

async function assertRoomWaiting(ctx,roomId){
  const row=(await ctx.store.pool.query(`SELECT status,seats,game_id FROM gracz_lobby_rooms WHERE room_id=$1`,[roomId])).rows[0];
  assert.ok(row);
  assert.equal(row.status,"waiting");
  assert.equal(row.game_id,null);
  assert.equal((Array.isArray(row.seats)?row.seats:JSON.parse(row.seats)).filter(Boolean).length,1);
}

async function atomicRollbackCase(gameType){
  const ctx=await services(`rollback_${gameType}`);
  try{
    const failing=lobby(ctx,{failAfterGame:true});await failing.ready;
    const owner=`${ctx.prefix}_owner`,opponent=`${ctx.prefix}_p2`;
    const room=await failing.createRoom({ownerId:owner,ownerName:"Owner",roomName:"Atomic",gameType,...(gameType==="thousand"?{maxPlayers:2}:{})});
    await assert.rejects(
      failing.joinRoom({roomId:room.roomId,playerId:opponent,playerName:"Opponent"}),
      error=>error?.code==="C6_FAILPOINT",
    );

    await assertRoomWaiting(ctx,room.roomId);
    const table=gameType==="checkers"?"gracz_game_sessions":gameType==="thousand"?"gracz_thousand_games":"gracz_gomoku_games";
    const gameId=`${gameType==="checkers"?"game":gameType}-${room.roomId}`;
    const afterRollback=await ctx.store.pool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE game_id=$1`,[gameId]);
    assert.equal(afterRollback.rows[0].count,0,"game INSERT must roll back with Lobby transaction");

    const retry=lobby(ctx);await retry.ready;
    const playing=await retry.joinRoom({roomId:room.roomId,playerId:opponent,playerName:"Opponent"});
    assert.equal(playing.status,"playing");
    assert.equal(playing.gameId,gameId);
    const afterRetry=await ctx.store.pool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE game_id=$1`,[gameId]);
    assert.equal(afterRetry.rows[0].count,1,"retry must create exactly one durable game");
  }finally{await ctx.close()}
}

test("Wave A C6 PostgreSQL: Checkers game INSERT rolls back with Lobby and retry converges",{skip:!databaseUrl},()=>atomicRollbackCase("checkers"));
test("Wave A C6 PostgreSQL: Tysiąc game INSERT rolls back with Lobby and retry converges",{skip:!databaseUrl},()=>atomicRollbackCase("thousand"));
test("Wave A C6 PostgreSQL: Gomoku game INSERT rolls back with Lobby and retry converges",{skip:!databaseUrl},()=>atomicRollbackCase("gomoku"));

async function orphanReconcileCase(gameType){
  const ctx=await services(`orphan_${gameType}`);
  try{
    const app=lobby(ctx);await app.ready;
    const owner=`${ctx.prefix}_owner`,opponent=`${ctx.prefix}_p2`;
    const room=await app.createRoom({ownerId:owner,ownerName:"Owner",roomName:"Recover",gameType,...(gameType==="thousand"?{maxPlayers:2}:{})});
    const gameId=`${gameType==="checkers"?"game":gameType}-${room.roomId}`;
    const players=[{userId:owner,displayName:"Owner"},{userId:opponent,displayName:"Opponent"}];

    if(gameType==="checkers")await ctx.store.create(createGameSession({gameId,whitePlayerId:owner,blackPlayerId:opponent}));
    else if(gameType==="thousand")await ctx.thousandService.createGame({gameId,players});
    else await ctx.gomokuService.createGame({gameId,players});

    const recovered=await app.joinRoom({roomId:room.roomId,playerId:opponent,playerName:"Opponent"});
    assert.equal(recovered.status,"playing");
    assert.equal(recovered.gameId,gameId);

    const table=gameType==="checkers"?"gracz_game_sessions":gameType==="thousand"?"gracz_thousand_games":"gracz_gomoku_games";
    const count=await ctx.store.pool.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE game_id=$1`,[gameId]);
    assert.equal(count.rows[0].count,1,"reconciliation must not duplicate an existing coherent orphan game");
  }finally{await ctx.close()}
}

test("Wave A C6 PostgreSQL: Checkers coherent orphan is reconciled into playing Lobby",{skip:!databaseUrl},()=>orphanReconcileCase("checkers"));
test("Wave A C6 PostgreSQL: Tysiąc coherent orphan is reconciled into playing Lobby",{skip:!databaseUrl},()=>orphanReconcileCase("thousand"));
test("Wave A C6 PostgreSQL: Gomoku coherent orphan is reconciled into playing Lobby",{skip:!databaseUrl},()=>orphanReconcileCase("gomoku"));

test("Wave A C6: production constructor rejects a plain-text failpoint option",()=>{
  assert.throws(()=>new LobbyService({sessionStore:{create(){}},afterGameEnsured(){}}),/wyłącznie przez jawny seam testowy/);
});

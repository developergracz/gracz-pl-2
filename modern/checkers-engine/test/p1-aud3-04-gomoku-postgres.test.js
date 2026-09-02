import assert from "node:assert/strict";
import test from "node:test";
import { PostgresGomokuService } from "../src/postgres-gomoku-service.js";

const databaseUrl = process.env.P1_AUD3_04_DATABASE_URL || process.env.DATABASE_URL;

function players(){return[{userId:"alice",displayName:"Alice"},{userId:"bob",displayName:"Bob"}]}

test("P1-AUD3-04 PostgreSQL: game survives service restart", { skip: !databaseUrl }, async () => {
  const gameId=`gomoku_recovery_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const first=new PostgresGomokuService(databaseUrl);
  await first.ready;
  try{
    await first.createGame({gameId,players:players()});
    await first.move(gameId,"alice",{row:0,column:0,requestId:"m1"});
  }finally{await first.close();}

  const second=new PostgresGomokuService(databaseUrl);
  await second.ready;
  try{
    const recovered=await second.view(gameId,"bob");
    assert.equal(recovered.revision,1);
    assert.equal(recovered.moves.length,1);
    assert.equal(recovered.moves[0].requestId,"m1");
    assert.equal(recovered.turn,"white");
  }finally{
    await second.pool.query("DELETE FROM gracz_gomoku_games WHERE game_id=$1",[gameId]).catch(()=>{});
    await second.close();
  }
});

test("P1-AUD3-04 PostgreSQL: concurrent stale moves cannot overwrite newer state", { skip: !databaseUrl }, async () => {
  const gameId=`gomoku_cas_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const a=new PostgresGomokuService(databaseUrl); const b=new PostgresGomokuService(databaseUrl);
  await Promise.all([a.ready,b.ready]);
  try{
    await a.createGame({gameId,players:players()});
    const results=await Promise.allSettled([
      a.move(gameId,"alice",{row:0,column:0,requestId:"a1"}),
      b.move(gameId,"alice",{row:0,column:1,requestId:"a2"}),
    ]);
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    const rejected=results.find(r=>r.status==="rejected");
    assert.equal(rejected.reason.code,"GOMOKU_CONCURRENCY_CONFLICT");
    assert.equal(rejected.reason.status,409);
    const current=await a.view(gameId,"alice");
    assert.equal(current.revision,1);
    assert.equal(current.moves.length,1);
  }finally{
    await a.pool.query("DELETE FROM gracz_gomoku_games WHERE game_id=$1",[gameId]).catch(()=>{});
    await Promise.all([a.close(),b.close()]);
  }
});

test("P1-AUD3-04 PostgreSQL: retry with same requestId remains idempotent", { skip: !databaseUrl }, async () => {
  const gameId=`gomoku_retry_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const service=new PostgresGomokuService(databaseUrl); await service.ready;
  try{
    await service.createGame({gameId,players:players()});
    await service.move(gameId,"alice",{row:1,column:1,requestId:"same"});
    const retry=await service.move(gameId,"alice",{row:1,column:1,requestId:"same"});
    assert.equal(retry.revision,1);
    assert.equal(retry.moves.length,1);
  }finally{
    await service.pool.query("DELETE FROM gracz_gomoku_games WHERE game_id=$1",[gameId]).catch(()=>{});
    await service.close();
  }
});

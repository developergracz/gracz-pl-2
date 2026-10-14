import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createDatabase } from "../persistence/database.mjs";

test("PostgreSQL idle pool errors are handled without an unhandled EventEmitter crash", async () => {
  let poolInstance = null;
  const logs = [];

  class FakePool extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.ended = false;
      poolInstance = this;
    }

    async query() {
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }

    async end() {
      this.ended = true;
    }
  }

  const database = createDatabase({
    connectionString: "postgres://test:test@127.0.0.1:5432/gracz",
    poolFactory: FakePool,
    logger: {
      error(message, details) {
        logs.push({ message, details });
      },
    },
  });

  await database.ping();

  assert.ok(poolInstance);
  assert.equal(poolInstance.listenerCount("error"), 1);

  const poolError = Object.assign(new Error("terminating connection"), {
    code: "57P01",
  });

  assert.doesNotThrow(() => {
    poolInstance.emit("error", poolError);
  });

  assert.deepEqual(logs, [
    {
      message: "gracz.pl PostgreSQL error",
      details: {
        code: "57P01",
        operation: "PG_POOL_ERROR",
      },
    },
  ]);

  await database.close();
  assert.equal(poolInstance.ended, true);
});

for (const phase of ['checkout','BEGIN','work','COMMIT','ROLLBACK','release']) {
  test('R5.2 client fault at '+phase+' keeps release singular and errors observable',async()=>{
    const logs=[];let releases=0,discarded,client,connects=0;
    const original=Object.assign(new Error('private SQL user@example.test postgres://secret'),{code:'57P01'});
    class FaultPool extends EventEmitter {
      async connect(){
        client=new EventEmitter();
        client.query=async sql=>{
          if(sql==='ROLLBACK'&&phase==='ROLLBACK')throw original;
          if(sql===phase){client.emit('error',original);throw original;}
          return {rows:[{ok:1}]};
        };
        client.release=error=>{releases++;discarded=Boolean(error);if(phase==='release')client.emit('error',original);};
        this.emit('connect',client);connects++;
        if(phase==='checkout')client.emit('error',original);
        return client;
      }
      async end(){}
    }
    const db=createDatabase({connectionString:'postgres://synthetic',poolFactory:FaultPool,logger:{error:(...args)=>logs.push(args)}});
    const work=()=>db.transaction(async()=>{if(['work','ROLLBACK'].includes(phase))throw original;return 42;});
    if(phase==='release')assert.equal(await work(),42,'acknowledged COMMIT remains successful; late release event is handled');
    else await assert.rejects(work(),e=>e===original);
    assert.equal(releases,1);assert.equal(connects,1);
    assert.equal(client.listenerCount('error'),1,'only permanent guard remains');
    if(['checkout','BEGIN','COMMIT','ROLLBACK'].includes(phase))assert.equal(discarded,true);
    assert.ok(!JSON.stringify(logs).includes('secret'));assert.ok(!JSON.stringify(logs).includes('example.test'));
    if(phase==='ROLLBACK')assert.ok(logs.some(([,detail])=>detail.operation==='PG_ROLLBACK_ERROR'));
    await db.close();
  });
}

test('R5.2 bounded deadline settles and releases once despite late errors/results',async()=>{
  let client,releases=0,complete;const logs=[];
  class FaultPool extends EventEmitter {
    async connect(){
      client=new EventEmitter();
      client.query=()=>new Promise(resolve=>{complete=resolve;});
      client.release=discard=>{assert.equal(discard,true);releases++;};
      this.emit('connect',client);return client;
    }
    async end(){}
  }
  const db=createDatabase({connectionString:'postgres://synthetic',poolFactory:FaultPool,logger:{error:(...args)=>logs.push(args)}});
  await assert.rejects(db.queryBounded('SELECT 1',[],{timeoutMs:100}),e=>e.code==='PERSISTENCE_QUERY_TIMEOUT');
  client.emit('error',Object.assign(new Error('private'),{code:'email@example.test'}));
  complete({rows:[]});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(releases,1);assert.equal(client.listenerCount('error'),1);
  assert.deepEqual(logs,[['gracz.pl PostgreSQL error',{operation:'PG_CLIENT_ERROR',code:'PG_ERROR'}]]);
  await db.close();
});

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { PostgresThousandRepository } from '../src/thousand-repository.js';
import { ThousandRealtimeHub } from '../src/thousand-realtime.js';
import { ThousandGameService } from '../src/thousand-service.js';

const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;
const CHANNEL='gracz_thousand_realtime';

class FakeResponse extends EventEmitter{
  constructor(){super();this.headers=null;this.status=null;this.writes=[];this.ended=false}
  writeHead(status,headers){this.status=status;this.headers=headers}
  write(chunk){this.writes.push(String(chunk));return true}
  end(){if(this.ended)return;this.ended=true;this.emit('close')}
}

class FakePgBus{
  constructor(){this.listeners=new Set();this.notifications=[]}
  createPool(){
    const bus=this;
    return {
      async connect(){return new FakePgClient(bus)},
      async query(config){
        const text=typeof config==='string'?config:config.text;
        if(!text.includes('pg_notify')) throw new Error(`Unexpected pool query: ${text}`);
        const [,payload]=config.values;
        bus.notifications.push(payload);
        queueMicrotask(()=>{
          for(const client of [...bus.listeners]) client.emit('notification',{channel:CHANNEL,payload});
        });
        return {rowCount:1,rows:[{}]};
      },
    };
  }
}

class FakePgClient extends EventEmitter{
  constructor(bus){super();this.bus=bus;this.released=false;this.processID=1001}
  async query(config){
    const text=typeof config==='string'?config:config.text;
    if(text===`LISTEN ${CHANNEL}`){this.bus.listeners.add(this);return {rowCount:null,rows:[]}}
    throw new Error(`Unexpected client query: ${text}`);
  }
  release(){this.released=true;this.bus.listeners.delete(this)}
}

function dataEvents(response,type){
  return response.writes
    .filter(chunk=>chunk.startsWith(`event: ${type}\n`))
    .map(chunk=>JSON.parse(chunk.split('\ndata: ')[1].trim()));
}

async function waitFor(predicate,{timeoutMs=2500}={}){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    if(predicate()) return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.fail('Timed out waiting for cross-node realtime event.');
}

function players(prefix='f03'){
  return [
    {userId:`${prefix}_alice`,displayName:'Alicja'},
    {userId:`${prefix}_bob`,displayName:'Robert'},
  ];
}

test('AS-CAN-F03: PostgreSQL signal contains only gameId/type and each subscriber is re-projected',async()=>{
  const bus=new FakePgBus();
  const views=[];let revision=1;
  const serviceA={repository:{pool:bus.createPool()},async getView(gameId,userId){return {gameId,viewer:userId,revision}}};
  const serviceB={repository:{pool:bus.createPool()},async getView(gameId,userId){views.push(userId);return {gameId,viewer:userId,projection:`only-${userId}`,revision}}};
  const hubA=new ThousandRealtimeHub({service:serviceA});
  const hubB=new ThousandRealtimeHub({service:serviceB});
  await Promise.all([hubA.ready,hubB.ready]);

  const gameId='game_f03_signal';
  const alice=new FakeResponse(),bob=new FakeResponse();
  await hubB.subscribe(gameId,'alice',alice);
  await hubB.subscribe(gameId,'bob',bob);
  views.length=0;
  revision=2;

  assert.equal(await hubA.publish(gameId,'thousand.updated'),true);
  await waitFor(()=>dataEvents(alice,'thousand.updated').length===1&&dataEvents(bob,'thousand.updated').length===1);

  assert.deepEqual(JSON.parse(bus.notifications.at(-1)),{gameId,type:'thousand.updated'});
  assert.equal(bus.notifications.at(-1).includes('only-alice'),false);
  assert.deepEqual(views.sort(),['alice','bob']);
  assert.equal(dataEvents(alice,'thousand.updated')[0].projection,'only-alice');
  assert.equal(dataEvents(bob,'thousand.updated')[0].projection,'only-bob');
  assert.equal(dataEvents(alice,'thousand.updated')[0].revision,2);
  assert.equal(dataEvents(bob,'thousand.updated')[0].revision,2);

  hubA.close();hubB.close();
});

test('AS-CAN-F03: invalid event type is rejected before PostgreSQL notification',async()=>{
  const bus=new FakePgBus();
  const service={repository:{pool:bus.createPool()},async getView(){return {revision:1}}};
  const hub=new ThousandRealtimeHub({service});await hub.ready;
  assert.equal(await hub.publish('game_f03_invalid','thousand.raw-state'),false);
  assert.equal(bus.notifications.length,0);
  hub.close();
});

test('AS-CAN-F03 PostgreSQL: Node A publishes committed revision to subscriber on Node B',{skip:!databaseUrl},async()=>{
  const suffix=`${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const gameId=`asf03_${suffix}`;
  const repoA=new PostgresThousandRepository(databaseUrl);
  const repoB=new PostgresThousandRepository(databaseUrl);
  const serviceA=new ThousandGameService({repository:repoA,random:()=>0.25});
  const serviceB=new ThousandGameService({repository:repoB,random:()=>0.75});
  const hubA=new ThousandRealtimeHub({service:serviceA});
  const hubB=new ThousandRealtimeHub({service:serviceB});
  const response=new FakeResponse();

  try{
    await Promise.all([repoA.ready,repoB.ready,hubA.ready,hubB.ready]);
    await serviceA.createGame({gameId,players:players(`p${suffix.slice(-6)}`)});
    const bob=(await repoA.get(gameId)).players[1].userId;
    await hubB.subscribe(gameId,bob,response);
    assert.equal(dataEvents(response,'thousand.snapshot')[0].revision,1);

    const current=await repoA.get(gameId);
    await repoA.save(gameId,current.revision,current);
    assert.equal(await hubA.publish(gameId,'thousand.updated'),true);

    await waitFor(()=>dataEvents(response,'thousand.updated').some(event=>event.revision===2));
    const update=dataEvents(response,'thousand.updated').find(event=>event.revision===2);
    assert.ok(update);
    assert.equal(update.viewerIndex,1);
    assert.equal(update.state.hands['player-1'][0].hidden,true);
    const ownCard=update.state.hands['player-2'][0];
    assert.notEqual(ownCard.hidden,true);
    assert.equal(typeof ownCard.id,'string');
    assert.equal(typeof ownCard.suit,'string');
    assert.equal(typeof ownCard.rank,'string');
  }finally{
    hubA.close();hubB.close();
    await repoA.pool.query('DELETE FROM gracz_thousand_games WHERE game_id=$1',[gameId]).catch(()=>{});
    await Promise.allSettled([repoA.close(),repoB.close()]);
  }
});

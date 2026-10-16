import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, connect} from 'node:net';
import {once} from 'node:events';
import {createDatabase} from '../persistence/database.mjs';
import {createPersistenceRepositories} from '../persistence/repositories.mjs';
import {applyMigrations} from '../persistence/migrator.mjs';
import {applyNewsletterCandidate} from './newsletter-candidate.mjs';
import {assertDisposableDatabaseUrl} from './test-database-guard.mjs';
const url=process.env.DATABASE_URL;
test('R5.1 real PostgreSQL readiness transport deadline and recovery', {skip:!url,timeout:15000}, async t=>{
  assertDisposableDatabaseUrl(url);
  const setup=createDatabase({connectionString:url});t.after(()=>setup.close());
  await applyMigrations(setup);await applyNewsletterCandidate(setup,url);
  const target=new URL(url), sockets=new Set();let blackhole=true,intercepted=0;
  const proxy=createServer(down=>{
    const up=connect({host:target.hostname,port:Number(target.port||5432)});
    sockets.add(down);sockets.add(up);let blocked=false,tail=Buffer.alloc(0);
    down.on('data',chunk=>{
      tail=Buffer.concat([tail,chunk]).subarray(-16384);
      if(blackhole&&tail.includes(Buffer.from('SELECT c.relname'))&&!blocked){blocked=true;intercepted++;}
      up.write(chunk);
    });
    // Silent half-open network path, including a lost ready response.
    up.on('data',chunk=>{if(!blocked)down.write(chunk);});
    down.on('error',()=>up.destroy());up.on('error',()=>down.destroy());
    down.on('close',()=>{sockets.delete(down);up.destroy();});
    up.on('close',()=>{sockets.delete(up);down.destroy();});
  });
  proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
  const proxyUrl=new URL(url);proxyUrl.port=String(proxy.address().port);proxyUrl.searchParams.set('sslmode','disable');
  const db=createDatabase({connectionString:String(proxyUrl),poolOptions:{max:1}});
  t.after(async()=>{await db.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>proxy.close(resolve));});
  const store=createPersistenceRepositories(db).newsletter;
  const started=Date.now();
  const results=await Promise.allSettled(Array.from({length:8},()=>store.checkOptInAvailable()));
  assert.ok(results.every(r=>r.status==='rejected'&&r.reason.code==='PERSISTENCE_QUERY_TIMEOUT'));
  assert.equal(intercepted,1,'coalesced callers share one bounded query');
  assert.ok(Date.now()-started<5000,'blackhole cannot pin readiness indefinitely');
  blackhole=false;
  assert.equal(await store.checkOptInAvailable(),true,'same store retries with a fresh connection');
  assert.equal(await store.checkOptInAvailable(),true);
  await assert.rejects(db.queryBounded('SELECT pg_sleep(10)',[],{timeoutMs:400}),e=>e.code==='57014','server cancels work, not just JS waiting');
  assert.equal(await store.checkOptInAvailable(),true,'server timeout discards the broken transaction');
  assert.equal((await db.query('SHOW statement_timeout')).rows[0].statement_timeout,'0');
});

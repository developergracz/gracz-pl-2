import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

import { SecurityMonitor } from "../src/security-monitor.js";

const { Pool }=pg;
const databaseUrl=process.env.P1_C_01_DATABASE_URL||process.env.DATABASE_URL;

class FakePool{
  constructor(){this.poolQueries=[];this.clientQueries=[]}
  async connect(){
    const owner=this;
    return {
      async query(text,values){owner.clientQueries.push({text:String(text),values});return{rows:[],rowCount:null}},
      release(){},
    };
  }
  async query(text,values){this.poolQueries.push({text:String(text),values});return{rows:[{count:"0"}],rowCount:1}}
}

test("AS-CAN-F06: ordinary successful HTTP responses do not touch shared monitoring storage",async()=>{
  const pool=new FakePool();
  const monitor=new SecurityMonitor({pool,hashSalt:"f06-test"});
  await monitor.ready;
  assert.ok(pool.clientQueries.length>0,"schema initialization should use the supplied shared pool");
  assert.equal(pool.poolQueries.length,0);
  assert.equal(await monitor.observeHttp({status:200,source:"203.0.113.9",path:"/"}),false);
  assert.equal(await monitor.observeHttp({status:304,source:"203.0.113.9",path:"/asset"}),false);
  assert.equal(pool.poolQueries.length,0,"2xx/3xx traffic must remain off the PostgreSQL counter path");
});

test("AS-CAN-F06: production monitor reuses audit.pool and removes linear event-history scans",async()=>{
  const source=await readFile(new URL("../src/security-monitor.js",import.meta.url),"utf8");
  assert.match(source,/pool=audit\?\.pool\?\?null/);
  assert.doesNotMatch(source,/#events\s*=\s*\[\]/);
  assert.doesNotMatch(source,/this\.#events\.filter/);
  assert.match(source,/gracz_security_monitor_buckets/);
  assert.match(source,/gracz_security_monitor_alerts/);
});

test("AS-CAN-F06 PostgreSQL: thresholds and cooldown are shared across two nodes",{skip:!databaseUrl},async()=>{
  const poolA=createPool(databaseUrl),poolB=createPool(databaseUrl);
  const recordsA=[],recordsB=[],webhooks=[];
  const source=`198.51.100.${Math.floor(Math.random()*200)+20}`;
  const hashSalt=`f06-${Date.now()}-${Math.random()}`;
  const fetchImpl=async(_url,init)=>{webhooks.push(JSON.parse(init.body));return{ok:true}};
  const monitorA=new SecurityMonitor({audit:{pool:poolA,record:async value=>recordsA.push(value)},fetchImpl,alertWebhook:"https://alerts.example.invalid/f06",hashSalt});
  const monitorB=new SecurityMonitor({audit:{pool:poolB,record:async value=>recordsB.push(value)},fetchImpl,alertWebhook:"https://alerts.example.invalid/f06",hashSalt});
  const fingerprint=monitorA.fingerprint(source);

  try{
    await Promise.all([monitorA.ready,monitorB.ready]);
    await poolA.query(`DELETE FROM gracz_security_monitor_buckets WHERE source_id=$1`,[fingerprint]);
    await poolA.query(`DELETE FROM gracz_security_monitor_alerts WHERE alert_key LIKE $1`,[`%:${fingerprint}`]);

    for(let i=0;i<6;i++) await monitorA.observeHttp({status:401,source});
    assert.equal(recordsA.length+recordsB.length,0,"half the threshold on one node must not alert yet");
    for(let i=0;i<6;i++) await monitorB.observeHttp({status:403,source});

    assert.equal(recordsA.length+recordsB.length,1,"the distributed 12-event threshold must emit exactly one alert");
    assert.equal(webhooks.length,1);
    assert.equal(webhooks[0].kind,"auth-failure-spike");
    assert.equal(webhooks[0].metadata.sourceId,fingerprint);
    assert.equal(JSON.stringify(webhooks[0]).includes(source),false,"raw source/IP must never be transported");

    for(let i=0;i<2;i++) await Promise.all([
      monitorA.observeHttp({status:401,source}),
      monitorB.observeHttp({status:401,source}),
    ]);
    assert.equal(recordsA.length+recordsB.length,1,"shared cooldown must suppress duplicate cross-node alerts");
    assert.equal(webhooks.length,1);

    const counters=await poolA.query(
      `SELECT source_id,COALESCE(SUM(count),0)::bigint AS count
       FROM gracz_security_monitor_buckets
       WHERE metric='http.auth-failure' AND source_id=$1
       GROUP BY source_id`,[fingerprint]
    );
    assert.equal(counters.rows[0]?.source_id,fingerprint);
    assert.equal(Number(counters.rows[0]?.count),16);

    const rawSearch=await poolA.query(
      `SELECT COUNT(*)::int AS count FROM gracz_security_monitor_buckets
       WHERE source_id=$1`,[source]
    );
    assert.equal(rawSearch.rows[0].count,0,"database rows must contain only the fingerprint, never the raw source");
  }finally{
    await poolA.query(`DELETE FROM gracz_security_monitor_buckets WHERE source_id=$1`,[fingerprint]).catch(()=>{});
    await poolA.query(`DELETE FROM gracz_security_monitor_alerts WHERE alert_key LIKE $1`,[`%:${fingerprint}`]).catch(()=>{});
    await Promise.allSettled([poolA.end(),poolB.end()]);
  }
});

test("AS-CAN-F06 PostgreSQL: newsletter threshold aggregates across nodes",{skip:!databaseUrl},async()=>{
  const poolA=createPool(databaseUrl),poolB=createPool(databaseUrl);
  const records=[];
  const source=`203.0.113.${Math.floor(Math.random()*200)+20}`;
  const hashSalt=`f06-news-${Date.now()}-${Math.random()}`;
  const monitorA=new SecurityMonitor({audit:{pool:poolA,record:async value=>records.push(value)},hashSalt});
  const monitorB=new SecurityMonitor({audit:{pool:poolB,record:async value=>records.push(value)},hashSalt});
  const fingerprint=monitorA.fingerprint(source);
  try{
    await Promise.all([monitorA.ready,monitorB.ready]);
    await poolA.query(`DELETE FROM gracz_security_monitor_buckets WHERE source_id=$1`,[fingerprint]);
    await poolA.query(`DELETE FROM gracz_security_monitor_alerts WHERE alert_key LIKE $1`,[`%:${fingerprint}`]);
    await monitorA.observeNewsletter({event:"honeypot",source});
    await monitorA.observeNewsletter({event:"honeypot",source});
    await monitorB.observeNewsletter({event:"honeypot",source});
    await monitorB.observeNewsletter({event:"honeypot",source});
    assert.equal(records.length,0);
    await monitorA.observeNewsletter({event:"honeypot",source});
    assert.equal(records.length,1);
    assert.equal(records[0].eventType,"security.alert.newsletter-honeypot-spike");
    assert.equal(records[0].metadata.sourceId,fingerprint);
  }finally{
    await poolA.query(`DELETE FROM gracz_security_monitor_buckets WHERE source_id=$1`,[fingerprint]).catch(()=>{});
    await poolA.query(`DELETE FROM gracz_security_monitor_alerts WHERE alert_key LIKE $1`,[`%:${fingerprint}`]).catch(()=>{});
    await Promise.allSettled([poolA.end(),poolB.end()]);
  }
});

function createPool(connectionString){
  return new Pool({
    connectionString,
    ssl:connectionString.includes("localhost")||connectionString.includes("127.0.0.1")?false:{rejectUnauthorized:false},
    max:2,
  });
}

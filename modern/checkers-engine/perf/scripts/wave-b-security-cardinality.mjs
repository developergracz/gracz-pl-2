import pg from 'pg';
import {performance} from 'node:perf_hooks';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {SecurityMonitor} from '../../src/security-monitor.js';
const {Pool}=pg;const url=process.env.DATABASE_URL;if(!url)throw new Error('DATABASE_URL required');
const count=Math.max(100,Math.min(200000,Number(process.env.WAVE_B_CARDINALITY||10000)));const concurrency=Math.max(1,Math.min(100,Number(process.env.WAVE_B_CARDINALITY_CONCURRENCY||25)));const runId=String(process.env.WAVE_B_RUN_ID||`wa06-${count}`);
const pool=new Pool({connectionString:url,max:Math.min(10,concurrency)});const monitor=new SecurityMonitor({pool,hashSalt:'wave-b-cardinality-test-only'});await monitor.ready;
await pool.query(`DELETE FROM gracz_security_monitor_buckets`);await pool.query(`DELETE FROM gracz_security_monitor_alerts`);
const beforeMem=process.memoryUsage(),beforeCpu=process.cpuUsage(),beforeWal=(await pool.query(`SELECT pg_current_wal_lsn() lsn`)).rows[0].lsn,start=performance.now();
let next=0;async function worker(){while(true){const i=next++;if(i>=count)return;await monitor.observeHttp({status:401,source:`203.0.${Math.floor(i/256)%256}.${i%256}-${i}`})}}
await Promise.all(Array.from({length:concurrency},()=>worker()));const elapsedMs=performance.now()-start,cpu=process.cpuUsage(beforeCpu),afterMem=process.memoryUsage();
const stats=await pool.query(`SELECT count(*)::bigint rows,pg_total_relation_size('gracz_security_monitor_buckets')::bigint bytes FROM gracz_security_monitor_buckets`);const afterWal=(await pool.query(`SELECT pg_current_wal_lsn() lsn`)).rows[0].lsn;const wal=await pool.query(`SELECT pg_wal_lsn_diff($1,$2)::bigint bytes`,[afterWal,beforeWal]);
const report={runId,events:count,concurrency,elapsedMs,eventsPerSecond:count/(elapsedMs/1000),memory:{rssBefore:beforeMem.rss,rssAfter:afterMem.rss,rssDelta:afterMem.rss-beforeMem.rss,heapUsedBefore:beforeMem.heapUsed,heapUsedAfter:afterMem.heapUsed,heapDelta:afterMem.heapUsed-beforeMem.heapUsed},cpu:{userMicros:cpu.user,systemMicros:cpu.system},database:{rows:Number(stats.rows[0].rows),relationBytes:Number(stats.rows[0].bytes),walBytes:Number(wal.rows[0].bytes)},retentionMinutes:30};
const out=resolve(`perf/k6/reports/${runId}-wa06.json`);await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await pool.end();

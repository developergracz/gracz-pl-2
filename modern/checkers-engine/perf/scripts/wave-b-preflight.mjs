import pg from 'pg';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';

const require=createRequire(import.meta.url);
const budget=require('../../src/postgres-pool-budget.cjs');
const {Pool}=pg;
const url=process.env.DATABASE_URL;
const runId=String(process.env.WAVE_B_RUN_ID||'wave-b-preflight');
const out=resolve(`perf/k6/reports/${runId}-preflight.json`);
await mkdir(dirname(out),{recursive:true});

function fail(message,code,exitCode,extra={}){
  const report={runId,pass:false,code,message,...extra};
  return writeFile(out,JSON.stringify(report,null,2)).then(()=>{console.error(`WAVE_B_PREFLIGHT_FAIL ${code}: ${message}`);process.exit(exitCode)});
}
function secret(name){
  const value=process.env[name];
  if(typeof value!=='string'||Buffer.byteLength(value,'utf8')<32) throw Object.assign(new Error(`${name} must contain at least 32 bytes for the isolated benchmark.`),{code:'BENCHMARK_SECRET_MISSING'});
  const trimmed=value.trim();
  if(!trimmed||/^(.)\1+$/su.test(value)||/^(?:change[_-]?me|replace[_-]?me|example|placeholder)/i.test(trimmed)) throw Object.assign(new Error(`${name} does not meet benchmark secret quality requirements.`),{code:'BENCHMARK_SECRET_QUALITY'});
  return value;
}

if(!url) await fail('DATABASE_URL is required.','BENCHMARK_DATABASE_URL_MISSING',40);
let values;
try{
  values=['AUTH_SECRET','MESSAGE_ENCRYPTION_KEY','ATTACHMENT_ENCRYPTION_KEY','MFA_ENCRYPTION_KEY'].map(name=>[name,secret(name)]);
}catch(error){await fail(error.message,error.code||'BENCHMARK_SECRET_INVALID',41)}
const distinct=new Set(values.map(([,value])=>value));
if(distinct.size!==values.length) await fail('Benchmark authentication/encryption secrets must all be distinct.','BENCHMARK_SECRET_NOT_SEPARATED',41);

const pool=new Pool({connectionString:url,max:2});
try{
  const settings=await pool.query(`SELECT current_setting('max_connections')::int AS max_connections,
    COALESCE(current_setting('superuser_reserved_connections',true),'0')::int AS superuser_reserved,
    COALESCE(current_setting('reserved_connections',true),'0')::int AS reserved_connections,
    current_setting('shared_buffers') AS shared_buffers,
    version() AS version`);
  const row=settings.rows[0];
  const replicas=Math.max(1,Number(process.env.WAVE_B_REPLICAS||1));
  const extraReserved=Math.max(0,Number(process.env.WAVE_B_EXTRA_RESERVED_CONNECTIONS||0));
  const reserved=Number(row.superuser_reserved||0)+Number(row.reserved_connections||0)+extraReserved;
  let plan;
  try{
    plan=budget.validateClusterConnectionBudget({
      replicaCount:replicas,
      maxConnections:Number(row.max_connections),
      reservedConnections:reserved,
      operationalHeadroom:process.env.WAVE_B_OPERATIONAL_HEADROOM==null?null:Number(process.env.WAVE_B_OPERATIONAL_HEADROOM),
      environment:process.env,
    });
  }catch(error){
    if(error?.code==='POSTGRES_CLUSTER_CONNECTION_BUDGET_EXCEEDED'){
      await writeFile(out,JSON.stringify({runId,pass:false,code:error.code,secretPreflight:{present:true,distinct:true},postgres:{version:row.version,maxConnections:Number(row.max_connections),sharedBuffers:row.shared_buffers,reservedConnections:reserved},connectionBudget:error.plan},null,2));
      console.error(`WAVE_B_PREFLIGHT_FAIL ${error.code}: ${error.message}`);
      process.exit(42);
    }
    throw error;
  }
  const report={runId,pass:true,secretPreflight:{present:true,distinct:true},postgres:{version:row.version,maxConnections:Number(row.max_connections),sharedBuffers:row.shared_buffers,reservedConnections:reserved},connectionBudget:plan};
  await writeFile(out,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await pool.end()}

import { createHash } from "node:crypto";

const WINDOW_MS=15*60_000;
const ALERT_COOLDOWN_MS=10*60_000;
const BUCKET_MS=10_000;
const RETENTION_MS=30*60_000;
const CLEANUP_INTERVAL_MS=5*60_000;
const SCHEMA_LOCK_ID=1_000_006_006;
const GLOBAL_SOURCE_ID="global";
const NEWSLETTER_THRESHOLDS={honeypot:5,"fast-submit":5,subscribe:25,resend:10};

export class SecurityMonitor {
  #memoryBuckets=new Map();
  #lastAlert=new Map();
  #lastCleanupAt=0;

  constructor({
    audit=null,
    fetchImpl=globalThis.fetch,
    alertWebhook=process.env.SECURITY_ALERT_WEBHOOK||"",
    clock=()=>Date.now(),
    hashSalt=process.env.MONITOR_HASH_SALT||process.env.AUTH_SECRET||"gracz-monitor",
    pool=audit?.pool??null,
  }={}){
    this.audit=audit;
    this.fetchImpl=fetchImpl;
    this.alertWebhook=String(alertWebhook).trim();
    this.clock=clock;
    this.hashSalt=String(hashSalt);
    this.pool=isPool(pool)?pool:null;
    this.ready=this.pool?this.#initialize():Promise.resolve();
  }

  fingerprint(value){
    return createHash("sha256").update(this.hashSalt).update("\0").update(String(value||"unknown")).digest("hex").slice(0,16);
  }

  async #initialize(){
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)",[SCHEMA_LOCK_ID]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS gracz_security_monitor_buckets(
          bucket_start TIMESTAMPTZ NOT NULL,
          metric VARCHAR(64) NOT NULL,
          source_id VARCHAR(16) NOT NULL,
          count BIGINT NOT NULL CHECK(count>0),
          PRIMARY KEY(bucket_start,metric,source_id)
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS gracz_security_monitor_lookup_idx
        ON gracz_security_monitor_buckets(metric,source_id,bucket_start DESC)
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS gracz_security_monitor_alerts(
          alert_key VARCHAR(128) PRIMARY KEY,
          last_alert_at TIMESTAMPTZ NOT NULL
        )
      `);
      await client.query("COMMIT");
    }catch(error){
      await client.query("ROLLBACK").catch(()=>{});
      throw error;
    }finally{client.release()}
  }

  async observeHttp({status,source}){
    const code=Number(status);
    if(code===401||code===403){
      const sourceId=this.fingerprint(source);
      return this.#observeMetric("http.auth-failure",sourceId,12,"auth-failure-spike",{sourceId});
    }
    if(code===429){
      const sourceId=this.fingerprint(source);
      return this.#observeMetric("http.rate-limit",sourceId,8,"rate-limit-spike",{sourceId});
    }
    if(code>=500){
      return this.#observeMetric("http.server-error",GLOBAL_SOURCE_ID,10,"server-error-spike",{});
    }
    return false;
  }

  async observeNewsletter({event,source}){
    const normalized=String(event||"").slice(0,40);
    const threshold=NEWSLETTER_THRESHOLDS[normalized];
    if(!threshold)return false;
    const sourceId=this.fingerprint(source);
    return this.#observeMetric(`newsletter.${normalized}`,sourceId,threshold,`newsletter-${normalized}-spike`,{sourceId,windowMinutes:15});
  }

  async #observeMetric(metric,sourceId,threshold,alertKind,metadata){
    const now=this.clock();
    const count=this.pool
      ? await this.#recordDistributed(metric,sourceId,now)
      : this.#recordMemory(metric,sourceId,now);
    if(count<threshold)return false;
    await this.alert(alertKind,{...metadata,count});
    return true;
  }

  async #recordDistributed(metric,sourceId,now){
    await this.ready;
    const bucketStart=bucketAt(now);
    const cutoffBucket=bucketAt(now-WINDOW_MS);
    await this.pool.query(
      `INSERT INTO gracz_security_monitor_buckets(bucket_start,metric,source_id,count)
       VALUES($1,$2,$3,1)
       ON CONFLICT(bucket_start,metric,source_id)
       DO UPDATE SET count=gracz_security_monitor_buckets.count+1`,
      [new Date(bucketStart).toISOString(),metric,sourceId],
    );
    const {rows}=await this.pool.query(
      `SELECT COALESCE(SUM(count),0)::bigint AS count
       FROM gracz_security_monitor_buckets
       WHERE metric=$1 AND source_id=$2 AND bucket_start >= $3 AND bucket_start <= $4`,
      [metric,sourceId,new Date(cutoffBucket).toISOString(),new Date(bucketStart).toISOString()],
    );
    await this.#cleanupDistributed(now);
    return Number(rows[0]?.count||0);
  }

  #recordMemory(metric,sourceId,now){
    const currentBucket=bucketAt(now);
    let bucket=this.#memoryBuckets.get(currentBucket);
    if(!bucket){bucket=new Map();this.#memoryBuckets.set(currentBucket,bucket)}
    const key=`${metric}:${sourceId}`;
    bucket.set(key,(bucket.get(key)||0)+1);
    let count=0;
    const cutoff=bucketAt(now-WINDOW_MS);
    for(let at=cutoff;at<=currentBucket;at+=BUCKET_MS) count+=this.#memoryBuckets.get(at)?.get(key)||0;
    this.#cleanupMemory(now);
    return count;
  }

  async #cleanupDistributed(now){
    if(now-this.#lastCleanupAt<CLEANUP_INTERVAL_MS)return;
    this.#lastCleanupAt=now;
    const cutoff=new Date(now-RETENTION_MS).toISOString();
    await this.pool.query(`DELETE FROM gracz_security_monitor_buckets WHERE bucket_start < $1`,[cutoff]);
    await this.pool.query(`DELETE FROM gracz_security_monitor_alerts WHERE last_alert_at < $1`,[cutoff]);
  }

  #cleanupMemory(now){
    if(now-this.#lastCleanupAt<CLEANUP_INTERVAL_MS)return;
    this.#lastCleanupAt=now;
    const cutoff=bucketAt(now-RETENTION_MS);
    for(const at of this.#memoryBuckets.keys())if(at<cutoff)this.#memoryBuckets.delete(at);
    for(const [key,last] of this.#lastAlert)if(last<now-RETENTION_MS)this.#lastAlert.delete(key);
  }

  async alert(kind,metadata={}){
    const now=this.clock();
    const key=`${kind}:${metadata.sourceId||"global"}`;
    const claimed=this.pool
      ? await this.#claimDistributedAlert(key,now)
      : this.#claimMemoryAlert(key,now);
    if(!claimed)return false;
    const safeMetadata=sanitizeMetadata(metadata);
    await this.audit?.record({eventType:`security.alert.${kind}`,outcome:"failure",metadata:safeMetadata});
    if(!this.alertWebhook||typeof this.fetchImpl!=="function")return true;
    try{
      await this.fetchImpl(this.alertWebhook,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({service:"gracz.pl",kind:String(kind).slice(0,80),metadata:safeMetadata,at:new Date(now).toISOString()}),
        signal:AbortSignal.timeout(5_000),
      });
    }catch{/* alert transport failure is intentionally non-fatal */}
    return true;
  }

  #claimMemoryAlert(key,now){
    const last=this.#lastAlert.get(key)||0;
    if(now-last<ALERT_COOLDOWN_MS)return false;
    this.#lastAlert.set(key,now);
    return true;
  }

  async #claimDistributedAlert(key,now){
    await this.ready;
    const {rowCount}=await this.pool.query(
      `INSERT INTO gracz_security_monitor_alerts(alert_key,last_alert_at)
       VALUES($1,$2)
       ON CONFLICT(alert_key) DO UPDATE
       SET last_alert_at=EXCLUDED.last_alert_at
       WHERE gracz_security_monitor_alerts.last_alert_at <= EXCLUDED.last_alert_at - ($3::bigint * INTERVAL '1 millisecond')
       RETURNING alert_key`,
      [key,new Date(now).toISOString(),ALERT_COOLDOWN_MS],
    );
    return rowCount===1;
  }
}

function bucketAt(now){return Math.floor(Number(now)/BUCKET_MS)*BUCKET_MS}
function isPool(value){return Boolean(value&&typeof value.query==="function"&&typeof value.connect==="function")}
function sanitizeMetadata(metadata){const allowed={};for(const key of["sourceId","count","windowMinutes"]){const value=metadata?.[key];if(typeof value==="number"&&Number.isFinite(value))allowed[key]=value;else if(key==="sourceId"&&/^[a-f0-9]{16}$/.test(String(value||"")))allowed[key]=String(value);}return allowed;}

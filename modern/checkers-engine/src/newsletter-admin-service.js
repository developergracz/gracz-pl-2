import pg from "pg";
const { Pool } = pg;

const SOURCE_TYPES = new Set(["internal","campaign","partner","advertisement","other"]);
const CONSENT_ACTIONS = new Set(["granted","confirmed","revoked"]);

export class NewsletterAdminService {
  constructor(databaseUrl = null) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false }, max: 3 }) : null;
    this.ready = this.pool ? this.initialize() : Promise.resolve();
  }

  async initialize() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS newsletter_sources(
      id BIGSERIAL PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      description TEXT,
      source_type VARCHAR(32) NOT NULL CHECK(source_type IN ('internal','campaign','partner','advertisement','other')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await this.pool.query(`INSERT INTO newsletter_sources(code,name,description,source_type,active)
      VALUES('homepage','Strona główna Gracz.pl','Publiczny formularz listy startowej Gracz.pl','internal',TRUE)
      ON CONFLICT(code) DO NOTHING`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS newsletter_subscriber_sources(
      id BIGSERIAL PRIMARY KEY,
      subscriber_id BIGINT NOT NULL REFERENCES gracz_newsletter_subscribers(id) ON DELETE RESTRICT,
      source_id BIGINT NOT NULL REFERENCES newsletter_sources(id) ON DELETE RESTRICT,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      campaign_reference VARCHAR(128),
      partner_reference VARCHAR(128),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE(subscriber_id,source_id)
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS newsletter_consent_history(
      id BIGSERIAL PRIMARY KEY,
      subscriber_id BIGINT NOT NULL REFERENCES gracz_newsletter_subscribers(id) ON DELETE RESTRICT,
      consent_type VARCHAR(64) NOT NULL,
      consent_version VARCHAR(64) NOT NULL,
      action VARCHAR(24) NOT NULL CHECK(action IN ('granted','confirmed','revoked')),
      source VARCHAR(64) NOT NULL DEFAULT 'homepage',
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS newsletter_consent_subscriber_idx ON newsletter_consent_history(subscriber_id,occurred_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS newsletter_consent_time_idx ON newsletter_consent_history(occurred_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS newsletter_consent_type_idx ON newsletter_consent_history(consent_type,action)`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS newsletter_events(
      id BIGSERIAL PRIMARY KEY,
      subscriber_id BIGINT REFERENCES gracz_newsletter_subscribers(id) ON DELETE SET NULL,
      event_type VARCHAR(64) NOT NULL,
      source_id BIGINT REFERENCES newsletter_sources(id) ON DELETE SET NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source_hash CHAR(64),
      user_agent_hash CHAR(64),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS newsletter_events_time_idx ON newsletter_events(occurred_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS newsletter_events_subscriber_idx ON newsletter_events(subscriber_id,occurred_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS newsletter_events_type_time_idx ON newsletter_events(event_type,occurred_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS newsletter_events_source_idx ON newsletter_events(source_id,occurred_at DESC)`);
  }

  async dashboard() {
    await this.#requirePool();
    const { rows } = await this.pool.query(`SELECT
      COUNT(*) FILTER (WHERE status='subscribed')::int AS subscribed,
      COUNT(*) FILTER (WHERE status='pending_confirmation')::int AS pending,
      COUNT(*) FILTER (WHERE status='unsubscribed')::int AS unsubscribed,
      COUNT(*) FILTER (WHERE created_at>=date_trunc('day',NOW()))::int AS new_today
      FROM gracz_newsletter_subscribers`);
    const hour = await this.pool.query(`SELECT COUNT(*)::int AS count FROM newsletter_events WHERE event_type='subscribe.requested' AND occurred_at>=NOW()-INTERVAL '1 hour'`);
    const recent = await this.pool.query(`SELECT e.id,e.event_type,e.occurred_at,s.email,ns.code AS source_code
      FROM newsletter_events e
      LEFT JOIN gracz_newsletter_subscribers s ON s.id=e.subscriber_id
      LEFT JOIN newsletter_sources ns ON ns.id=e.source_id
      ORDER BY e.occurred_at DESC LIMIT 20`);
    return {
      totals:{subscribed:Number(rows[0]?.subscribed||0),pending:Number(rows[0]?.pending||0),unsubscribed:Number(rows[0]?.unsubscribed||0)},
      newToday:Number(rows[0]?.new_today||0),
      newLastHour:Number(hour.rows[0]?.count||0),
      recentEvents:recent.rows.map(row=>({id:row.id,eventType:row.event_type,occurredAt:row.occurred_at,maskedEmail:maskEmail(row.email),sourceCode:row.source_code||null})),
    };
  }

  async listSubscribers(query={}) {
    await this.#requirePool();
    const page=Math.max(1,toInt(query.page,1));
    const pageSize=Math.min(200,Math.max(1,toInt(query.pageSize,50)));
    const offset=(page-1)*pageSize;
    const where=[]; const params=[];
    if(query.status&&query.status!=="all"){params.push(String(query.status));where.push(`s.status=$${params.length}`);}
    if(query.fromDate){params.push(String(query.fromDate));where.push(`s.created_at>=$${params.length}::timestamptz`);}
    if(query.toDate){params.push(String(query.toDate));where.push(`s.created_at<=$${params.length}::timestamptz`);}
    if(query.search){params.push(`%${String(query.search).trim().toLowerCase().slice(0,120)}%`);where.push(`(lower(COALESCE(s.preferred_nick,'')) LIKE $${params.length} OR s.email_normalized LIKE $${params.length})`);}
    if(query.source){params.push(String(query.source).trim().toLowerCase());where.push(`EXISTS(SELECT 1 FROM newsletter_subscriber_sources ss2 JOIN newsletter_sources ns2 ON ns2.id=ss2.source_id WHERE ss2.subscriber_id=s.id AND ns2.code=$${params.length})`);}
    const clause=where.length?`WHERE ${where.join(" AND ")}`:"";
    const count=await this.pool.query(`SELECT COUNT(*)::int AS count FROM gracz_newsletter_subscribers s ${clause}`,params);
    const limitParam=params.length+1, offsetParam=params.length+2;
    const { rows } = await this.pool.query(`SELECT s.id,s.email,s.preferred_nick,s.status,s.created_at,s.confirmed_at,s.unsubscribed_at,
      (SELECT ns.code FROM newsletter_subscriber_sources ss JOIN newsletter_sources ns ON ns.id=ss.source_id WHERE ss.subscriber_id=s.id ORDER BY ss.first_seen_at ASC LIMIT 1) AS source_code,
      (SELECT e.event_type FROM newsletter_events e WHERE e.subscriber_id=s.id ORDER BY e.occurred_at DESC LIMIT 1) AS last_event_type,
      (SELECT e.occurred_at FROM newsletter_events e WHERE e.subscriber_id=s.id ORDER BY e.occurred_at DESC LIMIT 1) AS last_event_at
      FROM gracz_newsletter_subscribers s ${clause}
      ORDER BY s.created_at DESC,s.id DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,[...params,pageSize,offset]);
    return {page,pageSize,total:Number(count.rows[0]?.count||0),items:rows.map(mapSubscriberRow)};
  }

  async subscriber(id) {
    await this.#requirePool(); const subscriberId=toId(id);
    const { rows }=await this.pool.query(`SELECT id,email,preferred_nick,status,consent_version,consented_at,created_at,confirmed_at,unsubscribed_at,updated_at FROM gracz_newsletter_subscribers WHERE id=$1`,[subscriberId]);
    if(!rows[0])throw notFound();
    const [sources,consents,events]=await Promise.all([
      this.pool.query(`SELECT ns.code,ns.name,ss.first_seen_at,ss.campaign_reference,ss.partner_reference FROM newsletter_subscriber_sources ss JOIN newsletter_sources ns ON ns.id=ss.source_id WHERE ss.subscriber_id=$1 ORDER BY ss.first_seen_at ASC`,[subscriberId]),
      this.pool.query(`SELECT consent_type,consent_version,action,source,occurred_at FROM newsletter_consent_history WHERE subscriber_id=$1 ORDER BY occurred_at DESC LIMIT 200`,[subscriberId]),
      this.pool.query(`SELECT e.id,e.event_type,e.occurred_at,ns.code AS source_code,e.metadata FROM newsletter_events e LEFT JOIN newsletter_sources ns ON ns.id=e.source_id WHERE e.subscriber_id=$1 ORDER BY e.occurred_at DESC LIMIT 200`,[subscriberId]),
    ]);
    return {subscriber:mapSubscriberRow(rows[0]),sources:sources.rows.map(x=>({code:x.code,name:x.name,firstSeenAt:x.first_seen_at,campaignReference:x.campaign_reference,partnerReference:x.partner_reference})),consentHistory:consents.rows.map(x=>({consentType:x.consent_type,consentVersion:x.consent_version,action:x.action,source:x.source,occurredAt:x.occurred_at})),events:events.rows.map(x=>({id:x.id,eventType:x.event_type,occurredAt:x.occurred_at,sourceCode:x.source_code||null,metadata:safeMetadata(x.metadata)}))};
  }

  async revealEmail(id) {
    await this.#requirePool(); const subscriberId=toId(id);
    const { rows }=await this.pool.query(`SELECT email FROM gracz_newsletter_subscribers WHERE id=$1`,[subscriberId]);
    if(!rows[0])throw notFound(); return {email:rows[0].email};
  }

  async stats({fromDate=null,toDate=null,groupBy="day"}={}) {
    await this.#requirePool(); const allowed=new Set(["day","hour","source","eventType"]); if(!allowed.has(groupBy))throw badRequest("Nieprawidłowe grupowanie.");
    const params=[];const where=[];
    if(fromDate){params.push(String(fromDate));where.push(`e.occurred_at>=$${params.length}::timestamptz`);} if(toDate){params.push(String(toDate));where.push(`e.occurred_at<=$${params.length}::timestamptz`);} const clause=where.length?`WHERE ${where.join(" AND ")}`:"";
    let sql;
    if(groupBy==="source")sql=`SELECT COALESCE(ns.code,'unknown') AS key,COUNT(*)::int AS count FROM newsletter_events e LEFT JOIN newsletter_sources ns ON ns.id=e.source_id ${clause} GROUP BY 1 ORDER BY 2 DESC`;
    else if(groupBy==="eventType")sql=`SELECT e.event_type AS key,COUNT(*)::int AS count FROM newsletter_events e ${clause} GROUP BY 1 ORDER BY 2 DESC`;
    else sql=`SELECT date_trunc('${groupBy}',e.occurred_at) AS key,COUNT(*)::int AS count FROM newsletter_events e ${clause} GROUP BY 1 ORDER BY 1 ASC`;
    const { rows }=await this.pool.query(sql,params);return {groupBy,items:rows.map(x=>({key:x.key,count:Number(x.count||0)}))};
  }

  async securityEvents({limit=100}={}) {
    await this.#requirePool(); const size=Math.min(200,Math.max(1,toInt(limit,100)));
    const { rows }=await this.pool.query(`SELECT e.id,e.event_type,e.occurred_at,ns.code AS source_code,e.metadata FROM newsletter_events e LEFT JOIN newsletter_sources ns ON ns.id=e.source_id WHERE e.event_type LIKE 'security.%' ORDER BY e.occurred_at DESC LIMIT $1`,[size]);
    return {items:rows.map(x=>({id:x.id,eventType:x.event_type,occurredAt:x.occurred_at,sourceCode:x.source_code||null,metadata:safeMetadata(x.metadata)}))};
  }

  async recordEvent({subscriberId=null,eventType,sourceCode="homepage",sourceHash=null,userAgentHash=null,metadata={}}={}) {
    await this.#requirePool(); const type=String(eventType||"").trim(); if(!type||type.length>64)throw badRequest("Nieprawidłowy typ zdarzenia.");
    const source=await this.pool.query(`SELECT id FROM newsletter_sources WHERE code=$1`,[String(sourceCode||"homepage").toLowerCase()]); const sourceId=source.rows[0]?.id||null;
    await this.pool.query(`INSERT INTO newsletter_events(subscriber_id,event_type,source_id,source_hash,user_agent_hash,metadata) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[subscriberId?toId(subscriberId):null,type,sourceId,validHash(sourceHash),validHash(userAgentHash),JSON.stringify(safeMetadata(metadata))]);
  }

  async close(){if(this.pool)await this.pool.end();}
  async #requirePool(){await this.ready;if(!this.pool)throw Object.assign(new Error("Newsletter admin wymaga PostgreSQL."),{code:"DATABASE_REQUIRED",status:503});}
}

export function maskEmail(value){const email=String(value||"").trim().toLowerCase();const at=email.lastIndexOf("@");if(at<1)return "***";const local=email.slice(0,at),domain=email.slice(at+1);return `${local.slice(0,2)}***@${domain}`;}
function mapSubscriberRow(row){return{id:Number(row.id),maskedEmail:maskEmail(row.email),nick:row.preferred_nick||null,status:row.status,consentVersion:row.consent_version||null,consentedAt:row.consented_at||null,createdAt:row.created_at,confirmedAt:row.confirmed_at||null,unsubscribedAt:row.unsubscribed_at||null,updatedAt:row.updated_at||null,sourceCode:row.source_code||null,lastEventType:row.last_event_type||null,lastEventAt:row.last_event_at||null};}
function safeMetadata(value){if(!value||typeof value!=="object"||Array.isArray(value))return{};const out={};for(const[k,v]of Object.entries(value)){if(/email|token|secret|password|authorization|cookie|ip|user.?agent/i.test(k))continue;if(["string","number","boolean"].includes(typeof v)||v===null)out[k]=typeof v==="string"?v.slice(0,300):v;}return out;}
function validHash(value){const text=String(value||"").trim().toLowerCase();return /^[a-f0-9]{64}$/.test(text)?text:null;}
function toInt(value,fallback){const n=Number.parseInt(String(value??""),10);return Number.isFinite(n)?n:fallback;}
function toId(value){const n=Number.parseInt(String(value??""),10);if(!Number.isSafeInteger(n)||n<1)throw badRequest("Nieprawidłowy identyfikator.");return n;}
function notFound(){return Object.assign(new Error("Nie znaleziono subskrybenta."),{code:"NOT_FOUND",status:404});}
function badRequest(message){return Object.assign(new Error(message),{code:"INVALID_REQUEST",status:400});}

export { SOURCE_TYPES, CONSENT_ACTIONS };

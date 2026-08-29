import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
const { Pool } = pg;

const SECRET_KEYS = /password|token|secret|authorization|cookie|body|message|content|api[-_]?key/i;

export class AuditService {
  constructor(databaseUrl = null, { hashSalt = process.env.AUDIT_HASH_SALT || process.env.AUTH_SECRET || "" } = {}) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false }, max: 2 }) : null;
    this.memory = [];
    this.hashSalt = String(hashSalt);
    this.ready = this.pool ? this.initialize() : Promise.resolve();
  }

  async initialize() {
    await this.pool.query(`SELECT event_id,occurred_at,actor_id,event_type,outcome,target_type,target_id,source_hash,user_agent_hash,metadata FROM gracz_audit_log LIMIT 0`);
  }

  fingerprint(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    return createHash("sha256").update(`${this.hashSalt}:${text}`).digest("hex");
  }

  sanitizeMetadata(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const clean = {};
    for (const [key, value] of Object.entries(input)) {
      if (SECRET_KEYS.test(key)) continue;
      if (["string", "number", "boolean"].includes(typeof value) || value === null) clean[key] = typeof value === "string" ? value.slice(0, 300) : value;
    }
    return clean;
  }

  async record({ actorId = null, eventType, outcome = "success", targetType = null, targetId = null, source = null, userAgent = null, metadata = {} }) {
    const event = {
      eventId: randomUUID(), actorId: actorId ? String(actorId).slice(0, 128) : null,
      eventType: String(eventType || "unknown").slice(0, 96), outcome: String(outcome || "unknown").slice(0, 24),
      targetType: targetType ? String(targetType).slice(0, 64) : null, targetId: targetId ? String(targetId).slice(0, 128) : null,
      sourceHash: this.fingerprint(source), userAgentHash: this.fingerprint(userAgent), metadata: this.sanitizeMetadata(metadata),
    };
    if (!this.pool) { this.memory.push({ ...event, occurredAt: new Date().toISOString() }); if (this.memory.length > 5000) this.memory.shift(); return event; }
    await this.ready;
    await this.pool.query(`INSERT INTO gracz_audit_log(event_id,actor_id,event_type,outcome,target_type,target_id,source_hash,user_agent_hash,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [event.eventId,event.actorId,event.eventType,event.outcome,event.targetType,event.targetId,event.sourceHash,event.userAgentHash,JSON.stringify(event.metadata)]);
    return event;
  }

  async close() { if (this.pool) await this.pool.end(); }
}

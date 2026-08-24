import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
const { Pool } = pg;

const SECRET_KEYS = /password|token|secret|authorization|cookie|body|message|content|api[-_]?key/i;
const AUDIT_TABLE = "gracz_audit_log";
const REQUIRED_COLUMNS = [
  "event_id",
  "occurred_at",
  "actor_id",
  "event_type",
  "outcome",
  "target_type",
  "target_id",
  "source_hash",
  "user_agent_hash",
  "metadata",
];

export class AuditService {
  constructor(databaseUrl = null, { hashSalt = process.env.AUDIT_HASH_SALT || process.env.AUTH_SECRET || "" } = {}) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false }, max: 2 }) : null;
    this.memory = [];
    this.hashSalt = String(hashSalt);
    this.ready = this.pool ? this.initialize() : Promise.resolve();
  }

  async tableColumns(tableName) {
    const result = await this.pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1`,
      [tableName],
    );
    return new Set(result.rows.map((row) => row.column_name));
  }

  async ensureCompatibleAuditTable() {
    const columns = await this.tableColumns(AUDIT_TABLE);
    if (columns.size === 0) return;

    const missing = REQUIRED_COLUMNS.filter((column) => !columns.has(column));
    if (missing.length === 0) return;

    // A legacy audit table can have a different primary key / timestamp layout.
    // Preserve it intact instead of attempting a risky in-place conversion that can
    // fail on existing rows (for example when adding a new UUID primary key).
    const legacyName = `${AUDIT_TABLE}_legacy_${Date.now()}`;
    await this.pool.query(`ALTER TABLE ${AUDIT_TABLE} RENAME TO ${legacyName}`);
    console.warn(`[audit] legacy schema preserved as ${legacyName}; missing columns: ${missing.join(", ")}`);
  }

  async initialize() {
    await this.ensureCompatibleAuditTable();

    await this.pool.query(`CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE}(
      event_id UUID PRIMARY KEY,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor_id VARCHAR(128),
      event_type VARCHAR(96) NOT NULL,
      outcome VARCHAR(24) NOT NULL,
      target_type VARCHAR(64),
      target_id VARCHAR(128),
      source_hash CHAR(64),
      user_agent_hash CHAR(64),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_audit_log_time_idx ON ${AUDIT_TABLE}(occurred_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_audit_log_actor_idx ON ${AUDIT_TABLE}(actor_id,occurred_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_audit_log_type_idx ON ${AUDIT_TABLE}(event_type,occurred_at DESC)`);
    await this.pool.query(`
      CREATE OR REPLACE FUNCTION gracz_audit_log_immutable() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'gracz_audit_log is append-only';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await this.pool.query(`DROP TRIGGER IF EXISTS gracz_audit_log_block_mutation ON ${AUDIT_TABLE}`);
    await this.pool.query(`CREATE TRIGGER gracz_audit_log_block_mutation BEFORE UPDATE OR DELETE ON ${AUDIT_TABLE} FOR EACH ROW EXECUTE FUNCTION gracz_audit_log_immutable()`);
    await this.pool.query(`REVOKE UPDATE, DELETE, TRUNCATE ON ${AUDIT_TABLE} FROM PUBLIC`).catch(() => {});
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
    await this.pool.query(`INSERT INTO ${AUDIT_TABLE}(event_id,actor_id,event_type,outcome,target_type,target_id,source_hash,user_agent_hash,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, [event.eventId,event.actorId,event.eventType,event.outcome,event.targetType,event.targetId,event.sourceHash,event.userAgentHash,JSON.stringify(event.metadata)]);
    return event;
  }

  async close() { if (this.pool) await this.pool.end(); }
}

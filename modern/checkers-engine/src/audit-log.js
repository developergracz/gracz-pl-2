import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

export class AuditLogService {
  constructor(connectionString = null) {
    this.pool = connectionString ? new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
      max: 2,
    }) : null;
    this.ready = this.pool ? this.#initialize() : Promise.resolve();
  }

  async #initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_audit_log (
        audit_id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        event_type VARCHAR(64) NOT NULL,
        actor_user_id VARCHAR(32),
        source_hash CHAR(64),
        user_agent_hash CHAR(64),
        request_method VARCHAR(10),
        request_path VARCHAR(200),
        response_status SMALLINT,
        success BOOLEAN NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_audit_created_idx ON gracz_audit_log(created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_audit_actor_idx ON gracz_audit_log(actor_user_id,created_at DESC)`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_audit_event_idx ON gracz_audit_log(event_type,created_at DESC)`);
  }

  async record({ eventType, actorUserId = null, source = null, userAgent = null, method = null, path = null, status = null, success = true, details = {} }) {
    await this.ready;
    if (!this.pool) return;
    const safeDetails = sanitizeDetails(details);
    await this.pool.query(
      `INSERT INTO gracz_audit_log(audit_id,event_type,actor_user_id,source_hash,user_agent_hash,request_method,request_path,response_status,success,details)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        randomUUID(),
        String(eventType || "unknown").slice(0,64),
        actorUserId ? String(actorUserId).slice(0,32) : null,
        source ? sha256(source) : null,
        userAgent ? sha256(userAgent) : null,
        method ? String(method).slice(0,10) : null,
        path ? String(path).split("?")[0].slice(0,200) : null,
        Number.isInteger(status) ? status : null,
        Boolean(success),
        JSON.stringify(safeDetails),
      ],
    );
  }

  async close() { if (this.pool) await this.pool.end(); }
}

export function attachRequestAudit({ request, response, audit, source = null }) {
  if (!audit) return;
  const startedAt = Date.now();
  response.once("finish", () => {
    const url = new URL(request.url, "http://localhost");
    const eventType = classifyEvent(request.method, url.pathname, response.statusCode);
    if (!eventType) return;
    void audit.record({
      eventType,
      source,
      userAgent: request.headers["user-agent"] || null,
      method: request.method,
      path: url.pathname,
      status: response.statusCode,
      success: response.statusCode < 400,
      details: { durationMs: Math.max(0, Date.now() - startedAt) },
    }).catch(() => {});
  });
}

function classifyEvent(method, path, status) {
  if (path === "/auth/login") return status < 400 ? "auth.login.success" : "auth.login.failure";
  if (path === "/auth/logout") return "auth.logout";
  if (path === "/auth/register") return status < 400 ? "auth.register.success" : "auth.register.failure";
  if (path === "/auth/reset-password") return status < 400 ? "auth.password_reset.success" : "auth.password_reset.failure";
  if (path === "/account/profile" && ["PUT","PATCH"].includes(method)) return status < 400 ? "account.profile.changed" : "account.profile.change_failed";
  if (path.startsWith("/messages") && method === "POST") return status < 400 ? "message.created" : "message.create_failed";
  if (path.includes("/attachment") && method === "POST") return status < 400 ? "attachment.created" : "attachment.create_failed";
  if (status === 401 || status === 403 || status === 429) return `security.http_${status}`;
  return null;
}

function sanitizeDetails(value) {
  if (!value || typeof value !== "object") return {};
  const blocked = /(password|token|secret|authorization|cookie|email|phone|message|content|body)/i;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (blocked.test(key)) continue;
    if (["string","number","boolean"].includes(typeof item) || item === null) out[key] = typeof item === "string" ? item.slice(0,200) : item;
  }
  return out;
}
function sha256(value) { return createHash("sha256").update(String(value), "utf8").digest("hex"); }

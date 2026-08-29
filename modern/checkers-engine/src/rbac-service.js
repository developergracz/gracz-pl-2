import pg from "pg";
const { Pool } = pg;

export const ROLES = Object.freeze(["player", "moderator", "administrator", "owner"]);
const LEVEL = Object.freeze({ player: 0, moderator: 10, administrator: 20, owner: 30 });
const PERMISSIONS = Object.freeze({
  player: new Set(["game.play", "profile.manage", "message.send", "chat.use"]),
  moderator: new Set(["game.play", "profile.manage", "message.send", "chat.use", "moderation.review", "moderation.warn", "moderation.ban", "newsletter.read", "newsletter.security.read"]),
  administrator: new Set(["game.play", "profile.manage", "message.send", "chat.use", "moderation.review", "moderation.warn", "moderation.ban", "admin.users", "admin.audit", "admin.settings", "newsletter.read", "newsletter.manage", "newsletter.email.reveal", "newsletter.security.read"]),
  owner: new Set(["*"]),
});

export class RbacError extends Error {
  constructor(message = "Brak uprawnień.") { super(message); this.name = "RbacError"; this.code = "FORBIDDEN"; this.status = 403; }
}

export class RbacService {
  constructor(databaseUrl = null, { audit = null } = {}) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false }, max: 2 }) : null;
    this.memory = new Map(); this.audit = audit; this.ready = this.pool ? this.initialize() : Promise.resolve();
  }
  async initialize() {
    await this.pool.query(`SELECT user_id,role,mfa_required,updated_at FROM gracz_roles LIMIT 0`);
    await this.pool.query(`SELECT change_id,user_id,old_role,new_role,changed_by,changed_at FROM gracz_role_history LIMIT 0`);
    const bootstrap = String(process.env.GRACZ_OWNER_USER_ID || "").trim().toLowerCase();
    if (bootstrap && /^[a-z0-9._-]{3,32}$/.test(bootstrap)) {
      const result = await this.pool.query(`INSERT INTO gracz_roles(user_id,role,mfa_required,updated_at)
        SELECT $1,'owner',TRUE,NOW()
        WHERE EXISTS(SELECT 1 FROM gracz_accounts WHERE user_id=$1)
          AND NOT EXISTS(SELECT 1 FROM gracz_roles WHERE role='owner')
        ON CONFLICT(user_id) DO NOTHING
        RETURNING user_id`, [bootstrap]);
      if (result.rows[0]) await this.audit?.record({ actorId: bootstrap, eventType: "owner.bootstrap", outcome: "success", targetType: "account", targetId: bootstrap });
    }
  }
  normalize(role) { return ROLES.includes(role) ? role : "player"; }
  async getRole(userId) {
    const id = String(userId || "").toLowerCase(); if (!id) return "player";
    if (!this.pool) return this.memory.get(id) || "player";
    await this.ready; const { rows } = await this.pool.query(`SELECT role FROM gracz_roles WHERE user_id=$1`, [id]); return this.normalize(rows[0]?.role);
  }
  async can(userId, permission) { const role = await this.getRole(userId); return PERMISSIONS[role].has("*") || PERMISSIONS[role].has(permission); }
  async require(userId, permission) { if (!await this.can(userId, permission)) throw new RbacError(); return true; }
  requiresMfa(role) { return LEVEL[this.normalize(role)] >= LEVEL.moderator; }
  async setRole({ actorId, targetId, role, actorMfaVerified = false }) {
    const next = this.normalize(role); if (next !== role) throw new RbacError("Nieprawidłowa rola.");
    const actorRole = await this.getRole(actorId); const oldRole = await this.getRole(targetId);
    if (LEVEL[actorRole] < LEVEL.administrator) throw new RbacError();
    if (LEVEL[oldRole] >= LEVEL[actorRole] && actorId !== targetId) throw new RbacError("Nie możesz zmienić roli konta o równych lub wyższych uprawnieniach.");
    if (next === "owner" && actorRole !== "owner") throw new RbacError("Tylko właściciel może nadać rolę owner.");
    if (LEVEL[next] >= LEVEL.moderator && !actorMfaVerified) throw new RbacError("Zmiana uprzywilejowanej roli wymaga MFA.");
    const id = String(targetId).toLowerCase();
    if (!this.pool) this.memory.set(id, next); else {
      await this.ready; const client = await this.pool.connect(); try { await client.query("BEGIN"); await client.query(`INSERT INTO gracz_roles(user_id,role,mfa_required,updated_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role,mfa_required=EXCLUDED.mfa_required,updated_at=NOW()`, [id,next,this.requiresMfa(next)]); await client.query(`INSERT INTO gracz_role_history(user_id,old_role,new_role,changed_by) VALUES($1,$2,$3,$4)`, [id,oldRole,next,String(actorId).toLowerCase()]); await client.query("COMMIT"); } catch (e) { await client.query("ROLLBACK").catch(()=>{}); throw e; } finally { client.release(); }
    }
    await this.audit?.record({ actorId, eventType:"role.changed", targetType:"account", targetId:id, metadata:{ oldRole, newRole:next } }); return { userId:id, role:next, mfaRequired:this.requiresMfa(next) };
  }
  async close() { if (this.pool) await this.pool.end(); }
}

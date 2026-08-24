import pg from "pg";

const { Pool } = pg;
const ROLES = new Set(["player", "moderator", "administrator", "owner"]);
const RANK = Object.freeze({ player: 0, moderator: 10, administrator: 20, owner: 30 });

export class AccessControlService {
  constructor(connectionString = null) {
    this.pool = connectionString ? new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
      max: 2,
    }) : null;
    this.ready = this.pool ? this.#initialize() : Promise.resolve();
  }

  async #initialize() {
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS account_role VARCHAR(20) NOT NULL DEFAULT 'player'`);
    await this.pool.query(`ALTER TABLE gracz_accounts ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE`);
    await this.pool.query(`UPDATE gracz_accounts SET account_role='player' WHERE account_role NOT IN ('player','moderator','administrator','owner')`);
    await this.pool.query(`UPDATE gracz_accounts SET mfa_required=TRUE WHERE account_role IN ('moderator','administrator','owner')`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS gracz_role_changes (
        change_id BIGSERIAL PRIMARY KEY,
        target_user_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
        previous_role VARCHAR(20) NOT NULL,
        new_role VARCHAR(20) NOT NULL,
        changed_by VARCHAR(32) NOT NULL,
        reason VARCHAR(300),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS gracz_role_changes_target_idx ON gracz_role_changes(target_user_id,created_at DESC)`);
  }

  async getRole(userId) {
    await this.ready;
    if (!this.pool) return "player";
    const { rows } = await this.pool.query(`SELECT account_role FROM gracz_accounts WHERE user_id=$1 LIMIT 1`, [normalizeUserId(userId)]);
    return ROLES.has(rows[0]?.account_role) ? rows[0].account_role : "player";
  }

  async assertRole(userId, minimumRole) {
    if (!ROLES.has(minimumRole)) throw new TypeError("Nieprawidłowa rola wymagana.");
    const role = await this.getRole(userId);
    if (RANK[role] < RANK[minimumRole]) {
      const error = new Error("Brak uprawnień do wykonania tej operacji.");
      error.code = "FORBIDDEN";
      error.status = 403;
      throw error;
    }
    return role;
  }

  async changeRole({ actorUserId, targetUserId, newRole, reason = "" }) {
    await this.ready;
    if (!this.pool) throw new Error("Zmiana ról wymaga bazy danych.");
    if (!ROLES.has(newRole)) throw new TypeError("Nieprawidłowa rola.");
    const actorRole = await this.getRole(actorUserId);
    if (RANK[actorRole] < RANK.administrator) throw forbidden();
    if (newRole === "owner" && actorRole !== "owner") throw forbidden();
    const target = normalizeUserId(targetUserId);
    const previousRole = await this.getRole(target);
    if (RANK[previousRole] >= RANK[actorRole] && actorRole !== "owner") throw forbidden();
    await this.pool.query("BEGIN");
    try {
      await this.pool.query(`UPDATE gracz_accounts SET account_role=$2,mfa_required=$3 WHERE user_id=$1`, [target, newRole, newRole !== "player"]);
      await this.pool.query(`INSERT INTO gracz_role_changes(target_user_id,previous_role,new_role,changed_by,reason) VALUES($1,$2,$3,$4,$5)`, [target, previousRole, newRole, normalizeUserId(actorUserId), String(reason || "").slice(0,300) || null]);
      await this.pool.query("COMMIT");
      return { userId: target, previousRole, newRole };
    } catch (error) {
      await this.pool.query("ROLLBACK").catch(() => {});
      throw error;
    }
  }

  async close() { if (this.pool) await this.pool.end(); }
}

function normalizeUserId(value) {
  const id = String(value || "").trim().toLowerCase();
  if (!id || id.length > 32) throw new TypeError("Nieprawidłowy identyfikator użytkownika.");
  return id;
}
function forbidden() { const error = new Error("Brak uprawnień do zmiany roli."); error.code = "FORBIDDEN"; error.status = 403; return error; }

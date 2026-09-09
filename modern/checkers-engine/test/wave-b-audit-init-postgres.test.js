import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { AuditService, initializeAuditSchema } from "../src/audit-service.js";

const { Pool } = pg;
const databaseUrl = process.env.WAVE_B_TEST_DATABASE_URL || process.env.P1_U_01_DATABASE_URL || process.env.P1_H_01_DATABASE_URL || null;
const options = { skip: !databaseUrl };

async function reset(pool) {
  await pool.query("DROP TABLE IF EXISTS gracz_audit_log CASCADE");
  await pool.query("DROP FUNCTION IF EXISTS gracz_audit_log_immutable() CASCADE");
}

async function assertSchema(pool) {
  const table = await pool.query("SELECT to_regclass('gracz_audit_log') AS name");
  assert.equal(table.rows[0].name, "gracz_audit_log");
  const indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename='gracz_audit_log' ORDER BY indexname");
  const names = indexes.rows.map((row) => row.indexname);
  assert.ok(names.includes("gracz_audit_log_pkey"));
  assert.ok(names.includes("gracz_audit_log_time_idx"));
  assert.ok(names.includes("gracz_audit_log_actor_idx"));
  assert.ok(names.includes("gracz_audit_log_type_idx"));
  const trigger = await pool.query("SELECT count(*)::int AS count FROM pg_trigger WHERE tgrelid='gracz_audit_log'::regclass AND tgname='gracz_audit_log_block_mutation' AND NOT tgisinternal");
  assert.equal(trigger.rows[0].count, 1);
}

async function concurrentInitializers(count) {
  const services = Array.from({ length: count }, () => new AuditService(databaseUrl));
  try {
    await Promise.all(services.map((service) => service.ready));
  } finally {
    await Promise.allSettled(services.map((service) => service.close()));
  }
}

test("AuditService initializes safely with 2 concurrent PostgreSQL processes", options, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  try { await reset(pool); await concurrentInitializers(2); await assertSchema(pool); }
  finally { await reset(pool); await pool.end(); }
});

test("AuditService initializes safely with 4 concurrent PostgreSQL processes", options, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 6 });
  try { await reset(pool); await concurrentInitializers(4); await assertSchema(pool); }
  finally { await reset(pool); await pool.end(); }
});

test("AuditService repeated concurrent initialization remains idempotent", options, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 6 });
  try {
    await reset(pool);
    for (let round = 0; round < 3; round += 1) await concurrentInitializers(4);
    await assertSchema(pool);
  } finally { await reset(pool); await pool.end(); }
});

test("AuditService schema transaction rolls back all new DDL on initialization failure", options, async () => {
  const observer = new Pool({ connectionString: databaseUrl, max: 2 });
  const backing = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    await reset(observer);
    const proxyPool = {
      async connect() {
        const client = await backing.connect();
        let ddl = 0;
        return {
          async query(text, params) {
            const sql = String(text);
            if (/^CREATE (TABLE|INDEX|OR REPLACE FUNCTION|TRIGGER)/m.test(sql.trim())) ddl += 1;
            if (ddl === 3) throw Object.assign(new Error("forced schema initialization failure"), { code: "WB_TEST_FORCED_DDL_FAILURE" });
            return client.query(text, params);
          },
          release() { client.release(); },
        };
      },
    };
    await assert.rejects(() => initializeAuditSchema(proxyPool), /forced schema initialization failure/);
    const table = await observer.query("SELECT to_regclass('gracz_audit_log') AS table_name, to_regclass('gracz_audit_log_time_idx') AS time_idx");
    assert.equal(table.rows[0].table_name, null);
    assert.equal(table.rows[0].time_idx, null);
  } finally {
    await reset(observer);
    await observer.end();
    await backing.end();
  }
});

await import("./wave-b-b1-c13-metric-accounting.test.js");
await import("./wave-b-b1-c14-per-game-write-counters.test.js");
await import("./wave-b-b1-c14-control.test.js");

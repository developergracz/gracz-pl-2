import pg from "pg";
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || "";
if (!connectionString) process.exit(0);

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false },
  max: 1,
});

try {
  const tableCheck = await pool.query(`
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = 'gracz_newsletter_subscribers'
  `);

  if (!tableCheck.rowCount) {
    console.log("[newsletter-repair] newsletter table not created yet; nothing to repair");
    process.exit(0);
  }

  const columns = await pool.query(`
    SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'gracz_newsletter_subscribers'
  `);
  const byName = new Map(columns.rows.map((row) => [row.column_name, row]));

  // Legacy versions used subscriber_id as a required key. Newer code uses id.
  // Preserve all legacy data and make subscriber_id self-generating according
  // to its real PostgreSQL type so new inserts do not violate NOT NULL.
  const legacy = byName.get("subscriber_id");
  if (legacy) {
    const type = String(legacy.udt_name || legacy.data_type || "").toLowerCase();
    console.log(`[newsletter-repair] legacy subscriber_id type: ${type}`);

    if (["int2", "int4", "int8", "smallint", "integer", "bigint"].includes(type)) {
      await pool.query(`CREATE SEQUENCE IF NOT EXISTS gracz_newsletter_subscriber_id_seq`);

      if (byName.has("id")) {
        await pool.query(`
          UPDATE gracz_newsletter_subscribers
             SET subscriber_id = id
           WHERE subscriber_id IS NULL
             AND id IS NOT NULL
        `);
      }

      const maxResult = await pool.query(`
        SELECT GREATEST(
          COALESCE(MAX(subscriber_id)::bigint, 0),
          ${byName.has("id") ? "COALESCE(MAX(id)::bigint, 0)" : "0"}
        ) AS max_value
        FROM gracz_newsletter_subscribers
      `);
      const maxValue = Number(maxResult.rows[0]?.max_value || 0);
      if (maxValue > 0) {
        await pool.query(`SELECT setval('gracz_newsletter_subscriber_id_seq', $1, true)`, [maxValue]);
      } else {
        await pool.query(`SELECT setval('gracz_newsletter_subscriber_id_seq', 1, false)`);
      }

      await pool.query(`
        ALTER TABLE gracz_newsletter_subscribers
        ALTER COLUMN subscriber_id SET DEFAULT nextval('gracz_newsletter_subscriber_id_seq')
      `);
      await pool.query(`
        ALTER SEQUENCE gracz_newsletter_subscriber_id_seq
        OWNED BY gracz_newsletter_subscribers.subscriber_id
      `);
      console.log("[newsletter-repair] numeric subscriber_id compatibility enabled");
    } else if (type === "uuid") {
      // md5 returns 32 hexadecimal characters, a format PostgreSQL accepts as UUID.
      await pool.query(`
        ALTER TABLE gracz_newsletter_subscribers
        ALTER COLUMN subscriber_id SET DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid)
      `);
      console.log("[newsletter-repair] UUID subscriber_id compatibility enabled");
    } else if (["text", "varchar", "bpchar", "character varying", "character"].includes(type)) {
      await pool.query(`
        ALTER TABLE gracz_newsletter_subscribers
        ALTER COLUMN subscriber_id SET DEFAULT md5(random()::text || clock_timestamp()::text)
      `);
      console.log("[newsletter-repair] text subscriber_id compatibility enabled");
    } else {
      // Unknown legacy type: do not fail deployment. Report it clearly so the
      // schema can be handled explicitly instead of taking the public site down.
      console.error(`[newsletter-repair] unsupported subscriber_id type: ${type}`);
    }
  }

  const stale = await pool.query(`
    UPDATE gracz_newsletter_subscribers
       SET confirmation_sent_at = NULL,
           updated_at = NOW()
     WHERE status = 'pending_confirmation'
       AND confirmed_at IS NULL
       AND confirmation_sent_at IS NOT NULL
  `);
  console.log(`[newsletter-repair] cleared stale confirmation timestamps: ${stale.rowCount}`);
} catch (error) {
  console.error("[newsletter-repair] failed", error?.code || error?.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

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
    SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'gracz_newsletter_subscribers'
  `);
  const byName = new Map(columns.rows.map((row) => [row.column_name, row]));

  // Legacy versions used subscriber_id as a required key. Newer code uses id.
  // Keep both columns compatible without deleting or rewriting existing records.
  if (byName.has("subscriber_id")) {
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
        COALESCE(MAX(subscriber_id), 0),
        ${byName.has("id") ? "COALESCE(MAX(id), 0)" : "0"}
      )::bigint AS max_value
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
    console.log("[newsletter-repair] legacy subscriber_id compatibility enabled");
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

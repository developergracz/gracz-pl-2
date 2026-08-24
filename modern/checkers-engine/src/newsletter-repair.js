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
  const result = await pool.query(`
    UPDATE gracz_newsletter_subscribers
       SET confirmation_sent_at = NULL,
           updated_at = NOW()
     WHERE status = 'pending_confirmation'
       AND confirmed_at IS NULL
       AND confirmation_sent_at IS NOT NULL
  `);
  console.log(`[newsletter-repair] cleared stale confirmation timestamps: ${result.rowCount}`);
} catch (error) {
  if (error?.code === "42P01") {
    console.log("[newsletter-repair] newsletter table not created yet; nothing to repair");
  } else {
    console.error("[newsletter-repair] failed", error?.code || error?.message);
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}

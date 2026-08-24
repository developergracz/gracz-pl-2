import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

export async function hardenNewsletterTokens(service) {
  if (!service?.pool) return service;
  const pool = service.pool;

  await pool.query(`ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token_hash BYTEA`);
  await pool.query(`ALTER TABLE gracz_newsletter_subscribers ALTER COLUMN unsubscribe_token DROP NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_token_hash_unique ON gracz_newsletter_subscribers (unsubscribe_token_hash) WHERE unsubscribe_token_hash IS NOT NULL`);

  const legacy = await pool.query(`SELECT subscriber_id,unsubscribe_token::text AS token FROM gracz_newsletter_subscribers WHERE unsubscribe_token_hash IS NULL AND unsubscribe_token IS NOT NULL`);
  for (const row of legacy.rows) {
    await pool.query(`UPDATE gracz_newsletter_subscribers SET unsubscribe_token_hash=$2,unsubscribe_token=NULL WHERE subscriber_id=$1`, [row.subscriber_id, hashToken(row.token)]);
  }

  service.getSubscriberStatus = async (token) => {
    await service.ready;
    const rawToken = String(token || "");
    const tokenHash = hashToken(rawToken);
    const result = await pool.query(`
      SELECT s.subscriber_id,s.email,s.preferred_nick,s.status,s.created_at,
        (SELECT COUNT(*)::int FROM gracz_newsletter_subscribers x WHERE x.status='active') AS total_active,
        (SELECT COUNT(*)::int FROM gracz_newsletter_subscribers x
          WHERE x.status='active' AND (x.created_at < s.created_at OR (x.created_at = s.created_at AND x.subscriber_id::text <= s.subscriber_id::text))) AS position
      FROM gracz_newsletter_subscribers s
      WHERE s.unsubscribe_token_hash=$1 OR s.unsubscribe_token::text=$2
      LIMIT 1
    `, [tokenHash, rawToken]);
    return result.rows[0] || null;
  };

  service.unsubscribe = async (token) => {
    await service.ready;
    const rawToken = String(token || "");
    const result = await pool.query(
      `UPDATE gracz_newsletter_subscribers SET status='unsubscribed',updated_at=NOW()
       WHERE unsubscribe_token_hash=$1 OR unsubscribe_token::text=$2 RETURNING email`,
      [hashToken(rawToken), rawToken],
    );
    return Boolean(result.rows[0]);
  };

  const originalSubscribe = service.subscribe.bind(service);
  service.subscribe = async (input = {}) => {
    const email = String(input.email || "").trim().toLowerCase();
    if (email) {
      const existing = await pool.query(`SELECT subscriber_id,unsubscribe_token FROM gracz_newsletter_subscribers WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
      if (existing.rows[0] && !existing.rows[0].unsubscribe_token) {
        const freshToken = randomUUID();
        await pool.query(
          `UPDATE gracz_newsletter_subscribers SET unsubscribe_token=$2,unsubscribe_token_hash=$3,updated_at=NOW() WHERE subscriber_id=$1`,
          [existing.rows[0].subscriber_id, freshToken, hashToken(freshToken)],
        );
      }
    }

    const result = await originalSubscribe(input);
    if (email) {
      const row = await pool.query(`SELECT subscriber_id,unsubscribe_token::text AS token FROM gracz_newsletter_subscribers WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
      const token = row.rows[0]?.token;
      if (token) {
        await pool.query(`UPDATE gracz_newsletter_subscribers SET unsubscribe_token_hash=$2,unsubscribe_token=NULL,updated_at=NOW() WHERE subscriber_id=$1`, [row.rows[0].subscriber_id, hashToken(token)]);
      }
    }
    return result;
  };

  return service;
}

export function hashToken(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest();
}

export function constantTimeTokenEqual(a, b) {
  const left = hashToken(a), right = hashToken(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

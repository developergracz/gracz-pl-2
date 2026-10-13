export function createNewsletterOptInStore(database) {
  return {
    async checkOptInAvailable() { await database.query("SELECT 1 FROM newsletter_opt_in_requests LIMIT 0"); },
    async claimOptInRequest({ emailHash, requestId, issuedAt, expiresAt, supersededBefore }) {
      const result = await database.query(
        `INSERT INTO newsletter_opt_in_requests(email_hash, request_id, issued_at, expires_at)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz)
         ON CONFLICT (email_hash) DO UPDATE
         SET request_id = EXCLUDED.request_id, state = 'inflight',
             issued_at = EXCLUDED.issued_at, expires_at = EXCLUDED.expires_at, sent_at = NULL
         WHERE newsletter_opt_in_requests.state IN ('sent', 'legacy_pending')
           AND newsletter_opt_in_requests.issued_at < EXCLUDED.issued_at
           AND (newsletter_opt_in_requests.expires_at <= now()
                OR newsletter_opt_in_requests.issued_at <= $5::timestamptz)
         RETURNING state`,
        [emailHash, requestId, issuedAt, expiresAt, supersededBefore]
      );
      if (result.rowCount) return { claimed: true, state: 'inflight' };
      const current = await database.query(
        `SELECT state, (state = 'inflight' AND issued_at > now() - interval '5 minutes') AS in_progress
         FROM newsletter_opt_in_requests WHERE email_hash = $1`, [emailHash]
      );
      return { claimed: false, state: current.rows[0]?.state || 'unknown', inProgress: current.rows[0]?.in_progress === true };
    },
    async markOptInUnknown({ emailHash, requestId }) {
      await database.query(
        `UPDATE newsletter_opt_in_requests SET state = 'unknown'
         WHERE email_hash = $1 AND request_id = $2 AND state = 'inflight'`,
        [emailHash, requestId]
      );
    },
    async markOptInSent({ emailHash, requestId }) {
      const result = await database.query(
        `UPDATE newsletter_opt_in_requests SET state = 'sent', sent_at = now()
         WHERE email_hash = $1 AND request_id = $2 AND state = 'inflight' RETURNING request_id`,
        [emailHash, requestId]
      );
      return result.rowCount === 1;
    },
  };
}

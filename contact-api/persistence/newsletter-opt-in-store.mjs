export function createNewsletterOptInStore(database) {
  return {
    async checkOptInAvailable() {
      await database.query('SELECT email_hash, request_id, state, issued_at, expires_at, sent_at FROM newsletter_opt_in_requests LIMIT 0');
      const schema = await database.query(
        `SELECT column_default FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'newsletter_opt_in_requests' AND column_name = 'state'`);
      const checks = await database.query(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
         WHERE conrelid = 'newsletter_opt_in_requests'::regclass AND contype = 'c'`);
      const definitions = checks.rows.map(row => row.definition);
      if (!schema.rows[0]?.column_default?.includes("'pre_send'") ||
          !definitions.some(value => ['pre_send', 'inflight', 'unknown', 'sent', 'legacy_pending'].every(state => value.includes("'" + state + "'"))) ||
          !definitions.some(value => value.includes('sent_at IS NOT NULL')) ||
          !definitions.some(value => value.includes('expires_at > issued_at'))) {
        throw new Error('Newsletter candidate schema does not support fenced pre_send reservations');
      }
      return true;
    },
    async importHistoricalOptIns() {
      const result = await database.query(
        `INSERT INTO newsletter_opt_in_requests(email_hash, request_id, state, issued_at, expires_at)
         SELECT DISTINCT ON (email_hash) email_hash, event_id, 'legacy_pending', occurred_at, occurred_at + interval '30 days'
         FROM newsletter_consent_events WHERE event_type = 'opt_in_requested'
           AND occurred_at + interval '30 days' > now()
         ORDER BY email_hash, occurred_at DESC, event_id DESC
         ON CONFLICT DO NOTHING`);
      return result.rowCount;
    },
    async claimOptInRequest({ emailHash, requestId, issuedAt, expiresAt, supersededBefore }) {
      const result = await database.query(
        `INSERT INTO newsletter_opt_in_requests(email_hash, request_id, issued_at, expires_at)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz)
         ON CONFLICT (email_hash) DO UPDATE
         SET request_id = EXCLUDED.request_id, state = 'pre_send',
             issued_at = EXCLUDED.issued_at, expires_at = EXCLUDED.expires_at, sent_at = NULL
         WHERE newsletter_opt_in_requests.request_id <> EXCLUDED.request_id
           AND newsletter_opt_in_requests.issued_at < EXCLUDED.issued_at
           AND ((newsletter_opt_in_requests.state IN ('sent', 'legacy_pending')
                 AND (newsletter_opt_in_requests.expires_at <= now()
                      OR newsletter_opt_in_requests.issued_at <= $5::timestamptz))
                OR (newsletter_opt_in_requests.state = 'pre_send'
                    AND newsletter_opt_in_requests.issued_at < now() - interval '60 seconds'))
         RETURNING state`,
        [emailHash, requestId, issuedAt, expiresAt, supersededBefore]
      );
      if (result.rowCount) return { claimed: true, state: 'pre_send' };
      const current = await database.query(
        `SELECT state, (state IN ('pre_send', 'inflight') AND issued_at > now() - interval '5 minutes') AS in_progress
         FROM newsletter_opt_in_requests WHERE email_hash = $1`, [emailHash]
      );
      return { claimed: false, state: current.rows[0]?.state || 'unknown', inProgress: current.rows[0]?.in_progress === true };
    },
    async markOptInSending({ emailHash, requestId }) {
      const result = await database.query(
        `UPDATE newsletter_opt_in_requests SET state = 'inflight'
         WHERE email_hash = $1 AND request_id = $2 AND state = 'pre_send' RETURNING request_id`, [emailHash, requestId]);
      return result.rowCount === 1;
    },
    async releaseOptInBeforeSend({ emailHash, requestId }) {
      const result = await database.query(
        `DELETE FROM newsletter_opt_in_requests
         WHERE email_hash = $1 AND request_id = $2 AND state = 'pre_send' RETURNING request_id`, [emailHash, requestId]);
      return result.rowCount === 1;
    },
    async reconcileOptInFromConsent({ emailHash, requestId, eventId }) {
      const result = await database.query(
        `UPDATE newsletter_opt_in_requests r SET state = 'sent', sent_at = e.occurred_at
         FROM newsletter_consent_events e, newsletter_contacts c
         WHERE r.email_hash = $1 AND r.request_id = $2 AND r.state IN ('inflight', 'unknown')
           AND e.event_id = $3 AND e.email_hash = r.email_hash
           AND e.event_type IN ('opt_in_confirmed', 'resubscribe')
           AND e.metadata->'tokenIssuedAt' = to_jsonb((extract(epoch FROM r.issued_at) * 1000)::bigint)
           AND e.occurred_at >= r.issued_at
           AND c.email_hash = e.email_hash AND c.current_state = 'subscribed'
           AND c.provider_blocked_at IS NULL AND c.confirmed_at >= e.occurred_at
         RETURNING r.request_id`, [emailHash, requestId, eventId]);
      return result.rowCount === 1;
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

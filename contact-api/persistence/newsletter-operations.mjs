// Internal operator primitives only: never mounted as a public HTTP endpoint.
// Do not return identifiers, addresses, tokens, provider messages or hashes.
export function createNewsletterOperations(database) {
  return Object.freeze({
    async inspect() {
      const reservations=await database.query(`SELECT state, count(*)::int AS count,
        count(*) FILTER (WHERE issued_at < now()-interval '5 minutes')::int AS aged
        FROM newsletter_opt_in_requests GROUP BY state ORDER BY state`);
      const dispatches=await database.query(`SELECT scope,
        CASE WHEN response_body->>'phase' IN ('pre_effect','external_effect') THEN response_body->>'phase' ELSE 'legacy' END AS phase,
        count(*)::int AS count, count(*) FILTER (WHERE updated_at < now()-interval '5 minutes')::int AS aged
        FROM idempotency_keys WHERE state='inflight'
          AND scope IN ('newsletter-public-optin','newsletter-public-status','newsletter-status-dispatch')
        GROUP BY scope, phase ORDER BY scope, phase`);
      const uncertain=reservations.rows.reduce((n,row)=>n+(['unknown','inflight'].includes(row.state)?row.count:0),0);
      const aged=dispatches.rows.reduce((n,row)=>n+row.aged,0);
      return {reservations:reservations.rows,dispatches:dispatches.rows,alarms:{uncertain:uncertain>0,stalled:aged>0}};
    },
    // Explicit operator action only. Never collect unknown dispatches, B1 holds,
    // consent evidence or unexpired replay tombstones. No automatic scheduler.
    async purgeExpiredProofs() {
      const result=await database.query(`DELETE FROM idempotency_keys
        WHERE expires_at < now()-interval '24 hours' AND (
          scope IN ('newsletter-status-token','newsletter-status-budget-email','newsletter-status-budget-global')
          OR (state='done' AND scope IN ('newsletter-public-optin','newsletter-public-status','newsletter-status-dispatch')))
        RETURNING scope`);
      return {removed:result.rowCount};
    },
  });
}

// Diagnostic only. No SQL writes, no migrations, no secret or recipient logging.
// This module executes only when explicitly invoked by the business runtime.
export async function diagnoseF03ReadOnly(database, logger = console) {
  try {
    // queryBounded enforces BEGIN READ ONLY and an absolute I/O deadline.
    const tables = (await database.queryBounded(`
      SELECT
        current_database() = 'gracz_r4_staging_postgres' AS expected_db,
        to_regclass('public.newsletter_opt_in_requests') IS NOT NULL AS opt_in,
        to_regclass('public.newsletter_schema_migrations') IS NOT NULL AS f03_ledger,
        to_regclass('public.newsletter_contacts') IS NOT NULL AS contacts,
        to_regclass('public.newsletter_consent_events') IS NOT NULL AS events,
        to_regclass('public.idempotency_keys') IS NOT NULL AS idempotency,
        to_regclass('public.schema_migrations') IS NOT NULL AS baseline
    `,[],{timeoutMs:3000})).rows[0];
    if (!tables) throw new Error('NO_RESULT');
    logger.info('NEWSLETTER_F03_DIAGNOSTIC_TABLES', Object.fromEntries(
      Object.entries(tables).map(([k,v])=>[k,v===true])
    ));
    if (!tables.contacts || !tables.events) return;
    const census = (await database.queryBounded(`
      SELECT
       (SELECT count(*)::int FROM public.newsletter_contacts) AS contacts,
       (SELECT count(*)::int FROM public.newsletter_consent_events) AS events,
       (SELECT count(*)::int FROM public.newsletter_consent_events WHERE event_type='opt_in_confirmed') AS confirmed,
       (SELECT max(occurred_at) FROM public.newsletter_consent_events) AS latest
    `,[],{timeoutMs:3000})).rows[0];
    const latest=census?.latest instanceof Date?census.latest.toISOString():null;
    // Compare against pinned 2026-10-17 F03 one-shot instead of disclosing rows.
    logger.info('NEWSLETTER_F03_DIAGNOSTIC_PINNED_SNAPSHOT',{
      matchesPinnedHistory: census?.contacts===2 && census?.events===32 &&
        census?.confirmed===1 && latest==='2026-10-15T19:29:31.474Z',
      newerThanPinned: latest !== null && latest > '2026-10-15T19:29:31.474Z',
    });
  } catch(error) {
    const code=typeof error?.code==='string' && /^[A-Z0-9_]{2,24}$/.test(error.code)
      ? error.code:'READONLY_PROBE_FAILED';
    logger.error('NEWSLETTER_F03_DIAGNOSTIC_ERROR',{code});
  }
}

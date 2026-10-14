const key='0'.repeat(64);
export async function lockNewsletterCutover(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('newsletter-cutover-v1',0))");
}
export async function markNewsletterWriterStarted(client) {
  await lockNewsletterCutover(client);
  await client.query(`INSERT INTO idempotency_keys(scope,key_hash,fingerprint,state,response_status,response_body,expires_at)
    VALUES ('newsletter-cutover',$1,$1,'done',200,'{"writerStarted":true}','infinity')
    ON CONFLICT(scope,key_hash) DO UPDATE SET response_body=idempotency_keys.response_body||'{"writerStarted":true}'::jsonb
    WHERE idempotency_keys.response_body->>'writerStarted' IS DISTINCT FROM 'true'`,[key]);
}
export function validateCutover({cutoverBefore,writersStopped}={}) {
  if(writersStopped!==true||!(cutoverBefore instanceof Date)||!Number.isFinite(cutoverBefore.getTime())||cutoverBefore>Date.now())throw new Error('Authorized offline cutover boundary required');
}
export async function importNewsletterHistory(database,options) {
  validateCutover(options);
  return database.transaction(async client=>{
    await lockNewsletterCutover(client);
    const marker=(await client.query("SELECT response_body FROM idempotency_keys WHERE scope='newsletter-cutover' AND key_hash=$1",[key])).rows[0]?.response_body;
    if(marker?.writerStarted)throw new Error('Historical import closed after writer start');
    if(!marker?.importNotAfter || !Number.isFinite(Date.parse(marker.importNotAfter)) || options.cutoverBefore.getTime()>Date.parse(marker.importNotAfter))throw new Error('Historical import requires sealed pre-writer cutover boundary');
    // Also detect R4 installations predating the durable cutover marker.
    const live=await client.query(`SELECT 1 FROM newsletter_opt_in_requests WHERE state<>'legacy_pending'
      UNION ALL SELECT 1 FROM idempotency_keys WHERE scope='newsletter-public-optin' LIMIT 1`);
    if(live.rowCount)throw new Error('Historical import requires no previous R4 writers');
    const boundary=options.cutoverBefore.toISOString();
    if(marker?.cutoverBefore && marker.cutoverBefore!==boundary)throw new Error('Cutover boundary is immutable');
    if(marker?.imported)return 0;
    const result=await client.query(`INSERT INTO newsletter_opt_in_requests(email_hash,request_id,state,issued_at,expires_at)
      SELECT DISTINCT ON(email_hash) email_hash,event_id,'legacy_pending',occurred_at,occurred_at+interval '30 days'
      FROM newsletter_consent_events WHERE event_type='opt_in_requested' AND occurred_at<$1::timestamptz
        AND occurred_at+interval '30 days'>now() AND NOT (metadata ? 'intakeVersion')
      ORDER BY email_hash,occurred_at DESC,event_id DESC ON CONFLICT DO NOTHING`,[boundary]);
    await client.query(`UPDATE idempotency_keys SET response_body=response_body||$2::jsonb,updated_at=now()
      WHERE scope='newsletter-cutover' AND key_hash=$1`,[key,JSON.stringify({imported:true,cutoverBefore:boundary})]);
    return result.rowCount;
  });
}

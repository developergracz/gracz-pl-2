// OWNER-only read-only consent evidence count. This is NOT a send authorization.
// Never expose recipient identifiers or join historical/legacy subscribers.
// The version is the consent text used by new-only-newsletter.mjs.
export const CAMPAIGN_CONSENT_VERSION='newsletter-new-only-2026-10-20';

const SQL=`
  SELECT count(*)::text AS confirmed
  FROM newsletter_new.subscribers s
  WHERE s.state='active'
    AND s.confirmed_at IS NOT NULL
    AND s.delivery_state='sent'
    AND s.consent_version=$1
    AND EXISTS (
      SELECT 1 FROM newsletter_new.consent_events e
      WHERE e.email_tag=s.email_tag
        AND e.event_type='opt_in_confirmed'
        AND e.consent_version=s.consent_version
        AND e.challenge_id=s.challenge_id
        AND e.source=s.source
    )
    AND NOT EXISTS (
      SELECT 1 FROM newsletter_new.revocations r
      WHERE r.email_tag=s.email_tag AND r.recorded_at>=s.requested_at
    )
`;

export function createCampaignAudienceProofCount({database}={}){
  if(typeof database?.queryBounded!=='function')
    throw new TypeError('read_only_database_required');
  return async function countConsentEvidence(){
    const result=await database.queryBounded(SQL,[CAMPAIGN_CONSENT_VERSION],
      {timeoutMs:3000});
    const raw=result?.rows?.[0]?.confirmed;
    if(result?.rows?.length!==1||typeof raw!=='string'||
       !/^(0|[1-9][0-9]*)$/.test(raw))
      throw new Error('campaign_consent_evidence_unavailable');
    const count=Number(raw);
    if(!Number.isSafeInteger(count)||count<0)
      throw new Error('campaign_consent_evidence_unavailable');
    return Object.freeze({
      ok:true,confirmed:count,
      scope:'new_only_doi_evidence_no_revocation',
      advisoryOnly:true
    });
  };
}

import {randomUUID} from 'node:crypto';
import {WITHDRAWAL_EGRESS_LOCK} from './withdrawal-send-fence.mjs';

// Internal library only: not wired to routes, provider, operator UI or migrations.
// Caller must first independently authenticate its trusted intake channel.
// dedupeTag MUST be generated with a fresh, purpose-specific, owner-held HMAC key;
// no raw email, compromised newsletter secret or bearer may enter the queue.
const SOURCES=new Set(['routed_email','operator_record','support_request']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEDUPE=/^[0-9a-f]{64}$/;

function queueError(code) {
  const error=new Error(code);
  error.code=code;
  return error;
}

export function createWithdrawalInbox(database) {
  if(typeof database?.transaction!=='function')throw new TypeError('A durable transactional database is required');
  return Object.freeze({
    async receive({dedupeTag,source,evidenceRef}={}) {
      if(typeof dedupeTag!=='string'||!DEDUPE.test(dedupeTag))throw new TypeError('Opaque keyed dedupe tag required');
      if(!SOURCES.has(source))throw new TypeError('Unknown trusted intake source');
      if(typeof evidenceRef!=='string'||!UUID.test(evidenceRef))throw new TypeError('Opaque evidence UUID required');
      return database.transaction(async client=>{
        // Block any concurrent egress permit until this durable intake commits.
        // The send side holds the matching shared lock through its provider call.
        await client.query('SELECT pg_advisory_xact_lock($1::int,$2::int)',WITHDRAWAL_EGRESS_LOCK);
        const requestId=randomUUID();
        const inserted=await client.query(
          "INSERT INTO newsletter_recovery.withdrawal_requests(request_id,dedupe_tag,intake_source,evidence_ref) " +
          "VALUES ($1,$2,$3,$4) ON CONFLICT (dedupe_tag) DO NOTHING RETURNING request_id",
          [requestId,dedupeTag,source,evidenceRef]
        );
        if(inserted.rowCount===1) return Object.freeze({requestId:inserted.rows[0].request_id,created:true,state:'PENDING'});
        // Separate READ COMMITTED statement sees the committed winner of a concurrent insert.
        // Never fabricate success if an unknown/ambiguous state is encountered.
        const existing=await client.query(
          "SELECT request_id,intake_source,evidence_ref FROM newsletter_recovery.withdrawal_requests WHERE dedupe_tag=$1",
          [dedupeTag]
        );
        const prior=existing.rows[0];
        if(!prior)throw queueError('WITHDRAWAL_RECHECK_REQUIRED');
        if(prior.intake_source!==source||String(prior.evidence_ref).toLowerCase()!==evidenceRef.toLowerCase())
          throw queueError('WITHDRAWAL_DEDUPE_CONFLICT');
        return Object.freeze({requestId:prior.request_id,created:false,state:'PENDING'});
      });
    }
  });
}

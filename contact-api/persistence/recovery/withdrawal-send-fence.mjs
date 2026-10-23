// #335: fail-closed GLOBAL admission. History remains append-only. Only a
// self-service request linked to its verified mailbox challenge, immutable DOI
// revocation and provider-OFF readback has a complete settlement proof.
// Other sources (including legacy) stay on HOLD; provider-OFF alone is not proof.
export const WITHDRAWAL_EGRESS_LOCK = Object.freeze([2820, 19283]);

function refuse(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function createWithdrawalSendFence(database) {
  if (typeof database?.transaction !== 'function') {
    throw new TypeError('Durable transactional PostgreSQL client is required');
  }
  async function withAdmissionLock(effect) {
    return database.transaction(async client => {
      let result;
      try {
        await client.query(
          'SELECT pg_advisory_xact_lock_shared($1::int,$2::int)',
          WITHDRAWAL_EGRESS_LOCK
        );
        result = await client.query(
          "SELECT " +
          ` EXISTS(SELECT 1 FROM newsletter_recovery.withdrawal_requests r
            WHERE NOT EXISTS (
              SELECT 1 FROM newsletter_recovery.self_service_verified v
              JOIN newsletter_recovery.self_service_challenges c USING (challenge_id)
              JOIN newsletter_new.revocations d USING (challenge_id)
              JOIN newsletter_recovery.self_service_provider_intents i USING (challenge_id)
              JOIN newsletter_recovery.self_service_provider_verified p USING (challenge_id)
              WHERE r.intake_source='self_service'
                AND v.withdrawal_request_id=r.request_id
                AND v.challenge_id=r.evidence_ref
                AND c.requested_at<=d.recorded_at
                AND d.recorded_at<=v.verified_at
                AND r.received_at<=v.verified_at
                AND v.verified_at<c.expires_at
                AND i.created_at>=v.verified_at
                AND p.verified_at>=i.created_at
            ) LIMIT 1) AS unresolved_requests, ` +
          " EXISTS(SELECT 1 FROM newsletter_recovery.withdrawal_no_send_obligations LIMIT 1) AS obligations_exist"
        );
      } catch {
        throw refuse('WITHDRAWAL_SEND_FENCE_UNAVAILABLE');
      }
      if (result.rowCount !== 1 ||
          typeof result.rows[0]?.unresolved_requests !== 'boolean' ||
          typeof result.rows[0]?.obligations_exist !== 'boolean') {
        throw refuse('WITHDRAWAL_SEND_FENCE_UNAVAILABLE');
      }
      if (result.rows[0].unresolved_requests || result.rows[0].obligations_exist) {
        throw refuse('WITHDRAWAL_SEND_BLOCKED');
      }
      return effect(client);
    });
  }
  return Object.freeze({
    async checkAvailable() {
      // Readiness checks unresolved requests and durable legacy obligations
      // under the same lock, without authorizing an external effect.
      try { await withAdmissionLock(async () => {});return true; }
      catch { return false; }
    },
    async withSendPermit(effect) {
      if (typeof effect !== 'function') {
        throw new TypeError('A bounded outbound provider effect callback is required');
      }
      // A transaction-level shared lock is held DURING the external effect,
      // preventing intake from acknowledging a concurrent withdrawal.
      // Intake obtains the matching exclusive lock before any durable write.
      // When a withdrawal arrives first, this check observes it and refuses.
      // The callback owns provider idempotency and ambiguity recovery.
      // The fence does not claim that a lost provider ACK is safe.
      return withAdmissionLock(effect);
    }
  });
}

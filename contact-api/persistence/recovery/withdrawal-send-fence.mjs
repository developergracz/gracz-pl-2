// Fail-closed campaign admission. Historical, fully verified self-service
// withdrawals must not globally disable all future campaigns: recipient
// eligibility separately requires a fresh DOI and excludes revoked addresses.
// Unresolved requests (including legacy operator intake), uncertain provider
// outcomes and legacy no-send obligations still block all campaign delivery.
// A shared advisory lock is held through the provider effect; withdrawal intake
// acquires the matching exclusive lock before persisting a new request.
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
          " EXISTS(SELECT 1 FROM newsletter_recovery.withdrawal_requests r " +
          " LEFT JOIN newsletter_recovery.self_service_verified v " +
          " ON v.withdrawal_request_id=r.request_id " +
          " LEFT JOIN newsletter_recovery.self_service_provider_verified p " +
          " ON p.challenge_id=v.challenge_id " +
          " WHERE r.intake_source<>'self_service' " +
          " OR v.challenge_id IS NULL OR p.challenge_id IS NULL) AS unresolved_requests, " +
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

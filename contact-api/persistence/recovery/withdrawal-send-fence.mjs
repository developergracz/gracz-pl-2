// #282: fail-closed GLOBAL newsletter egress admission while legacy mapping
// and sender-specific suppression are not yet safely available.
//
// This is an offline-only internal primitive. No production send path currently
// imports this module, so installing this code does NOT enable sending or
// constitute proof that all existing sender routes are protected.
//
// Every code path capable of calling a marketing provider must eventually use
// this gate or be disabled. A pending withdrawal blocks *all* marketing, not
// only a guessed historic email subject. There is no "complete" state here.
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
          " EXISTS(SELECT 1 FROM newsletter_recovery.withdrawal_requests LIMIT 1) AS requests_exist, " +
          " EXISTS(SELECT 1 FROM newsletter_recovery.withdrawal_no_send_obligations LIMIT 1) AS obligations_exist"
        );
      } catch {
        throw refuse('WITHDRAWAL_SEND_FENCE_UNAVAILABLE');
      }
      if (result.rowCount !== 1 ||
          typeof result.rows[0]?.requests_exist !== 'boolean' ||
          typeof result.rows[0]?.obligations_exist !== 'boolean') {
        throw refuse('WITHDRAWAL_SEND_FENCE_UNAVAILABLE');
      }
      if (result.rows[0].requests_exist || result.rows[0].obligations_exist) {
        throw refuse('WITHDRAWAL_SEND_BLOCKED');
      }
      return effect();
    });
  }
  return Object.freeze({
    async checkAvailable() {
      // Readiness takes the same shared lock and checks the same durable
      // suppression obligations, without authorizing external effects.
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

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
  return Object.freeze({
    async withSendPermit(effect) {
      if (typeof effect !== 'function') {
        throw new TypeError('A bounded outbound provider effect callback is required');
      }
      // A transaction-level shared lock is held DURING the external effect,
      // preventing intake from acknowledging a concurrent withdrawal.
      // Intake obtains the matching exclusive lock before any durable write.
      // When a withdrawal arrives first, this check observes it and refuses.
      return database.transaction(async client => {
        let result;
        try {
        await client.query(
          'SELECT pg_advisory_xact_lock_shared($1::int,$2::int)',
          WITHDRAWAL_EGRESS_LOCK
        );

        // Fail closed if the schema is not yet installed, privileges are
        // insufficient, PostgreSQL is unreachable, or the check times out.
        // No raw addresses, bearer tokens or email hashes are selected.
        result = await client.query(
          "SELECT " +
          " EXISTS(SELECT 1 FROM newsletter_recovery.withdrawal_requests LIMIT 1) AS requests_exist, " +
          " EXISTS(SELECT 1 FROM newsletter_recovery.withdrawal_no_send_obligations LIMIT 1) AS obligations_exist"
        );
        } catch {
          // PG/privilege/schema failures never expose SQL or names in the app API.
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
        // The callback must implement independent idempotency and bounded
        // provider retries. A lost provider ACK cannot be inferred safe from
        // a successful DB transaction. This guard is NOT a send ledger.
        return effect();
      });
    }
  });
}

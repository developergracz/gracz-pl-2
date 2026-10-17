# P1-3: definitive Resend 422 rejection — safe operator HOLD and recovery design

**DRAFT / NO MERGE / NO DEPLOY / NO PRODUCTION WRITES.** This independent candidate is based on `b6e4a9bc3e3d0d1952ede20130146e7fc5501cd7`.

## Scope
1. Distinguish a fully received Resend HTTP 422 from ambiguous failures (timeout, 5xx, network loss, lost commit acknowledgement). No exception changes the current durable `inflight → unknown` fence.
2. Surface a fixed P1 operational log code `NEWSLETTER_DOI_422_OPERATOR_HOLD` carrying only a random requestId and sanitized providerRequestId, not raw email or tokens.
3. Provide a non-mutating DB-store inspector for trusted operator workflows (HMAC identity input only).
4. Add local regression proof that a definite 422 never retries automatically, keeps an `unknown` reservation, and does not silently resend on later subscription requests.

## Critical: manual recovery NOT authorized by this PR
These changes improve diagnosis; they do **NOT** clear existing 422 holds. A durable recovery **remains a P1 go-live blocker** until a separately reviewed explicit operator tool is implemented. This repository currently does not retain immutable proof of the provider's 422 response in the reservation table; clearing it automatically would risk duplicate/unauthorized sends.

The proposed operator release procedure must:
- Work only from an approved private, authenticated environment with business writers controlled.
- Verify independently obtained exact Resend delivery evidence for the specific request and idempotency key, and check there was no acceptance, no send and no welcome/consent reconciliation.
- Require recorded authorized owner approval and a second reviewer, plus an immutable append-only audit record that survives later claims and backups.
- Compare exact HMAC emailHash, UUID requestId, `state='unknown'` and current consent/withdrawal state in one bounded transaction.
- Reject missing, stale, conflicting or ambiguous proof and stop without mutation (HOLD).
- Never release timeout/5xx/unknown outcomes, never replay old tokens, never bulk reset, never clear provider suppressions or override opt-outs.
- Have full disposable PostgreSQL 16/18 tests and independent security audit before any Owner execution GO.

This PR adds *zero* write-capable recovery routes or scripts. Exact approval remains required for production release.

Offline test: `node --test contact-api/test/newsletter-provider-422.test.mjs`.

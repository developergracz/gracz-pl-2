# Newsletter B1 implementation plan

**Authority / spec:** Lead Architect EXECUTION GO B1, 2026-10-13 (this chat); accepted recovery baseline 4fa9b909667651a2580e28b404539dfe4306b950. Execute inline; draft PR only.

**Goal:** Durable duplicate DOI suppression without public membership disclosure.
**Architecture:** Resend remains authoritative; PostgreSQL holds one HMAC-keyed send reservation per mailbox. Never recycle an uncertain send. Preserve consent ledger and existing confirmation/withdrawal state machine.
**Stack:** Node.js, PostgreSQL 16, existing Resend HTTP adapter.

## Constraints and decisions
- No STATUS_CHECK, admin, deployment, live mail, production DB or secret changes.
- Neutral success: `{ok:true,state:"request_received"}`; preserve validation and real failure responses.
- Read suppression plus global unsubscribe, Segment and Topic before classifying provider state. Unknown/malformed/pagination failures fail closed.
- Preserve existing fenced provider recovery obligations after suppression check; ordinary signup does not mutate provider state. Explicit fresh DOI remains required to reactivate a withdrawn subscription.
- Reserve before the consent request event and send. Keep request UUID, issued/expiry timestamps and state; no email, token or payload in the new table.
- Pending window equals existing DOI TTL (30 days). No new automatic resend policy in B1.
- Mark sent only after provider acknowledgement. Inflight/unknown reservations are never automatically recycled, even after expiry or restart. Concurrent in-progress requests receive neutral acceptance for five minutes; this is response-only grace, never permission to reclaim. Recorded unknown outcomes or older inflight reservations return a generic temporary failure. This deliberately trades automatic crash recovery for no duplicate sends. Recovery requires separately reviewed provider evidence; no new recovery endpoint.
- A known sent reservation may be superseded after its TTL or after a later confirmed/withdrawn state. SQL must prevent stale requests overwriting a newer reservation.
- Provider retries within the original operation reuse the identical payload and key. No new JTI after ambiguous failure.

## Review focus
Crash before/after send; concurrent instances; stale provider/ledger snapshots; provider hosted opt-out; neutral responses including contact form and honeypot; malformed provider results; migration isolation.

## Task 1: durable requests and provider classification
- [x] Add failing manager tests for pending/active repeats, concurrent managers, unknown delivery, provider failures and suppression.
- [x] Add additive migration 005_newsletter_opt_in_requests.sql and repository claim/markSent methods; test-only memory equivalents.
- [x] Implement read-only provider classification and claim in requestOptIn; preserve confirm/unsubscribe.
- [x] Update lifecycle expectations only where B1 intentionally eliminates duplicate DOI.

## Task 2: neutral contract
- [x] Add route contract tests for new/pending/active and validation/failure.
- [x] Change success state and only necessary UI copy, including contact integration; preserve controls and layout.
- [x] Verify existing contact regression suite and frontend assertions.

## Task 3: PostgreSQL, verification and delivery
- [x] Use isolated local PostgreSQL only: migration, concurrent claims, persisted unknown, restart and end-to-end manager tests.
- [x] Run complete backend/persistence/syntax/SEO checks; document actual counts and failures.
- [x] Fresh review of branch; fix important findings with regression tests.
- [ ] Commit, push isolated branch, draft PR, inspect CI. MERGE/PRODUCTION HOLD.

## Implementation findings
- Cutover needs existing request events: migration imports the latest unexpired opt-in request as `legacy_pending` (no invented sent timestamp), blocking fresh DOI until expiry or a newer consent transition.
- Local PostgreSQL 16 became available through the existing managed Docker daemon; integration HOLD is no longer needed for environment availability.
- Existing recovery/compensation remains in place. Tests that deliberately manufactured duplicate DOI now model previously issued tokens or a hosted withdrawal.

# Newsletter operator recovery R2 — architecture proposal, HOLD

2026-10-17. Scope: PR #267. **NOT an execution authorization.**
No migration, write-capable recovery tool, HTTP admin endpoint, production query
or provider call is introduced by R2. The existing inspector is read-only; its
output is diagnostic and is never a release approval.

## Why the existing schema cannot safely release an unknown request

`newsletter_opt_in_requests` has one row per HMAC identity, a request UUID,
state and timestamps. It has no immutable provider-response/evidence record,
operator decision, independent reviewer attestation or recovery generation.
A later successful claim can replace the current request row. The consent
ledger is not a general-purpose operator authorization ledger. The separate
public admission marker also fences external effects and cannot be ignored.
A read of these tables followed by an unguarded UPDATE/DELETE has a race.

The application-generated DOI idempotency key is
`newsletter-confirm/` + the first 40 hex characters of SHA-256(request UUID).
This allows correlation; it does not prove that Resend did not accept a message.
The provider request ID is not durably recorded in the reservation. R2 logs only
a SHA-256 digest of its sanitized value, because a remote header is untrusted.
The private evidence record must retain the actual provider ID securely and
explain its normalization/digest comparison; a digest is not provider proof.

**Current outcome: HOLD even when the inspector shows unknown and HTTP 422.**
No deletion of a reservation, key reset, automatic replay, consent fabrication,
or weakening of F-03 checksums/seals is acceptable. The original production 422
cause is not established by the synthetic invalid-sender fixture. Obtain
restricted provider evidence before claiming the production failure is fixed.

## Proposed separately approved additive model

Before implementation, obtain Owner architecture approval and independent review:

1. An append-only operation-attempt record bound to request UUID, HMAC subject,
   exact idempotency key/payload digest, provider operation, response completeness,
   provider request identifier, observed result and timestamps. Exclude bearer
   tokens, message bodies and raw recipient addresses from ordinary logs.
2. An append-only recovery decision record bound to the attempt, evidence digest
   and restricted evidence reference. Record distinct authorized operator and
   reviewer identities, authorization provenance, scope, expiry, rationale,
   expected row version/state, consent-history watermark and public admission
   marker identity/version. Enforce uniqueness and referential constraints.
3. A separately designed terminal `rejected_verified`/recovery generation
   transition that preserves the original reservation and decision forever.
   Decide compatibility with existing schema readiness checks, backup/restore,
   cutover seals and claim policy before selecting final SQL. Do not repurpose
   `sent`, `pre_send`, or timestamp expiry to fake a recoverable state.

These are design requirements, not an approved schema or migration.

## Operator protocol and atomicity

Default **READ-ONLY DRY RUN**: use a private authenticated operator context,
least-privilege read-only role and consistent read-only transaction. No fallback
to ambient DATABASE_URL, public endpoint, bulk mode or live provider send.
Collect and compare the current request, public admission marker, full relevant
consent/withdrawal history, pending provider-off/suppression obligations and
current provider suppression evidence. Missing, expired or contradictory facts
produce HOLD. The dry run must never output tokens, email, full HMAC identifiers,
provider payloads or credential values to public reports.

Independent evidence must be obtained from Resend's authoritative operation
record/support and bound to this exact operation, request UUID, idempotency key,
payload identity and provider request ID. A local 422 log, no search result,
or missing delivered webhook is insufficient. Prove no acceptance and no send,
and reconcile all duplicate attempts and the provider retention window.

A future execute mode may first be implemented and tested only in a disposable
DB. It must start one bounded transaction; lock the subject/consent row, request,
public admission marker and decision in a documented consistent order shared
with every competing writer. Re-read all decision predicates after locks,
including the consent-history watermark, current withdrawal/suppression and
absence of a newer operation. Verify both approvals are still valid. Append
the immutable decision and perform a compare-and-set transition only if every
expected value/version still matches. Assert exact row counts; otherwise roll
back. The decision and transition commit together. On lost commit ACK, inspect
by immutable decision ID; never replay blindly. No send takes place in recovery.

If existing writers cannot participate in this concurrency protocol, the execute
mode remains unavailable until a separately audited writer fence/protocol exists.
Any new DOI after recovery must require a fresh, independently authorized intake
flow with valid current consent, suppression checks and its own durable claim.
It must not reuse or disclose the old bearer token or automatically resurrect an
old signup request.

## Required isolated verification before any later release decision

PostgreSQL 16/18 tests must cover two operators, stale approval/evidence,
concurrent unsubscribe/resubscribe/new claim, both public and B1 fences, process
crash before/after decision insert and commit, lost ACK, duplicate decision ID,
provider-ID/key mismatch, timeout/429/5xx, accepted-then-422, incomplete response,
expired evidence, rollback, backup/restore and audit-history immutability.
An independent security audit and separate Owner GO are required. This document
neither authorizes production execution nor declares readiness for activation.

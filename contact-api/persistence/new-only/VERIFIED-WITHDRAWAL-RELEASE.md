# New-only withdrawal R1 — minimal release
1. Confirm an independently restorable backup/PITR point. Privately apply `002_verified_withdrawal.sql` in ONE SQL transaction using `psql -v ON_ERROR_STOP=1 --single-transaction`. Existing data remains untouched; only a new, append-only table is created. Grant the API role SELECT/INSERT on this table and schema USAGE as appropriate. Never drop revocations for rollback.
2. Only **after migration**, merge/deploy this PR. New-only intake readiness refuses access until the table exists and the role has required grants. The existing recipient-verified opt-out writes a new-only revocation within its existing PostgreSQL transaction before the provider suppression attempt. That callback never reads, imports or modifies legacy subscribers.
3. Confirm one owned new-only subscription can use the existing verified opt-out flow and that a DOI link issued before the withdrawal can no longer activate it. A later, deliberate new submission issues a NEW DOI link; only that new link can reactivate the first-party new-only consent, and a further verified opt-out closes it again. The revocation row stays immutable; every withdrawal remains in `newsletter_recovery`. Do not remove provider suppression while proving an opt-out: a Resend suppression also blocks the new DOI email until the Owner deliberately lifts it for that one address. No bulk sending, campaign audience or admin publication is enabled.
4. Future campaign qualification requires current active DOI, a matching challenge/version/source event, and no withdrawal at or after the new request. Historical revocations and all recovery records remain immutable. Read-only Resend suppression preflight must succeed immediately before campaign transport; an active block, unknown provider state or unresolved obligation denies. The global marketing HOLD is unchanged and may still deny an otherwise qualified recipient.
**Fail-closed:** If the migration is not present, newsletter intake and verified opt-out readiness intentionally return unavailable after the new code deploy. Keep code deployment held until migration and grants are confirmed.

## #336 / PR #337 — reactivation R2 (no production actions)

The verified opt-out adapter creates team-wide Resend suppression. This also
blocks transactional DOI; submitting the public form is never permission to
remove it. The existing management credential (`WITHDRAWAL_RESEND_API_KEY`)
performs only a GET suppression preflight for DOI and campaign review.
`RESEND_API_KEY` remains send-only. Missing access, API failure or suppression
returns the same neutral public DOI response, without sending or reserving a
challenge. HTTP acceptance with an ID is not evidence of delivery; activation
still requires the new mailbox token. Rejected/ambiguous sends remain fenced.

Safe OWNER workflow, **not performed by this PR**:
1. User makes an explicit request to subscribe again. If DOI does not arrive,
   the public response points to Kontakt, without revealing address status.
2. OWNER independently verifies control of the mailbox and the explicit request
   through support. A form submission alone, a historic DOI or a status token is
   insufficient. Preserve withdrawal history and reconcile pending withdrawal
   obligations first. Do not lift bounce/complaint blocks as an unsubscribe fix.
3. Only after this review and a separate OWNER decision may the manual
   unsubscribe suppression for that exact address be removed using Resend's
   supported operator process. No bulk unblock, automatic removal, alternate
   provider or change to the global marketing HOLD. If that decision cannot be
   made safely, the address stays blocked and reactivation remains unavailable.
4. Ask the user to submit a fresh signup after clearance. A new one-time DOI is
   sent; only its confirmation creates a new active consent. Never activate
   consent manually or reuse an older link. No marketing is authorized by this.

Deployment remains held. Before a future release, OWNER must approve the
read-only management-key access and separately review database changes. For an
existing campaigns schema, apply **only** the updated `CREATE OR REPLACE FUNCTION`
definitions for `reserve_confirmed` and `claim_delivery` in
`contact-api/campaigns/schema-r1.sql`, in one backed-up SQL transaction; do not
rerun the whole schema (it creates existing tables/triggers). For a fresh test
schema the complete file is used. The API alone still fails closed with the old
functions, but renewed recipients cannot reserve/claim until those definitions
are updated. No migration, configuration change, unblock, merge, deploy or
marketing send is executed here. Issue #335 remains outside this change.

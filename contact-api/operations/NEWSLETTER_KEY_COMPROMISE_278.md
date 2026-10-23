# #278 — compromise recovery decision and HARD HOLD

Date: 2026-10-19. Scope: offline investigation and synthetic characterization.
**HARD HOLD / MERGE READY: NO / PRODUCTION READY: NO.** This document does not
authorize integration, migration, key replacement, sending or service activation.
Both newsletter secrets are potentially disclosed. The incident is not resolved.

## Exact baseline and scope

GitHub main and the local baseline were checked at
`2e12e4d742db51b17e45e02013b538d69bfae933`. The intended base of this DRAFT is that
commit, not the stale local origin/main tracking ref. Record the exact DRAFT HEAD
in the PR and review that SHA. Rebase/integration invalidates that review.

No runtime, SQL, historical migration checksum, deployment hook or secret is
changed. Tests characterize why replacing environment variables is unsafe; they
are not a migration implementation or proof of production continuity.

## Narrow threat model

Assets: append-only consent/withdrawal evidence; subject continuity; provider
suppression; uncertain dispatch fences; proof replay tombstones; cutover seals;
mailbox privacy. Assume an attacker knows either or both legacy newsletter keys
and can submit arbitrary requests and old or forged links. Do not assume access
to the independent contact encryption key, database, or provider credentials.
Knowing an HMAC key also permits offline address guessing against leaked hashes;
rotation cannot undo disclosure of historical data or screenshots.

The boundaries are browser bearer input, business API, first-party ledger,
provider effects and restricted operator recovery. A valid AEAD tag under a
compromised key is not evidence of mailbox ownership or consent. A provider
delivery record is not evidence of consent. Silence/timeouts are not no-effect
proof. Restored data and a maintenance health response do not prove writer
retirement. Screenshots/history cleanup do not establish secret erasure.

## Dependency map at the baseline

| Material / path | Dependency and rotation consequence |
| --- | --- |
| `server.mjs` | Reads both secrets and passes them into `createNewsletterManager`; independent contact/reply encryption must remain independent. There is no persisted key ID or compromise revocation registry. |
| `newsletter.mjs` token key | SHA-256 of trimmed `NEWSLETTER_SECRET` is AES-256-GCM key for `n1` confirm (30 days) and unsubscribe (5 years). Random 96-bit IV for confirm; unsubscribe IV is truncated HMAC with the same AES key over confirmation JTI. Deterministic unsubscribe payload includes JTI, original issue time and address. Never reproduce this shared AES/nonce-key design in a new format. |
| `newsletter-status.mjs` | HKDF-SHA256 derives the `ns1` status key from the same root; purpose/audience AAD and random IV separate the format, but root compromise compromises it too. Ten-minute nonce proof must additionally match a durable token row and consume atomically. Do not imply knowledge of the root alone bypasses that row. |
| `newsletter.mjs:consentSubjectHash` | HMAC-SHA256 of validated mailbox using SHA-256 of domain prefix plus `NEWSLETTER_CONSENT_HASH_SECRET`. Changing it changes the primary subject identifier. There is no hash-to-new-hash conversion. Preserve exact existing mailbox canonicalization; a normalization change is another identity migration. |
| `persistence/repositories.mjs`, `memory-newsletter-consent-store.mjs` | Contact state, CAS version, provider-blocked obligation and immutable events reference `email_hash`. Some provider contact IDs may help an approved reconciliation; they do not prove a complete map for hash-only subjects. |
| `newsletter-opt-in-store.mjs` | Unique subject reservation, request ID, pre-send/inflight/unknown/sent/legacy-pending state and reconciliation all depend on the same hash. A new hash can bypass an old reservation without deleting it. |
| `newsletter-proof-store.mjs` | Public opt-in/status and status-dispatch fences use subject hash; status proof stores SHA-256(nonce) with subject fingerprint; per-email budget derives from hour and subject hash. Preserve all scopes, fingerprints and consumed tombstones. |
| Provider effects in `newsletter.mjs` | Confirm/welcome idempotency keys derive from JTI, status keys from request ID. They are not a durable substitute for subject fences; a fresh request has a fresh key. Provider suppression is queried by mailbox; local provider-off obligations use subject hash. Consult both, with withdrawal/suppression precedence. |
| `newsletter-cutover.mjs`, `newsletter-operations.mjs` | Advisory cutover lock, exclusive import boundary, permanent writer-start marker, retention exclusions and uncertain inventory must survive recovery. Never reset seals to make migration pass. |
| Routes, contact opt-in, Premium footer | Admission pause blocks new public work, not confirm/unsubscribe/status-check. Contact opt-in shares the manager/admission path. UI readiness is not a compromise barrier; cached/direct clients remain possible. Default maintenance build/start is inert unless `GRACZ_BUSINESS_RUNTIME_ENABLED=1`. |

## Why implementation is held

The stored HMAC does not contain the recipient mailbox. Even possession of both
old and new keys cannot derive HMAC(new, mailbox) from HMAC(old, mailbox).
An authenticated mailbox candidate plus a verified old key can establish a
mapping; a hash alone cannot. Copies in escrow are not yet proven equivalent to
production. A complete recoverable address inventory, mapping coverage, unresolved
provider effects and a functioning withdrawal service are also not established.

Consequently a safe complete identity migration cannot be demonstrated here.
Adding a dual lookup to just the contact table would leave dispatch, proof,
budget and provider-off state behind. Treating a missing legacy match as a new
subscriber could resurrect a withdrawal or duplicate a send. Do not deploy a
speculative keyring, rewrite historical rows, or mark migration complete.

## Owner decision sheet (choose explicitly; neither is implemented)

**A — phased restricted legacy lookup, recommended only if escrow equivalence can
be proven.** Keep legacy HMAC material in a restricted mapping component, never
as a bearer-verification key. For an independently mailbox-verified address,
derive old/new identifiers and add an audited alias to a stable internal subject.
Resolve every contact/event/request/proof/budget/provider obligation through that
subject under one transactional lock. Unique constraints on `(key ID, hash)` and
one-to-one links reject conflicts; never merge automatically. Old evidence stays
byte-for-byte unchanged. Missing, ambiguous or conflicting mappings remain held.
This permits gradual continuity without collecting a bulk plaintext recipient
list, but retains compromised HMAC material and requires an approved retention,
access-control and final coverage policy. It cannot immediately retire the old
HMAC key for all unknown recipients.

**B — recipient-verified recovery with quarantined legacy namespace.** Retire old
token trust immediately in the future recovery runtime; keep legacy evidence and
all holds immutable. Recover only through an independently authenticated mailbox
and an approved private legacy mapping (escrow HMAC, verified provider ID mapping,
or equivalent independently evidenced association). Where no such association
exists, keep the subject unresolved and sending disabled. Fresh enrollment alone
does not prove absence of old suppression or unknown sends and must not create a
parallel active identity. This minimizes continued online legacy-key use but may
leave some subjects permanently unavailable. Owner must accept that limitation
and approve retention/withdrawal handling; it is not permission to erase history.

Required decision: select A or B (or commission another reviewed design), accept
the unresolved-subject policy, authorize a private full-strength escrow-equivalence
check without printing key material or hash prefixes, appoint withdrawal operators,
and define incident notification/legal assessment ownership. No production access
or secret transfer is requested by this PR. Evidence must remain in restricted
operator storage; publish only verdicts and non-sensitive reference IDs.

## Compromise policy and withdrawal continuity

Target recovery policy: reject all legacy `n1` and `ns1` envelopes before lookup or
provider effects. No grace period, trial decryption, automatic fallback or trust
in old signatures. Do not redeem old tokens to authorize a fresh token. Current
baseline does not implement this policy: keep the business runtime OFF; intake
pause alone is insufficient. Do not turn it on to test withdrawal.

Before any later activation, implement separate fresh purpose keys (confirm,
withdrawal, status and identity), authenticated version/key ID/purpose/audience,
random nonces, explicit active/retired/compromised states and rejection of unknown,
missing or compromised keys. Retired verification is allowed only for planned
non-compromise rotation under a separately reviewed policy. Store bounded,
single-use challenges; re-issue only following independent mailbox ownership,
durable per-subject/global budgets and unresolved-send checks. An uncertain
challenge send stays fenced, including after provider idempotency expires.
Never automatically resend, enroll, or carry a forged token's consent forward.

While stopped, offer the existing manual contact route without claiming completed
withdrawal. Owner must verify mailbox ownership and monitoring, primary/backup
operators, response/escalation times and a synthetic rehearsal. A matching From
header is insufficient authentication. Never request old bearer links or secrets.
Maintain a restricted pending-withdrawal ledger; reconcile every verified request
through an approved append-only process before any sends resume. Suppression and
withdrawal dominate enrollment. Without this operational evidence, withdrawal
continuity itself remains HOLD (as already recorded in #266).

Owner/security/privacy leads must assess exposure scope, access evidence and
applicable notification duties/timing. Preserve restricted incident evidence.
No breach conclusion, notification or message delivery is performed by this task.

## Provider reconciliation and integration order

Inventory every DOI/status/welcome attempt across local request/event/proof state,
provider requests and effects, all workers and legacy writers, including attempts
without message IDs and ambiguous acknowledgements. The last 70 delivered statuses
and an empty `newsletter-%` query cannot establish completeness. Preserve durable
unknown/inflight fences until independently evidenced disposition; elapsed time,
provider idempotency expiry or an apparently absent delivery never authorizes retry.

Refreshed overlap map: #254 is merged (head `7ecb81af6a73d0eedb0340a65c880010caca0075`);
#255 remains open DRAFT (`5c1d37338b31ee75b65e688b8ba155102a9a6780`);
#261 remains open DRAFT (`5e1a0d1f0e872a630932518dd1ebbe2ee991fb4a`);
#266 remains open DRAFT (`97048c2b5e5dd24b6607d449ec5c569bc087d3cf`).
Main already contains integration #262, corrections #263/#264/#265, R6/UI #273,
business-switch #274, readiness UI #276 and diagnostics #277. Open PR status is
not evidence its content is absent: do not blindly merge those older branches.
Compare exact resulting source and preserve later fixes. Historical sequencing in
`NEWSLETTER_F03_RELEASE.md` is not a current merge instruction.

Baseline global migrations stay 001–004. The candidate filename 005 is installed
only as `newsletter/001_opt_in_requests` in the separate newsletter ledger.
Approved stopped-writer F03 installation/import must precede first business writer;
an additive identity mechanism would need its own later reviewed migration/order.
Do not execute CONTACT005, move the candidate into global migrations, alter
checksums, run the F03 executor from build, or reopen the irreversible import seal.

## Gated, executable recovery plan

1. Keep this DRAFT on its own branch. Record baseline and exact reviewed HEAD;
   run synthetic tests below. No production command is part of this stage.
2. Owner supplies the decision and restricted evidence above. Design/schema and
   algorithm review must resolve all namespaces and crash/concurrency behavior
   before implementation. Missing escrow/mapping proof remains HARD HOLD.
3. Implement the chosen additive mechanism offline with synthetic fixtures;
   reject alias collisions and unresolved identities before any effect. Run the
   full acceptance matrix on disposable PG16 and PG18, including 2/32/1-style
   ledger preservation, withdrawn/unknown legacy identities, missing/revoked keys,
   old tokens, concurrency, lost COMMIT acknowledgement, SIGKILL, replay, delayed
   idempotency expiry, and R5/F03 locks. Test paused routes and Premium footer.
4. Independent security review of exact DRAFT HEAD; then separate Owner integration
   GO. Pin the resulting integration SHA and rerun tests; never equate this DRAFT
   with approval to merge.
5. Only under separate operational authorization: prove all-writer retirement,
   no queued/restart/manual/preview launches, actual inert build/start/predeploy,
   fresh backup/restore and full-strength escrow, pinned schema/history and complete
   provider uncertainty inventory. Refresh F03 evidence; no fabricated receipt.
6. Separate Owner GO for migration, key replacement, activation and rollout.
   Rehearse recovery on a restricted restore first; verify byte-for-byte old rows,
   alias coverage and all fences, and reconcile withdrawal backlog. Unknown state
   blocks rollout. Production execution commands must be authored for that approved
   design; this HOLD document deliberately contains no runnable production writes.

Rollback: remain/return to an approved inert artifact and re-prove writer retirement.
Keep additive data, legacy evidence, aliases, revocations, unknown sends, proof
tombstones and cutover seals. Never restore compromised bearer verification,
reverse consent rows, delete reservations, resurrect an old writer or overwrite
newer state with a backup. Independently review any recovery forward.

Local commands from repo root (synthetic tests only; no ambient production URL):

```sh
env -i PATH="$PATH" npm --prefix contact-api run check
env -i PATH="$PATH" npm --prefix contact-api test
env -i PATH="$PATH" node --test scripts/test-newsletter-maintenance-notice.mjs scripts/test-footer-newsletter-premium-validation.mjs
```

PG tests require fresh loopback `gracz_test` databases on both versions, the existing
destructive-test guard, and a scrubbed environment. Run `test:persistence` separately
per version. Never use a production export or a remote DB URL in CI. The existing
`scripts/test-newsletter-pg18.sh` additionally rehearses synthetic dump/restore.
Passing the baseline tests cannot prove a key migration which is not implemented.

## Local verification receipt

Node v24.19.0, 2026-10-19, synthetic data only:

- Backend: **129/129 PASS**, zero skips, including four new characterization cases
  (replacement confirm/unsubscribe key, missing key, unresolved HMAC lookup and
  replacement status key). New test assertions were corrected to the existing
  error code before this final run; runtime behavior was not changed.
- Disposable PostgreSQL **16: 113/113 PASS; 18: 113/113 PASS**, zero skips. Each
  used its own fresh loopback `gracz_test` container and scrubbed environment.
  Containers were removed after tests. New 2/32/1 characterization preserves
  contacts, provider-blocked withdrawal, immutable events and baseline registry;
  it aborts unresolved lookup before any effect. The synthetic withdrawal event
  uses the existing `unsubscribe` enum (not contact state `unsubscribed`).
- Existing integration tests exercise unknown/external effects, concurrent workers,
  lost COMMIT acknowledgement, actual SIGKILL/restart, expired idempotency, replay,
  withdrawal precedence and R5/F03 cutover. These validate existing fences, not
  a cross-key alias algorithm; alias-collision and complete migration continuity
  acceptance remain **unimplemented/HOLD**.
- Premium footer: **5/5 PASS**. Combined maintenance/footer checks: **6/7 PASS**.
  The pre-existing maintenance test expects the literal disabled-button list to
  contain `nl-action-button`; baseline #276 deliberately leaves old-link actions
  available while intake is paused. Both files are unchanged from baseline.
  Do not weaken the assertion and call compromise containment PASS. Keep this
  mismatch as a release blocker until the recovery policy and UI are implemented.
- Backend syntax, new test syntax, SEO, security headers/CSP and diff whitespace
  checks PASS. Browser E2E was not run in this session. GitHub CI and independent
  exact-HEAD review are separate from this receipt; record their outcomes in PR.

Initial sandbox runs could not use local sockets or fetch dependencies. Tests
above ran through approved local execution with a loopback fake provider; no live
message was sent. No production data, secret, token or recipient was accessed.
No production escrow, restore, provider inventory or writer retirement is proven.

# #280 — Option B containment, recovery design and activation HARD HOLD

2026-10-19. Owner decision: Option B at #279, decision HEAD
`c754e9a80d7a10484145d8556dae3b89e1b57fc5`.
**MERGE READY: NO. PRODUCTION READY: NO. RECOVERY ACTIVATION: HARD HOLD.**
This draft implements containment and an offline cryptographic primitive, not a
functional recovery or withdrawal service. No production state was inspected or
changed. Synthetic test evidence is not F03, escrow or operator attestation.

## Implemented and deliberately unavailable

- Business `server.mjs` uses a dependency-free held newsletter manager. It neither
  reads legacy newsletter keys nor constructs the legacy manager/proof stores.
  Newsletter readiness is false; every action is unavailable, including contact
  form opt-in. No environment variable can lift this hold. CONTACT reply/data
  encryption and the F-02 maintenance build/start scripts are unchanged.
- The page discards and revokes `n1`/`ns1` fragments before displaying an action.
  No click, history restoration or intake readiness can redeem them. The API is
  the security boundary for cached or malicious clients; UI blocking is additional.
- Offline `newsletter-purpose-keys.mjs` implements `n2`, independent key IDs and
  purposes, random nonces, exact audience binding and `ni2` identity domains.
  It is NOT wired to the business server or a provider. It supplies no replay
  ledger, mailbox ownership, consent or mapping authority.
- No recovery schema, alias writer, challenge issuer, recovery endpoint, new
  marketing consent flow or verified withdrawal executor is installed. These
  remain explicit implementation blockers, described below. No alternate active
  identity is created for an unresolvable address.
- Legacy manager/status modules remain for regression characterization; production
  business server cannot import them. Removing the hold is a code change requiring
  new review, not a configuration flip. Existing legacy regression successes do
  not certify those formats as secure after compromise.

## Freeze-boundary inventory (actual main baseline)

GitHub main and local source: `2e12e4d742db51b17e45e02013b538d69bfae933`.
Both `NEWSLETTER_SECRET` and `NEWSLETTER_CONSENT_HASH_SECRET` are compromised for
this threat model. The independent `CONTACT_DATA_ENCRYPTION_SECRET` is out of the
planned rotation. Do not extract, transfer, print or use any live key in this task.

| Source → sink | Preservation / containment obligation |
| --- | --- |
| `newsletter.mjs`: SHA256(secret) → AES-GCM `n1` | 30-day confirm, potentially 5-year unsubscribe. Old deterministic unsubscribe nonce derives from same root/JTI. All old ciphertext/signatures are untrusted; no decrypt-then-reissue. |
| `newsletter-status.mjs`: HKDF(secret) → `ns1` | Ten-minute proof; old proof nonce still needs durable row. Compromised root never authorizes mailbox control. Preserve consumed token rows. |
| `consentSubjectHash` → `newsletter_contacts.email_hash`, `newsletter_consent_events.email_hash` | Domain-prefixed old HMAC; preserve contact state/version, provider ID, blocked-at, withdrawals and append-only events byte-for-byte. New HMAC cannot be derived from old hash. |
| `newsletter-opt-in-store.mjs` → `newsletter_opt_in_requests` | Preserve unique subject reservations, request IDs and legacy_pending/sent/unknown/inflight/reconciliation fences. No parallel enrollment under a new hash. |
| `newsletter-proof-store.mjs` → `idempotency_keys` | Preserve public opt-in/status scopes, status dispatch, budgets, nonce fingerprints, consumed proofs and their retention exemptions. TTL expiry is not permission to erase a fence. |
| `newsletter.mjs` → provider contact/segment/topic/suppression/email | Local provider-off obligation and external opt-out/suppression dominate new consent. Sent/unknown DOI/status/welcome remain fenced after provider dedup expiry. Delivery is neither ownership nor consent proof. |
| `newsletter-cutover.mjs`, `newsletter-operations.mjs` → registry and idempotency marker | Preserve advisory lock, importNotAfter/cutoverBefore, imported and irreversible writerStarted; no reset or second import. |
| `routes/newsletter-route.mjs`, contact opt-in → manager | Held before body/store/provider work; direct callers cannot bypass via pause=false. All responses neutral/unavailable, never withdrawal-completed. |
| Newsletter page and Premium footer → API | Public enrollment remains disabled by false readiness; Premium behavior preserved. #276 ordinary pause behavior remains for future synthetic nonlegacy actions, but n1/ns1 are permanently revoked. |
| F03 migration executor → separate registry | `newsletter/001_opt_in_requests` only; global CONTACT registry 001–004 unchanged. Candidate SQL/checksum and F-02 build/start untouched. |

Threat model: attacker knows both newsletter keys, possesses/forges old links,
replays requests, controls browser fields and causes lost acknowledgements. Do not
assume attacker controls the independent future verifier, restricted evidence
store or database owner. Historic hash privacy cannot be restored by rotation.

## Additive schema plan — NOT executable in this draft

Use a separately versioned `newsletter_recovery` schema and its own migration
registry, never CONTACT005 or a modification of newsletter/001. Installation must
be explicitly reviewed for privileges, transactional DDL and F03 lock ordering.
All tables below require restricted role grants; public/business role has no
INSERT/UPDATE/DELETE on evidence, aliases, verification or withdrawal tables.
Use DB constraints and append-only triggers, not application assertions alone.

1. `subjects(subject_id uuid PK, state CHECK IN ('quarantined','verified_held'),
   revision bigint)`. There is deliberately no `active` state until a later
   consent/send implementation proves all obligations. No subject created merely
   from a fresh HMAC miss. Identifiers contain no raw mailbox.
2. `aliases(namespace text, digest bytea CHECK octet_length=32, subject_id FK,
   evidence_id FK, UNIQUE(namespace,digest), UNIQUE(subject_id,namespace))`.
   Namespace records key ID and normalization version. A collision, conflicting
   alias or ambiguous mapping rolls back; no automatic merge, reassignment,
   upsert-overwrite or retry-as-new-ID. Legacy namespace remains permanently
   quarantined. One subject may have one old and one new identity per namespace.
3. `mapping_evidence(evidence_id uuid PK, method enum, reference_id,
   verifier_id, policy_version, verified_at, scope_digest, disposition)` stores
   non-public provenance references, not caller booleans or keys. Only isolated
   verified escrow derivation or independently established one-to-one provider
   mapping may produce approved records. Missing/invalid escrow, incompleteness,
   hash-only subjects and unknown effects produce HOLD, never absence proof.
4. `challenges(challenge_id uuid PK, recipient_domain_digest, token_digest UNIQUE,
   verifier_evidence_id FK, purpose, issued_at, expires_at, attempts bounded 0..5,
   consumed_at, status)` plus append-only `challenge_events`. No raw bearer token
   storage; keyed recipient indexing separate from legacy HMAC. Spent/rejected
   tombstones never deleted by expiry cleanup. Issue/check adapters have separate
   roles; neither may create mapping evidence or marketing consent.
5. `budgets(scope, bucket, count, cooldown_until, PRIMARY KEY(scope,bucket))`:
   durable per-mailbox, per-source and global budget, one outstanding challenge
   per mailbox; ten-minute TTL, five total attempts, 60-second cooldown, at most
   three challenges/hour/mailbox. Global/source capacities require load/security
   review before activation. Resend is disabled while any outcome is uncertain.
6. `obligations(subject_id, namespace, legacy_reference, kind, disposition,
   evidence_id)` references ALL legacy contact/event, reservation, status/public
   proof/budget, suppression/provider-off, idempotency and welcome/DOI effects.
   Preserve originals in place; views/adapters resolve stable subject → original
   key scopes. No bulk rehash, copying-as-fresh or rekeying old fences.
7. `withdrawal_requests(request_id uuid PK, verification_reference, received_at,
   subject_id nullable, state IN ('pending','verified_pending','reconciled'),
   provider_off_required boolean)` with append-only events and unresolved private
   queue. Receipt is durable even when mapping is absent. No completed response
   until both ledger append and provider-off disposition are durable.

## Challenge and alias transaction protocol — implementation gate

A trusted evidence adapter has not been selected or supplied. Before coding its
boundary, Owner/security must choose and validate independent mailbox verification
(e.g. fresh authenticated mailbox-provider session with exact issuer/audience,
nonce and recipient binding, or a separately approved restricted challenge channel).
A delivered email, From header, claimed email, old bearer or signed claim under an
old key is insufficient. Avoid adapters accepting caller `verified=true`, raw
provider IDs or arbitrary evidence references as authority.

The future challenge must bind verifier identity, mailbox, purpose, nonce, expiry,
and recovery session. Compare fixed-length digests in constant time. All attempts,
including bad proof, increment durably under row lock; commit the counter on
failure (do not roll it back with an exception). A missing challenge returns the
same neutral result. Enforce budgets before verifier work, uniform response shape,
no membership-dependent timing branch and no sensitive logs. No CI email delivery.

Future redemption transaction: acquire cutover advisory lock first, then stable
subject/namespace locks in sorted order, then challenge row FOR UPDATE. Check
challenge/issuer freshness and attempts; consume using CAS, retain tombstone;
resolve restricted evidence under current policy; inventory all namespaces and
external-effect uncertainty. Unique alias constraints prevent concurrent new-key
claims. Alias and consumed proof commit together; use an operation UUID for a
read-only status query after a lost COMMIT acknowledgement. Never rerun external
effects to discover whether commit succeeded. Crash before commit retries only
transactional local work; crash after commit reads existing result. An unmapped or
conflicting subject stays quarantined with NO SEND / NO NEW ACTIVE ID. Marketing
opt-in is a separate explicit action and cannot clear legal/provider suppression,
withdrawals or unknown DOI/welcome effects.

Do not start an R5 writer to create this state. No recovery workflow may clear or
reset import seals or admit an unrecognized legacy namespace. Full coverage of
legacy references is mandatory before even a correctly mapped subject can leave
verified-held. Other subjects can remain unavailable permanently under Option B.

## Verified withdrawal continuity — HARD HOLD

No operational service is attested by this draft. Existing contact/mailto text is
a channel for a request, not a guaranteed or completed withdrawal service.
Required before activation: named primary AND backup operator, mailbox ownership
and monitored-access attestation, restricted queue/access policy, acknowledgement
and response SLA, escalation policy for unresolved matches, synthetic rehearsal
and evidence of durable recovery after operator absence. Owner supplies restricted
references; publish only PASS/HOLD plus non-sensitive IDs.

Future path: preserve incoming request → independently verify mailbox → append
pending-withdrawal evidence even if mapping is absent → block all potential sends
for unresolved subjects → restricted one-to-one reconciliation → append legal
withdrawal evidence without editing old events → persist provider-off obligation
before any provider call → reconcile provider response durably. Timeouts remain
pending, with no automatic duplicate effects. Never state completion from request
receipt, mailbox proof alone or a provider timeout. Without a proven map, keep
business API OFF and intake paused rather than pretending a precise per-subject
block protects every legacy namespace.

## Escrow and incident decision sheet

| Input / accountable party | Current evidence | Required gate |
| --- | --- | --- |
| Option B / Owner | Approved in #280 | Choice resolved; unresolvable subjects may remain unavailable |
| Both newsletter secrets / Owner + security operator | Escrow exists per mandate; exact equivalence NOT proven | Private full-strength comparison of BOTH full values against intended deployment, identities and timestamp; no keys/fingerprints/prefixes in reports |
| Legacy mapping / security + PostgreSQL lead | No validated adapter or complete coverage evidence | Approved one-to-one method, ambiguity/collision policy, namespace coverage and restricted provenance |
| Provider effects / operator | No complete uncertainty inventory supplied | DOI/status/welcome requests across all workers and provider logs, including no-ID/timeouts; dedup TTL is not evidence |
| Withdrawal / Owner + primary/backup | No attestations or rehearsal supplied | Requirements above, pending queue reconciliation |
| Incident/privacy / Owner + designated legal/privacy lead | Assessment and duties unresolved | Exposure/evidence retention, notification decision and applicable deadline ownership |
| F03 / Owner + DB operator | No execution/import authorization or production attestation in this task | Actual stopped-writer boundary, immutable history/registry checks, backup/restore, independent review |

Equivalence procedure is FUTURE and operator-only: trusted local isolated process,
no shell tracing, secrets entered/read through approved private channels, normalize
exactly as the intended runtime does, compare full values in constant time, emit
only equal/not-equal and a private evidence reference. Compare both independently;
failed/missing evidence never permits old-HMAC mapping. Do not ask Codex to export
KeePass or Render material. This draft performs no such comparison.

## Key lifecycle and future cutover order

Owner-controlled CSPRNG generates independent 32-byte keys for confirm, unsubscribe,
status and identity; independent IDs, no derivation from compromised roots. Offline
primitive copies an immutable keyring snapshot. Config rotation requires replacing
all instances; mutating a caller buffer cannot revoke an existing snapshot. Only
one active key per purpose; retired AND compromised IDs reject verification in this
conservative design. A retired-key grace period is not implemented. Maintain
private lifecycle/version registry and issuance limits; rotate before nonce volume
requires a stronger allocation scheme. Identity rotation requires the same alias
review, never automatic new enrollment.

1. Keep F-02 maintenance runtime active, business OFF, public intake paused. This
   mandate does not invoke start/build switches, migrations, keys or providers.
2. Resolve every decision-sheet gate privately and review implementation of the
   schema, verifier, replay/budgets, obligations and withdrawal queue. Required
   future tests include mapped/unmapped/ambiguous/colliding aliases, stale evidence,
   budget exhaustion, race/restart/lost-COMMIT and atomic consumption.
3. Separate Owner GO for integration/merge, key transition, F03 schema/import,
   business startup and public intake/send enable. None is inferred from DRAFT PASS.
4. Freeze all writers; verify backup/restore and immutable baseline without dumping
   recipients to CI. Install approved F03 `newsletter/001_opt_in_requests` only at
   sealed boundary; then install reviewed additive recovery schema separately.
5. Revoke old token trust without fallback; privately inject new keys only into
   reviewed future runtime, reconcile namespace inventory and pending withdrawals.
6. Only after future approval, pause-safe business startup → `/newsletter/ready`
   validation → separate public enable GO. In this draft readiness stays false.
7. Monitor only redacted aggregate outcomes and private queue health, no bearer,
   address, HMAC or key logging. Retain incident evidence under approved access/
   retention policy; privacy notification review precedes external communication.

Rollback means stop/pause and retain all history, aliases, obligations, tombstones
and seals. Never restore compromised token verification or overwrite a newer
ledger from an older backup. After an uncertain commit/provider effect, keep HOLD
and reconcile by stable operation reference. No downgrade to the legacy manager.

## Integration collision map

| Change | Actual main integration / draft rule |
| --- | --- |
| #261 F03 | Main already contains separate newsletter migrator/one-shot and follow-up fixes. Do not blindly merge historical branch instructions. Candidate 005 filename does not authorize CONTACT005. |
| #266 maintenance/withdrawal | Main includes notice and gated F-02 path; operational withdrawal attestations still absent. No claim of functional manual service. |
| #274 | Preserve build/start business switch; held business newsletter adds containment even if someone later starts it. This task never flips switch. |
| #276 | Keep readiness/Premium behavior; n1/ns1 revocation supersedes old-link exception. Existing failing static test replaced with specific revoked-format assertions plus behavioral browser tests, not weakened to allow old tokens. |
| #277 | Read-only diagnostics untouched; do not run it against production here. |
| #279 | Decision/reference only, not merged or used as an implementation. |

Exact reviewed draft SHA and executed test results belong in the PR body (a commit
cannot contain its own SHA). Any code change after audit requires review of the
new HEAD. Review PASS applies only to containment scope, never activation.

### Regression harness boundary

Three existing process suites previously launched the now-held `server.mjs` and
expected legacy sends. Their assertions are preserved on the guarded
`test-support/legacy-newsletter-server.mjs` entrypoint: NODE_ENV=test, loopback DB
named gracz_test, loopback HTTP provider and exact synthetic test keys are required
before loading the server. A test-only Node module hook substitutes the legacy
manager; no runtime module imports that entrypoint and no env switch bypasses the
production HOLD. Test harness needs Node >=22.15 (executed on 24.19). These are
legacy characterization tests. The new actual-server HTTP test launches the normal
entrypoint with pause=false and asserts readiness/action HOLD and zero provider
calls. New PG containment fixture compares every public table unchanged.

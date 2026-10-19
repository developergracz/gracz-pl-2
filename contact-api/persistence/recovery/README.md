# #282 — private withdrawal queue, operator core and dual-proof pending obligation (R3)

**DRAFT / HARD HOLD / NOT A LIVE WITHDRAWAL SERVICE.**

This PR adds a separate additive PostgreSQL recovery namespace (not CONTACT005
or F03), append-only opaque withdrawal intake receipts, and an internal
operator-only read/quarantine core. Nothing is installed or connected to the
website, email provider or public HTTP endpoints. The system never claims
that a withdrawal is confirmed.

## Implemented

- Immutable opaque request intake with a purpose-separated HMAC dedupe tag;
  atomic RECEIVED event, concurrent deduplication and restart recovery.
- Operator-account DB table with one active primary and one active backup
  role; default **zero accounts** and therefore default-deny.
- Pinned Ed25519 JWT verifier for a **future restricted identity gateway**:
  exact issuer/audience/key id, signature, fresh auth time and expiration,
  MFA plus WebAuthn assertion methods, unique jti, and a separate
  >=32-byte HMAC for hashing private operator-subject identifiers.
  No login provider or frontend has been configured.
- DB-derived operator roles (JWT role claims are ignored); fresh signed
  assertion for every action, single-use tombstone, operator disable flag.
  Read actions and quarantine actions are committed with append-only audits.
- A quarantine never sends mail, changes consent, creates alias mappings or
  claims that a withdrawal was processed. Conflicting quarantine outcomes fail.
- **New R3:** independent mailbox-control and legacy one-to-one mapping evidence
  verifiers, each pinned to a different Ed25519 signer, issuer, audience and
  purpose. A source claiming only email delivery or a compromised legacy
  bearer can never pass these checks. Test signatures are synthetic.
- When both independent signatures match the same request and opaque mailbox
  tag, an authenticated operator may atomically append VERIFIED_PENDING,
  durable immutable proof references and a RECONCILIATION_PENDING no-send
  obligation. Such entries are not integrated with production suppression,
  so they are **NOT a completed withdrawal** and do not enable sending.
- New focused PG16/18 tests require durable rollback if an obligation or audit
  cannot be written, deny forged/mismatched proofs and prove no confirmed
  effect. All writes occur only in a disposable gracz_test fixture.
- **New R4: offline global send-admission fence:** the internal
  `withdrawal-send-fence.mjs` is a fail-closed wrapper around a synthetic
  provider callback. It holds a PostgreSQL shared transaction advisory lock
  while the bounded effect executes; `withdrawal-inbox.mjs` acquires the matching
  exclusive lock before accepting an intake request. This serializes durable
  intake against admitted sends without relying on an email-to-legacy-subject
  guess. ANY unresolved request blocks ALL newsletter marketing egress.
  Missing schema, missing privileges or database failures deny the permit.
  PG16/18 tests prove blocking, lack of bypass, rollback and the lock race.
  **R5 offline integration candidate:** `newsletter.mjs` now protects
  DOI/welcome/status sends and Resend marketing-ON mutations behind an optional
  injected durable PostgreSQL withdrawal fence. An isolated Resend double
  exercises the candidate code. **The live `server.mjs` remains byte-for-byte
  aligned with current `main` and imports `createHeldNewsletterManager()`,
  not the legacy manager.** The candidate cannot send from production.
  A future business-runtime adapter would have to inject the fence and prove
  it does not restore compromised legacy n1/ns1 tokens before activation.
  The recovery schema deployment and independent evidence issuers/operator
  identities remain unimplemented. The provider-off adapter and verified
  readback are now coded but not configured with a real Resend credential.
  The feature branch predates #281/#284 and must be reconciled to current
  `main` with exact-HEAD CI and an independent security delta review.
- **R7 provider-off implementation (offline):** `resend-provider-off.mjs` uses
  Resend's official suppressions and contacts APIs. It first records a durable
  suppression, then sets `unsubscribed:true` for an existing contact. A fresh
  API read must confirm both the suppression and the unsubscribed state (or
  absent contact) before a successful outcome is returned. Unknown responses
  never report success; provider mutations are not automatically repeated.
- The operator workflow accepts only a signed MFA assertion, existing
  `VERIFIED_PENDING` evidence and a separate trusted resolver whose recipient
  matches the mailbox tag in BOTH signed proofs. It commits an immutable
  provider-off intent **before** the first external effect, then records
  `PROVIDER_OFF_VERIFIED` after a new independent readback. No recipient
  address or provider keys are stored in the public repository.
- **Still not legally/technically CONFIRMED:** the older first-party consent
  ledger and historical identifiers have not been reconciled; the durable
  global no-send obligation remains. There is no real credential provisioning,
  private identity resolver, operator login, remote Resend connection, public
  intake or production migration in this PR. Synthetic tests are the only
  source of external calls in CI.
- Synthetic unit tests and isolated PostgreSQL 16/18 integration tests.
  Integration tests are collected by the existing persistence CI glob,
  restricted by the disposable loopback gracz_test guard.

## R8: private authentication and verified identity mapping

- The private runtime in `private-operator-runtime.mjs` wires the existing
  strict pinned Ed25519/WebAuthn-MFA assertion verifier to two individually
  authenticated operators, an *independently* signed Owner enrollment approval,
  verified mailbox + mapping authorities, private PostgreSQL and Resend-off.
  No public route, shared password, human DB login, auto-enrollment or
  default accounts are added. Missing config fails closed.
- One-time enrollment requires two different fresh IdP MFA assertions and a
  short-lived Owner-signed approval bound to the **exact ordered pair** of
  private subject tags. Operator roles are persisted and checked on every
  operation; account disable flags remain effective.
- Mapping is computed for one requested mailbox only: use fully matching
  independently protected legacy consent-secret copies, the exact old HMAC
  derivation, a fresh signed **independent mailbox challenge**, one historical
  contact and consent event, an installed F03 table, and a read-only Resend
  suppression/contact check. The separate pinned mapping issuer signs the
  matching legacy subject reference and mailbox tag. No mass rehash/import.
- An authenticated operator may link that record to a verified request. The
  recipient email is encrypted at rest with a **new purpose-specific AES-256-GCM
  key**, and subject/email/mailbox identifiers are uniqueness constrained.
  Wrong tag, mismatching historical HMAC, missing history/F03, ambiguous
  mapping or incorrect escrow comparison causes **DENY / NO SEND**. It never
  creates consent or clears old suppression.
- Only private authenticated mapping can resolve the recipient for the
  existing Resend provider-OFF path. An independent readback of suppression
  and provider contact is still required, and full historical consent
  reconciliation has *not* been implemented.

**Operationally not yet provisioned:** real Owner/backup MFA identities and
WebAuthn enrollment, independent Owner approval signing key, independent
mailbox-challenge issuer, new private mapping-signing/encryption/mailbox keys,
verified exact Render-vault/Owner-escrow legacy secret equivalence, private DB
schema/least-privilege grants and live provider access. Those require an actual
restricted Owner-authorized operational setup; synthetic CI credentials do
not count. Never copy/print secrets, raw subject maps or recipient lists.

## Deliberately not implemented / release blocking

- No online operator login or MFA setup: an independent verified identity
  provider must be chosen, configured, and proven to issue tokens matching
  the strict pinned Ed25519 verification contract. WebAuthn enrollment,
  emergency access recovery and phishing-resistant MFA attestation are
  not implemented in this PR.
- No operator provisioning/revocation administration, authenticated HTTP
  API, secure session transport or independent access reviews. Existing
  DB account rows are only synthetic test fixtures. Enforce actual least
  privilege through a **future** restricted service role and operator
  provisioning service; currently migration has no grants to an app role.
  No direct PostgreSQL credentials for human operators.
- No private encrypted mailbox evidence store, source attestation or
  automatic Cloudflare inbound-to-queue bridge. A message delivered to
  an inbox does not establish requester identity.
- No real independent mailbox challenge issuer, independently reviewed
  one-to-one historical identity mapping service or enrolled signing keys.
  The signature verifier and VERIFIED_PENDING storage work only with future
  properly authorized external evidence services; synthetic proofs do not
  satisfy this production requirement.
- No production business-runtime integration: the actual R3 server is held
  and MUST remain held until new purpose-specific secrets and verified Option B
  recovery, F03 and provider suppression are implemented. The candidate
  manager's optional fence injection must be made mandatory in any future
  business runtime and tested against the merged R3 import-graph restrictions.
- No historical subject reconciliation, actual signed mailbox challenge
  authority, live provisioned provider credentials or CONFIRMED first-party
  consent ledger state. The private provider-off reconciliation is offline
  code and cannot operate until separately authenticated mapping exists. The global send stop is intentionally conservative and is NOT
  per-recipient suppression. No operator
  may clear an UNKNOWN/no-send fence solely from mailbox possession.
- No verified operator rehearsal, intake monitoring evidence, account
  onboarding, privacy/legal approval, retention policy or production restore
  proof. Owner operational statements are not substitutes for verification.
- No automatic migration path: the SQL file is purposefully outside the
  existing migration discovery paths. A checksum-validated, separately
  Owner-authorized recovery migration executor is required.
- The database append-only triggers protect against ordinary application
  UPDATE/DELETE/TRUNCATE, not malicious owner/superuser DDL. Before release,
  operator services require DB-enforced minimal privileges and audit.

## Test and release boundary

The fixture creates/drops only the distinct newsletter_recovery schema in
a disposable loopback database named gracz_test. Never point it at Render.
No real secrets, PII, subscribers or provider effects are used.

Cross-references #280, #281, #282. PR #281 has been merged as *inert security containment*. Production activation stays on HARD HOLD.
NO MERGE, DEPLOY, LIVE DATABASE SQL, SECRET ROTATION, REAL SENDS OR PUBLIC INTAKE.

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
  **This wrapper is not yet connected to the real newsletter send paths.**
  The live sender remains intentionally disabled; the guard alone DOES NOT
  make newsletter or provider integration safe to activate.
- Synthetic unit tests and isolated PostgreSQL 16/18 integration tests.
  Integration tests are collected by the existing persistence CI glob,
  restricted by the disposable loopback gracz_test guard.

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
- No integration of the new egress-admission wrapper into EVERY real newsletter
  provider send path, historical subject reconciliation, durable consent
  withdrawal, Resend provider-off/suppression execution or CONFIRMED withdrawal.
  A global send stop is a safe interim behavior, NOT per-recipient suppression. No operator
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

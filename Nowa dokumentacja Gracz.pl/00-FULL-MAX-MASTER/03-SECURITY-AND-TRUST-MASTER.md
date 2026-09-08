# GRACZ.PL — FULL MAX SECURITY & TRUST MASTER

**Status:** LIVING / CONSOLIDATION DRAFT  
**Production security certification:** NONE  
**Implementation authorization:** NONE

## 1. Security objective

Gracz.pl is designed so that authentication, authorization, concurrency, secrets, cryptography, persistence, game-state integrity and future FairPlay mechanisms fail safely and are independently auditable.

## 2. Trust boundaries

```text
UNTRUSTED CLIENT
    |
    v
AUTHENTICATED API BOUNDARY
    |
    v
APPLICATION / MATCH RUNTIME
    |
    +-------------------+
    |                   |
    v                   v
GAME LOGIC          SECURITY / FAIRPLAY CORE
    |                   |
    +---------+---------+
              v
         POSTGRESQL
              |
              v
      BACKUP / DR / AUDIT
```

Clients, browser state and realtime payloads are never trusted as authoritative system state.

## 3. Security domains

The following domains must remain logically and cryptographically separated:

- authentication/session secrets,
- MFA secrets,
- application encryption keys,
- messaging/private-content encryption keys,
- FairPlay signing/derivation keys,
- deployment/infrastructure credentials,
- database credentials.

No future GFPE key may reuse `AUTH_SECRET` or unrelated application secrets.

## 4. Identity and access control

Target requirements:

- authenticated identity resolved server-side,
- authorization checked on every privileged operation,
- seat/player ownership enforced server-side,
- admin/owner actions auditable,
- RBAC must have negative-path tests,
- MFA-sensitive operations require explicit policy,
- no authorization derived only from client-provided role/seat fields.

P1-B-01 remains a backlog item to be reassessed in the full-project audit; it is not silently declared closed here.

## 5. Mutation safety

Security includes integrity, not only login.

Critical mutation path should enforce:

- input validation,
- authorization,
- durable idempotency,
- expectedVersion/CAS,
- ownershipEpoch fencing where required,
- transactionality,
- safe projection,
- post-commit realtime signal.

Concurrent or stale writers must not both succeed.

## 6. Realtime security

Realtime is not an authority.

Prohibited patterns:

- publishing private authoritative state to all clients,
- relying on a realtime event as proof of committed DB state,
- publishing sensitive state before commit,
- bypassing HTTP/server authorization because a socket is connected.

Preferred pattern:

```text
mutation committed
   -> signal emitted
   -> client refreshes authorized projection
```

## 7. Secret handling

Required controls:

- secrets outside source code,
- no secrets in logs or CI artifacts,
- gitleaks/security scanning,
- explicit key rotation strategy,
- environment separation,
- no plaintext fallback,
- minimum privilege for runtime credentials.

## 8. Dependency and supply-chain security

The final documentation must maintain:

- dependency inventory,
- lockfiles,
- supported runtime versions,
- npm/cargo audit evidence where applicable,
- CodeQL/static analysis evidence,
- gitleaks evidence,
- SBOM for release-grade builds,
- review process for high-risk dependency upgrades.

## 9. PostgreSQL security

Required areas:

- least-privilege DB users,
- transaction boundaries,
- schema/migration ownership,
- explicit read/write privileges,
- connection transport security appropriate to environment,
- restore target isolation,
- production source protection during DR validation,
- no accidental restore into production source.

P1-R-01 established recurring isolated DR verification, but that does not itself prove every production database permission is final.

## 10. Backup and DR security

P1-R-01 closed a controlled recurring PostgreSQL DR restore program with:

- encrypted streaming backup,
- key validation,
- checksum,
- decrypt preflight,
- source/target DB and cluster identity checks,
- disposable target marker,
- source read-only safeguards,
- reconciliation evidence,
- redacted JSON evidence,
- scheduled synthetic CI,
- separate PostgreSQL clusters.

Production restore execution remains a separate authorization domain.

## 11. FairPlay MAX security baseline

Future GFPE must enforce:

- `NO FAIRPLAY = NO DEAL`,
- no fallback RNG,
- OS CSPRNG / approved crypto primitives only,
- commit-reveal with anti-equivocation guarantees,
- deterministic shuffle from derived key material,
- unbiased bounded random selection,
- immutable frozen deck/shoe,
- cryptographic commitment before deal,
- signed/tamper-evident proof records,
- replay protection,
- abort-grinding evidence,
- private-card projection,
- restart consistency,
- multi-node fencing.

GFPE v1 must not be marketed as formally certified unless an actual independent certification process is later completed.

## 12. Logging and privacy

Logs must not expose:

- passwords,
- session tokens,
- private keys,
- raw FairPlay seeds before allowed reveal,
- full unrevealed deck,
- other players' private cards,
- plaintext sensitive user content.

Logs should carry identifiers, safe hashes, version numbers, correlation IDs and audit-safe metadata.

## 13. Incident model

Final operational documentation must include playbooks for at least:

- suspected credential compromise,
- signing-key compromise,
- database corruption,
- failed restore,
- unexpected concurrent writer behavior,
- private-data leakage,
- supply-chain compromise,
- FairPlay proof mismatch,
- repeated abort anomaly,
- production rollback.

## 14. Security evidence gate

A subsystem may be called security-verified only after relevant evidence exists:

1. design/threat review,
2. implementation review,
3. negative tests,
4. integration/concurrency tests,
5. static/secret/dependency scans,
6. independent audit where risk justifies it,
7. exact SHA/run evidence.

## 15. Current status

```text
SECURITY MASTER = LIVING DRAFT
CRYPTO KEY SEPARATION P1 = CLOSED EARLIER IN TECHNICAL TRACK
P1-R-01 DR SECURITY CONTROLS = CLOSED
P8 SECURITY REVIEW = CLAUDE AUDIT PENDING
P1-B-01 = TO BE REASSESSED IN FULL PROJECT AUDIT
GFPE SECURITY = PRE-DESIGN ONLY
PRODUCTION SECURITY FINALITY = NOT CLAIMED
```

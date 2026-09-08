# GRACZ.PL — ARCHITECTURE DECISION REGISTER / ADR MASTER

**Document:** TOM 16 / Architecture Decision Register  
**Status:** LIVING DOCUMENTATION / NOT FROZEN  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Verified current-main baseline:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Verified current-main TREE:** `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**P8 / PR #43:** OPEN / NOT MERGED / independent Claude audit pending  
**Merge / deploy / production authorization:** NONE

---

## 1. Purpose

This register is the canonical index of material architectural decisions for Gracz.pl.

It does not replace the detailed architecture, database, security, game, API, operations or FairPlay documents. Its purpose is to record **why the system is designed the way it is**, what alternatives were rejected or deferred, what consequences follow from each decision and whether the decision is currently active, historical, superseded or only planned.

A future maintainer should be able to answer from this register:

1. what decision was made,
2. which problem it solved,
3. which alternatives were considered,
4. why one option was selected,
5. what the technical consequences are,
6. where it is implemented,
7. what evidence supports it,
8. whether the decision still applies.

---

## 2. ADR status vocabulary

- `ACTIVE` — accepted architectural rule currently governing the project.
- `ACTIVE / PARTIAL IMPLEMENTATION` — accepted rule, but not every relevant module has migrated yet.
- `IMPLEMENTED / AUDIT PENDING` — decision is implemented on a controlled branch but final independent audit/merge gate is incomplete.
- `HISTORICAL` — important former or transitional decision retained for provenance.
- `SUPERSEDED` — intentionally replaced by a later ADR.
- `PLANNED / NOT AUTHORIZED` — design direction exists, but implementation is not authorized.
- `REJECTED` — considered and explicitly not selected.

No ADR status implies production deployment.

---

## 3. Governance rule for ADRs

A material architectural change should create or update an ADR when it changes one or more of:

- source of truth,
- trust boundary,
- persistence model,
- concurrency model,
- authentication/authorization model,
- cryptographic domain,
- realtime semantics,
- deployment topology,
- data ownership,
- failure semantics,
- game-wide shared contract,
- public FairPlay proof model.

If a decision is replaced, the old ADR is not deleted. It becomes `SUPERSEDED` and points to its replacement.

---

# 4. MASTER ADR INDEX

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Modular monolith first; preserve bounded-context boundaries | ACTIVE |
| ADR-002 | PostgreSQL is durable authority for critical shared state | ACTIVE |
| ADR-003 | Realtime is signal/transport, never authoritative state | ACTIVE |
| ADR-004 | Critical match mutations use concurrency control, not last-write-wins | ACTIVE |
| ADR-005 | Shared MatchRuntime owns common mutation lifecycle | ACTIVE / PARTIAL IMPLEMENTATION |
| ADR-006 | One valid writer per logical match through ownership fencing | ACTIVE |
| ADR-007 | Durable idempotency for retriable match mutations | ACTIVE |
| ADR-008 | Persistence commits before realtime publication | ACTIVE |
| ADR-009 | Client responses use viewer-safe projections | ACTIVE |
| ADR-010 | Game engines own rules; runtime owns cross-cutting durability/concurrency | ACTIVE |
| ADR-011 | Canonical game identifiers are centralized | IMPLEMENTED / AUDIT PENDING |
| ADR-012 | Security/crypto secrets use domain separation | ACTIVE |
| ADR-013 | Privileged authorization uses RBAC with MFA policy | ACTIVE / FULL RE-AUDIT REQUIRED |
| ADR-014 | Audit log is append-only and sanitized | ACTIVE |
| ADR-015 | Private messages and attachments use application-level authenticated encryption | ACTIVE |
| ADR-016 | Shared distributed rate limiting is required for horizontally scaled sensitive paths | ACTIVE |
| ADR-017 | Disaster-recovery validation uses isolated restore targets and fail-closed identity checks | ACTIVE |
| ADR-018 | Historical/current/pending/production states must be documented separately | ACTIVE |
| ADR-019 | Exact-head CI is required evidence for major closure claims | ACTIVE |
| ADR-020 | Full project audit precedes FairPlay MAX implementation | ACTIVE |
| ADR-021 | FairPlay MAX becomes sole authority for card ordering in future card games | PLANNED / NOT AUTHORIZED |
| ADR-022 | No game-local fallback RNG in FairPlay-critical card dealing | PLANNED / NOT AUTHORIZED |
| ADR-023 | FairPlay shuffle is deterministic from cryptographically derived material | PLANNED / NOT AUTHORIZED |
| ADR-024 | FairPlay proof/privacy must not reveal hidden information improperly | PLANNED / NOT AUTHORIZED |
| ADR-025 | Tysiąc is first full-game proving ground for GFPE | PLANNED / NOT AUTHORIZED |
| ADR-026 | Production change requires separate Owner authorization from code/doc approval | ACTIVE |

---

# 5. DETAILED ADR RECORDS

## ADR-001 — Modular monolith first; preserve bounded-context boundaries

**Status:** `ACTIVE`

### Context

Gracz.pl must support many domains — identity, games, tournaments, messaging, chat, moderation, newsletter, security, audit and later FairPlay — while remaining maintainable and affordable to operate.

### Decision

Prefer a **modular monolith with explicit internal boundaries** before premature microservice decomposition. Separate processes may be introduced where runtime/worker/realtime characteristics justify them, while domain contracts remain explicit.

### Rejected/deferred alternatives

- immediate decomposition into many independent microservices,
- one unstructured application module with direct cross-domain DB writes.

### Rationale

This reduces operational complexity and cost while preserving a future path to physical separation.

### Consequences

- code ownership boundaries must remain explicit,
- modules should not write directly into foreign domain tables without an agreed contract,
- deployment can evolve later without rewriting core domain semantics.

### Evidence/source

- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`,
- `00-FULL-MAX-MASTER/02-ARCHITEKTURA-MASTER.md`,
- current `src/main.js` composition root.

---

## ADR-002 — PostgreSQL is durable authority for critical shared state

**Status:** `ACTIVE`

### Context

Single-process memory cannot safely preserve authoritative multiplayer state across restarts or horizontal scaling.

### Decision

State that must survive restart, support multi-node correctness or form audit/security history is persisted in PostgreSQL or another explicitly approved durable authority. In-memory variants are development/test-compatible paths, not proof of production durability.

### Consequences

- Checkers MatchRuntime state is backed by PostgreSQL,
- Gomoku durable path uses PostgreSQL,
- Tysiąc has PostgreSQL repository support,
- RBAC/MFA/audit/session/security state has durable paths,
- future GFPE ledger/proofs require durable storage.

### Evidence

`14-POSTGRESQL-DATA-CATALOG-TABELA-PO-TABELI.md` documents 30 current-main tables/structures.

---

## ADR-003 — Realtime is signal/transport, never authoritative state

**Status:** `ACTIVE`

### Context

Realtime delivery can be delayed, duplicated, lost or reordered. It cannot be trusted as the authoritative committed state.

### Decision

Realtime transports signals and user-safe projections. Durable domain state remains authoritative. Clients must be able to refresh/reconstruct state from authorized server APIs/storage.

### Consequences

- a missed signal must not corrupt authoritative state,
- publication does not prove persistence unless persistence already committed,
- private authoritative state must not be broadcast indiscriminately.

### Evidence

- P7 MatchRuntime closure,
- `src/match-runtime.js`,
- PostgreSQL realtime hub,
- `02-ARCHITEKTURA-MASTER.md`.

---

## ADR-004 — Critical match mutations use concurrency control, not last-write-wins

**Status:** `ACTIVE`

### Context

Concurrent moves/actions can otherwise overwrite one another or create split-brain state.

### Decision

Critical mutation paths require explicit concurrency protection such as CAS/version/revision/fencing/transactional locks according to the subsystem.

### Current implementations

- Checkers/MatchRuntime: `version` + ownership fencing,
- Gomoku: `revision` CAS,
- Tysiąc: `revision / expectedRevision`,
- tournament critical paths: dedicated concurrency controls from P1-H-01.

### Consequences

Conflict is a valid domain/HTTP outcome and must fail closed rather than silently overwrite.

---

## ADR-005 — Shared MatchRuntime owns common mutation lifecycle

**Status:** `ACTIVE / PARTIAL IMPLEMENTATION`

### Decision

Cross-cutting multiplayer concerns belong in a shared MatchRuntime abstraction rather than being reinvented independently by every game.

### MatchRuntime responsibilities

- durable mutation lifecycle,
- version/CAS,
- ownershipEpoch fencing,
- durable idempotency,
- restart recovery,
- viewer projection contract,
- signal-only realtime.

### Game responsibilities

Game engines own legal game rules and deterministic state transitions.

### Current limitation

Checkers is the reference P7 integration. Gomoku and Tysiąc are not declared fully migrated to MatchRuntime.

### Evidence

PR #40 / P7 / P1-U-02 = merged and closed.

---

## ADR-006 — One valid writer per logical match through ownership fencing

**Status:** `ACTIVE`

### Context

Two runtime instances must not both remain authorized writers after ownership changes.

### Decision

Use monotonic ownership fencing (`ownershipEpoch`) so stale processes fail closed.

### Consequences

- ownership changes invalidate prior writers,
- a stale node cannot commit merely because it still holds in-memory state,
- restart/rebalance behavior must preserve monotonic ownership semantics.

### Evidence

`gracz_match_runtime_ownership`, P7 PostgreSQL tests, Claude PASS for P7.

---

## ADR-007 — Durable idempotency for retriable match mutations

**Status:** `ACTIVE`

### Decision

Retriable mutation requests use durable idempotency keys linked to a command hash and result.

### Consequences

- exact retry can return previously committed result,
- reuse of the same key for another command fails closed,
- process restart does not erase idempotency history.

### Evidence

`gracz_match_runtime_commands`, P7 replay/idempotency tests.

---

## ADR-008 — Persistence commits before realtime publication

**Status:** `ACTIVE`

### Decision

No realtime publication may make an uncommitted mutation appear authoritative. Persistence/transaction success precedes publication.

### Consequence

Publication failure after commit is an operational delivery failure, not a rollback of already durable state.

### Evidence

P7 MatchRuntime contract and tests.

---

## ADR-009 — Client responses use viewer-safe projections

**Status:** `ACTIVE`

### Decision

Raw authoritative game/session state is not automatically client-safe. Every security/privacy-sensitive game path must explicitly produce a viewer-authorized projection.

### Consequences

- hidden/private state remains server-side,
- future card games cannot expose deck/hole-card data through generic serialization,
- projection failure should fail closed.

### Evidence

P7 privacy/projection findings F01/F02/F03 closure and tests.

---

## ADR-010 — Game engines own rules; runtime owns cross-cutting durability/concurrency

**Status:** `ACTIVE`

### Decision

Keep pure game rules independent from HTTP, persistence and distributed-runtime policy where practical.

### Rationale

This preserves testability, reuse and separation of concerns.

### Examples

- Checkers engine vs Checkers MatchRuntime adapter,
- Tysiąc engine vs repository/service/HTTP layers,
- Gomoku domain service vs PostgreSQL implementation.

---

## ADR-011 — Canonical game identifiers are centralized

**Status:** `IMPLEMENTED / AUDIT PENDING`

### Decision

Canonical runtime game identifiers are centrally defined as:

- `checkers`,
- `gomoku`,
- `thousand`.

Compatibility alias:

- `warcaby -> checkers`.

Unsupported/unknown IDs fail closed.

### Context

Historically game identifiers were duplicated across Lobby, Rankings and Tournaments.

### Evidence

P8 / P1-U-01 / PR #43, HEAD `d7220f57d60779584048cc5c695d40dbb948b9cb`.

### Boundary

Not yet part of `main`; independent Claude audit and merge authorization are pending.

---

## ADR-012 — Security/crypto secrets use domain separation

**Status:** `ACTIVE`

### Decision

Authentication/session secrets, MFA encryption, message encryption, attachment encryption, audit hashing and future FairPlay signing/derivation keys are separate cryptographic domains.

### Rejected pattern

Reusing one global `AUTH_SECRET` as the long-term primary key for unrelated cryptographic functions.

### Consequences

- HKDF/domain labels are used where implemented,
- legacy decrypt paths are transitional and observable,
- future GFPE keys must never reuse auth/message/MFA secrets.

### Evidence

P1 crypto separation track / PR #36 and current source modules.

---

## ADR-013 — Privileged authorization uses RBAC with MFA policy

**Status:** `ACTIVE / FULL RE-AUDIT REQUIRED`

### Decision

Privileged operations are authorized server-side through explicit RBAC, with MFA required for privileged-role operations according to policy.

### Roles

`player`, `moderator`, `administrator`, `owner`.

### Boundary

P1-B-01 remains an open/reassessment item for full-project audit. This ADR records the intended active architecture, not a final claim that every negative authorization path is fully proven.

---

## ADR-014 — Audit log is append-only and sanitized

**Status:** `ACTIVE`

### Decision

Security/privileged activity is recorded in an append-only audit structure. Sensitive metadata is sanitized and source/user-agent identifiers may be fingerprinted instead of stored raw.

### Evidence

`gracz_audit_log`, immutability trigger and mutation privilege restrictions in `audit-service.js`.

---

## ADR-015 — Private messages and attachments use application-level authenticated encryption

**Status:** `ACTIVE`

### Decision

Private message content and attachments use application-level AES-256-GCM encryption with separated derived keys/domains.

### Consequences

- plaintext is not stored in the normal current write path,
- AAD binds encrypted objects to metadata/context,
- decryption authentication failure fails closed,
- legacy decrypt is transitional and auditable.

### Evidence

`postgres-accounts.js`, `message-attachments.js`, crypto separation P1 track.

---

## ADR-016 — Shared distributed rate limiting is required for horizontally scaled sensitive paths

**Status:** `ACTIVE`

### Context

Per-process rate limits do not provide reliable global protection when multiple runtime instances serve the same traffic.

### Decision

Security-sensitive shared limits use a distributed PostgreSQL-backed guard where the architecture requires a shared limit. Required shared infrastructure may fail closed if unavailable.

### Evidence

PR #39 / shared infrastructure track, `gracz_shared_rate_limits`.

---

## ADR-017 — DR validation uses isolated restore targets and fail-closed identity checks

**Status:** `ACTIVE`

### Decision

Recurring restore validation must never casually target the source/production database. Restore targets are isolated/disposable and validated using database/cluster identity checks and explicit safety markers.

### Additional controls

- encrypted streaming backup,
- key validation,
- checksum,
- decrypt preflight,
- source read-only protection,
- reconciliation,
- redacted evidence.

### Evidence

P1-R-01 / PR #41 / CI `34053197756` = PASS.

---

## ADR-018 — Historical/current/pending/production states are documented separately

**Status:** `ACTIVE`

### Decision

Documentation must never collapse these states into one:

- historical/reconstructed,
- design target,
- implemented branch,
- merged current-main,
- tested/audited,
- deployed/production verified.

### Rationale

The distinction prevents false claims such as describing P8 as current-main before merge or describing design-only FairPlay as implemented.

### Evidence

FULL MAX MASTER governance, Evidence Register, Traceability Matrix.

---

## ADR-019 — Exact-head CI is required evidence for major closure claims

**Status:** `ACTIVE`

### Decision

For high-risk work, CI used as closure evidence must correspond to the exact final implementation HEAD or have explicitly proven equivalence.

### Consequences

Evidence should record:

- commit SHA,
- TREE SHA,
- workflow/run ID,
- job names/results,
- relevant test counts,
- warnings/exclusions.

### Evidence

P8 exact-head run `34147638975`; CI/QUALITY MASTER.

---

## ADR-020 — Full project audit precedes FairPlay MAX implementation

**Status:** `ACTIVE`

### Decision

FairPlay MAX implementation does not begin on top of an insufficiently reviewed platform foundation. P8 must close, followed by full-project audit, remediation and re-audit before GFPE code implementation authorization.

### Rationale

FairPlay depends on correct persistence, privacy, concurrency, restart, auth and shared runtime behavior.

---

## ADR-021 — FairPlay MAX becomes sole authority for card ordering in future card games

**Status:** `PLANNED / NOT AUTHORIZED`

### Decision direction

Future Tysiąc/Poker/Blackjack/Wojna integrations receive card order/deals through a shared FairPlay Adapter/GFPE Core rather than game-local shuffle logic.

### Boundary

Pre-design only. No implementation authorization.

---

## ADR-022 — No game-local fallback RNG in FairPlay-critical dealing

**Status:** `PLANNED / NOT AUTHORIZED`

### Decision direction

`NO FAIRPLAY = NO DEAL`.

No fallback to:

- `Math.random`,
- timestamp-only randomness,
- UUID-as-randomness,
- emergency local reshuffle,
- manual replacement seed.

### Current-main note

Current Tysiąc game-local RNG is AS-IS and explicitly **not** FairPlay MAX.

---

## ADR-023 — FairPlay shuffle is deterministic from cryptographically derived material

**Status:** `PLANNED / NOT AUTHORIZED`

### Planned design

- OS CSPRNG entropy,
- commit/reveal transcript,
- HKDF-SHA-256 derivation,
- deterministic HMAC/PRF stream,
- Fisher-Yates,
- rejection sampling for unbiased bounded selection,
- immutable frozen deck/shoe.

### Rationale

A deterministic, versioned process allows reproducibility and later proof verification.

---

## ADR-024 — FairPlay proof/privacy must not reveal hidden information improperly

**Status:** `PLANNED / NOT AUTHORIZED`

### Decision direction

Proof/verifiability must be compatible with game privacy. Poker folded/mucked cards and unrevealed deck positions must not become public merely to prove fairness.

### Consequence

Full seed disclosure is not universally acceptable. Selective disclosure/Merkle or more advanced proof schemes may be required depending on the game.

### Important caveat

A Merkle root alone proves commitment to data, not unbiased generation of the permutation.

---

## ADR-025 — Tysiąc is first full-game proving ground for GFPE

**Status:** `PLANNED / NOT AUTHORIZED`

### Decision direction

After GFPE Core acceptance, Tysiąc multiplayer is the first complete production-like integration used to prove:

- deal generation,
- MatchRuntime integration,
- persistence/restart,
- reconnect,
- player privacy,
- proof verification,
- fault behavior.

### Prerequisite

Tysiąc rules must be independently frozen/versioned before final adapter acceptance.

---

## ADR-026 — Production change requires separate Owner authorization from code/doc approval

**Status:** `ACTIVE`

### Decision

A documentation commit, code implementation, CI PASS, Lead PASS, Claude PASS or merge authorization does not by itself authorize production deployment, database migration, Render change, ENV change, DNS/Cloudflare change or production restore.

### Authority

Owner retains explicit final authorization for production actions.

---

# 6. HISTORICAL / TRANSITIONAL DECISIONS TO TRACK

The following areas require later explicit classification during the post-P8 full-project audit:

1. `server.js` vs `server-p7.js` — active / compatibility / dead-code boundaries.
2. file/memory persistence implementations — dev/test compatibility vs remaining runtime dependencies.
3. game-specific concurrency models — whether Gomoku/Tysiąc remain permanently independent or migrate to MatchRuntime.
4. V3 transactional outbox/broker design — target architecture exists, but current-main implementation must not be inferred unless verified.
5. newsletter/email asynchronous outbox model — target vs current implementation.
6. shared presence/realtime store model — target vs current PostgreSQL/listener implementation.

None of these should be marked `ACTIVE IMPLEMENTED` solely because they appear in target V3 documentation.

---

# 7. ADR UPDATE RULE

For every new material architecture decision:

1. allocate the next ADR ID,
2. record context/problem,
3. list meaningful alternatives,
4. record decision and rationale,
5. record consequences/risks,
6. link source code/docs/tests/evidence,
7. assign status,
8. if superseding another ADR, mark both directions explicitly,
9. update Traceability Matrix when implementation/evidence changes.

---

# 8. CURRENT OPEN ADR GAPS

At this checkpoint:

- P8 ADR-011 lacks independent Claude audit and merge evidence,
- P1-B-01 requires full reassessment of RBAC/MFA negative-path coverage,
- Gomoku/Tysiąc full MatchRuntime adoption is undecided/partial,
- V3 outbox/broker remains a target architecture question to verify against current main,
- production topology has not been frozen as AS-BUILT,
- GFPE ADRs 021–025 are design direction only and must be revisited/frozen during GFPE-2+,
- no ADR may claim formal FairPlay certification because none exists.

---

# 9. CURRENT STATUS

```text
ADR MASTER = CREATED / LIVING / NOT FROZEN
CURRENT-MAIN BASELINE = ad0739190fe2f9d1657b2b77c8b5f8e825830c08
P8 / ADR-011 = IMPLEMENTED / AUDIT PENDING / NOT MERGED
GFPE ADR-021..025 = PLANNED / NOT AUTHORIZED
PRODUCTION AS-BUILT ADR SET = NOT YET FINAL
MERGE = NOT AUTHORIZED
DEPLOY = NO
PRODUCTION CHANGE = NO
```

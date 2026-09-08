# GRACZ.PL — CONCURRENCY & INVARIANTS MATRIX

**Document:** TOM 24 / Concurrency & Invariants  
**Status:** LIVING / CURRENT-MAIN BASELINE / AUDIT INPUT  
**Date checkpoint:** 2026-09-08  
**Repository:** `developergracz/gracz-pl-2`  
**Verified current-main:** `ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**P8:** not yet merged at this checkpoint

---

## 1. Purpose

This matrix records the concurrency model and critical state invariants across Gracz.pl. It is designed to answer:

- who may write,
- what version/revision/fence protects the write,
- what transaction boundary is used,
- how retries/idempotency behave,
- what happens to stale writers,
- whether realtime is authoritative,
- what must survive restart.

---

# 2. Global invariants

## INV-GLOBAL-001 — PostgreSQL authoritative when configured

Critical durable services must treat committed PostgreSQL state as authority when their PostgreSQL backend is selected.

## INV-GLOBAL-002 — no stale overwrite

A writer holding stale logical version/revision/ownership must not overwrite newer committed state.

## INV-GLOBAL-003 — persistence before signal

Realtime publication must not create authority. Where state publication exists, successful durable state transition precedes the signal.

## INV-GLOBAL-004 — retries must not duplicate side effects

Where an idempotency/request key exists, exact retry must not execute the logical mutation twice.

## INV-GLOBAL-005 — conflict is explicit

Concurrency conflicts must surface as stable conflict semantics, normally HTTP 409 at HTTP boundary, rather than silent last-write-wins.

## INV-GLOBAL-006 — restart must not reset authoritative logical version

Process restart must reload durable version/revision/ownership state rather than restart logical history at zero.

---

# 3. CHECKERS / MATCHRUNTIME

| Property | Current contract |
|---|---|
| authoritative state | PostgreSQL session/runtime persistence |
| logical version | `expectedVersion` / stored match version |
| stale-writer fence | `ownershipEpoch` |
| durable idempotency | command/idempotency records + stable command hash |
| conflict | MatchRuntime conflict errors, HTTP 409 on move path |
| publication | after persistence; signal-only |
| restart | reload authoritative persisted state |
| viewer output | projection required |

### Invariants

- only current ownership epoch may advance match,
- expected version must equal persisted version,
- duplicate idempotency key with same command may replay safely,
- same idempotency key with different command must conflict,
- failed CAS/ownership conflict must not publish new authoritative state,
- replay returns current authoritative snapshot according to closed P7 contract,
- realtime loss must be recoverable by re-read from PostgreSQL.

### Known scope boundary

P7 cut over Checkers move path as reference adapter. Checkers chat/actions/disconnect/reconnect are not all proven to use shared MatchRuntime.

---

# 4. LEGACY CHECKERS SESSION CAS / P1-C-01

Historical invariant layer:

- `gracz_game_sessions.version`,
- compare-and-swap update by expected version,
- version increments only on accepted write,
- stale write returns `SESSION_CONCURRENCY_CONFLICT`,
- no realtime publish after failed conflicting write,
- initialization protected against multi-instance races.

P7 is now the higher-level shared-runtime model for the move path, but P1-C-01 remains part of the historical safety lineage and regression surface.

---

# 5. GOMOKU

| Property | Current contract |
|---|---|
| authoritative state | `gracz_gomoku_games` when PostgreSQL backend selected |
| logical version | `revision` |
| expected value | current loaded revision used in CAS update |
| idempotency | `requestId` embedded/persisted with move history/state contract |
| conflict | `GOMOKU_CONCURRENCY_CONFLICT` / 409 |
| ownershipEpoch | none in current architecture |
| shared MatchRuntime | not migrated |
| realtime publisher | current audited track had none in this service boundary |

### Invariants

- update succeeds only for expected prior revision,
- stale writer must not overwrite,
- controlled reload after CAS failure is bounded,
- exact matching `userId + requestId` may resolve lost-response replay,
- mismatching retry must not be accepted as the old command,
- concurrent same-ID create with same players may be idempotent,
- same ID with different players conflicts,
- persisted corrupt/invalid state must fail closed,
- restart must preserve logical state and revision.

### Audit requirement

Compare current Gomoku semantics to P7 MatchRuntime and decide whether migration provides sufficient benefit without increasing risk.

---

# 6. THOUSAND / TYSIĄC

| Property | Current contract |
|---|---|
| authoritative state | `gracz_thousand_games` with PostgreSQL repository |
| logical version | `revision` |
| expected write guard | `expectedRevision` |
| ownershipEpoch | none |
| shared MatchRuntime | not migrated |
| FairPlay/GFPE | NOT IMPLEMENTED |

### Invariants

- stale revision must not overwrite newer game state,
- service must persist accepted transition before external clients rely on it,
- restart must reload durable revision/state,
- player projection must not expose hidden cards beyond authorized view,
- future GFPE must replace game-local card-order randomness for FairPlay mode,
- reconnect/retry after future GFPE adoption must never reshuffle or advance deck twice.

### Audit requirement

Current revision model must be deeply reviewed before deciding whether to migrate Tysiąc to MatchRuntime.

---

# 7. TOURNAMENTS / P1-H-01

Concurrency controls include:

- PostgreSQL transaction for report/advance path,
- tournament row locking via `FOR UPDATE`,
- unique `(tournament_id, round, board)` constraint/index,
- insert conflict handling to prevent duplicate advancement matches.

### Invariants

- one logical match result must not be applied twice,
- concurrent result reports must not create duplicate next-round pairings,
- tournament advancement must observe a coherent state,
- unauthorized actor must not race an authorized actor into accepted result,
- standings recomputation must reflect committed results,
- duplicate `(round,board)` pairings must be impossible at DB level.

---

# 8. AUTH SESSIONS

### Required invariants

- token cryptographic validity alone is insufficient where server-side session tracking exists,
- revoked/expired session must fail active-session assertion,
- password reset should revoke previous active sessions according to auth contract,
- concurrent logout/revocation and request use must resolve safely,
- token/session ID uniqueness must not silently collide.

### Audit target

Exact transaction/locking semantics of `gracz_auth_sessions` need dedicated post-P8 concurrency review; current documentation does not overclaim a CAS model where one is not proven.

---

# 9. RBAC ROLE CHANGES

Current PostgreSQL role change path uses a transaction for:

- upsert current role,
- append role history.

### Invariants

- current role and role-history record should commit atomically,
- unauthorized actor must be rejected before mutation,
- privileged target role requires verified MFA,
- administrator cannot elevate to Owner,
- lower/equal actor must not modify equal/higher target contrary to policy.

### Open race questions

Full audit must test:

- two administrators changing same target concurrently,
- Owner and administrator racing role changes,
- role read occurring between authorization check and write,
- whether row locks/CAS are needed to prevent time-of-check/time-of-use privilege races.

This is an intentional open audit item, not a current PASS claim.

---

# 10. OWNER BOOTSTRAP

Current bootstrap condition:

- requested user exists,
- no Owner exists,
- insert Owner row on conflict do nothing.

### Invariant target

At most the intended bootstrap operation may establish initial Owner state.

### Audit risk

Multiple application instances starting concurrently must be checked for whether the SQL condition alone guarantees one-owner bootstrap under the database isolation level. If not, correction may require transaction/lock/unique invariant design.

---

# 11. NEWSLETTER

Potential concurrent domains include:

- subscribe/double-opt-in,
- unsubscribe,
- lifecycle events,
- provider retries,
- admin reads while lifecycle updates occur.

### Required invariants

- double opt-in confirmation must not activate multiple logical subscriptions unexpectedly,
- resend/retry must not duplicate lifecycle semantics,
- unsubscribe must be idempotent,
- email reveal is read-only and privilege/MFA protected,
- analytics/lifecycle recording should not corrupt core subscription state if auxiliary recording fails.

Exact row-lock/CAS behavior is a full-audit item.

---

# 12. PRIVATE MESSAGES / ATTACHMENTS

### Required invariants

- message creation and attachment authorization must bind to correct sender/recipient,
- per-user deletion flags must not incorrectly delete other participant's view,
- duplicate retry behavior should be known/controlled,
- attachment must not become accessible before authorization relation exists,
- concurrent delete/read should preserve privacy semantics,
- encryption metadata and ciphertext must remain internally consistent.

Exact cross-table atomicity is to be verified during full audit.

---

# 13. DISTRIBUTED RATE LIMITING

Current shared layer uses PostgreSQL-backed distributed traffic state plus local process guard.

### Invariants

- local guard executes before shared DB guard for non-health requests,
- health endpoints bypass request-level limiters,
- multiple instances contribute to shared limit,
- shared-infrastructure failure must not silently disable required protection,
- reset/window updates must be atomic enough to prevent material undercount,
- Retry-After semantics must correspond to actual enforced window.

---

# 14. REALTIME / LISTEN-NOTIFY

### Invariants

- notification is not authoritative state,
- event payload is bounded and allowlisted,
- receiving a signal triggers authoritative state reload where designed,
- lost notification must not lose committed state,
- duplicate notification must not duplicate state transition,
- notification order must not be treated as stronger than database version order.

---

# 15. DR / BACKUP / RESTORE CONCURRENCY

### Invariants

- restore target must be isolated and disposable,
- production/source database must never become restore target,
- source must be treated read-only during rehearsal,
- source/target identity mismatch/collision must fail closed,
- only validated/decrypted/checksummed backup stream may restore,
- concurrent/scheduled rehearsal must not interfere with production application state.

P1-R-01 closed this defined technical scope; full audit rechecks integration with current main.

---

# 16. CONCURRENCY CLASSIFICATION MATRIX

| Domain | Guard | Durable? | Explicit conflict? | Idempotency | Multi-instance safety evidence |
|---|---|---:|---:|---|---|
| Checkers MatchRuntime | version + ownershipEpoch | YES | YES | durable key/hash | strong P7 evidence |
| legacy Checkers session | version CAS | YES | YES | limited/historical | P1-C-01 evidence |
| Gomoku | revision CAS | YES | YES | requestId replay | strong P1-AUD3-04 evidence |
| Tysiąc | revision/expectedRevision | YES | YES | service-specific; full audit needed | partial/current tests |
| Tournament advancement | transaction + row lock + unique round/board | YES | YES/controlled | DB uniqueness | P1-H-01 evidence |
| RBAC role change | transaction | YES | authorization errors | N/A | TOCTOU audit needed |
| auth sessions | DB state | YES when PostgreSQL | auth error | token/session specific | audit needed |
| newsletter | DB state | YES when PostgreSQL | domain specific | audit needed | audit needed |
| rate limiting | shared PostgreSQL + local guard | YES/shared | 429 | window semantics | P6 evidence |
| realtime | signal only | N/A as authority | N/A | consumer must tolerate duplicate | P6/P7 architecture |

---

# 17. Full-audit race laboratory

The post-P8 audit/test campaign should include at least:

1. two Checkers writers same expectedVersion,
2. old Checkers owner after new ownershipEpoch claim,
3. duplicate MatchRuntime key same payload,
4. duplicate key different payload,
5. two Gomoku writers same revision,
6. Gomoku lost-response requestId replay,
7. two Tysiąc writers same revision,
8. concurrent tournament result reports,
9. two role changes for same account,
10. concurrent first-Owner bootstrap,
11. auth session revoke vs active request,
12. newsletter confirm vs unsubscribe race,
13. message delete/read cross-user race,
14. shared limiter from multiple app instances,
15. duplicate/lost/out-of-order realtime signals,
16. process crash after DB commit but before realtime publish,
17. process crash before DB commit,
18. DB unavailable mid-transaction.

---

# 18. Future GFPE concurrency invariants — DESIGN ONLY

When FairPlay MAX is implemented, add at minimum:

- one authoritative hand/deck cursor writer,
- no seed reuse,
- no hand ID reuse after abort,
- immutable committed deck,
- no reshuffle after reconnect/restart,
- commit/reveal transcript append-only semantics,
- exactly-once logical deal advancement under retry,
- proof generation bound to committed hand version,
- stale process cannot reveal/deal from superseded epoch,
- abort/grinding attempts recorded and bounded.

Status: `PLANNED / NOT AUTHORIZED`.

---

## 19. Current conclusion

```text
CONCURRENCY MATRIX = BASELINE CREATED
CHECKERS P7 = strongest shared runtime model
GOMOKU = independent revision-CAS model
THOUSAND = independent revision model
TOURNAMENT = transaction + lock + DB uniqueness
RBAC / AUTH / NEWSLETTER / MESSAGE RACES = FULL AUDIT TARGETS
GFPE CONCURRENCY = DESIGN ONLY
PRODUCTION = NOT CHANGED
```

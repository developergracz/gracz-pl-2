# GRACZ.PL — ADVANCED SCALABILITY WAVE A CORRECTION MANDATE

**Date:** 2026-09-09  
**Status:** PREPARED / OWNER-AUTHORIZED NEXT CORRECTION STAGE  
**Correction class:** P0 horizontal correctness + multi-node operations  
**Base repository:** `developergracz/gracz-pl-2`  
**Authorized base branch:** `main`  
**Authorized base SHA:** `06186b4120054d177c0d3d66517edcf2de3ff857`  
**Authorized base TREE:** `0ba0abce0993c145164b20f2881f118e0b71124d`

## 1. Governance

Owner: **Czesław Socha**  
Lead Architect: **ChatGPT / Lead**  
Independent audit evidence: Lead + Gemini + ChatGPT-2  
Final canonical auditor after all corrections/tests/benchmark: **Claude**

This mandate authorizes preparation and implementation of Wave A only on a separate correction branch.

It does NOT authorize:

- merge to `main`,
- deployment,
- Render mutation,
- ENV changes,
- DNS/Cloudflare changes,
- production database mutation,
- Redis/Kafka/Kubernetes introduction,
- PgBouncer production rollout,
- Wave B/C work outside explicit dependency-safe scaffolding.

## 2. Required correction branch

Create from exact base SHA only:

`fix/advanced-scalability-wave-a`

Base must equal:

`06186b4120054d177c0d3d66517edcf2de3ff857`

If `main` changes before branch creation, STOP and rebase/re-authorize the snapshot. Do not silently use another base.

## 3. Wave A scope

Only the following canonical findings are in scope:

- `AS-CAN-F01` PostgreSQL aggregate connection budget
- `AS-CAN-F02` process-local Lobby
- `AS-CAN-F03` process-local Tysiąc realtime
- `AS-CAN-F04` process-local Global Chat realtime/presence
- `AS-CAN-F05` MatchRuntime stale ownership recovery/routing
- `AS-CAN-F06` SSE admission/backpressure/drain
- `AS-CAN-F07` readiness semantics
- `AS-CAN-F08` runtime DDL / multi-replica startup safety

All other findings remain OPEN but OUT OF SCOPE for Wave A unless a minimal prerequisite is technically unavoidable.

## 4. Non-goals

Wave A must NOT:

- replace PostgreSQL as source of truth,
- introduce Kafka,
- introduce Kubernetes,
- introduce microservices,
- force WebSocket migration,
- replace PG distributed rate limiter with Redis,
- implement ranking read model,
- change Gomoku polling architecture,
- optimize Tournament standings,
- redesign FairPlay/GFPE,
- weaken security controls,
- lower password hashing strength.

Minimum necessary complexity is mandatory.

## 5. AS-CAN-F01 — PostgreSQL connection budget

### Required outcome

Create one explicit application-level connection budget contract.

The correction must:

1. inventory all current pool consumers in code/config;
2. remove accidental default `max=10` where a smaller explicit limit is appropriate;
3. define per-service pool limits through one controlled configuration surface or shared factory/registry;
4. identify dedicated LISTEN connection requirements separately;
5. expose aggregate theoretical per-replica maximum in code/test/documentation;
6. fail configuration validation if configured aggregate exceeds an explicit per-replica application budget;
7. preserve bounded acquisition/query timeout behavior on critical infrastructure paths.

### Must NOT assume

- production PostgreSQL `max_connections=100`,
- PgBouncer is already available,
- one shared pool is automatically correct for every workload,
- LISTEN can use transaction pooling.

### Required tests

- exact pool budget calculation test;
- all production pool limits explicit;
- dedicated LISTEN reservation represented correctly;
- invalid over-budget config rejected;
- current configured Wave-A profile remains under declared per-replica budget.

## 6. AS-CAN-F02 — Lobby multi-node

### Required outcome

Lobby rooms/invitations must no longer depend on process-local Maps for authoritative cross-node behavior.

The design should prefer PostgreSQL-backed authoritative lobby state because PostgreSQL already exists as shared infrastructure.

Presence may be ephemeral, but cross-node semantics must be defined explicitly.

### Required invariants

- room created on Node A is visible on Node B;
- invitation created on Node A can be accepted on Node B;
- join on Node B cannot produce `ROOM_NOT_FOUND` solely because room was created on A;
- room capacity and duplicate membership remain concurrency-safe;
- service restart does not silently destroy authoritative waiting-room state;
- stale presence expires predictably;
- unrelated rooms can progress concurrently.

### Required tests

Real PostgreSQL multi-instance tests using two independently constructed LobbyService instances against the same database:

1. create A -> list B;
2. invite A -> accept B;
3. concurrent join A/B for final seat;
4. duplicate join same user across nodes;
5. restart/reconstruct service and verify room state;
6. stale presence expiration.

## 7. AS-CAN-F03 — Tysiąc cross-node realtime

### Required outcome

Preserve PostgreSQL revision-CAS as authoritative write model.

Add cross-node signal delivery using the lowest-complexity proven mechanism. Preferred baseline:

`DB commit -> small PG NOTIFY signal -> each subscribed node rereads authoritative view -> per-user projection -> SSE`

### Required invariants

- no full private game state in NOTIFY payload;
- signal is non-authoritative;
- persistence happens before publication;
- publication failure never rolls back committed state;
- Node B subscriber receives update after Node A commit;
- duplicate signals are harmless;
- listener reconnect does not corrupt state;
- temporary signal loss may cause freshness lag but not data corruption.

### Required tests

- two hub instances against same PG;
- action Node A -> subscriber Node B receives projected update;
- duplicate NOTIFY safe;
- publish failure after commit leaves state correct;
- listener reconnect path;
- viewer-specific/private projection preserved.

## 8. AS-CAN-F04 — Global Chat realtime/presence

### Required outcome

Preserve PostgreSQL durable messages.

Add cross-node signal semantics for chat events and define shared/ephemeral presence behavior.

### Required invariants

- message persisted before broadcast;
- Node B subscriber receives message committed on Node A;
- message duplication from duplicate signal is client-safe/idempotent where necessary;
- presence is not represented as a false global truth from one process-local Map;
- local fallback mode remains bounded for development.

### Required tests

- cross-node chat delivery;
- cross-node presence semantics;
- disconnect/expiry cleanup;
- duplicate/reordered signal tolerance;
- restart behavior.

## 9. AS-CAN-F05 — MatchRuntime ownership recovery

### Required outcome

Keep current fencing guarantees. Add bounded recovery when cached ownership epoch becomes stale.

Acceptable architecture options include:

- one bounded reclaim-and-retry path after verified stale-ownership rejection, or
- explicit owner routing with deterministic stale-cache invalidation.

Do NOT add infinite retries.

### Required invariants

- stale owner can never commit;
- one stale-ownership failure can invalidate local cached epoch;
- recovery is bounded;
- idempotency key semantics are preserved across retry/reclaim;
- expectedVersion conflicts remain distinct from ownership conflicts;
- no retry can execute a command twice authoritatively.

### Required tests

Failure schedule:

1. Node A claims E1;
2. Node B claims E2;
3. request reaches A with stale E1;
4. repository rejects E1;
5. A performs only authorized bounded recovery;
6. command either succeeds once under valid ownership/version or returns a precise conflict;
7. no repeated permanent stale-cache loop.

Also test retry with same idempotency key and version conflict after ownership recovery.

## 10. AS-CAN-F06 — SSE admission, backpressure, drain

### Required outcome

Introduce a common bounded SSE resource policy without replacing SSE.

Required concepts:

- per-user connection cap;
- per-game/channel cap where appropriate;
- global/per-process cap;
- observable active connection counts;
- heartbeat contract;
- cleanup on close/error;
- `response.write() === false` handling / bounded slow-client behavior;
- explicit drain/close API for rolling shutdown.

Exact numeric caps must be conservative defaults/configurable and later validated by benchmark; do not claim capacity from them.

### Shutdown order

Required conceptual order:

`stop admission -> signal/drain SSE -> bounded in-flight HTTP drain -> close listeners/pools -> force deadline`

### Required tests

- one user exceeding cap rejected;
- global cap rejected cleanly;
- close removes subscriber exactly once;
- simulated slow writer does not permit unbounded enqueue;
- shutdown with active SSE completes within test deadline;
- no new SSE accepted after drain starts.

## 11. AS-CAN-F07 — readiness

### Required outcome

Define dependency tiers.

Minimum global-ready dependencies must include those whose failure makes normal traffic broadly unusable, especially the fail-closed shared traffic guard.

Feature-only dependencies should expose health without unnecessarily marking whole node unready if product policy allows degraded service.

### Required tests

- core store unavailable -> 503 ready;
- shared limiter unavailable -> 503 ready if limiter is globally required;
- optional feature degraded -> expected policy result;
- healthy node -> 200 ready;
- readiness bounded by explicit timeout.

## 12. AS-CAN-F08 — startup DDL / replica boot safety

### Required outcome

Normal multi-replica boot must not race on unsafe schema DDL.

Preferred direction:

- explicit schema/bootstrap migration step before app replicas, OR
- one serialized initialization contract where temporary compatibility requires runtime initialization.

Wave A need not redesign all historical migrations, but must remove feasible multi-replica startup races in currently instantiated production services.

### Required tests

- multiple service/application initializers launched concurrently against a clean test DB;
- no duplicate-object/startup failure;
- schema ends in expected shape;
- second/third/fourth initialization is idempotent;
- normal warm startup does not perform unnecessary destructive-style DDL cycles.

## 13. Cross-cutting test requirements

Wave A must add a focused multi-node PostgreSQL test suite.

At minimum prove:

```text
WA-S01 Lobby Node A -> Node B visibility
WA-S02 Lobby concurrent final-seat join
WA-S03 Tysiąc A commit -> B SSE
WA-S04 Global Chat A commit -> B SSE
WA-S05 MatchRuntime stale epoch recovery
WA-S06 SSE admission cap
WA-S07 SSE slow consumer/backpressure handling
WA-S08 graceful shutdown with active SSE
WA-S09 readiness shared-limiter failure
WA-S10 4x concurrent startup initialization
WA-S11 aggregate connection budget calculation
```

No `sleep`-only race tests where deterministic barriers/hooks can be used.

## 14. CI requirements

The correction branch must pass:

- syntax/static checks,
- all existing Node tests,
- Checkers regression,
- Gomoku regression,
- Tysiąc regression,
- Tournament/P8 regression,
- P6 distributed infrastructure tests,
- P7 MatchRuntime tests,
- new Wave A multi-node tests,
- browser tests,
- dependency audit,
- gitleaks,
- CodeQL/security gate.

A failed CI run remains historical evidence and must not be rewritten as green.

## 15. Evidence package after Wave A

Before Wave A can be called corrected, produce:

```text
BASE SHA/TREE
CORRECTION BRANCH
FINAL HEAD/TREE
CHANGED FILE LIST
FINDING -> FILE/COMMIT/TEST MATRIX
EXACT CI RUN IDS
MULTI-NODE TEST RESULTS
KNOWN NON-BLOCKING FINDINGS
KNOWN BLOCKERS
NO MERGE AUTHORIZATION
NO DEPLOY AUTHORIZATION
```

## 16. Wave A closure rule

Allowed Lead state after implementation/tests but before independent audit:

`WAVE A FIX VERIFIED AT CODE+CI LEVEL`

Do NOT call Wave A CLOSED yet.

Final Wave A closure requires independent re-audit of exact corrected snapshot and Lead verification.

Because the overall Advanced Scalability program still requires Wave B + benchmark + benchmark-driven Wave C decisions, successful Wave A does NOT close the full scalability gate.

## 17. Final program sequence

```text
WAVE A corrections
-> code/CI verification
-> independent re-audit if materially required
-> WAVE B corrections
-> observability package
-> k6 + custom SSE/multi-node benchmark: 1 -> 2 -> 4 replicas
-> Wave C only where measurements justify it
-> new final exact HEAD/TREE
-> Claude FINAL ADVANCED SCALABILITY CLOSURE AUDIT
-> Lead final verification
-> scalability gate decision
```

## 18. Absolute safety rules

- `main` stays unchanged until separate merge authorization.
- No production deployment is authorized.
- No production DB change is authorized.
- No external infrastructure purchase/provisioning is authorized by this mandate.
- Redis/PgBouncer/CDN decisions remain evidence-driven unless a later Owner mandate explicitly authorizes them.

END OF WAVE A CORRECTION MANDATE.

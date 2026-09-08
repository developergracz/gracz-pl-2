# GRACZ.PL — FULL MAX MASTER ARCHITECTURE

**Status:** LIVING / CONSOLIDATION DRAFT  
**Implementation authority:** NONE  
**Production authority:** NONE

## 1. Purpose

This document consolidates the top-level architecture of Gracz.pl. It does not replace detailed ADRs, database specifications, game-engine documents or future FairPlay MAX specifications. It provides the system map that all detailed volumes must align with.

## 2. Architectural principles

1. Fail closed on security-, concurrency- and fairness-critical paths.
2. PostgreSQL is the durable authority for state that must survive process restart.
3. Realtime transports signals and user-safe projections; it is not the authoritative state source.
4. Mutations are idempotent and concurrency-safe.
5. Shared infrastructure is preferred over game-local reinvention for cross-cutting concerns.
6. Secrets and cryptographic domains are separated.
7. Every high-risk change must be testable, observable and auditable.
8. Horizontal scaling must not create multiple simultaneous authoritative writers for one logical match/session.
9. Production actions require explicit Owner authorization.
10. Documentation must distinguish design, implementation, merge and production state.

## 3. Logical system map

```text
Browser / Mobile Web
        |
        v
HTTP / Authenticated API Boundary
        |
        +---------------------------+
        |                           |
        v                           v
Platform / Lobby / Identity      Messaging / Profile / Admin
        |
        v
Game Service / Match Adapter
        |
        v
Shared MatchRuntime
        |
        +---------------------------+
        |                           |
        v                           v
Game Engine                    FairPlay Adapter (future)
(Checkers/Gomoku/Thousand)          |
                                    v
                               GFPE Core (future)
        |                           |
        +-------------+-------------+
                      v
                 PostgreSQL
                      |
          +-----------+-----------+
          |                       |
          v                       v
    Read models / projections   Audit / DR / evidence
          |
          v
   Signal-only realtime
          |
          v
       Clients
```

## 4. Current implemented shared-runtime direction

P7 / P1-U-02 established the shared MatchRuntime foundation for the Checkers reference path. Core properties recorded as closed include:

- PostgreSQL expectedVersion/CAS mutation control,
- ownershipEpoch fencing,
- durable idempotency,
- restart recovery,
- mandatory fail-closed projection,
- signal-only realtime,
- Checkers reference adapter / move HTTP cutover.

Important limitation: this does not mean all games or all Checkers actions have already been migrated to MatchRuntime.

## 5. Game domains

### Checkers

Reference game for shared MatchRuntime integration. Existing implementation and regression suites must remain a compatibility anchor while later shared systems evolve.

### Gomoku

Implemented game domain with durability work already completed in earlier P1 track. Migration into every newer shared abstraction must be treated as a separate controlled change, not assumed from Checkers completion.

### Thousand

Existing code/tests are present and provide a starting point, but final multiplayer rules, MatchRuntime integration and future GFPE/FairPlay integration require a fresh audit before reuse decisions.

### Poker / Blackjack / War

Future game domains. Not authorized for implementation at this checkpoint.

## 6. Canonical game-type contract

P8 / P1-U-01 introduces the central runtime identity dictionary:

- `checkers`
- `gomoku`
- `thousand`

with required alias:

- `warcaby -> checkers`

P8 remains open until independent audit and Owner + Lead final authorization.

## 7. Persistence and transaction boundary

Critical state transitions should be atomic within PostgreSQL transaction boundaries where durability and concurrency correctness depend on them.

For shared match mutation, the architectural contract is:

```text
request
  -> authenticate / authorize
  -> validate idempotency
  -> acquire valid ownership epoch
  -> expectedVersion / CAS mutation
  -> durable state + idempotency record
  -> safe projection
  -> commit
  -> realtime signal
```

A realtime publication must never make an uncommitted or failed state authoritative.

## 8. Horizontal scaling contract

For one logical authoritative match/session:

- only one valid writer may succeed for a version/ownership epoch,
- stale nodes fail closed,
- retries must be idempotent,
- process restart must not reset mutation history,
- cache/realtime must not bypass persistence safeguards.

## 9. FairPlay MAX integration boundary

Future GFPE must not replace MatchRuntime. It attaches beneath/alongside the game adapter as the sole authority for cryptographically relevant card ordering and proof generation.

Target boundary:

```text
MatchRuntime
   |
Game Adapter
   |
FairPlay Adapter
   |
GFPE Core
   |
PostgreSQL + FairPlay Ledger
```

The game engine consumes a precommitted/frozen deck or shoe; it does not invent its own RNG.

## 10. Operations architecture

The final production architecture must document and verify:

- deploy topology,
- runtime instances,
- PostgreSQL tier/connection model,
- backup schedule,
- DR restore procedure,
- monitoring/alerting,
- secrets management,
- certificate/domain/DNS dependencies,
- rollout/rollback process.

At this checkpoint these production details must not be inferred as deployed merely because their design exists.

## 11. Architecture review gates

A future architecture claim can be marked `FINAL AS-BUILT` only if:

1. code on final main matches the described boundary,
2. database schema/migrations match the described state,
3. CI evidence exists,
4. independent audit has no unresolved blocking finding,
5. production topology is verified separately,
6. documentation contains exact version/SHA evidence.

## 12. Current status

```text
ARCHITECTURE MASTER = LIVING CONSOLIDATION
P7 MATCHRUNTIME FOUNDATION = CLOSED
P1-R-01 DR PROGRAM = CLOSED
P8 GAME-TYPE DICTIONARY = AUDIT PENDING
FULL PROJECT AUDIT = NOT STARTED
GFPE = PRE-DESIGN ONLY
PRODUCTION V3 = NOT DECLARED READY
```

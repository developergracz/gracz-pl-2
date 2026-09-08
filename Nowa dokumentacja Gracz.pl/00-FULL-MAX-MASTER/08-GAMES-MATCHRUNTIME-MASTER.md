# GRACZ.PL — GAMES & MATCHRUNTIME MASTER

**Status:** LIVING CONSOLIDATION

## 1. Purpose

This volume records the common runtime model for multiplayer games and the boundary between shared infrastructure and game-specific logic.

## 2. Shared runtime responsibilities

Shared MatchRuntime is intended to own cross-cutting concerns such as:

- durable mutation lifecycle,
- expectedVersion/CAS,
- ownershipEpoch fencing,
- idempotency,
- restart recovery,
- safe projection,
- signal-only realtime,
- common mutation/error semantics.

Game engines own game rules, not shared durability/concurrency policy.

## 3. Checkers

Checkers is the reference integration for P7 MatchRuntime work.

Recorded P7 scope included:

- shared MatchRuntime,
- PostgreSQL CAS/versioning,
- ownershipEpoch fencing,
- durable idempotency,
- restart recovery,
- mandatory fail-closed projection,
- signal-only realtime,
- Checkers reference adapter and move HTTP cutover.

Not every legacy Checkers action is implied to be migrated merely by P7 closure.

## 4. Gomoku

Gomoku has prior durability work and focused regression coverage. Full alignment with every newer shared-runtime contract must be verified in the post-P8 full-project audit rather than assumed.

## 5. Thousand

Thousand exists as an implementation/test domain and is planned as the first future real-game proving ground for GFPE/FairPlay MAX.

Before final reuse decision, audit must establish:

- current rule model,
- supported player counts,
- authoritative state design,
- persistence/restart behavior,
- private-card projection,
- MatchRuntime alignment,
- differences between current implementation and desired final product rules.

No final Tysiąc multiplayer/FairPlay implementation is authorized at this checkpoint.

## 6. Canonical game identity

P8 centralizes runtime identities:

- `checkers`
- `gomoku`
- `thousand`

Alias:

- `warcaby -> checkers`

Selectors such as ranking `all` are not game identities.

Capability differences may exist by subsystem and should fail explicitly rather than silently route to another game.

## 7. Future card games

### Poker

Future game with private hole cards, community cards, fold/showdown privacy and strongest Verify Hand requirements.

### Blackjack

Future game based on a committed shoe rather than independent per-hand reshuffle.

### War

Future simpler full-deck adapter suitable for transparent proof/reveal patterns.

None are authorized for implementation now.

## 8. Common game-adapter contract — target

A future shared adapter should expose a narrow boundary such as:

```text
load authoritative state
validate command
apply game rules
request deterministic FairPlay deal if card game
produce next authoritative state
produce player-safe projections
persist through MatchRuntime
signal change after commit
```

## 9. Reconnect/restart invariants

A reconnect or process restart must not:

- create a new logical match,
- repeat a committed mutation,
- lose idempotency history,
- reset ownership/version state,
- leak private state,
- reshuffle an existing FairPlay deck/shoe.

## 10. Full-project audit questions

- Which game paths still bypass MatchRuntime?
- Which mutations remain memory-only?
- Are projections consistent and fail closed?
- Are reconnect paths authoritative and idempotent?
- Can duplicate/reordered realtime events corrupt client behavior?
- Are canonical game IDs consistently used after P8?
- Are rules/tests aligned with the intended final product?

## 11. Current status

```text
GAMES MASTER = LIVING
CHECKERS P7 REFERENCE PATH = CLOSED FOR DEFINED SCOPE
GOMOKU DURABILITY TRACK = CLOSED EARLIER / FULL ALIGNMENT TO BE RE-AUDITED
THOUSAND = EXISTING DOMAIN / FUTURE REUSE DECISION PENDING
P8 CANONICAL GAME TYPES = CLAUDE AUDIT PENDING
POKER / BLACKJACK / WAR = FUTURE / NOT AUTHORIZED
```

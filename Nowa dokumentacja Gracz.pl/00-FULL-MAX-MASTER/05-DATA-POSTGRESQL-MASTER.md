# GRACZ.PL — DATA & POSTGRESQL MASTER

**Status:** LIVING CONSOLIDATION  
**Production migration authorization:** NONE

## 1. Purpose

This volume consolidates the durable-data contract for Gracz.pl. Detailed AS-IS/V3 schema documents and migration files remain authoritative for exact columns and SQL; this document defines the cross-system rules that must remain true.

## 2. PostgreSQL role

PostgreSQL is the durable authority for state that must survive restart, concurrency, horizontal scaling or audit requirements.

Critical domains include:

- users/identity,
- game/match state,
- idempotency records,
- tournament state,
- messaging/profile data where applicable,
- audit/event evidence,
- DR metadata,
- future FairPlay session/ledger data.

## 3. Data-state rules

1. Critical mutation state is committed transactionally.
2. Versioned match state must reject stale expectedVersion updates.
3. Ownership/fencing metadata must survive restart.
4. Idempotency state must be durable when duplicate execution would be unsafe.
5. Realtime/cache state cannot replace durable authority.
6. Migration history must be reproducible and ordered.
7. Production schema changes require explicit authorization and evidence.

## 4. Existing documentation baseline

The existing `02-BAZA-DANYCH` package records AS-IS and V3 target design, including migration mapping. This FULL MAX volume does not silently rewrite those facts; future full-project audit must reconcile them against current code and current database assumptions.

## 5. Concurrency contract

For mutation of a logical aggregate, preferred pattern:

```text
BEGIN
  load authoritative row/state
  verify identity/authorization
  verify expectedVersion / ownershipEpoch
  verify idempotency key
  apply mutation
  persist new version
  persist idempotency outcome
COMMIT
publish signal after commit
```

If any precondition fails, mutation fails closed and no success realtime event may represent the rejected change as committed.

## 6. Migration governance

Every production-impacting migration must eventually document:

- migration identifier,
- purpose,
- preconditions,
- forward SQL,
- rollback/mitigation strategy,
- expected lock behavior,
- expected duration/size sensitivity,
- compatibility window,
- verification query,
- backup anchor,
- Owner authorization,
- execution evidence.

## 7. Backup / restore relationship

P1-R-01 established a recurring isolated restore program with separate source/restore identity controls. This is evidence of DR capability, not permission to restore into production or mutate production.

## 8. Future FairPlay data model requirements

GFPE will require durable records for at least:

- FairPlay session identity,
- protocol/game rules version,
- commitments,
- reveal state,
- derived deck/shoe commitment,
- cursor,
- lifecycle state,
- abort/completion reason,
- audit sequence,
- proof metadata,
- signing key ID,
- build SHA.

Secrets/raw seeds must be stored only according to the later frozen crypto/key-lifecycle specification.

## 9. Privacy / retention boundary

Every table/domain in final AS-BUILT must identify:

- data owner,
- purpose,
- sensitivity,
- retention,
- deletion/anonymization behavior,
- legal-hold behavior,
- encryption needs,
- backup retention implications.

## 10. Audit questions for full-project audit

- Are all critical writes actually transactional?
- Are there remaining memory-only correctness dependencies?
- Are version/fencing checks consistent across games?
- Are indexes adequate for target workloads?
- Are FK/unique/check constraints enforcing intended invariants?
- Do migrations match current runtime assumptions?
- Are DB permissions least-privilege?
- Can horizontal scaling create duplicate writers or duplicate side effects?
- Does restore validation cover current schema and data expectations?

## 11. Current status

```text
DATA MASTER = LIVING
ETAP 1B / ETAP 2 DOCUMENTATION = HISTORICALLY CLOSED
P1-R-01 DR PROGRAM = CLOSED
PRODUCTION MIGRATION = NOT AUTHORIZED
GFPE DATA MODEL = PRE-DESIGN / NOT FROZEN
FINAL AS-BUILT DB STATE = NOT YET ESTABLISHED
```

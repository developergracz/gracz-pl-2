# C11-A — Canonical PostgreSQL Migration Contract

Project: Gracz.pl  
Program: Advanced Scalability / Wave B Correction Round 1  
Finding: `WB-C11-A01 — P1 — CANONICAL POSTGRESQL MIGRATION AUTHORITY MISSING`  
Status: `ARCHITECTURE CONTRACT ESTABLISHED — IMPLEMENTATION NOT YET COMPLETE`  
Blocking: YES — C11 remains blocked until the implementation and acceptance gates below pass.  
C12: `NOT AUTHORIZED / NOT STARTED`

## 1. Frozen source snapshot

This contract was authored from:

- branch: `fix/wave-b-correction-round-1`
- source HEAD: `2bd3c437b6ee27fc89cb4239654509091f96bcde`
- source TREE: `891f5c2f665e29d5e533ffecdd763d3d15463a92`

If implementation starts from a different snapshot, the implementing engineer MUST record the new HEAD/TREE and re-check schema ownership drift before changing DDL ownership.

## 2. Architectural problem

There is no single executable migration authority that can deterministically transform an empty PostgreSQL database into the complete schema required by the current Gracz.pl runtime.

DDL ownership is currently distributed across runtime services and test fixtures. Gomoku differs from several other modules: its PostgreSQL service validates its required schema fail-closed but does not create the canonical table. A benchmark or clean environment that drops and recreates `public` therefore cannot rely on one supported command to rebuild the application schema before startup.

This is an architectural defect, not a benchmark-only fixture defect. C11 MUST NOT be unblocked by adding ad-hoc `CREATE TABLE` statements to the benchmark workflow.

## 3. Current schema-ownership inventory

The following runtime-owned DDL was verified on the frozen snapshot and MUST be incorporated into the migration inventory before ownership is removed from runtime:

| Area | Current owner | Verified DDL / dependency |
|---|---|---|
| Accounts / private messages | `src/postgres-accounts.js` | `gracz_accounts`, `gracz_messages`, column ALTERs, message indexes |
| Checkers sessions / common match runtime | `src/postgres-session-store.js` | `gracz_game_sessions`, `gracz_match_runtime_ownership`, `gracz_match_runtime_commands`, indexes |
| Gomoku | `src/postgres-gomoku-service.js` | validates required schema; does not provide canonical create migration |
| Tysiąc | `src/thousand-repository.js` | `gracz_thousand_games`; also invokes ranking schema/trigger installation |
| Rankings | `src/ranking-materialization.js` | ranking tables, indexes, state row, PL/pgSQL functions and triggers |
| Distributed rate limiting | `src/distributed-infrastructure.js` | `gracz_shared_rate_limits`, reset index |
| Security monitoring | `src/security-monitor.js` | `gracz_security_monitor_buckets`, `gracz_security_monitor_alerts`, lookup index |
| Audit | `src/audit-service.js` | `gracz_audit_log`, indexes, append-only function/trigger, privilege hardening |
| Global Chat | `src/distributed-global-chat.js` | topics, messages, friends, reports, presence, indexes, admission function/trigger |
| Tournaments | `src/tournaments.js` | tournaments, tournament players, matches, indexes |
| Newsletter | `src/newsletter.js` | subscribers table, historical ALTERs, indexes |

This table is a verified minimum inventory, not permission to assume it is exhaustive. Before the first migration set is accepted, the implementation phase MUST scan the entire `modern/checkers-engine` tree for all PostgreSQL DDL including `CREATE`, `ALTER`, `DROP`, functions, triggers, indexes, sequences, grants/revokes and extensions.

## 4. Canonical authority

The target authority SHALL be:

```text
modern/checkers-engine/
  db/
    migrations/
      001_*.sql
      002_*.sql
      ...
  scripts/
    migrate-postgres.mjs
```

The migration history table SHALL be named:

`gracz_schema_migrations`

After transition, application runtime components SHALL consume and validate schema; they SHALL NOT independently evolve permanent application schema during ordinary application startup.

Temporary compatibility code MAY exist only during the controlled transition and MUST be explicitly listed with a removal gate.

## 5. Migration identity and immutability

Each migration MUST have:

- a unique monotonically increasing numeric version;
- a stable descriptive filename;
- SHA-256 checksum of exact file bytes;
- applied timestamp recorded in `gracz_schema_migrations`;
- explicit transactional policy.

Once a migration is accepted on the protected migration lineage, its contents are immutable. A checksum mismatch MUST fail closed. Fixes are new migrations, not edits to historical migrations.

## 6. Runner contract

`migrate-postgres.mjs` MUST:

1. require an explicit PostgreSQL connection target;
2. acquire one dedicated PostgreSQL advisory lock for the migration authority;
3. create/validate `gracz_schema_migrations` under that lock;
4. discover migrations in deterministic numeric order;
5. reject duplicate versions, malformed filenames or gaps contrary to the chosen sequence policy;
6. verify checksums of already-applied migrations;
7. apply only pending migrations;
8. execute each transactional migration atomically;
9. record the migration only after its DDL succeeds;
10. release the lock in success and failure paths;
11. return non-zero on checksum drift, partial/invalid history, lock/DB failure or migration error;
12. emit no secrets or full connection strings in logs.

The normal application process MUST NOT silently invoke destructive or mutating migration behavior as a side effect of serving traffic.

## 7. Concurrency contract

The migration mechanism MUST be safe when 1, 2 or 4 replicas start at the same time.

Required behavior:

- exactly one migration authority holds the advisory lock at a time;
- followers wait within a bounded startup/deployment policy or fail clearly;
- no duplicate DDL races;
- no partially recorded migration;
- no replica serves as ready against a schema version that it cannot safely use.

Existing module-specific schema advisory locks do not replace this global migration authority.

## 8. Clean-install path

The supported clean path MUST become:

```text
EMPTY DATABASE
  -> canonical migration runner
  -> schema verification
  -> application boot
  -> readiness PASS
  -> tests / benchmark seed
```

No test or benchmark may claim clean-install validity if it reconstructs required production schema with test-only ad-hoc DDL.

## 9. Existing-installation adoption path

An existing Gracz.pl database MUST NOT be automatically marked as migrated.

Before adoption, a separate non-production rehearsal MUST:

1. inventory existing objects, columns, types, constraints, indexes, functions, triggers and required privileges;
2. compare them with the canonical baseline fingerprint;
3. classify every difference as compatible, migration-required or blocking;
4. verify row/data invariants needed by constraints and type changes;
5. produce an adoption/baseline record tied to an exact schema fingerprint;
6. prove backup/restore and rollback/recovery procedure.

Any real production baseline/adoption remains a separate Owner-authorized operational gate. This C11-A contract authorizes no production database mutation.

## 10. Runtime validation after transition

Fail-closed schema validation remains required where correctness depends on exact schema shape.

In particular, Gomoku MUST continue to reject a missing or incompatible schema with its schema-invalid error path rather than creating an unknown schema opportunistically.

Runtime validators and the migration authority have different responsibilities:

- migration authority: create/evolve known schema;
- runtime validator: verify the schema is safe to use.

## 11. CI contract

The canonical PostgreSQL CI path MUST include an ephemeral PostgreSQL database and execute, in order:

1. start empty PostgreSQL;
2. run canonical migrations;
3. verify migration history/checksums;
4. boot application;
5. run relevant PostgreSQL integration tests;
6. run schema/correctness gates.

Tests may still create isolated temporary fixtures when the fixture is intentionally not application schema. Tests MUST NOT substitute fixture DDL for canonical application migrations.

## 12. Mandatory acceptance tests

C11-A implementation is not complete until all of the following are evidenced on an isolated non-production PostgreSQL instance:

- empty DB -> all migrations -> PASS;
- second migration run -> no-op PASS;
- 2 concurrent migrators -> PASS;
- 4 concurrent migrators -> PASS;
- intentionally interrupted transactional migration -> rollback/no partial history PASS;
- modified historical migration checksum -> fail-closed PASS;
- duplicate/malformed migration identity -> fail-closed PASS;
- complete schema verifier -> PASS;
- application cold start, 1 replica -> PASS;
- application cold start, 2 replicas -> PASS;
- application cold start, 4 replicas -> PASS;
- Gomoku validator after canonical migration -> PASS;
- missing/broken Gomoku schema -> still fail-closed PASS;
- relevant full CI -> PASS.

## 13. Transition rule for runtime DDL

Removal of current runtime DDL MUST be staged, not performed in one blind rewrite.

For each schema owner:

1. capture exact current DDL and dependencies;
2. encode equivalent canonical migration(s);
3. prove clean migration and compatibility tests;
4. change runtime initializer from creator/evolver to validator/consumer;
5. rerun the affected integration and concurrency tests;
6. only then remove obsolete schema-mutation code.

No table/function/trigger may lose its only creation path during transition.

## 14. C11 unblock gate

C11 may resume only when Lead Architect audit has evidence that:

- canonical migration authority exists and is deterministic;
- verified full DDL inventory is represented;
- clean DB migration is reproducible;
- concurrency and interruption tests pass;
- current application boots from the canonical schema;
- Gomoku is included without benchmark-only schema creation;
- Wave B benchmark setup invokes the canonical migration path;
- no production environment was mutated to obtain the evidence.

Only after that gate may B1/C11 benchmarking be rerun from a fresh isolated database.

## 15. Governance

This document does NOT authorize:

- merge to `main`;
- deploy;
- production PostgreSQL migration or baseline adoption;
- Render resource or environment changes;
- DNS / Cloudflare changes;
- C12;
- Wave B closure;
- production-ready declaration.

Current architectural state after this contract:

- `WB-C11-A01`: OPEN, contract established, implementation required;
- `C11`: BLOCKED by C11-A implementation/acceptance;
- `C12`: NOT AUTHORIZED / NOT STARTED;
- `Wave B Correction Round 1`: INCOMPLETE.

## 16. Next implementation slice

The next permitted engineering slice should be `C11-B — MIGRATION RUNNER + COMPLETE DDL INVENTORY`, executed only on the correction branch and isolated PostgreSQL.

C11-B should create the migration runner/history mechanism and machine-verifiable full DDL inventory before moving all runtime-owned schema into migration files. This keeps the change reviewable and prevents a high-risk all-at-once schema rewrite.

# Gracz.pl V3 migrations

This directory is owned by the dedicated migrator, not by the application runtime.

## File contract

- SQL files use `NNN_name.sql`, starting at `001` with no gaps.
- A migration version is immutable after it has been applied anywhere outside disposable local development.
- Every migration is checksummed with SHA-256 and recorded in `gracz_schema_migrations`.
- A checksum/name mismatch is a hard stop.
- Normal `npm start` must never execute files from this directory.
- The migrator requires `MIGRATOR_DATABASE_URL`; it does not fall back to runtime `DATABASE_URL`.
- Each migration is executed in its own transaction with lock and statement timeouts.
- DDL/DCL belongs here. One-time data backfills require an explicit migration decision and must not be hidden in runtime startup.

## Rollback policy

Gate 14A/Gate 15 default is forward-fix. Destructive automatic down-migrations are not provided. Rollback means restoring the pre-approved application/database state according to the Gate 15 runbook or applying a reviewed forward corrective migration.

## Current Gate 14A.2 state

The migration runner and schema-check contract exist, but the 79 inventoried runtime DDL/DCL statements have not yet all been extracted into versioned SQL files. Do not activate `assertRuntimeSchema()` in `src/main.js` and do not run the migrator against production until extraction, code reconciliation, tests, Gate 14B role design, and explicit authorization are complete.

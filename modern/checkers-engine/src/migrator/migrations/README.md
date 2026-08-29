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

## Current Gate 14A.4 state

The 79 inventoried runtime DDL/DCL statements have been extracted into migrations `001` through `014` on the isolated audit branch. Runtime modules perform schema verification instead of self-migration.

`assertRuntimeSchema()` is wired before the first PostgreSQL-backed service is created. When `DATABASE_URL` is present, runtime requires `gracz_schema_migrations` to match the exact migration sequence, names and SHA-256 checksums; otherwise startup fails closed.

This branch must not be deployed to Render or production before the reviewed migration sequence has been applied to the target database. The migrator must not be run against production until Gate 14B role design, Gate 14C crypto remediation, Gate 14D production configuration, Gate 15 controls, and explicit authorization allow it.

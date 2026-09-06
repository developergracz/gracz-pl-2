# Gracz.pl — recurring PostgreSQL DR restore rehearsal

## Purpose

This runbook defines the recurring disaster-recovery restore rehearsal for the current PostgreSQL-backed Gracz.pl runtime. The rehearsal is evidence-first and source-read-only: it creates an encrypted logical backup from the configured source database, restores it only into a disposable PostgreSQL database, verifies the restored schema, records timing evidence, and deletes the temporary encrypted backup from the runner.

It does **not** deploy application code, modify Render, change DNS, rotate secrets, or write to the source database.

## Automation

Workflow: `.github/workflows/p1-r-01-dr-restore.yml`.

- Pull requests run a synthetic PostgreSQL 16 rehearsal with strict per-table row-count reconciliation.
- The default branch runs the production-source rehearsal every Sunday at 03:17 UTC and can also be started manually.
- Scheduled/manual runs fail closed if `DR_SOURCE_DATABASE_URL` or `DR_BACKUP_ENCRYPTION_KEY` is absent.
- The restore target is a disposable PostgreSQL 16 service database created inside the GitHub Actions runner.
- Only JSON evidence is uploaded. Database backups are never uploaded as workflow artifacts.

Required repository secrets after approval/merge:

- `DR_SOURCE_DATABASE_URL` — a source connection intended for backup/read access. It must not point at the disposable restore database.
- `DR_BACKUP_ENCRYPTION_KEY` — dedicated DR backup encryption material, separate from application/authentication secrets.

## Safety invariants

1. Source and restore database identities must differ. The rehearsal aborts before backup if they are the same.
2. The source path uses `pg_dump` and read-only verification queries only.
3. Restore uses `--clean --if-exists` only against the disposable restore database.
4. Database dump bytes are streamed through OpenSSL encryption; no plaintext dump file is persisted.
5. Restore decrypts directly into `pg_restore`; no plaintext dump file is persisted.
6. The encrypted temporary backup is removed when the rehearsal process exits.
7. No database URL, password, encryption key, or decrypted application data is written to the evidence JSON.
8. A failed checksum, restore, schema check, strict reconciliation, or time objective returns a non-zero exit code.

## Evidence contract

Each successful run creates exactly one `dr-restore-YYYYMMDDTHHMMSSZ.json` record containing:

- start and finish timestamps,
- SHA-256 of the encrypted backup,
- backup duration,
- restore duration,
- observed RTO from backup availability through verified restore,
- configured RTO target,
- conservative rehearsal recovery-point age upper bound,
- configured rehearsal RPO target,
- source/restored public table counts,
- strict row reconciliation status when requested,
- explicit `source_mutated=false`,
- explicit `restore_is_disposable=true`.

The default targets are:

- RTO rehearsal target: 1800 seconds,
- recovery-point-age rehearsal target: 3600 seconds.

These are operational rehearsal targets, not a claim about provider snapshot retention or a contractual production SLA. A production RPO claim additionally requires evidence for the actual production backup cadence/retention policy.

## Pull-request acceptance

The synthetic gate must prove all of the following on PostgreSQL 16:

- encrypted backup succeeds,
- checksum verification succeeds,
- restore succeeds,
- public schema table count is preserved,
- strict per-table row counts are identical for the frozen synthetic source,
- same-database restore is rejected before any destructive restore action,
- JSON evidence is produced,
- no encrypted backup is uploaded as an artifact.

## Recurring-run response

A scheduled failure is a DR blocker until classified. Investigate in this order:

1. missing/expired DR secrets or source connectivity,
2. backup/checksum failure,
3. restore failure or PostgreSQL version incompatibility,
4. schema verification failure,
5. RTO/RPO rehearsal target exceeded.

Do not weaken the gate to make a failing rehearsal green. Fix the root cause and rerun the workflow manually. Preserve the failed workflow run and the next successful evidence artifact for audit history.

## Production activation boundary

This branch only implements and tests the DR program. Activation of recurring production-source rehearsals requires the approved workflow to exist on the default branch and the two dedicated DR secrets to be provisioned. No production database mutation is required for activation.

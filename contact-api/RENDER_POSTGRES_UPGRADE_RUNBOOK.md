# Render Postgres upgrade and recovery runbook

Status: **PLANNED — do not execute until the scheduled upgrade window**

This runbook prepares the existing Render Postgres database used by gracz.pl for
the future transition from the Free compute plan to a paid compute plan.

It does **not** authorize the contact-data backfill by itself. Backfill remains
blocked until the recovery gate and encryption-secret escrow gate are both
verified.

## Current production database snapshot

Observed from the Render API on 2026-10-08:

- Render Postgres ID: `dpg-db38btt9fdbs73aadohg-a`
- name: `gracz-r4-staging-postgres`
- database: `gracz_r4_staging_postgres`
- role: primary
- region: Frankfurt
- PostgreSQL: 18
- compute plan: Free
- status: available
- network IP allowlist: empty
- Free-plan expiry reported by Render:
  `2026-11-06T17:48:39.071132Z`

The database name contains `staging`, but this instance is the database
currently used by the production contact/persistence workflow. Always identify
the target by Render database ID, not by name alone.

## Why the upgrade is required

Render does not provide recovery capabilities or managed logical backups for a
Postgres database on the Free compute plan.

After moving to a paid Postgres compute plan, Render provides point-in-time
recovery (PITR). Render also allows on-demand logical backup exports from the
database Recovery page.

The recovery window starts going forward. Do not assume that upgrading creates a
retroactive recovery point for time before the upgrade.

Official references:

- https://render.com/docs/free
- https://render.com/docs/postgresql-backups

## Pre-upgrade gate

Before changing the plan:

1. Confirm the target database ID is exactly
   `dpg-db38btt9fdbs73aadohg-a`.
2. Confirm the database status is `available`.
3. Confirm the application is using this database.
4. Confirm `gracz-contact-api` is healthy.
5. Review production logs for persistence/decrypt errors.
6. Record the currently deployed application SHA.
7. Confirm no migration 005 exists.
8. Confirm contact-data backfill has not been run.
9. Keep the database IP allowlist unchanged unless Render itself requires
   otherwise.
10. Select the intended paid Postgres compute plan in the Render Dashboard.

STOP if target identity, health, deployment SHA, or writer state is uncertain.

## Upgrade

In Render Dashboard:

1. Open the existing Postgres database by ID
   `dpg-db38btt9fdbs73aadohg-a`.
2. Change its **compute plan** from Free to the approved paid Postgres plan.
3. Do not create a replacement production database unless the operator
   deliberately chooses a migration strategy.
4. Wait until Render reports the database as `available`.
5. Do not run the contact-data backfill yet.

This is a compute-plan change, not a PostgreSQL major-version upgrade. The
database already runs PostgreSQL 18.

## Immediate post-upgrade verification

After the plan change:

1. Re-read the database from Render and confirm:
   - same database ID;
   - expected paid compute plan;
   - status `available`;
   - PostgreSQL 18;
   - Frankfurt region;
   - expected network allowlist.
2. Verify `gracz-contact-api` is LIVE.
3. Verify `/health` through the normal production health mechanism.
4. Review logs for:
   - connection failures;
   - persistence failures;
   - migration failures;
   - decrypt/authentication failures.
5. Do not rotate `DATABASE_URL` or the encryption secret unless a separate
   approved change requires it.

STOP on any unexpected connection or persistence behavior.

## Recovery gate — PITR

After the paid plan is active:

1. Open the database **Recovery** page in Render.
2. Confirm Point-in-Time Recovery is available.
3. Record the earliest and latest selectable restore times.
4. Do not treat PITR availability alone as proof of restorability.
5. Perform a real recovery rehearsal to a separate temporary recovery database
   when an eligible restore point exists.
6. Verify the recovery instance reaches `available`.
7. Verify the restored schema and aggregate production-safe counts.
8. Do not point production services at the recovery instance during the
   rehearsal.
9. Delete or suspend the temporary recovery instance after verification if it is
   no longer needed.

Render does not permit restoring to a time within approximately ten minutes of
the current time, so wait until an eligible restore point exists.

## Recovery gate — logical export

Also create an explicit logical backup from Render's Recovery page:

1. Click **Create export**.
2. Wait for the export to complete.
3. Download the export to secure operator-controlled storage.
4. Verify that the archive can be enumerated with the appropriate
   `pg_restore --list` command for its format.
5. Prefer a real disposable restore rehearsal before any destructive schema
   change.
6. Record only the backup timestamp and verification result in operational
   notes. Do not commit the backup itself to Git.

A backup file that has never been checked is not considered a verified recovery
artifact.

## Encryption-secret escrow gate

`CONTACT_DATA_ENCRYPTION_SECRET` must have an independent recovery copy outside
the running Render service before backfill.

Requirements:

- keep the exact existing production secret;
- store it in an operator-controlled password manager or equivalent secure secret
  vault;
- never paste the secret into GitHub issues, PRs, commits, logs or chat;
- record only that escrow was verified, not the secret value;
- do not rotate the secret as part of the database compute-plan upgrade.

The recovery database plus ciphertext is not useful for encrypted contact
metadata if the production encryption secret is lost.

## Gate to contact-data backfill

The backfill in
`contact-api/PRODUCTION_BACKFILL_RUNBOOK.md`
may begin only after all of the following are true:

- paid Postgres plan is active;
- database is healthy after upgrade;
- PITR is available;
- a recovery rehearsal has succeeded;
- a logical backup/export exists and is verified;
- encryption-secret escrow is independently verified;
- the writer SHA and cutoff provenance are still valid;
- a fresh read-only contract-prep inspection passes;
- no old writer is active.

Only then may the controlled backfill of legacy rows be authorized.

## After backfill

Do not immediately proceed to migration 005.

Follow the separate backfill runbook:

1. first controlled backfill;
2. two idempotency reruns requiring `updatedRows = 0`;
3. fresh read-only verification;
4. observation period;
5. separate audit and authorization for migration 005.

## STOP conditions

Stop before any backfill or CONTRACT write if any of these occur:

- database ID mismatch;
- unexpected replacement database;
- upgrade status not `available`;
- PITR unavailable;
- recovery rehearsal fails;
- logical backup/export cannot be verified;
- encryption-secret escrow not verified;
- application connection/persistence error after upgrade;
- unexpected schema/migration drift;
- uncertain writer cutoff;
- old writer activity;
- any contact-data cryptographic verification failure.

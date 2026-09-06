# Gracz.pl — P1-R-01 recurring PostgreSQL DR restore program

## Purpose and safety boundary

P1-R-01 proves that an encrypted PostgreSQL logical backup can be restored and reconciled without mutating the source database. The source side is limited to `pg_dump` and read-only `psql` queries.

Restore is allowed only when all of the following are proven:

- source and restore database identities differ;
- source and restore PostgreSQL **cluster system identifiers differ**;
- the target database comment is exactly `gracz-dr-disposable`;
- checksum and decryptability checks pass before restore.

A different database on the same PostgreSQL cluster is **not** considered an isolated DR target.

This program does **not** deploy application code, modify Render, DNS, Cloudflare, production environment variables, provision secrets, run production migrations, or write to production PostgreSQL.

## Files

- `ops/backup-postgres.sh` — streams `pg_dump` directly through OpenSSL encryption, atomically publishes only the encrypted artifact, and writes SHA-256 sidecar evidence.
- `ops/test-restore-postgres.sh` — verifies source/target database and cluster identity, disposable marker, checksum and decryptability before streaming decryption into `pg_restore`.
- `ops/dr-restore-rehearsal.sh` — runs the complete rehearsal, schema/row reconciliation and machine-readable JSON evidence.
- `ops/test-dr-restore-program.sh` — real PostgreSQL acceptance/negative suite using separate source and restore clusters.
- `.github/workflows/p1-r-01-dr-restore.yml` — CI, recurring synthetic rehearsal, regressions and security gates.

## Encryption key

`BACKUP_ENCRYPTION_KEY` is a base64 value that must decode to exactly 32 bytes. It must be dedicated to DR backups and must never be committed.

Generate a new value locally with a cryptographically secure generator, for example:

```bash
openssl rand -base64 32
```

Store it only in an approved secret store. The repository and GitHub workflow contain no durable backup encryption key; synthetic CI keys are generated at runner execution time.

### Rotation

1. Create a new 32-byte base64 key in the secret store.
2. Keep the old key available until all backups encrypted with it have expired under retention policy.
3. Update the secret through the separately approved secret-management process; do not commit it.
4. Run a synthetic rehearsal first.
5. Run a separately authorized source rehearsal only after synthetic PASS.
6. Record key-generation/version metadata externally; never place the key itself in DR evidence.

## Source identity prerequisite

The source role must be able to execute the read-only identity query using `pg_control_system()` so the tooling can obtain the PostgreSQL `system_identifier`. If this identity cannot be read, the rehearsal fails closed.

The source connection is additionally forced into `default_transaction_read_only=on` for `pg_dump` and all source-side reconciliation/identity queries.

## Target preparation

The restore target must be on a PostgreSQL cluster distinct from the source cluster and must be disposable. After creating the target database on that isolated cluster, mark it explicitly:

```sql
COMMENT ON DATABASE gracz_dr_restore IS 'gracz-dr-disposable';
```

The tooling refuses restore when:

- source and target database identities are equal;
- source and target have the same PostgreSQL `system_identifier` even if database names differ;
- either database or cluster identity cannot be proven;
- target lacks the exact disposable marker;
- checksum is missing or invalid;
- encrypted archive cannot be decrypted and parsed by `pg_restore --list`;
- required expected tables are missing.

Database identity is based on the server-observed database name, database OID and PostgreSQL cluster `system_identifier`, not on a display name or raw connection string. Evidence stores SHA-256 fingerprints plus database names; connection URLs and credentials are not recorded.

## Manual rehearsal

A source rehearsal is **not wired into GitHub Actions** by P1-R-01. It may be run only after a separate owner/lead authorization using an isolated restore PostgreSQL cluster.

Required environment:

- `DR_SOURCE_DATABASE_URL` — source connection used read-only by the DR tooling;
- `DR_RESTORE_DATABASE_URL` — target on a separate PostgreSQL cluster with the disposable marker;
- `BACKUP_ENCRYPTION_KEY` — 32-byte base64 DR key;
- `DR_EXPECTED_TABLES` — comma-separated critical public tables, for example `gracz_game_sessions,gracz_accounts`;
- `DR_EVIDENCE_DIR` — optional evidence output directory;
- `DR_STRICT_ROW_RECONCILIATION=true` for frozen/synthetic sources;
- `DR_RTO_TARGET_SECONDS` and `DR_RPO_REHEARSAL_TARGET_SECONDS` as integer rehearsal targets.

Run only under a separate authorization:

```bash
bash ops/dr-restore-rehearsal.sh
```

For a live source, strict row-count comparison should be used only when the source is frozen or otherwise guaranteed stable for the evidence window. Schema and expected-table checks remain mandatory. Do not claim byte-for-byte logical equivalence: P1-R-01 proves schema identity plus strict per-table row counts when strict mode is enabled.

## Evidence contract

Each run writes one `dr-restore-*.json` document. Successful evidence includes:

- start/end timestamps and exit status;
- encrypted artifact existence;
- encrypted backup SHA-256 and checksum result;
- decryptability preflight result;
- backup duration and backup/recovery-point age;
- restore duration and observed RTO;
- source/target database names;
- source/target database identity SHA-256 fingerprints;
- source/target PostgreSQL cluster identity SHA-256 fingerprints;
- database-distinct, cluster-distinct and disposable-target results;
- expected tables;
- source/target schema SHA-256 fingerprints;
- source/target row counts;
- strict reconciliation result;
- explicit safety fields showing no source mutation and no credential recording.

A restore-command failure or other rehearsal error produces structured `status: "fail"` evidence with `failure_stage`. Reconciliation failure is a final FAIL, not a warning.

## Recurring schedule

The GitHub workflow runs a weekly **synthetic PostgreSQL rehearsal** against two ephemeral PostgreSQL service clusters: one source cluster and one isolated restore cluster. Manual `workflow_dispatch` also runs synthetic rehearsal only.

Production-source rehearsal is **not scheduled and not wired into CI**. Therefore merging P1-R-01 cannot by itself cause GitHub Actions to access production.

## Failure response

Treat any DR failure as fail-closed. Investigate in this order:

1. source/target database or cluster identity;
2. restore-cluster isolation or missing disposable marker;
3. missing/invalid encryption key;
4. backup or checksum failure;
5. decryptability failure / wrong key / corrupted artifact;
6. `pg_restore` failure;
7. missing critical schema;
8. schema or strict row reconciliation failure;
9. RTO/recovery-point-age target failure.

Do not weaken a safety check to make CI green. Preserve failure evidence and the next successful evidence for review.

## Production activation boundary

Merging P1-R-01 does not authorize a production-source run, production restore, migration or deployment. Any production-source rehearsal requires a new owner/lead mandate, a read-only-capable source identity check, a separately managed encryption key, and a disposable target on a different PostgreSQL cluster. The restore target must never be production.

# Contact data production backfill runbook

Status: **HOLD — recovery gate not met**

This runbook governs the one-time production backfill for legacy `contact_cases`
rows created before the encrypted writer became the only active writer.

It does **not** authorize migration 005, plaintext redaction, column removal,
constraint changes, secret rotation, or any other CONTRACT operation.

## Verified production facts

Verified on 2026-10-08 using a one-shot production inspection that was removed
immediately afterward:

- encrypted-writer cutoff: `2026-10-08T00:40:57.832519Z`
- total rows observed: `4`
- pre-cutoff legacy rows: `3`
- post-cutoff rows: `1`
- post-cutoff canonical encrypted-writer rows: `1`
- post-cutoff anomalies: `0`
- rows needing backfill: `3`
- authenticated modern-writer rows: `1`
- verified ciphertext fields before backfill: `2`
- production-key evidence satisfied: `true`

The first post-cutoff row observed had
`created_at = 2026-10-08T00:51:57.854Z`.

These values are historical evidence only. A fresh read-only inspection is
mandatory immediately before any production write.

## Mandatory recovery gate

The database plan upgrade and recovery rehearsal are governed by
[`RENDER_POSTGRES_UPGRADE_RUNBOOK.md`](./RENDER_POSTGRES_UPGRADE_RUNBOOK.md).


Do not execute the backfill until **all** of the following are true:

1. The exact production database identity is reconfirmed.
2. A restorable backup exists outside the running database instance or the
   database plan provides an equivalent verified recovery mechanism.
3. Restore has been tested or otherwise verified sufficiently to establish that
   the backup can actually be used.
4. `CONTACT_DATA_ENCRYPTION_SECRET` has an independent secure escrow/recovery
   copy outside the running service.
5. The escrow copy is not printed, pasted into logs, committed to Git, or stored
   in this repository.
6. The deployed writer SHA and writer inventory are checked again.
7. No retired/old writer can still create `contact_cases` rows.
8. No other ciphertext-changing maintenance process is running.
9. A quiet execution window is selected.

If any item is unknown, the status remains **HOLD**.

## Phase A — fresh read-only preflight

Use the already verified cutoff:

```sh
CONTACT_DATA_ENCRYPTED_WRITER_CUTOFF=2026-10-08T00:40:57.832519Z \
npm --prefix contact-api run contact-data:contract-prep
```

Required result before continuing:

- no authentication failure;
- no value mismatch;
- no post-cutoff writer anomaly;
- no scan-count mismatch;
- `modernWriterRows >= 1`;
- `keyEvidenceSatisfied === true`;
- database identity matches the approved production target;
- row counts are reconciled with the operator record.

Do not continue merely because `rowsNeedingBackfill` has an expected value.

## Phase B — first controlled backfill

Run exactly one operator. Do not run parallel backfills.

Start with batch size 100 unless fresh production measurements justify a smaller
value. The current data volume is tiny, but the procedure is intentionally
conservative.

```sh
CONTACT_DATA_ENCRYPTED_WRITER_CUTOFF=2026-10-08T00:40:57.832519Z \
CONTACT_DATA_CONTRACT_CONFIRM=BACKFILL_CONTACT_DATA_V1 \
npm --prefix contact-api run contact-data:contract-prep -- --execute
```

Expected historical target: `updatedRows = 3`.

The backfill may update only missing `subject_ciphertext` and
`source_path_ciphertext` fields. It must preserve legacy plaintext and
`updated_at`.

### Important partial-commit boundary

Backfill batches commit independently. If a later batch or final verification
fails, earlier successful batches may already be committed.

Therefore:

- failure does **not** mean "nothing changed";
- stop immediately on failure;
- inspect the committed state before rerunning;
- never attempt ad-hoc rollback SQL;
- use the verified backup/recovery path if recovery is required.

This explicitly documents the concurrency/partial-commit boundary identified
during the R3 audits.

## Phase C — idempotency reruns

After the first successful backfill, run the exact same execute command twice
more, one process at a time.

Both reruns must report:

`updatedRows = 0`

Any non-zero update count is a STOP condition requiring investigation.

## Phase D — fresh read-only verification

Run the read-only command again and require:

- `rowsNeedingBackfill = 0`;
- every ciphertext field authenticates with the production secret and exact
  row/field AAD;
- `verifiedCiphertextFields === 2 * totalRows`;
- authoritative retained plaintext equals decrypted ciphertext exactly;
- `modernWriterRows >= 1`;
- `keyEvidenceSatisfied === true`;
- no post-cutoff writer anomaly;
- counts reconcile independently.

Record only aggregate results and error codes. Never record plaintext,
ciphertext envelopes, secrets, database URLs, or raw personal data.

## Phase E — observation period

After backfill, keep the system in the EXPAND state.

Observe for:

- new rows with NULL ciphertext fields;
- persistence failures;
- decrypt/authentication failures;
- post-cutoff writer anomalies;
- unexpected changes in row counts.

Do not create or run migration 005 during this observation period.

## Migration 005 entry gate

Migration 005 remains a separate future change and requires a separate review.

It is not eligible until:

1. recovery remains verified;
2. secret escrow remains verified;
3. `rowsNeedingBackfill = 0`;
4. every ciphertext field authenticates;
5. retained plaintext/ciphertext equality is verified;
6. two execute reruns returned `updatedRows = 0`;
7. the observation period is clean;
8. old writers remain retired;
9. restore/decrypt capability is verified;
10. the CONTRACT migration and recovery procedure receive separate approval.

## STOP conditions

Stop without further writes on any of the following:

- SHA drift from the approved code;
- uncertain database identity;
- missing/unverified backup or restore capability;
- missing/unverified encryption-secret escrow;
- uncertain cutoff provenance;
- old-writer overlap;
- authentication/decrypt failure;
- plaintext/ciphertext mismatch;
- post-cutoff anomaly;
- unexpected row counts;
- timeout or connection failure;
- non-zero update count on an idempotency rerun.

After any STOP condition, inspect the committed state before considering a
rerun.

## Performance note

The R3 audits found that repeated pending-row selection can scan already
completed rows as volume grows. For the current legacy volume this is not
material, but future large backfills must obtain representative query plans and
capacity measurements first. Use one runner and a quiet window.

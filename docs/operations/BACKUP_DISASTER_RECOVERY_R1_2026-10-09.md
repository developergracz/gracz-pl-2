# BACKUP & DISASTER RECOVERY R1 — gracz.pl

**Status:** PROPOSAL / DOCS ONLY / IMPLEMENTATION HOLD  
**Prepared:** 2026-10-09  
**Authoritative source:** current `main` plus the existing contact-api runbooks. This document does not authorize an operation, cost, secret access, schema change, or deployment.

## 1. Scope and boundaries

Target: existing Render PostgreSQL **ID `dpg-db38btt9fdbs73aadohg-a`** (`gracz-r4-staging-postgres`, database `gracz_r4_staging_postgres`, PostgreSQL 18, Frankfurt). Despite its staging-oriented name, the existing [upgrade runbook](../../contact-api/RENDER_POSTGRES_UPGRADE_RUNBOOK.md) identifies this instance as backing production contact/persistence. Reconfirm live association and writer state before operations.

Protect `contact_cases`, encrypted contact metadata and other database state. Distinguish the **data backup** from the separately escrowed `CONTACT_DATA_ENCRYPTION_SECRET`: a database restore cannot decrypt protected fields without the exact existing secret.

**Never store a dump, secret, plaintext contact record, full DATABASE_URL, credential, decryption key, or even a short-lived production data archive in GitHub source, PRs, issues, logs or ordinary GitHub Actions artifacts.** The repository is public.

Existing binding operating documents remain authoritative:
- [Render PostgreSQL upgrade and recovery](../../contact-api/RENDER_POSTGRES_UPGRADE_RUNBOOK.md)
- [Encryption secret escrow](../../contact-api/CONTACT_DATA_ENCRYPTION_SECRET_ESCROW_RUNBOOK.md)
- [Production contact-data backfill](../../contact-api/PRODUCTION_BACKFILL_RUNBOOK.md)

## 2. Verified baseline vs unverified capabilities

| Item | Evidence baseline (Render observation 2026-10-08; rechecked where stated 2026-10-09) | Gate |
| --- | --- | --- |
| Render database | ID above, Free, available, no public IP allowlist | Recheck live before each operation |
| Render managed recovery / export | Free plan does not expose PITR or Recovery-page export | Requires approved paid compute upgrade |
| Existing `gracz-contact-api` | Render web service, Free; environment contains DATABASE_URL | Check exact connection identity, app health and deployed SHA without printing secrets |
| Pre-upgrade logical dump | **NOT EXECUTED / NOT VERIFIED** | Choose an operator-controlled trusted client/path, then test |
| Restore rehearsal | **NOT EXECUTED** | Real isolated restore; validate schema, counts and decrypt capability |
| Encryption key escrow | **NOT VERIFIED** under the canonical escrow runbook | Independently verify exact existing key recovery outside Render, without printing secret |
| Protected write operations | No backfill, no migration 005, no plaintext redaction | Separate authorization after every recovery gate passes |

Do not equate a configuration screenshot or `pg_restore --list` with a successful restore rehearsal.

## 3. Phase P0 — exact identity and safe preflight (read-only)

1. Confirm database ID and connection association with `gracz-contact-api`; database name alone is not sufficient. Keep the external IP allowlist unchanged under the canonical upgrade runbook. Any temporary narrow entry requires a separately documented, explicit Owner-approved **exception to that canonical rule** or an approved runbook amendment; approving a backup method alone is insufficient.
2. Record live service deployment commit, `/health` result, database availability, maintenance window, storage, and logs for connection/migration/decrypt/persistence failures (aggregates only).
3. Confirm no concurrent migration/backfill/older writer. Existing Render build command may invoke migrations: avoid triggering gratuitous deploys.
4. Select a storage custodian, access policy, offsite encrypted destination, key escrow, retention period, deletion policy, recovery-time objective (RTO), recovery-point objective (RPO) and a budget **before** automation.
5. Confirm PostgreSQL client/server compatibility, path-specific TLS/security requirements and a non-privileged least-privilege export account when available. For an external connection, require trusted-CA and hostname validation (`sslmode=verify-full` with the approved trust chain). Render's internal PostgreSQL route can use self-signed certificates that do not support libpq `verify-ca` / `verify-full`; it requires a separately documented and approved private-network trust model. `sslmode=require` encrypts transport but does not by itself authenticate the server hostname. If the required trust model is unavailable, STOP; do not silently weaken it or log URLs.

**STOP** if the data location, production writer, backup custody, encryption, repository access or cost is unclear.

## 4. Phase P1 — pre-upgrade logical backup (operator-governed)

Preferred sequence: prepare a trusted `pg_dump` client that can reach Render PostgreSQL using an approved access path, stream backup directly into **encrypted operator-controlled storage**, then verify it. Do not assume GitHub-hosted runners can reach Render's internal hostname: they cannot use Render's private service network by default.

**Access options (design choices, not approval):**
- **Temporary trusted operator client:** a public IPv4 `/32` is **BLOCKED by default** under the canonical runbook's no-allowlist-change rule. It may be considered only after a **distinct written Owner approval of the precise canonical-policy exception (or a reconciled runbook amendment)**, including the specific IP, expiry and rollback. Require TLS hostname/CA verification (`verify-full`) with an approved trust chain, authentication, an export window, then **revoke the IP rule and verify it is gone**. IP-scoping does not replace authentication or TLS.
- **Trusted runtime inside Render's private network:** only after assessing Render plan/tool capability, technical feasibility, network isolation, egress and cost. Render's internal self-signed PostgreSQL certificates may prevent libpq `verify-ca` / `verify-full`: document and separately approve the private-network security/trust boundary and transport controls before use, or STOP. Do not silently downgrade TLS or create a new paid service or modify production build/start commands as a shortcut.
- **After paid upgrade:** use Render Recovery logical export and PITR, recognizing neither supplies a retroactive pre-upgrade recovery point.

A proposed command **template for an approved trusted shell only** (not an executable GitHub workflow):

```sh
# Use a secured runtime with libpq connection parameters supplied through
# its protected secret mechanism; never echo the URI or put it in arguments.
# Use a PostgreSQL 18-compatible client. Validate connection security separately:
# external = approved CA + hostname verification; internal = explicitly reviewed
# Render private-network trust model (verify-full may not be supported there).
# This is a non-executable illustration until a vetted, encrypted destination exists.
pg_dump --format=custom --file="$PROTECTED_BACKUP_PATH"
pg_restore --list "$PROTECTED_BACKUP_PATH" >/dev/null
sha256sum "$PROTECTED_BACKUP_PATH" > "$PROTECTED_BACKUP_PATH.sha256"
```

The custom-format archive may retain original ownership and privilege statements. `pg_dump --no-owner` does not implement ownership remapping for custom-format archives; restoration must explicitly define `pg_restore --no-owner --no-acl` where appropriate and approved destination ownership, roles and application GRANTs. `pg_dump` covers only the selected database, not cluster-global roles. Verify the restored application account's least-privilege access, not merely schema existence. The above is not complete until environment-specific connection variables, TLS/path trust model, encryption at rest, file permissions, credential handling and custodian are approved. The SHA-256 file detects corruption; **it does not encrypt the dump**. Protect, encrypt and relocate both files outside CI and source control. Empty/nonzero error statuses and size must be checked without printing data.

## 5. Phase P2 — verification and restore rehearsal

1. From the **final separate offsite backup destination**, retrieve the encrypted archive, authenticate its integrity, recover the archive decryption key by a **separate tested recovery path**, and decrypt in an approved isolated environment. Do not use only a local temporary dump or an already-unlocked live runner. The archive key and its recovery credentials, access to the backup store, and application `CONTACT_DATA_ENCRYPTION_SECRET` are three distinct recovery dependencies. All necessary archive key versions must be retained at least as long as the corresponding archives. Inspect decrypted archive metadata (`pg_restore --list`) and hash.
2. Restore **to a separate isolated disposable PostgreSQL instance** with no public exposure and no connection from production services. This rehearsal may incur costs; require explicit Owner cost GO before provisioning.
3. Define destination database ownership/roles/ACL restoration (for example validated `pg_restore --no-owner --no-acl` plus explicit approved grants), including any cluster roles absent from a single-database dump. Verify schema objects, safe aggregate counts, application access under its intended restricted role, permitted sample-level encrypted-field authentication and application-compatible decrypt capability using the **separately recovered original escrowed application secret**, without logging personal data.
4. Record only timestamp, backup ID outside Git, tool versions, validation outcomes, restored object/count summaries, cost authorization, retention and responsible reviewer.
5. Revoke temporary accesses and credentials, securely remove temporary plaintext material, document isolated test resource teardown after Owner approval.

**RESTORE PASS** requires an actual reproducible restore plus data-integrity/decrypt evidence; a command returning exit code zero alone is insufficient.

## 6. Phase P3 — paid plan and managed recovery

Only after separate Owner approval of exact total projected cost and schedule: upgrade the **same database ID** from Free to the selected paid Render PostgreSQL compute plan. Expect a possible short interruption; coordinate with contact-api health checks. Do not alter PostgreSQL major version, connection secret, writer or schema in the same change.

Then:
1. Check same ID, `available`, region, version, expected allowlist and live API health.
2. Confirm PITR available and document selectable recovery window; **PITR is not retroactive**.
3. Create a logical export from the Render Recovery UI and store it securely **outside GitHub**.
4. Rehearse an actual separate restoration when an eligible restore point exists; secure approval for potential temporary instance charges.
5. Keep production on its original DB during rehearsal.

Any unforeseen outage, incompatible application behavior or recovery failure: **STOP, preserve evidence, no backfill**.

## 7. Phase P4 — future GitHub Actions automation (not implemented)

GitHub Actions may orchestrate scheduling, health/status attestations, hashes and encrypted transfer to a **separate private backup destination**. No GitHub repository or unencrypted GitHub Actions artifact is a backup vault.

Before creating any workflow, separately review:
- trusted network path (GitHub-hosted runner is not on Render private network);
- minimum permissions and secret custody (short-lived credentials where possible);
- encryption **before data leaves the trusted execution boundary**, separate archive-key escrow/recovery and independently recoverable storage credentials, with matching archive/key retention;
- zero exposure of dump bytes, connection strings, contact data or secrets in logs/artifacts;
- backup retention, deletion, least-privilege storage policy and offsite isolation;
- restore drills, RTO/RPO, alerting and failure notification with no sensitive content;
- egress, runner and storage costs; PR review and exact-HEAD CI;
- cancellation/retry/idempotence and overlap handling.

**No workflow, credentials, scheduled task, bucket or paid resource is created by this PR.** Implementation is a separate approved work item after P0–P3.

## 8. Hard STOP gates and required Owner decisions

**Always HOLD**: contact backfill; migration 005; plaintext redaction; key rotation; production writer or `DATABASE_URL` changes; broad IP allowlisting; direct production restore; unreviewed GitHub Actions with database connectivity.

To authorize the first real backup, Owner must approve: custodian/destination, network method, export time and access expiry. To authorize upgrade, separately approve expected cost and possible outage. To authorize temporary restore DB, approve costs and teardown. For contact-data writes, satisfy **every** gate in the authoritative runbooks plus a fresh read-only contract-prep audit.

## 9. Evidence register (fill after execution; no secrets)

| Evidence | Status |
| --- | --- |
| P0 app/DB exact-identity verification | PENDING |
| P1 encrypted offsite dump, independently verified | PENDING |
| P2 offsite archive retrieval + independent archive-key recovery + isolated restore + application-key decrypt evidence | PENDING |
| Owner exact-cost upgrade approval | PENDING |
| Paid plan/PITR/external logical export | PENDING |
| Recovery R1 operational acceptance | **HOLD** |

**Documentary acceptance only:** A docs-only PR may be independently reviewed and merged without treating any of the above operational gates as passed.

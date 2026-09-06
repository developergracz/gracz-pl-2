#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVIDENCE_DIR="${DR_EVIDENCE_DIR:-./dr-evidence}"
RTO_TARGET_SECONDS="${DR_RTO_TARGET_SECONDS:-1800}"
RPO_TARGET_SECONDS="${DR_RPO_REHEARSAL_TARGET_SECONDS:-3600}"
STRICT_ROWS="${DR_STRICT_ROW_RECONCILIATION:-false}"
EXPECTED_TABLES="${DR_EXPECTED_TABLES:-}"
WORKDIR="$(mktemp -d)"
BACKUP_DIR="$WORKDIR/backups"
mkdir -p "$BACKUP_DIR" "$EVIDENCE_DIR"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
started_epoch="$(date -u +%s)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence="$EVIDENCE_DIR/dr-restore-${stamp}-$$.json"

status="fail"
failure_stage="configuration"
evidence_written="false"
source_database=""
restore_database=""
source_identity_fingerprint=""
restore_identity_fingerprint=""
source_cluster_fingerprint=""
restore_cluster_fingerprint=""
identity_distinct="false"
cluster_distinct="false"
restore_marker_verified="false"
encrypted_artifact_exists="false"
checksum_verified="false"
decryptability_verified="false"
restore_succeeded="false"
reconciliation_status="not-run"
plaintext_dump_retained="false"
backup_sha256=""
backup_started_epoch=0
backup_finished_epoch=0
restore_started_epoch=0
restore_finished_epoch=0
source_counts_file="$WORKDIR/source-counts.txt"
restore_counts_file="$WORKDIR/restore-counts.txt"
source_schema_file="$WORKDIR/source-schema.txt"
restore_schema_file="$WORKDIR/restore-schema.txt"

query_identity() {
  local url="$1"
  local readonly="${2:-false}"
  local sql="SELECT current_database() || '|' || d.oid::text || '|' || c.system_identifier::text FROM pg_database d CROSS JOIN pg_control_system() c WHERE d.datname=current_database();"
  if [[ "$readonly" == "true" ]]; then
    PGOPTIONS="-c default_transaction_read_only=on ${PGOPTIONS:-}" psql "$url" -v ON_ERROR_STOP=1 -Atqc "$sql"
  else
    psql "$url" -v ON_ERROR_STOP=1 -Atqc "$sql"
  fi
}

query_cluster_identity() {
  local url="$1"
  local readonly="${2:-false}"
  if [[ "$readonly" == "true" ]]; then
    PGOPTIONS="-c default_transaction_read_only=on ${PGOPTIONS:-}" psql "$url" -v ON_ERROR_STOP=1 -Atqc "SELECT system_identifier::text FROM pg_control_system();"
  else
    psql "$url" -v ON_ERROR_STOP=1 -Atqc "SELECT system_identifier::text FROM pg_control_system();"
  fi
}

collect_schema() {
  local url="$1"
  local readonly="$2"
  local out="$3"
  local sql="SELECT table_name || '|' || column_name || '|' || ordinal_position || '|' || data_type || '|' || is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position;"
  if [[ "$readonly" == "true" ]]; then
    PGOPTIONS="-c default_transaction_read_only=on ${PGOPTIONS:-}" psql "$url" -v ON_ERROR_STOP=1 -At -c "$sql" > "$out"
  else
    psql "$url" -v ON_ERROR_STOP=1 -At -c "$sql" > "$out"
  fi
}

collect_counts() {
  local url="$1"
  local readonly="$2"
  local out="$3"
  local table count tables

  if [[ "$readonly" == "true" ]]; then
    tables="$(PGOPTIONS="-c default_transaction_read_only=on ${PGOPTIONS:-}" psql "$url" -v ON_ERROR_STOP=1 -Atqc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")"
  else
    tables="$(psql "$url" -v ON_ERROR_STOP=1 -Atqc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")"
  fi

  : > "$out"
  while IFS= read -r table; do
    [[ -z "$table" ]] && continue
    [[ "$table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
      echo "Unsafe public table name encountered during reconciliation: $table" >&2
      return 8
    }
    if [[ "$readonly" == "true" ]]; then
      count="$(PGOPTIONS="-c default_transaction_read_only=on ${PGOPTIONS:-}" psql "$url" -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM public.$table;")"
    else
      count="$(psql "$url" -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM public.$table;")"
    fi
    [[ "$count" =~ ^[0-9]+$ ]] || { echo "Invalid row count for public.$table" >&2; return 8; }
    printf 'public.%s|%s\n' "$table" "$count" >> "$out"
  done <<< "$tables"
}

check_expected_tables() {
  local url="$1"
  local readonly="$2"
  local table
  IFS=',' read -r -a tables <<< "$EXPECTED_TABLES"
  for table in "${tables[@]}"; do
    table="${table//[[:space:]]/}"
    [[ "$table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || { echo "Unsafe expected table name: $table" >&2; return 8; }
    local exists
    if [[ "$readonly" == "true" ]]; then
      exists="$(PGOPTIONS="-c default_transaction_read_only=on ${PGOPTIONS:-}" psql "$url" -v ON_ERROR_STOP=1 -Atqc "SELECT to_regclass('public.$table') IS NOT NULL;")"
    else
      exists="$(psql "$url" -v ON_ERROR_STOP=1 -Atqc "SELECT to_regclass('public.$table') IS NOT NULL;")"
    fi
    [[ "$exists" == "t" ]] || { echo "Required table public.$table is missing." >&2; return 8; }
  done
}

write_evidence() {
  local exit_code="$1"
  local finished_at finished_epoch backup_duration restore_duration rto backup_age source_schema_sha restore_schema_sha
  finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  finished_epoch="$(date -u +%s)"
  backup_duration=0
  restore_duration=0
  rto=0
  backup_age=0
  (( backup_started_epoch > 0 && backup_finished_epoch >= backup_started_epoch )) && backup_duration=$((backup_finished_epoch-backup_started_epoch))
  (( restore_started_epoch > 0 && restore_finished_epoch >= restore_started_epoch )) && restore_duration=$((restore_finished_epoch-restore_started_epoch))
  rto="$restore_duration"
  (( backup_finished_epoch > 0 )) && backup_age=$((finished_epoch-backup_finished_epoch))
  source_schema_sha=""
  restore_schema_sha=""
  [[ -f "$source_schema_file" ]] && source_schema_sha="$(sha256sum "$source_schema_file" | awk '{print $1}')"
  [[ -f "$restore_schema_file" ]] && restore_schema_sha="$(sha256sum "$restore_schema_file" | awk '{print $1}')"

  python3 - "$evidence" "$status" "$failure_stage" "$exit_code" "$started_at" "$finished_at" \
    "$backup_duration" "$restore_duration" "$rto" "$backup_age" "$RTO_TARGET_SECONDS" "$RPO_TARGET_SECONDS" \
    "$backup_sha256" "$encrypted_artifact_exists" "$checksum_verified" "$decryptability_verified" "$restore_succeeded" \
    "$source_database" "$restore_database" "$source_identity_fingerprint" "$restore_identity_fingerprint" \
    "$source_cluster_fingerprint" "$restore_cluster_fingerprint" "$identity_distinct" "$cluster_distinct" "$restore_marker_verified" \
    "$STRICT_ROWS" "$reconciliation_status" "$source_schema_sha" "$restore_schema_sha" \
    "$source_counts_file" "$restore_counts_file" "$EXPECTED_TABLES" "$plaintext_dump_retained" <<'PY'
import json, pathlib, sys
(
 path,status,stage,exit_code,started,finished,backup_duration,restore_duration,rto,backup_age,rto_target,rpo_target,
 backup_sha,artifact_exists,checksum_verified,decryptability_verified,restore_succeeded,
 source_db,target_db,source_fp,target_fp,source_cluster_fp,target_cluster_fp,identity_distinct,cluster_distinct,marker_verified,
 strict_rows,reconciliation,source_schema_sha,target_schema_sha,source_counts_path,target_counts_path,expected_tables,plaintext_retained
) = sys.argv[1:]

def b(v): return v.lower() == "true"
def counts(p):
    result = {}
    path = pathlib.Path(p)
    if not path.exists(): return result
    for line in path.read_text().splitlines():
        if not line: continue
        name, value = line.rsplit("|", 1)
        result[name] = int(value)
    return result

data = {
  "schema_version": 2,
  "status": status,
  "failure_stage": None if status == "pass" else stage,
  "exit_code": int(exit_code),
  "started_at": started,
  "finished_at": finished,
  "backup": {
    "artifact_encrypted": b(artifact_exists),
    "plaintext_dump_retained": b(plaintext_retained),
    "sha256": backup_sha or None,
    "checksum_verified": b(checksum_verified),
    "decryptability_verified": b(decryptability_verified),
    "duration_seconds": int(backup_duration),
    "age_seconds": int(backup_age),
  },
  "restore": {
    "succeeded": b(restore_succeeded),
    "duration_seconds": int(restore_duration),
    "rto_observed_seconds": int(rto),
    "rto_target_seconds": int(rto_target),
    "recovery_point_age_target_seconds": int(rpo_target),
  },
  "identity": {
    "source": {
      "database": source_db or None,
      "fingerprint_sha256": source_fp or None,
      "cluster_fingerprint_sha256": source_cluster_fp or None,
    },
    "target": {
      "database": target_db or None,
      "fingerprint_sha256": target_fp or None,
      "cluster_fingerprint_sha256": target_cluster_fp or None,
    },
    "distinct": b(identity_distinct),
    "cluster_distinct": b(cluster_distinct),
    "restore_target_marker_verified": b(marker_verified),
    "restore_isolated": b(identity_distinct) and b(cluster_distinct) and b(marker_verified),
  },
  "reconciliation": {
    "strict": b(strict_rows),
    "status": reconciliation,
    "expected_tables": [x.strip() for x in expected_tables.split(",") if x.strip()],
    "source_row_counts": counts(source_counts_path),
    "target_row_counts": counts(target_counts_path),
    "source_schema_sha256": source_schema_sha or None,
    "target_schema_sha256": target_schema_sha or None,
  },
  "safety": {
    "source_mutated": False,
    "production_restore_performed": False,
    "credentials_recorded": False,
  },
}
pathlib.Path(path).write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
PY
  evidence_written="true"
}

finish() {
  local code=$?
  trap - EXIT
  if find "$WORKDIR" -type f \( -name '*.dump' -o -name '*.sql' -o -name '*.plain' \) -print -quit | grep -q .; then
    plaintext_dump_retained="true"
    status="fail"
    failure_stage="plaintext-retention"
    [[ "$code" -eq 0 ]] && code=11
  fi
  if [[ "$evidence_written" != "true" ]]; then
    write_evidence "$code" || true
  fi
  rm -rf "$WORKDIR"
  exit "$code"
}
trap finish EXIT

if [[ -z "${DR_SOURCE_DATABASE_URL:-}" || -z "${DR_RESTORE_DATABASE_URL:-}" || -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  echo "DR_SOURCE_DATABASE_URL, DR_RESTORE_DATABASE_URL and BACKUP_ENCRYPTION_KEY are required." >&2
  exit 2
fi
if [[ -z "$EXPECTED_TABLES" ]]; then
  echo "DR_EXPECTED_TABLES is required for fail-closed schema reconciliation." >&2
  exit 2
fi
for value in "$RTO_TARGET_SECONDS" "$RPO_TARGET_SECONDS"; do
  [[ "$value" =~ ^[0-9]+$ ]] || { echo "DR time targets must be integer seconds." >&2; exit 2; }
done

failure_stage="identity"
source_identity="$(query_identity "$DR_SOURCE_DATABASE_URL" true)"
restore_identity="$(query_identity "$DR_RESTORE_DATABASE_URL" false)"
source_cluster="$(query_cluster_identity "$DR_SOURCE_DATABASE_URL" true)"
restore_cluster="$(query_cluster_identity "$DR_RESTORE_DATABASE_URL" false)"
[[ -n "$source_identity" && -n "$restore_identity" && -n "$source_cluster" && -n "$restore_cluster" ]] || {
  echo "Database or cluster identity is ambiguous." >&2
  exit 3
}
source_database="$(PGOPTIONS="-c default_transaction_read_only=on ${PGOPTIONS:-}" psql "$DR_SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database();')"
restore_database="$(psql "$DR_RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'SELECT current_database();')"
source_identity_fingerprint="$(printf '%s' "$source_identity" | sha256sum | awk '{print $1}')"
restore_identity_fingerprint="$(printf '%s' "$restore_identity" | sha256sum | awk '{print $1}')"
source_cluster_fingerprint="$(printf '%s' "$source_cluster" | sha256sum | awk '{print $1}')"
restore_cluster_fingerprint="$(printf '%s' "$restore_cluster" | sha256sum | awk '{print $1}')"
if [[ "$source_identity" == "$restore_identity" ]]; then
  echo "Refusing DR rehearsal: source and restore database identities are the same." >&2
  exit 3
fi
identity_distinct="true"
if [[ "$source_cluster" == "$restore_cluster" ]]; then
  echo "Refusing DR rehearsal: source and restore PostgreSQL clusters are the same; target is not isolated." >&2
  exit 3
fi
cluster_distinct="true"
restore_marker="$(psql "$DR_RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT COALESCE(shobj_description(oid,'pg_database'),'') FROM pg_database WHERE datname=current_database();")"
[[ "$restore_marker" == "gracz-dr-disposable" ]] || { echo "Restore target is not marked as gracz-dr-disposable." >&2; exit 3; }
restore_marker_verified="true"

failure_stage="source-reconciliation-evidence"
check_expected_tables "$DR_SOURCE_DATABASE_URL" true
collect_schema "$DR_SOURCE_DATABASE_URL" true "$source_schema_file"
collect_counts "$DR_SOURCE_DATABASE_URL" true "$source_counts_file"

failure_stage="backup"
backup_started_epoch="$(date -u +%s)"
DATABASE_URL="$DR_SOURCE_DATABASE_URL" BACKUP_DIR="$BACKUP_DIR" BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
  bash "$SCRIPT_DIR/backup-postgres.sh" >/dev/null
backup_finished_epoch="$(date -u +%s)"
mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'gracz-*.dump.enc' -print)
[[ "${#backups[@]}" -eq 1 ]] || { echo "Expected exactly one encrypted backup." >&2; exit 4; }
backup="${backups[0]}"
[[ -s "$backup" ]] || { echo "Encrypted backup artifact is missing or empty." >&2; exit 4; }
encrypted_artifact_exists="true"
backup_sha256="$(sha256sum "$backup" | awk '{print $1}')"

failure_stage="checksum"
(
  cd "$BACKUP_DIR"
  sha256sum -c "$(basename "$backup").sha256" >/dev/null
)
checksum_verified="true"

failure_stage="restore"
restore_started_epoch="$(date -u +%s)"
SOURCE_DATABASE_URL="$DR_SOURCE_DATABASE_URL" RESTORE_DATABASE_URL="$DR_RESTORE_DATABASE_URL" \
BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" DR_PG_RESTORE_BIN="${DR_PG_RESTORE_BIN:-pg_restore}" \
  bash "$SCRIPT_DIR/test-restore-postgres.sh" "$backup" >/dev/null
restore_finished_epoch="$(date -u +%s)"
decryptability_verified="true"
restore_succeeded="true"

failure_stage="target-reconciliation"
check_expected_tables "$DR_RESTORE_DATABASE_URL" false
collect_schema "$DR_RESTORE_DATABASE_URL" false "$restore_schema_file"
collect_counts "$DR_RESTORE_DATABASE_URL" false "$restore_counts_file"
if ! diff -u "$source_schema_file" "$restore_schema_file" >/dev/null; then
  echo "Critical schema reconciliation failed." >&2
  exit 5
fi
if [[ "${STRICT_ROWS,,}" == "true" ]]; then
  if ! diff -u "$source_counts_file" "$restore_counts_file" >/dev/null; then
    echo "Strict row-count reconciliation failed." >&2
    exit 6
  fi
fi
reconciliation_status="pass"

rto_observed=$((restore_finished_epoch-restore_started_epoch))
backup_age=$((restore_finished_epoch-backup_finished_epoch))
if (( rto_observed > RTO_TARGET_SECONDS )); then
  failure_stage="rto-target"
  echo "RTO rehearsal target exceeded." >&2
  exit 7
fi
if (( backup_age > RPO_TARGET_SECONDS )); then
  failure_stage="recovery-point-age-target"
  echo "Recovery-point-age rehearsal target exceeded." >&2
  exit 7
fi

status="pass"
failure_stage=""
write_evidence 0
echo "DR evidence created: $evidence"

#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DR_SOURCE_DATABASE_URL:?DR_SOURCE_DATABASE_URL is required}"
: "${DR_RESTORE_DATABASE_URL:?DR_RESTORE_DATABASE_URL must point to a disposable restore database}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

EVIDENCE_DIR="${DR_EVIDENCE_DIR:-./dr-evidence}"
RTO_TARGET_SECONDS="${DR_RTO_TARGET_SECONDS:-1800}"
RPO_REHEARSAL_TARGET_SECONDS="${DR_RPO_REHEARSAL_TARGET_SECONDS:-3600}"
STRICT_ROWS="${DR_STRICT_ROW_RECONCILIATION:-false}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="$(mktemp -d)"
BACKUP_DIR="$WORKDIR/backups"
mkdir -p "$BACKUP_DIR" "$EVIDENCE_DIR"
trap 'rm -rf "$WORKDIR"' EXIT

for value in "$RTO_TARGET_SECONDS" "$RPO_REHEARSAL_TARGET_SECONDS"; do
  [[ "$value" =~ ^[0-9]+$ ]] || { echo "DR time targets must be integer seconds." >&2; exit 2; }
done

identity_sql="SELECT current_database() || '|' || COALESCE(inet_server_addr()::text,'local') || '|' || inet_server_port();"
source_identity="$(psql "$DR_SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "$identity_sql")"
restore_identity="$(psql "$DR_RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "$identity_sql")"
if [[ "$source_identity" == "$restore_identity" ]]; then
  echo "Refusing DR rehearsal: source and restore database identities are the same." >&2
  exit 3
fi

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
started_epoch="$(date -u +%s)"
backup_started_epoch="$started_epoch"

DATABASE_URL="$DR_SOURCE_DATABASE_URL" \
BACKUP_DIR="$BACKUP_DIR" \
BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
  "$SCRIPT_DIR/backup-postgres.sh" >/dev/null

backup_finished_epoch="$(date -u +%s)"
mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'gracz-*.dump.enc' -print)
[[ "${#backups[@]}" -eq 1 ]] || { echo "Expected exactly one encrypted backup." >&2; exit 4; }
backup="${backups[0]}"
backup_sha256="$(sha256sum "$backup" | awk '{print $1}')"

restore_started_epoch="$(date -u +%s)"
RESTORE_DATABASE_URL="$DR_RESTORE_DATABASE_URL" \
BACKUP_ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY" \
  "$SCRIPT_DIR/test-restore-postgres.sh" "$backup" >/dev/null
restore_finished_epoch="$(date -u +%s)"
finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

source_public_tables="$(psql "$DR_SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';")"
restore_public_tables="$(psql "$DR_RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';")"
[[ "$source_public_tables" == "$restore_public_tables" ]] || {
  echo "Public table count differs between source and restored database." >&2
  exit 5
}

row_reconciliation="not-requested"
if [[ "${STRICT_ROWS,,}" == "true" ]]; then
  counts_sql="$(cat <<'SQL'
CREATE OR REPLACE FUNCTION pg_temp.gracz_table_counts()
RETURNS TABLE(table_name text,row_count bigint)
LANGUAGE plpgsql
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
    RETURN QUERY EXECUTE format(
      'SELECT %L, count(*)::bigint FROM %I.%I',
      r.schemaname||'.'||r.tablename,
      r.schemaname,
      r.tablename
    );
  END LOOP;
END
$$;
SELECT * FROM pg_temp.gracz_table_counts() ORDER BY table_name;
SQL
)"
  psql "$DR_SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -F '|' -c "$counts_sql" > "$WORKDIR/source-counts.txt"
  psql "$DR_RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -F '|' -c "$counts_sql" > "$WORKDIR/restore-counts.txt"
  if ! diff -u "$WORKDIR/source-counts.txt" "$WORKDIR/restore-counts.txt" >/dev/null; then
    echo "Strict row-count reconciliation failed." >&2
    exit 6
  fi
  row_reconciliation="pass"
fi

backup_seconds=$((backup_finished_epoch - backup_started_epoch))
restore_seconds=$((restore_finished_epoch - restore_started_epoch))
rto_observed_seconds=$((restore_finished_epoch - backup_finished_epoch))
rpo_rehearsal_upper_bound_seconds=$((restore_finished_epoch - backup_started_epoch))
total_seconds=$((restore_finished_epoch - started_epoch))

status="pass"
if (( rto_observed_seconds > RTO_TARGET_SECONDS || rpo_rehearsal_upper_bound_seconds > RPO_REHEARSAL_TARGET_SECONDS )); then
  status="fail-target"
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence="$EVIDENCE_DIR/dr-restore-${stamp}.json"
cat > "$evidence" <<JSON
{
  "schema_version": 1,
  "status": "$status",
  "started_at": "$started_at",
  "finished_at": "$finished_at",
  "backup_sha256": "$backup_sha256",
  "backup_duration_seconds": $backup_seconds,
  "restore_duration_seconds": $restore_seconds,
  "rto_observed_seconds": $rto_observed_seconds,
  "rto_target_seconds": $RTO_TARGET_SECONDS,
  "rpo_rehearsal_upper_bound_seconds": $rpo_rehearsal_upper_bound_seconds,
  "rpo_rehearsal_target_seconds": $RPO_REHEARSAL_TARGET_SECONDS,
  "total_duration_seconds": $total_seconds,
  "source_public_table_count": $source_public_tables,
  "restore_public_table_count": $restore_public_tables,
  "strict_row_reconciliation": "$row_reconciliation",
  "source_mutated": false,
  "restore_is_disposable": true
}
JSON

echo "DR evidence created: $evidence"
if [[ "$status" != "pass" ]]; then
  echo "DR rehearsal exceeded configured RPO/RTO rehearsal targets." >&2
  exit 7
fi

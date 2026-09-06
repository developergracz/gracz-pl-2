#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required for destructive-restore safety checks}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must point to a disposable restore-test database}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

BACKUP="${1:?Usage: test-restore-postgres.sh backup.dump.enc}"
PG_RESTORE_BIN="${DR_PG_RESTORE_BIN:-pg_restore}"
EXPECTED_MARKER="gracz-dr-disposable"

validate_key() {
  local bytes
  if ! bytes="$(printf '%s' "$BACKUP_ENCRYPTION_KEY" | base64 --decode 2>/dev/null | wc -c | tr -d ' ')"; then
    echo "BACKUP_ENCRYPTION_KEY must be valid base64." >&2
    return 2
  fi
  [[ "$bytes" == "32" ]] || { echo "BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes." >&2; return 2; }
}

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

validate_key
[[ -f "$BACKUP" ]] || { echo "Backup not found." >&2; exit 2; }
[[ -f "$BACKUP.sha256" ]] || { echo "Backup checksum not found." >&2; exit 2; }

source_identity="$(query_identity "$SOURCE_DATABASE_URL" true)"
restore_identity="$(query_identity "$RESTORE_DATABASE_URL" false)"
source_cluster="$(query_cluster_identity "$SOURCE_DATABASE_URL" true)"
restore_cluster="$(query_cluster_identity "$RESTORE_DATABASE_URL" false)"
[[ -n "$source_identity" && -n "$restore_identity" && -n "$source_cluster" && -n "$restore_cluster" ]] || {
  echo "Database or cluster identity is ambiguous." >&2
  exit 3
}
if [[ "$source_identity" == "$restore_identity" ]]; then
  echo "Refusing restore: source and restore database identities are the same." >&2
  exit 3
fi
if [[ "$source_cluster" == "$restore_cluster" ]]; then
  echo "Refusing restore: source and restore PostgreSQL clusters are the same; target is not isolated." >&2
  exit 3
fi

restore_marker="$(psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT COALESCE(shobj_description(oid,'pg_database'),'') FROM pg_database WHERE datname=current_database();")"
if [[ "$restore_marker" != "$EXPECTED_MARKER" ]]; then
  echo "Refusing restore: target database is not marked as gracz-dr-disposable." >&2
  exit 3
fi

(
  cd "$(dirname "$BACKUP")"
  sha256sum -c "$(basename "$BACKUP").sha256" >/dev/null
)

# Fail-safe preflight: prove the encrypted stream can be decrypted and parsed as
# a PostgreSQL custom archive before pg_restore is allowed to mutate target.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
  -in "$BACKUP" -pass env:BACKUP_ENCRYPTION_KEY \
  | "$PG_RESTORE_BIN" --list >/dev/null

# Decrypt directly into pg_restore stdin. No plaintext dump file is created.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
  -in "$BACKUP" -pass env:BACKUP_ENCRYPTION_KEY \
  | "$PG_RESTORE_BIN" --clean --if-exists --no-owner --no-acl --exit-on-error \
      --dbname "$RESTORE_DATABASE_URL"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT 1" >/dev/null

echo "Restore verification completed successfully."

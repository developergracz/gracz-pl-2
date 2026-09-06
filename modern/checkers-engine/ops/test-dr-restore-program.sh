#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ADMIN_URL="${P1_R_01_SOURCE_DATABASE_URL:-}"
RESTORE_ADMIN_URL="${P1_R_01_RESTORE_DATABASE_URL:-}"
REQUIRE_POSTGRES="${P1_R_01_REQUIRE_POSTGRES:-0}"

if [[ "$REQUIRE_POSTGRES" != "1" ]]; then
  echo "P1_R_01_REQUIRE_POSTGRES=1 is mandatory; DR PostgreSQL tests never silently skip." >&2
  exit 1
fi
if [[ -z "$SOURCE_ADMIN_URL" || -z "$RESTORE_ADMIN_URL" ]]; then
  echo "P1_R_01_SOURCE_DATABASE_URL and P1_R_01_RESTORE_DATABASE_URL are required." >&2
  exit 1
fi
for cmd in psql pg_dump pg_restore openssl sha256sum python3; do
  command -v "$cmd" >/dev/null || { echo "Required command missing: $cmd" >&2; exit 1; }
done
psql "$SOURCE_ADMIN_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT 1" >/dev/null || { echo "Required source PostgreSQL is unavailable." >&2; exit 1; }
psql "$RESTORE_ADMIN_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT 1" >/dev/null || { echo "Required restore PostgreSQL is unavailable." >&2; exit 1; }
source_cluster="$(psql "$SOURCE_ADMIN_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT system_identifier::text FROM pg_control_system();")"
restore_cluster="$(psql "$RESTORE_ADMIN_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT system_identifier::text FROM pg_control_system();")"
[[ -n "$source_cluster" && -n "$restore_cluster" && "$source_cluster" != "$restore_cluster" ]] || {
  echo "Focused DR tests require two distinct PostgreSQL clusters." >&2
  exit 1
}

suffix="${GITHUB_RUN_ID:-$$}_$(date +%s)"
source_db="p1r01_source_${suffix}"
samecluster_db="p1r01_samecluster_${suffix}"
restore_db="p1r01_restore_${suffix}"
corrupt_db="p1r01_corrupt_${suffix}"
wrongkey_db="p1r01_wrongkey_${suffix}"
failure_db="p1r01_failure_${suffix}"
workdir="$(mktemp -d)"

cleanup() {
  set +e
  for db in "$source_db" "$samecluster_db"; do
    psql "$SOURCE_ADMIN_URL" -v ON_ERROR_STOP=1 -qAtc "DROP DATABASE IF EXISTS $db WITH (FORCE);" >/dev/null 2>&1
  done
  for db in "$restore_db" "$corrupt_db" "$wrongkey_db" "$failure_db"; do
    psql "$RESTORE_ADMIN_URL" -v ON_ERROR_STOP=1 -qAtc "DROP DATABASE IF EXISTS $db WITH (FORCE);" >/dev/null 2>&1
  done
  rm -rf "$workdir"
}
trap cleanup EXIT

for db in "$source_db" "$samecluster_db"; do
  psql "$SOURCE_ADMIN_URL" -v ON_ERROR_STOP=1 -qAtc "CREATE DATABASE $db;" >/dev/null
done
for db in "$restore_db" "$corrupt_db" "$wrongkey_db" "$failure_db"; do
  psql "$RESTORE_ADMIN_URL" -v ON_ERROR_STOP=1 -qAtc "CREATE DATABASE $db;" >/dev/null
done
psql "$SOURCE_ADMIN_URL" -v ON_ERROR_STOP=1 -qAtc "COMMENT ON DATABASE $samecluster_db IS 'gracz-dr-disposable';" >/dev/null
for db in "$restore_db" "$corrupt_db" "$wrongkey_db" "$failure_db"; do
  psql "$RESTORE_ADMIN_URL" -v ON_ERROR_STOP=1 -qAtc "COMMENT ON DATABASE $db IS 'gracz-dr-disposable';" >/dev/null
done

source_base="${SOURCE_ADMIN_URL%/*}"
restore_base="${RESTORE_ADMIN_URL%/*}"
source_url="$source_base/$source_db"
samecluster_url="$source_base/$samecluster_db"
restore_url="$restore_base/$restore_db"
corrupt_url="$restore_base/$corrupt_db"
wrongkey_url="$restore_base/$wrongkey_db"
failure_url="$restore_base/$failure_db"

psql "$source_url" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE TABLE gracz_accounts(id BIGINT PRIMARY KEY, login TEXT NOT NULL, rating INTEGER NOT NULL DEFAULT 1200);
CREATE TABLE gracz_newsletter_subscribers(id BIGINT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
CREATE TABLE gracz_game_sessions(game_id TEXT PRIMARY KEY, state JSONB NOT NULL, version INTEGER NOT NULL);
INSERT INTO gracz_accounts(id,login,rating) VALUES (1,'alice',1301),(2,'bob',1277),(3,'carol',1250);
INSERT INTO gracz_newsletter_subscribers(id,email) VALUES (1,'a@example.test'),(2,'b@example.test');
INSERT INTO gracz_game_sessions(game_id,state,version) VALUES ('g1','{"turn":"white"}',4),('g2','{"turn":"black"}',9);
SQL

key1="$(openssl rand -base64 32 | tr -d '\n')"
key2="$(openssl rand -base64 32 | tr -d '\n')"
[[ "$key1" != "$key2" ]]
expected_tables="gracz_accounts,gracz_newsletter_subscribers,gracz_game_sessions"
backup_dir="$workdir/backups"
mkdir -p "$backup_dir"

# A/B/C: encrypted backup, no plaintext retention, checksum creation/verification.
DATABASE_URL="$source_url" BACKUP_DIR="$backup_dir" BACKUP_ENCRYPTION_KEY="$key1" \
  bash "$SCRIPT_DIR/backup-postgres.sh" >/dev/null
mapfile -t encrypted < <(find "$backup_dir" -maxdepth 1 -type f -name '*.dump.enc' -print)
[[ "${#encrypted[@]}" -eq 1 && -s "${encrypted[0]}" ]]
backup="${encrypted[0]}"
[[ -f "$backup.sha256" ]]
! find "$backup_dir" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.sql' -o -name '*.plain' -o -name '*.partial' \) -print -quit | grep -q .
(
  cd "$backup_dir"
  sha256sum -c "$(basename "$backup").sha256" >/dev/null
)

# D/E/F: decrypt preflight + restore on a separate real PostgreSQL cluster + data match.
SOURCE_DATABASE_URL="$source_url" RESTORE_DATABASE_URL="$restore_url" BACKUP_ENCRYPTION_KEY="$key1" \
  bash "$SCRIPT_DIR/test-restore-postgres.sh" "$backup" >/dev/null
[[ "$(psql "$restore_url" -Atqc 'SELECT count(*) FROM gracz_accounts;')" == "3" ]]
[[ "$(psql "$restore_url" -Atqc 'SELECT count(*) FROM gracz_newsletter_subscribers;')" == "2" ]]
[[ "$(psql "$restore_url" -Atqc 'SELECT count(*) FROM gracz_game_sessions;')" == "2" ]]

# G1: source == target is rejected before destructive restore.
set +e
SOURCE_DATABASE_URL="$source_url" RESTORE_DATABASE_URL="$source_url" BACKUP_ENCRYPTION_KEY="$key1" \
  bash "$SCRIPT_DIR/test-restore-postgres.sh" "$backup" >"$workdir/same-db.log" 2>&1
same_code=$?
set -e
[[ "$same_code" -ne 0 ]]
grep -q "source and restore database identities are the same" "$workdir/same-db.log"
[[ "$(psql "$source_url" -Atqc 'SELECT count(*) FROM gracz_accounts;')" == "3" ]]

# G2: a different database on the source cluster is still rejected as non-isolated.
psql "$samecluster_url" -v ON_ERROR_STOP=1 -c "CREATE TABLE sentinel(id int primary key); INSERT INTO sentinel VALUES (1);" >/dev/null
set +e
SOURCE_DATABASE_URL="$source_url" RESTORE_DATABASE_URL="$samecluster_url" BACKUP_ENCRYPTION_KEY="$key1" \
  bash "$SCRIPT_DIR/test-restore-postgres.sh" "$backup" >"$workdir/same-cluster.log" 2>&1
same_cluster_code=$?
set -e
[[ "$same_cluster_code" -ne 0 ]]
grep -q "PostgreSQL clusters are the same" "$workdir/same-cluster.log"
[[ "$(psql "$samecluster_url" -Atqc 'SELECT count(*) FROM sentinel;')" == "1" ]]

# H: missing and invalid encryption keys fail closed without durable output.
missing_dir="$workdir/missing-key"
invalid_dir="$workdir/invalid-key"
mkdir -p "$missing_dir" "$invalid_dir"
set +e
DATABASE_URL="$source_url" BACKUP_DIR="$missing_dir" bash "$SCRIPT_DIR/backup-postgres.sh" >/dev/null 2>&1
missing_code=$?
DATABASE_URL="$source_url" BACKUP_DIR="$invalid_dir" BACKUP_ENCRYPTION_KEY="not-valid-base64***" \
  bash "$SCRIPT_DIR/backup-postgres.sh" >/dev/null 2>&1
invalid_code=$?
set -e
[[ "$missing_code" -ne 0 && "$invalid_code" -ne 0 ]]
[[ -z "$(find "$missing_dir" "$invalid_dir" -type f -print -quit)" ]]

# I: corrupted encrypted backup fails checksum before target mutation.
corrupt_dir="$workdir/corrupt"
mkdir -p "$corrupt_dir"
cp "$backup" "$corrupt_dir/$(basename "$backup")"
cp "$backup.sha256" "$corrupt_dir/$(basename "$backup").sha256"
printf 'corruption' >> "$corrupt_dir/$(basename "$backup")"
psql "$corrupt_url" -v ON_ERROR_STOP=1 -c "CREATE TABLE sentinel(id int primary key); INSERT INTO sentinel VALUES (1);" >/dev/null
set +e
SOURCE_DATABASE_URL="$source_url" RESTORE_DATABASE_URL="$corrupt_url" BACKUP_ENCRYPTION_KEY="$key1" \
  bash "$SCRIPT_DIR/test-restore-postgres.sh" "$corrupt_dir/$(basename "$backup")" >/dev/null 2>&1
corrupt_code=$?
set -e
[[ "$corrupt_code" -ne 0 ]]
[[ "$(psql "$corrupt_url" -Atqc 'SELECT count(*) FROM sentinel;')" == "1" ]]

# J: wrong but structurally valid key fails decryptability preflight before target mutation.
psql "$wrongkey_url" -v ON_ERROR_STOP=1 -c "CREATE TABLE sentinel(id int primary key); INSERT INTO sentinel VALUES (1);" >/dev/null
set +e
SOURCE_DATABASE_URL="$source_url" RESTORE_DATABASE_URL="$wrongkey_url" BACKUP_ENCRYPTION_KEY="$key2" \
  bash "$SCRIPT_DIR/test-restore-postgres.sh" "$backup" >/dev/null 2>&1
wrong_code=$?
set -e
[[ "$wrong_code" -ne 0 ]]
[[ "$(psql "$wrongkey_url" -Atqc 'SELECT count(*) FROM sentinel;')" == "1" ]]

# K: injected restore-command failure must emit structured FAIL evidence.
psql "$failure_url" -v ON_ERROR_STOP=1 -c "CREATE TABLE sentinel(id int primary key); INSERT INTO sentinel VALUES (1);" >/dev/null
failure_evidence="$workdir/failure-evidence"
mkdir -p "$failure_evidence"
set +e
DR_SOURCE_DATABASE_URL="$source_url" DR_RESTORE_DATABASE_URL="$failure_url" BACKUP_ENCRYPTION_KEY="$key1" \
DR_EXPECTED_TABLES="$expected_tables" DR_EVIDENCE_DIR="$failure_evidence" DR_STRICT_ROW_RECONCILIATION="true" \
DR_PG_RESTORE_BIN="/bin/false" bash "$SCRIPT_DIR/dr-restore-rehearsal.sh" >/dev/null 2>&1
failure_code=$?
set -e
[[ "$failure_code" -ne 0 ]]
mapfile -t failure_json < <(find "$failure_evidence" -type f -name 'dr-restore-*.json' -print)
[[ "${#failure_json[@]}" -eq 1 ]]
python3 - "${failure_json[0]}" <<'PY'
import json,sys
v=json.load(open(sys.argv[1]))
assert v["status"] == "fail"
assert v["failure_stage"] == "restore"
assert v["restore"]["succeeded"] is False
PY
[[ "$(psql "$failure_url" -Atqc 'SELECT count(*) FROM sentinel;')" == "1" ]]

# L/M: successful evidence contains required fields, strict reconciliation and no secrets.
success_evidence="$workdir/success-evidence"
mkdir -p "$success_evidence"
DR_SOURCE_DATABASE_URL="$source_url" DR_RESTORE_DATABASE_URL="$restore_url" BACKUP_ENCRYPTION_KEY="$key1" \
DR_EXPECTED_TABLES="$expected_tables" DR_EVIDENCE_DIR="$success_evidence" DR_STRICT_ROW_RECONCILIATION="true" \
DR_RTO_TARGET_SECONDS="300" DR_RPO_REHEARSAL_TARGET_SECONDS="600" \
  bash "$SCRIPT_DIR/dr-restore-rehearsal.sh" >/dev/null
mapfile -t success_json < <(find "$success_evidence" -type f -name 'dr-restore-*.json' -print)
[[ "${#success_json[@]}" -eq 1 ]]
python3 - "${success_json[0]}" "$key1" "$source_url" "$restore_url" "$source_db" "$restore_db" <<'PY'
import json,re,sys
path,key,source_url,target_url,source_db,target_db=sys.argv[1:]
raw=open(path).read()
v=json.loads(raw)
assert v["status"] == "pass"
assert v["failure_stage"] is None
assert v["backup"]["artifact_encrypted"] is True
assert v["backup"]["plaintext_dump_retained"] is False
assert v["backup"]["checksum_verified"] is True
assert v["backup"]["decryptability_verified"] is True
assert re.fullmatch(r"[0-9a-f]{64}", v["backup"]["sha256"])
assert isinstance(v["backup"]["age_seconds"], int)
assert v["restore"]["succeeded"] is True
assert isinstance(v["restore"]["duration_seconds"], int)
assert isinstance(v["restore"]["rto_observed_seconds"], int)
assert v["identity"]["source"]["database"] == source_db
assert v["identity"]["target"]["database"] == target_db
assert re.fullmatch(r"[0-9a-f]{64}", v["identity"]["source"]["fingerprint_sha256"])
assert re.fullmatch(r"[0-9a-f]{64}", v["identity"]["target"]["fingerprint_sha256"])
assert re.fullmatch(r"[0-9a-f]{64}", v["identity"]["source"]["cluster_fingerprint_sha256"])
assert re.fullmatch(r"[0-9a-f]{64}", v["identity"]["target"]["cluster_fingerprint_sha256"])
assert v["identity"]["distinct"] is True
assert v["identity"]["cluster_distinct"] is True
assert v["identity"]["restore_target_marker_verified"] is True
assert v["identity"]["restore_isolated"] is True
assert v["reconciliation"]["strict"] is True
assert v["reconciliation"]["status"] == "pass"
assert v["reconciliation"]["source_row_counts"] == v["reconciliation"]["target_row_counts"]
assert v["reconciliation"]["source_schema_sha256"] == v["reconciliation"]["target_schema_sha256"]
assert set(v["reconciliation"]["expected_tables"]) == {"gracz_accounts","gracz_newsletter_subscribers","gracz_game_sessions"}
assert v["safety"]["source_mutated"] is False
assert v["safety"]["credentials_recorded"] is False
for secret in (key, source_url, target_url, "postgresql://", "@127.0.0.1"):
    assert secret not in raw
PY

# Rehearsal did not mutate the source and no extra accepted data appeared.
[[ "$(psql "$source_url" -Atqc 'SELECT count(*) FROM gracz_accounts;')" == "3" ]]

# N: mandatory real PostgreSQL uses two independently identified clusters.
[[ "$REQUIRE_POSTGRES" == "1" && "$source_cluster" != "$restore_cluster" ]]

echo "P1-R-01 focused DR program tests: PASS"

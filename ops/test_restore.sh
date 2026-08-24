#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${1:?usage: test_restore.sh BACKUP.sql.gz.enc}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY required}"
backup="$1"

if [ -f "${backup}.sha256" ]; then
  sha256sum -c "${backup}.sha256"
fi

tmp_gz="$(mktemp)"
tmp_sql="$(mktemp)"
trap 'rm -f "$tmp_gz" "$tmp_sql"' EXIT

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$backup" -out "$tmp_gz"
gzip -t "$tmp_gz"
gzip -dc "$tmp_gz" > "$tmp_sql"
grep -qE '^(-- MySQL dump|CREATE TABLE|INSERT INTO|SET )' "$tmp_sql"

# Optional full restore to an isolated disposable database.
if [ -n "${RESTORE_TEST_DB:-}" ]; then
  : "${DB_HOST:?DB_HOST required}"
  : "${DB_ADMIN_USER:?DB_ADMIN_USER required for full restore test}"
  : "${DB_ADMIN_PASSWORD:?DB_ADMIN_PASSWORD required for full restore test}"
  export MYSQL_PWD="$DB_ADMIN_PASSWORD"
  mysql -h "$DB_HOST" -u "$DB_ADMIN_USER" -e "DROP DATABASE IF EXISTS \`${RESTORE_TEST_DB}\`; CREATE DATABASE \`${RESTORE_TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  mysql -h "$DB_HOST" -u "$DB_ADMIN_USER" "$RESTORE_TEST_DB" < "$tmp_sql"
  tables="$(mysql -N -h "$DB_HOST" -u "$DB_ADMIN_USER" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${RESTORE_TEST_DB}'")"
  test "$tables" -gt 0
  mysql -h "$DB_HOST" -u "$DB_ADMIN_USER" -e "DROP DATABASE \`${RESTORE_TEST_DB}\`;"
  unset MYSQL_PWD
  echo "Full restore test passed (${tables} tables)."
else
  echo "Backup decrypt/gzip/SQL integrity test passed. Set RESTORE_TEST_DB for a full disposable restore test."
fi

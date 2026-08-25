#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DB_HOST:?DB_HOST required}"
: "${DB_USER:?DB_USER required}"
: "${DB_PASSWORD:?DB_PASSWORD required}"
: "${DB_NAME:?DB_NAME required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
mkdir -p "$BACKUP_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
plain="$(mktemp)"
trap 'rm -f "$plain"' EXIT

export MYSQL_PWD="$DB_PASSWORD"
mysqldump \
  --host="$DB_HOST" \
  --user="$DB_USER" \
  --single-transaction \
  --routines --triggers --events \
  --set-gtid-purged=OFF \
  --default-character-set=utf8mb4 \
  "$DB_NAME" > "$plain"
unset MYSQL_PWD

gzip -c "$plain" | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -out "$BACKUP_DIR/gracz-${ts}.sql.gz.enc"

sha256sum "$BACKUP_DIR/gracz-${ts}.sql.gz.enc" > "$BACKUP_DIR/gracz-${ts}.sql.gz.enc.sha256"
find "$BACKUP_DIR" -type f -mtime "+$RETENTION_DAYS" -delete

echo "Encrypted backup created: gracz-${ts}.sql.gz.enc"

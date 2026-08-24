#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/gracz-${STAMP}.dump.enc"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$TMP"
openssl enc -aes-256-cbc -pbkdf2 -salt -in "$TMP" -out "$OUT" -pass env:BACKUP_ENCRYPTION_KEY
sha256sum "$OUT" > "$OUT.sha256"
echo "Encrypted backup created: $OUT"

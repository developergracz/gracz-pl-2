#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/gracz-${STAMP}.dump.enc"
PARTIAL="${OUT}.partial"

cleanup() {
  rm -f "$PARTIAL"
}
trap cleanup EXIT

# pg_dump writes a consistent custom-format snapshot. The stream is encrypted
# immediately so no plaintext database dump is persisted on disk.
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -out "$PARTIAL" -pass env:BACKUP_ENCRYPTION_KEY

mv "$PARTIAL" "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
echo "Encrypted backup created: $OUT"

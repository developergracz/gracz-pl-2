#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

validate_key() {
  local bytes
  if ! bytes="$(printf '%s' "$BACKUP_ENCRYPTION_KEY" | base64 --decode 2>/dev/null | wc -c | tr -d ' ')"; then
    echo "BACKUP_ENCRYPTION_KEY must be valid base64." >&2
    return 2
  fi
  if [[ "$bytes" != "32" ]]; then
    echo "BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes." >&2
    return 2
  fi
}

validate_key

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/gracz-${STAMP}.dump.enc"
PARTIAL="${OUT}.partial"
CHECKSUM="${OUT}.sha256"
CHECKSUM_PARTIAL="${CHECKSUM}.partial"

cleanup() {
  rm -f "$PARTIAL" "$CHECKSUM_PARTIAL"
}
trap cleanup EXIT

# Source access is forced read-only. pg_dump streams directly into encryption;
# no plaintext SQL/custom-format dump is persisted as an intermediate file.
PGOPTIONS="-c default_transaction_read_only=on ${PGOPTIONS:-}" \
  pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -salt \
      -out "$PARTIAL" -pass env:BACKUP_ENCRYPTION_KEY

[[ -s "$PARTIAL" ]] || { echo "Encrypted backup output is empty." >&2; exit 3; }
mv "$PARTIAL" "$OUT"

hash="$(sha256sum "$OUT" | awk '{print $1}')"
printf '%s  %s\n' "$hash" "$(basename "$OUT")" > "$CHECKSUM_PARTIAL"
mv "$CHECKSUM_PARTIAL" "$CHECKSUM"

(
  cd "$BACKUP_DIR"
  sha256sum -c "$(basename "$CHECKSUM")" >/dev/null
)

echo "Encrypted backup created: $OUT"

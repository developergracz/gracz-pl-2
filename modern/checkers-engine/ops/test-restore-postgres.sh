#!/usr/bin/env bash
set -euo pipefail
umask 077

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must point to a disposable restore-test database}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

BACKUP="${1:?Usage: test-restore-postgres.sh backup.dump.enc}"
[ -f "$BACKUP" ] || { echo "Backup not found" >&2; exit 2; }
[ -f "$BACKUP.sha256" ] || { echo "Backup checksum not found" >&2; exit 2; }
sha256sum -c "$BACKUP.sha256"

# The encrypted archive is decrypted directly into pg_restore stdin. No
# plaintext database dump is persisted on the runner filesystem.
openssl enc -d -aes-256-cbc -pbkdf2 -in "$BACKUP" -pass env:BACKUP_ENCRYPTION_KEY \
  | pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --dbname "$RESTORE_DATABASE_URL"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT 1" >/dev/null

echo "Restore verification completed successfully."

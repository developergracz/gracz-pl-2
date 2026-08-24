#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must point to a disposable restore-test database}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"
BACKUP="${1:?Usage: test-restore-postgres.sh backup.dump.enc}"
[ -f "$BACKUP" ] || { echo "Backup not found" >&2; exit 2; }
[ -f "$BACKUP.sha256" ] && sha256sum -c "$BACKUP.sha256"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -in "$BACKUP" -out "$TMP" -pass env:BACKUP_ENCRYPTION_KEY
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" "$TMP"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS account_rows FROM gracz_accounts;" >/dev/null
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS newsletter_rows FROM gracz_newsletter_subscribers;" >/dev/null
echo "Restore verification completed successfully."

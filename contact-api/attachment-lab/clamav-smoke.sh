#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
if [[ "${GRACZ_ATTACHMENT_LAB_ONLY:-}" != "1" || "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "DENIED: only disposable GitHub Actions lab." >&2; exit 3
fi
command -v clamscan >/dev/null || { echo "Missing ClamAV." >&2; exit 3; }
database="${CLAMAV_DB_DIR:-/var/lib/clamav}"
if ! find "$database" -maxdepth 1 -type f \( -name '*.cvd' -o -name '*.cld' \) -print -quit | grep -q .; then
  echo "DENIED: missing current official ClamAV signatures." >&2; exit 3
fi
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
printf 'gracz.pl syntetyczny bezpieczny plik\n' > "$work/clean.txt"
# EICAR is a harmless standardized antivirus test marker, NOT live malware.
printf '%s' 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > "$work/eicar.txt"
timeout 300s clamscan --database="$database" --no-summary -- "$work/clean.txt" >/dev/null || { echo "FAIL clean file" >&2; exit 1; }
set +e
timeout 300s clamscan --database="$database" --no-summary -- "$work/eicar.txt" >/dev/null
result=$?
set -e
if [[ "$result" -ne 1 ]]; then
  echo "FAIL EICAR; expected detection 1, got $result." >&2; exit 1
fi
echo "PASS: official ClamAV signatures, clean=0, EICAR=1; production untouched."

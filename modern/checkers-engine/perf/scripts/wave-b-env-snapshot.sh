#!/usr/bin/env bash
set -euo pipefail
RUN_ID="${WAVE_B_RUN_ID:-wave-b}"
OUT="perf/k6/reports/${RUN_ID}-environment.txt"
mkdir -p "$(dirname "$OUT")"
{
  echo "RUN_ID=$RUN_ID"
  echo "UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD=$(git rev-parse HEAD)"
  echo "TREE=$(git rev-parse HEAD^{tree})"
  echo "NODE=$(node --version)"
  echo "K6=$(k6 version 2>/dev/null || true)"
  echo "UNAME=$(uname -a)"
  echo "--- OS ---"; cat /etc/os-release || true
  echo "--- CPU ---"; lscpu || true
  echo "--- MEMORY ---"; cat /proc/meminfo || true
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "--- POSTGRES ---"
    psql "$DATABASE_URL" -Atc "SELECT version(); SHOW max_connections; SHOW shared_buffers; SHOW work_mem; SHOW max_wal_size;" || true
  fi
} | tee "$OUT"

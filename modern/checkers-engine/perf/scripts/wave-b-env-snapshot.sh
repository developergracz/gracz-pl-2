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
  echo "REPLICAS=${WAVE_B_REPLICAS:-1}"
  echo "VUS=${WAVE_B_VUS:-0}"
  echo "WARMUP_SECONDS=${WAVE_B_WARMUP_SECONDS:-0}"
  echo "STEADY_SECONDS=${WAVE_B_STEADY_SECONDS:-0}"
  echo "COOLDOWN_SECONDS=${WAVE_B_COOLDOWN_SECONDS:-0}"
  echo "SEED=${WAVE_B_SEED:-unset}"
  echo "NODE=$(node --version)"
  echo "K6=$(k6 version 2>/dev/null || true)"
  echo "CPU_COUNT=$(nproc 2>/dev/null || true)"
  echo "ULIMIT_NOFILE=$(ulimit -n 2>/dev/null || true)"
  echo "UNAME=$(uname -a)"
  if [[ -f perf/k6/datasets/runtime.json ]];then node -e "const d=require('./perf/k6/datasets/runtime.json'); console.log('DATASET_ID='+(d.datasetId||'unknown')); console.log('DATASET_USERS='+(d.users?.length||0)); console.log('DATASET_GAMES='+((d.checkersGames?.length||0)+(d.gomokuGames?.length||0)+(d.thousandGames?.length||0)))";fi
  echo "--- OS ---"; cat /etc/os-release || true
  echo "--- CPU ---"; lscpu || true
  echo "--- MEMORY ---"; cat /proc/meminfo || true
  if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "--- POSTGRES ---"
    psql "$DATABASE_URL" -Atc "SELECT version(); SHOW max_connections; SHOW shared_buffers; SHOW work_mem; SHOW max_wal_size; SHOW superuser_reserved_connections;" || true
  fi
} | tee "$OUT"

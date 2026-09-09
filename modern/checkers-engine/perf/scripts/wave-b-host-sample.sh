#!/usr/bin/env bash
set -euo pipefail
RUN_ID="${WAVE_B_RUN_ID:-wave-b}"
DURATION="${WAVE_B_HOST_SAMPLE_SECONDS:-60}"
INTERVAL="${WAVE_B_HOST_SAMPLE_INTERVAL:-10}"
OUT="perf/k6/reports/${RUN_ID}-host.csv"
mkdir -p "$(dirname "$OUT")"
echo 'ts,load1,load5,load15,k6_pid,k6_cpu_percent,k6_rss_kb,postgres_container,postgres_cpu_percent,postgres_mem_usage' > "$OUT"
pg_container="$(docker ps --filter 'ancestor=postgres:16-alpine' --format '{{.ID}}' | head -1 || true)"
if [[ -z "$pg_container" ]]; then pg_container="$(docker ps --filter 'ancestor=postgres:16' --format '{{.ID}}' | head -1 || true)"; fi
end=$(( $(date +%s) + DURATION ))
while [[ $(date +%s) -lt $end ]]; do
  ts="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
  read -r load1 load5 load15 _ < /proc/loadavg
  k6_pid="$(pgrep -n -x k6 2>/dev/null || true)"; k6_cpu=""; k6_rss=""
  if [[ -n "$k6_pid" ]]; then read -r k6_cpu k6_rss < <(ps -p "$k6_pid" -o %cpu=,rss= | awk '{print $1,$2}'); fi
  pg_cpu=""; pg_mem=""
  if [[ -n "$pg_container" ]]; then
    stats="$(docker stats --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}' "$pg_container" 2>/dev/null || true)"
    pg_cpu="${stats%%|*}"; pg_cpu="${pg_cpu%\%}"; pg_mem="${stats#*|}"; pg_mem="${pg_mem//,/;}"
  fi
  echo "$ts,$load1,$load5,$load15,${k6_pid:-},${k6_cpu:-},${k6_rss:-},${pg_container:-},${pg_cpu:-},${pg_mem:-}" >> "$OUT"
  sleep "$INTERVAL"
done

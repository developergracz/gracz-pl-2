#!/usr/bin/env bash
set -euo pipefail
RUN_ID="${WAVE_B_RUN_ID:-wave-b}"
PIDS_FILE="${WAVE_B_PIDS_FILE:-/tmp/wave-b-app-pids}"
DURATION="${WAVE_B_APP_SAMPLE_SECONDS:-60}"
INTERVAL="${WAVE_B_APP_SAMPLE_INTERVAL:-1}"
PORTS="${WAVE_B_APP_PORTS:-3000}"
OUT="perf/k6/reports/${RUN_ID}-application.csv"
mkdir -p "$(dirname "$OUT")"
echo 'ts,pid,cpu_percent,rss_kb,established_tcp,process_state' > "$OUT"
end=$(( $(date +%s) + DURATION ))
while [[ $(date +%s) -lt $end ]]; do
  ts=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
  mapfile -t pids < <(cat "$PIDS_FILE" 2>/dev/null || true)
  IFS=',' read -ra ports <<< "$PORTS"
  for i in "${!pids[@]}"; do
    pid="${pids[$i]}"; port="${ports[$i]:-${ports[0]}}"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      read -r cpu rss state < <(ps -p "$pid" -o %cpu=,rss=,stat= | awk '{print $1,$2,$3}')
      sockets=$(ss -Htan state established "( sport = :$port )" 2>/dev/null | wc -l | tr -d ' ')
      echo "$ts,$pid,${cpu:-0},${rss:-0},${sockets:-0},${state:-unknown}" >> "$OUT"
    else
      echo "$ts,$pid,0,0,0,PROCESS_DEAD" >> "$OUT"
    fi
  done
  sleep "$INTERVAL"
done

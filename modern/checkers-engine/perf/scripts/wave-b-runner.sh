#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
: "${AUTH_SECRET:?AUTH_SECRET required}"
REPLICAS="${WAVE_B_REPLICAS:-1}"
VUS="${WAVE_B_VUS:-100}"
SCENARIO="${WAVE_B_SCENARIO:-mixed-platform}"
RUN_ID="${WAVE_B_RUN_ID:-b1-r${REPLICAS}-v${VUS}-${SCENARIO}}"
BASE_PORT="${WAVE_B_BASE_PORT:-3000}"
REPORT_DIR="perf/k6/reports"
PIDS_FILE="/tmp/wave-b-app-pids-${RUN_ID}"
mkdir -p "$REPORT_DIR"; : > "$PIDS_FILE"
ports=(); pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${pids[@]:-}"; do wait "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT
for ((i=0;i<REPLICAS;i++)); do
  port=$((BASE_PORT+i)); ports+=("$port")
  PORT="$port" HOST=127.0.0.1 NODE_ENV=test DATABASE_URL="$DATABASE_URL" AUTH_SECRET="$AUTH_SECRET" POSTGRES_POOL_BUDGET="${POSTGRES_POOL_BUDGET:-64}" node --require ./src/pg-secure-preload.cjs src/main.js >"$REPORT_DIR/${RUN_ID}-app-${i}.log" 2>&1 &
  pid=$!; pids+=("$pid"); echo "$pid" >> "$PIDS_FILE"
done
for port in "${ports[@]}"; do
  ok=0
  for _ in $(seq 1 120); do
    if curl -fsS "http://127.0.0.1:${port}/health/ready" >/dev/null; then ok=1; break; fi
    sleep .5
  done
  if [[ "$ok" != 1 ]]; then echo "Replica on $port failed readiness" >&2; tail -100 "$REPORT_DIR/${RUN_ID}-app-"*.log >&2 || true; exit 20; fi
done
BASE_URLS=$(printf 'http://127.0.0.1:%s,' "${ports[@]}"); BASE_URLS=${BASE_URLS%,}; export BASE_URLS WAVE_B_RUN_ID="$RUN_ID"
USER_COUNT="${WAVE_B_USER_COUNT:-$(( VUS + 500 ))}"; if (( USER_COUNT < 1200 )); then USER_COUNT=1200; fi
WAVE_B_USER_COUNT="$USER_COUNT" WAVE_B_GAME_COUNT="${WAVE_B_GAME_COUNT:-20}" node perf/scripts/wave-b-seed.mjs
bash perf/scripts/wave-b-env-snapshot.sh
node perf/scripts/wave-b-listener-headroom.mjs || true
SAMPLE_SECONDS="${WAVE_B_SAMPLE_SECONDS:-60}"
WAVE_B_PG_SAMPLE_SECONDS="$SAMPLE_SECONDS" bash perf/scripts/wave-b-postgres-sample.sh & pg_sampler=$!
WAVE_B_PIDS_FILE="$PIDS_FILE" WAVE_B_APP_PORTS="$(IFS=,;echo "${ports[*]}")" WAVE_B_APP_SAMPLE_SECONDS="$SAMPLE_SECONDS" bash perf/scripts/wave-b-app-sample.sh & app_sampler=$!
set +e
WAVE_B_VUS="$VUS" WAVE_B_SCENARIO="$SCENARIO" k6 run "perf/k6/scenarios/${WAVE_B_SCENARIO_FILE:-10-mixed-platform.js}" --summary-export "$REPORT_DIR/${RUN_ID}-k6-summary-export.json"
k6_status=$?
wait "$pg_sampler"; pg_sampler_status=$?
wait "$app_sampler"; app_sampler_status=$?
node perf/scripts/wave-b-correctness-check.mjs
correctness_status=$?
set -e
psql "$DATABASE_URL" -At -F',' -c "SELECT now(),count(*) FILTER(WHERE state='active'),count(*) FILTER(WHERE state='idle'),count(*) FILTER(WHERE wait_event IS NOT NULL) FROM pg_stat_activity WHERE datname=current_database();" > "$REPORT_DIR/${RUN_ID}-pg-final.txt" || true
printf '{"runId":"%s","head":"%s","tree":"%s","replicas":%s,"vus":%s,"scenario":"%s","baseUrls":"%s","k6Exit":%s,"correctnessExit":%s,"pgSamplerExit":%s,"appSamplerExit":%s}\n' "$RUN_ID" "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})" "$REPLICAS" "$VUS" "$SCENARIO" "$BASE_URLS" "$k6_status" "$correctness_status" "$pg_sampler_status" "$app_sampler_status" > "$REPORT_DIR/${RUN_ID}-record.json"
if (( correctness_status != 0 )); then exit 2; fi
exit "$k6_status"

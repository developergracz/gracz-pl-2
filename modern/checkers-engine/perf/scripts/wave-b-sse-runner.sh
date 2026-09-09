#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
: "${AUTH_SECRET:?AUTH_SECRET required}"
REPLICAS="${WAVE_B_REPLICAS:-1}"
CONNECTIONS="${WAVE_B_SSE_CONNECTIONS:-100}"
KIND="${WAVE_B_SSE_KIND:-gomoku}"
SECONDS="${WAVE_B_SSE_SECONDS:-30}"
RUN_ID="${WAVE_B_RUN_ID:-sse-${KIND}-r${REPLICAS}-c${CONNECTIONS}}"
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
  [[ "$ok" == 1 ]] || { echo "readiness failed $port" >&2; exit 20; }
done
BASE_URLS=$(printf 'http://127.0.0.1:%s,' "${ports[@]}"); BASE_URLS=${BASE_URLS%,}; export BASE_URLS WAVE_B_RUN_ID="$RUN_ID"
users=$((CONNECTIONS+600)); if ((users<1200)); then users=1200; fi
games=$(( (CONNECTIONS+49)/50 )); if ((games<20)); then games=20; fi; if ((games>200)); then games=200; fi
WAVE_B_USER_COUNT="$users" WAVE_B_GAME_COUNT="$games" node perf/scripts/wave-b-seed.mjs
bash perf/scripts/wave-b-env-snapshot.sh
node perf/scripts/wave-b-listener-headroom.mjs || true
sample=$((SECONDS+8))
WAVE_B_PG_SAMPLE_SECONDS="$sample" bash perf/scripts/wave-b-postgres-sample.sh & pg_sampler=$!
WAVE_B_PIDS_FILE="$PIDS_FILE" WAVE_B_APP_PORTS="$(IFS=,;echo "${ports[*]}")" WAVE_B_APP_SAMPLE_SECONDS="$sample" bash perf/scripts/wave-b-app-sample.sh & app_sampler=$!
WAVE_B_SSE_KIND="$KIND" WAVE_B_SSE_CONNECTIONS="$CONNECTIONS" WAVE_B_SSE_SECONDS="$SECONDS" node perf/scripts/wave-b-sse-load.mjs & sse_pid=$!
if [[ "${WAVE_B_STORM:-0}" == 1 ]]; then
  sleep "${WAVE_B_STORM_AFTER:-8}"
  case "$KIND" in
    gomoku) channel='gracz_gomoku_realtime' ;;
    thousand) channel='gracz_thousand_realtime' ;;
    global-chat) channel='gracz_global_chat_realtime' ;;
    *) channel='' ;;
  esac
  if [[ -n "$channel" ]]; then
    psql "$DATABASE_URL" -Atc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND query ~ '^LISTEN ${channel}'" | tee "$REPORT_DIR/${RUN_ID}-listener-kill.txt" || true
  fi
fi
set +e
wait "$sse_pid"; sse_status=$?
wait "$pg_sampler"; pg_status=$?
wait "$app_sampler"; app_status=$?
node perf/scripts/wave-b-correctness-check.mjs; correctness_status=$?
set -e
printf '{"runId":"%s","head":"%s","tree":"%s","replicas":%s,"connections":%s,"kind":"%s","storm":%s,"sseExit":%s,"correctnessExit":%s,"pgSamplerExit":%s,"appSamplerExit":%s}\n' "$RUN_ID" "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})" "$REPLICAS" "$CONNECTIONS" "$KIND" "${WAVE_B_STORM:-0}" "$sse_status" "$correctness_status" "$pg_status" "$app_status" > "$REPORT_DIR/${RUN_ID}-record.json"
if ((correctness_status!=0)); then exit 2; fi
exit "$sse_status"

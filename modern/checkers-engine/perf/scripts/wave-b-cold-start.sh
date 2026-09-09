#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
REPLICAS="${WAVE_B_REPLICAS:-1}"
RUN_ID="${WAVE_B_RUN_ID:-cold-start-r${REPLICAS}}"
BASE_PORT="${WAVE_B_BASE_PORT:-3400}"
REPORT_DIR="perf/k6/reports";mkdir -p "$REPORT_DIR"
WAVE_B_ALLOW_SCHEMA_BOOTSTRAP=1 node perf/scripts/wave-b-gomoku-bootstrap.mjs
pids=();ready=0
cleanup(){ for pid in "${pids[@]:-}";do kill "$pid" 2>/dev/null||true;done;for pid in "${pids[@]:-}";do wait "$pid" 2>/dev/null||true;done; }
trap cleanup EXIT
for ((i=0;i<REPLICAS;i++));do
  port=$((BASE_PORT+i));obs="$REPORT_DIR/${RUN_ID}-obs-${i}.jsonl"
  PORT="$port" HOST=127.0.0.1 NODE_ENV=test WAVE_B_OBS_FILE="$obs" node --require ./perf/scripts/wave-b-observability-preload.cjs --require ./src/pg-secure-preload.cjs src/start.js >"$REPORT_DIR/${RUN_ID}-app-${i}.log" 2>&1 & pids+=("$!")
done
for ((i=0;i<REPLICAS;i++));do
  port=$((BASE_PORT+i));ok=0
  for _ in $(seq 1 180);do if curl -fsS "http://127.0.0.1:${port}/health/ready" >/dev/null;then ok=1;break;fi;sleep .5;done
  if [[ "$ok" == 1 ]];then ready=$((ready+1));else tail -120 "$REPORT_DIR/${RUN_ID}-app-${i}.log" >&2||true;fi
done
printf '{"runId":"%s","replicas":%s,"ready":%s,"pass":%s,"head":"%s","tree":"%s"}\n' "$RUN_ID" "$REPLICAS" "$ready" "$([[ "$ready" == "$REPLICAS" ]]&&echo true||echo false)" "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})" >"$REPORT_DIR/${RUN_ID}-cold-start.json"
[[ "$ready" == "$REPLICAS" ]]

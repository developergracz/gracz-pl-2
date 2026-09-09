#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
RUN_ID="${WAVE_B_RUN_ID:-wave-b}"
INTERVAL="${WAVE_B_PG_SAMPLE_INTERVAL:-1}"
DURATION="${WAVE_B_PG_SAMPLE_SECONDS:-60}"
OUT="perf/k6/reports/${RUN_ID}-postgres.csv"
mkdir -p "$(dirname "$OUT")"
echo 'ts,numbackends,active,idle,waiting,long_queries,waiting_locks,xact_commit,xact_rollback,deadlocks,blks_read,blks_hit,temp_files,temp_bytes,wal_lsn' > "$OUT"
end=$(( $(date +%s) + DURATION ))
while [[ $(date +%s) -lt $end ]]; do
  psql "$DATABASE_URL" -At -F',' -c "WITH a AS (SELECT count(*) FILTER(WHERE state='active') active,count(*) FILTER(WHERE state='idle') idle,count(*) FILTER(WHERE wait_event IS NOT NULL) waiting,count(*) FILTER(WHERE state='active' AND now()-query_start>interval '1 second') long_queries FROM pg_stat_activity WHERE datname=current_database()),l AS (SELECT count(*) FILTER(WHERE NOT granted) waiting_locks FROM pg_locks),d AS (SELECT numbackends,xact_commit,xact_rollback,deadlocks,blks_read,blks_hit,temp_files,temp_bytes FROM pg_stat_database WHERE datname=current_database()) SELECT to_char(clock_timestamp(),'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),d.numbackends,a.active,a.idle,a.waiting,a.long_queries,l.waiting_locks,d.xact_commit,d.xact_rollback,d.deadlocks,d.blks_read,d.blks_hit,d.temp_files,d.temp_bytes,pg_current_wal_lsn() FROM a,l,d;" >> "$OUT" || echo "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ),PG_SAMPLE_ERROR" >> "$OUT"
  sleep "$INTERVAL"
done

#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
RUN_ID="${WAVE_B_RUN_ID:-wave-b}"
INTERVAL="${WAVE_B_PG_SAMPLE_INTERVAL:-1}"
DURATION="${WAVE_B_PG_SAMPLE_SECONDS:-60}"
OUT="perf/k6/reports/${RUN_ID}-postgres.csv"
mkdir -p "$(dirname "$OUT")"
echo 'ts,numbackends,active,idle,idle_in_transaction,waiting,client_wait,lock_wait,lwlock_wait,io_wait,ipc_wait,timeout_wait,activity_wait,bufferpin_wait,transactionid_wait,long_queries,max_query_ms,max_xact_ms,waiting_locks,xact_commit,xact_rollback,deadlocks,blks_read,blks_hit,temp_files,temp_bytes,wal_lsn,max_connections' > "$OUT"
end=$(( $(date +%s) + DURATION ))
while [[ $(date +%s) -lt $end ]]; do
  psql "$DATABASE_URL" -At -F',' -c "WITH a AS (
    SELECT count(*) FILTER(WHERE state='active') active,count(*) FILTER(WHERE state='idle') idle,count(*) FILTER(WHERE state='idle in transaction') idle_in_transaction,
      count(*) FILTER(WHERE wait_event IS NOT NULL) waiting,count(*) FILTER(WHERE wait_event_type='Client') client_wait,count(*) FILTER(WHERE wait_event_type='Lock') lock_wait,
      count(*) FILTER(WHERE wait_event_type='LWLock') lwlock_wait,count(*) FILTER(WHERE wait_event_type='IO') io_wait,count(*) FILTER(WHERE wait_event_type='IPC') ipc_wait,
      count(*) FILTER(WHERE wait_event_type='Timeout') timeout_wait,count(*) FILTER(WHERE wait_event_type='Activity') activity_wait,count(*) FILTER(WHERE wait_event_type='BufferPin') bufferpin_wait,
      count(*) FILTER(WHERE wait_event_type='Lock' AND wait_event='transactionid') transactionid_wait,
      count(*) FILTER(WHERE state='active' AND now()-query_start>interval '1 second') long_queries,
      COALESCE(max(EXTRACT(EPOCH FROM (clock_timestamp()-query_start))*1000) FILTER(WHERE state='active'),0)::numeric(12,3) max_query_ms,
      COALESCE(max(EXTRACT(EPOCH FROM (clock_timestamp()-xact_start))*1000) FILTER(WHERE xact_start IS NOT NULL),0)::numeric(12,3) max_xact_ms
    FROM pg_stat_activity WHERE datname=current_database()),
    l AS (SELECT count(*) FILTER(WHERE NOT granted) waiting_locks FROM pg_locks),
    d AS (SELECT numbackends,xact_commit,xact_rollback,deadlocks,blks_read,blks_hit,temp_files,temp_bytes FROM pg_stat_database WHERE datname=current_database()),
    c AS (SELECT setting::int AS max_connections FROM pg_settings WHERE name='max_connections')
  SELECT to_char(clock_timestamp(),'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'),d.numbackends,a.active,a.idle,a.idle_in_transaction,a.waiting,a.client_wait,a.lock_wait,a.lwlock_wait,a.io_wait,a.ipc_wait,a.timeout_wait,a.activity_wait,a.bufferpin_wait,a.transactionid_wait,a.long_queries,a.max_query_ms,a.max_xact_ms,l.waiting_locks,d.xact_commit,d.xact_rollback,d.deadlocks,d.blks_read,d.blks_hit,d.temp_files,d.temp_bytes,pg_current_wal_lsn(),c.max_connections FROM a,l,d,c;" >> "$OUT" || echo "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ),PG_SAMPLE_ERROR" >> "$OUT"
  sleep "$INTERVAL"
done

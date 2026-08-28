-- Gracz.pl ETAP 3 — Environment Baseline Collector
-- READ-ONLY. Uruchomić na Render PostgreSQL przez psql.
-- Nie zawiera DDL/DML. Nie wklejać connection string/hasła do repo ani czatu.

\pset pager off
\timing on

\echo '=== 01 SERVER ==='
SELECT now() AS captured_at,
       version() AS postgres_version,
       current_database() AS database_name,
       current_user AS current_user,
       inet_server_addr() AS server_addr,
       inet_server_port() AS server_port;

\echo '=== 02 TABLE LIST ==='
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename;

\echo '=== 03 TABLE COUNTS + SIZES ==='
CREATE TEMP TABLE baseline_table_profile (
  schemaname text,
  tablename text,
  exact_rows bigint,
  total_bytes bigint,
  table_bytes bigint,
  index_bytes bigint
) ON COMMIT DROP;

DO $baseline$
DECLARE r record; c bigint;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema')
    ORDER BY schemaname, tablename
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I', r.schemaname, r.tablename) INTO c;
    INSERT INTO baseline_table_profile
    SELECT r.schemaname, r.tablename, c,
           pg_total_relation_size(format('%I.%I',r.schemaname,r.tablename)::regclass),
           pg_relation_size(format('%I.%I',r.schemaname,r.tablename)::regclass),
           pg_indexes_size(format('%I.%I',r.schemaname,r.tablename)::regclass);
  END LOOP;
END
$baseline$;

SELECT schemaname, tablename, exact_rows,
       pg_size_pretty(total_bytes) AS total_size,
       pg_size_pretty(table_bytes) AS table_size,
       pg_size_pretty(index_bytes) AS indexes_size
FROM baseline_table_profile
ORDER BY schemaname, tablename;

\echo '=== 04 INDEXES ==='
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, indexname;

\echo '=== 05 CONSTRAINTS / FK ==='
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       con.conname AS constraint_name,
       con.contype AS constraint_type,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname,c.relname,con.contype,con.conname;

\echo '=== 06 TABLE STATS ==='
SELECT schemaname, relname,
       n_live_tup, n_dead_tup,
       seq_scan, idx_scan,
       n_tup_ins, n_tup_upd, n_tup_del,
       last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY schemaname, relname;

\echo '=== 07 ACTIVE CONNECTIONS (REDACTED) ==='
SELECT datname, usename, application_name, state,
       count(*) AS connections,
       min(backend_start) AS oldest_backend
FROM pg_stat_activity
WHERE datname=current_database()
GROUP BY datname,usename,application_name,state
ORDER BY connections DESC, usename, application_name;

\echo '=== 08 LOCKS SUMMARY ==='
SELECT locktype, mode, granted, count(*) AS lock_count
FROM pg_locks
GROUP BY locktype,mode,granted
ORDER BY granted,locktype,mode;

\echo '=== 09 REPLICATION SLOTS ==='
SELECT slot_name, plugin, slot_type, database, active
FROM pg_replication_slots
ORDER BY slot_name;

\echo '=== 10 EXTENSIONS ==='
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

\echo '=== 11 SELECTED SETTINGS ==='
SELECT name, setting, unit, source
FROM pg_settings
WHERE name IN (
 'server_version','max_connections','shared_buffers','work_mem','maintenance_work_mem',
 'statement_timeout','lock_timeout','idle_in_transaction_session_timeout',
 'autovacuum','track_counts','wal_level','max_wal_size','timezone'
)
ORDER BY name;

\echo '=== 12 ROLES — NO PASSWORD DATA ==='
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb,
       rolcanlogin, rolreplication, rolbypassrls
FROM pg_roles
ORDER BY rolname;

\echo '=== 13 TABLESPACES ==='
SELECT spcname, pg_get_userbyid(spcowner) AS owner
FROM pg_tablespace
ORDER BY spcname;

\echo '=== 14 COLUMNS / NULLABILITY / DEFAULTS ==='
SELECT table_schema, table_name, ordinal_position, column_name,
       data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema,table_name,ordinal_position;

\echo '=== END BASELINE ==='

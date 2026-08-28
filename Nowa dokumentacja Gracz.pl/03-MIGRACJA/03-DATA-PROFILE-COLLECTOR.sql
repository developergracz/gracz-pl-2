-- Gracz.pl ETAP 3 — Data Profile Collector
-- READ-ONLY wobec danych produkcyjnych.
-- Brak CREATE/ALTER/DROP/INSERT/UPDATE/DELETE.
-- Wykonuje dokładne COUNT(*) oraz odczyt fizycznych rozmiarów tabel, indeksów i TOAST.
-- Uruchamiać przez psql na Render PostgreSQL.
-- Nie wklejać connection string/hasła do repo ani czatu.

\pset pager off
\timing on

\echo '=== 01 CAPTURE METADATA ==='
SELECT now() AS captured_at,
       current_database() AS database_name,
       current_user AS current_user,
       current_setting('server_version') AS server_version;

\echo '=== 02 EXACT ROW COUNTS — ALL USER TABLES ==='
WITH commands AS (
  SELECT string_agg(
    format(
      'SELECT %L::text AS schemaname, %L::text AS tablename, count(*)::bigint AS exact_rows FROM %I.%I',
      schemaname, tablename, schemaname, tablename
    ),
    E'\nUNION ALL\n'
    ORDER BY schemaname, tablename
  ) AS sql
  FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog','information_schema')
)
SELECT sql || E'\nORDER BY schemaname, tablename;' FROM commands \gexec

\echo '=== 03 EXACT PHYSICAL SIZES — TABLE / INDEX / TOAST ==='
SELECT n.nspname AS schemaname,
       c.relname AS tablename,
       pg_relation_size(c.oid) AS table_bytes,
       pg_indexes_size(c.oid) AS index_bytes,
       CASE
         WHEN c.reltoastrelid = 0 THEN 0
         ELSE pg_total_relation_size(c.reltoastrelid)
       END AS toast_total_bytes,
       pg_total_relation_size(c.oid) AS total_bytes,
       pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
       pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
       pg_size_pretty(
         CASE
           WHEN c.reltoastrelid = 0 THEN 0
           ELSE pg_total_relation_size(c.reltoastrelid)
         END
       ) AS toast_total_size,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p')
  AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname, c.relname;

\echo '=== 04 SIZE RECONCILIATION ==='
SELECT n.nspname AS schemaname,
       c.relname AS tablename,
       pg_total_relation_size(c.oid) AS total_bytes,
       pg_relation_size(c.oid) AS main_table_bytes,
       pg_indexes_size(c.oid) AS index_bytes,
       CASE
         WHEN c.reltoastrelid = 0 THEN 0
         ELSE pg_total_relation_size(c.reltoastrelid)
       END AS toast_total_bytes,
       pg_total_relation_size(c.oid)
         - pg_relation_size(c.oid)
         - pg_indexes_size(c.oid)
         - CASE
             WHEN c.reltoastrelid = 0 THEN 0
             ELSE pg_total_relation_size(c.reltoastrelid)
           END AS other_storage_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p')
  AND n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY n.nspname, c.relname;

\echo '=== 05 SEQUENCES ==='
SELECT schemaname,
       sequencename,
       data_type,
       start_value,
       min_value,
       max_value,
       increment_by,
       cycle,
       cache_size,
       last_value
FROM pg_sequences
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, sequencename;

\echo '=== 06 SEQUENCE OWNERSHIP / SERIAL-IDENTITY MAPPING ==='
SELECT ns.nspname AS table_schema,
       tbl.relname AS table_name,
       a.attname AS column_name,
       seq_ns.nspname AS sequence_schema,
       seq.relname AS sequence_name,
       a.attidentity AS identity_kind
FROM pg_class seq
JOIN pg_namespace seq_ns ON seq_ns.oid = seq.relnamespace
JOIN pg_depend d ON d.objid = seq.oid AND d.deptype IN ('a','i')
JOIN pg_class tbl ON tbl.oid = d.refobjid
JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = d.refobjsubid
WHERE seq.relkind = 'S'
  AND ns.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY ns.nspname, tbl.relname, a.attname;

\echo '=== 07 TIMESTAMP COLUMN INVENTORY ==='
SELECT table_schema,
       table_name,
       column_name,
       data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
  AND data_type IN ('timestamp without time zone','timestamp with time zone')
ORDER BY table_schema, table_name, ordinal_position;

\echo '=== 08 EXACT MIN/MAX FOR ALL TIMESTAMP COLUMNS ==='
WITH commands AS (
  SELECT string_agg(
    format(
      'SELECT %L::text AS schemaname, %L::text AS tablename, %L::text AS column_name, min(%I)::text AS min_value, max(%I)::text AS max_value, count(%I)::bigint AS non_null_rows FROM %I.%I',
      table_schema, table_name, column_name,
      column_name, column_name, column_name,
      table_schema, table_name
    ),
    E'\nUNION ALL\n'
    ORDER BY table_schema, table_name, ordinal_position
  ) AS sql
  FROM information_schema.columns
  WHERE table_schema NOT IN ('pg_catalog','information_schema')
    AND data_type IN ('timestamp without time zone','timestamp with time zone')
)
SELECT CASE
         WHEN sql IS NULL THEN 'SELECT NULL::text AS schemaname, NULL::text AS tablename, NULL::text AS column_name, NULL::text AS min_value, NULL::text AS max_value, 0::bigint AS non_null_rows WHERE false;'
         ELSE sql || E'\nORDER BY schemaname, tablename, column_name;'
       END
FROM commands \gexec

\echo '=== 09 PRIMARY / UNIQUE / FOREIGN KEY COUNTS PER TABLE ==='
SELECT n.nspname AS schemaname,
       c.relname AS tablename,
       count(*) FILTER (WHERE con.contype = 'p') AS primary_key_constraints,
       count(*) FILTER (WHERE con.contype = 'u') AS unique_constraints,
       count(*) FILTER (WHERE con.contype = 'f') AS foreign_key_constraints,
       count(*) FILTER (WHERE con.contype = 'c') AS check_constraints
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_constraint con ON con.conrelid = c.oid
WHERE c.relkind IN ('r','p')
  AND n.nspname NOT IN ('pg_catalog','information_schema')
GROUP BY n.nspname, c.relname
ORDER BY n.nspname, c.relname;

\echo '=== 10 INDEX COUNT PER TABLE ==='
SELECT schemaname,
       tablename,
       count(*)::bigint AS index_count
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog','information_schema')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;

\echo '=== 11 CURRENT PG STATS SNAPSHOT — SUPPORTING ONLY, NOT EXACT COUNTS ==='
SELECT schemaname,
       relname,
       n_live_tup,
       n_dead_tup,
       seq_scan,
       idx_scan,
       n_tup_ins,
       n_tup_upd,
       n_tup_del,
       last_autovacuum,
       last_autoanalyze
FROM pg_stat_user_tables
ORDER BY schemaname, relname;

\echo '=== END DATA PROFILE ==='

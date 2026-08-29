-- ETAP 3 — Gate 14: Security / Credentials / DB Permissions
-- Data przygotowania: 29.08.2026
-- Tryb: READ ONLY / aggregate-only
--
-- Collector nie wypisuje connection stringów, haseł, secretów, tokenów,
-- hashy ani wartości kluczy. Zwraca wyłącznie metadane/booleany/liczby.

BEGIN TRANSACTION READ ONLY;

-- A. Read-only proof + connection security.
SELECT 'A_CONNECTION' AS section, metric, value
FROM (
  SELECT 'transaction_read_only' AS metric,
         (current_setting('transaction_read_only')='on')::int::bigint AS value
  UNION ALL SELECT 'server_ssl_enabled', (current_setting('ssl')='on')::int::bigint
  UNION ALL SELECT 'current_connection_ssl', COALESCE((SELECT ssl::int::bigint FROM pg_stat_ssl WHERE pid=pg_backend_pid()),0)
  UNION ALL SELECT 'password_encryption_scram_sha_256', (current_setting('password_encryption')='scram-sha-256')::int::bigint
  UNION ALL SELECT 'row_security_on', (current_setting('row_security')='on')::int::bigint
) q ORDER BY metric;

-- B. Current DB role dangerous attributes.
SELECT 'B_ROLE_ATTRIBUTES' AS section, metric, value
FROM (
  SELECT 'rolsuper' AS metric, rolsuper::int::bigint AS value FROM pg_roles WHERE rolname=current_user
  UNION ALL SELECT 'rolcreatedb', rolcreatedb::int::bigint FROM pg_roles WHERE rolname=current_user
  UNION ALL SELECT 'rolcreaterole', rolcreaterole::int::bigint FROM pg_roles WHERE rolname=current_user
  UNION ALL SELECT 'rolreplication', rolreplication::int::bigint FROM pg_roles WHERE rolname=current_user
  UNION ALL SELECT 'rolbypassrls', rolbypassrls::int::bigint FROM pg_roles WHERE rolname=current_user
  UNION ALL SELECT 'rolcanlogin', rolcanlogin::int::bigint FROM pg_roles WHERE rolname=current_user
  UNION ALL SELECT 'direct_role_memberships', COUNT(*)::bigint
    FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user
) q ORDER BY metric;

-- C. Database/schema privileges of the runtime role.
SELECT 'C_DATABASE_SCHEMA_PRIVILEGES' AS section, metric, value
FROM (
  SELECT 'database_connect' AS metric, has_database_privilege(current_user,current_database(),'CONNECT')::int::bigint AS value
  UNION ALL SELECT 'database_create', has_database_privilege(current_user,current_database(),'CREATE')::int::bigint
  UNION ALL SELECT 'database_temp', has_database_privilege(current_user,current_database(),'TEMP')::int::bigint
  UNION ALL SELECT 'database_owner_current', (d.datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user))::int::bigint FROM pg_database d WHERE d.datname=current_database()
  UNION ALL SELECT 'public_schema_usage', has_schema_privilege(current_user,'public','USAGE')::int::bigint
  UNION ALL SELECT 'public_schema_create', has_schema_privilege(current_user,'public','CREATE')::int::bigint
) q ORDER BY metric;

-- D. Scope of table privileges in public schema.
WITH tables AS (
  SELECT c.oid,c.relowner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
)
SELECT 'D_TABLE_PRIVILEGES' AS section, metric, value
FROM (
  SELECT 'public_tables_total' AS metric, COUNT(*)::bigint AS value FROM tables
  UNION ALL SELECT 'tables_owned_by_current', COUNT(*)::bigint FROM tables WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
  UNION ALL SELECT 'tables_select', COUNT(*)::bigint FROM tables WHERE has_table_privilege(current_user,oid,'SELECT')
  UNION ALL SELECT 'tables_insert', COUNT(*)::bigint FROM tables WHERE has_table_privilege(current_user,oid,'INSERT')
  UNION ALL SELECT 'tables_update', COUNT(*)::bigint FROM tables WHERE has_table_privilege(current_user,oid,'UPDATE')
  UNION ALL SELECT 'tables_delete', COUNT(*)::bigint FROM tables WHERE has_table_privilege(current_user,oid,'DELETE')
  UNION ALL SELECT 'tables_truncate', COUNT(*)::bigint FROM tables WHERE has_table_privilege(current_user,oid,'TRUNCATE')
  UNION ALL SELECT 'tables_references', COUNT(*)::bigint FROM tables WHERE has_table_privilege(current_user,oid,'REFERENCES')
  UNION ALL SELECT 'tables_trigger', COUNT(*)::bigint FROM tables WHERE has_table_privilege(current_user,oid,'TRIGGER')
) q ORDER BY metric;

-- E. Sequence privileges.
WITH seq AS (
  SELECT c.oid,c.relowner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='S'
)
SELECT 'E_SEQUENCE_PRIVILEGES' AS section, metric, value
FROM (
  SELECT 'public_sequences_total' AS metric, COUNT(*)::bigint AS value FROM seq
  UNION ALL SELECT 'sequences_owned_by_current', COUNT(*)::bigint FROM seq WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
  UNION ALL SELECT 'sequences_usage', COUNT(*)::bigint FROM seq WHERE has_sequence_privilege(current_user,oid,'USAGE')
  UNION ALL SELECT 'sequences_select', COUNT(*)::bigint FROM seq WHERE has_sequence_privilege(current_user,oid,'SELECT')
  UNION ALL SELECT 'sequences_update', COUNT(*)::bigint FROM seq WHERE has_sequence_privilege(current_user,oid,'UPDATE')
) q ORDER BY metric;

-- F. PUBLIC grants — especially write/DDL surface.
WITH public_schema_acl AS (
  SELECT a.privilege_type
  FROM pg_namespace n
  CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a
  WHERE n.nspname='public' AND a.grantee=0
), public_table_acl AS (
  SELECT c.oid,a.privilege_type
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.grantee=0
)
SELECT 'F_PUBLIC_GRANTS' AS section, metric, value
FROM (
  SELECT 'public_schema_create_grants' AS metric, COUNT(*)::bigint AS value FROM public_schema_acl WHERE privilege_type='CREATE'
  UNION ALL SELECT 'public_table_select_grants', COUNT(DISTINCT oid)::bigint FROM public_table_acl WHERE privilege_type='SELECT'
  UNION ALL SELECT 'public_table_write_grants', COUNT(DISTINCT oid)::bigint FROM public_table_acl WHERE privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES')
) q ORDER BY metric;

-- G. RLS inventory.
SELECT 'G_RLS' AS section, metric, value
FROM (
  SELECT 'rls_enabled_tables' AS metric, COUNT(*)::bigint AS value
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
  UNION ALL
  SELECT 'rls_forced_tables', COUNT(*)::bigint
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relforcerowsecurity
) q ORDER BY metric;

-- H. Default ACL surface owned by current role.
SELECT 'H_DEFAULT_ACL' AS section, metric, value
FROM (
  SELECT 'default_acl_rows_current_owner' AS metric, COUNT(*)::bigint AS value
  FROM pg_default_acl d
  JOIN pg_roles r ON r.oid=d.defaclrole
  WHERE r.rolname=current_user
  UNION ALL
  SELECT 'default_acl_public_write_entries', COUNT(*)::bigint
  FROM pg_default_acl d
  JOIN pg_roles r ON r.oid=d.defaclrole
  CROSS JOIN LATERAL aclexplode(d.defaclacl) a
  WHERE r.rolname=current_user AND a.grantee=0
    AND a.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','CREATE')
) q ORDER BY metric;

ROLLBACK;

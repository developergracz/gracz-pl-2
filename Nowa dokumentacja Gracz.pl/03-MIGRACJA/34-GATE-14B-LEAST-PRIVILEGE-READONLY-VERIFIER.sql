-- ETAP 3 / Gate 14B
-- READ-ONLY LEAST-PRIVILEGE VERIFIER
-- Intended future execution: authenticated as gracz_runtime_v3 AFTER authorized role/ACL cutover.
-- This script performs SELECT-only evidence collection inside a READ ONLY transaction.

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

-- 1. Identity / role attributes
SELECT
  current_database() AS database_name,
  current_user AS runtime_role,
  r.rolsuper,
  r.rolcreatedb,
  r.rolcreaterole,
  r.rolreplication,
  r.rolbypassrls,
  r.rolcanlogin,
  pg_get_userbyid(d.datdba) = current_user AS runtime_is_database_owner,
  pg_has_role(current_user, 'gracz_migrator_v3', 'MEMBER') AS runtime_member_of_migrator
FROM pg_roles r
JOIN pg_database d ON d.datname = current_database()
WHERE r.rolname = current_user;

-- Expected target:
-- rolsuper=false, rolcreatedb=false, rolcreaterole=false,
-- rolreplication=false, rolbypassrls=false, rolcanlogin=true,
-- runtime_is_database_owner=false, runtime_member_of_migrator=false.

-- 2. Database / schema effective privileges
SELECT
  has_database_privilege(current_user, current_database(), 'CONNECT') AS db_connect,
  has_database_privilege(current_user, current_database(), 'CREATE') AS db_create,
  has_database_privilege(current_user, current_database(), 'TEMP') AS db_temp,
  has_schema_privilege(current_user, 'public', 'USAGE') AS public_usage,
  has_schema_privilege(current_user, 'public', 'CREATE') AS public_create;

-- Required: CONNECT=true, CREATE=false, USAGE=true, public CREATE=false.
-- db_temp is reported explicitly; final production hardening should prefer false
-- if Render/provider compatibility confirms TEMP is not required.

-- 3. Runtime object ownership must be zero
SELECT
  COUNT(*) FILTER (WHERE c.relkind IN ('r','p'))::int AS runtime_owned_tables,
  COUNT(*) FILTER (WHERE c.relkind = 'S')::int AS runtime_owned_sequences
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user);

-- Required: 0 / 0.

-- 4. Migration ledger visibility
SELECT
  COUNT(*)::int AS applied_migrations,
  MIN(version)::int AS min_version,
  MAX(version)::int AS max_version
FROM public.gracz_schema_migrations;

-- Gate 14A target before later migrations: 14 rows, versions 1..14.

-- 5. Exact runtime table privilege matrix
WITH expected(table_name, sel, ins, upd, del) AS (
  VALUES
    ('gracz_schema_migrations',         true,  false, false, false),
    ('gracz_accounts',                  true,  true,  true,  true ),
    ('gracz_messages',                  true,  true,  true,  true ),
    ('gracz_game_sessions',             true,  true,  true,  false),
    ('gracz_registration_codes',        true,  true,  true,  true ),
    ('gracz_password_reset_tokens',     true,  true,  true,  true ),
    ('gracz_auth_sessions',             true,  true,  true,  true ),
    ('gracz_message_attachments',       true,  true,  false, false),
    ('gracz_roles',                     true,  true,  true,  false),
    ('gracz_role_history',              false, true,  false, false),
    ('gracz_mfa',                       true,  true,  true,  false),
    ('gracz_audit_log',                 false, true,  false, false),
    ('gracz_moderation_decisions',      true,  true,  false, false),
    ('gracz_moderation_appeals',        false, true,  false, false),
    ('gracz_chat_topics',               true,  true,  false, false),
    ('gracz_global_chat',               true,  true,  true,  false),
    ('gracz_chat_friends',              true,  true,  true,  true ),
    ('gracz_global_chat_reports',       false, true,  false, false),
    ('gracz_tournaments',               true,  true,  true,  false),
    ('gracz_tournament_players',        true,  true,  true,  true ),
    ('gracz_tournament_matches',        true,  true,  true,  false),
    ('gracz_newsletter_subscribers',    true,  true,  true,  false),
    ('newsletter_sources',              true,  true,  false, false),
    ('newsletter_subscriber_sources',   true,  true,  false, false),
    ('newsletter_consent_history',      true,  true,  false, false),
    ('newsletter_events',               true,  true,  false, false),
    ('gracz_thousand_games',            true,  true,  true,  false)
), actual AS (
  SELECT
    e.*,
    has_table_privilege(current_user, format('public.%I', e.table_name), 'SELECT') AS actual_sel,
    has_table_privilege(current_user, format('public.%I', e.table_name), 'INSERT') AS actual_ins,
    has_table_privilege(current_user, format('public.%I', e.table_name), 'UPDATE') AS actual_upd,
    has_table_privilege(current_user, format('public.%I', e.table_name), 'DELETE') AS actual_del,
    has_table_privilege(current_user, format('public.%I', e.table_name), 'TRUNCATE') AS actual_truncate,
    has_table_privilege(current_user, format('public.%I', e.table_name), 'REFERENCES') AS actual_references,
    has_table_privilege(current_user, format('public.%I', e.table_name), 'TRIGGER') AS actual_trigger
  FROM expected e
)
SELECT
  table_name,
  sel AS expected_select, actual_sel,
  ins AS expected_insert, actual_ins,
  upd AS expected_update, actual_upd,
  del AS expected_delete, actual_del,
  actual_truncate,
  actual_references,
  actual_trigger,
  (
    sel = actual_sel AND
    ins = actual_ins AND
    upd = actual_upd AND
    del = actual_del AND
    actual_truncate = false AND
    actual_references = false AND
    actual_trigger = false
  ) AS acl_match
FROM actual
ORDER BY table_name;

-- 6. Any privilege on unknown/legacy tables is a fail-closed review item.
WITH expected(table_name) AS (
  VALUES
    ('gracz_schema_migrations'),
    ('gracz_accounts'),
    ('gracz_messages'),
    ('gracz_game_sessions'),
    ('gracz_registration_codes'),
    ('gracz_password_reset_tokens'),
    ('gracz_auth_sessions'),
    ('gracz_message_attachments'),
    ('gracz_roles'),
    ('gracz_role_history'),
    ('gracz_mfa'),
    ('gracz_audit_log'),
    ('gracz_moderation_decisions'),
    ('gracz_moderation_appeals'),
    ('gracz_chat_topics'),
    ('gracz_global_chat'),
    ('gracz_chat_friends'),
    ('gracz_global_chat_reports'),
    ('gracz_tournaments'),
    ('gracz_tournament_players'),
    ('gracz_tournament_matches'),
    ('gracz_newsletter_subscribers'),
    ('newsletter_sources'),
    ('newsletter_subscriber_sources'),
    ('newsletter_consent_history'),
    ('newsletter_events'),
    ('gracz_thousand_games')
)
SELECT
  c.relname AS unexpected_table,
  has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
  has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
  has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
  has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
  has_table_privilege(current_user, c.oid, 'TRUNCATE') AS can_truncate,
  has_table_privilege(current_user, c.oid, 'REFERENCES') AS can_references,
  has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_trigger
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN expected e ON e.table_name = c.relname
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
  AND e.table_name IS NULL
ORDER BY c.relname;

-- Expected for current two legacy tables: every privilege boolean false.

-- 7. Expected sequence ACL — USAGE only
WITH expected(sequence_name) AS (
  VALUES
    ('gracz_role_history_change_id_seq'),
    ('gracz_newsletter_subscribers_id_seq'),
    ('newsletter_sources_id_seq'),
    ('newsletter_subscriber_sources_id_seq'),
    ('newsletter_consent_history_id_seq'),
    ('newsletter_events_id_seq')
)
SELECT
  e.sequence_name,
  has_sequence_privilege(current_user, format('public.%I', e.sequence_name), 'USAGE') AS usage_ok,
  has_sequence_privilege(current_user, format('public.%I', e.sequence_name), 'SELECT') AS has_select,
  has_sequence_privilege(current_user, format('public.%I', e.sequence_name), 'UPDATE') AS has_update
FROM expected e
ORDER BY e.sequence_name;

-- Required: usage_ok=true, has_select=false, has_update=false.

-- 8. Unknown/legacy sequences must not be granted automatically
WITH expected(sequence_name) AS (
  VALUES
    ('gracz_role_history_change_id_seq'),
    ('gracz_newsletter_subscribers_id_seq'),
    ('newsletter_sources_id_seq'),
    ('newsletter_subscriber_sources_id_seq'),
    ('newsletter_consent_history_id_seq'),
    ('newsletter_events_id_seq')
)
SELECT
  c.relname AS unexpected_sequence,
  has_sequence_privilege(current_user, c.oid, 'USAGE') AS can_usage,
  has_sequence_privilege(current_user, c.oid, 'SELECT') AS can_select,
  has_sequence_privilege(current_user, c.oid, 'UPDATE') AS can_update
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN expected e ON e.sequence_name = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'S'
  AND e.sequence_name IS NULL
ORDER BY c.relname;

-- Expected for current two legacy sequences: all privilege booleans false.

-- 9. PUBLIC table write/read grants remain absent
SELECT
  COUNT(*) FILTER (WHERE privilege_type = 'SELECT')::int AS public_select_grants,
  COUNT(*) FILTER (WHERE privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'))::int AS public_write_or_sensitive_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'PUBLIC';

COMMIT;

-- Gate 14B verifier interpretation:
-- PASS-CANDIDATE only if role/admin attributes are false as designed,
-- database/schema CREATE is false,
-- ownership is 0/0,
-- exact ACL rows all show acl_match=true,
-- unexpected legacy table/sequence privileges are all false,
-- sequence ACL is USAGE-only,
-- PUBLIC grants are 0,
-- and the runtime starts/tests successfully with the same role.

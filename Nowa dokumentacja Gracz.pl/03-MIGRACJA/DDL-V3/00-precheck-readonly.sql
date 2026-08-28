-- ETAP 3 / PostgreSQL V3
-- REVIEW ONLY / DO NOT RUN ON PRODUCTION BEFORE PREFLIGHT GO
-- 00-precheck-readonly.sql
-- Purpose: read-only environment/schema/data precheck immediately before any V3 DDL.

BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- 1. Runtime identity / server
SELECT
    current_database() AS database_name,
    current_user AS db_user,
    current_setting('transaction_read_only') AS transaction_read_only,
    current_setting('server_version') AS server_version,
    current_setting('TimeZone') AS timezone,
    current_setting('server_encoding') AS server_encoding;

-- 2. Extensions: evidence only. No extension is created by this script.
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

-- 3. Public table inventory. Expected AS-IS baseline: 28 tables.
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT COUNT(*)::int AS public_table_count
FROM pg_tables
WHERE schemaname = 'public';

-- 4. Detect pre-existing V3 namespace/objects.
SELECT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'v3'
) AS v3_schema_exists;

SELECT COUNT(*)::int AS v3_table_count
FROM pg_tables
WHERE schemaname = 'v3';

-- 5. Lightweight schema fingerprint for public columns.
SELECT md5(COALESCE(string_agg(
    table_schema || '.' || table_name || ':' || ordinal_position || ':' || column_name || ':' ||
    data_type || ':' || is_nullable || ':' || COALESCE(column_default, ''),
    E'\n' ORDER BY table_schema, table_name, ordinal_position
), '')) AS public_columns_fingerprint
FROM information_schema.columns
WHERE table_schema = 'public';

-- 6. Exact row counts for the 28 known production tables.
SELECT 'gracz_accounts' AS table_name, COUNT(*)::bigint AS row_count FROM public.gracz_accounts
UNION ALL SELECT 'gracz_audit_log', COUNT(*) FROM public.gracz_audit_log
UNION ALL SELECT 'gracz_audit_log_legacy_1787562123031', COUNT(*) FROM public.gracz_audit_log_legacy_1787562123031
UNION ALL SELECT 'gracz_auth_sessions', COUNT(*) FROM public.gracz_auth_sessions
UNION ALL SELECT 'gracz_chat_friends', COUNT(*) FROM public.gracz_chat_friends
UNION ALL SELECT 'gracz_chat_topics', COUNT(*) FROM public.gracz_chat_topics
UNION ALL SELECT 'gracz_game_sessions', COUNT(*) FROM public.gracz_game_sessions
UNION ALL SELECT 'gracz_global_chat', COUNT(*) FROM public.gracz_global_chat
UNION ALL SELECT 'gracz_global_chat_reports', COUNT(*) FROM public.gracz_global_chat_reports
UNION ALL SELECT 'gracz_message_attachments', COUNT(*) FROM public.gracz_message_attachments
UNION ALL SELECT 'gracz_messages', COUNT(*) FROM public.gracz_messages
UNION ALL SELECT 'gracz_mfa', COUNT(*) FROM public.gracz_mfa
UNION ALL SELECT 'gracz_moderation_appeals', COUNT(*) FROM public.gracz_moderation_appeals
UNION ALL SELECT 'gracz_moderation_decisions', COUNT(*) FROM public.gracz_moderation_decisions
UNION ALL SELECT 'gracz_newsletter_subscribers', COUNT(*) FROM public.gracz_newsletter_subscribers
UNION ALL SELECT 'gracz_password_reset_tokens', COUNT(*) FROM public.gracz_password_reset_tokens
UNION ALL SELECT 'gracz_registration_codes', COUNT(*) FROM public.gracz_registration_codes
UNION ALL SELECT 'gracz_role_changes', COUNT(*) FROM public.gracz_role_changes
UNION ALL SELECT 'gracz_role_history', COUNT(*) FROM public.gracz_role_history
UNION ALL SELECT 'gracz_roles', COUNT(*) FROM public.gracz_roles
UNION ALL SELECT 'gracz_thousand_games', COUNT(*) FROM public.gracz_thousand_games
UNION ALL SELECT 'gracz_tournament_matches', COUNT(*) FROM public.gracz_tournament_matches
UNION ALL SELECT 'gracz_tournament_players', COUNT(*) FROM public.gracz_tournament_players
UNION ALL SELECT 'gracz_tournaments', COUNT(*) FROM public.gracz_tournaments
UNION ALL SELECT 'newsletter_consent_history', COUNT(*) FROM public.newsletter_consent_history
UNION ALL SELECT 'newsletter_events', COUNT(*) FROM public.newsletter_events
UNION ALL SELECT 'newsletter_sources', COUNT(*) FROM public.newsletter_sources
UNION ALL SELECT 'newsletter_subscriber_sources', COUNT(*) FROM public.newsletter_subscriber_sources
ORDER BY table_name;

-- 7. Current activity. Results may be permission-limited on managed PostgreSQL.
SELECT
    pid,
    usename,
    application_name,
    state,
    wait_event_type,
    wait_event,
    xact_start,
    query_start
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
ORDER BY xact_start NULLS LAST, query_start NULLS LAST;

-- 8. Granted locks by mode/object. No blocking action is taken.
SELECT
    l.locktype,
    l.mode,
    l.granted,
    c.oid::regclass::text AS relation_name,
    COUNT(*)::int AS lock_count
FROM pg_locks l
LEFT JOIN pg_class c ON c.oid = l.relation
WHERE l.database = (SELECT oid FROM pg_database WHERE datname = current_database())
GROUP BY l.locktype, l.mode, l.granted, c.oid
ORDER BY relation_name NULLS LAST, l.locktype, l.mode, l.granted;

-- 9. Crypto-critical row counts only; no plaintext/ciphertext output.
SELECT
    (SELECT COUNT(*) FROM public.gracz_messages)::bigint AS messages_total,
    (SELECT COUNT(*) FROM public.gracz_message_attachments)::bigint AS attachments_total,
    (SELECT COUNT(*) FROM public.gracz_mfa)::bigint AS mfa_total;

-- 10. Active-state evidence used by cutover review.
SELECT
    (SELECT COUNT(*) FROM public.gracz_auth_sessions WHERE revoked_at IS NULL AND expires_at > NOW())::bigint AS active_auth_sessions,
    (SELECT COUNT(*) FROM public.gracz_game_sessions)::bigint AS checkers_session_rows,
    (SELECT COUNT(*) FROM public.gracz_thousand_games)::bigint AS thousand_game_rows,
    (SELECT COUNT(*) FROM public.gracz_tournaments)::bigint AS tournament_rows;

ROLLBACK;

-- Expected operator interpretation:
-- * transaction_read_only = on
-- * public table count and schema fingerprint are compared with the approved fresh baseline
-- * unexpected v3 objects => STOP and investigate
-- * unexpected writers/locks => STOP and investigate
-- * this script performs no CREATE/ALTER/INSERT/UPDATE/DELETE/DROP

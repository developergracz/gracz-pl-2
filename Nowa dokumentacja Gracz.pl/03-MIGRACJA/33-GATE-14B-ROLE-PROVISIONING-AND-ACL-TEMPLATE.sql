-- ETAP 3 / Gate 14B
-- LEAST-PRIVILEGE ROLE PROVISIONING + ACL TEMPLATE
-- STATUS: DESIGN ONLY / DO NOT RUN WITHOUT EXPLICIT CUTOVER AUTHORIZATION
--
-- IMPORTANT:
-- 1. This file contains DCL/ownership changes and MUST NOT be executed during audit/design.
-- 2. Password values are intentionally absent. Inject credentials out-of-band.
-- 3. Before activation, remove the four redundant SELECT LIMIT 0 probes documented in Gate 14B.
-- 4. Current production remains NO-GO.

-- ============================================================================
-- A. ROLE SHAPE — target only
-- ============================================================================

-- Execute role creation from the controlled provider/admin principal.
-- Credential creation/rotation session MUST first use:
--   SET password_encryption = 'scram-sha-256';
-- Passwords must be supplied by a secret manager / secure operator channel,
-- never committed to GitHub and never echoed into CI logs.

CREATE ROLE gracz_migrator_v3
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  INHERIT;

CREATE ROLE gracz_runtime_v3
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  INHERIT;

-- Password assignment intentionally omitted, example ONLY:
-- SET password_encryption = 'scram-sha-256';
-- ALTER ROLE gracz_migrator_v3 PASSWORD '<inject securely outside repo>';
-- ALTER ROLE gracz_runtime_v3  PASSWORD '<inject securely outside repo>';

ALTER ROLE gracz_migrator_v3 SET search_path = pg_catalog, public;
ALTER ROLE gracz_runtime_v3  SET search_path = pg_catalog, public;

-- ============================================================================
-- B. DATABASE / SCHEMA
-- ============================================================================

GRANT CONNECT ON DATABASE gracz_pl_database TO gracz_migrator_v3;
GRANT CONNECT ON DATABASE gracz_pl_database TO gracz_runtime_v3;

-- Neither application role owns the database.
REVOKE CREATE ON DATABASE gracz_pl_database FROM gracz_migrator_v3;
REVOKE CREATE ON DATABASE gracz_pl_database FROM gracz_runtime_v3;

-- public schema remains the application schema for V3.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO gracz_migrator_v3;
GRANT USAGE ON SCHEMA public TO gracz_runtime_v3;
REVOKE CREATE ON SCHEMA public FROM gracz_runtime_v3;

-- Optional stronger hardening for the final production cutover, only after
-- provider compatibility review. PostgreSQL commonly grants TEMP to PUBLIC.
-- REVOKE TEMPORARY ON DATABASE gracz_pl_database FROM PUBLIC;

-- ============================================================================
-- C. DETERMINISTIC RESET OF RUNTIME ACL
-- ============================================================================

-- New runtime role should start from zero object privileges.
REVOKE ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public FROM gracz_runtime_v3;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM gracz_runtime_v3;

-- Preserve Gate 14 PUBLIC contract.
REVOKE ALL PRIVILEGES ON ALL TABLES     IN SCHEMA public FROM PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES  IN SCHEMA public FROM PUBLIC;

-- Future objects created by migrator must not silently become PUBLIC-readable
-- or PUBLIC-writable. Runtime grants remain explicit per object.
ALTER DEFAULT PRIVILEGES FOR ROLE gracz_migrator_v3 IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE gracz_migrator_v3 IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE gracz_migrator_v3 IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================================
-- D. OWNERSHIP TRANSFER — V3 OBJECTS ONLY
-- ============================================================================
-- Execute as current object owner/provider admin BEFORE the dedicated migrator
-- is expected to ALTER existing objects. Unknown legacy objects are deliberately
-- omitted and remain inaccessible to runtime.

ALTER TABLE public.gracz_accounts                OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_messages                OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_game_sessions           OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_registration_codes      OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_password_reset_tokens   OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_auth_sessions           OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_message_attachments     OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_roles                   OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_role_history            OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_mfa                     OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_audit_log               OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_moderation_decisions    OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_moderation_appeals      OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_chat_topics             OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_global_chat             OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_chat_friends            OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_global_chat_reports     OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_tournaments             OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_tournament_players      OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_tournament_matches      OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_newsletter_subscribers  OWNER TO gracz_migrator_v3;
ALTER TABLE public.newsletter_sources            OWNER TO gracz_migrator_v3;
ALTER TABLE public.newsletter_subscriber_sources OWNER TO gracz_migrator_v3;
ALTER TABLE public.newsletter_consent_history    OWNER TO gracz_migrator_v3;
ALTER TABLE public.newsletter_events             OWNER TO gracz_migrator_v3;
ALTER TABLE public.gracz_thousand_games          OWNER TO gracz_migrator_v3;

-- Existing serial sequences expected from migrations 007/012/013.
ALTER SEQUENCE public.gracz_role_history_change_id_seq            OWNER TO gracz_migrator_v3;
ALTER SEQUENCE public.gracz_newsletter_subscribers_id_seq         OWNER TO gracz_migrator_v3;
ALTER SEQUENCE public.newsletter_sources_id_seq                   OWNER TO gracz_migrator_v3;
ALTER SEQUENCE public.newsletter_subscriber_sources_id_seq        OWNER TO gracz_migrator_v3;
ALTER SEQUENCE public.newsletter_consent_history_id_seq           OWNER TO gracz_migrator_v3;
ALTER SEQUENCE public.newsletter_events_id_seq                    OWNER TO gracz_migrator_v3;

-- Audit function must be owned by the migration principal before CREATE OR REPLACE.
ALTER FUNCTION public.gracz_audit_log_immutable() OWNER TO gracz_migrator_v3;

-- gracz_schema_migrations is created by migrate-v3 and therefore becomes
-- gracz_migrator_v3-owned when migrator is used to create it.

-- ============================================================================
-- E. STRICT RUNTIME TABLE ACL
-- ============================================================================

GRANT SELECT ON TABLE public.gracz_schema_migrations TO gracz_runtime_v3;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gracz_accounts              TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gracz_messages              TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.gracz_game_sessions         TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gracz_registration_codes    TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gracz_password_reset_tokens TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gracz_auth_sessions         TO gracz_runtime_v3;
GRANT SELECT, INSERT                 ON TABLE public.gracz_message_attachments   TO gracz_runtime_v3;

GRANT SELECT, INSERT, UPDATE ON TABLE public.gracz_roles TO gracz_runtime_v3;
GRANT INSERT                 ON TABLE public.gracz_role_history TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE ON TABLE public.gracz_mfa TO gracz_runtime_v3;

-- Strict append-only audit ACL: no SELECT/UPDATE/DELETE/TRUNCATE.
GRANT INSERT ON TABLE public.gracz_audit_log TO gracz_runtime_v3;

GRANT SELECT, INSERT ON TABLE public.gracz_moderation_decisions TO gracz_runtime_v3;
GRANT INSERT         ON TABLE public.gracz_moderation_appeals   TO gracz_runtime_v3;

GRANT SELECT, INSERT         ON TABLE public.gracz_chat_topics         TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE ON TABLE public.gracz_global_chat         TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gracz_chat_friends TO gracz_runtime_v3;
GRANT INSERT                 ON TABLE public.gracz_global_chat_reports TO gracz_runtime_v3;

GRANT SELECT, INSERT, UPDATE ON TABLE public.gracz_tournaments        TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gracz_tournament_players TO gracz_runtime_v3;
GRANT SELECT, INSERT, UPDATE ON TABLE public.gracz_tournament_matches TO gracz_runtime_v3;

GRANT SELECT, INSERT, UPDATE ON TABLE public.gracz_newsletter_subscribers TO gracz_runtime_v3;
GRANT SELECT, INSERT         ON TABLE public.newsletter_sources            TO gracz_runtime_v3;
GRANT SELECT, INSERT         ON TABLE public.newsletter_subscriber_sources TO gracz_runtime_v3;
GRANT SELECT, INSERT         ON TABLE public.newsletter_consent_history    TO gracz_runtime_v3;
GRANT SELECT, INSERT         ON TABLE public.newsletter_events             TO gracz_runtime_v3;

GRANT SELECT, INSERT, UPDATE ON TABLE public.gracz_thousand_games TO gracz_runtime_v3;

-- ============================================================================
-- F. STRICT RUNTIME SEQUENCE ACL
-- ============================================================================
-- nextval() requires USAGE. Runtime does not need currval()/setval() authority.

GRANT USAGE ON SEQUENCE public.gracz_role_history_change_id_seq            TO gracz_runtime_v3;
GRANT USAGE ON SEQUENCE public.gracz_newsletter_subscribers_id_seq         TO gracz_runtime_v3;
GRANT USAGE ON SEQUENCE public.newsletter_sources_id_seq                   TO gracz_runtime_v3;
GRANT USAGE ON SEQUENCE public.newsletter_subscriber_sources_id_seq        TO gracz_runtime_v3;
GRANT USAGE ON SEQUENCE public.newsletter_consent_history_id_seq           TO gracz_runtime_v3;
GRANT USAGE ON SEQUENCE public.newsletter_events_id_seq                    TO gracz_runtime_v3;

-- ============================================================================
-- G. EXPLICIT DENY SURFACE
-- ============================================================================

-- Runtime must not receive these privileges on any application table.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM gracz_runtime_v3;

-- Runtime cannot create/alter/drop objects because it is not owner and lacks
-- schema CREATE. No role membership in migrator/admin roles is permitted.

-- ============================================================================
-- H. HARD ACTIVATION BLOCKER
-- ============================================================================
-- DO NOT switch DATABASE_URL to gracz_runtime_v3 until code no longer performs
-- schema-probe SELECTs against the four target write-only tables:
--   public.gracz_audit_log
--   public.gracz_role_history
--   public.gracz_moderation_appeals
--   public.gracz_global_chat_reports
--
-- Gate 14B strict ACL intentionally does not grant SELECT on those tables.
-- A startup failure before that code prerequisite is expected fail-closed behavior.

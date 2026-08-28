-- ETAP 3 / PostgreSQL V3
-- REVIEW ONLY / DO NOT RUN ON PRODUCTION BEFORE PREFLIGHT GO
-- 02-identity-audit-v3.sql
-- Purpose: create Identity & Access, Role, Audit and Security Events structures
--          inside the isolated v3 namespace.
--
-- Preconditions:
--   1) 00-precheck-readonly.sql reviewed for the same migration window.
--   2) 01-v3-foundation.sql approved and v3 schema exists.
--   3) backup/restore remains PASS.
--   4) DQ-002 handling remains explicit: legacy/test identities are not silently merged.
--   5) registration_codes product requirement must be explicitly confirmed before
--      this draft can become production-approved; remove that block if the feature
--      is formally retired.
--   6) production execution still requires final PREFLIGHT GO.
--
-- This script is EXPAND ONLY:
--   * no legacy table is altered or dropped,
--   * no backfill is performed,
--   * no plaintext credential/token/MFA material is introduced.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- Guardrails / expected foundation
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'v3') THEN
        RAISE EXCEPTION 'v3 schema missing: run approved 01-v3-foundation.sql first';
    END IF;

    IF to_regclass('v3.outbox_events') IS NULL
       OR to_regclass('v3.idempotency_keys') IS NULL
       OR to_regclass('v3.processed_messages') IS NULL THEN
        RAISE EXCEPTION 'V3 transactional foundation incomplete';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Identity base
-- ---------------------------------------------------------------------------
CREATE TABLE v3.users (
    user_id             VARCHAR(32) PRIMARY KEY,
    email               VARCHAR(254) NOT NULL,
    email_normalized    VARCHAR(254) NOT NULL,
    username            VARCHAR(64) NOT NULL,
    username_normalized VARCHAR(64) NOT NULL,
    password_hash       TEXT NOT NULL,
    status              VARCHAR(24) NOT NULL DEFAULT 'pending',
    email_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    version             BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT users_email_normalized_unique UNIQUE (email_normalized),
    CONSTRAINT users_username_normalized_unique UNIQUE (username_normalized),
    CONSTRAINT users_status_check
        CHECK (status IN ('pending','active','suspended','banned','deleted')),
    CONSTRAINT users_version_positive CHECK (version >= 1),
    CONSTRAINT users_email_nonempty CHECK (length(trim(email_normalized)) > 0),
    CONSTRAINT users_username_nonempty CHECK (length(trim(username_normalized)) > 0),
    CONSTRAINT users_deleted_consistency
        CHECK ((status = 'deleted' AND deleted_at IS NOT NULL) OR status <> 'deleted'),
    CONSTRAINT users_updated_after_created CHECK (updated_at >= created_at)
);

CREATE INDEX users_status_idx ON v3.users(status);
CREATE INDEX users_created_idx ON v3.users(created_at DESC);

CREATE TABLE v3.user_profiles (
    user_id          VARCHAR(32) PRIMARY KEY,
    display_name     VARCHAR(80),
    bio              TEXT,
    avatar_ref       TEXT,
    locale           VARCHAR(16),
    timezone         VARCHAR(64),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_profiles_user_fk
        FOREIGN KEY (user_id) REFERENCES v3.users(user_id) ON DELETE CASCADE,
    CONSTRAINT user_profiles_updated_after_created CHECK (updated_at >= created_at)
);

-- Foundation table can now reference canonical Identity.
ALTER TABLE v3.idempotency_keys
    ADD CONSTRAINT idempotency_keys_actor_user_fk
    FOREIGN KEY (actor_user_id) REFERENCES v3.users(user_id);

-- ---------------------------------------------------------------------------
-- Authentication sessions and lifecycle tokens
-- ---------------------------------------------------------------------------
CREATE TABLE v3.auth_sessions (
    session_id         UUID PRIMARY KEY,
    user_id            VARCHAR(32) NOT NULL,
    token_hash         BYTEA NOT NULL UNIQUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at       TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ NOT NULL,
    revoked_at         TIMESTAMPTZ,
    revoke_reason      VARCHAR(96),
    ip_hash            CHAR(64),
    user_agent_hash    CHAR(64),

    CONSTRAINT auth_sessions_user_fk
        FOREIGN KEY (user_id) REFERENCES v3.users(user_id) ON DELETE CASCADE,
    CONSTRAINT auth_sessions_expiry_check CHECK (expires_at > created_at),
    CONSTRAINT auth_sessions_last_seen_check
        CHECK (last_seen_at IS NULL OR last_seen_at >= created_at),
    CONSTRAINT auth_sessions_revoke_consistency
        CHECK (revoked_at IS NOT NULL OR revoke_reason IS NULL),
    CONSTRAINT auth_sessions_revoked_after_create
        CHECK (revoked_at IS NULL OR revoked_at >= created_at),
    CONSTRAINT auth_sessions_ip_hash_format
        CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT auth_sessions_user_agent_hash_format
        CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX auth_sessions_user_active_idx
    ON v3.auth_sessions(user_id, expires_at)
    WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_expiry_idx ON v3.auth_sessions(expires_at);

CREATE TABLE v3.password_reset_tokens (
    token_id          UUID PRIMARY KEY,
    user_id           VARCHAR(32) NOT NULL,
    token_hash        BYTEA NOT NULL UNIQUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ NOT NULL,
    consumed_at       TIMESTAMPTZ,
    requested_ip_hash CHAR(64),

    CONSTRAINT password_reset_user_fk
        FOREIGN KEY (user_id) REFERENCES v3.users(user_id) ON DELETE CASCADE,
    CONSTRAINT password_reset_expiry CHECK (expires_at > created_at),
    CONSTRAINT password_reset_consumed_after_create
        CHECK (consumed_at IS NULL OR consumed_at >= created_at),
    CONSTRAINT password_reset_ip_hash_format
        CHECK (requested_ip_hash IS NULL OR requested_ip_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX password_reset_active_idx
    ON v3.password_reset_tokens(user_id, expires_at)
    WHERE consumed_at IS NULL;

-- Conditional product feature. Must be explicitly confirmed before production GO.
CREATE TABLE v3.registration_codes (
    code_id                     UUID PRIMARY KEY,
    code_hash                   BYTEA NOT NULL UNIQUE,
    intended_email_normalized   VARCHAR(254),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at                  TIMESTAMPTZ NOT NULL,
    consumed_at                 TIMESTAMPTZ,
    consumed_by_user_id         VARCHAR(32),

    CONSTRAINT registration_codes_user_fk
        FOREIGN KEY (consumed_by_user_id) REFERENCES v3.users(user_id),
    CONSTRAINT registration_codes_expiry CHECK (expires_at > created_at),
    CONSTRAINT registration_codes_consumed_after_create
        CHECK (consumed_at IS NULL OR consumed_at >= created_at),
    CONSTRAINT registration_codes_consumption_consistency
        CHECK (
            (consumed_at IS NULL AND consumed_by_user_id IS NULL)
            OR
            (consumed_at IS NOT NULL AND consumed_by_user_id IS NOT NULL)
        )
);

CREATE INDEX registration_codes_active_idx
    ON v3.registration_codes(expires_at)
    WHERE consumed_at IS NULL;

-- ---------------------------------------------------------------------------
-- MFA credential lifecycle
-- ---------------------------------------------------------------------------
CREATE TABLE v3.mfa_credentials (
    mfa_id            UUID PRIMARY KEY,
    user_id           VARCHAR(32) NOT NULL,
    method            VARCHAR(24) NOT NULL,
    secret_ciphertext BYTEA,
    key_version       VARCHAR(32),
    enabled           BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disabled_at       TIMESTAMPTZ,

    CONSTRAINT mfa_credentials_user_fk
        FOREIGN KEY (user_id) REFERENCES v3.users(user_id) ON DELETE CASCADE,
    CONSTRAINT mfa_credentials_method_check
        CHECK (method IN ('totp','webauthn','recovery')),
    CONSTRAINT mfa_credentials_enabled_consistency
        CHECK (enabled = FALSE OR verified_at IS NOT NULL),
    CONSTRAINT mfa_credentials_verified_after_create
        CHECK (verified_at IS NULL OR verified_at >= created_at),
    CONSTRAINT mfa_credentials_disabled_after_create
        CHECK (disabled_at IS NULL OR disabled_at >= created_at),
    CONSTRAINT mfa_credentials_disabled_consistency
        CHECK (disabled_at IS NULL OR enabled = FALSE)
);

CREATE INDEX mfa_credentials_user_idx
    ON v3.mfa_credentials(user_id, enabled);

-- No CHECK here attempts to encode credential-format-specific plaintext semantics.
-- Key material is never stored in this table.

-- ---------------------------------------------------------------------------
-- Roles and current assignments
-- ---------------------------------------------------------------------------
CREATE TABLE v3.roles (
    role_id          UUID PRIMARY KEY,
    code             VARCHAR(64) NOT NULL UNIQUE,
    name             VARCHAR(96) NOT NULL,
    description      TEXT,
    system_role      BOOLEAN NOT NULL DEFAULT FALSE,
    active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT roles_code_nonempty CHECK (length(trim(code)) > 0),
    CONSTRAINT roles_name_nonempty CHECK (length(trim(name)) > 0),
    CONSTRAINT roles_updated_after_created CHECK (updated_at >= created_at)
);

CREATE TABLE v3.user_roles (
    user_id             VARCHAR(32) NOT NULL,
    role_id             UUID NOT NULL,
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by_user_id VARCHAR(32),
    assignment_reason   TEXT,

    PRIMARY KEY (user_id, role_id),
    CONSTRAINT user_roles_user_fk
        FOREIGN KEY (user_id) REFERENCES v3.users(user_id) ON DELETE CASCADE,
    CONSTRAINT user_roles_role_fk
        FOREIGN KEY (role_id) REFERENCES v3.roles(role_id),
    CONSTRAINT user_roles_actor_fk
        FOREIGN KEY (assigned_by_user_id) REFERENCES v3.users(user_id)
);

CREATE INDEX user_roles_role_idx ON v3.user_roles(role_id, user_id);

-- ---------------------------------------------------------------------------
-- Append-only role history / canonical MERGE target
-- ---------------------------------------------------------------------------
CREATE TABLE v3.role_change_events (
    event_id           UUID PRIMARY KEY,
    user_id            VARCHAR(32) NOT NULL,
    role_id            UUID,
    role_code_snapshot VARCHAR(64) NOT NULL,
    change_type        VARCHAR(16) NOT NULL,
    actor_user_id      VARCHAR(32),
    reason             TEXT,
    command_id         UUID,
    correlation_id     UUID,
    source_system      VARCHAR(64) NOT NULL DEFAULT 'gracz-v3',
    source_record_id   VARCHAR(128),
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT role_change_events_user_fk
        FOREIGN KEY (user_id) REFERENCES v3.users(user_id),
    CONSTRAINT role_change_events_role_fk
        FOREIGN KEY (role_id) REFERENCES v3.roles(role_id),
    CONSTRAINT role_change_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES v3.users(user_id),
    CONSTRAINT role_change_events_type_check
        CHECK (change_type IN ('assigned','revoked')),
    CONSTRAINT role_change_events_role_snapshot_nonempty
        CHECK (length(trim(role_code_snapshot)) > 0),
    CONSTRAINT role_change_events_source_nonempty
        CHECK (length(trim(source_system)) > 0),
    CONSTRAINT role_change_events_source_dedupe
        UNIQUE (source_system, source_record_id)
);

CREATE INDEX role_change_events_user_time_idx
    ON v3.role_change_events(user_id, occurred_at DESC);
CREATE INDEX role_change_events_actor_time_idx
    ON v3.role_change_events(actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;
CREATE INDEX role_change_events_command_idx
    ON v3.role_change_events(command_id)
    WHERE command_id IS NOT NULL;
CREATE INDEX role_change_events_correlation_idx
    ON v3.role_change_events(correlation_id)
    WHERE correlation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Canonical audit log
-- ---------------------------------------------------------------------------
CREATE TABLE v3.audit_log (
    audit_id           UUID PRIMARY KEY,
    actor_user_id      VARCHAR(32),
    actor_type         VARCHAR(24) NOT NULL DEFAULT 'user',
    action             VARCHAR(128) NOT NULL,
    target_type        VARCHAR(64),
    target_id          VARCHAR(128),
    result             VARCHAR(24) NOT NULL DEFAULT 'success',
    request_id         UUID,
    correlation_id     UUID,
    causation_id       UUID,
    source_service     VARCHAR(64) NOT NULL,
    payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_log_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES v3.users(user_id),
    CONSTRAINT audit_log_actor_type_check
        CHECK (actor_type IN ('user','system','service','anonymous')),
    CONSTRAINT audit_log_result_check
        CHECK (result IN ('success','denied','failed')),
    CONSTRAINT audit_log_action_nonempty CHECK (length(trim(action)) > 0),
    CONSTRAINT audit_log_source_service_nonempty
        CHECK (length(trim(source_service)) > 0)
);

CREATE INDEX audit_log_target_idx
    ON v3.audit_log(target_type, target_id, occurred_at DESC);
CREATE INDEX audit_log_actor_idx
    ON v3.audit_log(actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;
CREATE INDEX audit_log_correlation_idx
    ON v3.audit_log(correlation_id)
    WHERE correlation_id IS NOT NULL;
CREATE INDEX audit_log_time_idx ON v3.audit_log(occurred_at DESC);

-- Append-only is a runtime/permissions contract.
-- Production grants must not give the ordinary application role generic
-- UPDATE/DELETE rights on v3.audit_log or v3.role_change_events.
-- Exact role/grant DDL belongs to the later least-privilege/credential gate.

-- ---------------------------------------------------------------------------
-- Security events
-- ---------------------------------------------------------------------------
CREATE TABLE v3.security_events (
    security_event_id UUID PRIMARY KEY,
    user_id           VARCHAR(32),
    event_type        VARCHAR(96) NOT NULL,
    outcome           VARCHAR(24) NOT NULL,
    ip_hash           CHAR(64),
    user_agent_hash   CHAR(64),
    request_id        UUID,
    correlation_id    UUID,
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT security_events_user_fk
        FOREIGN KEY (user_id) REFERENCES v3.users(user_id),
    CONSTRAINT security_events_outcome_check
        CHECK (outcome IN ('success','failure','blocked','challenged')),
    CONSTRAINT security_events_type_nonempty
        CHECK (length(trim(event_type)) > 0),
    CONSTRAINT security_events_ip_hash_format
        CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT security_events_user_agent_hash_format
        CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX security_events_user_time_idx
    ON v3.security_events(user_id, occurred_at DESC)
    WHERE user_id IS NOT NULL;
CREATE INDEX security_events_type_time_idx
    ON v3.security_events(event_type, occurred_at DESC);
CREATE INDEX security_events_time_idx
    ON v3.security_events(occurred_at DESC);
CREATE INDEX security_events_correlation_idx
    ON v3.security_events(correlation_id)
    WHERE correlation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Verification inside the same transaction
-- ---------------------------------------------------------------------------
SELECT tablename
FROM pg_tables
WHERE schemaname = 'v3'
  AND tablename IN (
      'users',
      'user_profiles',
      'auth_sessions',
      'password_reset_tokens',
      'registration_codes',
      'mfa_credentials',
      'roles',
      'user_roles',
      'role_change_events',
      'audit_log',
      'security_events'
  )
ORDER BY tablename;

SELECT COUNT(*)::int AS identity_audit_table_count
FROM pg_tables
WHERE schemaname = 'v3'
  AND tablename IN (
      'users',
      'user_profiles',
      'auth_sessions',
      'password_reset_tokens',
      'registration_codes',
      'mfa_credentials',
      'roles',
      'user_roles',
      'role_change_events',
      'audit_log',
      'security_events'
  );

SELECT conrelid::regclass::text AS table_name,
       conname,
       contype
FROM pg_constraint
WHERE connamespace = 'v3'::regnamespace
  AND conrelid IN (
      'v3.users'::regclass,
      'v3.auth_sessions'::regclass,
      'v3.password_reset_tokens'::regclass,
      'v3.registration_codes'::regclass,
      'v3.mfa_credentials'::regclass,
      'v3.user_roles'::regclass,
      'v3.role_change_events'::regclass,
      'v3.audit_log'::regclass,
      'v3.security_events'::regclass
  )
ORDER BY table_name, conname;

COMMIT;

-- Expand-only rollback scope before any V3 backfill/cutover:
--   DROP TABLE v3.security_events;
--   DROP TABLE v3.audit_log;
--   DROP TABLE v3.role_change_events;
--   DROP TABLE v3.user_roles;
--   DROP TABLE v3.roles;
--   DROP TABLE v3.mfa_credentials;
--   DROP TABLE v3.registration_codes;
--   DROP TABLE v3.password_reset_tokens;
--   DROP TABLE v3.auth_sessions;
--   ALTER TABLE v3.idempotency_keys DROP CONSTRAINT idempotency_keys_actor_user_fk;
--   DROP TABLE v3.user_profiles;
--   DROP TABLE v3.users;
-- Rollback requires an approved decision; comments above are not an automatic runbook.
-- No public.gracz_* object is modified by this draft.

-- ETAP 3 / PostgreSQL V3
-- REVIEW ONLY / DO NOT RUN ON PRODUCTION BEFORE PREFLIGHT GO
-- 01-v3-foundation.sql
-- Purpose: create the isolated V3 namespace and shared transactional foundation.
-- Preconditions:
--   1) 00-precheck-readonly.sql reviewed and accepted for the same migration window.
--   2) schema v3 does not already exist, unless a separately reviewed resume procedure says otherwise.
--   3) backup/restore remains PASS.
--   4) production execution still requires final PREFLIGHT GO.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

-- Fail fast rather than silently accepting an unknown pre-existing namespace.
CREATE SCHEMA v3;

-- ---------------------------------------------------------------------------
-- Transactional Outbox
-- ---------------------------------------------------------------------------
CREATE TABLE v3.outbox_events (
    event_id            UUID PRIMARY KEY,
    aggregate_type      VARCHAR(64) NOT NULL,
    aggregate_id        VARCHAR(128) NOT NULL,
    aggregate_version   BIGINT,
    event_type          VARCHAR(128) NOT NULL,
    payload             JSONB NOT NULL,
    correlation_id      UUID,
    causation_id        UUID,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    available_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    claimed_by          VARCHAR(128),
    claimed_at          TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,
    last_error          TEXT,

    CONSTRAINT outbox_events_status_check
        CHECK (status IN ('pending','processing','published','error')),

    CONSTRAINT outbox_events_attempt_nonnegative
        CHECK (attempt_count >= 0),

    CONSTRAINT outbox_events_aggregate_version_positive
        CHECK (aggregate_version IS NULL OR aggregate_version >= 1),

    CONSTRAINT outbox_events_processing_claim_consistency
        CHECK (
            status <> 'processing'
            OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL)
        ),

    CONSTRAINT outbox_events_published_consistency
        CHECK (
            (status = 'published' AND published_at IS NOT NULL)
            OR
            (status <> 'published' AND published_at IS NULL)
        )
);

CREATE INDEX outbox_events_dispatch_idx
    ON v3.outbox_events(status, available_at, occurred_at)
    WHERE status IN ('pending','error');

CREATE INDEX outbox_events_processing_claimed_idx
    ON v3.outbox_events(claimed_at)
    WHERE status = 'processing';

CREATE INDEX outbox_events_aggregate_idx
    ON v3.outbox_events(aggregate_type, aggregate_id, aggregate_version);

CREATE INDEX outbox_events_published_idx
    ON v3.outbox_events(published_at)
    WHERE published_at IS NOT NULL;

-- Runtime contract for stale processing claims:
--   * publisher claims rows atomically,
--   * processing rows older than the configured reclaim timeout may be requeued/reclaimed,
--   * every delivery is identified by event_id and consumers must be idempotent,
--   * the timeout itself is an ops/runtime setting, not a CHECK constant.

-- ---------------------------------------------------------------------------
-- Command/API idempotency
-- ---------------------------------------------------------------------------
CREATE TABLE v3.idempotency_keys (
    context                 VARCHAR(96) NOT NULL,
    idempotency_key         VARCHAR(128) NOT NULL,
    actor_user_id           VARCHAR(32),
    aggregate_type          VARCHAR(64),
    aggregate_id            VARCHAR(128),
    request_hash            CHAR(64),
    status                  VARCHAR(20) NOT NULL,
    response_code           INTEGER,
    response_payload        JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    processing_expires_at   TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ,

    PRIMARY KEY (context, idempotency_key),

    CONSTRAINT idempotency_keys_status_check
        CHECK (status IN ('processing','completed','failed')),

    CONSTRAINT idempotency_keys_hash_format
        CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT idempotency_keys_processing_consistency
        CHECK (
            (status = 'processing' AND processing_expires_at IS NOT NULL AND completed_at IS NULL)
            OR
            (status <> 'processing' AND processing_expires_at IS NULL)
        ),

    CONSTRAINT idempotency_keys_terminal_consistency
        CHECK (
            (status IN ('completed','failed') AND completed_at IS NOT NULL AND response_code IS NOT NULL)
            OR
            status = 'processing'
        ),

    CONSTRAINT idempotency_keys_expiry_after_create
        CHECK (expires_at IS NULL OR expires_at >= created_at),

    CONSTRAINT idempotency_keys_processing_expiry_after_create
        CHECK (processing_expires_at IS NULL OR processing_expires_at > created_at)
);

CREATE INDEX idempotency_keys_expiry_idx
    ON v3.idempotency_keys(expires_at)
    WHERE expires_at IS NOT NULL;

CREATE INDEX idempotency_keys_processing_expiry_idx
    ON v3.idempotency_keys(processing_expires_at)
    WHERE status = 'processing';

CREATE INDEX idempotency_keys_actor_idx
    ON v3.idempotency_keys(actor_user_id, created_at DESC)
    WHERE actor_user_id IS NOT NULL;

-- Semantics approved by DDL V3 REVIEW:
--   completed = terminal replayable success
--   failed    = terminal deterministic/replayable business result
--   transient infrastructure failure must not be committed as terminal failed
--   expired processing may be safely reclaimed using request_hash conflict protection

-- ---------------------------------------------------------------------------
-- Idempotent async consumer dedupe
-- ---------------------------------------------------------------------------
CREATE TABLE v3.processed_messages (
    consumer_name   VARCHAR(96) NOT NULL,
    message_id      UUID NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

    PRIMARY KEY (consumer_name, message_id),

    CONSTRAINT processed_messages_consumer_nonempty
        CHECK (length(trim(consumer_name)) > 0)
);

CREATE INDEX processed_messages_processed_idx
    ON v3.processed_messages(processed_at);

-- ---------------------------------------------------------------------------
-- Verification inside the same transaction
-- ---------------------------------------------------------------------------
SELECT nspname AS created_schema
FROM pg_namespace
WHERE nspname = 'v3';

SELECT tablename
FROM pg_tables
WHERE schemaname = 'v3'
ORDER BY tablename;

SELECT
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'v3')::int AS v3_table_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'v3')::int AS v3_index_count;

COMMIT;

-- Expand-only rollback before any dependent V3 objects/backfill:
--   DROP SCHEMA v3 CASCADE;
-- This rollback is NOT authorized automatically; use only under an approved rollback decision.
-- No legacy table is altered or dropped by this script.

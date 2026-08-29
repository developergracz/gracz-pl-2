-- ETAP 3 / PostgreSQL V3
-- REVIEW ONLY / DO NOT RUN ON PRODUCTION BEFORE PREFLIGHT GO
-- 03-game-platform-v3.sql
-- Purpose: create the canonical Game Platform V3 structures for game definitions,
--          durable matches, participants, domain events, snapshots and match-actor leases.
--
-- Preconditions:
--   1) 00-precheck-readonly.sql reviewed for the same migration window.
--   2) 01-v3-foundation.sql approved and v3 schema exists.
--   3) 02-identity-audit-v3.sql approved and v3.users exists.
--   4) backup/restore remains PASS.
--   5) writer/process/job correlation, active-state assessment and locking/capacity
--      gates remain mandatory before production execution.
--   6) production execution still requires final PREFLIGHT GO.
--
-- This script is EXPAND ONLY:
--   * no public.gracz_* table is altered or dropped,
--   * no game backfill is performed,
--   * no writer is switched to V3,
--   * no search_path is changed.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- Guardrails / expected dependencies
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

    IF to_regclass('v3.users') IS NULL THEN
        RAISE EXCEPTION 'v3.users missing: review approved Identity/Audit DDL first';
    END IF;

    IF to_regclass('v3.game_definitions') IS NOT NULL
       OR to_regclass('v3.game_matches') IS NOT NULL
       OR to_regclass('v3.game_match_participants') IS NOT NULL
       OR to_regclass('v3.game_match_events') IS NOT NULL
       OR to_regclass('v3.game_match_snapshots') IS NOT NULL
       OR to_regclass('v3.match_actor_leases') IS NOT NULL THEN
        RAISE EXCEPTION 'one or more Game Platform V3 tables already exist; use a separately reviewed resume procedure';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- Canonical game registry
-- ---------------------------------------------------------------------------
CREATE TABLE v3.game_definitions (
    game_id         VARCHAR(32) PRIMARY KEY,
    code            VARCHAR(32) NOT NULL,
    display_name    VARCHAR(80) NOT NULL,
    engine_key      VARCHAR(64) NOT NULL,
    rules_version   VARCHAR(32) NOT NULL,
    default_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_definitions_code_unique
        UNIQUE (code),

    CONSTRAINT game_definitions_code_nonempty
        CHECK (length(trim(code)) > 0),

    CONSTRAINT game_definitions_display_name_nonempty
        CHECK (length(trim(display_name)) > 0),

    CONSTRAINT game_definitions_engine_key_nonempty
        CHECK (length(trim(engine_key)) > 0),

    CONSTRAINT game_definitions_rules_version_nonempty
        CHECK (length(trim(rules_version)) > 0),

    CONSTRAINT game_definitions_updated_after_create
        CHECK (updated_at >= created_at)
);

CREATE INDEX game_definitions_active_idx
    ON v3.game_definitions(active, code);

-- ---------------------------------------------------------------------------
-- Canonical durable match aggregate
-- ---------------------------------------------------------------------------
CREATE TABLE v3.game_matches (
    match_id              UUID PRIMARY KEY,
    game_id               VARCHAR(32) NOT NULL,
    status                VARCHAR(24) NOT NULL,
    version               BIGINT NOT NULL DEFAULT 1,
    last_fencing_token    BIGINT NOT NULL DEFAULT 0,
    state                 JSONB NOT NULL,
    rules_version         VARCHAR(32) NOT NULL,
    created_by_user_id    VARCHAR(32),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at            TIMESTAMPTZ,
    finished_at           TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_matches_game_fk
        FOREIGN KEY (game_id) REFERENCES v3.game_definitions(game_id),

    CONSTRAINT game_matches_creator_fk
        FOREIGN KEY (created_by_user_id) REFERENCES v3.users(user_id),

    CONSTRAINT game_matches_version_positive
        CHECK (version >= 1),

    CONSTRAINT game_matches_fencing_nonnegative
        CHECK (last_fencing_token >= 0),

    CONSTRAINT game_matches_rules_version_nonempty
        CHECK (length(trim(rules_version)) > 0),

    CONSTRAINT game_matches_status_check
        CHECK (status IN (
            'created',
            'waiting',
            'active',
            'paused',
            'completed',
            'cancelled',
            'aborted'
        )),

    CONSTRAINT game_matches_started_after_create
        CHECK (started_at IS NULL OR started_at >= created_at),

    CONSTRAINT game_matches_finished_after_start
        CHECK (
            finished_at IS NULL
            OR finished_at >= COALESCE(started_at, created_at)
        ),

    CONSTRAINT game_matches_finished_consistency
        CHECK (
            (status IN ('completed','cancelled','aborted') AND finished_at IS NOT NULL)
            OR
            (status NOT IN ('completed','cancelled','aborted'))
        ),

    CONSTRAINT game_matches_updated_after_create
        CHECK (updated_at >= created_at)
);

CREATE INDEX game_matches_game_status_idx
    ON v3.game_matches(game_id, status);

CREATE INDEX game_matches_updated_idx
    ON v3.game_matches(updated_at DESC);

CREATE INDEX game_matches_created_by_idx
    ON v3.game_matches(created_by_user_id, created_at DESC)
    WHERE created_by_user_id IS NOT NULL;

CREATE INDEX game_matches_active_idx
    ON v3.game_matches(game_id, updated_at DESC)
    WHERE status IN ('created','waiting','active','paused');

-- ---------------------------------------------------------------------------
-- Match participants
-- ---------------------------------------------------------------------------
CREATE TABLE v3.game_match_participants (
    match_id          UUID NOT NULL,
    user_id           VARCHAR(32) NOT NULL,
    participant_role  VARCHAR(24) NOT NULL,
    seat_no           SMALLINT,
    joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at           TIMESTAMPTZ,
    result_code       VARCHAR(24),
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

    PRIMARY KEY (match_id, user_id),

    CONSTRAINT game_match_participants_match_fk
        FOREIGN KEY (match_id) REFERENCES v3.game_matches(match_id) ON DELETE CASCADE,

    CONSTRAINT game_match_participants_user_fk
        FOREIGN KEY (user_id) REFERENCES v3.users(user_id),

    CONSTRAINT game_match_participants_role_check
        CHECK (participant_role IN ('player','spectator','arbiter','system')),

    CONSTRAINT game_match_participants_seat_positive
        CHECK (seat_no IS NULL OR seat_no > 0),

    CONSTRAINT game_match_participants_left_after_join
        CHECK (left_at IS NULL OR left_at >= joined_at)
);

CREATE UNIQUE INDEX game_match_participants_seat_unique
    ON v3.game_match_participants(match_id, seat_no)
    WHERE seat_no IS NOT NULL AND left_at IS NULL;

CREATE INDEX game_match_participants_user_time_idx
    ON v3.game_match_participants(user_id, joined_at DESC);

CREATE INDEX game_match_participants_active_match_idx
    ON v3.game_match_participants(match_id, participant_role)
    WHERE left_at IS NULL;

-- ---------------------------------------------------------------------------
-- Durable ordered domain events
-- ---------------------------------------------------------------------------
CREATE TABLE v3.game_match_events (
    event_id           UUID PRIMARY KEY,
    match_id           UUID NOT NULL,
    sequence_no        BIGINT NOT NULL,
    aggregate_version  BIGINT NOT NULL,
    event_type         VARCHAR(96) NOT NULL,
    actor_user_id      VARCHAR(32),
    payload            JSONB NOT NULL,
    correlation_id     UUID,
    causation_id       UUID,
    occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_match_events_match_fk
        FOREIGN KEY (match_id) REFERENCES v3.game_matches(match_id) ON DELETE CASCADE,

    CONSTRAINT game_match_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES v3.users(user_id),

    CONSTRAINT game_match_events_sequence_positive
        CHECK (sequence_no >= 1),

    CONSTRAINT game_match_events_version_positive
        CHECK (aggregate_version >= 1),

    CONSTRAINT game_match_events_type_nonempty
        CHECK (length(trim(event_type)) > 0),

    CONSTRAINT game_match_events_match_sequence_unique
        UNIQUE (match_id, sequence_no)
);

CREATE INDEX game_match_events_match_version_idx
    ON v3.game_match_events(match_id, aggregate_version);

CREATE INDEX game_match_events_match_time_idx
    ON v3.game_match_events(match_id, occurred_at);

CREATE INDEX game_match_events_correlation_idx
    ON v3.game_match_events(correlation_id)
    WHERE correlation_id IS NOT NULL;

-- REVIEW decision:
-- (match_id, aggregate_version) is intentionally NON-UNIQUE because one command
-- may emit multiple domain events for the same aggregate version.
-- (match_id, sequence_no) remains the hard ordering invariant.

-- ---------------------------------------------------------------------------
-- Controlled state snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE v3.game_match_snapshots (
    snapshot_id    UUID PRIMARY KEY,
    match_id       UUID NOT NULL,
    version        BIGINT NOT NULL,
    state          JSONB NOT NULL,
    rules_version  VARCHAR(32) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT game_match_snapshots_match_fk
        FOREIGN KEY (match_id) REFERENCES v3.game_matches(match_id) ON DELETE CASCADE,

    CONSTRAINT game_match_snapshots_version_positive
        CHECK (version >= 1),

    CONSTRAINT game_match_snapshots_rules_version_nonempty
        CHECK (length(trim(rules_version)) > 0),

    CONSTRAINT game_match_snapshots_match_version_unique
        UNIQUE (match_id, version)
);

CREATE INDEX game_match_snapshots_match_time_idx
    ON v3.game_match_snapshots(match_id, created_at DESC);

-- Snapshots are an optimization. v3.game_matches remains the current durable state.

-- ---------------------------------------------------------------------------
-- Per-match actor ownership and fencing
-- ---------------------------------------------------------------------------
CREATE TABLE v3.match_actor_leases (
    match_id           UUID PRIMARY KEY,
    owner_instance_id  VARCHAR(128) NOT NULL,
    fencing_token      BIGINT NOT NULL,
    lease_expires_at   TIMESTAMPTZ NOT NULL,
    acquired_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    renewed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT match_actor_leases_match_fk
        FOREIGN KEY (match_id) REFERENCES v3.game_matches(match_id) ON DELETE CASCADE,

    CONSTRAINT match_actor_leases_owner_nonempty
        CHECK (length(trim(owner_instance_id)) > 0),

    CONSTRAINT match_actor_leases_fencing_positive
        CHECK (fencing_token >= 1),

    CONSTRAINT match_actor_leases_renew_after_acquire
        CHECK (renewed_at >= acquired_at),

    CONSTRAINT match_actor_leases_expiry_after_renew
        CHECK (lease_expires_at > renewed_at)
);

CREATE INDEX match_actor_leases_expiry_idx
    ON v3.match_actor_leases(lease_expires_at);

CREATE INDEX match_actor_leases_owner_idx
    ON v3.match_actor_leases(owner_instance_id, lease_expires_at);

-- Required runtime mutation contract (not replaceable by a weaker application check):
--   1) lock/read current v3.match_actor_leases row for match_id,
--   2) require owner_instance_id equality,
--   3) require exact fencing_token equality,
--   4) require lease_expires_at > NOW(),
--   5) require expected v3.game_matches.version (CAS),
--   6) reject fencing_token < game_matches.last_fencing_token,
--   7) update state/version/last_fencing_token in the same transaction,
--   8) insert domain event(s), outbox event(s) and idempotency result before COMMIT.
--
-- The DDL stores both current lease token and last accepted match token.
-- Correct split-brain protection still requires the transaction contract above.

-- ---------------------------------------------------------------------------
-- Verification inside the same transaction
-- ---------------------------------------------------------------------------
SELECT tablename
FROM pg_tables
WHERE schemaname = 'v3'
  AND tablename IN (
      'game_definitions',
      'game_matches',
      'game_match_participants',
      'game_match_events',
      'game_match_snapshots',
      'match_actor_leases'
  )
ORDER BY tablename;

SELECT COUNT(*)::int AS game_platform_table_count
FROM pg_tables
WHERE schemaname = 'v3'
  AND tablename IN (
      'game_definitions',
      'game_matches',
      'game_match_participants',
      'game_match_events',
      'game_match_snapshots',
      'match_actor_leases'
  );

SELECT conrelid::regclass::text AS table_name,
       conname,
       contype
FROM pg_constraint
WHERE connamespace = 'v3'::regnamespace
  AND conrelid IN (
      'v3.game_definitions'::regclass,
      'v3.game_matches'::regclass,
      'v3.game_match_participants'::regclass,
      'v3.game_match_events'::regclass,
      'v3.game_match_snapshots'::regclass,
      'v3.match_actor_leases'::regclass
  )
ORDER BY table_name, conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'v3'
  AND tablename IN (
      'game_definitions',
      'game_matches',
      'game_match_participants',
      'game_match_events',
      'game_match_snapshots',
      'match_actor_leases'
  )
ORDER BY tablename, indexname;

COMMIT;

-- Expand-only rollback scope before any V3 backfill/cutover:
--   DROP TABLE v3.match_actor_leases;
--   DROP TABLE v3.game_match_snapshots;
--   DROP TABLE v3.game_match_events;
--   DROP TABLE v3.game_match_participants;
--   DROP TABLE v3.game_matches;
--   DROP TABLE v3.game_definitions;
-- Rollback requires an approved decision; comments above are not an automatic runbook.
-- No public.gracz_* object is modified by this draft.

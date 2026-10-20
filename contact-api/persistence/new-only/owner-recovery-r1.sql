-- OWNER M6 only. Intentionally not named migration 005 (reserved elsewhere).
-- Run explicitly ONCE in the private Render Shell before enabling recovery.
-- No newsletter schema or subscriber records are touched.
CREATE TABLE newsletter_owner.recovery (
  id integer PRIMARY KEY CHECK (id=1),
  email_ciphertext text,
  email_tag char(64) CHECK (email_tag ~ '^[a-f0-9]{64}$'),
  pending_ciphertext text,
  pending_tag char(64) CHECK (pending_tag ~ '^[a-f0-9]{64}$'),
  pending_code_hash char(64) CHECK (pending_code_hash ~ '^[a-f0-9]{64}$'),
  pending_expires timestamptz,
  pending_attempts smallint NOT NULL DEFAULT 0 CHECK (pending_attempts BETWEEN 0 AND 5),
  pending_last_sent timestamptz,
  reset_code_hash char(64) CHECK (reset_code_hash ~ '^[a-f0-9]{64}$'),
  reset_expires timestamptz,
  reset_attempts smallint NOT NULL DEFAULT 0 CHECK (reset_attempts BETWEEN 0 AND 5),
  reset_last_sent timestamptz,
  reset_day date,
  reset_daily_count smallint NOT NULL DEFAULT 0 CHECK (reset_daily_count BETWEEN 0 AND 5),
  CHECK ((email_ciphertext IS NULL) = (email_tag IS NULL)),
  CHECK ((pending_ciphertext IS NULL) = (pending_tag IS NULL))
);
REVOKE ALL ON newsletter_owner.recovery FROM PUBLIC;
INSERT INTO newsletter_owner.recovery(id) VALUES(1);
ALTER TABLE newsletter_owner.audit DROP CONSTRAINT audit_action_check;
ALTER TABLE newsletter_owner.audit ADD CONSTRAINT audit_action_check
 CHECK(action IN ('login_ok','login_denied','session_read','subscriber_list',
 'subscriber_detail','logout','credentials_changed',
 'recovery_email_set','recovery_requested','recovery_completed'));
-- Permissions: API DB role needs SELECT/UPDATE recovery. Never DELETE or TRUNCATE.
-- If the service uses a separate PostgreSQL role, grant only SELECT,UPDATE.

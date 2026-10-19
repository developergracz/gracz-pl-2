-- #282 R1: separate, private and additive recovery namespace.
-- Deliberately NOT in global CONTACT migrations or F03 newsletter migrations.
-- Installation requires a future independently approved recovery migration executor.
-- Store only opaque UUID references and a purpose-separated keyed dedupe tag. NO PII.
CREATE SCHEMA newsletter_recovery;
REVOKE ALL ON SCHEMA newsletter_recovery FROM PUBLIC;

CREATE TABLE newsletter_recovery.withdrawal_requests (
  request_id uuid PRIMARY KEY,
  dedupe_tag char(64) NOT NULL UNIQUE CHECK (dedupe_tag ~ '^[0-9a-f]{64}$'),
  intake_source varchar(24) NOT NULL CHECK (intake_source IN ('routed_email','operator_record','support_request')),
  evidence_ref uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE newsletter_recovery.withdrawal_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES newsletter_recovery.withdrawal_requests(request_id),
  event_kind varchar(24) NOT NULL CHECK (event_kind IN ('RECEIVED','QUARANTINED')),
  actor_ref uuid,
  reason_code varchar(32),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT withdrawal_event_shape CHECK (
    (event_kind='RECEIVED' AND actor_ref IS NULL AND reason_code IS NULL) OR
    (event_kind='QUARANTINED' AND actor_ref IS NOT NULL AND
     reason_code IS NOT NULL AND reason_code IN ('UNVERIFIED','UNMAPPED','AMBIGUOUS','PROVIDER_UNKNOWN','OTHER'))
  )
);
CREATE UNIQUE INDEX withdrawal_one_receipt
  ON newsletter_recovery.withdrawal_events(request_id) WHERE event_kind='RECEIVED';

-- Append-only at database level. Table ownership and migration credentials remain restricted.
CREATE FUNCTION newsletter_recovery.reject_withdrawal_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'WITHDRAWAL_APPEND_ONLY';
END $$;

CREATE TRIGGER withdrawal_requests_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_requests_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.withdrawal_requests
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();

CREATE TRIGGER withdrawal_events_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.withdrawal_events
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_events_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.withdrawal_events
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();

-- A receipt event is inserted in the same transaction as the immutable intake row.
CREATE FUNCTION newsletter_recovery.record_withdrawal_receipt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO newsletter_recovery.withdrawal_events(request_id,event_kind)
  VALUES (NEW.request_id,'RECEIVED');
  RETURN NEW;
END $$;
CREATE TRIGGER withdrawal_receipt_after_insert
  AFTER INSERT ON newsletter_recovery.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.record_withdrawal_receipt();

-- No operator accounts are provisioned by this migration: default deny.
-- Account onboarding/revocation requires independent, restricted Owner controls.
CREATE TABLE newsletter_recovery.operator_accounts (
  operator_ref uuid PRIMARY KEY,
  subject_tag char(64) NOT NULL UNIQUE CHECK (subject_tag ~ '^[0-9a-f]{64}
REVOKE ALL ON ALL SEQUENCES IN SCHEMA newsletter_recovery FROM PUBLIC;
),
  role varchar(12) NOT NULL CHECK (role IN ('primary','backup')),
  disabled_at timestamptz,
  enrolled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX withdrawal_one_primary
  ON newsletter_recovery.operator_accounts(role) WHERE role='primary' AND disabled_at IS NULL;
CREATE UNIQUE INDEX withdrawal_one_backup
  ON newsletter_recovery.operator_accounts(role) WHERE role='backup' AND disabled_at IS NULL;

-- Each short-lived, signed MFA assertion is single-use at the DB boundary.
-- Every operator action (including a private read) must be durably audited.
CREATE TABLE newsletter_recovery.operator_actions (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_use char(64) NOT NULL UNIQUE CHECK (token_use ~ '^[0-9a-f]{64}
REVOKE ALL ON ALL SEQUENCES IN SCHEMA newsletter_recovery FROM PUBLIC;
),
  operator_ref uuid NOT NULL REFERENCES newsletter_recovery.operator_accounts(operator_ref),
  action_kind varchar(24) NOT NULL CHECK (action_kind IN ('INSPECT_PENDING','QUARANTINE')),
  request_id uuid REFERENCES newsletter_recovery.withdrawal_requests(request_id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (action_kind='INSPECT_PENDING' AND request_id IS NULL) OR
    (action_kind='QUARANTINE' AND request_id IS NOT NULL)
  )
);
CREATE TRIGGER withdrawal_operator_actions_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.operator_actions
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_operator_actions_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.operator_actions
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();

-- A restricted operator service must have only SELECT on accounts/requests/events
-- and INSERT on actions/events, never UPDATE/DELETE/DDL; role grants and
-- identity-provider onboarding require a separate reviewed future release.

REVOKE ALL ON ALL TABLES IN SCHEMA newsletter_recovery FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA newsletter_recovery FROM PUBLIC;

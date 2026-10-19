-- #282 R1: separate, private and additive recovery namespace.
-- Deliberately NOT in global CONTACT migrations or F03 newsletter migrations.
-- Installation requires a future independently approved recovery migration executor.
-- Store only opaque UUID references and a purpose-separated keyed dedupe tag. NO PII.
CREATE SCHEMA newsletter_recovery;
REVOKE ALL ON SCHEMA newsletter_recovery FROM PUBLIC;

CREATE TABLE newsletter_recovery.withdrawal_requests (
  request_id uuid PRIMARY KEY,
  dedupe_tag char(64) NOT NULL UNIQUE CHECK (dedupe_tag ~ '^[0-9a-f]{64}$'),
  intake_source varchar(24) NOT NULL CHECK (intake_source IN ('routed_email','operator_record','support_request','self_service')),
  evidence_ref uuid NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE newsletter_recovery.withdrawal_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES newsletter_recovery.withdrawal_requests(request_id),
  event_kind varchar(24) NOT NULL CHECK (event_kind IN ('RECEIVED','QUARANTINED','VERIFIED_PENDING','PROVIDER_OFF_VERIFIED')),
  actor_ref uuid,
  reason_code varchar(32),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT withdrawal_event_shape CHECK (
    (event_kind='RECEIVED' AND actor_ref IS NULL AND reason_code IS NULL) OR
    (event_kind='QUARANTINED' AND actor_ref IS NOT NULL AND
     reason_code IS NOT NULL AND reason_code IN ('UNVERIFIED','UNMAPPED','AMBIGUOUS','PROVIDER_UNKNOWN','OTHER')) OR
    (event_kind IN ('VERIFIED_PENDING','PROVIDER_OFF_VERIFIED') AND actor_ref IS NOT NULL AND reason_code IS NULL)
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
  subject_tag char(64) NOT NULL UNIQUE CHECK (subject_tag ~ '^[0-9a-f]{64}$'),
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
  token_use char(64) NOT NULL UNIQUE CHECK (token_use ~ '^[0-9a-f]{64}$'),
  operator_ref uuid NOT NULL REFERENCES newsletter_recovery.operator_accounts(operator_ref),
  action_kind varchar(24) NOT NULL CHECK (action_kind IN ('INSPECT_PENDING','QUARANTINE','RECORD_VERIFIED_PENDING','RECONCILE_PROVIDER_OFF','LINK_VERIFIED_RECIPIENT')),
  request_id uuid REFERENCES newsletter_recovery.withdrawal_requests(request_id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (action_kind='INSPECT_PENDING' AND request_id IS NULL) OR
    (action_kind IN ('QUARANTINE','RECORD_VERIFIED_PENDING','RECONCILE_PROVIDER_OFF','LINK_VERIFIED_RECIPIENT') AND request_id IS NOT NULL)
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


-- Verification records are only a durable receipt for TWO independent
-- externally signed attestations. No real proof provider is implemented here.
-- This NEVER marks a withdrawal or provider suppression as completed.
CREATE TABLE newsletter_recovery.withdrawal_verified_evidence (
  request_id uuid PRIMARY KEY REFERENCES newsletter_recovery.withdrawal_requests(request_id),
  actor_ref uuid NOT NULL REFERENCES newsletter_recovery.operator_accounts(operator_ref),
  legacy_subject_ref uuid NOT NULL,
  mailbox_tag char(64) NOT NULL CHECK (mailbox_tag ~ '^[0-9a-f]{64}$'),
  mailbox_proof_ref uuid NOT NULL,
  mapping_proof_ref uuid NOT NULL,
  mailbox_proof_tag char(64) NOT NULL UNIQUE CHECK (mailbox_proof_tag ~ '^[0-9a-f]{64}$'),
  mapping_proof_tag char(64) NOT NULL UNIQUE CHECK (mapping_proof_tag ~ '^[0-9a-f]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (mailbox_proof_ref <> mapping_proof_ref),
  CHECK (mailbox_proof_tag <> mapping_proof_tag)
);
CREATE TABLE newsletter_recovery.withdrawal_no_send_obligations (
  obligation_id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE REFERENCES newsletter_recovery.withdrawal_verified_evidence(request_id),
  legacy_subject_ref uuid NOT NULL,
  obligation_state varchar(24) NOT NULL DEFAULT 'RECONCILIATION_PENDING'
    CHECK (obligation_state='RECONCILIATION_PENDING'),
  required_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER withdrawal_verified_evidence_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.withdrawal_verified_evidence
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_verified_evidence_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.withdrawal_verified_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_no_send_obligations_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.withdrawal_no_send_obligations
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_no_send_obligations_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.withdrawal_no_send_obligations
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();


-- One durable intent is written BEFORE any external provider-off request.
-- A second process can inspect its effect, but must not blindly repeat it.
CREATE TABLE newsletter_recovery.withdrawal_provider_off_intents (
  request_id uuid PRIMARY KEY REFERENCES newsletter_recovery.withdrawal_verified_evidence(request_id),
  actor_ref uuid NOT NULL REFERENCES newsletter_recovery.operator_accounts(operator_ref),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Readback of team-wide suppression AND Resend unsubscribed contact state.
-- This is not itself a legacy consent-ledger withdrawal confirmation.
CREATE TABLE newsletter_recovery.withdrawal_provider_off_verified (
  request_id uuid PRIMARY KEY REFERENCES newsletter_recovery.withdrawal_provider_off_intents(request_id),
  actor_ref uuid NOT NULL REFERENCES newsletter_recovery.operator_accounts(operator_ref),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX withdrawal_one_provider_off_event
  ON newsletter_recovery.withdrawal_events(request_id)
  WHERE event_kind='PROVIDER_OFF_VERIFIED';

CREATE TRIGGER withdrawal_off_intents_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.withdrawal_provider_off_intents
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_off_intents_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.withdrawal_provider_off_intents
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_off_verified_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.withdrawal_provider_off_verified
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_off_verified_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.withdrawal_provider_off_verified
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();


-- Separate owner-signed enrollment attestation: two individually MFA verified
-- subjects. No accounts are provisioned during migration.
CREATE TABLE newsletter_recovery.operator_enrollments (
  approval_tag char(64) PRIMARY KEY CHECK (approval_tag ~ '^[0-9a-f]{64}$'),
  primary_ref uuid NOT NULL REFERENCES newsletter_recovery.operator_accounts(operator_ref),
  backup_ref uuid NOT NULL REFERENCES newsletter_recovery.operator_accounts(operator_ref),
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (primary_ref <> backup_ref)
);

-- Legacy identity is only mapped AFTER independent signed mailbox + mapping
-- proofs and a matches-existing-legacy-ledger check with escrow-verified key.
-- The encrypted mailbox is never logged and cannot overwrite legacy evidence.
CREATE TABLE newsletter_recovery.verified_recipient_links (
  request_id uuid PRIMARY KEY REFERENCES newsletter_recovery.withdrawal_verified_evidence(request_id),
  legacy_subject_ref uuid NOT NULL UNIQUE,
  mailbox_tag char(64) NOT NULL UNIQUE CHECK (mailbox_tag ~ '^[0-9a-f]{64}$'),
  legacy_email_hash char(64) NOT NULL UNIQUE CHECK (legacy_email_hash ~ '^[0-9a-f]{64}$'),
  ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) >= 16),
  nonce bytea NOT NULL CHECK (octet_length(nonce)=12),
  auth_tag bytea NOT NULL CHECK (octet_length(auth_tag)=16),
  linked_by uuid NOT NULL REFERENCES newsletter_recovery.operator_accounts(operator_ref),
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER withdrawal_operator_enrollment_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.operator_enrollments
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_operator_enrollment_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.operator_enrollments
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_recipient_links_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_recovery.verified_recipient_links
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER withdrawal_recipient_links_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.verified_recipient_links
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();


-- R9: authenticated RECIPIENT self-service, with no accounts, old n1/ns1
-- tokens, operator provisioning or new marketing consent. A confirmation
-- requires a NEW strong mailbox-secret delivered out of band.
CREATE TABLE newsletter_recovery.self_service_challenges (
  challenge_id uuid PRIMARY KEY,
  recipient_tag char(64) NOT NULL CHECK (recipient_tag ~ '^[0-9a-f]{64}$'),
  token_tag char(64) NOT NULL UNIQUE CHECK (token_tag ~ '^[0-9a-f]{64}$'),
  ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) >= 16),
  nonce bytea NOT NULL CHECK (octet_length(nonce) = 12),
  auth_tag bytea NOT NULL CHECK (octet_length(auth_tag) = 16),
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL CHECK (expires_at > requested_at)
);
CREATE INDEX self_service_recent_by_recipient ON
  newsletter_recovery.self_service_challenges(recipient_tag,requested_at DESC);

-- Global, restart-safe anti-abuse budget. This guards transactional mail
-- across rotating addresses/IPs without retaining their plaintext identifiers.
CREATE TABLE newsletter_recovery.self_service_mail_budget (
  hour_bucket timestamptz PRIMARY KEY,
  accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0 AND accepted_count <= 60)
);
CREATE TRIGGER self_service_mail_budget_no_delete
  BEFORE DELETE ON newsletter_recovery.self_service_mail_budget
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER self_service_mail_budget_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.self_service_mail_budget
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();

CREATE TABLE newsletter_recovery.self_service_verified (
  challenge_id uuid PRIMARY KEY REFERENCES newsletter_recovery.self_service_challenges(challenge_id),
  withdrawal_request_id uuid NOT NULL UNIQUE
    REFERENCES newsletter_recovery.withdrawal_requests(request_id),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE newsletter_recovery.self_service_provider_intents (
  challenge_id uuid PRIMARY KEY REFERENCES newsletter_recovery.self_service_verified(challenge_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE newsletter_recovery.self_service_provider_verified (
  challenge_id uuid PRIMARY KEY REFERENCES newsletter_recovery.self_service_provider_intents(challenge_id),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- No historical consent event is rewritten, and provider-off alone does not
-- claim first-party consent ledger reconciliation.
CREATE TRIGGER self_service_challenges_append_only
  BEFORE UPDATE OR DELETE ON newsletter_recovery.self_service_challenges
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER self_service_challenges_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.self_service_challenges
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER self_service_verified_append_only
  BEFORE UPDATE OR DELETE ON newsletter_recovery.self_service_verified
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER self_service_verified_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.self_service_verified
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER self_service_intents_append_only
  BEFORE UPDATE OR DELETE ON newsletter_recovery.self_service_provider_intents
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER self_service_intents_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.self_service_provider_intents
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER self_service_provider_verified_append_only
  BEFORE UPDATE OR DELETE ON newsletter_recovery.self_service_provider_verified
  FOR EACH ROW EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();
CREATE TRIGGER self_service_provider_verified_no_truncate
  BEFORE TRUNCATE ON newsletter_recovery.self_service_provider_verified
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_recovery.reject_withdrawal_mutation();

REVOKE ALL ON ALL TABLES IN SCHEMA newsletter_recovery FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA newsletter_recovery FROM PUBLIC;

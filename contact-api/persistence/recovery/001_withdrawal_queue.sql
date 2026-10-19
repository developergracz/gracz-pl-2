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

REVOKE ALL ON ALL TABLES IN SCHEMA newsletter_recovery FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA newsletter_recovery FROM PUBLIC;

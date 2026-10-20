-- New-only DOI ledger. NEVER imports or reads legacy consent / Resend contacts.
-- Apply privately, exactly once, only after the normal backup/recovery gate.
CREATE SCHEMA newsletter_new;
REVOKE ALL ON SCHEMA newsletter_new FROM PUBLIC;

CREATE TABLE newsletter_new.subscribers (
  email_tag char(64) PRIMARY KEY CHECK (email_tag ~ '^[0-9a-f]{64}$'),
  ciphertext bytea NOT NULL CHECK (octet_length(ciphertext) >= 4),
  nonce bytea NOT NULL CHECK (octet_length(nonce)=12),
  auth_tag bytea NOT NULL CHECK (octet_length(auth_tag)=16),
  challenge_id uuid NOT NULL UNIQUE,
  token_tag char(64) CHECK (token_tag IS NULL OR token_tag ~ '^[0-9a-f]{64}$'),
  state varchar(10) NOT NULL CHECK (state IN ('pending','active')),
  delivery_state varchar(10) NOT NULL CHECK (delivery_state IN ('uncertain','sent')),
  source varchar(40) NOT NULL,
  consent_version varchar(64) NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  CHECK (
    (state='pending' AND token_tag IS NOT NULL AND confirmed_at IS NULL) OR
    (state='active' AND token_tag IS NULL AND confirmed_at IS NOT NULL)
  )
);
CREATE INDEX subscribers_pending_expiry ON newsletter_new.subscribers(expires_at)
 WHERE state='pending';

CREATE TABLE newsletter_new.consent_events (
  event_id uuid PRIMARY KEY,
  email_tag char(64) NOT NULL REFERENCES newsletter_new.subscribers(email_tag),
  challenge_id uuid NOT NULL UNIQUE,
  event_type varchar(20) NOT NULL CHECK (event_type='opt_in_confirmed'),
  consent_version varchar(64) NOT NULL,
  source varchar(40) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE newsletter_new.mail_budget (
  hour_bucket timestamptz PRIMARY KEY,
  used integer NOT NULL CHECK (used BETWEEN 1 AND 60)
);

CREATE FUNCTION newsletter_new.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'NEWSLETTER_NEW_AUDIT_APPEND_ONLY';
END $$;
CREATE TRIGGER consent_events_immutable
BEFORE UPDATE OR DELETE ON newsletter_new.consent_events
FOR EACH ROW EXECUTE FUNCTION newsletter_new.reject_mutation();
CREATE TRIGGER consent_events_no_truncate
BEFORE TRUNCATE ON newsletter_new.consent_events
FOR EACH STATEMENT EXECUTE FUNCTION newsletter_new.reject_mutation();

-- Least privilege for the API role: USAGE on schema; SELECT,INSERT,UPDATE on
-- subscribers/mail_budget; SELECT,INSERT on consent_events. Never DELETE/TRUNCATE.
-- Restrict migration ownership to a separate operator role.

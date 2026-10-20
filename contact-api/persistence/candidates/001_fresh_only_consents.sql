-- gracz.pl: isolated fresh-only newsletter opt-in. Never import or rewrite legacy data.
-- MANUAL, ONE-TIME DDL; not part of contact-api global migrator.
BEGIN;
CREATE SCHEMA newsletter_fresh;
REVOKE ALL ON SCHEMA newsletter_fresh FROM PUBLIC;

CREATE TABLE newsletter_fresh.challenges (
  challenge_id uuid PRIMARY KEY,
  recipient_tag char(64) NOT NULL CHECK(recipient_tag ~ '^[0-9a-f]{64}$'),
  token_tag char(64) NOT NULL UNIQUE CHECK(token_tag ~ '^[0-9a-f]{64}$'),
  ciphertext bytea NOT NULL CHECK(octet_length(ciphertext) BETWEEN 3 AND 254),
  nonce bytea NOT NULL CHECK(octet_length(nonce)=12),
  auth_tag bytea NOT NULL CHECK(octet_length(auth_tag)=16),
  source varchar(32) NOT NULL CHECK(source IN ('newsletter_page','footer')),
  consent_version varchar(48) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL CHECK(expires_at > issued_at),
  mail_state varchar(16) NOT NULL DEFAULT 'inflight'
    CHECK(mail_state IN ('inflight','sent','unknown')),
  consumed_at timestamptz
);
CREATE INDEX fresh_recipient_history ON newsletter_fresh.challenges(recipient_tag,issued_at DESC);
CREATE TABLE newsletter_fresh.mail_budget (
  hour_bucket timestamptz PRIMARY KEY,
  count integer NOT NULL CHECK(count BETWEEN 0 AND 60)
);
CREATE TABLE newsletter_fresh.consent_events (
  event_id uuid PRIMARY KEY,
  challenge_id uuid NOT NULL UNIQUE REFERENCES newsletter_fresh.challenges(challenge_id),
  recipient_tag char(64) NOT NULL CHECK(recipient_tag ~ '^[0-9a-f]{64}$'),
  consent_version varchar(48) NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX fresh_one_consent_per_recipient
  ON newsletter_fresh.consent_events(recipient_tag);
CREATE TABLE newsletter_fresh.provider_intents (
  challenge_id uuid PRIMARY KEY REFERENCES newsletter_fresh.consent_events(challenge_id),
  state varchar(16) NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  verified_at timestamptz
);
-- Immutable consent evidence: no update/delete/truncate of proof rows.
CREATE FUNCTION newsletter_fresh.reject_consent_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'FRESH_CONSENT_APPEND_ONLY'; END $$;
CREATE TRIGGER fresh_consents_no_update_delete
  BEFORE UPDATE OR DELETE ON newsletter_fresh.consent_events
  FOR EACH ROW EXECUTE FUNCTION newsletter_fresh.reject_consent_mutation();
CREATE TRIGGER fresh_consents_no_truncate
  BEFORE TRUNCATE ON newsletter_fresh.consent_events
  FOR EACH STATEMENT EXECUTE FUNCTION newsletter_fresh.reject_consent_mutation();

REVOKE ALL ON ALL TABLES IN SCHEMA newsletter_fresh FROM PUBLIC;
COMMIT;

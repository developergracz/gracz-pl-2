CREATE TABLE contact_cases (
  request_id uuid PRIMARY KEY,
  sender_hash char(64) NOT NULL
    CHECK (sender_hash ~ '^[0-9a-f]{64}$'),
  category varchar(80) NOT NULL,
  subject varchar(180) NOT NULL,
  source_path varchar(500) NOT NULL DEFAULT '',
  provider_message_id varchar(200),
  delivery_status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed', 'unknown')),
  reply_status varchar(24) NOT NULL DEFAULT 'none'
    CHECK (reply_status IN ('none', 'available', 'sent', 'expired')),
  last_error_code varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_cases_created_at_idx
  ON contact_cases (created_at DESC);

CREATE TABLE reply_tokens (
  jti_hash char(64) PRIMARY KEY
    CHECK (jti_hash ~ '^[0-9a-f]{64}$'),
  request_id uuid NOT NULL
    REFERENCES contact_cases(request_id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  state varchar(16) NOT NULL DEFAULT 'issued'
    CHECK (state IN ('issued', 'inflight', 'used', 'expired')),
  provider_idempotency_key varchar(200) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (used_at IS NULL OR state = 'used')
);

CREATE INDEX reply_tokens_request_id_idx
  ON reply_tokens (request_id);

CREATE INDEX reply_tokens_expires_at_idx
  ON reply_tokens (expires_at)
  WHERE state IN ('issued', 'inflight');

CREATE TABLE idempotency_keys (
  scope varchar(80) NOT NULL,
  key_hash char(64) NOT NULL
    CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  fingerprint char(64) NOT NULL
    CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  state varchar(16) NOT NULL
    CHECK (state IN ('inflight', 'done')),
  response_status smallint
    CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  response_body jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key_hash),
  CHECK (
    (state = 'inflight' AND response_status IS NULL)
    OR
    (state = 'done' AND response_status IS NOT NULL)
  )
);

CREATE INDEX idempotency_keys_expires_at_idx
  ON idempotency_keys (expires_at);

CREATE TABLE newsletter_contacts (
  email_hash char(64) PRIMARY KEY
    CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  provider_contact_id varchar(200),
  current_state varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (current_state IN ('pending', 'subscribed', 'unsubscribed')),
  consent_version varchar(120),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_state <> 'subscribed' OR confirmed_at IS NOT NULL)
);

CREATE INDEX newsletter_contacts_state_idx
  ON newsletter_contacts (current_state, updated_at DESC);

CREATE TABLE newsletter_consent_events (
  event_id uuid PRIMARY KEY,
  email_hash char(64) NOT NULL
    REFERENCES newsletter_contacts(email_hash) ON DELETE RESTRICT,
  event_type varchar(40) NOT NULL
    CHECK (
      event_type IN (
        'opt_in_requested',
        'opt_in_confirmed',
        'unsubscribe',
        'resubscribe',
        'provider_sync',
        'provider_delivered',
        'provider_bounce',
        'provider_complaint',
        'provider_failed'
      )
    ),
  consent_version varchar(120),
  source varchar(120) NOT NULL,
  occurred_at timestamptz NOT NULL,
  correlation_id varchar(200),
  provider_ref varchar(200),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX newsletter_consent_events_email_time_idx
  ON newsletter_consent_events (email_hash, occurred_at ASC);

CREATE INDEX newsletter_consent_events_type_time_idx
  ON newsletter_consent_events (event_type, occurred_at DESC);

CREATE FUNCTION reject_newsletter_consent_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'newsletter_consent_events is append-only'
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER newsletter_consent_events_append_only
BEFORE UPDATE OR DELETE ON newsletter_consent_events
FOR EACH ROW
EXECUTE FUNCTION reject_newsletter_consent_event_mutation();

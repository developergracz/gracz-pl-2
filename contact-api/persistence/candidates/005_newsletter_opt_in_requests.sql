-- B1 additive send-control state. No plaintext email, token or consent mutation.
CREATE TABLE newsletter_opt_in_requests (
  email_hash char(64) PRIMARY KEY CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  request_id uuid NOT NULL UNIQUE,
  state varchar(16) NOT NULL DEFAULT 'pre_send' CHECK (state IN ('pre_send', 'inflight', 'unknown', 'sent', 'legacy_pending')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > issued_at),
  sent_at timestamptz,
  CHECK ((state = 'sent') = (sent_at IS NOT NULL))
);
-- Inflight is deliberately never recycled automatically: it can represent a
-- provider-accepted message whose acknowledgement was lost or a process crash.

-- No automatic history import. The explicit, fenced offline cutover operation
-- requires an Owner-approved boundary before any R4/R5 writer starts.

-- Freeze the latest admissible legacy boundary at installation, before any R4/R5
-- writer. Missing seal on an existing installation means import is denied.
INSERT INTO idempotency_keys(scope,key_hash,fingerprint,state,response_status,response_body,expires_at)
VALUES ('newsletter-cutover',repeat('0',64),repeat('0',64),'done',200,
        jsonb_build_object('importNotAfter',clock_timestamp()),'infinity')
ON CONFLICT DO NOTHING;

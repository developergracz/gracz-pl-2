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

-- Existing opt-in events precede delivery acknowledgement. Preserve their
-- pending window without inventing a sent timestamp or creating new consent.
INSERT INTO newsletter_opt_in_requests(email_hash, request_id, state, issued_at, expires_at)
SELECT DISTINCT ON (email_hash)
       email_hash, event_id, 'legacy_pending', occurred_at, occurred_at + interval '30 days'
FROM newsletter_consent_events
WHERE event_type = 'opt_in_requested'
  AND occurred_at + interval '30 days' > now()
ORDER BY email_hash, occurred_at DESC, event_id DESC
ON CONFLICT DO NOTHING;

ALTER TABLE reply_tokens
  ADD COLUMN message_hash varchar(64)
    CHECK (message_hash IS NULL OR message_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN claim_expires_at timestamptz,
  ADD COLUMN provider_message_id varchar(200),
  ADD COLUMN last_error_code varchar(120);

CREATE INDEX reply_tokens_claim_expires_at_idx
  ON reply_tokens (claim_expires_at)
  WHERE state = 'inflight';

ALTER TABLE reply_tokens
  ADD CONSTRAINT reply_tokens_inflight_claim_check
  CHECK (
    state <> 'inflight'
    OR (message_hash IS NOT NULL AND claim_expires_at IS NOT NULL)
  );

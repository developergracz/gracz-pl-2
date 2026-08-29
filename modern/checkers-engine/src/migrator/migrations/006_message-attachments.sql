-- Gate 14A.3 / V3 migration 006
-- Private-message attachment schema. DDL only.

CREATE TABLE IF NOT EXISTS gracz_message_attachments (
  message_id UUID PRIMARY KEY REFERENCES gracz_messages(message_id) ON DELETE CASCADE,
  file_name VARCHAR(120) NOT NULL,
  storage_name VARCHAR(80),
  mime_type VARCHAR(32) NOT NULL,
  file_size INTEGER NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gracz_message_attachments
  ADD COLUMN IF NOT EXISTS storage_name VARCHAR(80);

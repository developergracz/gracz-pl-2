-- Gate 14A.3 / V3 migration 002
-- Private-message schema. DDL only; no production execution is authorized by this file.

CREATE TABLE IF NOT EXISTS gracz_messages (
  message_id UUID PRIMARY KEY,
  sender_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  recipient_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  recipient_archived BOOLEAN NOT NULL DEFAULT FALSE,
  sender_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  recipient_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE gracz_messages
  ALTER COLUMN subject TYPE TEXT;

CREATE INDEX IF NOT EXISTS gracz_messages_recipient_idx
  ON gracz_messages(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gracz_messages_sender_idx
  ON gracz_messages(sender_id, created_at DESC);

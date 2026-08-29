-- Gate 14A.3 / V3 migration 004
-- Secure-account schema extensions. DDL only.
-- Legacy contact_verified backfill is intentionally NOT included here; it is DML and remains REVIEW.

ALTER TABLE gracz_accounts
  ADD COLUMN IF NOT EXISTS password_hash_version SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE gracz_accounts
  ADD COLUMN IF NOT EXISTS phone VARCHAR(24);

ALTER TABLE gracz_accounts
  ADD COLUMN IF NOT EXISTS verification_channel VARCHAR(10) NOT NULL DEFAULT 'email';

ALTER TABLE gracz_accounts
  ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS gracz_registration_codes (
  user_id VARCHAR(32) PRIMARY KEY REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  code_hash BYTEA NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gracz_password_reset_tokens (
  token_hash BYTEA PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gracz_password_reset_user_idx
  ON gracz_password_reset_tokens(user_id, created_at DESC);

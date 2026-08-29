-- Gate 14A.3 / V3 migration 001
-- Identity baseline. DDL only; no production execution is authorized by this file.

CREATE TABLE IF NOT EXISTS gracz_accounts (
  user_id VARCHAR(32) PRIMARY KEY,
  display_name VARCHAR(40) NOT NULL,
  salt BYTEA NOT NULL,
  password_hash BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gracz_accounts
  ADD COLUMN IF NOT EXISTS email VARCHAR(254);

ALTER TABLE gracz_accounts
  ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(254);

ALTER TABLE gracz_accounts
  ADD COLUMN IF NOT EXISTS profile_data JSONB NOT NULL DEFAULT '{}'::jsonb;

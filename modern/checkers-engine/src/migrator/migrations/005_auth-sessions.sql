-- Gate 14A.3 / V3 migration 005
-- Authentication session registry. DDL only.
-- Runtime cleanup DELETE is intentionally not part of this migration.

CREATE TABLE IF NOT EXISTS gracz_auth_sessions (
  token_id UUID PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE gracz_auth_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS gracz_auth_sessions_user_idx
  ON gracz_auth_sessions(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS gracz_auth_sessions_expiry_idx
  ON gracz_auth_sessions(expires_at);

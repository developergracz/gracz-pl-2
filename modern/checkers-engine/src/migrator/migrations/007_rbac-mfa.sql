CREATE TABLE IF NOT EXISTS gracz_roles(
  user_id VARCHAR(32) PRIMARY KEY REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  role VARCHAR(24) NOT NULL DEFAULT 'player' CHECK(role IN ('player','moderator','administrator','owner')),
  mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gracz_role_history(
  change_id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  old_role VARCHAR(24),
  new_role VARCHAR(24) NOT NULL,
  changed_by VARCHAR(32) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gracz_mfa(
  user_id VARCHAR(32) PRIMARY KEY REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL DEFAULT 'totp',
  secret_iv BYTEA NOT NULL,
  secret_tag BYTEA NOT NULL,
  secret_ciphertext BYTEA NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS gracz_moderation_decisions(
  decision_id UUID PRIMARY KEY,
  user_id VARCHAR(32),
  context VARCHAR(32) NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  reason VARCHAR(64),
  content_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gracz_moderation_appeals(
  appeal_id UUID PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES gracz_moderation_decisions(decision_id) ON DELETE CASCADE,
  user_id VARCHAR(32) NOT NULL,
  explanation TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  reviewed_by VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

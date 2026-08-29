-- Gate 14A.3 / V3 migration 003
-- Persisted checkers/platform game sessions. DDL only.

CREATE TABLE IF NOT EXISTS gracz_game_sessions (
  game_id VARCHAR(128) PRIMARY KEY,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gracz_game_sessions_updated_idx
  ON gracz_game_sessions(updated_at DESC);

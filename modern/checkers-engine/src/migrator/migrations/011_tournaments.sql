CREATE TABLE IF NOT EXISTS gracz_tournaments (
  tournament_id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  game TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'registration',
  visibility TEXT NOT NULL DEFAULT 'public',
  max_players INTEGER NOT NULL DEFAULT 16,
  rounds INTEGER NOT NULL DEFAULT 5,
  time_control TEXT NOT NULL DEFAULT '5+0',
  rated BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NULL,
  current_round INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS gracz_tournaments_status_idx ON gracz_tournaments(status, starts_at);

CREATE TABLE IF NOT EXISTS gracz_tournament_players (
  tournament_id UUID NOT NULL REFERENCES gracz_tournaments(tournament_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  seed INTEGER NOT NULL DEFAULT 0,
  points NUMERIC(6,2) NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  buchholz NUMERIC(8,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS gracz_tournament_matches (
  match_id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES gracz_tournaments(tournament_id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  board INTEGER NOT NULL,
  white_id TEXT NULL,
  white_name TEXT NULL,
  black_id TEXT NULL,
  black_name TEXT NULL,
  result TEXT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  reported_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS gracz_tournament_matches_idx ON gracz_tournament_matches(tournament_id, round, board);

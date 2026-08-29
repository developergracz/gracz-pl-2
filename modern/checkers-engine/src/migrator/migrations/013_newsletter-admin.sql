CREATE TABLE IF NOT EXISTS newsletter_sources(
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  source_type VARCHAR(32) NOT NULL CHECK(source_type IN ('internal','campaign','partner','advertisement','other')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_subscriber_sources(
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT NOT NULL REFERENCES gracz_newsletter_subscribers(id) ON DELETE RESTRICT,
  source_id BIGINT NOT NULL REFERENCES newsletter_sources(id) ON DELETE RESTRICT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  campaign_reference VARCHAR(128),
  partner_reference VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(subscriber_id,source_id)
);

CREATE TABLE IF NOT EXISTS newsletter_consent_history(
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT NOT NULL REFERENCES gracz_newsletter_subscribers(id) ON DELETE RESTRICT,
  consent_type VARCHAR(64) NOT NULL,
  consent_version VARCHAR(64) NOT NULL,
  action VARCHAR(24) NOT NULL CHECK(action IN ('granted','confirmed','revoked')),
  source VARCHAR(64) NOT NULL DEFAULT 'homepage',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS newsletter_consent_subscriber_idx ON newsletter_consent_history(subscriber_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_consent_time_idx ON newsletter_consent_history(occurred_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_consent_type_idx ON newsletter_consent_history(consent_type,action);

CREATE TABLE IF NOT EXISTS newsletter_events(
  id BIGSERIAL PRIMARY KEY,
  subscriber_id BIGINT REFERENCES gracz_newsletter_subscribers(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  source_id BIGINT REFERENCES newsletter_sources(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_hash CHAR(64),
  user_agent_hash CHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS newsletter_events_time_idx ON newsletter_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_events_subscriber_idx ON newsletter_events(subscriber_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_events_type_time_idx ON newsletter_events(event_type,occurred_at DESC);
CREATE INDEX IF NOT EXISTS newsletter_events_source_idx ON newsletter_events(source_id,occurred_at DESC);

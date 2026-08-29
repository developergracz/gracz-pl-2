CREATE TABLE IF NOT EXISTS gracz_newsletter_subscribers(
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  email_normalized VARCHAR(254) NOT NULL UNIQUE,
  preferred_nick VARCHAR(24),
  preferred_nick_normalized VARCHAR(24),
  consent_version VARCHAR(64) NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(32) NOT NULL DEFAULT 'pending_confirmation',
  confirmation_token_hash BYTEA,
  confirmation_expires_at TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  position_token_hash BYTEA,
  unsubscribe_token_hash BYTEA,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS preferred_nick VARCHAR(24);
ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS preferred_nick_normalized VARCHAR(24);
ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_token_hash BYTEA;
ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ;
ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;
ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS position_token_hash BYTEA;
ALTER TABLE gracz_newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token_hash BYTEA;

CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_id_unique ON gracz_newsletter_subscribers(id);
DROP INDEX IF EXISTS gracz_newsletter_preferred_nick_unique;
CREATE UNIQUE INDEX IF NOT EXISTS gracz_newsletter_preferred_nick_unique_v2 ON gracz_newsletter_subscribers(preferred_nick_normalized) WHERE preferred_nick_normalized IS NOT NULL AND status IN ('pending_confirmation','subscribed');
CREATE INDEX IF NOT EXISTS gracz_newsletter_confirmation_hash_idx ON gracz_newsletter_subscribers(confirmation_token_hash) WHERE confirmation_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS gracz_newsletter_position_hash_idx ON gracz_newsletter_subscribers(position_token_hash) WHERE position_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS gracz_newsletter_unsubscribe_hash_idx ON gracz_newsletter_subscribers(unsubscribe_token_hash) WHERE unsubscribe_token_hash IS NOT NULL;

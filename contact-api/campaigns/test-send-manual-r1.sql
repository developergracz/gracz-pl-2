-- MANUAL HOLD: never added to automatic migrations.
-- Apply only with an explicit OWNER database release, after a verified backup.
-- Test sends are addressed ONLY to CONTACT_TO (configured private operator).
-- No bulk dispatch, recipient addresses or consent state are stored here.
CREATE TABLE newsletter_campaigns.test_attempts (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES newsletter_campaigns.campaigns(id),
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  state varchar(12) NOT NULL DEFAULT 'inflight'
    CHECK (state IN ('inflight','accepted','uncertain')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  provider_message_id varchar(128),
  UNIQUE (campaign_id,content_sha256),
  CHECK (state <> 'accepted' OR provider_message_id IS NOT NULL)
);
REVOKE ALL ON TABLE newsletter_campaigns.test_attempts FROM PUBLIC;
-- Review API role SELECT/INSERT/UPDATE grants explicitly at release time.
-- Never DELETE, retry an uncertain attempt or expose this schema publicly.

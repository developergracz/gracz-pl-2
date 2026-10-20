-- Campaigns R1 schema CANDIDATE. NOT wired to automatic production migrations.
-- Apply only in an approved release after backup and verified consent safeguards.
CREATE SCHEMA newsletter_campaigns;
REVOKE ALL ON SCHEMA newsletter_campaigns FROM PUBLIC;

CREATE TABLE newsletter_campaigns.campaigns (
  id uuid PRIMARY KEY,
  subject varchar(160) NOT NULL CHECK (length(subject) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (length(body) BETWEEN 10 AND 20000),
  audience varchar(40) NOT NULL
    CHECK (audience = 'confirmed_active_new_only'),
  state varchar(16) NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','approved','sending','completed','paused')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  CHECK ((state = 'draft' AND approved_at IS NULL) OR
         (state <> 'draft' AND approved_at IS NOT NULL))
);

CREATE TABLE newsletter_campaigns.dispatches (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES newsletter_campaigns.campaigns(id),
  -- An irreversible pseudonymous recipient reference, never a clear address.
  email_tag char(64) NOT NULL CHECK (email_tag ~ '^[0-9a-f]{64}$'),
  state varchar(16) NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved','inflight','uncertain','accepted','suppressed')),
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (campaign_id,email_tag),
  CHECK ((state='reserved' AND attempted_at IS NULL) OR
         (state IN ('inflight','uncertain','accepted') AND attempted_at IS NOT NULL) OR
         state='suppressed')
);
CREATE INDEX dispatches_by_campaign_state
  ON newsletter_campaigns.dispatches(campaign_id,state);
-- The application must use durable compare-and-set transitions.
-- Unknown send effects are permanently held for operator reconciliation.
-- No automatic timeout-based release or retry after an external attempt.

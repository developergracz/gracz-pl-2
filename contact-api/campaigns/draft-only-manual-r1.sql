-- RELEASE CANDIDATE: OWNER draft storage ONLY. Manual, approved application.
-- Not in automatic migrations. No dispatch tables, privileges for sending or mail.
-- Run once in a reviewed transaction using the migration/owner DB role.
CREATE SCHEMA IF NOT EXISTS newsletter_campaigns;
REVOKE ALL ON SCHEMA newsletter_campaigns FROM PUBLIC;
CREATE TABLE IF NOT EXISTS newsletter_campaigns.campaigns (
  id uuid PRIMARY KEY,
  subject varchar(160) NOT NULL CHECK (length(subject) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (length(body) BETWEEN 10 AND 20000),
  audience varchar(40) NOT NULL CHECK (audience = 'confirmed_active_new_only'),
  state varchar(16) NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','approved','sending','completed','paused')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  approved_at timestamptz,
  CHECK ((state = 'draft' AND approved_at IS NULL) OR
         (state <> 'draft' AND approved_at IS NOT NULL))
);
REVOKE ALL ON TABLE newsletter_campaigns.campaigns FROM PUBLIC;
-- No GRANT statements: production role privileges must be reviewed separately.

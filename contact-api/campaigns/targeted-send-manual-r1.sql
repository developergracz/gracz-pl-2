-- MANUAL RELEASE: apply once AFTER backup using the existing OWNER production
-- database release process. Not part of automatic contact-API migrations.
-- Immutable small, explicit OWNER recipient scopes. Never store plaintext addresses.
BEGIN;
CREATE TABLE newsletter_campaigns.targeted_audiences (
  campaign_id uuid PRIMARY KEY REFERENCES newsletter_campaigns.campaigns(id),
  email_tags text[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT target_count_limit CHECK (cardinality(email_tags) BETWEEN 1 AND 10),
  CONSTRAINT valid_tags CHECK (
    array_to_string(email_tags,'') ~ '^[0-9a-f]+$'
    AND length(array_to_string(email_tags,'')) = 64*cardinality(email_tags)
  )
);
CREATE TRIGGER targeted_audiences_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE
ON newsletter_campaigns.targeted_audiences
FOR EACH STATEMENT EXECUTE FUNCTION newsletter_campaigns.deny_event_mutation();
REVOKE ALL ON newsletter_campaigns.targeted_audiences FROM PUBLIC;
-- Grant SELECT,INSERT to the current production application role only,
-- following the existing deployment's least-privilege role review.
COMMIT;

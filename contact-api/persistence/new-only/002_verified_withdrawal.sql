-- New-only verified opt-out bridge. Do not import or mutate legacy consent.
-- Apply after the existing backup/PITR gate, only after 001_new_only_doi.sql.
CREATE TABLE newsletter_new.revocations (
  email_tag char(64) PRIMARY KEY REFERENCES newsletter_new.subscribers(email_tag),
  challenge_id uuid NOT NULL UNIQUE,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER revocations_immutable
BEFORE UPDATE OR DELETE ON newsletter_new.revocations
FOR EACH ROW EXECUTE FUNCTION newsletter_new.reject_mutation();
CREATE TRIGGER revocations_no_truncate
BEFORE TRUNCATE ON newsletter_new.revocations
FOR EACH STATEMENT EXECUTE FUNCTION newsletter_new.reject_mutation();

-- API service role: SELECT and INSERT on newsletter_new.revocations.
-- No UPDATE, DELETE, TRUNCATE, legacy imports or marketing egress.

-- UNNUMBERED REVIEW PROPOSAL, NOT SCANNED BY MIGRATOR. Production: HARD HOLD.
-- Only for an installation that already has the R3 candidate table. Preserve
-- historical registry/checksums; allocate a NEW migration identity separately.
-- All old newsletter writers MUST be stopped before this transaction/cutover.
ALTER TABLE newsletter_opt_in_requests
  DROP CONSTRAINT newsletter_opt_in_requests_state_check;
ALTER TABLE newsletter_opt_in_requests
  ADD CONSTRAINT newsletter_opt_in_requests_state_check
  CHECK (state IN ('pre_send','inflight','unknown','sent','legacy_pending'));
ALTER TABLE newsletter_opt_in_requests ALTER COLUMN state SET DEFAULT 'pre_send';
-- Existing inflight/unknown rows deliberately remain unchanged and parked.

-- Additive, lock-bounded state marker for each verified opt-out after a fresh DOI.
-- The first immutable revocation stays in newsletter_new.revocations;
-- the full verification history stays in newsletter_recovery.
-- Apply in a backed-up SQL transaction BEFORE deploying code that reads it.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE newsletter_new.subscribers
  ADD COLUMN IF NOT EXISTS repeat_withdrawn_at timestamptz;
-- Deliberately no historical inference or backfill: only a NEW verified
-- mailbox withdrawal can set this field.

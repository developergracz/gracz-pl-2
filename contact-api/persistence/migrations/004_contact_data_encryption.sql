ALTER TABLE contact_cases
  ADD COLUMN subject_ciphertext text,
  ADD COLUMN source_path_ciphertext text;

-- EXPAND phase only: keep legacy inserts compatible during the deployment window.
-- New code writes encrypted c1 envelopes. Redaction and strict constraints
-- are intentionally deferred to a separate contract migration after the new
-- encrypted writer is confirmed live in production.

ALTER TABLE contact_cases
  ADD COLUMN subject_ciphertext text,
  ADD COLUMN source_path_ciphertext text;

-- Legacy rows predate application-layer encryption. Their plaintext metadata is
-- deliberately redacted because no production workflow needs to recover it.
UPDATE contact_cases
SET subject = '[legacy-redacted]',
    source_path = ''
WHERE subject_ciphertext IS NULL;

ALTER TABLE contact_cases
  ADD CONSTRAINT contact_cases_encrypted_subject_required
  CHECK (
    subject = '[legacy-redacted]'
    OR (
      subject = '[encrypted]'
      AND subject_ciphertext IS NOT NULL
      AND subject_ciphertext LIKE 'c1.%'
    )
  );

ALTER TABLE contact_cases
  ADD CONSTRAINT contact_cases_encrypted_source_required
  CHECK (
    subject = '[legacy-redacted]'
    OR (
      subject = '[encrypted]'
      AND source_path = ''
      AND source_path_ciphertext IS NOT NULL
      AND source_path_ciphertext LIKE 'c1.%'
    )
  );

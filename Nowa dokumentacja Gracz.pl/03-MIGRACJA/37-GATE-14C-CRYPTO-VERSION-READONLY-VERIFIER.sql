-- ETAP 3 / Gate 14C
-- READ-ONLY CRYPTO VERSION INVENTORY / RECONCILIATION
-- STATUS: DESIGN ARTIFACT / RUN ONLY AFTER migration 015 exists
--
-- This collector NEVER selects ciphertext, IV, auth tags, plaintext or secrets.
-- It reports counts/version consistency only.

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

-- 1. Private messages — version is embedded independently in subject/body.
SELECT
  COUNT(*)::int AS messages_total,
  COUNT(*) FILTER (
    WHERE subject LIKE 'enc:v1:%' AND body LIKE 'enc:v1:%'
  )::int AS messages_v1_consistent,
  COUNT(*) FILTER (
    WHERE subject LIKE 'enc:v2:%' AND body LIKE 'enc:v2:%'
  )::int AS messages_v2_consistent,
  COUNT(*) FILTER (
    WHERE subject LIKE 'enc:v1:%' AND body LIKE 'enc:v2:%'
       OR subject LIKE 'enc:v2:%' AND body LIKE 'enc:v1:%'
  )::int AS messages_mixed_version,
  COUNT(*) FILTER (
    WHERE subject NOT LIKE 'enc:v1:%'
      AND subject NOT LIKE 'enc:v2:%'
  )::int AS subject_legacy_plain_or_unknown,
  COUNT(*) FILTER (
    WHERE body NOT LIKE 'enc:v1:%'
      AND body NOT LIKE 'enc:v2:%'
  )::int AS body_legacy_plain_or_unknown,
  COUNT(*) FILTER (
    WHERE subject LIKE 'enc:v%:%'
      AND subject NOT LIKE 'enc:v1:%'
      AND subject NOT LIKE 'enc:v2:%'
  )::int AS subject_unknown_version,
  COUNT(*) FILTER (
    WHERE body LIKE 'enc:v%:%'
      AND body NOT LIKE 'enc:v1:%'
      AND body NOT LIKE 'enc:v2:%'
  )::int AS body_unknown_version
FROM public.gracz_messages;

-- Target after controlled rekey:
-- messages_v1_consistent=0
-- messages_mixed_version=0
-- unknown_version=0
-- messages_v2_consistent = encrypted message total
-- any legacy plaintext must be separately classified, never silently re-labelled.

-- 2. Attachments — version is a schema column after proposed migration 015.
SELECT
  COUNT(*)::int AS attachments_total,
  COUNT(*) FILTER (WHERE key_version = 1)::int AS attachments_v1,
  COUNT(*) FILTER (WHERE key_version = 2)::int AS attachments_v2,
  COUNT(*) FILTER (WHERE key_version IS NULL OR key_version NOT IN (1,2))::int AS attachments_invalid_version
FROM public.gracz_message_attachments;

-- Target after rekey: v1=0, invalid=0, v2=total.

-- 3. MFA
SELECT
  COUNT(*)::int AS mfa_total,
  COUNT(*) FILTER (WHERE key_version = 1)::int AS mfa_v1,
  COUNT(*) FILTER (WHERE key_version = 2)::int AS mfa_v2,
  COUNT(*) FILTER (WHERE key_version IS NULL OR key_version NOT IN (1,2))::int AS mfa_invalid_version
FROM public.gracz_mfa;

-- Current fresh evidence before Gate 14C: MFA rows=0.
-- Target for any newly created rows after v2 switch: key_version=2 only.

-- 4. Consistency-only attachment metadata check; no sensitive payload selected.
SELECT
  COUNT(*) FILTER (WHERE key_version = 2 AND storage_name IS NULL)::int AS v2_attachment_missing_storage_name,
  COUNT(*) FILTER (WHERE file_size <= 0)::int AS invalid_file_size_rows
FROM public.gracz_message_attachments;

COMMIT;

-- This SQL proves version inventory only.
-- Final Gate 14C requires a separate application-layer decryptability probe using
-- the keyring that reports booleans/counts/fingerprints only, never plaintext or keys.

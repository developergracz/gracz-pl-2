-- ETAP 3 / Gate 14C
-- PROPOSED MIGRATION 015: crypto key version metadata
-- STATUS: DESIGN ONLY / DO NOT EXECUTE / NOT YET IN ACTIVE MIGRATOR DIRECTORY
--
-- This proposal must only be promoted into
-- modern/checkers-engine/src/migrator/migrations/015_crypto-key-versions.sql
-- together with reviewed keyring code and tests.
--
-- SAFETY RULE:
-- DEFAULT MUST REMAIN 1 during compatibility stage. Old runtime encrypts v1 and
-- does not provide key_version. A default of 2 before all writers are upgraded
-- would mislabel v1 ciphertext as v2 and break decryptability.

-- 1. Attachments: existing rows are v1 by construction.
ALTER TABLE public.gracz_message_attachments
  ADD COLUMN IF NOT EXISTS key_version SMALLINT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.gracz_message_attachments'::regclass
      AND conname = 'gracz_message_attachments_key_version_check'
  ) THEN
    ALTER TABLE public.gracz_message_attachments
      ADD CONSTRAINT gracz_message_attachments_key_version_check
      CHECK (key_version IN (1, 2));
  END IF;
END
$$;

-- 2. MFA: current production evidence has 0 rows, but default=1 preserves
-- restore/backward compatibility if an older snapshot contains v1 MFA data.
ALTER TABLE public.gracz_mfa
  ADD COLUMN IF NOT EXISTS key_version SMALLINT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.gracz_mfa'::regclass
      AND conname = 'gracz_mfa_key_version_check'
  ) THEN
    ALTER TABLE public.gracz_mfa
      ADD CONSTRAINT gracz_mfa_key_version_check
      CHECK (key_version IN (1, 2));
  END IF;
END
$$;

-- 3. Private messages require no schema column because subject/body payloads
-- already carry an explicit version prefix: enc:v1: / proposed enc:v2:.
-- Subject and body must be rekeyed atomically in one transaction per message.

-- 4. DO NOT change column defaults to 2 in this migration.
-- V2-capable runtime must write key_version=2 explicitly.
-- A later forward migration may change defaults only after:
--   - every writer understands v2,
--   - CRYPTO_WRITE_VERSION=2 is enforced,
--   - rollback build also understands v2,
--   - Gate 14C fresh evidence is PASS.

-- 5. No ciphertext DML is included here.
-- Rekeying requires application-layer AES-GCM decrypt+encrypt with secrets and
-- therefore must be performed by a separate controlled maintenance tool, not SQL.

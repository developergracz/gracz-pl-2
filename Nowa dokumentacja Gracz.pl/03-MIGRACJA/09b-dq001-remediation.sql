\pset pager off
\echo '=== DQ-001 REMEDIATION — REVIEW ONLY / DO NOT RUN ON PRODUCTION ==='
\echo 'Decision: LEGACY-QUARANTINE. This artifact intentionally performs NO DML.'

BEGIN TRANSACTION READ ONLY;

-- Exact evidence row expected from collector/drill-down.
SELECT relation_id, requester_id, addressee_id, status, created_at, updated_at
FROM public.gracz_chat_friends
WHERE relation_id='5c239839-cfe5-4ca0-bf89-78eedbe127bd'::uuid;

-- Safety assertions represented as review queries.
SELECT count(*) AS exact_target_rows
FROM public.gracz_chat_friends
WHERE relation_id='5c239839-cfe5-4ca0-bf89-78eedbe127bd'::uuid
  AND requester_id='guest-24ea096d'
  AND addressee_id='graczpl';

SELECT count(*) AS requester_account_rows
FROM public.gracz_accounts WHERE user_id='guest-24ea096d';

-- No UPDATE/DELETE/INSERT is authorized here.
-- Future implementation must quarantine/exclude the row from active Social V3 backfill,
-- preserve provenance, and reject ephemeral guest principals at persistent Social writers.

ROLLBACK;
\echo '=== DQ-001 REVIEW END — NO DATA CHANGED ==='
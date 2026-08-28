\pset pager off
\echo '=== DML REMEDIATION POSTCHECK — READ ONLY ==='
BEGIN TRANSACTION READ ONLY;

-- DQ-001 remains traceable until a separately authorized mutation exists.
SELECT count(*) AS dq001_target_rows
FROM public.gracz_chat_friends
WHERE relation_id='5c239839-cfe5-4ca0-bf89-78eedbe127bd'::uuid;

-- DQ-002 collision footprint. During planning/no-op phase expected result remains 2 groups / 5 accounts.
WITH n AS (
 SELECT user_id,lower(trim(email)) normalized_email FROM public.gracz_accounts
 WHERE email IS NOT NULL AND btrim(email)<>''
), g AS (
 SELECT normalized_email,count(*) account_count FROM n GROUP BY normalized_email HAVING count(*)>1
)
SELECT md5(g.normalized_email) normalized_email_hash,g.account_count,
 string_agg(n.user_id,', ' ORDER BY n.user_id) account_ids
FROM g JOIN n USING(normalized_email)
WHERE n.user_id IN ('gamerpl','gamerde','gracz.pl','gamerpolska','gamer')
GROUP BY g.normalized_email,g.account_count ORDER BY normalized_email_hash;

-- Ensure all five identity records still exist before a later migration/backfill decision.
SELECT count(*) AS legacy_test_identity_count
FROM public.gracz_accounts
WHERE user_id IN ('gamerpl','gamerde','gracz.pl','gamerpolska','gamer');

ROLLBACK;
\echo '=== POSTCHECK END — NO DATA CHANGED ==='
\pset pager off
\echo '=== ETAP 3 / DML REMEDIATION PRECHECK — READ ONLY ==='
BEGIN TRANSACTION READ ONLY;

SELECT now() AS captured_at, current_database() AS database_name, current_user,
       current_setting('server_version') AS server_version;

\echo '--- DQ-001 orphan friendship expected footprint ---'
SELECT relation_id, requester_id, addressee_id, status, created_at, updated_at
FROM public.gracz_chat_friends
WHERE relation_id='5c239839-cfe5-4ca0-bf89-78eedbe127bd'::uuid;

\echo '--- DQ-002 five legacy/test identities — privacy-safe ---'
WITH targets(user_id) AS (VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer'))
SELECT a.user_id, md5(lower(trim(a.email))) AS normalized_email_hash,
       a.created_at, a.contact_verified, a.verification_channel, a.account_role, a.mfa_required
FROM public.gracz_accounts a JOIN targets t USING(user_id)
ORDER BY a.user_id;

\echo '--- DQ-002 dependency counts ---'
WITH targets(user_id) AS (VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer'))
SELECT t.user_id,
 (SELECT count(*) FROM public.gracz_auth_sessions x WHERE x.user_id=t.user_id) auth_sessions,
 (SELECT count(*) FROM public.gracz_messages x WHERE x.sender_id=t.user_id OR x.recipient_id=t.user_id) messages,
 (SELECT count(*) FROM public.gracz_password_reset_tokens x WHERE x.user_id=t.user_id) reset_tokens,
 (SELECT count(*) FROM public.gracz_registration_codes x WHERE x.user_id=t.user_id) registration_codes,
 (SELECT count(*) FROM public.gracz_chat_friends x WHERE x.requester_id=t.user_id OR x.addressee_id=t.user_id) friendships,
 (SELECT count(*) FROM public.gracz_global_chat x WHERE x.user_id=t.user_id) global_chat,
 (SELECT count(*) FROM public.gracz_tournament_players x WHERE x.user_id=t.user_id) tournament_rows
FROM targets t ORDER BY t.user_id;

\echo '--- normalized-email collision recheck ---'
WITH n AS (
 SELECT user_id, lower(trim(email)) normalized_email FROM public.gracz_accounts
 WHERE email IS NOT NULL AND btrim(email)<>''
), g AS (
 SELECT normalized_email,count(*) account_count FROM n GROUP BY normalized_email HAVING count(*)>1
)
SELECT md5(g.normalized_email) normalized_email_hash,g.account_count,
       string_agg(n.user_id,', ' ORDER BY n.user_id) account_ids
FROM g JOIN n USING(normalized_email)
WHERE n.user_id IN ('gamerpl','gamerde','gracz.pl','gamerpolska','gamer')
GROUP BY g.normalized_email,g.account_count ORDER BY normalized_email_hash;

ROLLBACK;
\echo '=== PRECHECK END — NO DATA CHANGED ==='
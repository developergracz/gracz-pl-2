\pset pager off
\echo '=== DQ-002 REMEDIATION — REVIEW ONLY / LEGACY-IDENTITY TEST ==='
\echo 'All five identities are business-confirmed TEST. This artifact intentionally performs NO DML.'

BEGIN TRANSACTION READ ONLY;

WITH targets(user_id) AS (
 VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT a.user_id, md5(lower(trim(a.email))) normalized_email_hash,
       a.created_at,a.contact_verified,a.verification_channel,a.account_role,a.mfa_required
FROM public.gracz_accounts a JOIN targets t USING(user_id)
ORDER BY a.user_id;

-- Reconfirm dependency footprint before any future remediation implementation.
WITH targets(user_id) AS (VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer'))
SELECT t.user_id,
 (SELECT count(*) FROM public.gracz_auth_sessions x WHERE x.user_id=t.user_id) auth_sessions,
 (SELECT count(*) FROM public.gracz_messages x WHERE x.sender_id=t.user_id OR x.recipient_id=t.user_id) messages,
 (SELECT count(*) FROM public.gracz_password_reset_tokens x WHERE x.user_id=t.user_id) reset_tokens,
 (SELECT count(*) FROM public.gracz_registration_codes x WHERE x.user_id=t.user_id) registration_codes,
 (SELECT count(*) FROM public.gracz_mfa x WHERE x.user_id=t.user_id) mfa_rows,
 (SELECT count(*) FROM public.gracz_roles x WHERE x.user_id=t.user_id) role_rows,
 (SELECT count(*) FROM public.gracz_chat_friends x WHERE x.requester_id=t.user_id OR x.addressee_id=t.user_id) friendships,
 (SELECT count(*) FROM public.gracz_global_chat x WHERE x.user_id=t.user_id) global_chat,
 (SELECT count(*) FROM public.gracz_tournament_players x WHERE x.user_id=t.user_id) tournament_rows
FROM targets t ORDER BY t.user_id;

-- Decision record:
-- gamerpl/gamerde/gracz.pl/gamerpolska/gamer = LEGACY-IDENTITY / TEST.
-- KEEP-CANONICAL = not required for active production identity.
-- REQUIRE-EMAIL-CHANGE = not required for these test identities.
-- MERGE = prohibited.
-- Automatic DELETE = prohibited.
-- gracz.pl message history and all audit/session/recovery/newsletter provenance must be preserved.
-- No UPDATE/DELETE/INSERT is authorized by this artifact.

ROLLBACK;
\echo '=== DQ-002 REVIEW END — NO DATA CHANGED ==='
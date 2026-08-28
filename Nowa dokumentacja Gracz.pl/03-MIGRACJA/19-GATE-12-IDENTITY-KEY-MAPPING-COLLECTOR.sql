\pset pager off
\echo '=== GATE 12 IDENTITY / KEY MAPPING READINESS START ==='
\echo 'READ ONLY. No raw email, password hash, salt, token, code, MFA secret or message content output.'

BEGIN TRANSACTION READ ONLY;

SELECT now() AS captured_at,
       current_database() AS database_name,
       current_user,
       current_setting('server_version') AS server_version;

\echo ''
\echo '=== A. SOURCE SET / QUARANTINE RECONCILIATION ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  COUNT(*) AS accounts_total,
  COUNT(*) FILTER (WHERE q.user_id IS NOT NULL) AS dq002_quarantine_present,
  COUNT(*) FILTER (WHERE q.user_id IS NULL) AS canonical_candidates
FROM public.gracz_accounts a
LEFT JOIN quarantine q USING(user_id);

\echo ''
\echo '=== B. CANONICAL USER_ID / USERNAME READINESS ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
), candidates AS (
  SELECT a.*
  FROM public.gracz_accounts a
  LEFT JOIN quarantine q USING(user_id)
  WHERE q.user_id IS NULL
), norm AS (
  SELECT lower(trim(user_id)) AS username_normalized, COUNT(*) AS c
  FROM candidates
  GROUP BY lower(trim(user_id))
)
SELECT
  (SELECT COUNT(*) FROM candidates) AS candidate_count,
  (SELECT COUNT(*) FROM candidates
    WHERE user_id IS NULL
       OR btrim(user_id)=''
       OR user_id !~ '^[a-z0-9._-]{3,32}$'
       OR user_id <> lower(user_id)) AS invalid_or_noncanonical_user_id,
  (SELECT COUNT(*) FROM norm WHERE c>1) AS normalized_username_collision_groups,
  (SELECT COALESCE(SUM(c),0) FROM norm WHERE c>1) AS normalized_username_collision_accounts;

\echo ''
\echo '=== C. CANONICAL EMAIL READINESS ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
), candidates AS (
  SELECT a.*
  FROM public.gracz_accounts a
  LEFT JOIN quarantine q USING(user_id)
  WHERE q.user_id IS NULL
), normalized AS (
  SELECT lower(trim(email)) AS email_normalized, COUNT(*) AS c
  FROM candidates
  WHERE email IS NOT NULL AND btrim(email)<>''
  GROUP BY lower(trim(email))
)
SELECT
  (SELECT COUNT(*) FROM candidates WHERE email IS NULL OR btrim(email)='') AS candidate_blank_email,
  (SELECT COUNT(*) FROM normalized WHERE c>1) AS normalized_email_collision_groups,
  (SELECT COALESCE(SUM(c),0) FROM normalized WHERE c>1) AS normalized_email_collision_accounts;

\echo ''
\echo '=== D. PASSWORD ENVELOPE READINESS ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
), candidates AS (
  SELECT a.*
  FROM public.gracz_accounts a
  LEFT JOIN quarantine q USING(user_id)
  WHERE q.user_id IS NULL
)
SELECT
  COUNT(*) AS candidate_count,
  COUNT(*) FILTER (WHERE password_hash_version=1) AS hash_version_1,
  COUNT(*) FILTER (WHERE password_hash_version=2) AS hash_version_2,
  COUNT(*) FILTER (WHERE password_hash_version NOT IN (1,2) OR password_hash_version IS NULL) AS unsupported_hash_version,
  COUNT(*) FILTER (WHERE salt IS NULL OR octet_length(salt)<>16) AS invalid_salt_shape,
  COUNT(*) FILTER (WHERE password_hash IS NULL OR octet_length(password_hash)<>64) AS invalid_hash_shape
FROM candidates;

\echo ''
\echo '=== E. INITIAL STATUS MAPPING ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  COUNT(*) FILTER (WHERE q.user_id IS NULL AND a.contact_verified=TRUE) AS candidate_to_active,
  COUNT(*) FILTER (WHERE q.user_id IS NULL AND a.contact_verified=FALSE) AS candidate_to_pending,
  COUNT(*) FILTER (WHERE q.user_id IS NOT NULL AND a.contact_verified=TRUE) AS quarantine_verified,
  COUNT(*) FILTER (WHERE q.user_id IS NOT NULL AND a.contact_verified=FALSE) AS quarantine_unverified
FROM public.gracz_accounts a
LEFT JOIN quarantine q USING(user_id);

\echo ''
\echo '=== F. AUTH SESSION CUTOVER STATE ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  COUNT(*) AS sessions_total,
  COUNT(*) FILTER (WHERE s.revoked_at IS NULL AND s.expires_at>NOW()) AS sessions_active_now,
  COUNT(*) FILTER (WHERE q.user_id IS NULL AND s.revoked_at IS NULL AND s.expires_at>NOW()) AS candidate_sessions_active_now,
  COUNT(*) FILTER (WHERE q.user_id IS NOT NULL AND s.revoked_at IS NULL AND s.expires_at>NOW()) AS quarantine_sessions_active_now
FROM public.gracz_auth_sessions s
LEFT JOIN quarantine q ON q.user_id=s.user_id;

\echo ''
\echo '=== G. PASSWORD RESET CUTOVER STATE ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  COUNT(*) AS reset_tokens_total,
  COUNT(*) FILTER (WHERE r.used_at IS NULL AND r.expires_at>NOW()) AS reset_tokens_active_now,
  COUNT(*) FILTER (WHERE q.user_id IS NULL AND r.used_at IS NULL AND r.expires_at>NOW()) AS candidate_reset_tokens_active_now,
  COUNT(*) FILTER (WHERE q.user_id IS NOT NULL AND r.used_at IS NULL AND r.expires_at>NOW()) AS quarantine_reset_tokens_active_now
FROM public.gracz_password_reset_tokens r
LEFT JOIN quarantine q ON q.user_id=r.user_id;

\echo ''
\echo '=== H. REGISTRATION CODE CUTOVER STATE ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  COUNT(*) AS registration_codes_total,
  COUNT(*) FILTER (WHERE r.expires_at>NOW() AND r.attempts<5) AS registration_codes_active_now,
  COUNT(*) FILTER (WHERE q.user_id IS NULL AND r.expires_at>NOW() AND r.attempts<5) AS candidate_registration_codes_active_now,
  COUNT(*) FILTER (WHERE q.user_id IS NOT NULL AND r.expires_at>NOW() AND r.attempts<5) AS quarantine_registration_codes_active_now
FROM public.gracz_registration_codes r
LEFT JOIN quarantine q ON q.user_id=r.user_id;

\echo ''
\echo '=== I. MFA READINESS ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  COUNT(*) AS mfa_total,
  COUNT(*) FILTER (WHERE q.user_id IS NULL) AS candidate_mfa_rows,
  COUNT(*) FILTER (WHERE q.user_id IS NOT NULL) AS quarantine_mfa_rows
FROM public.gracz_mfa m
LEFT JOIN quarantine q ON q.user_id=m.user_id;

\echo ''
\echo '=== J. CURRENT ROLE READINESS ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  COUNT(*) AS current_role_rows,
  COUNT(*) FILTER (WHERE r.role NOT IN ('player','moderator','administrator','owner')) AS unknown_role_values,
  COUNT(*) FILTER (WHERE q.user_id IS NULL) AS candidate_role_rows,
  COUNT(*) FILTER (WHERE q.user_id IS NOT NULL) AS quarantine_role_rows,
  COUNT(*) FILTER (WHERE r.role IN ('moderator','administrator','owner')) AS privileged_role_rows
FROM public.gracz_roles r
LEFT JOIN quarantine q ON q.user_id=r.user_id;

\echo ''
\echo '=== K. ROLE HISTORY FOOTPRINT ==='
SELECT
  (SELECT COUNT(*) FROM public.gracz_role_history) AS role_history_rows,
  (SELECT COUNT(*) FROM public.gracz_role_changes) AS role_change_rows;

\echo ''
\echo '=== L. QUARANTINED IDENTITY HISTORICAL REFERENCES ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  (SELECT COUNT(*) FROM public.gracz_messages m
    WHERE m.sender_id IN (SELECT user_id FROM quarantine)
       OR m.recipient_id IN (SELECT user_id FROM quarantine)) AS private_message_rows,
  (SELECT COUNT(*) FROM public.gracz_audit_log a
    WHERE a.actor_id IN (SELECT user_id FROM quarantine)
       OR a.target_id IN (SELECT user_id FROM quarantine)) AS audit_rows,
  (SELECT COUNT(*) FROM public.gracz_auth_sessions s
    WHERE s.user_id IN (SELECT user_id FROM quarantine)) AS session_rows,
  (SELECT COUNT(*) FROM public.gracz_password_reset_tokens r
    WHERE r.user_id IN (SELECT user_id FROM quarantine)) AS reset_rows,
  (SELECT COUNT(*) FROM public.gracz_registration_codes r
    WHERE r.user_id IN (SELECT user_id FROM quarantine)) AS registration_rows;

\echo ''
\echo '=== M. DQ-002 QUARANTINE CONSISTENCY ==='
WITH quarantine(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
), normalized AS (
  SELECT a.user_id, lower(trim(a.email)) AS normalized_email
  FROM public.gracz_accounts a
  JOIN quarantine q USING(user_id)
), groups AS (
  SELECT normalized_email, COUNT(*) AS c
  FROM normalized
  GROUP BY normalized_email
)
SELECT
  (SELECT COUNT(*) FROM normalized) AS quarantine_accounts_present,
  (SELECT COUNT(*) FROM groups WHERE c>1) AS quarantine_collision_groups,
  (SELECT COALESCE(SUM(c),0) FROM groups WHERE c>1) AS quarantine_accounts_in_collision_groups;

ROLLBACK;

\echo ''
\echo '=== GATE 12 IDENTITY / KEY MAPPING READINESS END ==='

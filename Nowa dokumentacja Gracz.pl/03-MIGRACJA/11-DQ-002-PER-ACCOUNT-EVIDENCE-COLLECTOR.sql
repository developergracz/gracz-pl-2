\pset pager off
\echo '=== DQ-002 PER-ACCOUNT EVIDENCE START ==='
\echo 'Read-only, privacy-safe. No raw email, message body, token, code, IP or secret output.'

BEGIN TRANSACTION READ ONLY;

SELECT now() AS captured_at,
       current_database() AS database_name,
       current_user,
       current_setting('server_version') AS server_version;

\echo ''
\echo '=== A. TARGET ACCOUNTS / IDENTITY METADATA ==='
\echo 'No raw email. normalized_email_hash is correlation-only.'

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  a.user_id,
  md5(lower(trim(a.email))) AS normalized_email_hash,
  a.created_at,
  a.contact_verified,
  a.verification_channel,
  a.account_role,
  a.mfa_required
FROM public.gracz_accounts a
JOIN targets t USING (user_id)
ORDER BY a.created_at, a.user_id;

\echo ''
\echo '=== B. AUTH SESSION EVIDENCE ==='

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  t.user_id,
  COUNT(s.*) AS auth_sessions_total,
  COUNT(*) FILTER (WHERE s.revoked_at IS NULL AND s.expires_at > now()) AS auth_sessions_active_now,
  MIN(s.created_at) AS first_session_created_at,
  MAX(s.created_at) AS last_session_created_at,
  MAX(s.expires_at) AS max_session_expires_at
FROM targets t
LEFT JOIN public.gracz_auth_sessions s ON s.user_id=t.user_id
GROUP BY t.user_id
ORDER BY t.user_id;

\echo ''
\echo '=== C. PRIVATE MESSAGING / ATTACHMENTS ==='

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  t.user_id,
  (SELECT COUNT(*) FROM public.gracz_messages m WHERE m.sender_id=t.user_id) AS messages_sent,
  (SELECT COUNT(*) FROM public.gracz_messages m WHERE m.recipient_id=t.user_id) AS messages_received,
  (SELECT MIN(m.created_at) FROM public.gracz_messages m WHERE m.sender_id=t.user_id OR m.recipient_id=t.user_id) AS first_message_at,
  (SELECT MAX(m.created_at) FROM public.gracz_messages m WHERE m.sender_id=t.user_id OR m.recipient_id=t.user_id) AS last_message_at,
  (SELECT COUNT(*)
     FROM public.gracz_message_attachments a
     JOIN public.gracz_messages m ON m.message_id=a.message_id
    WHERE m.sender_id=t.user_id OR m.recipient_id=t.user_id) AS attachment_rows
FROM targets t
ORDER BY t.user_id;

\echo ''
\echo '=== D. RECOVERY / REGISTRATION / MFA / ROLE FOOTPRINT ==='

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  t.user_id,
  (SELECT COUNT(*) FROM public.gracz_password_reset_tokens r WHERE r.user_id=t.user_id) AS reset_tokens,
  (SELECT COUNT(*) FROM public.gracz_registration_codes r WHERE r.user_id=t.user_id) AS registration_codes,
  (SELECT COUNT(*) FROM public.gracz_mfa m WHERE m.user_id=t.user_id) AS mfa_rows,
  (SELECT COUNT(*) FROM public.gracz_roles r WHERE r.user_id=t.user_id) AS role_rows,
  (SELECT COUNT(*) FROM public.gracz_role_history r WHERE r.user_id=t.user_id) AS role_history_rows,
  (SELECT COUNT(*) FROM public.gracz_role_changes r WHERE r.target_user_id=t.user_id) AS role_change_target_rows
FROM targets t
ORDER BY t.user_id;

\echo ''
\echo '=== E. SOCIAL / GLOBAL CHAT / MODERATION FOOTPRINT ==='

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  t.user_id,
  (SELECT COUNT(*) FROM public.gracz_chat_friends f WHERE f.requester_id=t.user_id OR f.addressee_id=t.user_id) AS friendship_rows,
  (SELECT COUNT(*) FROM public.gracz_global_chat c WHERE c.user_id=t.user_id) AS global_chat_messages,
  (SELECT COUNT(*) FROM public.gracz_chat_topics c WHERE c.owner_id=t.user_id) AS chat_topics_owned,
  (SELECT COUNT(*) FROM public.gracz_global_chat_reports r WHERE r.reporter_id=t.user_id) AS chat_reports_filed,
  (SELECT COUNT(*) FROM public.gracz_moderation_decisions d WHERE d.user_id=t.user_id) AS moderation_decisions,
  (SELECT COUNT(*) FROM public.gracz_moderation_appeals a WHERE a.user_id=t.user_id) AS moderation_appeals
FROM targets t
ORDER BY t.user_id;

\echo ''
\echo '=== F. TOURNAMENT FOOTPRINT ==='

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  t.user_id,
  (SELECT COUNT(*) FROM public.gracz_tournament_players p WHERE p.user_id=t.user_id) AS tournament_player_rows
FROM targets t
ORDER BY t.user_id;

\echo ''
\echo '=== G. GAME FOOTPRINT — STRUCTURED TYSIAC + HEURISTIC WARCABY ==='
\echo 'Tysiac uses structured JSON containment. Warcaby state is legacy TEXT; count is candidate evidence only.'

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  t.user_id,
  (SELECT COUNT(*)
     FROM public.gracz_thousand_games g
    WHERE g.players @> jsonb_build_array(jsonb_build_object('userId',t.user_id))) AS thousand_games_structured,
  (SELECT COUNT(*)
     FROM public.gracz_game_sessions g
    WHERE g.state LIKE ('%' || t.user_id || '%')) AS checkers_state_candidate_refs
FROM targets t
ORDER BY t.user_id;

\echo ''
\echo '=== H. NEWSLETTER CORRELATION BY NORMALIZED EMAIL ==='
\echo 'Counts/status only; raw email is never output. This is contact-channel correlation, NOT identity proof.'

WITH targets AS (
  SELECT user_id, lower(trim(email)) AS normalized_email
  FROM public.gracz_accounts
  WHERE user_id IN ('gamerpl','gamerde','gracz.pl','gamerpolska','gamer')
)
SELECT
  t.user_id,
  COUNT(n.*) AS newsletter_rows_same_normalized_email,
  COUNT(*) FILTER (WHERE n.status='subscribed') AS newsletter_subscribed,
  COUNT(*) FILTER (WHERE n.status='pending_confirmation') AS newsletter_pending_confirmation,
  MIN(n.created_at) AS first_newsletter_row_at,
  MAX(n.updated_at) AS last_newsletter_update_at
FROM targets t
LEFT JOIN public.gracz_newsletter_subscribers n
  ON lower(trim(n.email))=t.normalized_email
GROUP BY t.user_id
ORDER BY t.user_id;

\echo ''
\echo '=== I. AUDIT FOOTPRINT ==='
\echo 'Counts/timestamps only. No source hash, UA hash or metadata output.'

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  t.user_id,
  COUNT(a.*) FILTER (WHERE a.actor_id=t.user_id) AS audit_actor_events,
  COUNT(a.*) FILTER (WHERE a.target_id=t.user_id) AS audit_target_events,
  MIN(a.occurred_at) FILTER (WHERE a.actor_id=t.user_id OR a.target_id=t.user_id) AS first_audit_event_at,
  MAX(a.occurred_at) FILTER (WHERE a.actor_id=t.user_id OR a.target_id=t.user_id) AS last_audit_event_at
FROM targets t
LEFT JOIN public.gracz_audit_log a ON a.actor_id=t.user_id OR a.target_id=t.user_id
GROUP BY t.user_id
ORDER BY t.user_id;

\echo ''
\echo '=== I2. AUDIT EVENT TYPES PER TARGET ACCOUNT ==='
\echo 'Event type + count only; useful for registration/profile/recovery lineage.'

WITH targets(user_id) AS (
  VALUES ('gamerpl'),('gamerde'),('gracz.pl'),('gamerpolska'),('gamer')
)
SELECT
  t.user_id,
  a.event_type,
  COUNT(*) AS event_count,
  MIN(a.occurred_at) AS first_event_at,
  MAX(a.occurred_at) AS last_event_at
FROM targets t
JOIN public.gracz_audit_log a ON a.actor_id=t.user_id OR a.target_id=t.user_id
GROUP BY t.user_id,a.event_type
ORDER BY t.user_id,a.event_type;

\echo ''
\echo '=== J. DQ-002 GROUP CONSISTENCY RECHECK ==='

WITH normalized AS (
  SELECT user_id, lower(trim(email)) AS normalized_email
  FROM public.gracz_accounts
  WHERE email IS NOT NULL AND btrim(email)<>''
), collision_groups AS (
  SELECT normalized_email, COUNT(*) AS account_count
  FROM normalized
  GROUP BY normalized_email
  HAVING COUNT(*)>1
)
SELECT
  md5(c.normalized_email) AS normalized_email_hash,
  c.account_count,
  string_agg(n.user_id, ', ' ORDER BY n.user_id) AS account_ids
FROM collision_groups c
JOIN normalized n USING(normalized_email)
WHERE n.user_id IN ('gamerpl','gamerde','gracz.pl','gamerpolska','gamer')
GROUP BY c.normalized_email,c.account_count
ORDER BY normalized_email_hash;

ROLLBACK;

\echo ''
\echo '=== DQ-002 PER-ACCOUNT EVIDENCE END ==='

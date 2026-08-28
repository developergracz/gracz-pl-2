\pset pager off
\echo '=== BLOCKER DRILL-DOWN START ==='
\echo 'Read-only, privacy-safe collector. No email/name/message/token/plaintext output.'

BEGIN TRANSACTION READ ONLY;

SELECT now() AS captured_at,
       current_database() AS database_name,
       current_user,
       current_setting('server_version') AS server_version;

\echo ''
\echo '=== A. ORPHAN FRIENDSHIP DRILL-DOWN ==='
\echo 'Only relation/user IDs and status. No names/emails.'

SELECT
    f.relation_id,
    f.requester_id,
    f.addressee_id,
    f.status,
    f.created_at,
    f.updated_at,
    CASE WHEN rq.user_id IS NULL THEN true ELSE false END AS requester_missing,
    CASE WHEN ad.user_id IS NULL THEN true ELSE false END AS addressee_missing
FROM public.gracz_chat_friends f
LEFT JOIN public.gracz_accounts rq ON rq.user_id = f.requester_id
LEFT JOIN public.gracz_accounts ad ON ad.user_id = f.addressee_id
WHERE rq.user_id IS NULL OR ad.user_id IS NULL
ORDER BY f.created_at, f.relation_id;

\echo ''
\echo '=== A2. ORPHAN FRIENDSHIP SUMMARY ==='

SELECT
    COUNT(*) FILTER (WHERE rq.user_id IS NULL) AS missing_requester_rows,
    COUNT(*) FILTER (WHERE ad.user_id IS NULL) AS missing_addressee_rows,
    COUNT(*) AS total_orphan_friendship_rows
FROM public.gracz_chat_friends f
LEFT JOIN public.gracz_accounts rq ON rq.user_id = f.requester_id
LEFT JOIN public.gracz_accounts ad ON ad.user_id = f.addressee_id
WHERE rq.user_id IS NULL OR ad.user_id IS NULL;

\echo ''
\echo '=== B. NORMALIZED EMAIL COLLISION GROUPS ==='
\echo 'Hash is a correlation token only (MD5), not a security boundary. Raw email is never output.'

WITH normalized AS (
    SELECT
        user_id,
        lower(trim(email)) AS normalized_email,
        created_at,
        contact_verified,
        verification_channel,
        account_role,
        mfa_required
    FROM public.gracz_accounts
    WHERE email IS NOT NULL
      AND btrim(email) <> ''
), collision_keys AS (
    SELECT normalized_email
    FROM normalized
    GROUP BY normalized_email
    HAVING COUNT(*) > 1
), grouped AS (
    SELECT
        n.*,
        dense_rank() OVER (ORDER BY md5(n.normalized_email)) AS collision_group,
        md5(n.normalized_email) AS normalized_email_hash
    FROM normalized n
    JOIN collision_keys c USING (normalized_email)
)
SELECT
    collision_group,
    normalized_email_hash,
    user_id,
    created_at,
    contact_verified,
    verification_channel,
    account_role,
    mfa_required
FROM grouped
ORDER BY collision_group, created_at, user_id;

\echo ''
\echo '=== B2. NORMALIZED EMAIL COLLISION SUMMARY ==='

WITH normalized AS (
    SELECT lower(trim(email)) AS normalized_email
    FROM public.gracz_accounts
    WHERE email IS NOT NULL
      AND btrim(email) <> ''
), groups AS (
    SELECT normalized_email, COUNT(*) AS account_count
    FROM normalized
    GROUP BY normalized_email
    HAVING COUNT(*) > 1
)
SELECT
    COUNT(*) AS collision_groups,
    COALESCE(SUM(account_count), 0) AS accounts_in_collision_groups,
    COALESCE(MAX(account_count), 0) AS largest_group_size
FROM groups;

\echo ''
\echo '=== B3. COLLISION ACCOUNT DEPENDENCY COUNTS ==='
\echo 'Counts only; helps decide merge/archive/manual remediation without exposing content.'

WITH collision_users AS (
    SELECT a.user_id
    FROM public.gracz_accounts a
    WHERE a.email IS NOT NULL
      AND btrim(a.email) <> ''
      AND lower(trim(a.email)) IN (
          SELECT lower(trim(email))
          FROM public.gracz_accounts
          WHERE email IS NOT NULL AND btrim(email) <> ''
          GROUP BY lower(trim(email))
          HAVING COUNT(*) > 1
      )
)
SELECT
    cu.user_id,
    (SELECT COUNT(*) FROM public.gracz_auth_sessions s WHERE s.user_id = cu.user_id) AS auth_sessions,
    (SELECT COUNT(*) FROM public.gracz_messages m WHERE m.sender_id = cu.user_id) AS private_messages_sent,
    (SELECT COUNT(*) FROM public.gracz_messages m WHERE m.recipient_id = cu.user_id) AS private_messages_received,
    (SELECT COUNT(*) FROM public.gracz_chat_friends f WHERE f.requester_id = cu.user_id OR f.addressee_id = cu.user_id) AS friendship_rows,
    (SELECT COUNT(*) FROM public.gracz_global_chat c WHERE c.user_id = cu.user_id) AS global_chat_messages,
    (SELECT COUNT(*) FROM public.gracz_moderation_decisions d WHERE d.user_id = cu.user_id) AS moderation_decisions,
    (SELECT COUNT(*) FROM public.gracz_moderation_appeals a WHERE a.user_id = cu.user_id) AS moderation_appeals,
    (SELECT COUNT(*) FROM public.gracz_password_reset_tokens r WHERE r.user_id = cu.user_id) AS reset_tokens,
    (SELECT COUNT(*) FROM public.gracz_registration_codes r WHERE r.user_id = cu.user_id) AS registration_codes,
    (SELECT COUNT(*) FROM public.gracz_mfa m WHERE m.user_id = cu.user_id) AS mfa_rows,
    (SELECT COUNT(*) FROM public.gracz_roles r WHERE r.user_id = cu.user_id) AS role_rows,
    (SELECT COUNT(*) FROM public.gracz_role_changes r WHERE r.target_user_id = cu.user_id) AS role_change_rows,
    (SELECT COUNT(*) FROM public.gracz_role_history r WHERE r.user_id = cu.user_id) AS role_history_rows,
    (SELECT COUNT(*) FROM public.gracz_tournament_players p WHERE p.user_id = cu.user_id) AS tournament_player_rows
FROM collision_users cu
ORDER BY cu.user_id;

\echo ''
\echo '=== C. NEWSLETTER CONSENT TIMESTAMP DRILL-DOWN ==='
\echo 'No email/nick. IDs and timestamps only.'

SELECT
    subscriber_id,
    id AS legacy_bigint_id,
    status,
    consent_at,
    consented_at,
    EXTRACT(EPOCH FROM (consented_at - consent_at))::bigint AS delta_seconds,
    created_at,
    updated_at,
    confirmed_at,
    unsubscribed_at
FROM public.gracz_newsletter_subscribers
WHERE consented_at IS NOT NULL
  AND consent_at IS NOT NULL
  AND abs(EXTRACT(EPOCH FROM (consented_at - consent_at))) > 1
ORDER BY id;

\echo ''
\echo '=== C2. NEWSLETTER CONSENT DIVERGENCE SUMMARY ==='

SELECT
    COUNT(*) AS divergent_rows,
    MIN(abs(EXTRACT(EPOCH FROM (consented_at - consent_at))))::bigint AS min_abs_delta_seconds,
    MAX(abs(EXTRACT(EPOCH FROM (consented_at - consent_at))))::bigint AS max_abs_delta_seconds
FROM public.gracz_newsletter_subscribers
WHERE consented_at IS NOT NULL
  AND consent_at IS NOT NULL
  AND abs(EXTRACT(EPOCH FROM (consented_at - consent_at))) > 1;

\echo ''
\echo '=== D. BLOCKER REMEDIATION CLASSIFICATION INPUT ==='
\echo 'No mutation is performed. Results support MANUAL/MERGE/ARCHIVE/QUARANTINE decision.'

SELECT
    'ORPHAN_FRIENDSHIP' AS blocker_type,
    COUNT(*) AS affected_rows
FROM public.gracz_chat_friends f
LEFT JOIN public.gracz_accounts rq ON rq.user_id = f.requester_id
LEFT JOIN public.gracz_accounts ad ON ad.user_id = f.addressee_id
WHERE rq.user_id IS NULL OR ad.user_id IS NULL
UNION ALL
SELECT
    'NORMALIZED_EMAIL_COLLISION_ACCOUNTS',
    COUNT(*)
FROM public.gracz_accounts a
WHERE a.email IS NOT NULL
  AND btrim(a.email) <> ''
  AND lower(trim(a.email)) IN (
      SELECT lower(trim(email))
      FROM public.gracz_accounts
      WHERE email IS NOT NULL AND btrim(email) <> ''
      GROUP BY lower(trim(email))
      HAVING COUNT(*) > 1
  )
UNION ALL
SELECT
    'NEWSLETTER_CONSENT_TIME_DIVERGENCE',
    COUNT(*)
FROM public.gracz_newsletter_subscribers
WHERE consented_at IS NOT NULL
  AND consent_at IS NOT NULL
  AND abs(EXTRACT(EPOCH FROM (consented_at - consent_at))) > 1;

ROLLBACK;

\echo ''
\echo '=== BLOCKER DRILL-DOWN END ==='

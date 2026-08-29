-- ETAP 3 — Bramka 13: Active-State Inventory
-- Data przygotowania: 29.08.2026
-- Tryb: READ ONLY / privacy-safe
--
-- Collector opiera się wyłącznie na POTWIERDZONYCH tabelach AS-IS Gracz.pl.
-- Nie używa hipotetycznych tabel system_workers/system_cron/outbox_events/etc.
-- Nie wypisuje user_id, e-maili, tokenów, hashy, treści wiadomości ani sekretów.
--
-- UWAGA: część runtime jest process-local (Lobby/Gomoku/SSE/presence) i nie ma
-- reprezentacji w PostgreSQL. Ten collector mierzy persisted active-state i stan
-- połączeń/transactions PostgreSQL. Process-local state jest osobnym dowodem Gate 13.

BEGIN TRANSACTION READ ONLY;

-- A. Checkers persisted game sessions.
-- state jest TEXT; pg_input_is_valid zapobiega błędnemu castowi niepoprawnego JSON.
WITH checkers AS (
  SELECT
    CASE WHEN pg_input_is_valid(state, 'jsonb') THEN state::jsonb ELSE NULL END AS j,
    updated_at
  FROM gracz_game_sessions
)
SELECT 'A_CHECKERS' AS section, metric, value
FROM (
  SELECT 'sessions_total' AS metric, COUNT(*)::bigint AS value FROM checkers
  UNION ALL SELECT 'invalid_json', COUNT(*)::bigint FROM checkers WHERE j IS NULL
  UNION ALL SELECT 'active_games', COUNT(*)::bigint FROM checkers WHERE j #>> '{game,status}' = 'active'
  UNION ALL SELECT 'terminal_games', COUNT(*)::bigint FROM checkers WHERE j #>> '{game,status}' IN ('won','draw')
  UNION ALL SELECT 'unknown_status', COUNT(*)::bigint FROM checkers WHERE j IS NOT NULL AND COALESCE(j #>> '{game,status}','') NOT IN ('active','won','draw')
  UNION ALL SELECT 'active_with_any_connected_player', COUNT(*)::bigint FROM checkers
    WHERE j #>> '{game,status}' = 'active'
      AND (COALESCE((j #>> '{players,white,connected}')::boolean,FALSE)
        OR COALESCE((j #>> '{players,black,connected}')::boolean,FALSE))
  UNION ALL SELECT 'updated_last_10m', COUNT(*)::bigint FROM checkers WHERE updated_at > NOW() - INTERVAL '10 minutes'
) q
ORDER BY metric;

-- B. Tysiąc persisted state. Statusy pochodzą z thousand-engine.js.
SELECT 'B_THOUSAND' AS section, metric, value
FROM (
  SELECT 'games_total' AS metric, COUNT(*)::bigint AS value FROM gracz_thousand_games
  UNION ALL SELECT 'in_progress', COUNT(*)::bigint FROM gracz_thousand_games
    WHERE COALESCE(state->>'status','') IN ('bidding','talon','discard','contract','playing')
  UNION ALL SELECT 'awaiting_next_round_or_redeal', COUNT(*)::bigint FROM gracz_thousand_games
    WHERE COALESCE(state->>'status','') IN ('round-ended','redeal')
  UNION ALL SELECT 'game_ended', COUNT(*)::bigint FROM gracz_thousand_games
    WHERE COALESCE(state->>'status','') = 'game-ended'
  UNION ALL SELECT 'unknown_status', COUNT(*)::bigint FROM gracz_thousand_games
    WHERE COALESCE(state->>'status','') NOT IN ('bidding','talon','discard','contract','playing','round-ended','redeal','game-ended')
  UNION ALL SELECT 'updated_last_10m', COUNT(*)::bigint FROM gracz_thousand_games WHERE updated_at > NOW() - INTERVAL '10 minutes'
) q
ORDER BY metric;

-- C. Tournament active workflow.
SELECT 'C_TOURNAMENTS' AS section, metric, value
FROM (
  SELECT 'tournaments_total' AS metric, COUNT(*)::bigint AS value FROM gracz_tournaments
  UNION ALL SELECT 'registration', COUNT(*)::bigint FROM gracz_tournaments WHERE status='registration'
  UNION ALL SELECT 'live', COUNT(*)::bigint FROM gracz_tournaments WHERE status='live'
  UNION ALL SELECT 'finished', COUNT(*)::bigint FROM gracz_tournaments WHERE status='finished'
  UNION ALL SELECT 'unknown_status', COUNT(*)::bigint FROM gracz_tournaments WHERE status NOT IN ('registration','live','finished')
  UNION ALL SELECT 'open_matches', COUNT(*)::bigint FROM gracz_tournament_matches WHERE status <> 'completed'
) q
ORDER BY metric;

-- D. Authentication sessions.
-- Runtime uznaje sesję za aktywną, gdy: not revoked + expires>now + last_seen w 30 min.
SELECT 'D_AUTH' AS section, metric, value
FROM (
  SELECT 'sessions_total' AS metric, COUNT(*)::bigint AS value FROM gracz_auth_sessions
  UNION ALL SELECT 'sessions_unrevoked_unexpired', COUNT(*)::bigint FROM gracz_auth_sessions
    WHERE revoked_at IS NULL AND expires_at > NOW()
  UNION ALL SELECT 'sessions_active_runtime_rule', COUNT(*)::bigint FROM gracz_auth_sessions
    WHERE revoked_at IS NULL AND expires_at > NOW() AND last_seen_at > NOW() - INTERVAL '30 minutes'
  UNION ALL SELECT 'sessions_idle_or_expired_not_revoked', COUNT(*)::bigint FROM gracz_auth_sessions
    WHERE revoked_at IS NULL AND NOT (expires_at > NOW() AND last_seen_at > NOW() - INTERVAL '30 minutes')
) q
ORDER BY metric;

-- E. Short-lived identity workflows.
SELECT 'E_IDENTITY_WORKFLOWS' AS section, metric, value
FROM (
  SELECT 'reset_tokens_total' AS metric, COUNT(*)::bigint AS value FROM gracz_password_reset_tokens
  UNION ALL SELECT 'reset_tokens_active', COUNT(*)::bigint FROM gracz_password_reset_tokens
    WHERE used_at IS NULL AND expires_at > NOW()
  UNION ALL SELECT 'registration_codes_total', COUNT(*)::bigint FROM gracz_registration_codes
  UNION ALL SELECT 'registration_codes_active', COUNT(*)::bigint FROM gracz_registration_codes c
    JOIN gracz_accounts a ON a.user_id=c.user_id
    WHERE c.expires_at > NOW() AND c.attempts < 5 AND a.contact_verified=FALSE
  UNION ALL SELECT 'mfa_rows_total', COUNT(*)::bigint FROM gracz_mfa
  UNION ALL SELECT 'mfa_enabled', COUNT(*)::bigint FROM gracz_mfa WHERE enabled=TRUE
  UNION ALL SELECT 'mfa_setup_pending', COUNT(*)::bigint FROM gracz_mfa WHERE enabled=FALSE
) q
ORDER BY metric;

-- F. Newsletter lifecycle. Subscribed != pending write; osobno liczymy krótkotrwały flow potwierdzenia.
SELECT 'F_NEWSLETTER' AS section, metric, value
FROM (
  SELECT 'subscribers_total' AS metric, COUNT(*)::bigint AS value FROM gracz_newsletter_subscribers
  UNION ALL SELECT 'subscribed', COUNT(*)::bigint FROM gracz_newsletter_subscribers WHERE status='subscribed'
  UNION ALL SELECT 'pending_confirmation_total', COUNT(*)::bigint FROM gracz_newsletter_subscribers WHERE status='pending_confirmation'
  UNION ALL SELECT 'pending_confirmation_unexpired', COUNT(*)::bigint FROM gracz_newsletter_subscribers
    WHERE status='pending_confirmation' AND confirmation_expires_at > NOW()
  UNION ALL SELECT 'pending_confirmation_delivery_gap', COUNT(*)::bigint FROM gracz_newsletter_subscribers
    WHERE status='pending_confirmation' AND confirmation_expires_at > NOW() AND confirmation_sent_at IS NULL
  UNION ALL SELECT 'pending_confirmation_expired', COUNT(*)::bigint FROM gracz_newsletter_subscribers
    WHERE status='pending_confirmation' AND (confirmation_expires_at IS NULL OR confirmation_expires_at <= NOW())
  UNION ALL SELECT 'unknown_status', COUNT(*)::bigint FROM gracz_newsletter_subscribers
    WHERE status NOT IN ('pending_confirmation','subscribed','unsubscribed')
) q
ORDER BY metric;

-- G. Moderation / social pending state.
-- gracz_moderation_decisions to decyzje filtra treści, nie persistent ban/mute.
-- gracz_global_chat_reports nie ma kolumny resolution/status; przy >0 wymaga osobnej decyzji migracyjnej.
SELECT 'G_MODERATION_SOCIAL' AS section, metric, value
FROM (
  SELECT 'moderation_decisions_total' AS metric, COUNT(*)::bigint AS value FROM gracz_moderation_decisions
  UNION ALL SELECT 'moderation_appeals_open', COUNT(*)::bigint FROM gracz_moderation_appeals WHERE status='open'
  UNION ALL SELECT 'moderation_appeals_unknown_status', COUNT(*)::bigint FROM gracz_moderation_appeals WHERE status NOT IN ('open','approved','rejected','closed')
  UNION ALL SELECT 'chat_reports_total_without_resolution_state', COUNT(*)::bigint FROM gracz_global_chat_reports
  UNION ALL SELECT 'friend_requests_pending', COUNT(*)::bigint FROM gracz_chat_friends WHERE status='pending'
) q
ORDER BY metric;

-- H. PostgreSQL operational activity — aggregate counts only, no query text.
SELECT 'H_DB_RUNTIME' AS section, metric, value
FROM (
  SELECT 'other_client_connections' AS metric, COUNT(*)::bigint AS value
    FROM pg_stat_activity
    WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()
  UNION ALL SELECT 'other_active_connections', COUNT(*)::bigint
    FROM pg_stat_activity
    WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid() AND state='active'
  UNION ALL SELECT 'other_idle_in_transaction', COUNT(*)::bigint
    FROM pg_stat_activity
    WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid() AND state LIKE 'idle in transaction%'
  UNION ALL SELECT 'other_transactions_over_30s', COUNT(*)::bigint
    FROM pg_stat_activity
    WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()
      AND xact_start IS NOT NULL AND NOW()-xact_start > INTERVAL '30 seconds'
  UNION ALL SELECT 'waiting_locks', COUNT(*)::bigint FROM pg_locks WHERE NOT granted
) q
ORDER BY metric;

ROLLBACK;

-- ETAP 3 — Gate 13A: focused demo-signature / pristine-shell drilldown
-- Data przygotowania: 29.08.2026
-- Tryb: READ ONLY / privacy-safe
--
-- Nie wypisuje żadnego game_id/user_id/treści. Zwraca wyłącznie agregaty.

BEGIN TRANSACTION READ ONLY;

SELECT 'META' AS section,'transaction_read_only' AS metric,
       CASE WHEN current_setting('transaction_read_only')='on' THEN 1 ELSE 0 END::bigint AS value;

-- A. Warcaby: czy active snapshot jest tylko pustą, nigdy nierozpoczętą sesją?
WITH s AS (
  SELECT
    CASE WHEN pg_input_is_valid(state,'jsonb') THEN state::jsonb END AS j,
    updated_at
  FROM gracz_game_sessions
), x AS (
  SELECT
    j#>>'{game,status}' AS status,
    jsonb_array_length(COALESCE(j->'events','[]'::jsonb)) AS event_count,
    (SELECT count(*) FROM jsonb_array_elements(COALESCE(j->'events','[]'::jsonb)) e WHERE e->>'type'='move.accepted') AS move_count,
    jsonb_array_length(COALESCE(j->'messages','[]'::jsonb)) AS message_count,
    j->'pendingOffer' AS pending_offer,
    updated_at
  FROM s
)
SELECT 'A_CHECKERS_PRISTINE' AS section,metric,value FROM (
  SELECT 'active_total' metric,count(*)::bigint value FROM x WHERE status='active'
  UNION ALL SELECT 'active_pristine_shell',count(*)::bigint FROM x
    WHERE status='active' AND event_count=1 AND move_count=0 AND message_count=0
      AND (pending_offer IS NULL OR pending_offer='null'::jsonb)
  UNION ALL SELECT 'active_nonpristine',count(*)::bigint FROM x
    WHERE status='active' AND NOT (event_count=1 AND move_count=0 AND message_count=0 AND (pending_offer IS NULL OR pending_offer='null'::jsonb))
  UNION ALL SELECT 'active_updated_ge_1h',count(*)::bigint FROM x WHERE status='active' AND updated_at<=NOW()-interval '1 hour'
) q ORDER BY metric;

-- B. Tysiąc: exact signature historycznego guest/demo flow:
-- guest-<8hex>, demo-a-<same 8hex>, demo-b-<same 8hex>.
WITH g AS (
  SELECT game_id,state->>'status' AS status,revision,updated_at,players
  FROM gracz_thousand_games
), sig AS (
  SELECT g.game_id,g.status,g.revision,g.updated_at,
    jsonb_array_length(g.players) AS n,
    (SELECT count(*) FROM jsonb_array_elements(g.players) p WHERE lower(p->>'userId') ~ '^guest-[0-9a-f]{8}$') AS guest_n,
    (SELECT count(*) FROM jsonb_array_elements(g.players) p WHERE lower(p->>'userId') ~ '^demo-a-[0-9a-f]{8}$') AS demo_a_n,
    (SELECT count(*) FROM jsonb_array_elements(g.players) p WHERE lower(p->>'userId') ~ '^demo-b-[0-9a-f]{8}$') AS demo_b_n,
    (SELECT count(DISTINCT regexp_replace(lower(p->>'userId'),'^(guest|demo-a|demo-b)-',''))
       FROM jsonb_array_elements(g.players) p
      WHERE lower(p->>'userId') ~ '^(guest|demo-a|demo-b)-[0-9a-f]{8}$') AS suffix_n
  FROM g
)
SELECT 'B_THOUSAND_DEMO_SIGNATURE' AS section,metric,value FROM (
  SELECT 'games_total' metric,count(*)::bigint value FROM sig
  UNION ALL SELECT 'exact_guest_demo_signature',count(*)::bigint FROM sig WHERE n=3 AND guest_n=1 AND demo_a_n=1 AND demo_b_n=1 AND suffix_n=1
  UNION ALL SELECT 'not_exact_guest_demo_signature',count(*)::bigint FROM sig WHERE NOT (n=3 AND guest_n=1 AND demo_a_n=1 AND demo_b_n=1 AND suffix_n=1)
  UNION ALL SELECT 'exact_signature_bidding',count(*)::bigint FROM sig WHERE n=3 AND guest_n=1 AND demo_a_n=1 AND demo_b_n=1 AND suffix_n=1 AND status='bidding'
  UNION ALL SELECT 'exact_signature_revision_1',count(*)::bigint FROM sig WHERE n=3 AND guest_n=1 AND demo_a_n=1 AND demo_b_n=1 AND suffix_n=1 AND revision=1
  UNION ALL SELECT 'exact_signature_revision_gt_1',count(*)::bigint FROM sig WHERE n=3 AND guest_n=1 AND demo_a_n=1 AND demo_b_n=1 AND suffix_n=1 AND revision>1
  UNION ALL SELECT 'exact_signature_updated_ge_24h',count(*)::bigint FROM sig WHERE n=3 AND guest_n=1 AND demo_a_n=1 AND demo_b_n=1 AND suffix_n=1 AND updated_at<=NOW()-interval '24 hours'
) q ORDER BY metric;

ROLLBACK;

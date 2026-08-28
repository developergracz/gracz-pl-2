-- Gracz.pl ETAP 3 — Data Quality / Orphan / Collision Collector
-- Data: 28.08.2026
-- STATUS: READ-ONLY wobec danych produkcyjnych.
-- Dozwolone operacje: SELECT + meta-komendy psql dotyczące formatowania.
-- Zakaz: CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/VACUUM/ANALYZE/LOCK.
-- Privacy-safe: raportuje wyłącznie liczby/agregaty; nie wypisuje e-maili,
-- user_id, tokenów, plaintextu wiadomości ani ciphertextu.
--
-- Cel: zebrać twarde dowody przed przyszłymi V3 UNIQUE/FK/NOT NULL,
-- backfillem i writer cutover. Wynik > 0 nie zawsze oznacza błąd biznesowy:
-- pozycje REVIEW wymagają interpretacji względem kontraktu V3.

\pset pager off
\pset null '(null)'
\timing on

\echo '=== 00 DATA QUALITY CONTEXT ==='
SELECT clock_timestamp() AS captured_at,
       current_database() AS database_name,
       current_user AS current_user,
       current_setting('server_version') AS server_version;

\echo '=== 01 ORPHANS / LOGICAL REFERENCES ==='
SELECT * FROM (
    SELECT 'ORPHAN-AUTH-SESSION-USER' AS check_code, 'BLOCKER' AS severity,
           COUNT(*)::bigint AS violations,
           'auth_sessions.user_id bez gracz_accounts' AS note
    FROM gracz_auth_sessions s
    WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id = s.user_id)

    UNION ALL SELECT 'ORPHAN-MESSAGE-SENDER','BLOCKER',COUNT(*)::bigint,'messages.sender_id bez account'
    FROM gracz_messages m WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=m.sender_id)
    UNION ALL SELECT 'ORPHAN-MESSAGE-RECIPIENT','BLOCKER',COUNT(*)::bigint,'messages.recipient_id bez account'
    FROM gracz_messages m WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=m.recipient_id)
    UNION ALL SELECT 'ORPHAN-ATTACHMENT-MESSAGE','BLOCKER',COUNT(*)::bigint,'attachment bez message'
    FROM gracz_message_attachments x WHERE NOT EXISTS (SELECT 1 FROM gracz_messages m WHERE m.message_id=x.message_id)
    UNION ALL SELECT 'ORPHAN-MFA-USER','BLOCKER',COUNT(*)::bigint,'MFA bez account'
    FROM gracz_mfa x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)
    UNION ALL SELECT 'ORPHAN-RESET-USER','BLOCKER',COUNT(*)::bigint,'reset token bez account'
    FROM gracz_password_reset_tokens x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)
    UNION ALL SELECT 'ORPHAN-REGCODE-USER','BLOCKER',COUNT(*)::bigint,'registration code bez account'
    FROM gracz_registration_codes x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)
    UNION ALL SELECT 'ORPHAN-ROLE-USER','BLOCKER',COUNT(*)::bigint,'roles.user_id bez account'
    FROM gracz_roles x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)
    UNION ALL SELECT 'ORPHAN-ROLE-CHANGE-TARGET','BLOCKER',COUNT(*)::bigint,'role_changes target bez account'
    FROM gracz_role_changes x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.target_user_id)
    UNION ALL SELECT 'ORPHAN-ROLE-HISTORY-USER','REVIEW',COUNT(*)::bigint,'role_history user bez account'
    FROM gracz_role_history x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)

    UNION ALL SELECT 'ORPHAN-FRIEND-REQUESTER','BLOCKER',COUNT(*)::bigint,'friend requester bez account'
    FROM gracz_chat_friends x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.requester_id)
    UNION ALL SELECT 'ORPHAN-FRIEND-ADDRESSEE','BLOCKER',COUNT(*)::bigint,'friend addressee bez account'
    FROM gracz_chat_friends x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.addressee_id)
    UNION ALL SELECT 'ORPHAN-CHAT-TOPIC-OWNER','REVIEW',COUNT(*)::bigint,'chat topic owner bez account'
    FROM gracz_chat_topics x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.owner_id)
    UNION ALL SELECT 'ORPHAN-CHAT-MESSAGE-USER','REVIEW',COUNT(*)::bigint,'global chat user bez account'
    FROM gracz_global_chat x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)
    UNION ALL SELECT 'ORPHAN-CHAT-REPLY','BLOCKER',COUNT(*)::bigint,'reply_to wskazuje brakującą wiadomość'
    FROM gracz_global_chat x WHERE x.reply_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gracz_global_chat p WHERE p.message_id=x.reply_to)
    UNION ALL SELECT 'ORPHAN-CHAT-TOPIC','BLOCKER',COUNT(*)::bigint,'topic_id wskazuje brakujący topic'
    FROM gracz_global_chat x WHERE x.topic_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gracz_chat_topics t WHERE t.topic_id=x.topic_id)
    UNION ALL SELECT 'ORPHAN-CHAT-REPORT-MESSAGE','BLOCKER',COUNT(*)::bigint,'report bez chat message'
    FROM gracz_global_chat_reports x WHERE NOT EXISTS (SELECT 1 FROM gracz_global_chat m WHERE m.message_id=x.message_id)
    UNION ALL SELECT 'ORPHAN-CHAT-REPORT-REPORTER','REVIEW',COUNT(*)::bigint,'reporter bez account'
    FROM gracz_global_chat_reports x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.reporter_id)

    UNION ALL SELECT 'ORPHAN-MODERATION-DECISION-USER','REVIEW',COUNT(*)::bigint,'moderation decision user bez account'
    FROM gracz_moderation_decisions x WHERE x.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)
    UNION ALL SELECT 'ORPHAN-APPEAL-DECISION','BLOCKER',COUNT(*)::bigint,'appeal bez decision'
    FROM gracz_moderation_appeals x WHERE NOT EXISTS (SELECT 1 FROM gracz_moderation_decisions d WHERE d.decision_id=x.decision_id)
    UNION ALL SELECT 'ORPHAN-APPEAL-USER','REVIEW',COUNT(*)::bigint,'appeal user bez account'
    FROM gracz_moderation_appeals x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)

    UNION ALL SELECT 'ORPHAN-TOURNAMENT-OWNER','REVIEW',COUNT(*)::bigint,'tournament owner bez account'
    FROM gracz_tournaments x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.owner_id)
    UNION ALL SELECT 'ORPHAN-TOURNAMENT-PLAYER','BLOCKER',COUNT(*)::bigint,'tournament player bez account'
    FROM gracz_tournament_players x WHERE NOT EXISTS (SELECT 1 FROM gracz_accounts a WHERE a.user_id=x.user_id)
    UNION ALL SELECT 'ORPHAN-TOURNAMENT-MATCH','BLOCKER',COUNT(*)::bigint,'tournament_match bez tournament'
    FROM gracz_tournament_matches x WHERE NOT EXISTS (SELECT 1 FROM gracz_tournaments t WHERE t.tournament_id=x.tournament_id)

    UNION ALL SELECT 'ORPHAN-NEWSLETTER-CONSENT-SUBSCRIBER','BLOCKER',COUNT(*)::bigint,'consent bez canonical legacy BIGINT subscriber id'
    FROM newsletter_consent_history x WHERE NOT EXISTS (SELECT 1 FROM gracz_newsletter_subscribers s WHERE s.id=x.subscriber_id)
    UNION ALL SELECT 'ORPHAN-NEWSLETTER-EVENT-SUBSCRIBER','BLOCKER',COUNT(*)::bigint,'newsletter event subscriber bez parent'
    FROM newsletter_events x WHERE x.subscriber_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM gracz_newsletter_subscribers s WHERE s.id=x.subscriber_id)
    UNION ALL SELECT 'ORPHAN-NEWSLETTER-EVENT-SOURCE','BLOCKER',COUNT(*)::bigint,'newsletter event source bez parent'
    FROM newsletter_events x WHERE x.source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM newsletter_sources s WHERE s.id=x.source_id)
    UNION ALL SELECT 'ORPHAN-NEWSLETTER-SUBSCRIBER-SOURCE','BLOCKER',COUNT(*)::bigint,'subscriber_source bez subscriber'
    FROM newsletter_subscriber_sources x WHERE NOT EXISTS (SELECT 1 FROM gracz_newsletter_subscribers s WHERE s.id=x.subscriber_id)
    UNION ALL SELECT 'ORPHAN-NEWSLETTER-SOURCE','BLOCKER',COUNT(*)::bigint,'subscriber_source bez source'
    FROM newsletter_subscriber_sources x WHERE NOT EXISTS (SELECT 1 FROM newsletter_sources s WHERE s.id=x.source_id)
) q
ORDER BY severity, check_code;

\echo '=== 02 DUPLICATES / FUTURE UNIQUE CANDIDATES ==='
SELECT * FROM (
    SELECT 'DUP-ACCOUNT-USER-ID-NORMALIZED' AS check_code,'BLOCKER' AS severity,
           COALESCE(SUM(c-1),0)::bigint AS violations,'lower(trim(user_id)) collision' AS note
    FROM (SELECT lower(btrim(user_id)) k, COUNT(*) c FROM gracz_accounts GROUP BY 1 HAVING COUNT(*)>1) d
    UNION ALL SELECT 'DUP-ACCOUNT-EMAIL-NORMALIZED','BLOCKER',COALESCE(SUM(c-1),0)::bigint,'lower(trim(email)) collision'
    FROM (SELECT lower(btrim(email)) k,COUNT(*) c FROM gracz_accounts WHERE email IS NOT NULL AND btrim(email)<>'' GROUP BY 1 HAVING COUNT(*)>1)d
    UNION ALL SELECT 'DUP-NEWSLETTER-EMAIL-NORMALIZED','BLOCKER',COALESCE(SUM(c-1),0)::bigint,'canonical newsletter email collision'
    FROM (SELECT lower(btrim(email)) k,COUNT(*) c FROM gracz_newsletter_subscribers GROUP BY 1 HAVING COUNT(*)>1)d
    UNION ALL SELECT 'DUP-NEWSLETTER-EMAIL-NORMALIZED-FIELD','BLOCKER',COALESCE(SUM(c-1),0)::bigint,'email_normalized collision'
    FROM (SELECT email_normalized k,COUNT(*) c FROM gracz_newsletter_subscribers WHERE email_normalized IS NOT NULL GROUP BY 1 HAVING COUNT(*)>1)d
    UNION ALL SELECT 'DUP-NEWSLETTER-NICK-NORMALIZED','REVIEW',COALESCE(SUM(c-1),0)::bigint,'preferred_nick normalized collision'
    FROM (SELECT lower(btrim(preferred_nick)) k,COUNT(*) c FROM gracz_newsletter_subscribers WHERE preferred_nick IS NOT NULL GROUP BY 1 HAVING COUNT(*)>1)d
    UNION ALL SELECT 'DUP-FRIENDSHIP-CANONICAL-PAIR','BLOCKER',COALESCE(SUM(c-1),0)::bigint,'A-B i B-A lub wielokrotna relacja'
    FROM (SELECT LEAST(requester_id,addressee_id),GREATEST(requester_id,addressee_id),COUNT(*) c FROM gracz_chat_friends GROUP BY 1,2 HAVING COUNT(*)>1)d
    UNION ALL SELECT 'DUP-TOURNAMENT-ROUND-BOARD','BLOCKER',COALESCE(SUM(c-1),0)::bigint,'ten sam tournament/round/board'
    FROM (SELECT tournament_id,round,board,COUNT(*) c FROM gracz_tournament_matches GROUP BY 1,2,3 HAVING COUNT(*)>1)d
    UNION ALL SELECT 'DUP-TOURNAMENT-SEED','REVIEW',COALESCE(SUM(c-1),0)::bigint,'ten sam seed w turnieju'
    FROM (SELECT tournament_id,seed,COUNT(*) c FROM gracz_tournament_players GROUP BY 1,2 HAVING COUNT(*)>1)d
) q ORDER BY severity,check_code;

\echo '=== 03 STATE COLLISIONS / SEMANTIC CONFLICTS ==='
SELECT * FROM (
    SELECT 'COLLISION-ACCOUNT-ROLE-VS-ROLE-TABLE' AS check_code,'BLOCKER' AS severity,
           COUNT(*)::bigint AS violations,'gracz_accounts.account_role != gracz_roles.role' AS note
    FROM gracz_accounts a JOIN gracz_roles r ON r.user_id=a.user_id WHERE a.account_role<>r.role
    UNION ALL SELECT 'COLLISION-NEWSLETTER-ID-MAPPING','BLOCKER',COUNT(*)::bigint,'subscriber_id UUID lub BIGINT id brak/niejednoznaczność'
    FROM gracz_newsletter_subscribers WHERE subscriber_id IS NULL OR id IS NULL
    UNION ALL SELECT 'COLLISION-NEWSLETTER-CONSENT-TIMES','REVIEW',COUNT(*)::bigint,'consent_at i consented_at rozbieżne > 1s'
    FROM gracz_newsletter_subscribers WHERE consented_at IS NOT NULL AND abs(extract(epoch FROM (consented_at-consent_at)))>1
    UNION ALL SELECT 'COLLISION-NEWSLETTER-UNSUBSCRIBED-STATUS','BLOCKER',COUNT(*)::bigint,'unsubscribed_at ustawione przy statusie aktywnym/subscribed'
    FROM gracz_newsletter_subscribers WHERE unsubscribed_at IS NOT NULL AND status IN ('active','subscribed','pending_confirmation')
    UNION ALL SELECT 'COLLISION-NEWSLETTER-CONFIRMED-STATUS','REVIEW',COUNT(*)::bigint,'confirmed_at ustawione przy statusie pending_confirmation'
    FROM gracz_newsletter_subscribers WHERE confirmed_at IS NOT NULL AND status='pending_confirmation'
    UNION ALL SELECT 'COLLISION-MESSAGE-BOTH-DELETED','REVIEW',COUNT(*)::bigint,'oba delete flags true, rekord nadal istnieje'
    FROM gracz_messages WHERE sender_deleted AND recipient_deleted
) q ORDER BY severity,check_code;

\echo '=== 04 DEAD / INVALID DATA CANDIDATES ==='
SELECT * FROM (
    SELECT 'DEAD-ACCOUNT-BLANK-ID' AS check_code,'BLOCKER' AS severity,COUNT(*)::bigint AS violations,'blank user_id' AS note FROM gracz_accounts WHERE btrim(user_id)=''
    UNION ALL SELECT 'DEAD-ACCOUNT-BLANK-DISPLAY','REVIEW',COUNT(*)::bigint,'blank display_name' FROM gracz_accounts WHERE btrim(display_name)=''
    UNION ALL SELECT 'DEAD-GAME-SESSION-BLANK-STATE','BLOCKER',COUNT(*)::bigint,'blank Warcaby state' FROM gracz_game_sessions WHERE btrim(state)=''
    UNION ALL SELECT 'DEAD-GAME-SESSION-INVALID-JSON-CANDIDATE','REVIEW',COUNT(*)::bigint,'state nie parsuje się jako jsonb; zweryfikować kontrakt legacy' FROM gracz_game_sessions WHERE NOT pg_input_is_valid(state,'jsonb')
    UNION ALL SELECT 'DEAD-CHAT-BLANK-BODY','BLOCKER',COUNT(*)::bigint,'nieusunięta wiadomość z pustym body' FROM gracz_global_chat WHERE NOT deleted AND btrim(body)=''
    UNION ALL SELECT 'DEAD-CHAT-REACTIONS-NONOBJECT','REVIEW',COUNT(*)::bigint,'reactions JSONB nie jest object' FROM gracz_global_chat WHERE jsonb_typeof(reactions)<>'object'
    UNION ALL SELECT 'DEAD-PRIVATE-SUBJECT-BLANK','BLOCKER',COUNT(*)::bigint,'pusty carrier zaszyfrowanego subject' FROM gracz_messages WHERE btrim(subject)=''
    UNION ALL SELECT 'DEAD-PRIVATE-BODY-BLANK','BLOCKER',COUNT(*)::bigint,'pusty carrier zaszyfrowanego body' FROM gracz_messages WHERE btrim(body)=''
    UNION ALL SELECT 'DEAD-ATTACHMENT-FILE-SIZE','BLOCKER',COUNT(*)::bigint,'file_size <= 0' FROM gracz_message_attachments WHERE file_size<=0
    UNION ALL SELECT 'DEAD-ATTACHMENT-FILENAME','REVIEW',COUNT(*)::bigint,'blank file_name' FROM gracz_message_attachments WHERE btrim(file_name)=''
    UNION ALL SELECT 'DEAD-THOUSAND-PLAYERS-TYPE','BLOCKER',COUNT(*)::bigint,'players JSONB nie array/object' FROM gracz_thousand_games WHERE jsonb_typeof(players) NOT IN ('array','object')
    UNION ALL SELECT 'DEAD-THOUSAND-STATE-TYPE','BLOCKER',COUNT(*)::bigint,'state JSONB nie object' FROM gracz_thousand_games WHERE jsonb_typeof(state)<>'object'
    UNION ALL SELECT 'DEAD-NEWSLETTER-NICK-LONG-V3','BLOCKER',COUNT(*)::bigint,'preferred_nick > 24 znaków' FROM gracz_newsletter_subscribers WHERE preferred_nick IS NOT NULL AND char_length(preferred_nick)>24
    UNION ALL SELECT 'DEAD-NEWSLETTER-CONSENT-VERSION-LONG','BLOCKER',COUNT(*)::bigint,'consent_version > 64 znaków' FROM gracz_newsletter_subscribers WHERE char_length(consent_version)>64
    UNION ALL SELECT 'DEAD-NEWSLETTER-PLAINTEXT-UNSUB-TOKEN','REVIEW',COUNT(*)::bigint,'legacy plaintext unsubscribe_token nadal istnieje' FROM gracz_newsletter_subscribers WHERE unsubscribe_token IS NOT NULL
) q ORDER BY severity,check_code;

\echo '=== 05 TIMESTAMP ANOMALIES ==='
SELECT * FROM (
    SELECT 'TS-ACCOUNT-FUTURE' AS check_code,'BLOCKER' AS severity,COUNT(*)::bigint AS violations,'created_at > now()+5m' AS note FROM gracz_accounts WHERE created_at>clock_timestamp()+interval '5 minutes'
    UNION ALL SELECT 'TS-SESSION-EXPIRES-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'expires_at <= created_at' FROM gracz_auth_sessions WHERE expires_at<=created_at
    UNION ALL SELECT 'TS-SESSION-LAST-SEEN-BEFORE-CREATED','REVIEW',COUNT(*)::bigint,'last_seen_at < created_at' FROM gracz_auth_sessions WHERE last_seen_at<created_at
    UNION ALL SELECT 'TS-FRIEND-UPDATED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'updated_at < created_at' FROM gracz_chat_friends WHERE updated_at<created_at
    UNION ALL SELECT 'TS-GAME-UPDATED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'game updated_at < created_at' FROM gracz_game_sessions WHERE updated_at<created_at
    UNION ALL SELECT 'TS-CHAT-EDITED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'edited_at < created_at' FROM gracz_global_chat WHERE edited_at IS NOT NULL AND edited_at<created_at
    UNION ALL SELECT 'TS-MESSAGE-READ-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'read_at < created_at' FROM gracz_messages WHERE read_at IS NOT NULL AND read_at<created_at
    UNION ALL SELECT 'TS-MFA-VERIFIED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'verified_at < created_at' FROM gracz_mfa WHERE verified_at IS NOT NULL AND verified_at<created_at
    UNION ALL SELECT 'TS-APPEAL-REVIEWED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'reviewed_at < created_at' FROM gracz_moderation_appeals WHERE reviewed_at IS NOT NULL AND reviewed_at<created_at
    UNION ALL SELECT 'TS-NEWSLETTER-UPDATED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'updated_at < created_at' FROM gracz_newsletter_subscribers WHERE updated_at<created_at
    UNION ALL SELECT 'TS-NEWSLETTER-CONFIRMED-BEFORE-SENT','REVIEW',COUNT(*)::bigint,'confirmed_at < confirmation_sent_at' FROM gracz_newsletter_subscribers WHERE confirmed_at IS NOT NULL AND confirmation_sent_at IS NOT NULL AND confirmed_at<confirmation_sent_at
    UNION ALL SELECT 'TS-RESET-EXPIRES-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'reset expires_at <= created_at' FROM gracz_password_reset_tokens WHERE expires_at<=created_at
    UNION ALL SELECT 'TS-RESET-USED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'used_at < created_at' FROM gracz_password_reset_tokens WHERE used_at IS NOT NULL AND used_at<created_at
    UNION ALL SELECT 'TS-REGCODE-EXPIRES-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'registration expires_at <= created_at' FROM gracz_registration_codes WHERE expires_at<=created_at
    UNION ALL SELECT 'TS-THOUSAND-UPDATED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'updated_at < created_at' FROM gracz_thousand_games WHERE updated_at<created_at
    UNION ALL SELECT 'TS-TOURNAMENT-FINISHED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'finished_at < created_at' FROM gracz_tournaments WHERE finished_at IS NOT NULL AND finished_at<created_at
    UNION ALL SELECT 'TS-TOURNAMENT-MATCH-COMPLETED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'completed_at < created_at' FROM gracz_tournament_matches WHERE completed_at IS NOT NULL AND completed_at<created_at
    UNION ALL SELECT 'TS-NEWSLETTER-SOURCE-UPDATED-BEFORE-CREATED','BLOCKER',COUNT(*)::bigint,'newsletter source updated_at < created_at' FROM newsletter_sources WHERE updated_at<created_at
) q ORDER BY severity,check_code;

\echo '=== 06 SEQUENCE SAFETY ==='
WITH seq AS (
    SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public'
), checks AS (
    SELECT 'gracz_newsletter_subscribers_id_seq' seq_name,(SELECT max(id) FROM gracz_newsletter_subscribers)::bigint max_id
    UNION ALL SELECT 'gracz_role_changes_change_id_seq',(SELECT max(change_id) FROM gracz_role_changes)::bigint
    UNION ALL SELECT 'gracz_role_history_change_id_seq',(SELECT max(change_id) FROM gracz_role_history)::bigint
    UNION ALL SELECT 'newsletter_consent_history_id_seq',(SELECT max(id) FROM newsletter_consent_history)::bigint
    UNION ALL SELECT 'newsletter_events_id_seq',(SELECT max(id) FROM newsletter_events)::bigint
    UNION ALL SELECT 'newsletter_sources_id_seq',(SELECT max(id) FROM newsletter_sources)::bigint
    UNION ALL SELECT 'newsletter_subscriber_sources_id_seq',(SELECT max(id) FROM newsletter_subscriber_sources)::bigint
)
SELECT c.seq_name,
       c.max_id,
       s.last_value,
       CASE WHEN s.sequencename IS NULL THEN 'BLOCKER-SEQUENCE-MISSING'
            WHEN c.max_id IS NOT NULL AND s.last_value IS NOT NULL AND s.last_value < c.max_id THEN 'BLOCKER-LAST-VALUE-BELOW-MAX'
            WHEN c.max_id IS NULL THEN 'EMPTY-TABLE'
            WHEN s.last_value > c.max_id THEN 'INFO-GAPS-EXPECTED-POSSIBLE'
            ELSE 'PASS' END AS assessment
FROM checks c LEFT JOIN seq s ON s.sequencename=c.seq_name
ORDER BY c.seq_name;

SELECT 'gracz_newsletter_subscriber_id_seq' AS sequence_name,
       COUNT(*)::bigint AS dependency_rows,
       CASE WHEN COUNT(*)=0 THEN 'REVIEW-UNOWNED-OR-LEGACY-SEQUENCE' ELSE 'DEPENDENCY-EXISTS' END AS assessment
FROM pg_depend d
JOIN pg_class s ON s.oid=d.objid AND s.relkind='S'
JOIN pg_namespace n ON n.oid=s.relnamespace
WHERE n.nspname='public' AND s.relname='gracz_newsletter_subscriber_id_seq';

\echo '=== 07 CRYPTO STRUCTURAL ANOMALIES ==='
SELECT * FROM (
    SELECT 'CRYPTO-ATTACHMENT-IV-MISSING' AS check_code,'BLOCKER' AS severity,COUNT(*)::bigint AS violations,'NULL/empty IV' AS note FROM gracz_message_attachments WHERE iv IS NULL OR octet_length(iv)=0
    UNION ALL SELECT 'CRYPTO-ATTACHMENT-TAG-MISSING','BLOCKER',COUNT(*)::bigint,'NULL/empty auth_tag' FROM gracz_message_attachments WHERE auth_tag IS NULL OR octet_length(auth_tag)=0
    UNION ALL SELECT 'CRYPTO-ATTACHMENT-CIPHERTEXT-MISSING','BLOCKER',COUNT(*)::bigint,'NULL/empty ciphertext' FROM gracz_message_attachments WHERE ciphertext IS NULL OR octet_length(ciphertext)=0
    UNION ALL SELECT 'CRYPTO-MFA-IV-MISSING','BLOCKER',COUNT(*)::bigint,'NULL/empty secret_iv' FROM gracz_mfa WHERE secret_iv IS NULL OR octet_length(secret_iv)=0
    UNION ALL SELECT 'CRYPTO-MFA-TAG-MISSING','BLOCKER',COUNT(*)::bigint,'NULL/empty secret_tag' FROM gracz_mfa WHERE secret_tag IS NULL OR octet_length(secret_tag)=0
    UNION ALL SELECT 'CRYPTO-MFA-CIPHERTEXT-MISSING','BLOCKER',COUNT(*)::bigint,'NULL/empty secret_ciphertext' FROM gracz_mfa WHERE secret_ciphertext IS NULL OR octet_length(secret_ciphertext)=0
) q ORDER BY severity,check_code;

-- Długości raportujemy jako agregaty diagnostyczne, bez ujawniania danych.
SELECT 'attachment_iv' AS field,octet_length(iv) AS byte_length,COUNT(*)::bigint AS rows
FROM gracz_message_attachments GROUP BY 1,2
UNION ALL SELECT 'attachment_auth_tag',octet_length(auth_tag),COUNT(*)::bigint FROM gracz_message_attachments GROUP BY 1,2
UNION ALL SELECT 'mfa_secret_iv',octet_length(secret_iv),COUNT(*)::bigint FROM gracz_mfa GROUP BY 1,2
UNION ALL SELECT 'mfa_secret_tag',octet_length(secret_tag),COUNT(*)::bigint FROM gracz_mfa GROUP BY 1,2
ORDER BY 1,2;

\echo '=== 08 STATUS / ENUM / SHAPE DISTRIBUTIONS ==='
-- Zagregowane wartości potrzebne do przyszłych CHECK i mappingu V3.
SELECT 'accounts.account_role' AS field,account_role::text AS value,COUNT(*)::bigint AS rows FROM gracz_accounts GROUP BY 1,2
UNION ALL SELECT 'chat_friends.status',status,COUNT(*)::bigint FROM gracz_chat_friends GROUP BY 1,2
UNION ALL SELECT 'moderation_appeals.status',status,COUNT(*)::bigint FROM gracz_moderation_appeals GROUP BY 1,2
UNION ALL SELECT 'moderation_decisions.outcome',outcome,COUNT(*)::bigint FROM gracz_moderation_decisions GROUP BY 1,2
UNION ALL SELECT 'newsletter.status',status,COUNT(*)::bigint FROM gracz_newsletter_subscribers GROUP BY 1,2
UNION ALL SELECT 'tournament.status',status,COUNT(*)::bigint FROM gracz_tournaments GROUP BY 1,2
UNION ALL SELECT 'tournament_player.status',status,COUNT(*)::bigint FROM gracz_tournament_players GROUP BY 1,2
UNION ALL SELECT 'tournament_match.status',status,COUNT(*)::bigint FROM gracz_tournament_matches GROUP BY 1,2
UNION ALL SELECT 'thousand.players.json_type',jsonb_typeof(players),COUNT(*)::bigint FROM gracz_thousand_games GROUP BY 1,2
UNION ALL SELECT 'thousand.state.json_type',jsonb_typeof(state),COUNT(*)::bigint FROM gracz_thousand_games GROUP BY 1,2
ORDER BY 1,2;

\echo '=== 09 ACTIVE-STATE SIGNALS FOR CUTOVER ==='
SELECT 'auth_sessions_not_revoked_and_not_expired' AS signal,COUNT(*)::bigint AS rows FROM gracz_auth_sessions WHERE revoked_at IS NULL AND expires_at>clock_timestamp()
UNION ALL SELECT 'warcaby_game_sessions',COUNT(*)::bigint FROM gracz_game_sessions
UNION ALL SELECT 'thousand_games',COUNT(*)::bigint FROM gracz_thousand_games
UNION ALL SELECT 'open_moderation_appeals',COUNT(*)::bigint FROM gracz_moderation_appeals WHERE status='open'
UNION ALL SELECT 'newsletter_pending_confirmation',COUNT(*)::bigint FROM gracz_newsletter_subscribers WHERE status='pending_confirmation'
UNION ALL SELECT 'tournaments_nonterminal',COUNT(*)::bigint FROM gracz_tournaments WHERE status NOT IN ('finished','cancelled','completed');

\echo '=== END DATA QUALITY PROFILE ==='
-- Interpretacja:
-- * BLOCKER > 0: nie przechodzić do odpowiadającego mu V3 constraint/backfill bez resolution/quarantine plan.
-- * REVIEW > 0: wymaga interpretacji na podstawie kontraktu aplikacyjnego i macierzy migracji.
-- * CRYPTO structural PASS nie oznacza decryptability PASS; decryptability wymaga kontrolowanego testu aplikacyjnego z właściwymi kluczami.

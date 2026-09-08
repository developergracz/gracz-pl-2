# GRACZ.PL — POSTGRESQL DATA CATALOG — TABELA PO TABELI

**Status:** LIVING DOCUMENTATION / CURRENT-MAIN BASELINE / NOT AS-BUILT  
**Repository:** `developergracz/gracz-pl-2`  
**Documentation branch:** `docs/master-history-gracz-pl-2026-09-08`  
**Verified code baseline:** `main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Verified baseline TREE:** `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`  
**P8 / PR #43:** OPEN / NOT MERGED / PENDING INDEPENDENT AUDIT  
**Merge authorization:** NONE  
**Deploy / production authorization:** NONE

---

## 1. Cel i granice dokumentu

Ten dokument jest szczegółowym katalogiem struktur PostgreSQL, które są tworzone, wymagane albo bezpośrednio używane przez aktywny kod runtime na zweryfikowanym `main`.

Nie wolno utożsamiać tego dokumentu z:

- finalnym schematem produkcyjnym AS-BUILT,
- potwierdzeniem, że każda tabela istnieje już na produkcji,
- autoryzacją migracji,
- autoryzacją zmian bazy,
- projektem FairPlay MAX.

Źródłem prawdy dla wpisów są konkretne implementacje PostgreSQL w `modern/checkers-engine/src/` oraz ich rzeczywiste zapytania SQL. Elementy, których istnienia nie potwierdzono w kodzie, nie są dodawane jako stan bieżący.

---

## 2. Zweryfikowany inventory current-main

Końcowy przegląd aktywnego runtime potwierdził **30 tabel / struktur PostgreSQL**:

1. `gracz_game_sessions`
2. `gracz_match_runtime_ownership`
3. `gracz_match_runtime_commands`
4. `gracz_gomoku_games`
5. `gracz_thousand_games`
6. `gracz_accounts`
7. `gracz_messages`
8. `gracz_message_attachments`
9. `gracz_auth_sessions`
10. `gracz_registration_codes`
11. `gracz_password_reset_tokens`
12. `gracz_roles`
13. `gracz_role_history`
14. `gracz_mfa`
15. `gracz_audit_log`
16. `gracz_moderation_decisions`
17. `gracz_moderation_appeals`
18. `gracz_tournaments`
19. `gracz_tournament_players`
20. `gracz_tournament_matches`
21. `gracz_chat_topics`
22. `gracz_global_chat`
23. `gracz_chat_friends`
24. `gracz_global_chat_reports`
25. `gracz_newsletter_subscribers`
26. `newsletter_sources`
27. `newsletter_subscriber_sources`
28. `newsletter_consent_history`
29. `newsletter_events`
30. `gracz_shared_rate_limits`

`PostgresRealtimeHub` korzysta z PostgreSQL `LISTEN/NOTIFY`, ale nie tworzy osobnej tabeli realtime. Ranking jest wyliczany z tabel źródłowych i również nie ma własnej tabeli rankingowej.

---

# 3. GAME STATE / MATCH RUNTIME

## 3.1 `gracz_game_sessions`

**Owner:** Checkers / common session persistence / P7 MatchRuntime storage.  
**Source:** `src/postgres-session-store.js`.

**Kolumny:**
- `game_id VARCHAR(128) PRIMARY KEY`
- `state TEXT NOT NULL`
- `version INTEGER NOT NULL DEFAULT 1`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Indeksy:** `gracz_game_sessions_updated_idx(updated_at DESC)`.

**Concurrency:** klasyczny CAS. Zapis legacy session wymaga oczekiwanej `version`; `UPDATE ... WHERE game_id=? AND version=?`. Konflikt kończy się kontrolowanym konfliktem wersji, a nie nadpisaniem cudzej zmiany.

**P7:** ta tabela jest także authoritative state store dla MatchRuntime. Runtime command blokuje rekord `FOR UPDATE`, sprawdza wersję i dopiero wtedy zapisuje nowy stan.

**Privacy:** `state` może zawierać stan meczu i identyfikatory graczy. Publiczny widok nie powinien być budowany bezpośrednio z surowego rekordu DB; projekcja należy do warstwy runtime/session.

**Retention:** brak zweryfikowanej ogólnej polityki usuwania w tym module — `FULL AUDIT REQUIRED`.

**Consumers:** Checkers API, MatchRuntime, rankings, PostgreSQL realtime snapshot reload, readiness store.

---

## 3.2 `gracz_match_runtime_ownership`

**Owner:** P7 MatchRuntime fencing.

**Kolumny:**
- `match_id VARCHAR(128) PRIMARY KEY REFERENCES gracz_game_sessions(game_id) ON DELETE CASCADE`
- `owner_id VARCHAR(128) NOT NULL`
- `ownership_epoch BIGINT NOT NULL CHECK (ownership_epoch > 0)`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Concurrency / safety:** `claimMatchOwnership()` tworzy lub przejmuje ownership i zwiększa `ownership_epoch`. Każda mutacja MatchRuntime weryfikuje `owner_id + ownership_epoch`. Stary proces po utracie własności zostaje odgrodzony.

**Lifecycle:** kasowana kaskadowo wraz z `gracz_game_sessions`.

---

## 3.3 `gracz_match_runtime_commands`

**Owner:** P7 durable idempotency / replay evidence.

**Kolumny:**
- `match_id VARCHAR(128) NOT NULL REFERENCES gracz_game_sessions(game_id) ON DELETE CASCADE`
- `idempotency_key VARCHAR(128) NOT NULL`
- `command_hash CHAR(64) NOT NULL`
- `expected_version INTEGER NOT NULL`
- `result_version INTEGER NOT NULL`
- `ownership_epoch BIGINT NOT NULL`
- `result_state TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `PRIMARY KEY(match_id, idempotency_key)`

**Indeks:** `gracz_match_runtime_commands_created_idx(created_at DESC)`.

**Semantyka:** ten sam `idempotency_key` + ten sam `command_hash` może zostać bezpiecznie odtworzony z zapisanego wyniku. Ten sam klucz użyty dla innej komendy jest konfliktem idempotency.

**Lifecycle:** CAS + ownership + zapis result state odbywa się w jednej transakcji z aktualizacją sesji. Kaskada po usunięciu sesji.

**Retention:** brak osobnego zweryfikowanego TTL — do rozstrzygnięcia w pełnym audycie i finalnej polityce retencji.

---

## 3.4 `gracz_gomoku_games`

**Owner:** durable Gomoku.

`PostgresGomokuService` **nie tworzy schematu**; przy starcie weryfikuje go przez `information_schema` i fail-closed odrzuca brakującą lub niezgodną strukturę.

**Wymagane kolumny:**
- `game_id VARCHAR/TEXT NOT NULL PRIMARY KEY`
- `state JSONB NOT NULL`
- `revision INTEGER NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

**Concurrency:** CAS `UPDATE ... WHERE game_id=? AND revision=?`. Po przegranym CAS najnowszy stan jest ponownie ładowany; identyczne powtórzenie `requestId` może zostać uznane za bezpieczny replay, a realny konflikt kończy się `GOMOKU_CONCURRENCY_CONFLICT`.

**State validation:** przy odczycie sprawdzane są m.in. gameId, revision, gracze, kolejność ruchów, zajęte pola, requestId, status, winner i spójność timestampów. Niespójny persisted state jest fail-closed.

**Retention:** nie określono w tym module.

---

## 3.5 `gracz_thousand_games`

**Owner:** Tysiąc persistence.

**Kolumny:**
- `game_id VARCHAR(96) PRIMARY KEY`
- `players JSONB NOT NULL`
- `state JSONB NOT NULL`
- `revision BIGINT NOT NULL DEFAULT 1`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Concurrency:** CAS `WHERE game_id=? AND revision=?`; konflikt → `THOUSAND_CONCURRENCY_CONFLICT`. HTTP może dodatkowo dostarczyć `expectedRevision`.

**Privacy:** `players` i `state` są authoritative persisted data. Widok dla gracza powstaje przez `thousandPublicView`, nie przez bezpośrednie zwrócenie całego rekordu.

**Ważne ograniczenie current-main:** obecny engine Tysiąca nadal tasuje przez game-local RNG w warstwie usługi. To **nie jest FairPlay MAX**.

**Retention:** nie określono w tym module.

---

# 4. ACCOUNTS / AUTH / PRIVATE MESSAGING

## 4.1 `gracz_accounts`

**Owner:** konta, profile, credential material.

**Bazowe kolumny:**
- `user_id VARCHAR(32) PRIMARY KEY`
- `display_name VARCHAR(40) NOT NULL`
- `salt BYTEA NOT NULL`
- `password_hash BYTEA NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Rozszerzenia runtime:**
- `email VARCHAR(254)`
- `recovery_email VARCHAR(254)`
- `profile_data JSONB NOT NULL DEFAULT '{}'`
- `password_hash_version SMALLINT NOT NULL DEFAULT 1`
- `phone VARCHAR(24)`
- `verification_channel VARCHAR(10) NOT NULL DEFAULT 'email'`
- `contact_verified BOOLEAN NOT NULL DEFAULT FALSE`

**Credential security:** hasła nie są zapisywane jawnie. `SecureAccountService` używa wersjonowanego scrypt; bieżący hash version 2 stosuje silniejsze parametry niż legacy i może aktualizować hash po poprawnym logowaniu.

**Uniqueness concurrency:** rejestracja/aktualizacja używa transakcyjnych advisory locks dla display name i email, aby ograniczyć race conditions wokół logicznej unikalności.

**PII:** email, recovery email, phone i część `profile_data` są danymi prywatnymi. Finalna polityka retencji/deletion wymaga osobnego privacy review.

---

## 4.2 `gracz_messages`

**Owner:** prywatne wiadomości.

**Kolumny:**
- `message_id UUID PRIMARY KEY`
- `sender_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE`
- `recipient_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE`
- `subject TEXT NOT NULL`
- `body TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `read_at TIMESTAMPTZ`
- `recipient_archived BOOLEAN NOT NULL DEFAULT FALSE`
- `sender_deleted BOOLEAN NOT NULL DEFAULT FALSE`
- `recipient_deleted BOOLEAN NOT NULL DEFAULT FALSE`

**Indeksy:** recipient+created DESC, sender+created DESC.

**Encryption:** bieżący write path szyfruje subject i body aplikacyjnie AES-256-GCM z kluczem wydzielonym dla wiadomości. Istnieje kontrolowany legacy decrypt path z sygnałem auditowym.

**Deletion:** usunięcie przez jedną stronę ustawia jej flagę. Fizyczny rekord jest kasowany dopiero, gdy obie strony oznaczą wiadomość jako usuniętą. Usunięcie konta może uruchomić FK cascade.

---

## 4.3 `gracz_message_attachments`

**Owner:** załączniki prywatnych wiadomości.

**Kolumny:**
- `message_id UUID PRIMARY KEY REFERENCES gracz_messages(message_id) ON DELETE CASCADE`
- `file_name VARCHAR(120) NOT NULL`
- `storage_name VARCHAR(80)`
- `mime_type VARCHAR(32) NOT NULL`
- `file_size INTEGER NOT NULL`
- `iv BYTEA NOT NULL`
- `auth_tag BYTEA NOT NULL`
- `ciphertext BYTEA NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Security:** do 1 MiB, tylko PNG/JPEG, signature check. Payload jest szyfrowany AES-256-GCM oddzielnym kluczem HKDF/domain od wiadomości i MFA. AAD wiąże ciphertext z messageId/storageName/mime/size.

**Cardinality:** jeden załącznik na wiadomość przez PK `message_id`.

**Lifecycle:** ON DELETE CASCADE z wiadomością.

---

## 4.4 `gracz_auth_sessions`

**Owner:** server-side session lifecycle.

**Kolumny:**
- `token_id UUID PRIMARY KEY`
- `user_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `expires_at TIMESTAMPTZ NOT NULL`
- `revoked_at TIMESTAMPTZ`

**Indeksy:** user+expiry DESC, expiry.

**Retention / cleanup — jawnie zaimplementowane:** usuwane są sesje wygasłe ponad 1 dzień temu, revoked ponad 7 dni temu lub niewidziane ponad 2 dni. Domyślny idle timeout aktywnej sesji = 30 minut.

**Security:** baza przechowuje `token_id`, a nie pełny bearer/cookie token.

---

## 4.5 `gracz_registration_codes`

**Owner:** aktywacja konta.

**Kolumny:** `user_id` PK/FK account cascade, `code_hash BYTEA`, `expires_at`, `attempts`, `created_at`.

**Security/lifecycle:** kod 6-cyfrowy jest hashowany; typowy TTL = 10 minut; licznik prób jest trwały; po poprawnej weryfikacji rekord jest kasowany. Nie przechowuje plaintext code.

---

## 4.6 `gracz_password_reset_tokens`

**Owner:** odzyskiwanie hasła.

**Kolumny:**
- `token_hash BYTEA PRIMARY KEY`
- `user_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE`
- `expires_at TIMESTAMPTZ NOT NULL`
- `used_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Indeks:** user+created DESC.

**Security:** DB przechowuje hash tokenu/kodu. Publiczne recovery responses są neutralizowane, aby ograniczyć account enumeration. Bieżące flows stosują krótkie TTL (10 lub 15 minut zależnie od ścieżki). Poprawny reset oznacza tokeny użytkownika jako zużyte; wygasłe tokeny są czyszczone przez kod.

---

# 5. RBAC / MFA / AUDIT / MODERATION

## 5.1 `gracz_roles`

PK/FK account cascade. Pola: `user_id`, `role`, `mfa_required`, `updated_at`. CHECK dopuszcza `player`, `moderator`, `administrator`, `owner`.

Zmiana roli uprzywilejowanej jest kontrolowana przez RBAC + MFA. Owner bootstrap jest warunkowy i wymaga istniejącego konta.

---

## 5.2 `gracz_role_history`

Pola: `change_id BIGSERIAL PK`, `user_id`, `old_role`, `new_role`, `changed_by`, `changed_at`.

Zapisywana w tej samej transakcji co aktualizacja `gracz_roles`.

**AUDIT OBSERVATION:** w zweryfikowanym CREATE TABLE nie ma jawnego FK dla `user_id` ani `changed_by`. To nie jest tutaj automatycznie klasyfikowane jako defekt; pełny audyt powinien ocenić zamierzoną retencję historii po usunięciu konta.

---

## 5.3 `gracz_mfa`

PK/FK account cascade. Pola: kind, `secret_iv`, `secret_tag`, `secret_ciphertext`, enabled, created_at, verified_at.

**Security:** TOTP secret jest szyfrowany AES-256-GCM kluczem wydzielonym przez HKDF dla domeny MFA. Plaintext secret nie jest trwałym polem DB. SHA-1 występuje jako standardowy algorytm HMAC w TOTP, nie jako ogólny hash haseł.

---

## 5.4 `gracz_audit_log`

Pola: `event_id UUID PK`, occurred_at, actor_id, event_type, outcome, target_type/id, source_hash, user_agent_hash, metadata JSONB.

**Indeksy:** time DESC, actor+time, event_type+time.

**Append-only control:** trigger `gracz_audit_log_immutable()` blokuje UPDATE i DELETE; dodatkowo runtime próbuje odebrać PUBLIC prawa UPDATE/DELETE/TRUNCATE.

**Privacy:** source i user agent są fingerprintowane SHA-256 z saltem; metadata sanitizer odrzuca pola przypominające password/token/secret/authorization/cookie/body/message/content/API key.

**Granica gwarancji:** append-only trigger w tej samej operator-controlled bazie nie jest równoważny niezależnemu, zewnętrznie zakotwiczonemu immutable ledgerowi.

---

## 5.5 `gracz_moderation_decisions`

Pola: decision_id UUID PK, user_id nullable, context, outcome, reason, content_hash nullable, created_at.

Bieżący `record()` zapisuje decyzję/reason; blokowana treść nie jest przez tę ścieżkę kopiowana do tabeli.

---

## 5.6 `gracz_moderation_appeals`

Pola: appeal_id UUID PK, decision_id FK decisions ON DELETE CASCADE, user_id, explanation, status, reviewed_by, created_at, reviewed_at.

**AUDIT OBSERVATION:** brak jawnych FK do accounts dla `user_id` i `reviewed_by` w zweryfikowanym CREATE TABLE. Do oceny wraz z wymaganiami privacy/legal i zachowania historii moderacji.

---

# 6. TOURNAMENTS

## 6.1 `gracz_tournaments`

PK `tournament_id UUID`; owner id/name, title, description, game, format, status, visibility, max_players, rounds, time_control, rated, starts_at, current_round, created_at, finished_at.

Indeks: `(status, starts_at)`.

**P8 boundary:** current `main` nadal ma historyczny lokalny game dictionary w module turniejowym. PR #43 zmienia go na centralny canonical game type contract, ale nie jest jeszcze zmergowany i nie autoryzuje migracji danych. Historyczne wartości `warcaby` mogą więc pozostać w persistence nawet po późniejszym runtime normalization.

---

## 6.2 `gracz_tournament_players`

Composite PK `(tournament_id,user_id)`, FK tournament cascade. Zawiera display name, seed, points, wins/draws/losses, buchholz, status, joined_at.

---

## 6.3 `gracz_tournament_matches`

PK match_id; FK tournament cascade; round/board; white/black id+name; result; status; reported_by; created/completed timestamps.

Indeks `(tournament_id, round, board)` i UNIQUE `(tournament_id, round, board)`.

**Concurrency:** reporting result używa transakcji, `FOR UPDATE` na turnieju/meczu i warunkowego UPDATE statusu. Jest to obszar zamkniętego P1-H-01.

---

# 7. GLOBAL CHAT / COMMUNITY

## 7.1 `gracz_chat_topics`

PK topic_id; owner id/name; title; description; category; created_at; closed. Indeks created_at DESC.

---

## 7.2 `gracz_global_chat`

PK message_id; user id/name; body; reply_to; topic_id; reactions JSONB; timestamps; deleted.

Indeksy: created_at DESC, user+created, topic+created.

**Deletion:** soft delete ustawia `deleted=TRUE` i czyści body. Edycja jest ograniczona czasowo przez logikę serwisu.

**AUDIT OBSERVATION:** w zweryfikowanym CREATE TABLE `topic_id`, `reply_to` i `user_id` nie mają jawnych FK. Należy zweryfikować, czy jest to celowy model loose-coupling/history, czy brak integralności do korekty.

---

## 7.3 `gracz_chat_friends`

PK relation_id; requester/addressee id+name; status; created/updated. CHECK requester != addressee. UNIQUE `(requester_id,addressee_id)`. Indeks users+status.

**AUDIT OBSERVATION:** brak jawnych account FK w runtime schema.

---

## 7.4 `gracz_global_chat_reports`

PK report_id; message_id; reporter_id; reason; created_at; UNIQUE `(message_id,reporter_id)`.

**AUDIT OBSERVATION:** brak jawnych FK do chat message/account w zweryfikowanym CREATE TABLE.

---

# 8. NEWSLETTER / CONSENT / ANALYTICS

## 8.1 `gracz_newsletter_subscribers`

PK BIGSERIAL id; email i email_normalized UNIQUE; optional nick + normalized nick; consent_version/consented_at; status; hashed confirmation/position/unsubscribe tokens i ich timestamps; created/updated.

**Indeksy/constraints:**
- unique id,
- unique email/email_normalized,
- partial unique preferred nick dla `pending_confirmation/subscribed`,
- partial indexes na token hashes gdy nie-NULL.

**Privacy:** e-mail jest PII przechowywany jawnie, ponieważ jest potrzebny do delivery. Zwykły panel administracyjny używa masked email; pełny reveal wymaga dedykowanego RBAC permission + MFA.

**Double opt-in:** confirmation token jest hashowany; nie przechowuje się plaintext tokenu w DB.

---

## 8.2 `newsletter_sources`

PK id; unique code; name; description; source_type z CHECK; active; timestamps. Runtime seeduje źródło `homepage`.

---

## 8.3 `newsletter_subscriber_sources`

PK id; FK subscriber `ON DELETE RESTRICT`; FK source `ON DELETE RESTRICT`; first_seen_at; campaign_reference; partner_reference; metadata; UNIQUE subscriber+source.

RESTRICT jest istotny dla zachowania provenance i wymusza świadome rozwiązanie powiązań przy procesie usuwania danych.

---

## 8.4 `newsletter_consent_history`

PK id; FK subscriber `ON DELETE RESTRICT`; consent type/version; action CHECK `granted/confirmed/revoked`; source; occurred_at; metadata.

Indeksy: subscriber+time, time DESC, consent type+action.

**Znaczenie:** historyczny/legal evidence trail zgody. Finalna privacy/legal polityka musi jawnie zdefiniować podstawę, czas retencji i proces realizacji praw użytkownika.

---

## 8.5 `newsletter_events`

PK id; nullable FK subscriber `ON DELETE SET NULL`; nullable FK source `ON DELETE SET NULL`; event_type; occurred_at; source_hash; user_agent_hash; metadata.

Indeksy: time, subscriber+time, type+time, source+time.

Admin service filtruje w metadata m.in. email/token/secret/password/auth/cookie/IP/user-agent. Lifecycle recorder zapisuje subscribe/resend/confirmed/unsubscribed; wybrane zdarzenia są best-effort deduplikowane logiką zapytania, nie osobnym UNIQUE constraint.

---

# 9. SHARED INFRASTRUCTURE

## 9.1 `gracz_shared_rate_limits`

**Owner:** `PostgresDistributedTrafficGuard`.

**Kolumny:**
- `key_hash CHAR(64) PRIMARY KEY`
- `count INTEGER NOT NULL`
- `reset_at BIGINT NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Indeks:** `gracz_shared_rate_limits_reset_idx(reset_at)`.

**Privacy:** logical rate-limit key (IP/account/endpoint combinations) jest przed zapisem hashowany SHA-256; tabela nie zapisuje jawnego klucza logicznego.

**Concurrency:** `INSERT ... ON CONFLICT DO UPDATE` atomowo zwiększa licznik albo resetuje okno. Inicjalizacja schema używa advisory lock.

**Availability behavior:** shared limiter jest elementem ochronnym fail-closed; awaria współdzielonej infrastruktury może zwrócić 503 zamiast cicho wyłączyć enforcement.

**Cleanup:** best-effort usuwa rekordy z `reset_at` starszym niż około 24 h poza bieżącym czasem resetu.

---

# 10. STRUKTURY, KTÓRE NIE SĄ TABELAMI

## 10.1 Rankings

Brak dedykowanej tabeli rankingu. `RankingService` wylicza read model z:
- `gracz_game_sessions` — zakończone Checkers,
- `gracz_thousand_games` — zakończony Tysiąc,
- `gracz_accounts` — nazwa/profil.

Na current-main Gomoku nie uczestniczy w rankingu.

## 10.2 PostgreSQL realtime

`PostgresRealtimeHub` używa `LISTEN/NOTIFY` kanału `gracz_checkers_realtime`. Notification niesie tylko mały sygnał `gameId/type`; authoritative state jest ponownie ładowany z `gracz_game_sessions`. Nie ma tabeli realtime-event-payload.

## 10.3 SecurityMonitor

Okno detekcji spike'ów jest in-memory; alerty są utrwalane przez `AuditService` w `gracz_audit_log` i opcjonalnie wysyłane webhookiem. Nie ma oddzielnej tabeli security monitor.

---

# 11. CAS / IDEMPOTENCY / FENCING MATRIX

| Domena | Persisted concurrency control | Idempotency | Fencing |
|---|---|---|---|
| Checkers legacy session | `version` CAS | session/request semantics | nie dotyczy legacy path |
| Checkers P7 MatchRuntime moves | row lock + expectedVersion | `gracz_match_runtime_commands` + command hash | `owner_id + ownership_epoch` |
| Gomoku | `revision` CAS | requestId w persisted state | brak wspólnego MatchRuntime fencing |
| Tysiąc | `revision` CAS / expectedRevision | brak wspólnej durable command table | brak wspólnego MatchRuntime fencing |
| Tournament result | transaction + `FOR UPDATE` + guarded status update | completed status prevents duplicate result | nie dotyczy |
| Shared rate limit | atomic UPSERT | key/window semantics | nie dotyczy |

To rozróżnienie jest obowiązkowe: P7 common MatchRuntime istnieje, ale nie wszystkie gry zostały do niego przeniesione.

---

# 12. SENSITIVE DATA MATRIX

| Dane | Tabela | Ochrona potwierdzona w kodzie |
|---|---|---|
| Password verifier | `gracz_accounts` | salt + scrypt hash, versioning |
| Private message subject/body | `gracz_messages` | AES-256-GCM app encryption |
| Attachment bytes | `gracz_message_attachments` | AES-256-GCM, separate HKDF domain |
| MFA TOTP secret | `gracz_mfa` | AES-256-GCM, separate HKDF domain |
| Registration code | `gracz_registration_codes` | hash only |
| Password reset code/token | `gracz_password_reset_tokens` | hash only |
| Session JWT/token | brak pełnego tokenu w `gracz_auth_sessions` | DB stores token_id/lifecycle only |
| Newsletter confirmation/position/unsubscribe | `gracz_newsletter_subscribers` | hashes only |
| Newsletter email | `gracz_newsletter_subscribers` | plaintext PII required for delivery; masked admin by default |
| Audit source/UA | `gracz_audit_log` | salted SHA-256 fingerprint |
| Rate-limit identity key | `gracz_shared_rate_limits` | SHA-256 key hash |

Encryption-at-rest na poziomie dostawcy PostgreSQL / dysku nie jest tym dokumentem potwierdzana i musi być osobno zweryfikowana dla faktycznej produkcji.

---

# 13. RETENTION / DELETION — STAN POTWIERDZONY

Jawnie potwierdzone mechanizmy:

- auth sessions: cleanup dla starych expiry/revocation/inactivity,
- registration code: krótki TTL i usunięcie po aktywacji,
- reset token: krótki TTL, pruning/used_at,
- private message: per-side soft deletion, fizyczne usunięcie po usunięciu przez obie strony,
- attachment: cascade z wiadomością,
- global chat: soft delete + body cleared,
- role history/audit/newsletter consent: history-oriented storage,
- newsletter consent/source relations: część relacji ma `ON DELETE RESTRICT`,
- shared rate limits: best-effort cleanup po wygaśnięciu okien.

Dla pozostałych domen nie stwierdzono kompletnej, wspólnej polityki retencji w badanych modułach. Finalny FULL MAX dokument musi zawierać centralną retention matrix z podstawą biznesową/prawną i mechanizmem purge/archive.

---

# 14. REFERENTIAL-INTEGRITY AUDIT OBSERVATIONS

Do pełnego audytu po P8 trafiają jako obserwacje, a nie automatyczne blocking findings:

- `gracz_role_history.user_id / changed_by` — brak jawnych account FK,
- `gracz_moderation_decisions.user_id` i appeals user/reviewer — brak jawnych account FK,
- `gracz_global_chat.user_id/topic_id/reply_to` — brak jawnych FK w runtime CREATE TABLE,
- `gracz_chat_friends` — brak jawnych account FK,
- `gracz_global_chat_reports` — brak jawnych FK do message/account.

Audyt ma dla każdego rozstrzygnąć, czy brak FK jest celowym wymogiem zachowania historii / loose coupling, czy ryzykiem orphan records i integralności.

---

# 15. BACKUP / DR

Wszystkie tabele znajdujące się w tej samej bazie PostgreSQL powinny wejść do logicznego zakresu backup/restore, o ile przyszły manifest backupu nie wykluczy jawnie danych efemerycznych.

P1-R-01 Recurring PostgreSQL DR Restore Program został formalnie zamknięty na poziomie technicznym z realnym restore do odrębnego klastra testowego. **Nie oznacza to wykonania restore na produkcji.**

Przy finalnym AS-BUILT należy udowodnić:
- które tabele są objęte backupem,
- czy sequence/identity, functions i triggers są odtwarzane,
- czy `gracz_audit_log_immutable()` trigger wraca po restore,
- czy FK/index/constraints są zgodne,
- czy encrypted payloads są możliwe do odszyfrowania aktualnymi/archiwalnymi kluczami,
- czy restore nie prowadzi do reuse/rollback problemów w przyszłym FairPlay ledgerze.

---

# 16. P8 / PR #43 — DATABASE IMPACT BOUNDARY

P8 jest niezmergowanym work itemem dotyczącym canonical game type dictionary. Jego zamierzone efekty runtime obejmują canonical IDs `checkers/gomoku/thousand`, alias `warcaby -> checkers` i fail-closed unknown IDs.

**P8 nie autoryzuje produkcyjnej migracji DB.** W szczególności historyczne rekordy turniejowe zapisane jako `warcaby` mają pozostać kompatybilne przez normalizację odczytu, a nie przez nieautoryzowany rewrite danych.

Do czasu formalnego merge P8 niniejszy katalog opisuje zachowanie current-main i traktuje P8 jako `PENDING DELTA`.

---

# 17. FAIRPLAY MAX / GFPE — PLANNED, NOT IMPLEMENTED

Na current-main nie istnieją jeszcze autoryzowane tabele GFPE/FairPlay MAX.

Przyszły projekt może wymagać struktur dla m.in.:
- fairness session / hand / round,
- entropy commitments/reveals,
- server commitments,
- frozen deck/shoe commitment,
- deal/card position evidence,
- signed proofs / Verify Hand,
- tamper-evident ledger/checkpoints,
- key metadata/lifecycle.

Nazwy, kolumny i constraints **nie są jeszcze zamrożone** i nie wolno ich traktować jako istniejący schema contract.

Status: `PRE-DESIGN ONLY / NOT FROZEN / IMPLEMENTATION NOT AUTHORIZED / PRODUCTION USE NO`.

---

# 18. WARUNKI PRZEJŚCIA DO FINAL AS-BUILT DATA CATALOG

Ten katalog może zostać zamrożony jako finalny dopiero po:

1. formalnym zamknięciu P8,
2. pełnym audycie całego projektu,
3. weryfikacji wszystkich realnych migracji i bootstrapów schema,
4. odczycie faktycznego production schema z `information_schema/pg_catalog`,
5. porównaniu `documented vs code vs production`,
6. rozstrzygnięciu referential-integrity observations,
7. zatwierdzeniu retention/deletion matrix,
8. weryfikacji backup/restore wszystkich wymaganych obiektów,
9. zaprojektowaniu i późniejszej implementacji GFPE bez mieszania planu ze stanem istniejącym,
10. osobnej autoryzacji Owner + Lead dla finalnego AS-BUILT.

**Current verdict:** `POSTGRESQL DATA CATALOG BASELINE = CREATED / LIVING / NOT FROZEN`.

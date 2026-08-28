# Model danych docelowy PostgreSQL V3 — Gracz.pl

Data: 28.08.2026
Status: **ETAP 2 — ARCHITEKTURA DOCELOWA / iteracja 1**

> Uwaga numeracyjna: dokument otrzymuje numer `12`, ponieważ w katalogu `02-BAZA-DANYCH/` numery `01–11` są już zajęte przez dokumentację AS-IS i zamknięcie ETAPU 1B. Nie nadpisujemy istniejącego `03-GRY-TYSIAC-POSTGRESQL-AS-IS.md`.

## 1. Założenia ogólne i relacja do Backend V3

### 1.1 Cel

Ten dokument definiuje **docelowy model danych PostgreSQL V3** dla architektury opisanej w `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`.

Nie jest to plan doraźnego łatania obecnego schematu. Model V3 ma zapewnić trwałą podstawę dla:
- bounded contexts,
- single-writer / match-actor,
- ochrony przed split-brain,
- wersjonowania agregatów,
- Transactional Outbox,
- idempotency,
- Realtime Gateway,
- trwałości wszystkich gier,
- atomowych operacji turniejowych,
- kanonicznego modelu ról i audytu,
- uporządkowanego lifecycle newslettera,
- migracji etapowej z rollbackiem.

### 1.2 Relacja do ETAPU 1B

ETAP 1B potwierdził:
- mapę kodową 26 tabel,
- rzeczywisty schemat Render zawierający 28 tabel,
- schema drift newslettera,
- dodatkowy legacy audit,
- równoległe modele historii ról,
- dodatkowe `version` w `gracz_game_sessions`.

Każda z 28 rzeczywistych tabel Render otrzymuje poniżej decyzję projektową V3. Decyzja ta nie oznacza jeszcze wykonania migracji ani zgody na DROP. Destrukcyjne operacje wymagają analizy danych, aktywnych writerów/readers, retencji, backupu i planu rollback.

### 1.3 Kategorie decyzji

- **KEEP-AS-IS** — zachować strukturę 1:1; używać tylko tam, gdzie model już spełnia V3.
- **MIGRATE-AND-TRANSFORM** — dane pozostają potrzebne, lecz docelowa struktura/semantyka ulega zmianie.
- **MERGE** — dane z istniejącej tabeli zostaną skonsolidowane z innym kanonicznym modelem.
- **DEPRECATE** — tabela ma zostać wycofana dopiero po potwierdzeniu braku aktywnych zależności i spełnieniu retencji.

W iteracji 1 nie przypisujemy `KEEP-AS-IS` automatycznie tylko dlatego, że tabela jest poprawna technicznie. Backend V3 zmienia granice własności danych i kontrakty domenowe, więc większość tabel wymaga co najmniej świadomej migracji/normalizacji.

## 2. Bounded contexts i docelowe grupy tabel

Nazwy poniżej są **nazwami projektowymi V3**. Konkretne kolumny, typy, PK/FK/UNIQUE/CHECK zostaną zatwierdzone w kolejnej iteracji.

### 2.1 Identity & Access

Docelowa grupa:
- `users`,
- `user_profiles`,
- `auth_sessions`,
- `password_reset_tokens`,
- `mfa_credentials`,
- `registration_codes`,
- `roles`,
- `user_roles`,
- `role_change_events`,
- `user_security_events`.

Założenie: jeden kanoniczny model użytkownika, sesji i uprawnień. Historia zmian ról jest append-only i audytowalna.

### 2.2 Audit

Docelowa grupa:
- `audit_log`,
- opcjonalna warstwa archiwalna wynikająca z polityki retencji.

`audit_log` jest kanonicznym, append-only dziennikiem operacji administracyjnych i bezpieczeństwa z korelacją `request_id` / `correlation_id` / actor / subject / action / result.

### 2.3 Game Platform

Docelowa grupa:
- `game_definitions`,
- `game_matches`,
- `game_match_players`,
- `game_match_events`,
- `game_match_snapshots`,
- opcjonalne read-models/projections dla historii i rankingów.

Warcaby, Tysiąc, Gomoku i przyszłe gry korzystają ze wspólnego kontraktu match runtime, ale ich silniki domenowe pozostają niezależne.

Każdy `game_matches` ma jawne `version`. Krytyczny zapis meczu odbywa się przez jednego logicznego writera. Ownership/lease/fencing nie może opierać się wyłącznie na pamięci procesu.

### 2.4 Tournament

Docelowa grupa:
- `tournaments`,
- `tournament_registrations`,
- `tournament_rounds`,
- `tournament_matches`,
- `tournament_standings` jako kanoniczna projekcja lub materializowany read-model, jeśli zostanie zatwierdzony.

`tournament_matches` ma jawne powiązanie z kanonicznym `game_matches.match_id`. Krytyczne przejścia `join/start/report_result/advance_round` podlegają kontroli współbieżności i atomowości.

### 2.5 Messaging

Docelowa grupa:
- `private_messages`,
- `private_message_attachments`,
- ewentualne jawne read-state/folder-state, jeśli wymagane przez kontrakt produktu.

Szyfrowanie i retencja pozostają własnością Messaging. Fizyczne kasowanie nie może naruszać polityki dostępu drugiej strony ani wymagań audytowych.

### 2.6 Global Chat & Social

Docelowa grupa:
- `chat_topics`,
- `chat_messages`,
- `chat_reactions`,
- `social_friendships` lub równoważny kanoniczny model relacji,
- `chat_reports`.

Presence i aktywne realtime subscriptions są stanem efemerycznym i nie muszą być trwałym modelem PostgreSQL. Nie projektujemy `realtime_subscriptions` jako obowiązkowej tabeli źródła prawdy. Trwałe cursory/subscription preferences mogą otrzymać osobny model tylko wtedy, gdy wymaganie produktowe tego wymaga.

Reakcje powinny odejść od whole-object JSON read-modify-write na rzecz atomowego modelu relacyjnego lub równoważnej bezpiecznej reprezentacji.

### 2.7 Moderation

Docelowa grupa:
- `moderation_decisions`,
- `moderation_appeals`,
- `moderation_sanctions`,
- `moderation_reviews` lub równoważny jawny workflow.

Moderation nie zapisuje bezpośrednio do tabel innych bounded contexts.

### 2.8 Newsletter

Docelowa grupa:
- `newsletter_subscribers`,
- `newsletter_sources`,
- `newsletter_subscriber_sources`,
- `newsletter_consent_history`,
- `newsletter_events`.

Stan bieżący subskrybenta i historia zdarzeń/zgód pozostają rozdzielone. Hybrydowy `gracz_newsletter_subscribers` zostaje znormalizowany do jednego kanonicznego ID i jednego zestawu pól lifecycle. Legacy tokeny i zdublowane pola nie pozostają bezterminowo.

Wysyłka email przebiega: transakcja domenowa -> outbox -> worker -> provider -> delivery event.

### 2.9 Integration / Outbox / Idempotency

Docelowa grupa:
- `outbox_events`,
- `idempotency_keys` lub `processed_messages`,
- opcjonalne consumer checkpoints/projection checkpoints.

Minimalny kontrakt `outbox_events`:
- `event_id`,
- `aggregate_type`,
- `aggregate_id`,
- `aggregate_version`,
- `event_type`,
- `payload`,
- `occurred_at`,
- `correlation_id`,
- `causation_id`,
- `status`,
- `attempt_count`,
- `published_at`/`processed_at`,
- `last_error` według finalnej polityki operacyjnej.

Minimalny kontrakt idempotency:
- klucz komendy/message,
- context/consumer,
- wynik/status przetworzenia tam, gdzie wymagany,
- timestamp i polityka retencji,
- UNIQUE na `(context, key)` lub równoważnym kluczu domenowym.

Outbox jest zapisywany w tej samej transakcji co zmiana agregatu. Publisher działa at-least-once, więc konsumenci muszą być idempotentni.

## 3. MAPA 28 TABEL RENDER -> STATUS V3

| # | Tabela Render | Kontekst V3 | Status | Uwagi migracyjne |
|---:|---|---|---|---|
| 1 | `gracz_accounts` | Identity & Access | MIGRATE-AND-TRANSFORM | Kanoniczne dane użytkownika -> `users`/`user_profiles`; zachować identyfikatory lub jawne mapowanie ID, wykonać backfill referencji. |
| 2 | `gracz_audit_log` | Audit | MIGRATE-AND-TRANSFORM | Przenieść do kanonicznego append-only `audit_log`; zachować historię, timestamps i actor/subject semantics. |
| 3 | `gracz_audit_log_legacy_1787562123031` | Audit | DEPRECATE | Najpierw analiza rekordów, dat, retencji i zależności; archiwizacja/merge danych przed ewentualnym DROP. |
| 4 | `gracz_auth_sessions` | Identity & Access | MIGRATE-AND-TRANSFORM | Przenieść aktywne sesje tylko jeśli polityka cutover tego wymaga; docelowo `auth_sessions` z jednoznacznym lifecycle/revocation. |
| 5 | `gracz_chat_friends` | Global Chat & Social | MIGRATE-AND-TRANSFORM | Zastąpić kierunkowy/race-prone model kanoniczną relacją social; backfill i deduplikacja par. |
| 6 | `gracz_chat_topics` | Global Chat & Social | MIGRATE-AND-TRANSFORM | Przenieść do `chat_topics`; zachować identyfikatory lub mapowanie dla wiadomości. |
| 7 | `gracz_game_sessions` | Game Platform | MIGRATE-AND-TRANSFORM | Warcaby -> kanoniczny `game_matches` + snapshots/events; istniejące `version` wykorzystać dopiero po świadomym kontrakcie concurrency, nie zakładać CAS z samej kolumny. |
| 8 | `gracz_global_chat` | Global Chat & Social | MIGRATE-AND-TRANSFORM | `chat_messages`; wydzielić reakcje z whole-object JSON, zachować historię/soft-delete zgodnie z polityką. |
| 9 | `gracz_global_chat_reports` | Moderation / Chat | MIGRATE-AND-TRANSFORM | Zachować raporty i ich idempotency; jawny kontrakt z Moderation bez bezpośredniego cross-context write. |
| 10 | `gracz_message_attachments` | Messaging | MIGRATE-AND-TRANSFORM | `private_message_attachments`; zachować szyfrowane payloady/metadata i politykę usuwania. |
| 11 | `gracz_messages` | Messaging | MIGRATE-AND-TRANSFORM | `private_messages`; zachować szyfrowanie, historię i semantics usuwania, skorygować ryzyko CASCADE/polityki drugiej strony. |
| 12 | `gracz_mfa` | Identity & Access | MIGRATE-AND-TRANSFORM | Docelowo `mfa_credentials`; migracja sekretów/stanów z zachowaniem wymogów bezpieczeństwa i rotacji. |
| 13 | `gracz_moderation_appeals` | Moderation | MIGRATE-AND-TRANSFORM | Przenieść do kanonicznego workflow appeals; zachować relacje do decyzji i historię. |
| 14 | `gracz_moderation_decisions` | Moderation | MIGRATE-AND-TRANSFORM | `moderation_decisions`; rozszerzyć o spójny review/sanctions workflow bez utraty historii. |
| 15 | `gracz_newsletter_subscribers` | Newsletter | MIGRATE-AND-TRANSFORM | **HIGH drift**: rozdzielić legacy + nowy lifecycle, jeden kanoniczny subscriber ID; wymaga data profiling, mapowania statusów, backfillu i kontrolowanego dual-read/write. |
| 16 | `gracz_password_reset_tokens` | Identity & Access | MIGRATE-AND-TRANSFORM | Docelowo `password_reset_tokens`; zachować tylko ważne tokeny, jeśli cutover tego wymaga; stare wygasić zgodnie z polityką. |
| 17 | `gracz_registration_codes` | Identity & Access | MIGRATE-AND-TRANSFORM | Przenieść do kanonicznego modelu rejestracji albo wycofać po potwierdzeniu funkcji; decyzja końcowa po DML/usage review. |
| 18 | `gracz_role_changes` | Identity & Access / Audit | MERGE | Połączyć z kanonicznym `role_change_events`; ustalić aktywnych writerów i deduplikację względem `gracz_role_history`. |
| 19 | `gracz_role_history` | Identity & Access / Audit | MERGE | Wspólnie z `gracz_role_changes` -> jeden strumień historii zmian ról; zachować pełną chronologię i provenance. |
| 20 | `gracz_roles` | Identity & Access | MIGRATE-AND-TRANSFORM | Docelowo `roles` + jawne `user_roles`; nie utrzymywać kilku równoległych modeli RBAC. |
| 21 | `gracz_thousand_games` | Game Platform | MIGRATE-AND-TRANSFORM | Zachować semantykę revision/optimistic locking, ale przenieść do wspólnego `game_matches`/events/snapshots i kontraktu match-runtime. |
| 22 | `gracz_tournament_matches` | Tournament | MIGRATE-AND-TRANSFORM | Docelowo jawny FK/logiczne ID do `game_matches.match_id`; backfill istniejących powiązań tam, gdzie da się je wiarygodnie ustalić. |
| 23 | `gracz_tournament_players` | Tournament | MIGRATE-AND-TRANSFORM | Docelowo `tournament_registrations`; deduplikacja, constraints i bezpieczne seeding/join. |
| 24 | `gracz_tournaments` | Tournament | MIGRATE-AND-TRANSFORM | Kanoniczne `tournaments`; dodać wersjonowanie/locking dla krytycznych przejść i rozdzielić rundy. |
| 25 | `newsletter_consent_history` | Newsletter | MIGRATE-AND-TRANSFORM | Zachować pełną historię zgód; w V3 dodać DB-level mechanizm uniemożliwiający niepożądane duplikaty zgodnie z finalnym kluczem zdarzenia. |
| 26 | `newsletter_events` | Newsletter | MIGRATE-AND-TRANSFORM | Zachować historię lifecycle/analytics; ujednolicić event IDs/correlation i retencję. |
| 27 | `newsletter_sources` | Newsletter | MIGRATE-AND-TRANSFORM | Zachować źródła i kody; przenieść do kanonicznego namespace/modelu V3. |
| 28 | `newsletter_subscriber_sources` | Newsletter | MIGRATE-AND-TRANSFORM | Zachować attribution; remap subscriber ID po normalizacji `newsletter_subscribers`, utrzymać integralność FK. |

### 3.1 Wynik mapowania iteracji 1

- **KEEP-AS-IS:** 0 — celowo; V3 zmienia kontrakty i ownership, więc brak automatycznego przeniesienia 1:1 bez przeglądu.
- **MIGRATE-AND-TRANSFORM:** 25.
- **MERGE:** 2 (`gracz_role_changes`, `gracz_role_history`).
- **DEPRECATE:** 1 (`gracz_audit_log_legacy_1787562123031`) — dopiero po retencji/archiwizacji i potwierdzeniu zależności.

Powyższa klasyfikacja jest **decyzją projektową**, nie skryptem migracji.

## 4. Nowe elementy V3, których nie ma w mapie 28 tabel

Model V3 wprowadza nowe trwałe struktury potrzebne przez Backend V3, m.in.:
- `outbox_events`,
- `idempotency_keys` / `processed_messages`,
- kanoniczny `game_matches`,
- `game_match_players`,
- `game_match_events`,
- `game_match_snapshots`,
- trwałość Gomoku przez wspólny model meczów,
- `tournament_rounds`,
- `moderation_sanctions`,
- ewentualne projection/checkpoint tables.

Nie oznacza to, że finalny PostgreSQL V3 ma dokładnie określoną liczbę tabel na tym etapie. Liczba zostanie ustalona po zaprojektowaniu konkretnych struktur i usunięciu zbędnych duplikatów.

## 5. Wymagania migracyjne — bez skryptów

### 5.1 Migracja bezpieczna i etapowa

Preferowany wzorzec:
1. expand — dodać nowe struktury bez usuwania starych,
2. backfill — przenieść/znormalizować dane historyczne,
3. verify — porównać liczby, checksumy/inwarianty i próbki,
4. dual-read/dual-write tylko tam, gdzie rzeczywiście potrzebne i kontrolowane,
5. cutover writerów do V3,
6. obserwacja i okres stabilizacji,
7. contract — dopiero wtedy wycofanie legacy.

### 5.2 Integralność

Przed finalnym zatwierdzeniem DDL dla każdego bounded contextu definiujemy:
- PK,
- FK i politykę `ON DELETE`/`ON UPDATE`,
- UNIQUE,
- CHECK,
- NOT NULL,
- wersjonowanie agregatu,
- indeksy pod realne ścieżki DML,
- retencję,
- ownership tabeli,
- reguły cross-context references.

### 5.3 Rollback

Każdy krok migracji musi mieć jawny rollback. Do czasu zakończenia cutover nie wykonujemy destrukcyjnego usunięcia źródła danych, jeśli uniemożliwiłoby to powrót do poprzedniego writera.

## 6. Następna iteracja ETAPU 2

Następny dokument/rozszerzenie powinno zdefiniować **konkretne DDL logiczne V3** w kolejności:
1. Integration foundation — `outbox_events`, idempotency, IDs/correlation,
2. Game Platform — `game_definitions`, `game_matches`, players/events/snapshots,
3. Tournament,
4. Identity & Access + Role/Audit,
5. Messaging,
6. Global Chat & Social,
7. Moderation,
8. Newsletter,
9. projections/read-models.

Dopiero po zatwierdzeniu kolumn, typów i constraintów przechodzimy do szczegółowego planu migracji danych i kodu.

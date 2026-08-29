# ETAP 3 — Gate 14A: Runtime DDL Separation — inventory

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Gałąź kodu odniesienia: `feature/homepage-game-center`  
Kod odniesienia: `3dfb9ab9f1e069afc831d44b81e020c04c9a3466`  
Status: **INVENTORY COMPLETE / REFACTOR PENDING — GATE 14A NIE PASS**

## 1. Cel

Gate 14A ma usunąć operacje DDL/DCL z normalnego startup path aplikacji. Docelowy runtime ma uruchamiać aplikację na już przygotowanym i zweryfikowanym schemacie i nie może potrzebować uprawnień do `CREATE`, `ALTER`, `DROP`, `TRIGGER`, `GRANT` ani `REVOKE`.

`src/main.js` nie wykonuje DDL bezpośrednio, ale konstruuje serwisy PostgreSQL i `await`uje ich `ready/init/initialize`. DDL jest rozproszony w tych inicjalizatorach.

## 2. Wynik inventory

Potwierdzono **14 modułów** zawierających operacje schematu/uprawnień wykonywane w normalnym startup path.

Łącznie zinwentaryzowano **79 indywidualnych operacji DDL/DCL** w tych initializerach. Liczba oznacza pojedyncze statementy SQL, także gdy kilka statementów jest wysyłanych w jednym `pool.query()`.

### 2.1 `src/postgres-accounts.js` — 8

Initializer `PostgresAccountService.#initialize()`:

1. `CREATE TABLE IF NOT EXISTS gracz_accounts`
2. `ALTER TABLE gracz_accounts ADD COLUMN ... email`
3. `ALTER TABLE gracz_accounts ADD COLUMN ... recovery_email`
4. `ALTER TABLE gracz_accounts ADD COLUMN ... profile_data`
5. `CREATE TABLE IF NOT EXISTS gracz_messages`
6. `ALTER TABLE gracz_messages ALTER COLUMN subject TYPE TEXT`
7. `CREATE INDEX ... gracz_messages_recipient_idx`
8. `CREATE INDEX ... gracz_messages_sender_idx`

**Ryzyko:** runtime może zmieniać strukturę tabeli kont i wiadomości podczas każdego startu. `ALTER COLUMN ... TYPE` jest szczególnie niepożądany w application startup.

### 2.2 `src/postgres-session-store.js` — 2

Initializer `PostgresSessionStore.#initialize()`:

1. `CREATE TABLE IF NOT EXISTS gracz_game_sessions`
2. `CREATE INDEX ... gracz_game_sessions_updated_idx`

### 2.3 `src/auth-sessions.js` — 4

Initializer `PostgresAuthSessionStore.#initialize()`:

1. `CREATE TABLE IF NOT EXISTS gracz_auth_sessions`
2. `ALTER TABLE ... ADD COLUMN ... last_seen_at`
3. `CREATE INDEX ... gracz_auth_sessions_user_idx`
4. `CREATE INDEX ... gracz_auth_sessions_expiry_idx`

Dodatkowo initializer wywołuje `cleanup()`, który wykonuje `DELETE` starych sesji. Jest to DML, nie DDL — patrz sekcja REVIEW.

### 2.4 `src/message-attachments.js` — 2

Initializer `MessageAttachmentService.#initialize()`:

1. `CREATE TABLE IF NOT EXISTS gracz_message_attachments`
2. `ALTER TABLE ... ADD COLUMN ... storage_name`

### 2.5 `src/global-chat.js` — 10

Initializer `GlobalChatService.init()`:

1. `CREATE TABLE gracz_chat_topics`
2. `CREATE INDEX gracz_chat_topics_created_idx`
3. `CREATE TABLE gracz_global_chat`
4. `ALTER TABLE gracz_global_chat ADD COLUMN topic_id`
5. `CREATE INDEX gracz_global_chat_created_idx`
6. `CREATE INDEX gracz_global_chat_user_idx`
7. `CREATE INDEX gracz_global_chat_topic_idx`
8. `CREATE TABLE gracz_chat_friends`
9. `CREATE INDEX gracz_chat_friends_users_idx`
10. `CREATE TABLE gracz_global_chat_reports`

### 2.6 `src/tournaments.js` — 5

Initializer `TournamentService.init()`:

1. `CREATE TABLE gracz_tournaments`
2. `CREATE INDEX gracz_tournaments_status_idx`
3. `CREATE TABLE gracz_tournament_players`
4. `CREATE TABLE gracz_tournament_matches`
5. `CREATE INDEX gracz_tournament_matches_idx`

### 2.7 `src/newsletter.js` — 16

Initializer `NewsletterService.initialize()`:

- `CREATE TABLE gracz_newsletter_subscribers`
- 9 × `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- `CREATE UNIQUE INDEX gracz_newsletter_id_unique`
- `DROP INDEX IF EXISTS gracz_newsletter_preferred_nick_unique`
- `CREATE UNIQUE INDEX gracz_newsletter_preferred_nick_unique_v2`
- `CREATE INDEX gracz_newsletter_confirmation_hash_idx`
- `CREATE INDEX gracz_newsletter_position_hash_idx`
- `CREATE INDEX gracz_newsletter_unsubscribe_hash_idx`

**Ryzyko wysokie:** runtime wykonuje zarówno serię `ALTER TABLE`, jak i `DROP INDEX` przy normalnym uruchomieniu.

### 2.8 `src/newsletter-admin-service.js` — 11

Initializer `NewsletterAdminService.initialize()`:

1. `CREATE TABLE newsletter_sources`
2. `CREATE TABLE newsletter_subscriber_sources`
3. `CREATE TABLE newsletter_consent_history`
4. `CREATE INDEX newsletter_consent_subscriber_idx`
5. `CREATE INDEX newsletter_consent_time_idx`
6. `CREATE INDEX newsletter_consent_type_idx`
7. `CREATE TABLE newsletter_events`
8. `CREATE INDEX newsletter_events_time_idx`
9. `CREATE INDEX newsletter_events_subscriber_idx`
10. `CREATE INDEX newsletter_events_type_time_idx`
11. `CREATE INDEX newsletter_events_source_idx`

Dodatkowo initializer wykonuje bootstrap DML `INSERT INTO newsletter_sources ... ON CONFLICT DO NOTHING`.

### 2.9 `src/audit-service.js` — 8

Initializer `AuditService.initialize()`:

1. `CREATE TABLE gracz_audit_log`
2. `CREATE INDEX gracz_audit_log_time_idx`
3. `CREATE INDEX gracz_audit_log_actor_idx`
4. `CREATE INDEX gracz_audit_log_type_idx`
5. `CREATE OR REPLACE FUNCTION gracz_audit_log_immutable()`
6. `DROP TRIGGER IF EXISTS gracz_audit_log_block_mutation`
7. `CREATE TRIGGER gracz_audit_log_block_mutation`
8. `REVOKE UPDATE, DELETE, TRUNCATE ... FROM PUBLIC`

**Ryzyko krytyczne dla Gate 14A:** startup aplikacji wykonuje nie tylko DDL, ale także DCL i odtwarza trigger/funkcję.

### 2.10 `src/rbac-service.js` — 2

Initializer `RbacService.initialize()`:

1. `CREATE TABLE gracz_roles`
2. `CREATE TABLE gracz_role_history`

Dodatkowo może wykonać bootstrap DML roli `owner` na podstawie `GRACZ_OWNER_USER_ID`.

### 2.11 `src/mfa-service.js` — 1

Initializer `MfaService.initialize()`:

1. `CREATE TABLE gracz_mfa`

### 2.12 `src/moderation-service.js` — 2

Initializer `ModerationService.initialize()`:

1. `CREATE TABLE gracz_moderation_decisions`
2. `CREATE TABLE gracz_moderation_appeals`

### 2.13 `src/secure-accounts.js` — 7

Initializer `SecureAccountService.#initialize()`:

1. `ALTER TABLE gracz_accounts ADD COLUMN password_hash_version`
2. `ALTER TABLE gracz_accounts ADD COLUMN phone`
3. `ALTER TABLE gracz_accounts ADD COLUMN verification_channel`
4. `ALTER TABLE gracz_accounts ADD COLUMN contact_verified`
5. `CREATE TABLE gracz_registration_codes`
6. `CREATE TABLE gracz_password_reset_tokens`
7. `CREATE INDEX gracz_password_reset_user_idx`

Dodatkowo wykonuje startup DML:
`UPDATE gracz_accounts SET contact_verified=TRUE ...`.

### 2.14 `src/thousand-repository.js` — 1

Initializer `PostgresThousandRepository.initialize()`:

1. `CREATE TABLE gracz_thousand_games`

## 3. `src/main.js` — execution chain

`src/main.js` jest centralnym uruchamiającym, nie miejscem definicji DDL. W normalnym starcie tworzy/awaituje kolejno m.in.:

- `AuditService`
- `ModerationService`
- `PostgresSessionStore`
- `PostgresAccountService`
- `SecureAccountService`
- `PostgresAuthSessionStore`
- `MessageAttachmentService`
- `RbacService`
- `MfaService`
- `GlobalChatService`
- `TournamentService`
- `NewsletterService`
- `NewsletterAdminService`
- `PostgresThousandRepository`

To powoduje wykonanie opisanych wyżej operacji schema/DCL zanim serwer zacznie normalnie obsługiwać ruch.

## 4. Moduły DB sprawdzone jako bez DDL

W ramach inventory potwierdzono również moduły korzystające z PostgreSQL, które nie tworzą schematu:

- `src/rankings.js` — reader/agregator; brak initializer DDL,
- `src/newsletter-lifecycle-recorder.js` — DML/read only względem już istniejących tabel; brak DDL,
- `src/security-service.js` — brak bezpośrednich operacji PostgreSQL/DDL.

Nie należy przenosić ich do migratora tylko dlatego, że uczestniczą w domenie bazodanowej.

## 5. Startup DML — REVIEW, nie blocker DDL

Poza DDL/DCL wykryto cztery istotne side-effecty DML przy starcie:

1. `PostgresAuthSessionStore.#initialize()` → cleanup `DELETE` wygasłych/starych sesji,
2. `SecureAccountService.#initialize()` → `UPDATE` statusu `contact_verified` dla określonych legacy rows,
3. `NewsletterAdminService.initialize()` → seed `newsletter_sources/homepage`,
4. `RbacService.initialize()` → opcjonalny bootstrap `owner`.

Gate 14A dotyczy bezpośrednio DDL/DCL, więc te operacje nie są automatycznym blockerem. Są jednak oznaczone **REVIEW**, ponieważ docelowy startup least-privilege powinien być możliwie deterministyczny i nie wykonywać jednorazowych migracji danych.

## 6. Root cause

Obecna architektura stosuje wzorzec **self-migrating application**:

- konstruktor serwisu otwiera własny pool,
- ustawia `ready = initialize()` / `init()`,
- initializer tworzy/zmienia schema,
- `main.js` czeka na `ready`,
- dopiero potem aplikacja zaczyna słuchać.

Ten wzorzec wymusza szerokie uprawnienia runtime i jest bezpośrednią przyczyną blockera Gate 14 least privilege.

## 7. Docelowy model Gate 14A

### Migrator

Osobny entry point, np.:

`src/migrate.js`

oraz wersjonowane migracje, np.:

`migrations/0001_identity.sql`
`migrations/0002_messages.sql`
`migrations/0003_games.sql`
`...`

Migrator:

- działa z osobnym migration/owner credential,
- wykonuje DDL/DCL,
- zapisuje wersję schematu,
- jest uruchamiany jawnie przed wdrożeniem runtime,
- nie jest automatycznie wykonywany przez `npm start`.

### Runtime

Normalny runtime:

- nie wykonuje DDL/DCL,
- nie posiada database/schema CREATE,
- nie posiada ownership tabel/sekwencji,
- wykonuje tylko wymagane DML/SELECT,
- przy starcie wykonuje co najwyżej read-only schema/version compatibility check,
- przy niezgodnym schemacie kończy start fail-closed z czytelnym błędem zamiast „naprawiać” bazę.

## 8. Proponowana kolejność migracji

Ze względu na zależności FK bezpieczna kolejność logiczna:

1. Identity / `gracz_accounts`,
2. Messages,
3. Game sessions,
4. Secure-account registration/reset extensions,
5. Auth sessions,
6. Message attachments,
7. RBAC + MFA,
8. Audit,
9. Moderation,
10. Global Chat / Social,
11. Tournaments,
12. Newsletter core,
13. Newsletter admin/lifecycle,
14. Thousand games,
15. indexes/functions/triggers/ACL finalization.

Kolejność musi zostać jeszcze uzgodniona z istniejącym planem V3 DDL; ten dokument nie autoryzuje wykonania żadnej migracji produkcyjnej.

## 9. Kryteria PASS Gate 14A

Gate 14A może otrzymać PASS dopiero gdy:

1. `npm start` nie wykonuje `CREATE/ALTER/DROP/TRIGGER/GRANT/REVOKE`,
2. wszystkie 79 obecnych operacji schema/ACL zostały przeniesione do wersjonowanego migratora lub jawnie usunięte jako obsolete,
3. startup runtime działa na już przygotowanym schemacie z rolą bez DDL,
4. istnieje schema-version compatibility check bez zapisu,
5. test negatywny potwierdza, że runtime startuje bez `CREATE`/ownership,
6. test negatywny potwierdza, że runtime nie może samodzielnie zmienić schema,
7. migrator jest osobnym entry pointem i nie uruchamia się przy normalnym starcie,
8. fresh Gate 14A code scan nie znajduje executable DDL/DCL w runtime initializers.

## 10. Decyzja

**Gate 14A inventory = COMPLETE.**

**Gate 14A overall = NOT PASS / REFACTOR PENDING.**

Nie wykonano żadnego DDL/DML/DCL na produkcyjnej bazie w ramach tego inventory.

Następny krok:

**Gate 14A.2 — zaprojektować i wdrożyć wersjonowany migrator + zmienić wszystkie 14 initializerów na runtime-safe schema verification / DML-only path, następnie uruchomić testy i fresh code-level reconciliation.**

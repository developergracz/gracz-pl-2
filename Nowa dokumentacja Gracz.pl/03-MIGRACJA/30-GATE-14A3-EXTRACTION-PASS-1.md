# ETAP 3 — Gate 14A.3: Extraction Pass 1

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Gałąź implementacyjna: `audit/gate14a2-runtime-ddl-separation`  
Draft PR walidacyjny: `#26`  
Head zweryfikowany: `1205accf7c7d62b9e5646d37e46fd9e938de1150`  
Status: **PASS — CODE-LEVEL EXTRACTION / NOT DEPLOYED / NOT EXECUTED ON DB**

## 1. Cel

Gate 14A.3 przenosi pierwszą grupę operacji DDL z normalnego runtime startup path do jawnie uruchamianych, wersjonowanych migracji. Zakres Pass 1:

1. Identity,
2. Messages,
3. Game Sessions,
4. Secure Accounts,
5. Auth Sessions,
6. Message Attachments.

`gracz_thousand_games` / `thousand-repository.js` nie należy do tego passu. Jest to odrębna domena Tysiąca i pozostaje do późniejszej ekstrakcji.

## 2. Migracje 001–006

Na gałęzi implementacyjnej utworzono:

- `src/migrator/migrations/001_identity.sql`
- `src/migrator/migrations/002_messages.sql`
- `src/migrator/migrations/003_game-sessions.sql`
- `src/migrator/migrations/004_secure-account.sql`
- `src/migrator/migrations/005_auth-sessions.sql`
- `src/migrator/migrations/006_message-attachments.sql`

Migracje są odkrywane przez `migration-plan.js`, mają ciągłe numery 001–006 i SHA-256 checksum. Migrator wykonuje je poza `npm start`, przez osobny entry point i wymaga `MIGRATOR_DATABASE_URL`.

Nie uruchomiono żadnej z tych migracji na bazie Render ani na produkcji.

## 3. Runtime DDL usunięty w Pass 1

Zmodyfikowano pięć modułów runtime:

### `src/postgres-accounts.js`

Usunięto startup DDL dla:

- `gracz_accounts`,
- kolumn `email`, `recovery_email`, `profile_data`,
- `gracz_messages`,
- zmiany typu `subject`,
- indeksów wiadomości.

Initializer został zastąpiony `SELECT ... LIMIT 0`, który failuje przy braku wymaganego schematu i niczego nie naprawia.

### `src/postgres-session-store.js`

Usunięto:

- `CREATE TABLE gracz_game_sessions`,
- `CREATE INDEX gracz_game_sessions_updated_idx`.

Runtime wykonuje wyłącznie schema verification przez `SELECT ... LIMIT 0` oraz normalne DML gry.

### `src/secure-accounts.js`

Usunięto:

- cztery `ALTER TABLE gracz_accounts`,
- `CREATE TABLE gracz_registration_codes`,
- `CREATE TABLE gracz_password_reset_tokens`,
- indeks reset tokens.

Runtime sprawdza obecność wymaganych kolumn/tabel przez `SELECT ... LIMIT 0`.

Istniejący legacy startup DML:

`UPDATE gracz_accounts SET contact_verified=TRUE ...`

pozostaje oznaczony **REVIEW**. Nie jest DDL i nie został przeniesiony do migracji w tym pass.

### `src/auth-sessions.js`

Usunięto:

- `CREATE TABLE gracz_auth_sessions`,
- compatibility `ALTER TABLE`,
- dwa indeksy.

Pozostał existing cleanup `DELETE` starych sesji jako **DML REVIEW**.

### `src/message-attachments.js`

Usunięto:

- `CREATE TABLE gracz_message_attachments`,
- `ALTER TABLE ... storage_name`.

Runtime wykonuje tylko schema verification oraz normalne SELECT/DML.

## 4. Code-level fail-closed contract

Dodano:

`test/gate14a3-runtime-ddl.test.js`

Test sprawdza:

1. brak wykonywalnych konstrukcji DDL/DCL w pięciu modułach Pass 1,
2. ciągłość migracji 001–006,
3. zatwierdzone nazwy migracji,
4. poprawny format SHA-256 checksum.

Pierwsza wersja testu miała false positive, ponieważ ogólny case-insensitive matcher słowa `CREATE` zinterpretował metodę JavaScript `create()` jako SQL DDL. Matcher został zawężony do realnych konstrukcji SQL (`CREATE TABLE/INDEX/FUNCTION/TRIGGER`, `ALTER TABLE`, `DROP`, `TRUNCATE TABLE`, `GRANT`, `REVOKE`). Nie osłabiono kryterium bezpieczeństwa — usunięto wyłącznie fałszywe dopasowanie składni JavaScript.

## 5. Manual diff review

Po pierwszym zielonym CI przeprowadzono dodatkowy ręczny przegląd diffu największych plików.

W `secure-accounts.js` wykryto niezamierzone różnice w pomocniczym kodzie e-mail/HTML escaping powstałe podczas pełnego replacementu pliku. Nie były związane z Gate 14A.3.

Zmiany te zostały wycofane. Następnie `secure-accounts.js` został odbudowany z pristine source i ponownie naniesiono tylko zmianę inicjalizatora DB.

Finalny diff `secure-accounts.js` względem `feature/homepage-game-center` obejmuje wyłącznie:

- `#initialize()` → `#initializeRuntime()`,
- usunięcie DDL,
- dodanie `SELECT ... LIMIT 0`,
- zachowanie istniejącego legacy DML bez zmian.

Finalny diff `postgres-accounts.js` również ogranicza się do runtime schema initialization.

## 6. CI evidence — final head

Finalny zweryfikowany head:

`1205accf7c7d62b9e5646d37e46fd9e938de1150`

### CheckersEngine

Run ID: `33225467977`  
Job ID: `99028221977`  
Conclusion: **SUCCESS**

PASS:

- checkout,
- Node 24 setup,
- dependency install,
- static syntax checks,
- unit and integration tests,
- production dependency audit,
- Playwright Chromium install,
- browser tests.

### Security Gate

Run ID: `33225467972`

PASS:

- `node-security` — syntax/tests/high-critical production CVE gate,
- `secrets` — gitleaks,
- `codeql` — analysis.

W finalnej walidacji nie wykryto testowej, dependency, secret ani CodeQL blokady dla Pass 1.

## 7. Draft PR i deployment isolation

Draft PR:

`#26 — Gate 14A.3 — Extraction Pass 1`

Stan przy zamknięciu dokumentu:

- OPEN,
- DRAFT,
- NOT MERGED,
- base: `feature/homepage-game-center`,
- head: `audit/gate14a2-runtime-ddl-separation`,
- mergeable: true.

PR służy do code review i CI. Nie został zmergowany, ponieważ `feature/homepage-game-center` jest gałęzią wdrażaną na Render i merge spowodowałby zmianę runtime przed zakończeniem całego Gate 14A.

W ramach Gate 14A.3:

- NIE wdrożono kodu na Render,
- NIE wykonano migratora,
- NIE wykonano DDL/DCL na bazie,
- NIE zmieniono ról/uprawnień PostgreSQL,
- NIE wykonano migracji produkcyjnej.

## 8. Reconciliation z inventory Gate 14A.1

Gate 14A.1 zinwentaryzował 79 operacji DDL/DCL.

Pass 1 obejmował:

- `postgres-accounts.js`: 8,
- `postgres-session-store.js`: 2,
- `secure-accounts.js`: 7,
- `auth-sessions.js`: 4,
- `message-attachments.js`: 2.

Razem przeniesiono z runtime startup path:

**23 / 79 DDL/DCL**.

Pozostaje:

**56 / 79 DDL/DCL**

w pozostałych domenach/modułach.

## 9. Co nadal pozostaje w Gate 14A

Gate 14A overall NIE jest jeszcze PASS.

Pozostałe moduły z inventory:

- `global-chat.js` — 10,
- `tournaments.js` — 5,
- `newsletter.js` — 16,
- `newsletter-admin-service.js` — 11,
- `audit-service.js` — 8,
- `rbac-service.js` — 2,
- `mfa-service.js` — 1,
- `moderation-service.js` — 2,
- `thousand-repository.js` — 1.

Razem: **56**.

Dlatego nie można zamknąć całego Gate 14A po ekstrakcji wyłącznie Newsletter/Audit/RBAC/Moderation/Global Chat. Pass 2+ musi uwzględnić także Tournaments, MFA i Thousand.

Globalny `runtime-schema-check.js` również nie jest jeszcze podłączony do `main.js`. W Pass 1 użyto lokalnych fail-closed `SELECT ... LIMIT 0` w oczyszczonych modułach. Global checker należy aktywować dopiero po przeniesieniu kompletnego startup DDL, aby nie stworzyć częściowo aktywnego mechanizmu wersji schematu.

## 10. Decyzja

**Gate 14A.3 — Extraction Pass 1 = PASS (CODE-LEVEL).**

**Gate 14A overall = NOT PASS / EXTRACTION CONTINUES.**

**Gate 14 = BLOCKED / REMEDIATION IN PROGRESS.**

**Production migration = NO-GO.**

Następny krok:

**Gate 14A.4 — Extraction Pass 2**, zaczynając od kolejnych zależnych domen i kończąc pełnym reconciliation pozostałych 56 DDL/DCL. Podział Pass 2/Pass 3 ma objąć wszystkie pozostałe moduły, a nie tylko część z nich.

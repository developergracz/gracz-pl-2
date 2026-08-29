# ETAP 3 — Gate 14A.4: Extraction Pass 2 i finalna reconciliacja Gate 14A

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Gałąź implementacyjna: `audit/gate14a2-runtime-ddl-separation`  
Draft PR walidacyjny: `#26`  
Finalny zweryfikowany head: `cb073bad3050ffc9726e0a1528c2ec4a4808f12e`  
Status Gate 14A.4: **PASS — CODE-LEVEL EXTRACTION / NOT DEPLOYED / NOT EXECUTED ON DB**  
Status Gate 14A overall: **PASS — CODE-LEVEL RUNTIME DDL SEPARATION COMPLETE**

> Ten PASS dotyczy wyłącznie separacji DDL/DCL od normalnego runtime i kompletności pakietu migracyjnego w kodzie. Nie oznacza zgody na uruchomienie migracji, zmianę ról PostgreSQL, wdrożenie na Render ani produkcyjny GO.

## 1. Cel Gate 14A.4

Gate 14A.4 zamyka drugi i ostatni pass ekstrakcji runtime DDL/DCL. Celem było przeniesienie wszystkich operacji schematowych pozostałych po Gate 14A.3 do jawnych, wersjonowanych migracji oraz doprowadzenie normalnego runtime do modelu:

1. runtime nie tworzy ani nie modyfikuje schematu,
2. runtime nie nadaje ani nie odbiera uprawnień,
3. migracje są wykonywane wyłącznie przez osobny migrator,
4. runtime sprawdza zgodność schematu i failuje zamknięcie przy niezgodności,
5. brak migracji/checksum mismatch nie może być automatycznie naprawiany przez `npm start`.

## 2. Zakres Extraction Pass 2

Pass 2 objął dziewięć modułów i dokładnie 56 operacji DDL/DCL pozostających po Pass 1:

| Moduł runtime | DDL/DCL wyekstrahowane |
|---|---:|
| `global-chat.js` | 10 |
| `tournaments.js` | 5 |
| `newsletter.js` | 16 |
| `newsletter-admin-service.js` | 11 |
| `audit-service.js` | 8 |
| `rbac-service.js` | 2 |
| `mfa-service.js` | 1 |
| `moderation-service.js` | 2 |
| `thousand-repository.js` | 1 |
| **Razem Pass 2** | **56** |

## 3. Migracje 007–014

Na izolowanej gałęzi audytowej utworzono:

- `007_rbac-mfa.sql`
- `008_audit.sql`
- `009_moderation.sql`
- `010_global-chat-social.sql`
- `011_tournaments.sql`
- `012_newsletter-core.sql`
- `013_newsletter-admin.sql`
- `014_thousand-games.sql`

### 3.1 `007_rbac-mfa.sql`

Przeniesiono DDL dla:

- `gracz_roles`,
- `gracz_role_history`,
- `gracz_mfa`.

Istniejący runtime owner bootstrap `INSERT` nie został ukryty w migracji i pozostaje osobnym DML REVIEW.

### 3.2 `008_audit.sql`

Przeniesiono:

- `gracz_audit_log`,
- trzy indeksy audytu,
- `gracz_audit_log_immutable()` jako funkcję triggerową,
- drop/recreate triggera append-only,
- `REVOKE UPDATE, DELETE, TRUNCATE ... FROM PUBLIC`.

Tym samym DDL i DCL ochrony audytu nie są już wykonywane przez normalny runtime.

### 3.3 `009_moderation.sql`

Przeniesiono:

- `gracz_moderation_decisions`,
- `gracz_moderation_appeals`.

### 3.4 `010_global-chat-social.sql`

Przeniesiono pełny schemat:

- tematów chatu,
- globalnego chatu,
- compatibility `ALTER ... topic_id`,
- indeksów chatu,
- relacji znajomych,
- zgłoszeń wiadomości.

### 3.5 `011_tournaments.sql`

Przeniesiono:

- `gracz_tournaments`,
- `gracz_tournament_players`,
- `gracz_tournament_matches`,
- indeksy turniejowe.

### 3.6 `012_newsletter-core.sql`

Przeniesiono 16 operacji dotyczących core newslettera:

- tabelę `gracz_newsletter_subscribers`,
- compatibility `ALTER TABLE`,
- indeks identyfikatora,
- drop starego indeksu nicku,
- nowy częściowy unique index nicku,
- indeksy hashy confirmation/position/unsubscribe.

### 3.7 `013_newsletter-admin.sql`

Przeniesiono DDL dla:

- `newsletter_sources`,
- `newsletter_subscriber_sources`,
- `newsletter_consent_history`,
- `newsletter_events`,
- indeksów consent/events.

Istniejący seed:

`INSERT INTO newsletter_sources(... 'homepage' ...) ON CONFLICT DO NOTHING`

pozostaje runtime DML REVIEW i nie został zakamuflowany jako DDL migration.

### 3.8 `014_thousand-games.sql`

Przeniesiono `CREATE TABLE gracz_thousand_games`.

## 4. Runtime po Extraction Pass 2

W każdym z dziewięciu modułów Pass 2 usunięto schema mutation i zastąpiono ją read-only schema presence verification przez `SELECT ... LIMIT 0`.

Manualny diff-review potwierdził, że w krytycznych dużych plikach:

- `global-chat.js`,
- `tournaments.js`,
- `newsletter.js`,
- `newsletter-admin-service.js`

zmiany są ograniczone do inicjalizacji schematu; logika biznesowa chatu, turniejów i newslettera nie została świadomie zmieniona w tym gate.

Dodatkowo sprawdzono:

- `rbac-service.js`,
- `audit-service.js`,
- `mfa-service.js`,
- `moderation-service.js`,
- `thousand-repository.js`.

Również w tych plikach końcowy diff ogranicza się do separacji schema mutation od runtime, z zachowaniem jawnie oznaczonych DML REVIEW.

## 5. Finalna reconciliacja Gate 14A

Gate 14A.1 zinwentaryzował:

**79 operacji DDL/DCL w 14 runtime modules.**

Gate 14A.3 przeniósł:

**23 / 79**.

Gate 14A.4 przeniósł:

**56 / 79**.

Finalnie:

- Pass 1: 23,
- Pass 2: 56,
- **razem wyekstrahowano: 79 / 79**, 
- **pozostały wykonywalny runtime DDL/DCL w zinwentaryzowanych 14 modułach: 0**.

## 6. Pełna sekwencja migracji V3

Po Gate 14A katalog migracji ma ciągłą sekwencję:

1. `001_identity.sql`
2. `002_messages.sql`
3. `003_game-sessions.sql`
4. `004_secure-account.sql`
5. `005_auth-sessions.sql`
6. `006_message-attachments.sql`
7. `007_rbac-mfa.sql`
8. `008_audit.sql`
9. `009_moderation.sql`
10. `010_global-chat-social.sql`
11. `011_tournaments.sql`
12. `012_newsletter-core.sql`
13. `013_newsletter-admin.sql`
14. `014_thousand-games.sql`

Migracje są odkrywane przez `migration-plan.js`, wymagają ciągłych wersji, otrzymują SHA-256 checksum i są rejestrowane przez migrator w `gracz_schema_migrations`.

## 7. Fail-closed runtime schema check

`runtime-schema-check.js` został podłączony do `src/main.js`.

Przy obecnym `DATABASE_URL` kolejność startu jest następująca:

1. `loadConfig()`,
2. `assertRuntimeSchema(config.databaseUrl)`,
3. dopiero potem pierwszy PostgreSQL-backed service (`AuditService`) i kolejne serwisy runtime.

Checker:

- odczytuje `version`, `name`, `checksum` z `gracz_schema_migrations`,
- porównuje liczbę migracji,
- porównuje każdą wersję,
- porównuje nazwę,
- porównuje exact SHA-256 checksum,
- failuje przy braku ledger table,
- failuje przy version mismatch,
- failuje przy checksum/name mismatch,
- nie wykonuje DDL/DCL,
- nie importuje ani nie uruchamia migratora.

W szczególności normalny runtime nie zna `MIGRATOR_DATABASE_URL` i nie może sam wykonać `migrate-v3`.

### Konsekwencja wdrożeniowa

Gałąź `audit/gate14a2-runtime-ddl-separation` **nie może zostać wdrożona na aktualną bazę przed wykonaniem zatwierdzonych migracji**, ponieważ brak zgodnego `gracz_schema_migrations` spowoduje zamierzony fail-closed startup.

To jest właściwe zachowanie bezpieczeństwa, nie błąd wymagający obejścia.

## 8. Automatyczne kontrakty Gate 14A

Test `test/gate14a4-runtime-ddl.test.js` wymusza:

1. brak wykonywalnego DDL/DCL w wszystkich 14 modułach z inventory,
2. exact sekwencję migracji `001–014`,
3. poprawny format SHA-256 checksum,
4. wykonanie `assertRuntimeSchema()` przed pierwszym serwisem PostgreSQL,
5. brak migratora i `MIGRATOR_DATABASE_URL` w runtime,
6. brak DDL/DCL w samym runtime schema checkerze.

Test Pass 1 `gate14a3-runtime-ddl.test.js` został zachowany jako regresyjny kontrakt pierwszych sześciu migracji. Został dostosowany tak, aby sprawdzał pierwsze `001–006`, a nie błędnie zakładał, że katalog migracji zawsze kończy się na wersji 006.

Podczas walidacji wychwycono także false positive matchera DCL: JavaScriptowa metoda `revoke()` była traktowana jak SQL `REVOKE`. Matcher został zawężony do realnej składni DCL z nazwą uprawnienia. Kryterium bezpieczeństwa nie zostało osłabione.

## 9. Finalne CI evidence

Finalny zweryfikowany head:

`cb073bad3050ffc9726e0a1528c2ec4a4808f12e`

### 9.1 CheckersEngine

Run ID: `33226265016`  
Job ID: `99030545190`  
Conclusion: **SUCCESS**

PASS:

- checkout,
- Node 24 setup,
- dependency install,
- static syntax checks,
- unit/integration tests,
- production dependency audit,
- Playwright Chromium install,
- browser tests.

Finalny test runner:

- tests: **127**,
- pass: **127**,
- fail: **0**,
- cancelled: 0,
- skipped: 0.

Gate-specific PASS w logu:

- Gate 14A.3 runtime modules no executable DDL/DCL,
- Gate 14A.3 migrations 001–006 preserved,
- Gate 14A runtime modules no executable DDL/DCL,
- Gate 14A migrations 001–014 exact,
- Gate 14A runtime schema check ordering/no runtime migrator.

`npm audit --omit=dev --audit-level=high`:

**0 vulnerabilities**.

Browser journeys:

- register → lobby → room → HTML5 board: PASS,
- Gomoku chooser → table → two players → synchronized win: PASS.

### 9.2 Security Gate

Run ID: `33226264999`

- node-security job `99030520357`: **SUCCESS**,
- secrets/gitleaks job `99030520499`: **SUCCESS**,
- CodeQL job `99030520433`: **SUCCESS**.

Node-security potwierdził syntax/tests/high-critical production CVE gate. Gitleaks nie zgłosił blokady. CodeQL zakończył analizę sukcesem.

## 10. Jawne DML REVIEW pozostające w runtime

Gate 14A dotyczy DDL/DCL, dlatego cztery wcześniej zinwentaryzowane startup DML nie zostały automatycznie przeniesione ani usunięte:

1. `auth-sessions.js` — cleanup `DELETE` starych sesji,
2. `secure-accounts.js` — legacy `UPDATE contact_verified`,
3. `newsletter-admin-service.js` — idempotentny seed źródła `homepage`,
4. `rbac-service.js` — warunkowy owner bootstrap `INSERT`.

Status: **REVIEW**, nie ukryte i nie pominięte.

Będą uwzględnione przy projektowaniu minimalnych uprawnień runtime w Gate 14B oraz przy ostatecznym cutover/runbooku. Ich obecność nie oznacza DDL self-migration.

## 11. Izolacja od Rendera i produkcji

W ramach Gate 14A.4:

- NIE wdrożono gałęzi audytowej na Render,
- NIE uruchomiono migratora przeciw bazie Render/produkcja,
- NIE wykonano migracji `001–014` na produkcji,
- NIE wykonano produkcyjnego DDL/DCL,
- NIE zmieniono ról PostgreSQL,
- NIE zmieniono ownership ani grantów,
- NIE rotowano sekretów,
- NIE zmieniono produkcyjnych danych.

Draft PR `#26` pozostaje izolowany od gałęzi wdrożeniowej do czasu odpowiedniego planu migracji/cutoveru.

## 12. Decyzja Gate 14A

### Gate 14A.1 — Inventory

**PASS**

### Gate 14A.2 — Migrator Design

**PASS**

### Gate 14A.3 — Extraction Pass 1

**PASS — CODE-LEVEL**

### Gate 14A.4 — Extraction Pass 2

**PASS — CODE-LEVEL**

### Gate 14A overall

# **PASS — CODE-LEVEL RUNTIME DDL SEPARATION COMPLETE**

Uzasadnienie:

- inventory 79/79 reconciled,
- 79/79 DDL/DCL wyekstrahowane,
- 0 pozostałego wykonywalnego DDL/DCL w 14 zinwentaryzowanych runtime modules,
- migracje 001–014 ciągłe i checksummed,
- runtime schema checker aktywny i fail-closed,
- checker wykonuje się przed pierwszym serwisem PostgreSQL,
- runtime nie uruchamia migratora,
- manual diff review nie wykazał zmian biznesowych poza zakresem ekstrakcji,
- CheckersEngine final = SUCCESS,
- Security Gate final = SUCCESS.

## 13. Gate 14A PASS nie oznacza Gate 14 PASS

Gate 14 jako całość nadal pozostaje:

# **BLOCKED — REMEDIATION REQUIRED**

Do wykonania pozostaje:

### Gate 14B — Least-Privilege Role Design

Rozdzielenie:

- migration/owner credential,
- application runtime credential,

oraz zaprojektowanie minimalnych CONNECT/USAGE/DML/sequence privileges i usunięcie z runtime prawa do CREATE/ownership/CREATEDB/CREATEROLE/TRUNCATE/TRIGGER/REFERENCES poza jawnie uzasadnionymi wyjątkami.

### Gate 14C — Crypto keyring v1/v2

Bezpieczne odejście od fallbacku `AUTH_SECRET` bez utraty możliwości odszyfrowania istniejących 5 wiadomości i 2 załączników.

### Gate 14D — Production Security Configuration

Między innymi:

- `NODE_ENV=production`,
- Turnstile hostname binding,
- `PUBLIC_BASE_URL=https://gracz.pl`,
- provider/config reconciliation.

Po 14B–14D wymagany jest świeży Gate 14 recheck na docelowym runtime.

## 14. Status produkcyjny

Pomimo PASS Gate 14A:

# **PRODUCTION V3 = NO-GO**

Nie ma zgody na produkcyjny cutover ani wykonanie migracji wyłącznie na podstawie tego dokumentu.

## 15. Następny obowiązkowy krok

# **Gate 14B — Least-Privilege Role Design**

Najpierw projekt i permission matrix; dopiero później, po wymaganych kontrolach i jawnej autoryzacji, jakiekolwiek zmiany DCL/credentials na bazie.

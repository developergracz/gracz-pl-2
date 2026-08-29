# ETAP 3 — Gate 14A.2: Migrator Design & Runtime DDL Removal

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Gałąź implementacyjna: `audit/gate14a2-runtime-ddl-separation`  
Status: **DESIGN + SCAFFOLD COMPLETE / DDL EXTRACTION PENDING — GATE 14A NIE PASS**

## 1. Kontekst

Gate 14A.1 zinwentaryzował 79 operacji DDL/DCL wykonywanych przez 14 modułów w normalnym startup path aplikacji. `src/main.js` nie zawiera DDL bezpośrednio, ale konstruuje i `await`uje serwisy, których `initialize()/init()/ready` wykonują zmiany schematu.

Celem Gate 14A.2 jest zastąpienie wzorca self-migrating application modelem:

1. osobny migrator z osobnym credential,
2. wersjonowane, immutable migracje SQL,
3. ledger wersji/checksumów,
4. runtime schema compatibility check tylko przez `SELECT`,
5. zero DDL/DCL w normalnym `npm start`,
6. runtime bez praw `CREATE/ALTER/DROP/TRIGGER/GRANT/REVOKE` po Gate 14B.

Ten dokument nie autoryzuje uruchomienia migratora na produkcji ani żadnego DDL/DML/DCL na bazie Render.

## 2. Gałąź implementacyjna

Utworzono osobną gałąź:

`audit/gate14a2-runtime-ddl-separation`

Gałąź powstała z `feature/homepage-game-center`. Nie została podłączona do Render i nie zastępuje aktualnego runtime.

## 3. Artefakty scaffoldu

Na gałęzi implementacyjnej utworzono:

- `src/migrator/migration-plan.js`
- `src/migrator/migrate-v3.js`
- `src/migrator/migrations/README.md`
- `src/runtime-schema-check.js`
- `test/migrator-plan.test.js`

`package.json` otrzymał jawne komendy:

- `npm run migrate:v3`
- `npm run migrate:v3:plan`
- `npm run migrate:v3:verify`

Normalny `npm start` pozostaje bez zmian i nadal uruchamia `src/main.js`. Schema-checker nie został jeszcze aktywowany w `main.js`, ponieważ ledger oraz komplet migracji SQL nie istnieją jeszcze w stanie gotowym do zastosowania. Jest to celowe fail-safe zachowanie: nie aktywujemy połowy mechanizmu przed ekstrakcją wszystkich 79 statementów.

## 4. Model credential separation

Migrator wymaga wyłącznie:

`MIGRATOR_DATABASE_URL`

Nie ma fallbacku do runtime `DATABASE_URL`.

Jeżeli oba env są obecne i mają identyczną wartość, migrator odmawia uruchomienia. To wymusza architektoniczny kierunek Gate 14B:

- migration/owner credential — DDL/DCL,
- application runtime credential — tylko wymagane SELECT/DML.

Faktyczne role i GRANT/REVOKE zostaną zdefiniowane dopiero w Gate 14B; obecna implementacja nie zmienia żadnych praw w PostgreSQL.

## 5. Wersjonowanie migracji

Kontrakt plików:

`NNN_name.sql`

Przykłady docelowe:

- `001_identity.sql`
- `002_messages.sql`
- `003_game-sessions.sql`
- `004_secure-account.sql`
- `005_auth-sessions.sql`
- `006_message-attachments.sql`
- `007_rbac-mfa.sql`
- `008_audit.sql`
- `009_moderation.sql`
- `010_global-chat-social.sql`
- `011_tournaments.sql`
- `012_newsletter-core.sql`
- `013_newsletter-admin.sql`
- `014_thousand.sql`
- `015_acl-finalization.sql`

Zasady:

- numeracja od `001`, bez luk,
- jedna wersja = jeden niezmienny plik,
- brak duplikatów wersji,
- checksum SHA-256 całego pliku,
- po zastosowaniu migracji plik nie może być modyfikowany,
- zmiana wymaga nowej kolejnej wersji.

## 6. Ledger schematu

Migrator zarządza tabelą:

`gracz_schema_migrations`

Minimalne pola:

- `version INTEGER PRIMARY KEY`
- `name VARCHAR(120)`
- `checksum CHAR(64)`
- `applied_at TIMESTAMPTZ`

Ledger jest częścią infrastruktury migratora. Runtime nie zapisuje do tej tabeli.

## 7. Atomicity i concurrency

Migrator:

1. otwiera pojedyncze połączenie migracyjne,
2. pobiera PostgreSQL advisory lock dla `gracz.pl:migrator:v3`,
3. weryfikuje istniejące wersje i checksumy,
4. każdą nową migrację uruchamia w osobnej transakcji,
5. ustawia lokalny `lock_timeout = 10s`,
6. ustawia lokalny `statement_timeout = 120s`,
7. wykonuje SQL,
8. wpisuje wersję/checksum do ledgeru w tej samej transakcji,
9. COMMIT albo ROLLBACK,
10. po zakończeniu zwalnia advisory lock.

Nie wolno równolegle uruchamiać dwóch writerów migracyjnych.

## 8. Checksum safety

Przed apply i podczas verify migrator porównuje:

- version,
- name,
- checksum.

Jeżeli ledger zawiera wersję o innym name/checksum niż plik w deployu, proces kończy się błędem i nie kontynuuje.

Jeżeli baza zawiera wersję nieznaną bieżącemu kodowi, migrator również kończy się błędem.

## 9. Runtime schema-checker

`src/runtime-schema-check.js` jest fail-closed read-only checkerem.

Docelowo przed konstrukcją serwisów DB w `src/main.js` wykona jedynie:

`SELECT version,name,checksum FROM gracz_schema_migrations ORDER BY version`

i porówna wynik z manifestem migracji dostarczonym razem z kodem.

Warunki odmowy startu:

- brak tabeli ledgeru,
- brak wersji,
- nadmiarowa/nieznana wersja,
- inny checksum,
- inna nazwa migracji.

Checker nigdy nie wykonuje `CREATE`, `ALTER`, `DROP`, `GRANT`, `REVOKE`, `TRUNCATE` ani żadnej operacji naprawczej.

Checker nie został jeszcze podłączony do `main.js`; aktywacja nastąpi dopiero po kompletnej ekstrakcji i przetestowaniu migracji.

## 10. Idempotency policy

Idempotencja nie oznacza wielokrotnego wykonywania tego samego DDL przy każdym starcie aplikacji.

Docelowy model:

- migration version zastosowana i zgodna checksumem → migrator ją pomija,
- migration version nieobecna → wykonuje dokładnie raz,
- version obecna z innym checksumem → hard stop,
- runtime nigdy nie próbuje ponawiać DDL.

Dla migracji baseline do istniejącej bazy można stosować kontrolowane `IF NOT EXISTS` tam, gdzie jest to zgodne z oczekiwanym schematem, ale samo `IF NOT EXISTS` nie zastępuje post-migration verification.

## 11. Rollback policy

Gate 14A/Gate 15 przyjmuje domyślnie model **forward-fix**.

Automatyczne destrukcyjne `down` migrations nie są częścią migratora.

Powody:

- cofnięcie DDL może niszczyć dane,
- rollback aplikacji i rollback bazy nie zawsze są symetryczne,
- Gate 15 wymaga osobnego runbooka i snapshot/restore evidence.

Rollback oznacza:

1. zatrzymanie cutover,
2. powrót do zatwierdzonego poprzedniego runtime, jeżeli schema pozostaje kompatybilny,
3. albo restore/snapshot zgodnie z Gate 15,
4. albo nową, zrecenzowaną migrację naprawczą.

## 12. Startup DML — osobny REVIEW

Gate 14A.1 wykrył cztery side-effecty DML przy starcie:

1. cleanup starych auth sessions,
2. legacy update `contact_verified`,
3. seed `newsletter_sources/homepage`,
4. opcjonalny bootstrap roli `owner`.

W Gate 14A.2 obowiązuje zasada:

- schema/data migration backfill nie może pozostać ukryty w startup,
- cykliczny operational cleanup może pozostać runtime DML tylko po świadomej klasyfikacji,
- bootstrap/seed powinien zostać przeniesiony do migracji lub jawnej operacji administracyjnej.

Ostateczna klasyfikacja tych 4 operacji nastąpi podczas ekstrakcji initializerów.

## 13. Bezpieczeństwo migratora

Migrator:

- nie loguje URL bazy,
- nie loguje credentiali,
- nie odczytuje `DATABASE_URL` jako fallback,
- nie jest wywoływany przez `npm start`,
- nie jest automatycznie podłączony do Render,
- nie wykonuje produkcyjnych operacji bez jawnej autoryzacji,
- ma advisory lock,
- ma timeouty,
- ma checksumy,
- ma verify mode,
- ma plan mode bez połączenia z bazą.

## 14. Integracja z Gate 14B

Po usunięciu DDL z runtime Gate 14B zaprojektuje co najmniej dwie role/credentials:

### Migration role

Wymaga tylko praw potrzebnych do zatwierdzonych migracji i ownership/DDL zgodnie z finalnym modelem.

### Runtime role

Nie może mieć:

- `CREATEDB`,
- `CREATEROLE`,
- schema `CREATE`,
- ownership tabel/sekwencji,
- `ALTER/DROP/TRIGGER/GRANT/REVOKE` capabilities.

Ma otrzymać tylko jawnie potrzebne SELECT/INSERT/UPDATE/DELETE oraz usage na sekwencjach tam, gdzie to rzeczywiście potrzebne.

## 15. Integracja z Gate 15

Gate 15 przed GO wymaga:

1. migrator plan/verify PASS,
2. schema checksum reconciliation PASS,
3. runtime start z rolą bez DDL PASS,
4. negatywny test DDL dla runtime role PASS,
5. finalny active-state recheck po drain writerów,
6. snapshot/restore i rollback runbook,
7. jawne GO użytkownika.

## 16. Testy wykonane dla scaffoldu

W bieżącej sesji wykonano lokalnie niezależną kontrolę nowo dodanego kodu:

- `migration-plan.js` — `node --check` PASS,
- `runtime-schema-check.js` — `node --check` PASS,
- `migrate-v3.js` — `node --check` PASS,
- test sortowania wersji i SHA-256 — PASS,
- test fail-closed dla luki `001 -> 003` — PASS.

GitHub Actions dla osobnej gałęzi nie uruchomił automatycznego workflow (0 runs), dlatego **nie deklaruje się CI PASS** dla całej aplikacji na tym etapie.

## 17. Commity implementacyjne

Gałąź `audit/gate14a2-runtime-ddl-separation`:

- `737e2a08ce0a6616f321567d51f572c3bd277482` — migration discovery/checksum contract,
- `22af1aff54d134dd7f15ab16e0495310c82b9337` — versioned migrator entry point,
- `b0c08285f87d95436d21f61cce4023feb4e02203` — runtime fail-closed schema checker,
- `fc2901a8ad25a3db11311c822ad66c4f5c80d811` — migration directory contract,
- `ac25a8178caabcc17b623680b389b19b778b014f` — explicit npm migrator commands,
- `892f891edb48d71802a0e5a50572d5d55ae7e233` — migration manifest tests.

## 18. Status Gate 14A.2

### Zakończone

- architektura osobnego migratora,
- osobne migration credential contract,
- wersjonowanie,
- checksumy,
- advisory lock,
- atomic transaction per migration,
- plan/verify/apply modes,
- fail-closed runtime schema checker,
- test kontraktu manifestu,
- izolowana gałąź implementacyjna.

### Nadal do wykonania

- przenieść 79 zinwentaryzowanych DDL/DCL do wersjonowanych plików SQL,
- usunąć executable DDL/DCL z 14 runtime initializerów,
- sklasyfikować/przenieść 4 startup DML,
- aktywować schema-checker w `main.js` dopiero po kompletnej ekstrakcji,
- fresh static reconciliation = 0 executable runtime DDL/DCL,
- pełne `npm test` + `npm run check`,
- test startu na schemacie przygotowanym przez migrator,
- test negatywny runtime role bez praw DDL.

## 19. Decyzja

**Gate 14A.2 design/scaffold = COMPLETE.**

**Gate 14A overall = NOT PASS / RUNTIME DDL EXTRACTION PENDING.**

Nie wykonano żadnego DDL/DML/DCL na produkcyjnej bazie i nie wdrożono gałęzi Gate 14A.2 na Render.

Następny krok:

**Gate 14A.2 — extraction pass 1: Identity + Messages + Game Sessions + Secure Accounts + Auth Sessions + Attachments. Przenieść ich DDL do migracji `001–006`, usunąć schema mutation z runtime initializerów i wykonać code-level reconciliation dla tej pierwszej grupy.**

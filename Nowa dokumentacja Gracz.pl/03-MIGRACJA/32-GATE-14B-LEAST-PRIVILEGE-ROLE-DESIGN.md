# ETAP 3 — Gate 14B: Least-Privilege Role Design

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status Gate 14B: **PASS — DESIGN-LEVEL / NOT APPLIED / PRODUCTION NO-GO**

> Ten PASS potwierdza kompletność i spójność projektu ról PostgreSQL. Nie oznacza, że role zostały utworzone, granty zastosowane, ownership zmieniony ani że produkcja może zostać uruchomiona. Żaden DDL/DCL/DML nie został wykonany na Render/PostgreSQL w ramach Gate 14B.

## 1. Punkt wyjścia — fresh Gate 14 evidence

Fresh capture Gate 14 wykazał, że obecny principal `gracz_pl_database_user` jest zbyt szeroki dla stałego runtime:

- `rolsuper = 0`,
- `rolreplication = 0`,
- `rolbypassrls = 0`,
- `rolcreatedb = 1` — blocker,
- `rolcreaterole = 1` — blocker,
- database owner = true — blocker,
- database CREATE = true — blocker,
- public schema CREATE = true — blocker,
- owner 28/28 public tables,
- pełne SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER na 28/28 tabelach,
- owner 8/8 sekwencji z USAGE/SELECT/UPDATE.

Gate 14A usunął już 79/79 runtime DDL/DCL i podłączył fail-closed `runtime-schema-check`, dlatego można teraz zaprojektować runtime bez ownership/CREATE.

## 2. Zasada architektoniczna Gate 14B

Docelowo istnieją **dwie login roles**:

1. `gracz_migrator_v3` — kontrolowany migration/owner principal dla obiektów aplikacyjnych,
2. `gracz_runtime_v3` — stały principal aplikacji.

Obecny provider/admin principal może pozostać właścicielem samej bazy i rolą administracyjną Render/PostgreSQL, ale:

- nie może być używany jako `DATABASE_URL` aplikacji,
- nie może być używany jako zwykły runtime writer,
- jego credential nie może być współdzielony z runtime/migratorem,
- po cutover powinien pozostać wyłącznie kanałem administracyjnym/awaryjnym.

### 2.1 `gracz_migrator_v3`

Docelowe atrybuty:

- LOGIN,
- NOSUPERUSER,
- NOCREATEDB,
- NOCREATEROLE,
- NOREPLICATION,
- NOBYPASSRLS,
- nie jest właścicielem bazy,
- CONNECT do `gracz_pl_database`,
- USAGE + CREATE na schema `public`,
- właściciel wyłącznie obiektów aplikacyjnych V3,
- credential wyłącznie w `MIGRATOR_DATABASE_URL`,
- credential nigdy nie jest używany przez `npm start`.

Migrator już wymaga osobnego `MIGRATOR_DATABASE_URL` i odmawia pracy, jeśli jest on identyczny z runtime `DATABASE_URL`.

### 2.2 `gracz_runtime_v3`

Docelowe atrybuty:

- LOGIN,
- NOSUPERUSER,
- NOCREATEDB,
- NOCREATEROLE,
- NOREPLICATION,
- NOBYPASSRLS,
- nie jest właścicielem bazy,
- nie jest właścicielem schema,
- nie jest właścicielem żadnej tabeli, sekwencji, funkcji ani triggera,
- CONNECT do `gracz_pl_database`,
- USAGE na schema `public`,
- **bez CREATE na bazie i schema**,
- **bez TRUNCATE, REFERENCES, TRIGGER**,
- tylko jawne SELECT/INSERT/UPDATE/DELETE wynikające z obecnego kodu,
- tylko minimalne `USAGE` na sekwencjach wymaganych przez `BIGSERIAL`,
- `SELECT` na `gracz_schema_migrations` dla fail-closed schema check.

## 3. Ownership — docelowy model

### 3.1 Database

`gracz_runtime_v3` i `gracz_migrator_v3` **nie muszą być właścicielami bazy**.

Właścicielem bazy może pozostać kontrolowany provider/admin principal Render/PostgreSQL. Rozdział least privilege jest osiągany przez brak użycia tego principal w aplikacji.

### 3.2 Schema `public`

- migrator: `USAGE, CREATE`,
- runtime: tylko `USAGE`,
- PUBLIC: brak `CREATE`.

Nie wprowadzamy nowego schema w Gate 14B, ponieważ aktualny kod używa niekwalifikowanych nazw i zmiana schema/search_path byłaby osobnym refaktorem architektonicznym.

### 3.3 Obiekty V3

`gracz_migrator_v3` ma być właścicielem obiektów V3 tworzonych/utrzymywanych przez migracje `001–014` oraz ledgeru `gracz_schema_migrations`.

Obecne dwa dodatkowe legacy tables wykazane przez fresh Gate 14 (28 public tables vs 26 tabel z migracji `001–014`) **nie dostają żadnych grantów runtime z automatu**. Gate 14B stosuje fail-closed ACL: obiekt nieznany lub nieużywany przez kod = brak dostępu do czasu udowodnienia potrzeby.

## 4. Runtime table privilege matrix — target

Poniższa macierz wynika z aktualnych zapytań runtime, a nie z obecnych szerokich praw właściciela.

| Tabela | SELECT | INSERT | UPDATE | DELETE | Uwagi |
|---|---:|---:|---:|---:|---|
| `gracz_schema_migrations` | ✓ | — | — | — | fail-closed schema/version/checksum check |
| `gracz_accounts` | ✓ | ✓ | ✓ | ✓ | rejestracja, profil, password/reset, cleanup niedokończonej rejestracji |
| `gracz_messages` | ✓ | ✓ | ✓ | ✓ | prywatne wiadomości, logical delete + final physical delete |
| `gracz_game_sessions` | ✓ | ✓ | ✓ | — | create/get/upsert save |
| `gracz_registration_codes` | ✓ | ✓ | ✓ | ✓ | aktywacja konta |
| `gracz_password_reset_tokens` | ✓ | ✓ | ✓ | ✓ | reset/cleanup tokenów |
| `gracz_auth_sessions` | ✓ | ✓ | ✓ | ✓ | create/revoke/last_seen/cleanup |
| `gracz_message_attachments` | ✓ | ✓ | — | — | zapis i odczyt; cascade nie wymaga jawnego runtime DELETE |
| `gracz_roles` | ✓ | ✓ | ✓ | — | role + owner bootstrap DML REVIEW |
| `gracz_role_history` | —* | ✓ | — | — | append history; `SELECT LIMIT 0` do usunięcia przed aktywacją target ACL |
| `gracz_mfa` | ✓ | ✓ | ✓ | — | TOTP setup/enable/verify |
| `gracz_audit_log` | —* | ✓ | — | — | append-only; `SELECT LIMIT 0` do usunięcia przed aktywacją target ACL |
| `gracz_moderation_decisions` | ✓ | ✓ | — | — | decyzje + weryfikacja przy appeal |
| `gracz_moderation_appeals` | —* | ✓ | — | — | aktualny runtime tylko tworzy appeal; probe SELECT do usunięcia |
| `gracz_chat_topics` | ✓ | ✓ | — | — | create/list/get topic |
| `gracz_global_chat` | ✓ | ✓ | ✓ | — | send/edit/logical delete/reactions |
| `gracz_chat_friends` | ✓ | ✓ | ✓ | ✓ | invite/accept/reject/remove |
| `gracz_global_chat_reports` | —* | ✓ | — | — | report insert; probe SELECT do usunięcia |
| `gracz_tournaments` | ✓ | ✓ | ✓ | — | create/list/start/finish |
| `gracz_tournament_players` | ✓ | ✓ | ✓ | ✓ | join/leave/standings |
| `gracz_tournament_matches` | ✓ | ✓ | ✓ | — | pairing/results |
| `gracz_newsletter_subscribers` | ✓ | ✓ | ✓ | — | double opt-in lifecycle |
| `newsletter_sources` | ✓ | ✓ | — | — | lookup + existing homepage seed DML REVIEW |
| `newsletter_subscriber_sources` | ✓ | ✓ | — | — | lifecycle source attribution |
| `newsletter_consent_history` | ✓ | ✓ | — | — | append consent history + admin reads |
| `newsletter_events` | ✓ | ✓ | — | — | append events + admin/stat reads |
| `gracz_thousand_games` | ✓ | ✓ | ✓ | — | create/get/optimistic save |

`*` Cztery tabele są logicznie write-only, ale obecne Gate 14A initializers wykonują redundantny `SELECT ... LIMIT 0`. Przed aktywacją strict target ACL trzeba usunąć te cztery probes albo zastąpić je centralnym schema compatibility contract. Dotyczy:

- `gracz_audit_log`,
- `gracz_role_history`,
- `gracz_moderation_appeals`,
- `gracz_global_chat_reports`.

Nie akceptujemy trwałego `SELECT` na tych tabelach tylko po to, aby utrzymać historyczny probe — szczególnie audit log powinien pozostać append-only także na poziomie DB ACL.

## 5. Runtime privileges, których jawnie NIE nadajemy

Dla `gracz_runtime_v3` zabronione są:

- database ownership,
- schema ownership,
- table/sequence/function ownership,
- SUPERUSER,
- CREATEDB,
- CREATEROLE,
- REPLICATION,
- BYPASSRLS,
- database CREATE,
- schema CREATE,
- table TRUNCATE,
- table REFERENCES,
- table TRIGGER,
- ALTER/DROP/CREATE TABLE/INDEX/FUNCTION/TRIGGER,
- GRANT/REVOKE,
- szerokie `ALL PRIVILEGES`,
- `GRANT ... ON ALL TABLES` jako docelowy mechanizm uprawnień.

## 6. Sequence privileges

Aktualny kod potrzebuje `nextval()` wyłącznie dla kolumn `BIGSERIAL` tworzonych przez V3.

Target runtime: **USAGE only**, bez SELECT/UPDATE na sekwencjach.

Oczekiwane sekwencje V3:

- `gracz_role_history_change_id_seq`,
- `gracz_newsletter_subscribers_id_seq`,
- `newsletter_sources_id_seq`,
- `newsletter_subscriber_sources_id_seq`,
- `newsletter_consent_history_id_seq`,
- `newsletter_events_id_seq`.

Fresh Gate 14 wykazał 8 sekwencji. Dwie dodatkowe legacy sequences nie dostają grantów runtime bez osobnego dowodu potrzeby.

## 7. PUBLIC/default ACL

Fresh Gate 14 miał:

- PUBLIC schema CREATE grants = 0,
- PUBLIC table SELECT grants = 0,
- PUBLIC table write grants = 0,
- default ACL PUBLIC write = 0.

Gate 14B utrzymuje ten kontrakt.

Dla przyszłych obiektów migratora:

- default PUBLIC table/sequence/function grants powinny być jawnie wyzerowane,
- **nie** ustawiamy szerokiego default `GRANT` dla runtime,
- każda nowa tabela musi dostać jawne ACL według realnych zapytań aplikacji.

## 8. Credential policy

Gate 14 wykazał, że bieżące `password_encryption` nie było potwierdzone jako SCRAM-SHA-256.

Dla nowych login roles:

1. sesja tworząca/rotująca credential jawnie ustawia `password_encryption='scram-sha-256'`,
2. hasła są generowane losowo poza repo,
3. wartości nie trafiają do GitHub, logów Actions ani dokumentacji,
4. runtime credential trafia wyłącznie do `DATABASE_URL`,
5. migrator credential trafia wyłącznie do `MIGRATOR_DATABASE_URL`,
6. oba connection strings muszą być różne,
7. po cutover credential obecnej szerokiej roli nie może pozostać w runtime environment.

## 9. Search path

Dla obu ról docelowo:

`search_path = pg_catalog, public`

Runtime nie ma CREATE w `public`, więc nie może podmieniać obiektów rozwiązywanych przez search path.

## 10. Gate 14B activation prerequisites — nadal bez produkcyjnego wykonania

Przed faktycznym przełączeniem `DATABASE_URL` na `gracz_runtime_v3` wymagane są:

1. cztery write-only schema-probes usunięte/zmienione,
2. pełne CI po tej zmianie,
3. role utworzone z SCRAM-SHA-256,
4. ownership obiektów V3 przeniesiony na migratora,
5. migrator uruchomiony w zatwierdzonym maintenance/cutover step,
6. runtime ACL zastosowany po migracji,
7. read-only verification collector uruchomiony jako `gracz_runtime_v3`,
8. negative tests potwierdzające brak CREATE/TRUNCATE/TRIGGER/REFERENCES/ownership,
9. dopiero potem zmiana runtime `DATABASE_URL`.

Punkty 3–9 są operacjami przyszłego kontrolowanego remediation/cutover. **Nie zostały wykonane w Gate 14B design.**

## 11. Cutover order — projekt

Bezpieczna kolejność wykonawcza dla późniejszej autoryzowanej operacji:

1. maintenance / stop mutations,
2. Gate 15 preconditions + backup/restore evidence,
3. utworzenie login roles i credentiali SCRAM,
4. przeniesienie ownership wyłącznie obiektów V3 na `gracz_migrator_v3`,
5. ustawienie `MIGRATOR_DATABASE_URL`,
6. wykonanie migratora i `--verify`,
7. zastosowanie runtime ACL manifest,
8. read-only Gate 14B verifier jako runtime role,
9. negative privilege tests,
10. ustawienie `DATABASE_URL` na `gracz_runtime_v3`,
11. start aplikacji z fail-closed schema check,
12. fresh Gate 14 collector,
13. ABORT/NO-GO przy jakimkolwiek nadmiarowym privilege lub schema mismatch.

## 12. Warunki PASS Gate 14B — design

Gate 14B design uznaje się za PASS, ponieważ projekt określa jednoznacznie:

- role i ich atrybuty,
- rozdział credentiali,
- ownership,
- database/schema privileges,
- exact table DML matrix,
- exact sequence privilege model,
- deny-list DDL/admin privileges,
- PUBLIC/default ACL policy,
- SCRAM policy,
- fail-closed unknown/legacy object policy,
- activation prerequisites,
- read-only verification contract.

## 13. Formalna decyzja

**GATE 14B = PASS — DESIGN-LEVEL LEAST-PRIVILEGE MODEL COMPLETE.**

Jednocześnie:

- role nie zostały utworzone,
- ownership nie został zmieniony,
- ACL nie zostały zastosowane,
- `DATABASE_URL` nie został zmieniony,
- `MIGRATOR_DATABASE_URL` nie został użyty na produkcji,
- Render nie został dotknięty,
- Gate 14 overall pozostaje **BLOCKED — REMEDIATION REQUIRED**,
- produkcja V3 pozostaje **NO-GO**.

Następny formalny krok ETAPU 3 po zapisaniu Gate 14B: **Gate 14C — crypto keyring v1/v2 design**.

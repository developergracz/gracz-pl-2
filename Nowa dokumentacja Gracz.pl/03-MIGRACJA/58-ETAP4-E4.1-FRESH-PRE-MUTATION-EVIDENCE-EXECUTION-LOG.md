# ETAP 4 — E4.1 Fresh Pre-Mutation Evidence — execution log

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status E4.1: **IN PROGRESS / PRODUCTION READ-ONLY / NO-MUTATION**  
Production V3: **NO-GO**

## 1. Frozen source baseline

- PR: `#26`
- Head branch: `audit/gate14a2-runtime-ddl-separation`
- Frozen source SHA: `cb073bad3050ffc9726e0a1528c2ec4a4808f12e`
- Render mutation lock pozostaje aktywny.
- `gracz-checkers-test` pozostaje zawieszony.
- `Auto-Deploy = Off`.

## 2. E4.1-B — migration package 001–014 / plan + checksums

### 2.1 Metoda

Zweryfikowano dokładną zawartość pakietu migracji z frozen source SHA i uruchomiono w izolowanym lokalnym verifierze ścieżkę planu odpowiadającą komendzie pakietowej:

`node --require ./src/pg-secure-preload.cjs src/migrator/migrate-v3.js --plan`

Warunki wykonania:

- `MIGRATOR_DATABASE_URL` nie był ustawiony,
- `DATABASE_URL` nie był ustawiony,
- nie uruchomiono `--verify`,
- nie uruchomiono `apply`,
- nie wykonano żadnego połączenia z PostgreSQL,
- nie wykonano DDL/DCL/DML,
- plan zakończył się kodem sukcesu.

Kod `migrate-v3.js` najpierw odkrywa i checksumuje migracje, a w trybie `--plan` drukuje wynik i kończy proces przed pobraniem `MIGRATOR_DATABASE_URL` i przed utworzeniem puli PostgreSQL.

### 2.2 Sequence verification

Pakiet zawiera dokładnie kolejne migracje `001`–`014`, bez luki i bez duplikatu numeru:

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

`015` nie należy do tego baseline E4.1-B.

### 2.3 SHA-256 plan output

| Version | Name | SHA-256 |
|---|---|---|
| 001 | identity | `2629f626dae07f052b7dc3ac4ce58540bfa7a44da1fd62cf460459afb3a9d0be` |
| 002 | messages | `0bed30e27a090b96351f3bdfcf0ef91606d2f51e14b5693d1b9c98ecd7d0f858` |
| 003 | game-sessions | `42ce37a6af37c3292a28c96a47684a01d57db4267892b61d424823e8d39e09b8` |
| 004 | secure-account | `87218c50d44410e0423f8282a118f25f3d358dfe89752319bf246f3607dab0b7` |
| 005 | auth-sessions | `79b809b6c392fc9d6cc304b4f98c5b61877d038724c513f5e69eea0a318de33a` |
| 006 | message-attachments | `753a7127739047078fc2dc3783d735c7a3cf2d2a09ed2c42c70b908e12ac2e65` |
| 007 | rbac-mfa | `d5fd5827f5a37c7dd166a0fb5970b35e0a186b981aa2ab699b371676428a50ad` |
| 008 | audit | `399bd3a1125f9d6ce5dca5250f1f16548aa7a2fef03ba9915783a23ca3b2b953` |
| 009 | moderation | `cdfdcd412ace8cf02cb13c331f68a621f748f32bb84836266212c55e5594e4b2` |
| 010 | global-chat-social | `48601b7532b05880457fd8d9aa6e7c05a820a08c9c652a529b378f80d3a202a3` |
| 011 | tournaments | `8ef4d71acc070865c6afa586cbf7c07e408a5e169fd7ebe0f4c7b22d70c19b34` |
| 012 | newsletter-core | `2ad0e9496f58aa64a9a055a447214ebf519e15efed2ac1cfd5a7c8439edcb302` |
| 013 | newsletter-admin | `bed5834cfc1757dd8c4f2948a91ac15cebe717140ddb801791f8eb4c1b286e23` |
| 014 | thousand-games | `1e9a4d86c0675398f6466000ef8ee22cfb318ad0d14bb3e643e4fba9196c3855` |

### 2.4 Decision

**E4.1-B = PASS**

Powody:

- migration sequence `001–014` jest kompletna,
- brak luki numeracyjnej,
- brak duplikatu,
- nazwy odpowiadają zatwierdzonemu Gate 14A extraction plan,
- każdy checksum ma poprawny SHA-256,
- plan zakończył się sukcesem,
- plan nie pobiera produkcyjnego credential i nie łączy się z PostgreSQL,
- nie wykonano żadnego DDL/DCL/DML.

## 3. E4.1-C — Fresh Gate 13 active-state collector

### 3.1 Repo-only preflight

Zweryfikowano kanoniczną checklistę E4.1 oraz collector:

- `48-ETAP4-E4.1-FRESH-PRE-MUTATION-EVIDENCE-CHECKLIST.md`,
- `22-GATE-13-ACTIVE-STATE-INVENTORY.sql`,
- historyczny wynik odniesienia `23-GATE-13-ACTIVE-STATE-INVENTORY-RESULTS.md`.

Collector jest zaprojektowany jako privacy-safe i read-only:

- rozpoczyna `BEGIN TRANSACTION READ ONLY`,
- wykonuje wyłącznie agregujące odczyty potwierdzonych tabel AS-IS i widoków/statystyk PostgreSQL,
- nie wypisuje user_id, e-maili, tokenów, hashy, treści wiadomości ani sekretów,
- kończy `ROLLBACK`,
- nie zawiera operacji DDL/DCL/DML.

Zakres Gate 13 obejmuje świeży stan danych i aktywności PostgreSQL: persisted game state, turnieje, auth/session/reset/registration/MFA, newsletter, moderation/social oraz `pg_stat_activity`/`pg_locks`. Nie jest to repo-only schema-lint ani analiza nieużywanych tabel/kolumn/indexów.

### 3.2 Fresh execution — metoda i integralność

Fresh collector został wykonany po freeze przeciwko `gracz_pl_database` przez `psql 18.6`.

Przed wykonaniem:

- potwierdzono skuteczne połączenie z właściwą bazą,
- potwierdzono `transaction_read_only = on`,
- połączenie kontrolne zakończono `ROLLBACK`,
- lokalny plik collectora `22-GATE-13-ACTIVE-STATE-INVENTORY.sql` zweryfikowano SHA-256: `09C6EF076AF6644C6AFB53624CE715B741C7CD430D70FC95BC218BCD49A9815B`.

Fresh run:

- rozpoczął transakcję read-only,
- wykonał wyłącznie agregujące `SELECT`,
- nie wykonał DDL/DCL/DML,
- nie ujawnił credential values, sekretów ani PII,
- zakończył `ROLLBACK`.

Raw fresh result został zachowany jako:

`59-ETAP4-E4.1-C-GATE13-FRESH-ACTIVE-STATE-RESULT-2026-08-29.txt`

SHA-256 oryginalnego lokalnego pliku wynikowego przed normalizacją kodowania do repozytorium:

`05f3d9634646a1a06fa6fece7f35571029320e58c60044ccc0f12392fbff9236`

### 3.3 Fresh result — active state

#### Checkers

- `active_games = 2`
- `active_with_any_connected_player = 2`
- `sessions_total = 2`
- `updated_last_10m = 0`
- `invalid_json = 0`
- `unknown_status = 0`

#### Thousand

- `games_total = 29`
- `in_progress = 29`
- `updated_last_10m = 0`
- `unknown_status = 0`
- `awaiting_next_round_or_redeal = 0`
- `game_ended = 0`

#### Tournaments

Wszystkie aktywne liczniki = `0`; `tournaments_total = 0`.

#### Auth / identity workflows

- `sessions_active_runtime_rule = 0`
- `sessions_unrevoked_unexpired = 0`
- `sessions_idle_or_expired_not_revoked = 1`
- `mfa_enabled = 0`
- `mfa_setup_pending = 0`
- `registration_codes_active = 0`
- `reset_tokens_active = 0`

#### Newsletter

- `subscribers_total = 5`
- `subscribed = 3`
- `pending_confirmation_total = 2`
- `pending_confirmation_expired = 2`
- `pending_confirmation_unexpired = 0`
- `pending_confirmation_delivery_gap = 0`
- `unknown_status = 0`

#### Moderation / social

- `chat_reports_total_without_resolution_state = 0`
- `friend_requests_pending = 2`
- `moderation_appeals_open = 0`
- `moderation_appeals_unknown_status = 0`
- `moderation_decisions_total = 6`

#### PostgreSQL runtime

- `other_active_connections = 0`
- `other_client_connections = 0`
- `other_idle_in_transaction = 0`
- `other_transactions_over_30s = 0`
- `waiting_locks = 0`

### 3.4 Gate 13 stale legacy state classification

`gracz_checkers`: 2 rows remain classified as active, including 2 with connected-player state; no rows updated within the last 10 minutes.

`gracz_thousand_games`: 29 rows remain `in_progress`; no rows updated within the last 10 minutes.

PostgreSQL runtime evidence shows zero other active/client connections, zero idle-in-transaction sessions, zero transactions over 30 seconds and zero waiting locks.

**Classification:** persisted stale legacy application state; **not evidence of current writer activity**.

**Handling:** preserve unchanged during E4.1; no cleanup, closure, merge, delete or status mutation. Reconcile explicitly before cutover.

Nie używać sformułowania „brak aktywnej rozgrywki”. Fresh evidence potwierdza brak dowodu bieżącej aktywności runtime/writera, ale istnieją persisted application rows oznaczone jako `active` / `in_progress`.

### 3.5 Decision

**E4.1-C = PASS**

Powody:

- fresh Gate 13 wykonano po freeze,
- collector działał w transakcji read-only i zakończył `ROLLBACK`,
- brak dowodu aktywnego mutation writera,
- brak competing transaction,
- brak `idle in transaction`,
- brak transakcji >30 s,
- brak waiting locks,
- brak świeżej aktualizacji persisted game state w ostatnich 10 minutach,
- stale Checkers/Thousand state zostało jawnie sklasyfikowane jako persisted stale legacy state do późniejszej reconciliacji, bez mutacji w E4.1.

## 4. E4.1-D — Fresh Gate 14 AS-IS security / DB permissions collector

### 4.1 Repo-only preflight i integralność collectora

Zweryfikowano kanoniczną checklistę oraz właściwy collector:

- `48-ETAP4-E4.1-FRESH-PRE-MUTATION-EVIDENCE-CHECKLIST.md`,
- `26-GATE-14-SECURITY-CREDENTIALS-PERMISSIONS-COLLECTOR.sql`,
- historyczny wynik odniesienia `27-GATE-14-SECURITY-CREDENTIALS-PERMISSIONS-RESULTS.md`.

Collector:

- rozpoczyna `BEGIN TRANSACTION READ ONLY`,
- kończy `ROLLBACK`,
- wykonuje wyłącznie odczyty katalogów/metadanych PostgreSQL,
- nie wykonuje DDL/DCL/DML,
- nie wypisuje connection stringów, passwordów, secret values, tokenów, ciphertextów ani PII.

Kanoniczny Git blob SHA collectora na `main`:

`95565d8342787ac70dc5c14108d3b7823e28d152`

Lokalna kopia użyta do wykonania została zweryfikowana jako bajt-w-bajt zgodna z tym blobem. Do run użyto pliku `.sql`.

Dodatkowo przed run ustawiono session-level guard:

`PGOPTIONS=-c default_transaction_read_only=on`

oraz lokalnie potwierdzono status `READY` bez ujawniania DB URL.

### 4.2 Fresh execution — metoda i wynik

Fresh collector został wykonany po freeze przeciwko `gracz_pl_database` przez `psql 18.6`.

Checklistowy brak nazwy roli w samym collectorze uzupełniono bezpiecznym read-only odczytem `SELECT current_user AS current_db_role;` w tej samej sesji. Nie ujawniono żadnych credential values.

Fresh evidence:

- `current_db_role = gracz_pl_database_user`,
- `transaction_read_only = 1`,
- `current_connection_ssl = 1`,
- `server_ssl_enabled = 1`,
- `row_security_on = 1`,
- `password_encryption_scram_sha_256 = 0`,
- `rolsuper = 0`,
- `rolreplication = 0`,
- `rolbypassrls = 0`,
- `rolcanlogin = 1`,
- `rolcreatedb = 1`,
- `rolcreaterole = 1`,
- `direct_role_memberships = 0`,
- `database_connect = 1`,
- `database_create = 1`,
- `database_owner_current = 1`,
- `database_temp = 1`,
- `public_schema_create = 1`,
- `public_schema_usage = 1`,
- `public_tables_total = 28`,
- `tables_owned_by_current = 28`,
- `tables_select/insert/update/delete/truncate/references/trigger = 28/28`,
- `public_sequences_total = 8`,
- `sequences_owned_by_current = 8`,
- `sequences_select/update/usage = 8/8`,
- `public_schema_create_grants = 0`,
- `public_table_select_grants = 0`,
- `public_table_write_grants = 0`,
- `rls_enabled_tables = 0`,
- `rls_forced_tables = 0`,
- `default_acl_public_write_entries = 0`,
- `default_acl_rows_current_owner = 0`.

Collector zakończył się `ROLLBACK`.

Raw fresh result został zachowany jako:

`60-ETAP4-E4.1-D-GATE14-FRESH-DB-PERMISSIONS-RESULT-2026-08-29.txt`

SHA-256 oryginalnego lokalnego pliku wynikowego przed normalizacją kodowania do repozytorium:

`e7183029d1467b743466e5643750ca152538e9d8e52653109ca11a0bc5012e1a`

### 4.3 Interpretacja — collector PASS nie oznacza security PASS

**Fresh collector execution = PASS.**

Ten PASS oznacza wyłącznie, że wymagany snapshot został poprawnie zebrany w trybie read-only. Nie oznacza, że obecny model bezpieczeństwa jest zaakceptowany.

**Gate 14 AS-IS DB security posture = BLOCKED / REMEDIATION REQUIRED.**

Fresh blocker evidence:

- bieżąca rola ma `CREATEDB=1`,
- bieżąca rola ma `CREATEROLE=1`,
- bieżąca rola jest właścicielem bazy,
- ma `database CREATE`,
- ma `public schema CREATE`,
- jest właścicielem `28/28` tabel i ma pełny odczyt/zapis oraz `TRUNCATE`/`REFERENCES`/`TRIGGER` na `28/28`,
- jest właścicielem `8/8` sekwencji i ma `SELECT`/`UPDATE`/`USAGE` na `8/8`,
- bieżące ustawienie `password_encryption` nie zostało potwierdzone jako `scram-sha-256`.

Fresh pozytywne evidence:

- SSL jest aktywne,
- `PUBLIC` nie ma schema CREATE, table SELECT ani table write grants,
- default ACL nie daje `PUBLIC` uprawnień zapisu,
- `RLS` jest obecnie wyłączone; ten fakt jest informacyjny i sam w sobie nie stanowi automatycznego blockera.

W E4.1 **nie naprawiamy** tych uprawnień. E4.1-D jest snapshotem AS-IS przed remediation.

Zakres tego fresh SQL collectora obejmuje PostgreSQL DB permissions/security metadata. Nie odświeża on samodzielnie runtime/app evidence dotyczącego crypto roots, `NODE_ENV`, Turnstile, `PUBLIC_BASE_URL` ani provider configuration. Historycznych wniosków dla tych obszarów nie należy przedstawiać jako fresh E4.1-D evidence bez osobnego fresh capture.

### 4.4 Decision

**E4.1-D = PASS — fresh Gate 14 DB permissions evidence collected and preserved.**

Jednocześnie:

**Gate 14 AS-IS DB security = BLOCKED / REMEDIATION REQUIRED.**

Powody:

- collector działał read-only i zakończył `ROLLBACK`,
- wymagane DB role/privilege/ownership evidence zostało zebrane,
- nie ujawniono credential values, sekretów ani PII,
- nie wykonano żadnej zmiany uprawnień,
- fresh evidence potwierdza broad current-role blocker, który ma zostać rozwiązany dopiero w kontrolowanych krokach remediation po zakończeniu E4.1.

**Production remains READ-ONLY / NO-MUTATION; no permissions are changed in E4.1.**

## 5. E4.1-E — Fresh Backup / pre-mutation anchor

### 5.1 Provider capability i metoda

Render Free tier nie udostępnia zarządzanych backupów/exportów ani Point-in-Time Recovery dla tej instancji. Zamiast provider backup wykonano pełny logiczny backup PostgreSQL przez lokalny `pg_dump 18.6`.

Backup został wykonany po E4.0 freeze i przed jakąkolwiek dozwoloną mutacją E4.2+.

Production pozostała w trybie NO-MUTATION; `pg_dump` wykonywał odczyt danych i zapisywał artefakt lokalnie.

### 5.2 Fresh backup evidence

Artefakt:

`E4.1-E-gracz-pl-database-pre-mutation-2026-08-29.dump`

Wynik:

- `PG_DUMP_EXIT=0`,
- format: PostgreSQL custom archive,
- rozmiar: `1,440,765` bajtów,
- timestamp: `29.08.2026 23:09:52` (lokalny czas operatora),
- `pg_restore --list` zakończył się `PG_RESTORE_LIST_EXIT=0`,
- SHA-256: `87BC0380C8F7EF39E21600E87B80045E4A9C52481C9D4EAE7FB937E98CDC8D8B`.

Checksum został potwierdzony na dwóch lokalnych kopiach:

1. kopia robocza w Downloads,
2. druga kopia w `Documents\Gracz.pl-E4.1-Backup`.

Obie kopie są bajt-w-bajt zgodne.

Szczegółowy bezpieczny artefakt metadanych:

`61-ETAP4-E4.1-E-FRESH-BACKUP-ANCHOR-2026-08-29.md`

Surowy `.dump` nie jest zapisywany w GitHub, ponieważ zawiera dane produkcyjne.

### 5.3 Retention contract

Obie zweryfikowane lokalne kopie mają zostać zachowane bez zmian przez cały maintenance/cutover oraz rollback window. Nie wolno ich usuwać, nadpisywać ani zastępować przed formalnym końcem wymaganej retencji.

OneDrive nie jest wymaganiem checklisty i nie jest podstawą decyzji E4.1-E. Nie opieramy PASS na niepotwierdzonej synchronizacji chmurowej.

`pg_restore --list = 0` potwierdza czytelność archiwum, ale **nie jest pełnym restore validation**. Faktyczne odtworzenie i walidacja należą do E4.1-F.

### 5.4 Decision

**E4.1-E = PASS — fresh pre-mutation backup anchor created, integrity-checked and retained under explicit retention contract.**

Powody:

- fresh backup powstał po E4.0 freeze,
- `pg_dump` zakończył się sukcesem,
- archiwum ma niezerowy, udokumentowany rozmiar,
- `pg_restore --list` potwierdził czytelność archiwum,
- SHA-256 został zapisany i potwierdzony dla dwóch kopii,
- backup jest objęty jawnym retention contract,
- production nie została zmodyfikowana.

## 6. Zakres read-only i następny krok

E4.1-B = **PASS**.  
E4.1-C = **PASS**.  
E4.1-D = **PASS — fresh evidence collected; AS-IS DB security remains BLOCKED**.  
E4.1-E = **PASS — fresh pre-mutation backup anchor**.  
E4.1 jako całość pozostaje **IN PROGRESS**.  
Production V3 pozostaje **NO-GO**.

**Production remains read-only / NO-MUTATION; restore validation may mutate only an isolated non-production restore target.**

Do czasu pełnego E4.1 COMPLETE nadal zabronione są:

- E4.2,
- migrator apply,
- provisioning ról,
- DDL/DCL/DML na produkcji,
- zmiana `DATABASE_URL`,
- zmiana sekretów,
- rekey,
- merge/deploy PR #26,
- wznowienie `gracz-checkers-test`.

Następny kanoniczny punkt checklisty:

**E4.1-F — Restore rehearsal / restore validation.**

Restore destination musi być izolowanym non-production targetem. Restore może mutować wyłącznie ten target. Production pozostaje NO-MUTATION. E4.1-F jest nadal **NOT RUN**.

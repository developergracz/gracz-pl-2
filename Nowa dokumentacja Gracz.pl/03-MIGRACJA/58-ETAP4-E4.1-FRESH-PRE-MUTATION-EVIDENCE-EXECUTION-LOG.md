# ETAP 4 — E4.1 Fresh Pre-Mutation Evidence — execution log

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status E4.1: **IN PROGRESS / READ-ONLY ONLY**  
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

### 3.2 Ważne ograniczenie wykonawcze

Kanoniczny E4.1-C wymaga **fresh wykonania collectora przeciwko bazie `gracz_pl_database` po freeze**. Sama analiza pliku SQL w repozytorium nie może udowodnić aktualnego active-state ani aktualnych competing transactions.

Dlatego:

- repo-only safety preflight: **PASS**,
- fresh collector execution: **NOT RUN YET**,
- E4.1-C final status: **IN PROGRESS / NOT YET PASS**.

Nie wolno zastępować fresh DB capture historycznym Gate 13 wynikiem. Historyczny baseline pozostaje tylko materiałem porównawczym.

### 3.3 Kryteria fresh run

Fresh run musi potwierdzić co najmniej:

- `readOnly = true`,
- capture timestamp po E4.0,
- brak nowej aktywnej canonical rozgrywki,
- brak aktywnych auth/session/reset/registration states sprzecznych z maintenance contract,
- brak competing transactions/writerów/locks,
- legacy/quarantine state zgodny z wcześniejszą klasyfikacją albo różnica formalnie wyjaśniona.

Twardy ABORT: nowa canonical active game, aktywny mutation writer, competing transaction albo fresh state niezgodny z freeze.

## 4. Ograniczenie i następny krok

E4.1-B pozostaje **PASS**. E4.1-C został rozpoczęty i przeszedł repo-only safety preflight, ale **nie może dostać PASS bez fresh read-only capture z PostgreSQL**.

Do czasu pełnego E4.1 COMPLETE nadal zabronione są:

- E4.2,
- migrator apply,
- provisioning ról,
- DDL/DCL/DML,
- zmiana `DATABASE_URL`,
- zmiana sekretów,
- rekey,
- merge/deploy PR #26,
- wznowienie `gracz-checkers-test`.

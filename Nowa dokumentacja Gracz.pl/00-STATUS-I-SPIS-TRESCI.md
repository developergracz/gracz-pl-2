# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy

Dokumentacja rozdziela: **POTWIERDZONE**, **WYMAGA WERYFIKACJI ŚRODOWISKA**, **ARCHITEKTURA DOCELOWA** oraz **ARTEFAKTY WYKONAWCZE MIGRACJI**. Punktem odniesienia rozpoczętej analizy kodowej był `origin/main @ db3c15a`; dowody środowiskowe są dokumentowane osobno.

## Stan audytu i architektury

### ETAP 1B — mapa PostgreSQL

**STATUS: ZAMKNIĘTY 28.08.2026.**

Wykonano mapę kodową 26/26, rzeczywisty dump Rendera (28 tabel), porównanie oraz końcowy Model Match/rejestr rozbieżności.

### ETAP 2 — architektura docelowa i model migracji

**STATUS: ZAMKNIĘTY 28.08.2026.**

Zatwierdzone i zapisane:
- Backend V3,
- PostgreSQL V3 Iteracje 1–8,
- macierz migracji 28/28 AS-IS -> V3,
- `02-BAZA-DANYCH/20-POSTGRESQL-V3-FINAL.md` — finalna konsolidacja i zatwierdzenie.

### ETAP 3 — plan migracji i przygotowanie wykonania

**STATUS: W TRAKCIE od 28.08.2026.**

## FORMALNY GATE PRODUKCYJNEGO DDL

**DDL V3: NO-GO.**

Bezpośrednie blokery Data Quality:
- **DQ-001** — orphan friendship / nierozstrzygnięty principal `guest-*`,
- **DQ-002** — 2 grupy kolizji normalized-email obejmujące 5 kont; decyzje per-account niezatwierdzone.

Do czasu zamknięcia tych blockerów oraz pozostałych bramek preflight nie wolno uruchamiać produkcyjnego executable `EXPAND`, `BACKFILL`, nowych V3 `UNIQUE/FK/NOT NULL` ani destructive remediation.

#### Iteracja 1 — Preflight migracji

**STATUS: W TRAKCIE — DATA QUALITY ZPROFILOWANE, BLOCKERY ZIDENTYFIKOWANE, HISTORYCZNIE SKORELOWANE I OBJĘTE MACIERZĄ DECYZYJNĄ.**

Zapisane artefakty:
- `03-MIGRACJA/01-PREFLIGHT-MIGRACJI.md`
- `03-MIGRACJA/02-ENVIRONMENT-BASELINE-COLLECTOR.sql`
- `03-MIGRACJA/02-ENVIRONMENT-BASELINE.md`
- `03-MIGRACJA/03-DATA-PROFILE-COLLECTOR.sql`
- `03-MIGRACJA/03-DATA-PROFILE-28-TABLES.md`
- `03-MIGRACJA/05-DATA-QUALITY-ORPHAN-COLLISION-COLLECTOR.sql`
- `03-MIGRACJA/05-DATA-QUALITY-ORPHAN-COLLISION.md`
- `03-MIGRACJA/06-BLOCKER-DRILLDOWN-COLLECTOR.sql`
- `03-MIGRACJA/07-AUDYT-WRITEROW-I-PLAN-NAPRAWY-BLOCKEROW.md`
- `03-MIGRACJA/08-MACIERZ-DECYZJI-DQ-001-DQ-002.md`
- `03-MIGRACJA/09-PLAN-DML-REMEDIATION.md` — szkielet wykonawczy, bez SQL i bez autoryzacji produkcyjnego DML.

Potwierdzone środowiskowo:
- Render PostgreSQL 18.4,
- rzeczywista liczba tabel 28/28,
- dokładne COUNT(*) 28/28 — PASS,
- physical size/index/TOAST 28/28 — PASS,
- łączna liczba rekordów 13 865,
- `gracz_audit_log` 13 743 rekordy (~99,1% wszystkich wierszy),
- cały zestaw 28 tabel około 8,2 MiB,
- sekwencje, timestamp ranges, constraint counts i index counts zebrane,
- 1 orphan friendship,
- 2 grupy kolizji normalized-email obejmujące 5 kont,
- 3 rozbieżności newsletter `consent_at` vs `consented_at`.

Potwierdzone w writerach i historii AS-IS:
- friendship writer nie weryfikuje requester/addressee w `gracz_accounts`,
- `gracz_chat_friends` nie ma FK do accounts,
- friendship zostało wprowadzone w commicie `10a0e625067c007a42de507c50fa3cd820ed7185` z 23.08.2026 już bez FK/account-existence check,
- standardowy Postgres account writer w baseline normalizuje e-mail `trim + lower` i blokuje duplikat,
- guard unique-email został dodany dopiero w commicie `6e7a55ea8e5d2f4db4dabb2e15d1e1acb459bf1c` z 27.08.2026 07:31:58 UTC,
- wszystkie 5 kont z dwóch kolizyjnych grup ma `created_at` sprzed tego commita; najpóźniejsze powstało około 11 min 33 s wcześniej,
- aktualny newsletter zapisuje `consented_at`,
- lifecycle recorder używa `consented_at` jako czasu `granted`.

Wniosek: DQ-002 ma silnie potwierdzoną chronologię pre-guard. DQ-001 ma potwierdzoną lukę istniejącą od momentu wprowadzenia friendship, ale źródło principalu `guest-*` nadal wymaga korelacji historycznej. Newsletter pozostaje hybrydą legacy/new i wymaga zachowania provenance.

Macierz `08-MACIERZ-DECYZJI-DQ-001-DQ-002.md` formalizuje bezpieczne warianty remediation bez wykonywania DML:
- DQ-001: `MAP-TO-CANONICAL`, `LEGACY-QUARANTINE`, ewentualny późniejszy `DELETE-AS-INVALID`,
- DQ-002: `KEEP-CANONICAL`, `REQUIRE-EMAIL-CHANGE`, `LEGACY-IDENTITY`, wyjątkowo `MERGE` przy silnym dowodzie,
- domyślnie: **nie scalać kont** i **nie przepinać guest principal bez jednoznacznego dowodu**.

`09-PLAN-DML-REMEDIATION.md` definiuje już ramę wykonawczą: precheck, freeze decyzji, osobne operacje DQ-001/DQ-002, kontrolę race condition, transakcje, rollback, postcheck, stop conditions oraz kryteria zakończenia. Dokument nadal nie zawiera wykonywalnego SQL.

Otwarte krytyczne bramki:
- domknięcie źródła `guest-*` i decyzja DQ-001,
- privacy-safe per-account evidence + decyzja dla wszystkich 5 kont DQ-002,
- rerun data-quality po remediation,
- świeży schema snapshot/diff w punkcie wykonania,
- pełny backup + restore test,
- pełny writer/reader/endpoint/worker inventory,
- crypto compatibility Messaging/attachments/MFA,
- active-state/cutover assessment,
- credential rotation/least privilege/secret hygiene,
- rollback/maintenance window i końcowe GO/NO-GO.

#### Iteracja 2 — Plan DDL migracji

**STATUS: ROZPOCZĘTY 28.08.2026 — PLAN, NO-GO DLA PRODUKCYJNEGO DDL.**

Utworzono:
- `03-MIGRACJA/04-PLAN-DDL-MIGRACJI-ITERACJA-2.md`

Plan zatwierdza framework:
- `EXPAND -> BACKFILL -> VERIFY/RECONCILE -> CUTOVER -> OBSERVE -> CONTRACT`,
- podział DDL per bounded context,
- kolejność zależności backfill,
- zasady lock/timeout/index/constraint,
- rollback przed i po writer cutover,
- zakaz DROP w pierwszej fazie cutover,
- writer cutover per context,
- Transactional Outbox/Idempotency jako fundament V3.

Produkcja pozostaje **NO-GO**, dopóki otwarte blockery Preflight nie zostaną zamknięte.

#### Następny krok

Następna praca wykonawcza:
- domknąć kodowe/historyczne źródło principalu `guest-*`,
- zebrać privacy-safe evidence per account dla `gamerpl`, `gamerde`, `gracz.pl`, `gamerpolska`, `gamer`,
- uzupełnić i zatwierdzić decyzję remediation per rekord w macierzy `08`,
- uzupełnić `09-PLAN-DML-REMEDIATION.md` o zatwierdzone decyzje — nadal bez automatycznego wykonania na produkcji,
- równolegle kontynuować pełny writer/reader/endpoint/worker inventory.

Dopiero po zamknięciu właściwych bramek można dopuścić pierwszy executable EXPAND.

## Spis dokumentacji

### Architektura
- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md`
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`

### PostgreSQL — AS-IS / porównanie
- `02-BAZA-DANYCH/00-MAPA-POSTGRESQL-STATUS.md`
- `02-BAZA-DANYCH/01-TOZSAMOSC-I-AUDYT.md`
- `02-BAZA-DANYCH/02-GRY-WARCABY-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/03-GRY-TYSIAC-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/04-GRY-GOMOKU-AS-IS.md`
- `02-BAZA-DANYCH/05-WIADOMOSCI-PRYWATNE-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/06-MODERACJA-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/07-GLOBAL-CHAT-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/08-TURNIEJE-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/09-NEWSLETTER-POSTGRESQL-AS-IS.md`
- `02-BAZA-DANYCH/10-POROWNANIE-POSTGRESQL-REPO-PRODUKCJA.md`
- `02-BAZA-DANYCH/11-MODEL-MATCH-I-ROZBIEZNOSCI.md`

### PostgreSQL V3 — ETAP 2
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md`
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md`
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md`
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md`
- `02-BAZA-DANYCH/16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md`
- `02-BAZA-DANYCH/17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md`
- `02-BAZA-DANYCH/18-POSTGRESQL-V3-ITERACJA-7-MODERATION.md`
- `02-BAZA-DANYCH/19-POSTGRESQL-V3-ITERACJA-8-MACIERZ-MIGRACJI-28-AS-IS-DO-V3.md`
- `02-BAZA-DANYCH/20-POSTGRESQL-V3-FINAL.md`

### Migracja — ETAP 3
- `03-MIGRACJA/01-PREFLIGHT-MIGRACJI.md`
- `03-MIGRACJA/02-ENVIRONMENT-BASELINE-COLLECTOR.sql`
- `03-MIGRACJA/02-ENVIRONMENT-BASELINE.md`
- `03-MIGRACJA/03-DATA-PROFILE-COLLECTOR.sql`
- `03-MIGRACJA/03-DATA-PROFILE-28-TABLES.md`
- `03-MIGRACJA/04-PLAN-DDL-MIGRACJI-ITERACJA-2.md`
- `03-MIGRACJA/05-DATA-QUALITY-ORPHAN-COLLISION-COLLECTOR.sql`
- `03-MIGRACJA/05-DATA-QUALITY-ORPHAN-COLLISION.md`
- `03-MIGRACJA/06-BLOCKER-DRILLDOWN-COLLECTOR.sql`
- `03-MIGRACJA/07-AUDYT-WRITEROW-I-PLAN-NAPRAWY-BLOCKEROW.md`
- `03-MIGRACJA/08-MACIERZ-DECYZJI-DQ-001-DQ-002.md`
- `03-MIGRACJA/09-PLAN-DML-REMEDIATION.md`

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe, architektura docelowa i wykonawcze artefakty migracyjne pozostają rozdzielone.
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

#### Wynik ETAPU 2

- bounded contexts: ZATWIERDZONE,
- ownership danych: ZATWIERDZONY,
- docelowy model tabel V3: ZATWIERDZONY,
- PK/FK/UNIQUE/CHECK i indeksy: ZATWIERDZONE zgodnie z Iteracjami 2–7,
- CAS/versioning: ZATWIERDZONE,
- single-writer/fencing invariant: ZATWIERDZONY,
- Transactional Outbox: ZATWIERDZONY,
- Idempotency: ZATWIERDZONE,
- kontrakty transakcyjne: ZATWIERDZONE,
- retencja/archiwizacja: ZATWIERDZONE na poziomie zasad z iteracji,
- macierz migracji rzeczywistych 28 tabel Render: 28/28,
- rollback/reconciliation/GO-NO-GO: ZATWIERDZONE na poziomie architektonicznym.

Zamknięcie ETAPU 2 nie oznacza wykonania migracji produkcyjnej. Produkcyjne DDL/DML, backfill, writer cutover, migracja workerów/endpointów i wyłączanie legacy należą do ETAPU 3.

### ETAP 3 — plan migracji i przygotowanie wykonania

**STATUS: W TRAKCIE od 28.08.2026.**

#### Iteracja 1 — Preflight migracji

**STATUS: ROZPOCZĘTA.**

Utworzono:
- `03-MIGRACJA/01-PREFLIGHT-MIGRACJI.md`

Preflight definiuje 15 bramek przed pierwszym wykonawczym DDL/backfillem:
- baseline commitów i środowiska,
- świeży schema snapshot,
- backup i restore test,
- row counts/size 28 tabel,
- PK/UNIQUE/FK/orphan/collision profiling,
- data-quality/status profiling,
- writer/reader/endpoint inventory,
- worker/event/realtime inventory,
- crypto compatibility,
- Identity/key mapping,
- active-state inventory,
- security/credentials/permissions,
- lock/capacity assessment,
- maintenance/cutover/feature flags,
- rollback i GO/NO-GO.

Ważne: Preflight nie jest jeszcze oznaczony jako GO, ponieważ część kryteriów wymaga świeżych dowodów z rzeczywistego Render PostgreSQL i środowiska wykonawczego.

#### Następny krok ETAPU 3

**Environment Baseline + 28-table Data Profile.**

Do zebrania:
1. świeży schema dump,
2. pełny backup + restore evidence,
3. aktualne counts i sizes 28/28,
4. duplicate/orphan/collision reports,
5. krytyczne profile Identity/Game/Tournament/Messaging/Chat/Moderation/Newsletter,
6. inventory produkcyjnych writerów/readers/endpoints/workers.

Dopiero po zamknięciu tych dowodów przechodzimy do wykonawczego **Planu DDL migracji**.

ETAP 3 korzysta z zatwierdzonego PostgreSQL V3 FINAL i macierzy 28/28. Nie zmienia architektury V3 bez jawnego ADR/change-control.

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

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe, architektura docelowa i wykonawcze artefakty migracyjne pozostają rozdzielone.
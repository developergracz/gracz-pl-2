# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy

Dokumentacja rozdziela: **POTWIERDZONE**, **WYMAGA WERYFIKACJI ŚRODOWISKA** oraz **ARCHITEKTURA DOCELOWA**. Punktem odniesienia rozpoczętej analizy kodowej był `origin/main @ db3c15a`; dowody środowiskowe są dokumentowane osobno.

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

Zamknięcie ETAPU 2 nie oznacza wykonania migracji produkcyjnej. Produkcyjne DDL/DML, backfill, writer cutover, migracja workerów/endpointów i wyłączanie legacy należą do kolejnego etapu.

### ETAP 3 — plan migracji i przygotowanie wykonania

**STATUS: OTWARTY 28.08.2026.**

Pierwszy zakres:
1. preflight środowiska i danych,
2. wykonawcza kolejność DDL,
3. backfill DML i provenance/re-key,
4. migracja kodu i endpointów,
5. eventy/outbox i workerzy,
6. testy/reconciliation,
7. cutover writerów,
8. rollback/runbook,
9. observation window,
10. contract/deprecate legacy.

ETAP 3 musi korzystać z zatwierdzonego PostgreSQL V3 FINAL i macierzy 28/28. Nie zmienia architektury V3 bez jawnego ADR/change-control.

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

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe, architektura docelowa i wykonawcze artefakty migracyjne pozostają rozdzielone.
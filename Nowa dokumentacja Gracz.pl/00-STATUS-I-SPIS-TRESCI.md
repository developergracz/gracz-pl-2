# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy

Dokumentacja rozdziela: **POTWIERDZONE**, **WYMAGA WERYFIKACJI ŚRODOWISKA** oraz **ARCHITEKTURA DOCELOWA**. Punktem odniesienia rozpoczętej analizy kodowej był `origin/main @ db3c15a`; dowody środowiskowe są dokumentowane osobno.

## Stan audytu

### ETAP 1B — mapa PostgreSQL

**STATUS: ZAMKNIĘTY 28.08.2026.**

Wykonano mapę kodową 26/26, rzeczywisty dump Rendera (28 tabel), porównanie oraz końcowy Model Match/rejestr rozbieżności.

### ETAP 2 — architektura docelowa i plan migracji

**STATUS: W TRAKCIE od 28.08.2026.**

Ukończone:
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`,
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md` — iteracja 1,
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md` — iteracja 2,
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md` — iteracja 3,
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md` — iteracja 4,
- `02-BAZA-DANYCH/16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md` — iteracja 5,
- `02-BAZA-DANYCH/17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md` — iteracja 6,
- `02-BAZA-DANYCH/18-POSTGRESQL-V3-ITERACJA-7-MODERATION.md` — iteracja 7,
- `02-BAZA-DANYCH/19-POSTGRESQL-V3-ITERACJA-8-MACIERZ-MIGRACJI-28-AS-IS-DO-V3.md` — iteracja 8.

### PostgreSQL V3 — Iteracja 8: macierz migracji 28 AS-IS -> V3 — ZAKOŃCZONA

Macierz obejmuje wszystkie **28/28 rzeczywistych tabel Render PostgreSQL** i dla każdej określa:
- bounded context i docelowe struktury V3,
- MIGRATE-AND-TRANSFORM / MERGE / DEPRECATE oraz warunkowy REPLACE,
- mapping kluczy i głównych pól/semantyki,
- backfill,
- kontrolę dual-write/cutover,
- shadow strategy,
- archiwizację i retencję,
- transformacje/re-key/provenance,
- migrację eventów, workerów i endpointów.

Dokument definiuje również:
- MERGE `gracz_role_changes` + `gracz_role_history` bez utraty provenance,
- DEPRECATE legacy audit z bramkami retencji i restore-tested backup,
- brak syntetyzowania fikcyjnych game events z current-state JSON,
- brak fikcyjnych historycznych ban/mute w Moderation,
- ochronę szyfrowanych Messaging/MFA danych,
- HIGH-drift migration path newslettera,
- kolejność migracji: preflight -> foundation -> Identity -> Game/Tournament -> Messaging/Chat/Moderation -> Newsletter -> contract/deprecate,
- walidację counts/orphans/checksums/invariants,
- reconciliation i rollback,
- GO/NO-GO przed produkcyjnym cutover.

### Następny krok ETAPU 2

**PostgreSQL V3 FINAL — konsolidacja Iteracji 1–8.**

Cel:
1. zatwierdzić kanoniczny katalog tabel V3,
2. zatwierdzić granice bounded contexts i ownership,
3. zatwierdzić wspólne reguły ID/FK/version/outbox/idempotency,
4. wskazać ADR/kwestie pozostające do decyzji implementacyjnej,
5. powiązać model docelowy z macierzą migracji 28/28,
6. określić formalne kryteria gotowości do ETAPU 3.

**ETAP 2 nie jest jeszcze formalnie zamknięty.** Zostanie zamknięty dopiero po utworzeniu i weryfikacji PostgreSQL V3 FINAL oraz końcowego statusu architektury/migracji.

## Spis dokumentacji

### Architektura
- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md`
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`

### PostgreSQL
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
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md`
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md`
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md`
- `02-BAZA-DANYCH/15-POSTGRESQL-V3-ITERACJA-4-IDENTITY-ROLE-AUDIT.md`
- `02-BAZA-DANYCH/16-POSTGRESQL-V3-ITERACJA-5-NEWSLETTER.md`
- `02-BAZA-DANYCH/17-POSTGRESQL-V3-ITERACJA-6-MESSAGING-CHAT.md`
- `02-BAZA-DANYCH/18-POSTGRESQL-V3-ITERACJA-7-MODERATION.md`
- `02-BAZA-DANYCH/19-POSTGRESQL-V3-ITERACJA-8-MACIERZ-MIGRACJI-28-AS-IS-DO-V3.md`

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe i architektura docelowa pozostają rozdzielone.
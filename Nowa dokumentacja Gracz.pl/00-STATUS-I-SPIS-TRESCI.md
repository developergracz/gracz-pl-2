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
- `02-BAZA-DANYCH/18-POSTGRESQL-V3-ITERACJA-7-MODERATION.md` — iteracja 7.

### PostgreSQL V3 — Iteracja 7: Moderation — ZAKOŃCZONA

Zdefiniowano projektowo:
- `moderation_cases` jako jednostkę workflow z version/CAS,
- `moderation_reports` jako kanoniczny intake z provenance,
- append-only `moderation_actions`,
- `moderation_sanctions` jako current persistent enforcement state dla mute/ban/restrictions,
- `moderation_appeals` z pełnym review workflow,
- `moderation_evidence` z minimalizacją danych i ochroną prywatnych treści,
- atomowe kontrakty mute/ban/unmute/unban/resolve/appeal w granicy Moderation,
- cross-context hide/delete jako workflow przez Outbox, bez bezpośredniego zapisu do tabel Chat,
- global ban jako workflow z Identity, a nie fałszywa jedna transakcja ACID ponad bounded contexts,
- integrację z RBAC, Audit, Security, Outbox, Idempotency i Realtime,
- retencję/legal hold oraz monitoring,
- kontrolowaną migrację `gracz_moderation_decisions`, `gracz_moderation_appeals` i intake `gracz_global_chat_reports`.

Korekta względem uproszczonego mappingu: legacy decisions i appeals nie są mechanicznie scalane w case. AS-IS decision jest wynikiem filtra, appeal wskazuje decision, a chat report jest osobnym intake. V3 zachowuje tę semantykę i tworzy case tylko według jawnych reguł workflow. AS-IS nie potwierdza persistent ban/mute tables, więc V3 nie backfilluje fikcyjnych sankcji historycznych.

### Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 8: końcowa macierz migracji 28 tabel AS-IS -> V3.**

Zakres:
1. wszystkie 28 tabel rzeczywistego Render PostgreSQL,
2. mapping tabela -> V3 bounded context/table,
3. mapping kluczowych kolumn i identyfikatorów,
4. MIGRATE / TRANSFORM / MERGE / DEPRECATE / ARCHIVE,
5. reguły provenance i re-key,
6. orphan/duplicate/conflict handling,
7. walidacja counts/checksums/invariants,
8. kolejność backfill/cutover/rollback,
9. warunki wyłączenia legacy.

Po Iteracji 8:
- formalny dokument PostgreSQL V3 FINAL,
- formalne zamknięcie modelu danych w ETAPIE 2.

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

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe i architektura docelowa pozostają rozdzielone.
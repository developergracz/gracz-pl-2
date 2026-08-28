# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy

Dokumentacja audytowa rozdziela:
1. **POTWIERDZONE** — fakty wynikające z kodu/repozytorium lub bezpośredniego dowodu środowiskowego,
2. **WYMAGA WERYFIKACJI ŚRODOWISKA** — elementy zależne od runtime, danych, konfiguracji i infrastruktury,
3. **ARCHITEKTURA DOCELOWA** — rekomendowany przyszły stan, nie opis AS-IS.

Punktem odniesienia rozpoczętej analizy kodowej był `origin/main @ db3c15a`. Dowody środowiskowe są dokumentowane osobno od dowodów repozytorium.

## Stan audytu

### ETAP 1B — mapa PostgreSQL

**STATUS: ZAMKNIĘTY 28.08.2026.**

Wykonano:
- inwentaryzację kodową **26/26 tabel**,
- AS-IS obszarów tożsamości, audytu, gier, wiadomości, moderacji, Global Chat, turniejów i newslettera,
- rzeczywisty `pg_dump --schema-only` bazy PostgreSQL na Renderze,
- porównanie repozytorium ze środowiskiem,
- końcowy Model Match i rejestr rozbieżności.

Rzeczywisty Render zawiera **28 tabel**, czyli dwa obiekty ponad zakres 26-tabelowej mapy. Najważniejsze wykryte odchylenia:
- HIGH: hybrydowy schema drift `gracz_newsletter_subscribers`,
- MEDIUM: `gracz_audit_log_legacy_1787562123031`,
- MEDIUM: `gracz_role_changes` obok `gracz_role_history`,
- MEDIUM: dodatkowe `version` w `gracz_game_sessions` bez wcześniejszego potwierdzenia użycia przez DML Warcabów jako CAS.

### ETAP 2 — architektura docelowa i plan migracji

**STATUS: W TRAKCIE od 28.08.2026.**

Ukończone dokumenty projektowe:
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`,
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md` — iteracja 1: założenia, bounded contexts i kompletna mapa 28 tabel Render -> status V3,
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md` — iteracja 2: konkretne DDL-style Game Platform, match-actor ownership/fencing, Transactional Outbox i idempotency.

Backend V3 definiuje docelowo:
- modularny backend z bounded contextami,
- wspólną platformę gier z niezależnymi silnikami domenowymi,
- `match-actor` / single-writer dla pojedynczego meczu,
- ochronę przed split-brain przez ownership/fencing,
- Transactional Outbox,
- idempotentne komendy i konsumentów,
- Realtime Gateway oddzielony od źródła prawdy,
- trwały model dla Gomoku,
- atomowy model krytycznych operacji turniejowych,
- docelową normalizację newslettera,
- konsolidację modeli ról i audytu,
- model wdrożeniowy modular monolith + wydzielone runtime/workers jako etap przejściowy.

Model PostgreSQL V3 — iteracja 1 klasyfikuje wszystkie 28 tabel środowiska:
- KEEP-AS-IS: 0,
- MIGRATE-AND-TRANSFORM: 25,
- MERGE: 2,
- DEPRECATE: 1.

Klasyfikacja jest decyzją projektową, nie zgodą na destrukcyjną migrację. Legacy audit może zostać usunięty dopiero po analizie danych, retencji i zależności.

### PostgreSQL V3 — Iteracja 2: stan

**ZAKOŃCZONY BLOK: Game Platform + Outbox + Idempotency.**

Zdefiniowano projektowo:
- `game_definitions`,
- `game_matches`,
- `game_match_participants`,
- `game_match_events`,
- `game_match_snapshots`,
- `match_actor_leases`,
- `outbox_events`,
- `idempotency_keys`,
- opcjonalny `processed_messages` dla wysokowolumenowych konsumentów.

Najważniejsze decyzje:
- `game_matches` jest kanonicznym agregatem meczu; historyczna nazwa `gracz_game_sessions` nie jest przenoszona jako źródło stanu meczu,
- `version` jest obowiązkowym elementem kontraktu DML, nie tylko kolumną,
- nie stosujemy `UNIQUE(owner_actor_id)` jako ochrony split-brain,
- ownership jest per `match_id` przez lease i rosnący fencing token,
- stary writer po utracie ownership nie może zatwierdzić późniejszego zapisu,
- zmiana stanu + domain event + outbox są atomowe w jednej transakcji,
- retry komend oraz konsumenci eventów są idempotentni,
- Realtime publikuje dopiero po commitcie przez outbox/broker,
- Warcaby, Tysiąc i Gomoku otrzymują jeden wspólny kontrakt persistence/runtime.

### Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 3: Tournament V3.**

Zakres następnego bloku:
1. `tournaments`,
2. `tournament_registrations`,
3. `tournament_rounds`,
4. `tournament_matches`,
5. versioning agregatu turnieju,
6. atomowe `join/start/report_result/advance_round`,
7. jawne powiązanie `tournament_matches.match_id -> game_matches.match_id`,
8. constrainty blokujące podwójne mecze/board/round,
9. integracja z outbox i idempotency.

Po Tournament V3 kolejność pozostaje:
- Identity & Access + Role/Audit,
- Newsletter V3,
- Messaging / Global Chat / Moderation,
- końcowa macierz migracji kolumna-po-kolumnie z 28 tabel AS-IS do struktur V3.

Projektowanie ETAPU 2 musi traktować wykryty schema drift jako realne ograniczenie migracyjne i nie może usuwać obiektów legacy bez analizy danych, retencji i aktywnych writerów/readers.

## Spis dokumentacji

### Architektura
- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md` — punkt wyjścia architektury.
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md` — architektura docelowa Backend V3: bounded contexts, match-actor/single-writer, outbox, realtime, ownership danych, deployment i kolejność implementacyjna.

### PostgreSQL
- `02-BAZA-DANYCH/00-MAPA-POSTGRESQL-STATUS.md` — końcowy status ETAPU 1B.
- `02-BAZA-DANYCH/01-TOZSAMOSC-I-AUDYT.md` — tożsamość i audyt.
- `02-BAZA-DANYCH/02-GRY-WARCABY-POSTGRESQL-AS-IS.md` — Warcaby.
- `02-BAZA-DANYCH/03-GRY-TYSIAC-POSTGRESQL-AS-IS.md` — Tysiąc.
- `02-BAZA-DANYCH/04-GRY-GOMOKU-AS-IS.md` — Gomoku.
- `02-BAZA-DANYCH/05-WIADOMOSCI-PRYWATNE-POSTGRESQL-AS-IS.md` — wiadomości i załączniki.
- `02-BAZA-DANYCH/06-MODERACJA-POSTGRESQL-AS-IS.md` — moderacja.
- `02-BAZA-DANYCH/07-GLOBAL-CHAT-POSTGRESQL-AS-IS.md` — Global Chat.
- `02-BAZA-DANYCH/08-TURNIEJE-POSTGRESQL-AS-IS.md` — turnieje.
- `02-BAZA-DANYCH/09-NEWSLETTER-POSTGRESQL-AS-IS.md` — newsletter.
- `02-BAZA-DANYCH/10-POROWNANIE-POSTGRESQL-REPO-PRODUKCJA.md` — rzeczywiste porównanie z Renderem.
- `02-BAZA-DANYCH/11-MODEL-MATCH-I-ROZBIEZNOSCI.md` — końcowy Model Match i rejestr rozbieżności.
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md` — docelowy model V3, iteracja 1: założenia, bounded contexts, mapa 28 tabel -> KEEP/MIGRATE/DEPRECATE/MERGE oraz wymagania migracyjne.
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md` — konkretne definicje Game Platform V3, match-actor lease/fencing, Transactional Outbox, idempotency i kontrakt migracji Warcaby/Tysiąc/Gomoku.

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment ma być zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe i architektura docelowa pozostają rozdzielone.
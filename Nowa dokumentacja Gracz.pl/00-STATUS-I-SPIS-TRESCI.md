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

**STATUS: ROZPOCZĘTY 28.08.2026.**

Ukończony pierwszy dokument projektowy:
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`.

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

### Następny krok ETAPU 2

**Model danych docelowy PostgreSQL V3.**

Ma on przełożyć architekturę Backend V3 na konkretne tabele, klucze, constrainty, outbox, idempotency, model meczów, projekcje i plan przejścia z obecnych 28 tabel.

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

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment ma być zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe i architektura docelowa pozostają rozdzielone.
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

Wykonano inwentaryzację kodową 26/26 tabel, AS-IS wszystkich obszarów, rzeczywisty `pg_dump --schema-only` Rendera, porównanie repozytorium ze środowiskiem oraz końcowy Model Match i rejestr rozbieżności. Rzeczywisty Render zawiera 28 tabel.

### ETAP 2 — architektura docelowa i plan migracji

**STATUS: W TRAKCIE od 28.08.2026.**

Ukończone dokumenty projektowe:
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md`,
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md` — iteracja 1: bounded contexts i mapa 28 tabel Render -> V3,
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md` — iteracja 2: Game Platform, match actor, lease/fencing, outbox i idempotency,
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md` — iteracja 3: Tournament V3.

### PostgreSQL V3 — Iteracja 3: Tournament — ZAKOŃCZONA

Zdefiniowano projektowo:
- `tournaments`,
- `tournament_registrations`,
- `tournament_rounds`,
- `tournament_matches`,
- jawne `version`/CAS dla agregatu turnieju i rund,
- PK/FK/UNIQUE/CHECK oraz indeksy,
- `UNIQUE(tournament_id, round_no)`,
- `UNIQUE(round_id, board_no)`,
- złożony FK zabezpieczający zgodność `round_id` z `tournament_id`,
- kanoniczne powiązanie `tournament_matches.match_id -> game_matches.match_id`,
- atomowe kontrakty `join`, `start`, `report_result`, `advance_round`,
- integrację z `outbox_events` i `idempotency_keys`,
- zasady standings/projection,
- plan transformacji `gracz_tournaments`, `gracz_tournament_players`, `gracz_tournament_matches`.

Wynik Game Platform jest źródłem prawdy dla zakończenia partii. Tournament jest meta-warstwą i nie zapisuje bezpośrednio stanu gry. Historyczne powiązania z meczami nie mogą być wymyślane podczas migracji — jeśli nie da się ich wiarygodnie odtworzyć, pozostają jawnie niepowiązane z provenance migracyjnym.

### Następny krok ETAPU 2

**PostgreSQL V3 — Iteracja 4: Identity & Access + Role/Audit.**

Zakres:
1. `users`, `user_profiles`, `auth_sessions`, tokeny i MFA,
2. `roles`, `user_roles`,
3. merge `gracz_role_changes` + `gracz_role_history` -> `role_change_events`,
4. kanoniczny append-only `audit_log`,
5. warunki migracji/archiwizacji `gracz_audit_log_legacy_1787562123031`,
6. constrainty, indeksy, retencja, bezpieczeństwo i outbox/audyt zmian uprawnień.

Po Identity + Role/Audit kolejność:
- Newsletter V3,
- Messaging / Global Chat / Moderation,
- końcowa macierz migracji kolumna-po-kolumnie z 28 tabel AS-IS do struktur V3.

## Spis dokumentacji

### Architektura
- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md` — punkt wyjścia architektury.
- `01-ARCHITEKTURA/02-ARCHITEKTURA-DOCELOWA-BACKEND-V3.md` — architektura docelowa Backend V3.

### PostgreSQL
- `02-BAZA-DANYCH/00-MAPA-POSTGRESQL-STATUS.md` — końcowy status ETAPU 1B.
- `02-BAZA-DANYCH/01-TOZSAMOSC-I-AUDYT.md` — AS-IS tożsamość i audyt.
- `02-BAZA-DANYCH/02-GRY-WARCABY-POSTGRESQL-AS-IS.md` — Warcaby.
- `02-BAZA-DANYCH/03-GRY-TYSIAC-POSTGRESQL-AS-IS.md` — Tysiąc.
- `02-BAZA-DANYCH/04-GRY-GOMOKU-AS-IS.md` — Gomoku.
- `02-BAZA-DANYCH/05-WIADOMOSCI-PRYWATNE-POSTGRESQL-AS-IS.md` — wiadomości.
- `02-BAZA-DANYCH/06-MODERACJA-POSTGRESQL-AS-IS.md` — moderacja.
- `02-BAZA-DANYCH/07-GLOBAL-CHAT-POSTGRESQL-AS-IS.md` — Global Chat.
- `02-BAZA-DANYCH/08-TURNIEJE-POSTGRESQL-AS-IS.md` — turnieje AS-IS.
- `02-BAZA-DANYCH/09-NEWSLETTER-POSTGRESQL-AS-IS.md` — newsletter.
- `02-BAZA-DANYCH/10-POROWNANIE-POSTGRESQL-REPO-PRODUKCJA.md` — porównanie z Renderem.
- `02-BAZA-DANYCH/11-MODEL-MATCH-I-ROZBIEZNOSCI.md` — Model Match.
- `02-BAZA-DANYCH/12-MODEL-DANYCH-DOCELOWY-POSTGRESQL-V3.md` — V3 iteracja 1.
- `02-BAZA-DANYCH/13-POSTGRESQL-V3-ITERACJA-2-GAME-PLATFORM-OUTBOX-IDEMPOTENCY.md` — V3 iteracja 2.
- `02-BAZA-DANYCH/14-POSTGRESQL-V3-ITERACJA-3-TOURNAMENT.md` — V3 iteracja 3: Tournament.

## Reguła dalszej pracy

Każdy ukończony i zweryfikowany fragment jest zapisywany w `Nowa dokumentacja Gracz.pl/` i odnotowywany w tym statusie. AS-IS, dowody środowiskowe i architektura docelowa pozostają rozdzielone.
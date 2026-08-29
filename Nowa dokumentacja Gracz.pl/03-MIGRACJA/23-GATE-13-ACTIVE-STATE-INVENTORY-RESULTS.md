# ETAP 3 — Bramka 13: Active-State Inventory — final status

Data: 29.08.2026  
Środowisko: `gracz_pl_database` / PostgreSQL 18.4  
Status: **GATE 13 = PASS — PRE-CUTOVER READINESS**

> Uwaga: pierwotny fresh inventory wykazał persisted nonterminal rows i miał status REVIEW. Elementy te zostały następnie rozstrzygnięte w Gate 13A. Pełny decision record i fresh drilldown evidence znajduje się w `25-GATE-13A-STALE-NONTERMINAL-STATE-RESULTS.md`.

## 1. Zakres i metoda

Gate 13 ustala rzeczywisty aktywny stan domenowy przed migracją V3: gry, turnieje, auth sessions, reset/registration/MFA, newsletter, moderation/social, operational PostgreSQL oraz process-local runtime.

Pierwotna propozycja oparta o hipotetyczne tabele `system_workers`, `system_cron`, `outbox_events`, `system_ws_connections`, `storage_pending` i podobne nie została wykonana. Collector został oparty wyłącznie na potwierdzonym schemacie AS-IS i aktualnym kodzie.

Collector źródłowy:
`22-GATE-13-ACTIVE-STATE-INVENTORY.sql`

Canonical first capture:
- `2026-08-29T00:11:17.199Z`,
- database: `gracz_pl_database`,
- PostgreSQL 18.4,
- run `33222770175`,
- job `99020147640`,
- `PASS-COLLECTOR`,
- `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`,
- bez wypisywania danych wrażliwych.

## 2. Fresh active-state inventory — wyniki bazowe

### Auth / Identity
- persisted auth sessions: 3,
- aktywne wg runtime rule: **0**,
- aktywne reset tokens: **0**,
- aktywne registration codes: **0**,
- MFA enabled/setup pending: **0**.

### Turnieje
- tournaments total: **0**,
- live/registration: **0**,
- open matches: **0**.

### Newsletter
- subscribed: 3,
- pending_confirmation: 2,
- aktywne niewygasłe confirmation workflow: **0**.

### Moderation
- open moderation appeals: **0**,
- unresolved global-chat reports: **0**.

### PostgreSQL operational snapshot
- other client connections: **0**,
- other active connections: **0**,
- idle-in-transaction: **0**,
- transactions >30s: **0**,
- waiting locks: **0**.

## 3. Persisted nonterminal rows — rozstrzygnięcie Gate 13A

Pierwotny inventory wykazał:
- 2 Checkers `active`,
- 29 Thousand `bidding`,
- 2 friendship `pending`.

Gate 13A wykonał dodatkowe fresh READ ONLY drilldowny i sklasyfikował te rekordy.

### Checkers 2/2

Potwierdzono:
- oba mają wyłącznie canonical participants,
- 0 ruchów,
- 0 wiadomości chatu sesji,
- brak pending offer,
- tylko początkowy event utworzenia,
- brak świeżej aktywności.

Klasyfikacja:
**`LEGACY-GAME-STATE / STALE-PRISTINE-SHELL`**.

Nie są traktowane jako realnie aktywne rozgrywki przy cutover. Snapshot/provenance ma zostać zachowany; brak autoryzacji DELETE.

### Thousand 29/29

Potwierdzono:
- wszystkie 29 są niekońcowe, ale starsze niż 24 h,
- wszystkie mają co najmniej jednego participant ID spoza aktualnego `gracz_accounts`,
- 0/29 ma kompletny canonical participant set,
- 26 ma revision 1, tylko 3 revision >1, revision max 2,
- 18/29 dokładnie pasuje do historycznego guest/demo signature z kodu,
- pozostałych 11 nie mapujemy heurystycznie do żadnego konta.

Klasyfikacja całego zbioru:
**`LEGACY-GAME-STATE / NONCANONICAL-PARTICIPANTS / QUARANTINE`**.

Nie wolno backfillować ich jako aktywne canonical matches V3. Zachować source snapshot/provenance; brak autoryzacji DELETE.

### Social pending 2/2

Potwierdzono:
- 0 canonical↔canonical,
- 1 mixed quarantine↔canonical,
- 1 z ephemeral/unknown principal; wcześniejszy DQ-001 potwierdził `EPHEMERAL-GUEST` i decyzję `LEGACY-QUARANTINE`.

Klasyfikacja:
**`LEGACY-SOCIAL-PENDING / QUARANTINE`**.

Nie włączać do aktywnego canonical Social graph V3; zachować provenance; brak autoryzacji DELETE.

## 4. Process-local runtime — zamknięcie przez cutover contract

Kod potwierdza process-local state bez trwałej reprezentacji w PostgreSQL:
- Lobby rooms/presence/invitations,
- Gomoku in-memory games,
- Global Chat presence/SSE,
- Thousand SSE subscribers.

Tego stanu nie wolno retrospektywnie uznawać za `0` po restarcie diagnostycznym.

Zamiast zgadywania zatwierdzona zostaje techniczna precondition dla finalnego cutover:

1. zamknąć wejście do nowych mutacji / maintenance,
2. zatrzymać normalny application writer,
3. nie uruchamiać równoległego writera,
4. po zatrzymaniu wykonać fresh READ ONLY Gate 13 recheck,
5. recheck musi potwierdzić brak nowej aktywnej canonical rozgrywki i brak konkurencyjnych transakcji/locków,
6. jeśli wykryta zostanie realna aktywność — **ABORT / NO-GO**.

Po zatrzymaniu procesu process-local state jest zerowany konstrukcyjnie; Gate 15 musi potwierdzić single-writer/maintenance state przed cutover.

## 5. Decyzja Gate 13

**GATE 13 = PASS — PRE-CUTOVER READINESS.**

Uzasadnienie:
- brak aktywnych auth/reset/registration/MFA workflows,
- brak aktywnych turniejów,
- brak aktywnego newsletter confirmation workflow,
- brak open moderation workflow,
- brak konkurencyjnych DB clients/transactions/locks w fresh capture,
- wszystkie persisted nonterminal leftovers zostały sklasyfikowane i otrzymały niedestrukcyjną politykę migracyjną,
- process-local state ma jawny maintenance/drain contract.

### Warunek obowiązkowy

Ten PASS **nie zastępuje finalnego cutover check**.

Bezpośrednio przed produkcyjnym writer cutover należy wykonać fresh Gate 13 recheck już po zatrzymaniu normalnego writera. Niespełnienie warunku oznacza Gate 15 = NO-GO.

## 6. Cleanup diagnostyki

Gate 13A cleanup commit na gałęzi `feature/homepage-game-center`:

`e39175911a69d59b4ee6ab8238bbe758a46df2c1`

Repo po cleanup:
- normalny start: `node --require ./src/pg-secure-preload.cjs src/main.js`,
- wszystkie tymczasowe proxy Gate 13A usunięte,
- brak trwałego workflow Gate 13A.

Stan konkretnego Render-live cleanup deployu jest osobnym dowodem operacyjnym i może zostać potwierdzony w Gate 15, jeżeli jest wymagany do finalnego GO.

## 7. Następny krok

Po Gate 13 / Gate 13A:

**następna bramka = Gate 14 — Security / Credentials / Permissions readiness.**

Gate 15 final GO/NO-GO nadal pozostaje otwarty.  
Produkcja V3: **NO-GO** do finalnego spełnienia wszystkich warunków cutover.

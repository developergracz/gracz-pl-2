# ETAP 3 — Gate 13A: stale / nonterminal state resolution — RESULTS

Data: 29.08.2026  
Środowisko: `gracz_pl_database` / PostgreSQL 18.4  
Status: **PASS — STALE/NONCANONICAL STATE SKLASYFIKOWANY; BRAK DML**

## 1. Cel

Gate 13A rozstrzyga elementy pozostawione przez `23-GATE-13-ACTIVE-STATE-INVENTORY-RESULTS.md`:

- 2 persisted Checkers sessions z `game.status=active`,
- 29 persisted Thousand games ze statusem niekońcowym,
- 2 friendship rows ze statusem `pending`,
- zasady cutover dla process-local state.

Cała praca Gate 13A była **READ ONLY**. Nie wykonano żadnego produkcyjnego `INSERT/UPDATE/DELETE`, nie usunięto żadnej gry, relacji ani konta.

## 2. Źródła dowodu

Collectors:

- `24-GATE-13A-STALE-NONTERMINAL-STATE-DRILLDOWN.sql`,
- `24a-GATE-13A-DEMO-SIGNATURE-PRISTINE-SHELL-DRILLDOWN.sql`.

Fresh runtime capture nr 1:

- capture: `2026-08-29T00:28:54.291Z`,
- GitHub Actions run: `33222770175`,
- job: `99022745150`,
- artifact: `9706073923`,
- collector: `PASS-COLLECTOR`,
- `transaction_read_only=on`,
- normal application not started by collector.

Fresh focused capture:

- capture: `2026-08-29T00:32:29.554Z`,
- run: `33222770175`,
- job: `99023348160`,
- artifact: `9706135408`,
- collector: `PASS-COLLECTOR`,
- `transaction_read_only=on`,
- normal application not started by collector.

## 3. Checkers — wynik 2/2

Fresh classification:

- `active_total = 2`,
- `active_all_canonical = 2`,
- `active_all_quarantine = 0`,
- `active_unknown_involvement = 0`,
- `active_zero_moves = 2`,
- `active_with_moves = 0`,
- oba snapshoty były starsze niż 1 godzinę.

Focused pristine-shell check:

- `active_pristine_shell = 2`,
- `active_nonpristine = 0`.

`pristine shell` oznacza tutaj jednocześnie:

- tylko początkowy event utworzenia sesji,
- 0 zaakceptowanych ruchów,
- 0 wiadomości chatu sesji,
- brak pending draw/undo offer,
- brak świeżej aktualizacji.

### Decyzja migracyjna

Oba rekordy otrzymują klasyfikację:

**`LEGACY-GAME-STATE / STALE-PRISTINE-SHELL`**.

Reguła V3:

- nie traktować ich jako dowodu aktywnej rozgrywki przy cutover,
- nie przenosić ich automatycznie do aktywnego runtime V3,
- zachować snapshot/provenance w warstwie legacy/archive/quarantine zgodnie z finalnym planem backfill,
- nie usuwać fizycznie bez osobnej autoryzacji DML.

Uzasadnienie: oba mają canonical participants, ale nie zawierają żadnego gameplay ani innej aktywności po samym utworzeniu.

## 4. Tysiąc — wynik 29/29

Fresh classification:

- `nonterminal_total = 29`,
- `nonterminal_unknown_involvement = 29`,
- `nonterminal_all_canonical = 0`,
- `nonterminal_all_quarantine = 0`,
- `nonterminal_mixed_quarantine_canonical = 0`,
- `revision_eq_1 = 26`,
- `revision_gt_1 = 3`,
- `revision_min = 1`,
- `revision_max = 2`,
- wszystkie 29 są starsze niż 24 godziny,
- Gate 13 potwierdził dla 29/29 status `bidding`.

Oznacza to, że każda z 29 gier ma co najmniej jednego participant ID, którego nie ma w aktualnym `gracz_accounts`. Żadna nie jest kompletnym canonical match-setem.

### 4.1. Potwierdzony historyczny guest/demo flow

Historia Git potwierdza, że commit `2b8821088dd7025bd4c97680d1b84650288eae90` wprowadził demo Tysiąca tworzące dokładnie trzech technicznych participantów:

- `guest-<8hex>`,
- `demo-a-<8hex>`,
- `demo-b-<8hex>`,

z tym samym suffixem i bez wymagania kont dla dwóch participantów demo.

Focused collector wykazał:

- `exact_guest_demo_signature = 18`,
- `exact_signature_bidding = 18`,
- `exact_signature_updated_ge_24h = 18`,
- z czego 16 ma revision 1, a 2 mają revision >1.

Te 18 rekordów jest jednoznacznie sklasyfikowane jako:

**`LEGACY-GAME-STATE / GUEST-DEMO`**.

### 4.2. Pozostałe 11 rekordów

- `not_exact_guest_demo_signature = 11`.

Nie ma wystarczającego dowodu, aby nazywać wszystkie 11 konkretnym historycznym demo/fixture.

Nie jest to jednak potrzebne do bezpiecznej decyzji migracyjnej: wcześniejszy collector potwierdził, że wszystkie 11 należy do zbioru 29 z `unknown_involvement`, a więc nie ma dla nich kompletnego canonical participant setu.

API Tysiąca historycznie pozwalało zapisać grę z participantami przekazanymi przez request i nie wymagało lookupu każdego participanta do `gracz_accounts`; wymagane było jedynie, aby authenticated creator znajdował się na liście graczy. To tłumaczy techniczną możliwość trwałego zapisu niekanonicznych identyfikatorów.

### Decyzja migracyjna dla wszystkich 29

Cały zbiór otrzymuje klasyfikację:

**`LEGACY-GAME-STATE / NONCANONICAL-PARTICIPANTS / QUARANTINE`**.

Reguła V3:

1. nie backfillować żadnego z 29 jako aktywnego canonical match,
2. zachować source snapshot i provenance,
3. 18 exact guest/demo oznaczyć dodatkowo jako `GUEST-DEMO`,
4. pozostałych 11 nie mapować do kont na podstawie podobieństwa nazw lub heurystyk,
5. nie usuwać fizycznie bez osobnej autoryzacji DML.

To jest decyzja niedestrukcyjna i odwracalna.

## 5. Friendship pending — wynik 2/2

Fresh classification:

- `pending_total = 2`,
- `pending_canonical_canonical = 0`,
- `pending_mixed_quarantine_canonical = 1`,
- `pending_unknown_involvement = 1`,
- oba rekordy starsze niż 24 godziny.

Wcześniejszy DQ-001 root-cause analysis potwierdził, że orphan requester jest technicznym `EPHEMERAL-GUEST` i ma zatwierdzoną decyzję `LEGACY-QUARANTINE` bez `MAP-TO-CANONICAL`.

Drugi pending relation zawiera endpoint należący do zatwierdzonego Gate 12 identity quarantine set.

### Decyzja migracyjna

Oba pending friendship rows:

**`LEGACY-SOCIAL-PENDING / QUARANTINE`**.

- zachować provenance,
- nie włączać do aktywnego canonical Social graph V3,
- nie mapować guest/test identity do canonical account,
- nie wykonywać fizycznego DELETE bez osobnej autoryzacji DML.

## 6. Process-local state — maintenance/drain contract

Process-local state istnieje m.in. w:

- Lobby rooms/presence/invitations,
- Gomoku in-memory games,
- Global Chat presence/SSE,
- Thousand SSE subscribers.

Nie może być wiarygodnie rekonstruowany z PostgreSQL po restarcie procesu.

Dlatego finalny cutover musi spełnić następujący kontrakt operacyjny:

1. **zamknąć wejście do nowych mutacji** — maintenance mode / wyłączenie publicznego writera,
2. **zatrzymać normalny proces aplikacji** przed writer cutover,
3. nie uruchamiać drugiego normalnego writera równolegle,
4. po zatrzymaniu aplikacji wykonać fresh READ ONLY Gate 13 final recheck,
5. finalny recheck musi potwierdzić co najmniej:
   - 0 aktywnych auth sessions według runtime rule,
   - 0 aktywnych reset/registration workflow,
   - 0 nowych canonical gameplay records wymagających drain,
   - 0 konkurencyjnych DB transactions / waiting locks,
   - normal application writer = stopped,
6. jeśli finalny recheck wykryje nową realną aktywną canonical rozgrywkę lub writer activity — **ABORT / NO-GO**, nie wykonywać cutover.

Process-local state po poprawnym zatrzymaniu procesu jest zerowany konstrukcyjnie; finalny Gate 15 ma zweryfikować, że writer rzeczywiście jest zatrzymany i nie istnieje równoległy writer.

## 7. Gate 13A — decyzja

**GATE 13A = PASS.**

Rozstrzygnięto wszystkie persisted-state elementy z Gate 13:

- 2 Checkers = stale pristine shells → legacy quarantine/provenance,
- 29 Thousand = noncanonical participant set → legacy quarantine/provenance,
  - 18/29 dodatkowo exact guest/demo,
  - 11/29 bez heurystycznego mapowania,
- 2 friendship pending = legacy quarantine/provenance,
- process-local state ma jawny maintenance/drain contract.

Nie wykonano DML/DDL.

## 8. Wpływ na Gate 13

Po Gate 13A pierwotne persisted-state blockery zostały zamknięte decyzją migracyjną.

Gate 13 może otrzymać:

**`PASS — PRE-CUTOVER READINESS`**

z obowiązkowym warunkiem:

**fresh final active-state recheck po zatrzymaniu normalnego writera bezpośrednio przed cutover.**

To nie jest GO dla migracji. Gate 15 nadal nie może wydać GO bez finalnego rechecku i potwierdzenia single-writer/maintenance state.

## 9. Cleanup diagnostyki Gate 13A

Po collectach przygotowano cleanup poza wdrażaną gałęzią i następnie przełączono `feature/homepage-game-center` jednym fast-forward na czysty commit:

`e39175911a69d59b4ee6ab8238bbe758a46df2c1`

Stan repo po cleanup:

- `package.json` ponownie używa:
  `node --require ./src/pg-secure-preload.cjs src/main.js`,
- `gate13a-runtime-proxy.mjs` — usunięty,
- `gate13a-legacy-poller-proxy.mjs` — usunięty,
- `gate13a-focused-legacy-proxy.mjs` — usunięty,
- nie utworzono trwałego workflow Gate 13A.

CI cleanup commitu uruchomiło się po push; stan konkretnego Render-live cleanup deployu należy potwierdzać oddzielnie, jeśli będzie wymagany jako Gate 15 evidence.

## 10. Następny krok

Po zamknięciu Gate 13 / 13A następną bramką ETAPU 3 jest:

**Gate 14 — Security / Credentials / Permissions readiness.**

Produkcja V3 pozostaje **NO-GO** do finalnej Gate 15 decyzji.

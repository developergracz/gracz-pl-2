# ETAP 3 — Bramka 13: Active-State Inventory — fresh results

Data: 29.08.2026  
Środowisko: `gracz_pl_database` / PostgreSQL 18.4  
Status: **GATE 13 = REVIEW / NOT VERIFIED — NIE PASS**

## 1. Cel i zasada dowodowa

Bramka 13 ma ustalić rzeczywisty aktywny stan domenowy przed migracją V3: gry, turnieje, sesje, krótkotrwałe workflow tożsamości, newsletter, moderację/social oraz stan runtime, którego nie wolno pomylić z trwałym stanem PostgreSQL.

Pierwotna propozycja oparta o nazwy typu `system_workers`, `system_cron`, `outbox_events`, `system_ws_connections`, `storage_pending` lub `storage_dirty_pages` NIE została wykonana, ponieważ nie były to potwierdzone tabele AS-IS. Collector Gate 13 został zbudowany wyłącznie na rzeczywistym schemacie i aktualnym kodzie Gracz.pl.

Collector źródłowy:

`22-GATE-13-ACTIVE-STATE-INVENTORY.sql`

## 2. Sposób wykonania

Fresh persisted-state evidence pobrano z runtime Render przez tymczasowy diagnostyczny proces, który:
- nie uruchamiał normalnego `src/main.js`,
- nie uruchamiał inicjalizatorów aplikacji,
- otworzył `BEGIN TRANSACTION READ ONLY`,
- potwierdził `transaction_read_only=on`,
- wykonał wyłącznie agregaty `SELECT`,
- zakończył transakcję `ROLLBACK`,
- nie wypisywał user_id, e-maili, tokenów, hashy, saltów, kodów, sekretów MFA ani treści wiadomości.

Capture DB: `2026-08-29T00:11:17.199Z`  
Database: `gracz_pl_database`  
User: `gracz_pl_database_user`  
PostgreSQL: `18.4`  
Collector: **PASS-COLLECTOR**  
Transakcja: **READ ONLY**

GitHub Actions evidence:
- run: `33222770175`,
- job: `99020147640`,
- conclusion: `success`,
- artifact: `gate13-runtime-evidence`, artifact id `9705768051`.

`PASS-COLLECTOR` oznacza poprawne zebranie dowodu, nie oznacza automatycznie `Gate 13 = PASS`.

## 3. A — Warcaby / persisted game sessions

Fresh wynik:
- sessions total: **2**,
- invalid JSON: **0**,
- game status `active`: **2**,
- terminal `won/draw`: **0**,
- unknown status: **0**,
- `active` z co najmniej jednym zapisanym `players.*.connected=true`: **2**,
- updated w ostatnich 10 minutach: **0**.

Interpretacja:
- w bazie istnieją **2 niezamknięte snapshoty Warcabów**,
- oba mają zapisany stan `active`,
- oba mają zapisany connection flag,
- ale żaden nie został zapisany w ostatnich 10 minutach.

`connected=true` jest częścią serializowanego snapshotu sesji i jest zmieniane przez `disconnectPlayer/reconnectPlayer`; nie jest samodzielnym dowodem aktualnego socket/SSE connection. Dlatego nie wolno opisać tych dwóch rekordów jako „2 graczy obecnie online”.

Stan Gate 13 dla Warcabów: **REVIEW** — wymaga jawnej decyzji `DRAIN / MIGRATE / ARCHIVE-OR-QUARANTINE` dla tych niezamkniętych rekordów przed cutover.

## 4. B — Tysiąc

Fresh wynik:
- games total: **29**,
- `in_progress`: **29**,
- status `bidding`: **29**,
- awaiting next round/redeal: **0**,
- `game-ended`: **0**,
- unknown status: **0**,
- updated w ostatnich 10 minutach: **0**.

Aktualny engine tworzy nową grę Tysiąc początkowo ze statusem `bidding`. Wszystkie 29 rekordów pozostaje w tym stanie i żaden nie był aktualizowany w ostatnich 10 minutach.

Nie jest to dowód, że 29 rozgrywek jest teraz używanych. Jest to natomiast dowód, że trwały source set zawiera 29 semantycznie niezamkniętych stanów, których nie wolno automatycznie pominąć.

Stan Gate 13 dla Tysiąca: **REVIEW** — wymagane jawne mapowanie tych rekordów do `MIGRATE / ARCHIVE / QUARANTINE / SKIP-WITH-APPROVAL` albo fresh drain evidence przed cutover.

## 5. C — Turnieje

Fresh wynik:
- tournaments total: **0**,
- registration: **0**,
- live: **0**,
- finished: **0**,
- unknown status: **0**,
- open tournament matches: **0**.

**PASS dla aktywnego stanu turniejowego na moment capture.**

## 6. D — Auth sessions

Fresh wynik:
- persisted sessions total: **3**,
- unrevoked + unexpired: **0**,
- active wg rzeczywistej reguły runtime (`not revoked`, `expires_at>now`, `last_seen_at<30 min`): **0**,
- idle/expired and not revoked: **3**.

**PASS dla drain/re-login na moment capture.** Brak aktywnych sesji użytkowników.

## 7. E — Reset / registration / MFA

Fresh wynik:
- reset tokens total: **1**,
- reset tokens active: **0**,
- registration codes total: **2**,
- registration codes active: **0**,
- MFA rows total: **0**,
- MFA enabled: **0**,
- MFA setup pending: **0**.

**PASS dla aktywnego workflow Identity na moment capture.**

## 8. F — Newsletter

Fresh wynik:
- subscribers total: **5**,
- subscribed: **3**,
- pending_confirmation total: **2**,
- pending_confirmation unexpired: **0**,
- pending confirmation delivery gap: **0**,
- pending_confirmation expired: **2**,
- unknown status: **0**.

Interpretacja:
- 3 aktywnych subskrybentów nie jest „pending write” i samo w sobie nie blokuje migracji,
- oba rekordy `pending_confirmation` są wygasłe,
- nie ma aktywnego, niewygasłego confirmation workflow.

**PASS dla krótkotrwałego newsletter active-state na moment capture**, z zachowaniem 2 wygasłych rekordów zgodnie z provenance/retention mapping.

## 9. G — Moderation / Social

Fresh wynik:
- moderation decisions total: **6**,
- open moderation appeals: **0**,
- unknown appeal statuses: **0**,
- global chat reports without resolution-state: **0**,
- friendship rows with status `pending`: **2**.

Interpretacja:
- brak aktywnych appeal/report workflow,
- 2 oczekujące zaproszenia/relacje znajomości są trwałym aktywnym workflow Social.

Stan Social: **REVIEW** — pending friendship musi mieć jawne zachowanie podczas migracji (najbezpieczniej zachować status `pending` 1:1, jeśli docelowy model V3 to wspiera; w przeciwnym razie osobna decyzja transformacyjna przed DML).

## 10. H — PostgreSQL operational snapshot

Fresh wynik, poza samym collectorem:
- other client connections: **0**,
- other active connections: **0**,
- other idle-in-transaction: **0**,
- other transactions >30s: **0**,
- waiting locks: **0**.

**PASS jako punktowy operational snapshot.**

Ten wynik NIE dowodzi, że writer nie może uruchomić się później; jest tylko świeżym dowodem, że w chwili capture baza nie miała konkurencyjnej aktywności klienta ani oczekujących locków.

## 11. Process-local runtime — krytyczna granica dowodu

Analiza aktualnego kodu potwierdza process-local state, którego nie ma w PostgreSQL:
- Lobby: rooms, presence i invitations są strukturami in-memory,
- Gomoku: aktywne gry/draw offers są in-memory,
- Global Chat: presence i SSE subscribers są in-memory,
- Tysiąc realtime: SSE subscriber registry jest in-memory.

Diagnostyczny deploy zastąpił poprzedni proces. Z tego powodu collector uczciwie raportował:

`processLocalPreDeployStateObservable = false`

Nie wolno więc wstecznie stwierdzić, że przed deployem było `0` pokoi, `0` graczy Gomoku, `0` presence lub `0` SSE connections.

To jest **NOT VERIFIED**, nie PASS.

Bezpieczna strategia migracyjna dla process-local state musi być oparta o kontrolowane maintenance/drain: zatrzymać przyjmowanie nowych mutacji, pozwolić na zakończenie albo jawnie przerwać process-local sessions zgodnie z zatwierdzoną polityką, następnie uruchomić fresh final active-state check tuż przed writer cutover.

## 12. Decyzja Gate 13

**GATE 13 = REVIEW / NOT VERIFIED — NIE PASS.**

Powody:
1. **2** persisted Checkers sessions nadal mają `game.status=active`;
2. **29** persisted Thousand games nadal ma niekońcowy status `bidding`;
3. **2** friendship workflows ma status `pending`;
4. process-local pre-deploy state nie był i po restarcie nie może być retrospektywnie zmierzony.

Jednocześnie fresh capture potwierdza brak:
- aktywnych auth sessions,
- aktywnych reset tokens,
- aktywnych registration codes,
- MFA setup,
- aktywnych turniejów,
- open moderation appeals,
- global-chat reports,
- aktywnego newsletter confirmation workflow,
- konkurencyjnych DB client transactions/locks w chwili capture.

## 13. Następny bezpieczny krok

Przed zmianą Gate 13 na PASS należy wykonać **Gate 13A — stale/nonterminal state resolution**:

1. sklasyfikować 2 Checkers `active` jako realnie wznawialne albo legacy/test/stale;
2. sklasyfikować 29 Thousand `bidding` analogicznie i ustalić ich backfill/archival policy;
3. potwierdzić mapping 2 pending friendship workflows;
4. zapisać maintenance/drain contract dla process-local Lobby/Gomoku/SSE;
5. przed cutover wykonać fresh READ ONLY recheck active-state.

Do czasu spełnienia tych punktów:
- **Gate 13 = REVIEW / NOT VERIFIED**,
- Gate 14 może być przygotowywany dokumentacyjnie, ale Gate 13 nie jest zamknięty,
- Gate 15 final GO/NO-GO nie może dać GO,
- produkcyjny DDL/DML V3 = **NO-GO**.

## 14. Cleanup diagnostyki

Po capture:
- `package.json` przywrócono do normalnego startu `node --require ./src/pg-secure-preload.cjs src/main.js`,
- tymczasowy `gate13-runtime-proxy.mjs` usunięto,
- tymczasowy `gate13-runtime-evidence.yml` usunięto.

Stan repozytorium jest oczyszczony z diagnostyki Gate 13. Finalny live deploy normalnego startu należy traktować osobno od samego stanu repo, jeśli nie ma bezpośredniego dowodu Render-live konkretnego cleanup commitu.

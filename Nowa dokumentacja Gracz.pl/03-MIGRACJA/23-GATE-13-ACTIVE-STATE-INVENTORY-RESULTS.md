# ETAP 3 — Bramka 13: Active-State Inventory — fresh results

Data: 29.08.2026  
Środowisko: `gracz_pl_database` / PostgreSQL 18.4  
Status: **GATE 13 = REVIEW / NOT VERIFIED — NIE PASS**

## 1. Cel i zasada dowodowa

Bramka 13 ustala rzeczywisty aktywny stan domenowy przed migracją V3: gry, turnieje, sesje, krótkotrwałe workflow tożsamości, newsletter, moderację/social oraz process-local runtime.

Pierwotna propozycja oparta o nazwy `system_workers`, `system_cron`, `outbox_events`, `system_ws_connections`, `storage_pending` lub `storage_dirty_pages` NIE została wykonana, ponieważ nie były to potwierdzone tabele AS-IS. Collector został zbudowany wyłącznie na rzeczywistym schemacie i aktualnym kodzie Gracz.pl.

Collector źródłowy:
`22-GATE-13-ACTIVE-STATE-INVENTORY.sql`

## 2. Sposób wykonania

Fresh persisted-state evidence pobrano z runtime Render przez tymczasowy proces diagnostyczny, który:
- nie uruchamiał normalnego `src/main.js`,
- nie uruchamiał inicjalizatorów aplikacji,
- otworzył `BEGIN TRANSACTION READ ONLY`,
- potwierdził `transaction_read_only=on`,
- wykonywał tylko agregaty `SELECT`,
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

`PASS-COLLECTOR` oznacza poprawne zebranie dowodu, nie automatyczny PASS całej Bramki 13.

## 3. Warcaby / persisted game sessions

Fresh wynik:
- sessions total: **2**,
- invalid JSON: **0**,
- game status `active`: **2**,
- terminal `won/draw`: **0**,
- unknown status: **0**,
- `active` z co najmniej jednym zapisanym `players.*.connected=true`: **2**,
- updated w ostatnich 10 minutach: **0**.

W bazie istnieją dwa niezamknięte snapshoty Warcabów. `connected=true` jest częścią serializowanego snapshotu i jest zmieniane przez `disconnectPlayer/reconnectPlayer`; nie jest samodzielnym dowodem aktualnego połączenia sieciowego. Brak zapisu w ostatnich 10 minutach oznacza, że collector nie wykazał świeżej aktywności tych sesji.

**Warcaby = REVIEW.** Przed cutover wymagana jest jawna decyzja `DRAIN / MIGRATE / ARCHIVE-OR-QUARANTINE` dla obu niezamkniętych rekordów.

## 4. Tysiąc

Fresh wynik:
- games total: **29**,
- `in_progress`: **29**,
- status `bidding`: **29**,
- awaiting next round/redeal: **0**,
- `game-ended`: **0**,
- unknown status: **0**,
- updated w ostatnich 10 minutach: **0**.

Aktualny engine tworzy nowy stan Tysiąca ze statusem `bidding`. Wszystkie 29 rekordów pozostaje w tym stanie i żaden nie był aktualizowany w ostatnich 10 minutach. Nie dowodzi to, że 29 rozgrywek jest obecnie używanych, ale dowodzi istnienia 29 semantycznie niezamkniętych rekordów source-setu.

**Tysiąc = REVIEW.** Wymagane jawne mapowanie do `MIGRATE / ARCHIVE / QUARANTINE / SKIP-WITH-APPROVAL` albo fresh drain evidence przed cutover.

## 5. Turnieje

Fresh wynik:
- tournaments total: **0**,
- registration: **0**,
- live: **0**,
- finished: **0**,
- unknown status: **0**,
- open tournament matches: **0**.

**PASS dla aktywnego stanu turniejowego na moment capture.**

## 6. Auth sessions

Fresh wynik:
- persisted sessions total: **3**,
- unrevoked + unexpired: **0**,
- active wg rzeczywistej reguły runtime: **0**,
- idle/expired and not revoked: **3**.

Rzeczywisty warunek aktywności użyty przez runtime i collector:

`revoked_at IS NULL AND expires_at > NOW() AND last_seen_at > NOW() - INTERVAL '30 minutes'`

**PASS dla drain/re-login na moment capture.** Brak aktywnych sesji użytkowników.

## 7. Reset / registration / MFA

Fresh wynik:
- reset tokens total: **1**,
- reset tokens active: **0**,
- registration codes total: **2**,
- registration codes active: **0**,
- MFA rows total: **0**,
- MFA enabled: **0**,
- MFA setup pending: **0**.

**PASS dla aktywnego workflow Identity na moment capture.**

## 8. Newsletter

Fresh wynik:
- subscribers total: **5**,
- subscribed: **3**,
- pending_confirmation total: **2**,
- pending_confirmation unexpired: **0**,
- pending confirmation delivery gap: **0**,
- pending_confirmation expired: **2**,
- unknown status: **0**.

Trzy rekordy `subscribed` nie są pending write. Oba `pending_confirmation` są wygasłe; nie ma aktywnego, niewygasłego confirmation workflow.

**PASS dla krótkotrwałego newsletter active-state na moment capture**, przy zachowaniu provenance 2 wygasłych rekordów.

## 9. Moderation / Social

Fresh wynik:
- moderation decisions total: **6**,
- open moderation appeals: **0**,
- unknown appeal statuses: **0**,
- global chat reports without resolution-state: **0**,
- friendship rows with status `pending`: **2**.

Brak aktywnych appeal/report workflow. Dwa oczekujące friendship workflows wymagają jawnego zachowania podczas migracji.

**Social = REVIEW.** Preferowane zachowanie `pending` 1:1, jeżeli docelowy model V3 to wspiera; w przeciwnym razie wymagana osobna decyzja transformacyjna przed DML.

## 10. PostgreSQL operational snapshot

Fresh wynik poza samym collectorem:
- other client connections: **0**,
- other active connections: **0**,
- other idle-in-transaction: **0**,
- other transactions >30s: **0**,
- waiting locks: **0**.

**PASS jako punktowy operational snapshot.** Nie jest to dowód, że writer nie może uruchomić się później.

## 11. Process-local runtime — granica dowodu

Analiza aktualnego kodu potwierdza process-local state bez reprezentacji w PostgreSQL:
- Lobby: rooms, presence i invitations — in-memory,
- Gomoku: aktywne gry/draw offers — in-memory,
- Global Chat: presence i SSE subscribers — in-memory,
- Tysiąc realtime: SSE subscriber registry — in-memory.

Diagnostyczny deploy zastąpił poprzedni proces, dlatego collector raportował:

`processLocalPreDeployStateObservable = false`

Nie wolno retrospektywnie stwierdzić, że przed deployem było `0` pokoi, `0` gier Gomoku, `0` presence lub `0` SSE connections. Ten obszar jest **NOT VERIFIED**, nie PASS.

Bezpieczny cutover wymaga maintenance/drain contract: zatrzymanie nowych mutacji, kontrolowane zakończenie albo jawne przerwanie process-local sessions według zatwierdzonej polityki oraz fresh final active-state check bezpośrednio przed writer cutover.

## 12. Decyzja Gate 13

**GATE 13 = REVIEW / NOT VERIFIED — NIE PASS.**

Otwarte elementy:
1. **2** persisted Checkers sessions nadal mają `game.status=active`;
2. **29** persisted Thousand games ma niekońcowy status `bidding`;
3. **2** friendship workflows ma status `pending`;
4. process-local pre-deploy state nie został i po restarcie nie może zostać retrospektywnie zmierzony.

Jednocześnie fresh capture potwierdził brak:
- aktywnych auth sessions,
- aktywnych reset tokens,
- aktywnych registration codes,
- MFA setup,
- aktywnych turniejów,
- open moderation appeals,
- global-chat reports,
- aktywnego newsletter confirmation workflow,
- konkurencyjnych DB client transactions/locks w chwili capture.

## 13. Następny bezpieczny krok — Gate 13A

Przed zmianą Gate 13 na PASS należy wykonać **Gate 13A — stale/nonterminal state resolution**:
1. sklasyfikować 2 Checkers `active` jako realnie wznawialne albo legacy/test/stale;
2. sklasyfikować 29 Thousand `bidding` analogicznie i ustalić backfill/archival policy;
3. potwierdzić mapping 2 pending friendship workflows;
4. zapisać maintenance/drain contract dla process-local Lobby/Gomoku/SSE;
5. przed cutover wykonać fresh READ ONLY recheck active-state.

Do tego czasu:
- **Gate 13 = REVIEW / NOT VERIFIED**,
- Gate 14 może być przygotowywany dokumentacyjnie, ale Gate 13 nie jest zamknięty,
- Gate 15 final GO/NO-GO nie może dać GO,
- produkcyjny DDL/DML V3 = **NO-GO**.

## 14. Cleanup diagnostyki

Po capture:
- `package.json` przywrócono do normalnego startu `node --require ./src/pg-secure-preload.cjs src/main.js`,
- tymczasowy `gate13-runtime-proxy.mjs` usunięto,
- tymczasowy `gate13-runtime-evidence.yml` usunięto.

Repozytorium jest oczyszczone z diagnostyki Gate 13. Finalny live deploy normalnego startu należy traktować osobno od stanu repo, jeżeli nie ma bezpośredniego dowodu Render-live konkretnego cleanup commitu.

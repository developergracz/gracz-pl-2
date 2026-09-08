# GRACZ.PL — FULL MAX MASTER DOCUMENTATION
## TOM 12 — ARCHITEKTURA KOMPONENT PO KOMPONENCIE

**Status:** LIVING DOCUMENTATION / BASELINE VERIFIED  
**Data utworzenia:** 08.09.2026  
**Repozytorium:** `developergracz/gracz-pl-2`  
**Zweryfikowany baseline kodu:** `main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**TREE baseline:** `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`  
**Gałąź dokumentacyjna:** `docs/master-history-gracz-pl-2026-09-08`  
**P8 / PR #43:** OPEN / AWAITING INDEPENDENT CLAUDE AUDIT / NIE JEST CZĘŚCIĄ ZWERYFIKOWANEGO MAIN W TYM TOMIE  
**Deployment / production changes:** NONE AUTHORIZED

---

## 1. Cel dokumentu

Ten tom opisuje rzeczywistą architekturę aplikacji Gracz.pl na poziomie komponentów wykonawczych: plików, serwisów, warstw HTTP, persistence, security, realtime, gier, testów i operacji. Dokument ma odpowiadać na pytania:

1. jaki komponent istnieje,
2. gdzie znajduje się w repozytorium,
3. za co odpowiada,
4. od czego zależy,
5. jaki stan jest authoritative,
6. gdzie przebiega granica zaufania,
7. jakie testy i kontrole chronią komponent,
8. co jest stanem AS-IS, a co dopiero kierunkiem docelowym.

Dokument nie autoryzuje zmian kodu, migracji, merge, deploymentu ani produkcji.

---

## 2. Główna mapa runtime

```text
Browser / Web UI
      |
      v
HTTP server / security headers / request guards
      |
      +--> Auth / sessions / accounts / recovery
      +--> RBAC / MFA / privileged admin
      +--> Lobby
      +--> Checkers HTTP + MatchRuntime
      +--> Gomoku HTTP + service + PostgreSQL service
      +--> Thousand HTTP + service + repository + realtime
      +--> Tournaments
      +--> Rankings
      +--> Global chat / moderation
      +--> Newsletter / admin / lifecycle analytics
      +--> Attachments / secure mail
      +--> Audit / monitoring
      |
      v
Persistence layer
      |
      +--> PostgreSQL in configured environments
      +--> memory/file implementations for dev/test-compatible paths
      |
      v
Shared distributed infrastructure
      +--> distributed traffic guard
      +--> PostgreSQL realtime hub
      +--> CAS / versioning / ownership fencing
```

### Architektoniczna zasada nadrzędna

Serwer jest authoritative. Frontend nie jest źródłem prawdy dla stanu gry, autoryzacji, kolejności mutacji ani persistence.

---

## 3. Runtime bootstrap i composition root

### Plik

`modern/checkers-engine/src/main.js`

### Odpowiedzialność

`main.js` jest composition root obecnej aplikacji. Ładuje konfigurację, inicjalizuje serwisy, wybiera warianty PostgreSQL albo file/memory tam, gdzie zostało to przewidziane, składa handlery HTTP, montuje warstwy bezpieczeństwa, uruchamia health/readiness i kontrolowany shutdown.

### Potwierdzone komponenty składane w `main.js`

- accounts i secure accounts,
- auth oraz auth sessions,
- message attachments,
- lobby i platform lobby HTTP,
- global chat,
- tournaments,
- rankings,
- newsletter i newsletter admin,
- audit service,
- security service,
- secure mail,
- RBAC,
- MFA,
- privileged MFA wrapper,
- moderation,
- security monitor,
- Thousand service/repository/realtime/HTTP,
- Gomoku service/PostgreSQL service/HTTP,
- distributed traffic guard,
- PostgreSQL realtime hub,
- production rate-limit composition,
- P7 game HTTP server,
- health handler.

### Security controls montowane na wejściu HTTP

`main.js` ustawia m.in. nagłówki bezpieczeństwa: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy` oraz ograniczenia czasowe serwera.

### Zasada

Composition root może łączyć komponenty, ale logika domenowa powinna pozostawać w serwisach/engine/repository, nie w bootstrapie.

---

## 4. Platforma Node.js i zależności

### Plik

`modern/checkers-engine/package.json`

### Stan

- package: `@gracz/checkers-engine`
- version: `0.3.0`
- module system: ESM
- Node engine: `>=24`
- runtime dependency: `pg 8.23.0`
- dev dependency: `playwright 1.62.1`
- unit/integration test runner: `node --test`
- browser journeys: lobby + Gomoku

### Wniosek architektoniczny

Aktualny nowoczesny backend jest celowo lekki zależnościowo. Jest to korzystne dla supply-chain security i długoterminowego utrzymania, ale każda przyszła biblioteka powinna przechodzić dependency review.

---

## 5. Warcaby — silnik domenowy

### Główny plik

`modern/checkers-engine/src/index.js`

### Odpowiedzialność

Silnik Warcabów zawiera czystą logikę domenową:

- plansza 8×8,
- gracze white/black,
- piony i damy,
- generowanie ruchów legalnych,
- wymuszone bicia,
- kontynuację wielokrotnego bicia,
- promocję,
- wykrywanie zwycięzcy,
- remis przez trzykrotne powtórzenie,
- remis bez progresu,
- replay historii ruchów,
- serializację/deserializację stanu.

### Ważna własność

Zwracany stan jest zamrażany (`Object.freeze`) w celu ograniczenia przypadkowych mutacji w pamięci.

### Testy

`test/checkers-engine.test.js` oraz pakiety P1-C-01 i P1-U-02.

---

## 6. MatchRuntime — wspólny runtime mutacji gry

### Główny plik

`modern/checkers-engine/src/match-runtime.js`

### Kontrakt runtime

Repozytorium musi implementować:

- `loadMatchRuntime`,
- `claimMatchOwnership`,
- `executeMatchRuntimeCommand`.

Adapter engine musi implementować:

- `applyCommand`,
- `project`.

### Zabezpieczenia

MatchRuntime egzekwuje:

- `expectedVersion`,
- monotoniczny `ownershipEpoch`,
- `idempotencyKey`,
- hash komendy SHA-256,
- persistence przed publication,
- brak ponownego publication przy replay,
- projection per viewer.

### Error contract

Istnieją jawne błędy 409 dla:

- stale ownership,
- version conflict,
- idempotency conflict.

### Realtime

Realtime jest **signal-only** i non-authoritative. Błąd publication po poprawnym commit nie cofa persistence.

### Testy

- `test/p1-u-02-checkers-runtime.test.js`
- `test/p1-u-02-match-runtime-postgres.test.js`
- `test/p1-u-02-p7-f01-privacy.test.js`
- `test/p1-u-02-p7-f02-projection-contract.test.js`
- `test/p1-u-02-p7-f03-current-replay.test.js`
- `test/p1-u-02-slice2-checkers-http.test.js`

---

## 7. Adapter Warcabów do MatchRuntime

### Plik

`modern/checkers-engine/src/checkers-match-runtime-adapter.js`

### Rola

Oddziela wspólny runtime od reguł konkretnej gry. Jest wzorcem dla przyszłych adapterów innych gier.

### Kierunek docelowy

Tysiąc, Poker, Blackjack i Wojna powinny finalnie korzystać z jasno zdefiniowanych adapterów wspólnego runtime, ale migracja Tysiąca/Gomoku do MatchRuntime nie jest w tym dokumencie deklarowana jako wykonana.

---

## 8. Persistence Warcabów / sesji

### Pliki

- `src/store.js`
- `src/postgres-session-store.js`
- `src/session.js`

### Role

`store.js` zapewnia file-based path dla środowisk niewymagających PostgreSQL. `postgres-session-store.js` zapewnia trwałość PostgreSQL oraz kontrakty związane z wersjonowaniem/CAS/MatchRuntime. `session.js` utrzymuje logikę sesji gry.

### Zasada produkcyjna

Dla skalowania poziomego stan gry wymagający koordynacji nie może opierać się wyłącznie na pamięci pojedynczego procesu.

---

## 9. HTTP Warcabów

### Pliki

- `src/server-p7.js`
- `src/server.js`
- `src/protocol.js`
- `src/realtime.js`

### Stan

`main.js` składa `createGameHttpServer` z `server-p7.js`. Starszy `server.js` pozostaje w repo i musi być traktowany jako część historii/legacy/runtime surface do dalszego audytu dead-code i compatibility.

### Wymóg dokumentacyjny

Pełny audyt projektu po P8 ma sklasyfikować każdą aktywną oraz historyczną ścieżkę serwera jako:

- active,
- compatibility-only,
- test-only,
- dead/stale,
- future removal candidate.

---

## 10. Lobby platformowe

### Pliki

- `src/lobby.js`
- `src/platform-lobby-http.js`
- `web/lobby.html`
- `web/lobby.js`

### Odpowiedzialność

Lobby jest warstwą wejścia do gier i stołów. Integruje Warcaby oraz istniejące serwisy Tysiąca/Gomoku.

### P8

P8 / P1-U-01 centralizuje identyfikatory typów gier, ale do czasu merge PR #43 dokument główny nie może opisywać P8 jako obecnego na `main`.

Po formalnym zamknięciu P8 ten tom musi otrzymać aktualizację baseline.

---

## 11. Gomoku

### Pliki backend

- `src/gomoku-service.js`
- `src/postgres-gomoku-service.js`
- `src/gomoku-http.js`

### Frontend

- `web/gomoku.html`
- `web/gomoku.js`
- `web/gomoku-players.html`
- `web/gomoku-players.js`

### Persistence

`main.js` wybiera PostgreSQL-backed `PostgresGomokuService`, gdy `DATABASE_URL` jest dostępny, a w przeciwnym przypadku usługę pamięciową.

### Testy

- `test/gomoku-service.test.js`
- `test/gomoku-multiplayer-http.test.js`
- `test/p1-aud3-04-gomoku-http-concurrency.test.js`
- `test/p1-aud3-04-gomoku-postgres.test.js`
- `e2e/gomoku.browser.mjs`

### Status architektoniczny

Gomoku ma trwałą ścieżkę PostgreSQL i testy concurrency, ale nie należy deklarować migracji do wspólnego MatchRuntime, dopóki nie zostanie ona rzeczywiście wykonana i zaaudytowana.

---

## 12. Tysiąc

### Pliki backend

- `src/thousand-engine.js`
- `src/thousand-repository.js`
- `src/thousand-service.js`
- `src/thousand-realtime.js`
- `src/thousand-http.js`

### Frontend

- `web/thousand.html`
- `web/thousand.js`
- `web/thousand-lobby.js`
- `web/thousand.css`
- `web/thousand-multiplayer.css`

### Architektura

Tysiąc posiada rozdzielone warstwy engine / repository / service / realtime / HTTP. Jest to dobra baza do przyszłej integracji z GFPE, ale aktualny mechanizm gry nie może zostać automatycznie uznany za końcową implementację Tysiąca FairPlay MAX.

### Ważne ograniczenie

Przed finalną integracją należy osobno zatwierdzić kanoniczne reguły wariantów 2/3/4-osobowych, sposób musiku oraz reguły rozdania. Obecny kod jest stanem AS-IS, nie automatycznie finalnym standardem produktowym.

### Testy

- `test/thousand-engine.test.js`
- `test/thousand-service.test.js`

### Plan docelowy

Po ukończeniu Full Max Core Tysiąc ma być pierwszą pełną grą walidującą GFPE w rzeczywistym multiplayerze.

---

## 13. Turnieje

### Plik

`src/tournaments.js`

### Odpowiedzialność

Serwis turniejowy obejmuje tworzenie i obsługę turniejów oraz odpowiedni handler HTTP.

### Concurrency

Istnieje dedykowany test:

`test/p1-h-01-tournament-concurrency.test.js`

### Zasada

Operacje konkurencyjne muszą być chronione mechanizmami transakcyjnymi/CAS/advisory lock lub innym mechanizmem potwierdzonym przez audyt implementacji. Sam frontend nie może rozstrzygać wyniku wyścigu.

---

## 14. Rankingi

### Plik

`src/rankings.js`

### Frontend

- `web/ranking.html`
- `web/ranking.js`
- `web/ranking.css`

### Rola

Ranking jest read-model/service surface zależnym od poprawnej identyfikacji gry i danych wynikowych.

### P8 dependency

P8 zmienia kontrakt identyfikatorów gry dla rankingów. Do czasu merge PR #43 stan P8 pozostaje pending.

---

## 15. Authentication i session security

### Pliki

- `src/auth.js`
- `src/auth-sessions.js`
- `src/accounts.js`
- `src/postgres-accounts.js`
- `src/secure-accounts.js`
- `src/account-recovery-handler.js`
- `src/token-service.js`

### Frontend auth

- `web/auth-form.js`
- `web/auth-cookie-migration.js`

### Zasady

- identity i authorization są serwerowe,
- sesje muszą mieć trwałe/revocable zachowanie odpowiednie do środowiska,
- sekret auth nie może być ponownie używany jako klucz innych domen kryptograficznych,
- recovery jest osobnym security-sensitive flow.

---

## 16. RBAC, MFA i privileged access

### Pliki

- `src/rbac-service.js`
- `src/mfa-service.js`
- `src/privileged-auth-wrapper.js`
- `src/admin-security-handler.js`
- `web/privileged-mfa-login.js`

### Rola

Warstwa uprzywilejowanego dostępu ma oddzielać zwykłą sesję użytkownika od operacji wymagających wyższej pewności tożsamości i roli.

### Otwarte zagadnienie audytowe

Historyczny backlog zawiera P1-B-01 dotyczący RBAC/MFA tests. Pełny audyt po P8 ma ustalić jego aktualny rzeczywisty status i ewentualny remediation scope.

---

## 17. Security, audit i monitoring

### Pliki

- `src/security-service.js`
- `src/audit-service.js`
- `src/security-monitor.js`
- `src/moderation-service.js`
- `src/adaptive-bot-defense.js`
- `src/traffic-guard.js`
- `src/production-rate-limit.js`

### Rola

Ta warstwa odpowiada za request security, audit trail, obserwację błędów i nadużyć, moderację, ochronę antybotową oraz limity ruchu.

### Zasada skalowania

Kontrola wyłącznie lokalna w pamięci procesu nie jest wystarczająca dla multi-node. `main.js` składa także distributed traffic guard oparty o PostgreSQL.

---

## 18. Distributed infrastructure i realtime

### Plik

`src/distributed-infrastructure.js`

### Potwierdzone elementy używane przez bootstrap

- `PostgresDistributedTrafficGuard`
- `PostgresRealtimeHub`

### Rola

Shared infrastructure zapewnia mechanizmy wspólne pomiędzy procesami/nodami. Jej celem jest eliminowanie założenia, że pojedynczy proces Node jest jedynym uczestnikiem systemu.

### Zasada realtime

Realtime nie jest źródłem prawdy dla committed game state. Po sygnale klient powinien odczytać autorytatywny stan/projection.

---

## 19. Global chat i moderacja

### Backend

`src/global-chat.js`

### Frontend

- `web/global-chat.html`
- `web/global-chat.js`
- `web/global-chat.css`
- `web/global-chat-edit-fix.js`

### Integracja

`main.js` owija global chat warstwą moderacji przed wystawieniem handlera HTTP.

### Wymogi

Chat powinien zachowywać:

- authorization,
- moderation,
- rate limiting,
- auditability dla zdarzeń security-sensitive,
- ochronę przed injection/XSS na granicy renderowania.

---

## 20. Wiadomości i załączniki

### Backend

`src/message-attachments.js`

### Frontend

- `web/messages.html`
- `web/messages.js`
- `web/messages.css`
- `web/messages-dialog-fix.js`

### Crypto boundary

Załączniki posiadają osobną domenę klucza (`attachmentEncryptionKey`) w composition root. Jest to zgodne z zasadą separacji kluczy, która była przedmiotem P1-AUD3-03.

---

## 21. Newsletter

### Backend

- `src/newsletter.js`
- `src/newsletter-admin-service.js`
- `src/newsletter-admin-handler.js`
- `src/newsletter-lifecycle-recorder.js`
- `src/newsletter-analytics-wrapper.js`
- `src/secure-mail-service.js`

### Rola

Newsletter posiada oddzieloną ścieżkę zwykłego lifecycle i uprzywilejowanego admin surface. Bootstrap łączy admin z auth sessions, RBAC, MFA, audit i security.

### Testy

Repo zawiera testy funkcjonalne, admin, lifecycle analytics, security i penetration dla newslettera.

---

## 22. Health i readiness

### Plik

`src/health.js`

### Integracja

Health handler jest montowany przed dalszą obsługą requestów w `main.js`.

### Testy P1-AUD3-07

- `test/p1-aud3-07-readiness.test.js`
- `test/p1-aud3-07-postgres-readiness.test.js`
- `test/p1-aud3-07-runtime-wiring.test.js`

### Zasada

Liveness nie może być mylone z readiness. System może żyć jako proces, ale być niegotowy do bezpiecznej obsługi ruchu, jeśli krytyczny dependency jest niedostępny.

---

## 23. PostgreSQL security boundary

### Pliki

- `src/pg-secure-preload.cjs`
- `ops/postgres-least-privilege.sql`
- PostgreSQL repositories/services poszczególnych domen

### Start procesu

Skrypt `start` uruchamia Node z preloadem `pg-secure-preload.cjs` przed `src/main.js`.

### Zasada

Połączenie do PostgreSQL, role, transport i least privilege są częścią security architecture, nie tylko konfiguracją infrastrukturalną.

---

## 24. Backup i Disaster Recovery

### Pliki

- `ops/DR-RESTORE-RUNBOOK.md`
- `ops/backup-postgres.sh`
- `ops/dr-restore-rehearsal.sh`
- `ops/test-dr-restore-program.sh`
- `ops/test-restore-postgres.sh`

### Status

P1-R-01 został wcześniej formalnie zamknięty i scalony w PR #41. Nie oznacza to automatycznego wykonania restore na produkcji.

### Zasada

Dowodem DR nie jest samo posiadanie backupu. Wymagane są sprawdzalne restore/rehearsal evidence i odseparowany target.

---

## 25. Web UI

### Katalog

`modern/checkers-engine/web/`

### Główne obszary potwierdzone w drzewie

- homepage/index,
- lobby,
- Warcaby UI i assety odziedziczone z wersji Flash,
- Gomoku,
- Tysiąc,
- tournaments,
- ranking,
- community,
- global chat,
- messages,
- players,
- profile modal,
- settings,
- auth,
- privacy policy,
- regulations,
- coming-soon.

### Zasada architektoniczna

Web UI może posiadać lokalny stan prezentacyjny, ale nie może być authoritative dla identity, permissions, game outcome, persistence version ani FairPlay deck state.

---

## 26. Browser E2E

### Pliki

- `e2e/lobby.browser.mjs`
- `e2e/gomoku.browser.mjs`

### Rola

Browser journey testuje zintegrowany przepływ użytkownika ponad jednostkowymi kontraktami backendu.

### Kierunek FULL MAX

Po integracji GFPE wymagany będzie osobny browser journey dla Verify Hand oraz co najmniej Tysiąca multiplayer.

---

## 27. Test architecture

### Test runner

`node --test`

### Kategorie istniejące w repo

- engine/unit,
- auth/lobby,
- session/store,
- security,
- traffic guard,
- newsletter,
- Gomoku HTTP/PostgreSQL/concurrency,
- Checkers CAS/HTTP/PostgreSQL/concurrency,
- tournament concurrency,
- readiness,
- crypto key separation,
- shared infrastructure,
- MatchRuntime/P7 privacy/projection/replay,
- Tysiąc engine/service,
- browser E2E.

### Zasada FULL MAX

Testy muszą chronić invariants architektury, a nie tylko pokrywać linie kodu. Dla mutacji krytycznych wymagane są negative tests, concurrency tests i fail-closed tests.

---

## 28. Trust boundaries

```text
UNTRUSTED
Browser / client input
      |
      v
HTTP parsing + auth + origin/security + rate controls
      |
      v
Application services / authorization boundary
      |
      v
Domain engine / MatchRuntime
      |
      v
Repository / PostgreSQL transaction boundary
      |
      v
Durable committed state
```

Dla przyszłego FairPlay MAX zostanie dodana dodatkowa granica:

```text
Game Engine / MatchRuntime
      |
      v
GFPE Adapter
      |
      v
GFPE Core + key boundary + FairPlay ledger
```

---

## 29. Source-of-truth matrix

| Obszar | Authoritative source |
|---|---|
| Identity | backend auth/account/session state |
| Permission | RBAC/MFA/backend authorization |
| Checkers rules | `src/index.js` + approved runtime adapter |
| Match command commit | repository transaction through MatchRuntime |
| Match version | durable repository state |
| Ownership | ownership epoch/fencing state |
| Realtime | NON-AUTHORITATIVE signal |
| Gomoku durable production-like state | PostgreSQL service when DB configured |
| Thousand current state | Thousand repository/service contract |
| Audit | AuditService persistence/log contract |
| DR evidence | restore/rehearsal evidence, not backup existence alone |
| FairPlay future | GFPE Core/ledger — NOT YET IMPLEMENTED |

---

## 30. Current architectural strengths

1. Serwer-authoritative model.
2. Niewielka liczba runtime dependencies.
3. Jawne PostgreSQL-backed paths.
4. MatchRuntime z CAS/versioning/idempotency/ownership fencing.
5. Signal-only realtime w P7.
6. Rozdzielone engine/service/repository/HTTP w Tysiącu.
7. PostgreSQL durability/concurrency w Gomoku.
8. Dedykowane security, audit, moderation, RBAC i MFA components.
9. Shared distributed rate limiting/realtime.
10. Testy real PostgreSQL i concurrency dla krytycznych obszarów.
11. Oddzielny DR program i runbook.
12. Separacja kluczy kryptograficznych jako utrwalona zasada.

---

## 31. Obszary wymagające pełnego audytu po P8

1. P1-B-01 — aktualny stan RBAC/MFA test coverage.
2. Aktywność i przeznaczenie `server.js` względem `server-p7.js`.
3. Pozostałe runtime-local dictionaries / game-type comparisons po P8.
4. Pełna mapa endpointów i error contracts.
5. Pełna mapa tabel/queries/indexów PostgreSQL do rzeczywistego kodu.
6. Dead code i historyczne compatibility paths.
7. Horizontal-scale assumptions wszystkich komponentów pamięciowych.
8. Realtime privacy i projection boundaries dla każdej gry.
9. Tysiąc — finalne reguły produktowe przed GFPE integration.
10. Gomoku/Tysiąc — decyzja o przyszłej migracji do MatchRuntime.
11. Observability/SLO/alerting production readiness.
12. Privacy/Legal HOLD i pięć otwartych P1 tego obszaru.

---

## 32. FairPlay MAX integration point

GFPE nie jest obecnie zaimplementowany w `main`.

Docelowy kontrakt powinien wyglądać:

```text
HTTP authenticated command
      |
      v
MatchRuntime
      |
      v
Game Adapter
      |
      v
GFPE Adapter
      |
      v
GFPE Core
      |
      +--> entropy / commit-reveal
      +--> deterministic CSPRNG
      +--> Fisher-Yates
      +--> frozen deck/shoe
      +--> proof / signature
      +--> FairPlay ledger
      |
      v
Game projection / player view
```

GFPE nie może być dodatkiem frontendowym ani opcjonalnym helperem RNG. Dla gier objętych Full Max ma być częścią krytycznej ścieżki autorytatywnego deal.

---

## 33. Reguła aktualizacji tego tomu

Po każdym z poniższych zdarzeń dokument wymaga aktualizacji:

- formalny merge/closure P8,
- full-project audit,
- każda grupa remediation,
- GFPE specification freeze,
- GFPE implementation,
- migracja dowolnej gry do MatchRuntime/GFPE,
- zmiana persistence/realtime/auth/security architecture,
- deployment architecture decision,
- final production cutover.

Każda aktualizacja musi wskazać nowy baseline `main SHA` i dowody w `01-EVIDENCE-REGISTER.md`.

---

## 34. Current verdict

```text
COMPONENT ARCHITECTURE DOCUMENTATION = BASELINE CREATED
VERIFIED CODE BASELINE = main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08
P8 / PR #43 = NOT YET INCLUDED IN MAIN BASELINE
GFPE = PRE-DESIGN ONLY / NOT IMPLEMENTED
PRODUCTION V3 = NO-GO
DEPLOYMENT = NOT AUTHORIZED
FINAL AS-BUILT = NOT YET AVAILABLE
```

Ten tom jest częścią `GRACZ.PL — FULL MAX MASTER DOCUMENTATION` i pozostaje żywy aż do finalnego AS-BUILT.
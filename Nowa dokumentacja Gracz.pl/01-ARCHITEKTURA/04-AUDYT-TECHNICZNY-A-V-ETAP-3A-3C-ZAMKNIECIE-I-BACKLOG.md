# Gracz.pl — audyt techniczny A–V, Etap 3A–3C: zamknięcie i backlog

Data zapisu: 01.09.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Branch: `main`  
Baseline audytu: `5eaf7eecb794811cc9bcb99f98c6e125151058a8`  
Tryb audytu: `READ-ONLY / NO IMPLEMENTATION / NO DEPLOYMENT`

## 1. Cel i zakres

Ten dokument zapisuje wynik technicznego audytu dokumentacja–kod dla zakresu A–V, wykonanego w trzech częściach: 3A, 3B i 3C. Nie zastępuje dokumentów AS-IS ani ADR. Utrwala wyłącznie:

1. zweryfikowane ustalenia AS-IS,
2. backlog implementacyjny,
3. backlog testowy,
4. backlog dowodów operacyjnych.

Określenie „Etap 3A–3C” w tym pliku oznacza zewnętrzny audyt techniczny A–V. Nie jest to historyczny `ETAP 3` migracji zakończony Gate 15.

## 2. Provenance i granice zaufania

| Pole | Wartość |
|---|---|
| review type | external technical audit, części 3A–3C |
| reviewer role | external technical reviewer |
| reviewer/tool identity | zadeklarowana operatorowi poza Git; niezweryfikowana przez repozytorium |
| independence | nie jest deklarowana jako zweryfikowana |
| review baseline | `5eaf7eecb794811cc9bcb99f98c6e125151058a8` |
| evidence | dokumentacja repozytorium, kod, testy, CI oraz zapisane dowody operacyjne |
| repository mutation during audit | brak |
| implementation/deployment | nieautoryzowane |
| freeze | `ACTIVE` |

Repozytorium nie otrzymuje fikcyjnego `Reviewed-by` ani `Approved-by`. Ten zapis nie zmienia historii Git i nie nadaje tożsamości osobie, której repozytorium nie potrafi uwierzytelnić.

## 3. Wynik zamknięcia Etapu 3A–3C

```text
TECHNICAL AUDIT A-V 3A-3C = CLOSED
NEW P0 = NONE
DOCUMENTATION OVERCLAIM = NONE FOUND IN VERIFIED SCOPE
DOCUMENT-TO-CODE ACCURACY = ADEQUATE
ARCHITECTURAL DESIGN TRUST = MEDIUM-HIGH
IMPLEMENTATION CONFIDENCE = MEDIUM
OPERATIONAL READINESS = NOT VERIFIED AS A WHOLE / PRODUCTION V3 NOT READY
HORIZONTAL SCALE READINESS = NOT READY
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
```

„Brak overclaim” oznacza brak materialnego przedstawiania TARGET jako istniejącego AS-IS w zweryfikowanym zakresie A–V. Nie oznacza to, że implementacja jest kompletna, przetestowana ani gotowa operacyjnie.

Bramka `REVIEWED DESIGN` pozostaje w `HOLD` z powodu formalnie otwartego Privacy/Legal governance dla `ADR-V3-012`. Zamknięcie audytu technicznego nie zastępuje human ownera Privacy/Legal i nie autoryzuje implementacji.

## 4. Zweryfikowane ustalenia AS-IS

| ID | Obszar | Stan AS-IS | Klasyfikacja | Dowód repozytoryjny |
|---|---|---|---|---|
| ASIS-001 | Rate limiting | Liczniki są przechowywane w lokalnych `Map`; instancje nie współdzielą limitu. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/rate-limit.js` |
| ASIS-002 | Realtime/SSE | `RealtimeHub` przechowuje subskrybentów w lokalnym `Map`; brak shared backplane. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/realtime.js` |
| ASIS-003 | Checkers persistence | `PostgresSessionStore.save()` używa upsertu bez `version`, `expected_version`, CAS ani fencing; zapis jest last-write-wins. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/postgres-session-store.js` |
| ASIS-004 | Sekrety kryptograficzne | Osobne klucze message/attachment/MFA mogą spaść do `AUTH_SECRET`; produkcja emituje warning i nadal startuje. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/config.js`, `mfa-service.js` |
| ASIS-005 | Gomoku | Stan partii znajduje się wyłącznie w `GomokuService.#games = new Map()`; restart usuwa aktywne partie, a druga instancja ich nie widzi. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/gomoku-service.js`, `main.js` |
| ASIS-006 | Tysiąc | Przy `DATABASE_URL` używany jest PostgreSQL z monotoniczną `revision` i warunkowym zapisem CAS. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/thousand-repository.js`, `main.js` |
| ASIS-007 | Turnieje | Warunkowy zapis wyniku nie sprawdza `rowCount`; recompute i advancement są poza wspólną transakcją, a brak UNIQUE dla `(tournament_id, round, board)` umożliwia podwójny awans/parowanie w race. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/tournaments.js` |
| ASIS-008 | Załączniki wiadomości | Ścieżka załączników używa AES-256-GCM, HKDF, AAD, parametryzowanego SQL, ACL oraz walidacji MIME/magic bytes. Ustalenie nie obejmuje automatycznie całego messaging/chat. | `AS-IS CONFIRMED / SCOPE LIMITED` | `modern/checkers-engine/src/message-attachments.js` |
| ASIS-009 | Audit | Trigger blokuje UPDATE/DELETE i odebrano te operacje `PUBLIC`; jest to DB-level tamper resistance. Niezależna niemutowalność nie jest dowiedziona bez separacji właściciela/roli i zewnętrznego sinka. | `AS-IS CONFIRMED / OPERATIONAL CONTROL NOT VERIFIED` | `modern/checkers-engine/src/audit-service.js` |
| ASIS-010 | RBAC | Backend zawiera role, permissions oraz jawne bramki `can/require`; role uprzywilejowane wymagają MFA w modelu serwisu. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/rbac-service.js` |
| ASIS-011 | MFA | Sekret TOTP jest szyfrowany AES-256-GCM/HKDF, ale brak replay protection i formalnego recovery; klucz może spaść do `AUTH_SECRET`. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/mfa-service.js`, `config.js` |
| ASIS-012 | Game types | Słowniki są niespójne: m.in. `checkers/thousand` w rankingach i `warcaby/gomoku/szachy` w turniejach. | `AS-IS CONFIRMED` | `modern/checkers-engine/src/rankings.js`, `tournaments.js`, `platform-lobby-http.js` |
| ASIS-013 | Multi-game runtime | Checkers, Gomoku i Tysiąc mają osobne serwisy, modele persystencji i mechanizmy współbieżności; wspólny Match Runtime pozostaje TARGET. | `TARGET ONLY / NOT IMPLEMENTED` | `modern/checkers-engine/src/main.js` oraz serwisy trzech gier |
| ASIS-014 | Health/observability | `GET /health` zawsze zwraca `{"status":"ok"}` i nie weryfikuje DB; security monitor ma realne progi, ale brak pełnego readiness/metrics/tracing. | `AS-IS PARTIAL` | `modern/checkers-engine/src/server.js`, `security-monitor.js` |
| ASIS-015 | Backup/restore | Istnieje punktowy, ręczny restore do izolowanej bazy: `PASS / EXIT 0`, 28/28 tabel, 17 711/17 711 rekordów i 0 różnic. Brak cyklicznego programu restore/DR w CI. | `OPERATIONAL EVIDENCE PASS / RECURRING PROGRAM MISSING` | `03-MIGRACJA/62-ETAP4-E4.1-F-RESTORE-VALIDATION-EXECUTION-LOG.md` |

## 5. Implementation backlog

Poniższe pozycje są backlogiem po zdjęciu freeze i po osobnej autoryzacji. Nie są poleceniem wykonania.

| ID | Priorytet | Problem | Oczekiwany kierunek |
|---|---|---|---|
| IMP-001 | P1 | Process-local rate limiting | Wspólny, atomowy store limitów z jasno określonym failure mode. |
| IMP-002 | P1 | Process-local realtime/SSE | Shared backplane albo jawna sticky-routing topology z kontraktem reconnect/resume. |
| IMP-003 | P1 | Checkers last-write-wins | CAS/expected version oraz fencing zgodne z `ADR-V3-004`. |
| IMP-004 | P1 | Klucze message/attachment/MFA spadają do `AUTH_SECRET` | Produkcyjny fail-closed i niezależne klucze z planem rotacji. |
| IMP-005 | P1 | Gomoku bez persystencji | Trwały repository, restart recovery i kontrola współbieżności. |
| IMP-006 | P1 | Race w raportowaniu i awansie turnieju | Transakcyjny commit wyniku/awansu, sprawdzenie `rowCount`, idempotency i constraint chroniący rundę/board. |
| IMP-007 | P1 | Niespójny słownik game types | Jeden kanoniczny identyfikator gry i jawne mapowanie aliasów/migracji. |
| IMP-008 | P1 | Brak wspólnego Match Runtime | Implementacja docelowego kontraktu pozostaje osobnym, autoryzowanym etapem V3. |
| IMP-009 | P1 | `/health` nie jest readiness | Oddzielne liveness/readiness z kontrolą DB i krytycznych zależności. |
| IMP-010 | P2 | TOTP bez replay protection | Zapis/odrzucanie ponownego użycia zaakceptowanego time-step. |
| IMP-011 | P2 | Brak MFA recovery | Formalny, audytowalny i odporny na takeover proces recovery. |

## 6. Test backlog

| ID | Priorytet | Zakres wymaganych testów |
|---|---|---|
| TEST-001 | P1 | RBAC/MFA: permission matrix, privilege escalation, MFA enforcement, błędna konfiguracja klucza i fail-closed. |
| TEST-002 | P1 | Turnieje: równoległy report, duplikat wyniku, podwójny awans, retry i restart między wynikiem a utworzeniem rundy. |
| TEST-003 | P1 | Checkers: CAS/fencing/multi-writer po wdrożeniu IMP-003. |
| TEST-004 | P1 | Gomoku: persistence, restart/reconnect i dwie instancje po wdrożeniu IMP-005. |
| TEST-005 | P2 | Attachments/messaging: ACL/IDOR, MIME/magic bytes, GCM tamper, legacy AAD i niepoprawne klucze. |
| TEST-006 | P2 | Audit/moderation: append-only trigger, uprawnienia DB, sanitizacja metadata, ban/block/mute i appeal. |
| TEST-007 | P2 | Rate limiting i realtime w układzie wieloinstancyjnym po wdrożeniu IMP-001/002. |
| TEST-008 | P2 | Readiness: niedostępna DB, degraded dependency i poprawne rozdzielenie liveness/readiness. |
| TEST-009 | P2 | TOTP replay i MFA recovery po wdrożeniu IMP-010/011. |
| TEST-010 | P2 | Kontrakty wspólnego Match Runtime i jednolity słownik game types po wdrożeniu IMP-007/008. |

Obecność pliku testowego nie jest automatycznie traktowana jako pokrycie zachowania. Dowód testowy musi wskazywać konkretny scenariusz i wynik.

## 7. Operational evidence backlog

| ID | Priorytet | Brakujący dowód |
|---|---|---|
| OPS-EV-001 | P1 | Cykliczny backup/restore rehearsal, harmonogram, retencja, RPO/RTO i trwały rekord kolejnych wykonań. Historyczny i świeży punktowy restore PASS pozostają ważne. |
| OPS-EV-002 | P1 | Wieloinstancyjny test rate limit, realtime, Checkers, Gomoku i turniejów; do czasu jego przejścia horizontal scale pozostaje `NOT READY`. |
| OPS-EV-003 | P1 | Operacyjne readiness/metrics/tracing/alerting dla DB failure, failed save, session loss, realtime disconnect i backup failure. |
| OPS-EV-004 | P1 | Inwentarz aktywnych kluczy kryptograficznych, dowód ich separacji i rotacji; bez zapisywania sekretów w repozytorium. |
| OPS-EV-005 | P2 | Dowód separacji roli właściciela audit table, skuteczności ACL i — jeśli wymagane — zewnętrznego immutable sinka. |
| OPS-EV-006 | P2 | Runtime evidence dla modułów bez potwierdzenia produkcyjnego; brak dowodu nie jest klasyfikowany jako FAIL, tylko `NOT VERIFIED`. |

## 8. Decyzja i dalsza praca

```text
ETAP 3A-3C TECHNICAL AUDIT = CLOSED
DOCUMENTATION DELTA REVIEW OF THIS RECORD = PENDING
CODE CHANGES = NONE
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
REVIEWED DESIGN GATE = HOLD
ADR-V3-012 PRIVACY/LEGAL OWNER = UNASSIGNED
FORMAL PRIVACY/LEGAL REVIEW = NOT EXECUTED
FREEZE = ACTIVE
```

Następnym krokiem jest krótki delta review tego zapisu dokumentacyjnego: zgodność findings z raportami 3A–3C, brak zatarcia granicy AS-IS/TARGET oraz poprawne rozdzielenie backlogów. Dopiero zatwierdzony zapis może być używany jako kanoniczny backlog techniczny.

Po tym nadal pozostaje formalne human review Privacy/Legal dla `ADR-V3-012`. Żaden wynik tego audytu nie zdejmuje freeze i nie zmienia bramki `REVIEWED DESIGN`.

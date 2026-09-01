# Gracz.pl — audyt techniczny A–V, Etap 3A–3C: status OPEN i backlog

Data korekty: 01.09.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Branch: `main`  
Baseline audytu: `5eaf7eecb794811cc9bcb99f98c6e125151058a8`  
Tryb audytu: `READ-ONLY / NO IMPLEMENTATION / NO DEPLOYMENT`

## 1. Cel dokumentu

Ten dokument jest bieżącym rekordem technicznego audytu dokumentacja–kod A–V. Rozdziela:

1. zweryfikowany stan AS-IS,
2. backlog implementacyjny,
3. backlog testowy,
4. backlog dowodów operacyjnych.

Określenie „Etap 3A–3C” oznacza audyt techniczny A–V i nie jest historycznym `ETAPEM 3` migracji zakończonym Gate 15.

## 2. Korekta statusu i provenance

Commit `699001a329f01754edc0a0ca68144e749f4ccfde` przedwcześnie zapisał `ETAP 3A-3C = CLOSED`. Ten werdykt zostaje jawnie zastąpiony, bez przepisywania historii Git.

Powód: korekty H/J/N/R wymagają finalnego delta review, a obszary B i U wymagają końcowego deep review w tym samym pakiecie. Wcześniejsze findings pozostają materiałem wejściowym, lecz finalna konsolidacja A–V nie została jeszcze zatwierdzona.

| Pole | Wartość |
|---|---|
| review type | external technical audit 3A–3C |
| reviewer role | external technical reviewer |
| reviewer/tool identity | zadeklarowana operatorowi poza Git; niezweryfikowana przez repozytorium |
| independence | nie jest deklarowana jako zweryfikowana |
| review baseline | `5eaf7eecb794811cc9bcb99f98c6e125151058a8` |
| final correction delta review | `PENDING` |
| implementation/deployment | `NOT AUTHORIZED` |
| freeze | `ACTIVE` |

Nie dodaje się fikcyjnego `Reviewed-by` ani `Approved-by`. Formalne zamknięcie może nastąpić dopiero po zapisaniu rzeczywistego wyniku finalnego Etapu 3C.

## 3. Obowiązujący stan

```text
ETAP 3A-3C TECHNICAL AUDIT = OPEN
FINAL DEEP REVIEW + H/J/N/R CORRECTION DELTA = PENDING

NEW P0 = NONE

CONFIRMED P1:
- process-local rate limiting
- process-local realtime/SSE
- Checkers last-write-wins session save
- encryption keys fallback to AUTH_SECRET
- Gomoku without persistence
- tournament advancement concurrency race
- recurring restore/DR automation missing
- health endpoint without DB readiness

DOCUMENTATION OVERCLAIM = NONE FOUND IN VERIFIED SCOPE
HORIZONTAL SCALE READINESS = NOT READY
OPERATIONAL READINESS = PARTIAL / NOT READY
PRODUCTION V3 = NOT READY
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION / DEPLOYMENT = NOT AUTHORIZED
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
```

Końcowe wartości `DOCUMENT-TO-CODE ACCURACY`, `ARCHITECTURAL DESIGN TRUST` oraz `IMPLEMENTATION CONFIDENCE` pozostają do ponownego wydania po finalnym Etapie 3C.

## 4. Potwierdzone P1

| ID | Obszar | Dowód AS-IS | Wpływ | Backlog |
|---|---|---|---|---|
| P1-AUD3-01 | Rate limiting | `rate-limit.js` przechowuje liczniki w lokalnych `Map`. | Instancje nie współdzielą limitu; ochrona skaluje się niespójnie. | implementation + multi-instance tests |
| P1-AUD3-02 | Realtime/SSE | `RealtimeHub.#subscribers = new Map()` w `realtime.js`. | Druga instancja nie zna subskrybentów pierwszej. | implementation + reconnect/multi-instance tests |
| P1-AUD3-03 | Checkers persistence | `PostgresSessionStore.save()` wykonuje upsert bez version/CAS/fencing. | Równolegli writerzy mogą nadpisywać stan last-write-wins. | implementation zgodna z ADR-V3-004 |
| P1-AUD3-04 | Crypto key separation | `config.js` pozwala MESSAGE/ATTACHMENT/MFA keys spaść do `AUTH_SECRET`; produkcja tylko ostrzega. | Kompromitacja jednego sekretu rozszerza zakres kompromitacji. | produkcyjny fail-closed + rotacja |
| P1-AUD3-05 | Gomoku | `GomokuService.#games = new Map()`; `main.js` nie wstrzykuje repository. | Restart usuwa aktywne partie; instancje nie współdzielą stanu. | persistence + concurrency + recovery |
| P1-H-01 | Tournaments | `report()` nie sprawdza `rowCount`; recompute/advance są poza wspólną transakcją; brak UNIQUE dla `(tournament_id, round, board)`. | Dwa wywołania mogą utworzyć dwa zestawy kolejnej rundy. | transakcja/lock/CAS/idempotency/constraint |
| P1-R-01 | Backup/restore | Punktowy restore ma PASS, ale brak cyklicznej automatyzacji i historii DR. | Odzyskiwalność jest potwierdzona punktowo, nie jako stały program operacyjny. | operational evidence / automation |
| P1-AUD3-08 | Health/readiness | `GET /health` zawsze zwraca `{"status":"ok"}` bez sprawdzenia DB. | Orkiestrator może kierować ruch do instancji bez gotowej zależności DB. | readiness implementation + failure tests |

## 5. Obowiązujące korekty H/J/N/R

### H — Tournaments

```text
P1-H-01 = CONFIRMED
TOURNAMENT ADVANCEMENT CONCURRENCY = NOT SAFE
```

Idempotentne przeliczanie standings nie zabezpiecza atomowo utworzenia następnej rundy.

### J — Messaging / Chat

```text
ATTACHMENT SECURITY = AS-IS CONFIRMED
MESSAGING / CHAT AS A WHOLE = AS-IS PARTIAL
P1-J-01 KEY FALLBACK = CONFIRMED
```

AES-256-GCM/HKDF/AAD, ACL, parametryzowany SQL i walidacja MIME/magic bytes są potwierdzone dla ścieżki załączników. Nie wolno przenosić tego werdyktu automatycznie na private message content, public chat, delivery/read state, delete semantics ani pełne test coverage.

### N — Audit

```text
AUDIT LOG = DB-LEVEL TAMPER-RESISTANT
INDEPENDENT IMMUTABLE EVIDENCE TRAIL = NOT VERIFIED
```

Trigger UPDATE/DELETE oraz `REVOKE ... FROM PUBLIC` wzmacniają append-only na poziomie DB. Nie dowodzą separacji table ownera, ochrony przed ALTER/DROP/DISABLE trigger ani istnienia WORM/external immutable sink/cryptographic chaining. Błąd `REVOKE` jest ignorowany przez `.catch(() => {})`.

### R — Backup / Restore

```text
BACKUP SCRIPT EXISTS = YES
RESTORE SCRIPT EXISTS = YES
MANUAL ISOLATED RESTORE TESTED = YES
POINT-IN-TIME OPERATIONAL RESTORE EVIDENCE = PASS

RESTORE EXIT = 0
TABLES = 28/28
PRODUCTION ROWS = 17 711
RESTORE ROWS = 17 711
DIFFERENCES = 0
PRODUCTION = UNCHANGED

CI / SCHEDULED RESTORE AUTOMATION = MISSING
PERIODIC DR EVIDENCE = MISSING
```

Dowód: `03-MIGRACJA/62-ETAP4-E4.1-F-RESTORE-VALIDATION-EXECUTION-LOG.md`. Luka P1-R-01 nie oznacza „restore nigdy nie był testowany”.

## 6. Ostatni wymagany Etap 3C

Finalny read-only review musi objąć:

1. B — RBAC/MFA: backend enforcement, escalation, MFA encryption, fallback, TOTP replay, recovery/reset i testy;
2. U — multi-game architecture: faktycznie współdzielony kod, duplikacja, persystencja, CAS, realtime, słownik game types i TARGET Match Runtime;
3. H — ponowną analizę transakcji, locks/CAS/constraints i race awansu;
4. J — rozdzielenie attachments, private messages, public chat, auth, delete, delivery/read i testów;
5. N — rozdzielenie DB tamper resistance od niezależnego immutable evidence trail;
6. R — uznanie punktowego restore PASS i osobną ocenę cyklicznego DR;
7. finalną konsolidację P0/P1/P2 oraz werdykt A–V.

Do czasu wykonania tej listy `ETAP 3 = OPEN`.

## 7. Backlog obowiązujący przed finalnym review

### Implementation backlog

- shared/atomic rate-limit store,
- realtime backplane albo udowodniona topology sticky routing,
- CAS/expected version/fencing dla Checkers,
- produkcyjny fail-closed dla osobnych kluczy message/attachment/MFA,
- trwała persystencja i recovery Gomoku,
- atomowy i idempotentny tournament advancement,
- realny readiness z DB/dependency checks.

### Test backlog

- multi-instance rate-limit i realtime,
- multi-writer Checkers,
- restart/reconnect/multi-instance Gomoku,
- równoległy report i podwójny awans turniejowy,
- fail-closed kluczy kryptograficznych,
- health/readiness przy awarii DB.

B/U oraz pełne J/N mogą dodać lub zmienić backlog dopiero po finalnym review.

### Operational evidence backlog

- cykliczny restore/DR, RPO/RTO i historia wykonań,
- dowód wieloinstancyjny przed horizontal scaling,
- readiness/metrics/tracing/alerting dla krytycznych awarii,
- dowód separacji i rotacji kluczy,
- dowód DB-role separation lub zewnętrznego immutable sinka dla audit trail.

## 8. Decyzja

```text
ETAP 3 = OPEN
FINAL ETAP 3C REPORT = REQUIRED
CODE CHANGES = NONE
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
REVIEWED DESIGN GATE = HOLD
ADR-V3-012 PRIVACY/LEGAL = OUT OF SCOPE / PENDING HUMAN OWNER
FREEZE = ACTIVE
```

Po otrzymaniu finalnego raportu należy wykonać dokumentacyjny delta review. Dopiero jego wynik może zmienić `ETAP 3` na `CLOSED` albo pozostawić nazwany blocker.

# Gracz.pl — audyt techniczny A–V, Etap 3A–3C: zamknięcie i backlog

Data zamknięcia: 01.09.2026  
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

## 2. Status i provenance

Commit `699001a329f01754edc0a0ca68144e749f4ccfde` przedwcześnie zapisał zamknięcie audytu. Commit `9cc88d4ad378b4361c76470caa868897a33b5baa` jawnie przywrócił status `OPEN`, bez przepisywania historii Git. Po wykonaniu finalnego deep review B/U oraz correction delta review H/J/N/R zewnętrzny reviewer przekazał finalny werdykt pozwalający zamknąć techniczny audyt A–V 3A–3C.

| Pole | Wartość |
|---|---|
| review type | external technical audit 3A–3C |
| reviewer role | external technical reviewer |
| reviewer/tool identity | zadeklarowana operatorowi poza Git; niezweryfikowana przez repozytorium |
| independence | nie jest deklarowana jako zweryfikowana |
| review baseline | `5eaf7eecb794811cc9bcb99f98c6e125151058a8` |
| technical audit verdict | `CLOSED / EXTERNAL_RECORDED` |
| documentation delta review | `PENDING FINAL READBACK` |
| implementation/deployment | `NOT AUTHORIZED` |
| freeze | `ACTIVE` |

Nie dodaje się fikcyjnego `Reviewed-by` ani `Approved-by`. Zamknięcie dotyczy audytu i rejestracji backlogu; nie oznacza akceptacji implementacji, deploymentu ani gotowości produkcyjnej.

## 3. Obowiązujący stan

```text
TECHNICAL AUDIT A-V 3A-3C = CLOSED
DOCUMENTATION DELTA REVIEW = PENDING FINAL READBACK

NEW P0 = NONE
FINAL P1 = 10

DOCUMENTATION OVERCLAIM = NONE FOUND
DOCUMENT-TO-CODE ACCURACY = ADEQUATE
ARCHITECTURAL DESIGN TRUST = MEDIUM-HIGH
IMPLEMENTATION CONFIDENCE = MEDIUM

OPERATIONAL READINESS = PARTIAL / NOT READY
HORIZONTAL SCALE READINESS = NOT READY
PRODUCTION V3 = NOT READY

REVIEWED DESIGN GATE = HOLD
ADR-V3-012 PRIVACY/LEGAL = PENDING HUMAN OWNER
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
```

`OPERATIONAL READINESS = PARTIAL / NOT READY` uwzględnia istniejący punktowy dowód izolowanego restore. Nie jest to status `READY`, ponieważ nie istnieje cykliczny program DR ani kompletna, bieżąca operacyjna weryfikacja V3.

Luki AS-IS obniżają `IMPLEMENTATION CONFIDENCE`, lecz nie obniżają automatycznie `ARCHITECTURAL DESIGN TRUST`: dokumentacja rozdziela AS-IS od TARGET i w zweryfikowanym zakresie nie przedstawia mechanizmów TARGET jako już wdrożonych.

## 4. Finalne P1 — 10

| ID | Obszar | Dowód AS-IS / klasyfikacja | Wpływ | Backlog |
|---|---|---|---|---|
| P1-AUD3-01 | Process-local rate limiting i realtime/SSE | `rate-limit.js` przechowuje liczniki w lokalnych `Map`; `RealtimeHub.#subscribers` jest lokalnym `Map`. | Instancje nie współdzielą ochrony ani subskrypcji. | implementation + multi-instance tests |
| P1-AUD3-02 | Checkers persistence | `PostgresSessionStore.save()` wykonuje upsert bez version/CAS/fencing. | Równolegli writerzy mogą nadpisywać stan last-write-wins. | implementation zgodna z ADR-V3-004 |
| P1-AUD3-03 | Crypto key separation | MESSAGE/ATTACHMENT/MFA keys mogą spaść do `AUTH_SECRET`; produkcja tylko ostrzega. | Kompromitacja jednego sekretu rozszerza zakres kompromitacji. | fail-closed + oddzielne klucze + rotacja |
| P1-AUD3-04 | Gomoku | `GomokuService.#games = new Map()`; brak trwałego repository. | Restart usuwa aktywne partie; instancje nie współdzielą stanu. | persistence + concurrency + recovery |
| P1-H-01 | Tournaments | Brak `UNIQUE(tournament_id, round, board)`; `report()`, `recomputeStandings()` i `advanceDatabase()` nie tworzą jednej transakcji i nie mają locka/CAS. | Równoległe wywołania mogą utworzyć dwa zestawy następnej rundy. | transaction/lock/CAS/idempotency/constraint |
| P1-R-01 | Backup/restore | Punktowy izolowany restore ma zapisany PASS, ale brak cyklicznej automatyzacji i historii DR. | Odzyskiwalność nie jest dowiedziona jako stały program operacyjny. | operational evidence + automation |
| P1-AUD3-07 | Health/readiness | `GET /health` zwraca `{"status":"ok"}` bez sprawdzenia DB. | Ruch może trafić do instancji bez gotowej zależności DB. | readiness implementation + failure tests |
| P1-B-01 | RBAC/MFA tests | Backendowe bramki RBAC i szyfrowanie MFA istnieją, ale brak dedykowanego pokrycia RBAC/MFA. | Regresje uprawnień i MFA mogą pozostać niewykryte. | test backlog |
| P1-U-01 | Słownik typów gier | Rankingi, turnieje, lobby i routing używają niespójnych nazw (`checkers`, `warcaby`, `thousand`, `gomoku`, `szachy`). | Integracje mogą pomijać grę albo akceptować typ bez zgodnego silnika. | canonical dictionary + contract tests |
| P1-U-02 | Common Match Runtime | Checkers, Gomoku i Tysiąc mają odrębne serwisy, repository i modele concurrency; wspólny Match Runtime jest TARGET. | Brak wspólnej egzekucji lifecycle, idempotency, fencing i recovery. | TARGET implementation backlog po autoryzacji |

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

CODE ATTEMPTS:
REVOKE UPDATE / DELETE / TRUNCATE FROM PUBLIC

RUNTIME EFFECTIVENESS OF REVOKE = NOT VERIFIED
INDEPENDENT IMMUTABLE EVIDENCE TRAIL = NOT VERIFIED
```

Trigger blokujący UPDATE/DELETE jest potwierdzony w kodzie. Kod podejmuje próbę `REVOKE ... FROM PUBLIC`, ale błąd tej operacji jest ignorowany przez `.catch(() => {})`; dlatego skuteczne odebranie praw na rzeczywistej bazie nie jest dowiedzione. Nie potwierdzono także separacji table ownera, ochrony przed ALTER/DROP/DISABLE trigger ani WORM/external immutable sink/cryptographic chaining.

### R — Backup / Restore

```text
BACKUP SCRIPT EXISTS = YES
RESTORE SCRIPT EXISTS = YES
MANUAL ISOLATED RESTORE = PASS / EXTERNAL_RECORDED
GIT-NATIVE INDEPENDENT VERIFICATION = NOT AVAILABLE
RECURRING DR PROGRAM = MISSING

RESTORE EXIT = 0
TABLES = 28/28
PRODUCTION ROWS = 17 711
RESTORE ROWS = 17 711
DIFFERENCES = 0
PRODUCTION = UNCHANGED
```

Repozytorium zapisuje wynik izolowanego restore w `03-MIGRACJA/62-ETAP4-E4.1-F-RESTORE-VALIDATION-EXECUTION-LOG.md`. Część lokalnych artefaktów pomocniczych pozostawała na dysku operatora, dlatego wynik ma provenance `EXTERNAL_RECORDED`, a nie niezależną weryfikację Git-native. Luka P1-R-01 dotyczy brakującego cyklicznego programu restore/DR, nie braku pojedynczego testu.

## 6. Wynik finalnego Etapu 3C

Finalny read-only review objął B/U oraz korekty H/J/N/R. Zakres A–V jest wystarczająco zweryfikowany do zamknięcia technicznego Etapu 3.

### B — RBAC / MFA

```text
BACKEND RBAC ENFORCEMENT = AS-IS CONFIRMED
MFA SECRET ENCRYPTION = AS-IS CONFIRMED
MFA KEY FALLBACK TO AUTH_SECRET = CONFIRMED
RBAC / MFA DEDICATED TEST COVERAGE = MISSING
TOTP REPLAY PROTECTION = MISSING / P2
MFA RECOVERY = MISSING / P2
```

### U — Multi-game architecture

```text
COMMON MATCH RUNTIME = TARGET ONLY / NOT IMPLEMENTED
CURRENT GAME IMPLEMENTATIONS = ARCHITECTURALLY DIVERGENT
GAME TYPE DICTIONARY = INCONSISTENT
DOCUMENTATION TARGET CLASSIFICATION = CORRECT
```

### Konsolidacja

```text
A-V SUFFICIENTLY VERIFIED = YES
NEW P0 = NONE
FINAL P1 = 10
TECHNICAL AUDIT = CLOSED
CODE CHANGES = NONE
```

## 7. Backlog po zamknięciu audytu

### Implementation backlog

- współdzielony/atomowy rate-limit store,
- realtime backplane albo dowiedziona topologia sticky routing,
- CAS/expected version/fencing dla Checkers,
- produkcyjny fail-closed dla osobnych kluczy message/attachment/MFA,
- trwała persystencja i recovery Gomoku,
- atomowy i idempotentny tournament advancement,
- realny readiness z DB/dependency checks,
- kanoniczny słownik game types,
- wspólny Match Runtime jako TARGET — dopiero po osobnej autoryzacji implementacji.

### Test backlog

- dedykowane testy backendowego RBAC i MFA,
- multi-instance rate-limit i realtime,
- multi-writer Checkers,
- restart/reconnect/multi-instance Gomoku,
- równoległy report i podwójny awans turniejowy,
- fail-closed kluczy kryptograficznych,
- health/readiness przy awarii DB,
- contract tests kanonicznego słownika gier.

### Operational evidence backlog

- cykliczny restore/DR, mierzone RPO/RTO i historia wykonań,
- dowód wieloinstancyjny przed horizontal scaling,
- readiness/metrics/tracing/alerting dla krytycznych awarii,
- dowód separacji i rotacji kluczy,
- dowód DB-role separation lub zewnętrznego immutable sinka dla audit trail,
- pełniejsze dowody operacyjne Messaging/Chat poza potwierdzoną ścieżką attachments.

Backlog jest rejestrem przyszłych prac. Freeze i brak autoryzacji zabraniają obecnie implementacji.

## 8. Decyzja

```text
TECHNICAL AUDIT A-V 3A-3C = CLOSED
DOCUMENTATION DELTA REVIEW = PENDING FINAL READBACK
NEW P0 = NONE
FINAL P1 = 10
CODE CHANGES = NONE
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
REVIEWED DESIGN GATE = HOLD
ADR-V3-012 PRIVACY/LEGAL = PENDING HUMAN OWNER
FREEZE = ACTIVE
```


Po tym commicie wymagany jest wyłącznie krótki documentation delta readback. Dopiero jego pozytywny wynik może zmienić `DOCUMENTATION DELTA REVIEW` z `PENDING FINAL READBACK` na `PASS`.

# ETAP 4 — E4.1-H Change Authorization, Controlled Execution Window, Rollback and Cleanup Contract

Data przygotowania: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **CONTRACT READY / NO AUTHORIZATION GRANTED / FREEZE ACTIVE**  
Production V3: **NO-GO**

> Dokument definiuje formalny kontrakt przyszłego wykonania E4.1-H. Nie udziela zgody na implementację kolektora, zmianę planu Render, utworzenie One-Off Job, uruchomienie procesu, wznowienie aplikacji, deploy, restart, zmianę environment, odczyt sekretów ani operację na bazie produkcyjnej.

## 1. Stan wejściowy

```text
F0–F7 = PASS
E4.1-H = PENDING / SAFE HOLD
COLLECTOR DESIGN = READY
COLLECTOR IMPLEMENTATION = NOT AUTHORIZED
RENDER FREE PLAN = CURRENTLY NOT CAPABLE
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Dokument nadrzędny nie zmienia żadnego z tych statusów.

## 2. Dokumenty obowiązujące

| Nr | Dokument | Rola |
|---:|---|---|
| 62 | Restore Validation — Execution Log | kanoniczny dziennik E4.1 |
| 63 | Fresh Crypto Decryptability — Execution Plan | cel, zakres i PASS/ABORT |
| 64 | Crypto Diagnostic Architecture Decision | zaakceptowany wzorzec architektoniczny |
| 65 | Operator Runbook | kroki R0–R10 |
| 66 | Evidence Contract and Review Checklist | E0–E5 i schema wyniku |
| 67 | Render Provider Capability Assessment | ograniczenia planu Free |
| 68 | Diagnostic Collector Design Specification | kontrakt przyszłej implementacji |

Sprzeczność między dokumentami oznacza `HOLD` do czasu rozstrzygnięcia w nowym ADR lub poprawce dokumentacyjnej.

## 3. Cel kontraktu

Kontrakt ma zapewnić, że przyszłe E4.1-H:

- ma jawnego właściciela biznesowego i technicznego,
- ma ograniczony zakres,
- ma dokładnie zdefiniowane okno,
- nie uruchamia normalnej aplikacji,
- nie ujawnia ani nie przenosi sekretów,
- nie wykonuje mutacji,
- jest możliwe do natychmiastowego zatrzymania,
- ma sprawdzony rollback i cleanup,
- nie uzyskuje PASS bez niezależnego review.

## 4. Zasada rozdzielenia zgód

Wymagane są trzy niezależne decyzje:

### A1 — Authorization to Implement

Pozwala wyłącznie przygotować kolektor na izolowanej gałęzi i przeprowadzić testy non-production.

Nie pozwala zmieniać Render, budować produkcyjnego artefaktu, wykonywać deployu, uruchamiać kolektora przeciw produkcji ani zdejmować freeze.

### A2 — Authorization to Prepare Provider Capability

Pozwala wyłącznie na jawnie opisane przygotowanie techniczne dostawcy, np. zatwierdzoną zmianę planu lub dostępność One-Off Jobs.

Nie pozwala uruchamiać joba, wznawiać normalnej aplikacji, zmieniać environment ani wykonywać testu.

Jeżeli Render nie umożliwia zmiany planu bez niekontrolowanego startu normalnej usługi, A2 nie może otrzymać APPROVED.

### A3 — Authorization to Execute E4.1-H

Pozwala wykonać dokładnie jeden zatwierdzony run dla jednego `runId`, jednego artefaktu i jednego `startCommand`.

A3 jest nieważne bez zamkniętych A1, A2 i wszystkich preconditions.

```text
A1 does not imply A2
A2 does not imply A3
A3 is single-use
```

## 5. Stany kontraktu

| Stan | Znaczenie |
|---|---|
| `DRAFT` | przygotowanie bez skutków operacyjnych |
| `REVIEW` | kompletność sprawdzana, brak zgody |
| `APPROVED` | zgoda na dokładny zakres i okno |
| `READY` | wszystkie preconditions potwierdzone bezpośrednio przed run |
| `EXECUTING` | jeden zatwierdzony proces trwa |
| `CLEANUP` | proces zakończony, trwa kontrola pozostałości |
| `REVIEWING_EVIDENCE` | wynik kandydacki, jeszcze bez finalnego PASS |
| `CLOSED_PASS` | E0–E5 kompletne i reviewer zatwierdził PASS |
| `CLOSED_FAIL` | kompletny test wykazał failure |
| `NOT_VERIFIED` | test lub dowód niekompletny |
| `ABORTED` | naruszenie bramki bezpieczeństwa |
| `INCIDENT` | możliwy wyciek, mutacja lub naruszenie freeze |
| `EXPIRED` | minęło zatwierdzone okno lub zmienił się artefakt/kontrakt |

Po `EXPIRED`, `ABORTED` lub `INCIDENT` wymagany jest nowy rekord autoryzacji. Nie wolno wznawiać starego runu.

## 6. Role i rozdzielenie odpowiedzialności

| Rola | Odpowiedzialność |
|---|---|
| Change owner | definiuje cel i uzasadnienie |
| Change authorizer | zatwierdza A1/A2/A3 oraz okno |
| Technical operator | wykonuje wyłącznie zatwierdzone kroki |
| Abort owner | może natychmiast zatrzymać proces |
| Security reviewer | sprawdza sekrety, output i izolację |
| Database/operations reviewer | sprawdza target, read-only, rollback i cleanup |
| Evidence custodian | zapisuje privacy-safe artefakty i chain of custody |

Minimalne zasady:

- operator nie może samodzielnie przyznać finalnego PASS,
- authorizer nie może zatwierdzać brakujących danych jako `TBD`,
- reviewer nie może zastąpić braku dowodu deklaracją operatora,
- rola Abort owner musi być aktywna przez całe okno,
- jeśli jedna osoba pełni kilka ról, konflikt musi być jawnie zapisany, a finalny PASS wymaga co najmniej jednego niezależnego review.

## 7. Rekord autoryzacji

Wymagane pola:

```text
CHANGE_ID=
RUN_ID=
AUTHORIZATION_VERSION=
A1_IMPLEMENTATION=APPROVED|REJECTED|NOT_REQUESTED
A2_PROVIDER_PREPARATION=APPROVED|REJECTED|NOT_REQUESTED
A3_EXECUTION=APPROVED|REJECTED|NOT_REQUESTED
CHANGE_OWNER=
CHANGE_AUTHORIZER=
TECHNICAL_OPERATOR=
ABORT_OWNER=
SECURITY_REVIEWER=
DATABASE_OPERATIONS_REVIEWER=
EVIDENCE_CUSTODIAN=
SCOPE=
EXCLUSIONS=
SOURCE_SHA=
SCRIPT_BLOB_SHA=
ARTIFACT_ID=
START_COMMAND_SHA256=
TARGET_CLASS=
WINDOW_START_UTC=
WINDOW_END_UTC=
MAX_JOB_RUNTIME_SECONDS=
ROLLBACK_OWNER=
CLEANUP_OWNER=
APPROVED_AT_UTC=
AUTHORIZATION_EXPIRES_AT_UTC=
```

Puste pole wymagane, placeholder, niespójny SHA albo niejednoznaczna rola oznacza `STOP`.

## 8. Niezmienność zakresu

A3 obejmuje wyłącznie jeden `runId`, source SHA, script blob SHA, artifact ID, exact start command hash, target class, okno i proces diagnostyczny.

Zmiana dowolnego elementu unieważnia A3.

Nie wolno w czasie okna:

- poprawiać komendy,
- zmieniać environment,
- przełączać targetu,
- używać innego obrazu,
- ponawiać runu bez nowego `runId`,
- otwierać Shell w celu diagnostyki,
- uruchamiać dodatkowego procesu pomocniczego.

## 9. Preconditions do A1 — implementacja

- [ ] dokument 68 zatwierdzony,
- [ ] schema `e4.1-h-evidence-v2` zatwierdzona,
- [ ] izolowana gałąź wskazana,
- [ ] implementacja oddzielona od PR #26,
- [ ] brak automatycznego deployu,
- [ ] plan unit/integration/static tests zatwierdzony,
- [ ] testy wyłącznie na non-production,
- [ ] security i DB/operations reviewer przypisani.

Niespełnienie warunku = A1 `REJECTED/HOLD`.

## 10. Preconditions do A2 — provider preparation

- [ ] ponownie sprawdzona aktualna dokumentacja Render,
- [ ] plan obsługujący One-Off Jobs potwierdzony,
- [ ] koszt i billing owner zatwierdzone,
- [ ] wpływ upgrade/downgrade znany,
- [ ] potwierdzone, że przygotowanie nie wznowi normalnej aplikacji,
- [ ] potwierdzone, że można utrzymać usługę bazową w wymaganym stanie,
- [ ] plan powrotu do zatwierdzonego planu przygotowany,
- [ ] znane ograniczenia downgrade i rozliczenia,
- [ ] environment pozostaje bez zmian,
- [ ] brak potrzeby ujawniania sekretów.

Niepewność dotycząca automatycznego startu usługi = A2 `REJECTED/HOLD`.

## 11. Preconditions do A3 — wykonanie

### Authorization

- [ ] A1 zamknięte z review,
- [ ] A2 zamknięte z provider capability PASS,
- [ ] A3 podpisane i niewygasłe,
- [ ] role dostępne,
- [ ] jednoznaczny run ID.

### Identity

- [ ] source SHA zgodny,
- [ ] script blob SHA zgodny,
- [ ] artifact ID zgodny,
- [ ] start command hash zgodny,
- [ ] target class zgodna.

### Isolation

- [ ] normalna aplikacja pozostaje zawieszona,
- [ ] Auto-Deploy pozostaje wyłączone,
- [ ] brak aktywnego deployu/restartu,
- [ ] brak listenera i writera,
- [ ] brak background jobs,
- [ ] dokładnie jeden proces diagnostyczny.

### Database safety

- [ ] target identity guard gotowy,
- [ ] read-only transaction wymuszona,
- [ ] statyczny SELECT-only review zakończony,
- [ ] statement/lock/idle timeout zatwierdzone,
- [ ] rollback failure path przetestowany non-production.

### Evidence and cleanup

- [ ] log redaction review zakończony,
- [ ] provider job tracking gotowy,
- [ ] cleanup checklist gotowa,
- [ ] retention location gotowa,
- [ ] incident channel i owner określeni.

Dowolne `NO`, `UNKNOWN` lub brak dowodu = `STOP/HOLD`.

## 12. Kontrolowane okno wykonania

Okno musi zawierać jawny początek i koniec UTC, maksymalny runtime, okres preflight, wykonania, cleanup, evidence review i rezerwę na abort.

Zasady:

1. A3 staje się ważne dopiero w `WINDOW_START_UTC`.
2. Po `WINDOW_END_UTC` przechodzi automatycznie w `EXPIRED`.
3. Job musi mieć limit krótszy niż pozostały czas okna.
4. Brak czasu na pełny cleanup oznacza, że runu nie wolno rozpoczynać.
5. Spóźniony start wymaga nowego okna.
6. Nie wolno rozszerzać okna ustnie podczas wykonania.
7. Zmiana planu dostawcy i właściwy run muszą być rozdzielone bramką kontrolną; nie wolno automatycznie przechodzić z A2 do A3.

## 13. Sekwencja wykonawcza w oknie

```text
T0  authorization validity check
T1  freeze and service baseline capture
T2  source/script/artifact/command identity check
T3  provider capability and isolation check
T4  exact one-off diagnostic start
T5  DB identity + read-only precheck
T6  MFA -> attachments -> messages
T7  aggregate JSON + exit code
T8  mandatory ROLLBACK + client close
T9  provider job termination confirmation
T10 cleanup and freeze baseline confirmation
T11 independent evidence review
T12 final decision
```

Przejście do kolejnego punktu wymaga PASS poprzedniego. Ścieżka ABORT przechodzi bezpośrednio do rollback, cleanup i incident assessment.

## 14. Definicja rollback

Rollback E4.1-H nie oznacza cofania danych, ponieważ dozwolony run nie może wykonać mutacji.

Rollback obejmuje:

1. `ROLLBACK` aktywnej transakcji,
2. zamknięcie klienta DB,
3. zakończenie albo anulowanie One-Off Job,
4. potwierdzenie braku procesu diagnostycznego,
5. potwierdzenie braku normalnej aplikacji,
6. potwierdzenie braku deployu/restartu,
7. potwierdzenie niezmienionego environment,
8. przywrócenie zatwierdzonego stanu planu wyłącznie, jeśli zostało osobno autoryzowane i zweryfikowane jako bezpieczne,
9. przywrócenie freeze baseline,
10. zapis privacy-safe wyniku rollbacku.

Brak potwierdzonego punktu = wynik maksymalnie `NOT_VERIFIED`.

## 15. Rollback trigger matrix

| Trigger | Działanie natychmiastowe | Klasyfikacja |
|---|---|---|
| source/script/artifact mismatch | nie uruchamiać / anulować | ABORT |
| command hash mismatch | nie uruchamiać | ABORT |
| target mismatch | ROLLBACK, close, cancel | ABORT |
| read-only niepotwierdzone | ROLLBACK, close, cancel | ABORT |
| normal app lub listener startuje | cancel i baseline recovery | ABORT / possible incident |
| writer/background job aktywny | cancel i mutation assessment | INCIDENT |
| decrypt failure | ROLLBACK, zachować safe counters | CLOSED_FAIL po kompletnym review |
| unsafe output | zatrzymać publikację, revoke access, incident handling | INCIDENT |
| job przekracza max runtime | cancel | NOT_VERIFIED / ABORT |
| provider interruption | rollback/cancel, cleanup | NOT_VERIFIED |
| cleanup niepotwierdzony | nie przyznawać PASS | NOT_VERIFIED |
| mutation detected | natychmiastowy incident, preserve evidence | INCIDENT |
| freeze breach | zatrzymać wszystkie dalsze działania | INCIDENT |

## 16. Cleanup contract

### C1 — Database

- [ ] transakcja zakończona `ROLLBACK`,
- [ ] klient i pool zamknięte,
- [ ] aktywna sesja diagnostyczna nie istnieje,
- [ ] mutation count = 0,
- [ ] brak pozostawionej blokady.

### C2 — Process

- [ ] job ma stan terminalny,
- [ ] proces pomocniczy nie działa,
- [ ] nie uruchomiono normalnego entrypointu,
- [ ] listener/writer/background jobs = false,
- [ ] nie pozostał shell/session.

### C3 — Provider configuration

- [ ] environment bez zmian,
- [ ] secret values bez zmian,
- [ ] Auto-Deploy zgodny z baseline,
- [ ] suspended/running state zgodny z zatwierdzonym baseline,
- [ ] plan/billing state zgodny z osobną decyzją A2,
- [ ] brak nowego trwałego zasobu.

### C4 — Repository and artifact

- [ ] PR #26 bez zmian i niescalony,
- [ ] brak nieautoryzowanego deploy commit,
- [ ] temporary branch/artifact disposition zapisane,
- [ ] kod kolektora nie pozostaje w aktywnym obrazie bez osobnej decyzji,
- [ ] source/artifact chain of custody kompletne.

### C5 — Evidence

- [ ] machine JSON zachowany,
- [ ] exit code zachowany,
- [ ] provider run/job ID zachowany,
- [ ] log przeszedł privacy review,
- [ ] nie zapisano plaintextu ani sekretu,
- [ ] ograniczenia i odstępstwa zapisane,
- [ ] reviewerzy podpisali wynik.

Finalne `cleanup=PASS` wymaga C1–C5 = PASS.

## 17. Kontrola sekretów

Dozwolone jest użycie istniejących sekretów przez zatwierdzony runtime, zapis statusu `PRESENT/NOT_VERIFIED` i funkcjonalne potwierdzenie przez AES-GCM authentication.

Zabronione są reveal, copy, export, screenshot wartości, hash lub fingerprint sekretu, log długości/prefiksu/sufiksu, zapis do pliku/schowka, przekazanie w CLI, debug dump environment i rotacja w ramach E4.1-H.

Podejrzenie ujawnienia oznacza `INCIDENT`, niezależnie od funkcjonalnego wyniku testu.

## 18. Evidence chain of custody

Każdy artefakt musi mieć identyfikator, źródło, twórcę/proces, timestamp UTC, SHA-256 pliku przy eksporcie, klasyfikację danych, miejsce retencji i reviewer decision.

Nie wolno ręcznie przepisywać SHA source/script/artifact, hashy datasetu, liczników, exit code ani run/job ID.

Screenshot może być dowodem pomocniczym, lecz nie zastępuje machine-generated JSON i metadanych dostawcy.

## 19. Finalna decyzja

### CLOSED_PASS

Wymaga A1–A3 zgodnych, E0–E5 PASS, provider capability PASS, exact identity, read-only PASS, pełnego coverage, zero failure, zero mutation, rollback PASS, cleanup C1–C5 PASS oraz security i DB/operations review PASS.

### CLOSED_FAIL

Wymaga kompletnego, bezpiecznego testu, który jednoznacznie wykazał decrypt lub integrity failure. Niepełny test otrzymuje `NOT_VERIFIED`.

### NOT_VERIFIED

Stosowane przy przerwaniu, niepełnym evidence, provider failure, niepotwierdzonym cleanupie albo braku niezależnego review.

### ABORTED / INCIDENT

Ma pierwszeństwo przed wynikiem funkcjonalnym. Nawet wszystkie odszyfrowania zakończone sukcesem nie mogą dać PASS po naruszeniu identity, read-only, secret boundary lub freeze.

## 20. Szablon decyzji zamykającej

```text
CHANGE_ID=
RUN_ID=
AUTHORIZATION_STATE=
WINDOW_RESULT=
PROVIDER_CAPABILITY=
SOURCE_IDENTITY=
SCRIPT_IDENTITY=
ARTIFACT_IDENTITY=
COMMAND_IDENTITY=
TARGET_IDENTITY=
READ_ONLY=
MESSAGES=
ATTACHMENTS=
MFA=
DATABASE_MUTATIONS=
ROLLBACK=
C1_DATABASE_CLEANUP=
C2_PROCESS_CLEANUP=
C3_PROVIDER_CLEANUP=
C4_REPOSITORY_ARTIFACT_CLEANUP=
C5_EVIDENCE_CLEANUP=
SECURITY_REVIEW=
DATABASE_OPERATIONS_REVIEW=
LIMITATIONS=
INCIDENT_ID=
FINAL_DECISION=CLOSED_PASS|CLOSED_FAIL|NOT_VERIFIED|ABORTED|INCIDENT
DECIDED_BY=
DECIDED_AT_UTC=
```

## 21. Bieżący rekord — brak zgody

```text
A1_IMPLEMENTATION = NOT_AUTHORIZED
A2_PROVIDER_PREPARATION = NOT_AUTHORIZED
A3_EXECUTION = NOT_AUTHORIZED
CONTROLLED_WINDOW = NOT_SCHEDULED
ROLLBACK = DESIGN_READY / NOT_EXECUTED
CLEANUP = DESIGN_READY / NOT_EXECUTED
E4.1-H = PENDING / SAFE HOLD
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER = UNCHANGED
SECRETS = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Dokument jest kontraktem przyszłej kontroli. Nie jest zgodą na wykonanie żadnego działania.


## 22. Risk governance dependency — dokument 70

Autoryzacja A1, A2 lub A3 wymaga aktualnego przeglądu:

- `70-ETAP4-E4.1-H-RISK-REGISTER-AND-IMPLEMENTATION-READINESS-MATRIX.md`.

Warunki minimalne:

- każde ryzyko CRITICAL ma nazwanego ownera,
- blocker związany z daną autoryzacją ma treatment decision,
- kontrola użyta do obniżenia score ma evidence i stan EFFECTIVE,
- time-bound ryzyko bazy zostało formalnie rozstrzygnięte,
- readiness odpowiedniej warstwy nie ma statusu BLOCKED.

Obecnie:

```text
CRITICAL RISKS = OPEN
NAMED RISK OWNERS = PENDING
A1-A3 READINESS = BLOCKED
A1-A3 = NOT AUTHORIZED
```


## 23. Database continuity prerequisite — dokument 71

Dla ryzyka `RSK-E41H-009` obowiązuje:

- `71-ETAP4-E4.1-H-RENDER-POSTGRES-CONTINUITY-AND-RETENTION-PLAN.md`.

A2 nie może otrzymać APPROVED, jeżeli:

- nie wybrano wariantu ciągłości,
- nie przypisano named Data owner i Provider/Billing owner,
- nie zatwierdzono RPO/RTO,
- nie rozstrzygnięto ochrony danych przed expiry,
- brakuje świeżego recovery evidence albo formalnej decyzji risk ownera,
- upgrade planu mógłby niekontrolowanie wznowić aplikację.

A3 nie może otrzymać APPROVED bez zamknięcia tej bramki w A2.

```text
CONTINUITY PLAN = READY
CONTINUITY OPTION = PENDING
RSK-E41H-009 = OPEN / CRITICAL / TIME-BOUND
A2 = NOT AUTHORIZED
A3 = NOT AUTHORIZED
```

Dokument 71 nie przyznaje A1, A2 ani A3.

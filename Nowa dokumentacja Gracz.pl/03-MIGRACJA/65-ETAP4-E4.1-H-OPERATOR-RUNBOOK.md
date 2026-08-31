# ETAP 4 — E4.1-H Fresh Crypto Decryptability — Operator Runbook

Data przygotowania: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **RUNBOOK READY / DO NOT EXECUTE / FREEZE ACTIVE / PROVIDER PATH NOT YET APPROVED**  
Production V3: **NO-GO**

> Runbook opisuje przyszłe wykonanie kontroli. Nie jest zgodą na uruchomienie. Każdy krok oznaczony jako execution wymaga wcześniejszej formalnej autoryzacji i potwierdzenia możliwości platformy. Na obecnym etapie wolno wykonywać wyłącznie review dokumentacyjne.

## 1. Cel

Wykonać jednorazowy, świeży, privacy-safe test decryptability aktualnych danych v1 z użyciem rzeczywistego runtime key material, bez:

- eksportu sekretów,
- uruchomienia normalnej aplikacji,
- publicznego listenera,
- writerów i background jobs,
- mutacji bazy,
- ujawnienia plaintextu,
- zmiany Render Environment,
- naruszenia freeze.

## 2. Zakres danych

Oczekiwany zakres na podstawie fresh evidence:

| Domena | Total | Zakres wymagający testu |
|---|---:|---|
| messages | 5 | 2 encrypted pairs + 3 expected legacy passthrough |
| attachments | 2 | 2 encrypted, legacy AAD |
| MFA | 0 | N/A, potwierdzić count 0 |

W dniu wykonania liczby muszą zostać ponownie odczytane. Nie wolno wymuszać oczekiwanych wartości ani ignorować różnicy.

## 3. Role

| Rola | Odpowiedzialność |
|---|---|
| Change authorizer | zatwierdza wąskie okno i exact scope |
| Technical operator | wykonuje zatwierdzone kroki bez odstępstw |
| Security observer | potwierdza brak secret/plaintext leakage |
| Evidence reviewer | ocenia kompletność wyniku i cleanup |
| Abort owner | ma prawo natychmiast zatrzymać proces |
| Documentation owner | zapisuje wyłącznie privacy-safe wynik |

Jedna osoba może pełnić kilka ról w małym projekcie, ale role i decyzje muszą być jawnie zapisane.

## 4. Twarde preconditions

Przed rozpoczęciem execution wszystkie pola muszą być `PASS`:

- [ ] formalna autoryzacja E4.1-H istnieje,
- [ ] metoda provider-side została technicznie potwierdzona,
- [ ] proces nie startuje normalnego entrypointu,
- [ ] proces nie otwiera portu HTTP,
- [ ] proces nie uruchamia writerów/jobs/consumers,
- [ ] secrets pozostają w provider environment,
- [ ] żaden operator nie musi reveal/copy wartości sekretu,
- [ ] exact diagnostic source SHA zapisany,
- [ ] exact image/artifact identity zapisane,
- [ ] freeze/mutation lock nadal aktywny,
- [ ] `Auto-Deploy = Off`,
- [ ] brak aktywnego deployu/restartu/rollbacku,
- [ ] target DB identity contract zatwierdzony,
- [ ] DB read-only guard zatwierdzony,
- [ ] output schema z dokumentu 66 zaakceptowany,
- [ ] cleanup/abort owner dostępny.

Dowolne `NO`, `UNKNOWN` albo brak dowodu = `STOP / HOLD`.

## 5. Zabronione przygotowanie

Nie wolno przygotowywać testu poprzez:

- reveal lub kopiowanie wartości Render Environment,
- plik `.env` z realnymi sekretami,
- argumenty CLI zawierające secrets/URL credentials,
- zmianę normalnego start command,
- chwilowe uruchomienie serwisu „tylko na próbę”,
- ręczne wklejenie ciphertext/plaintext,
- dodanie endpointu diagnostycznego do publicznej aplikacji,
- wyłączenie SSL lub read-only guard,
- użycie owner/admin credential, jeśli dostępna jest węższa ścieżka,
- wykonanie testu na niezrecenzowanym kodzie.

## 6. Fazy wykonawcze

### R0 — dokumentacyjny HOLD

Stan bieżący:

```text
E4.1-H = PENDING
EXECUTION = NOT AUTHORIZED
FREEZE = ACTIVE
```

Dozwolone są tylko review, doprecyzowanie kontraktów i weryfikacja capability bez uruchamiania procesu.

### R1 — authorization record

Zapisać przed wykonaniem:

- change/run ID,
- data i okno czasowe,
- authorizer,
- operator,
- security observer,
- abort owner,
- exact dozwolony scope,
- działania jawnie wyłączone,
- maksymalny czas trwania,
- expected cleanup state.

Brak pełnego rekordu = `STOP`.

### R2 — provider capability verification

Potwierdzić dokumentacyjnie, że platforma pozwala:

1. uruchomić jednorazowy proces bez normalnego entrypointu,
2. użyć istniejącego secret environment bez reveal/export,
3. nie udostępniać procesu publicznie,
4. zakończyć proces po jednym przebiegu,
5. odróżnić diagnostic process od normalnej aplikacji,
6. sprawdzić jego zakończenie i brak pozostałości.

Weryfikacja capability nie może sama uruchamiać procesu ani zmieniać środowiska.

Wynik:

- `CAPABILITY_CONFIRMED` — przejście do R3,
- `CAPABILITY_NOT_CONFIRMED` — `HOLD`.

### R3 — source and artifact lock

Zapisać:

- repository,
- branch/ref,
- exact commit SHA,
- diagnostic script blob SHA,
- container/image/artifact identity,
- checksum lub immutable identifier,
- review approval.

Wymagania:

- kod nie uruchamia normalnej aplikacji,
- importy nie mają startup side effects,
- skrypt nie wykonuje DDL/DCL/DML,
- logger jest aggregate-only,
- error handler zwraca bezpieczne error codes,
- failure path wykonuje `ROLLBACK`.

Mismatch = `ABORT`.

### R4 — safe environment presence verification

Verifier może raportować wyłącznie:

- `AUTH_SECRET_PRESENT=true/false`,
- presence dedicated legacy key names,
- minimal length boolean,
- wybrany logical v1 source jako klasyfikację, nie wartość,
- `DATABASE_URL_PRESENT=true/false`,
- transport class,
- `MIGRATOR_DATABASE_URL_ABSENT=true/false`.

Nie wolno raportować:

- wartości,
- prefixów/suffixów,
- hashy/fingerprintów sekretów,
- długości dokładnej,
- URL host/user/password,
- fragmentów credentials.

Jeśli konfiguracja nie pozwala jednoznacznie wybrać exact v1 logical root bez wypisywania wartości = `ABORT`.

### R5 — process isolation precheck

Przed połączeniem z DB potwierdzić:

- normal application module nie został zaimportowany,
- HTTP listener nie istnieje,
- scheduler/jobs nie są uruchomione,
- webhook consumers nie są uruchomione,
- process concurrency = 1,
- aplikacyjny mutation path nie jest dostępny,
- process ma zdefiniowany timeout całkowity.

Wynik dozwolony:

`ISOLATION_PRECHECK_PASS`

Inny wynik = `ABORT`.

### R6 — database identity and read-only guard

Kolejność jest obowiązkowa:

1. połączyć się przy wymaganym SSL/transport,
2. rozpocząć `REPEATABLE READ READ ONLY`,
3. ustawić bezpieczny statement timeout,
4. odczytać identity/classification bez credential values,
5. potwierdzić `transaction_read_only = on`,
6. potwierdzić expected database name,
7. dopiero wtedy odczytać encrypted records.

Jeśli jakiekolwiek potwierdzenie nie przechodzi:

- wykonać `ROLLBACK`,
- zwolnić połączenie,
- zwrócić safe error code,
- zakończyć proces bez testu.

### R7 — domain test order

Kolejność:

1. MFA inventory,
2. attachments,
3. messages.

#### R7.1 MFA

Jeżeli total = 0:

- `success=0`,
- `failure=0`,
- `status=N/A`,
- brak decrypt attempt.

Jeżeli total > 0:

- testować exact v1 derivation/AAD,
- sprawdzić wyłącznie syntaktyczną poprawność in-memory,
- nie wypisywać secret.

#### R7.2 Attachments

Dla każdego rekordu:

1. ustalić current/legacy AAD variant z metadanych,
2. decrypt w pamięci,
3. sprawdzić GCM authentication,
4. opcjonalnie sprawdzić expected length/signature in-memory,
5. natychmiast zwolnić buffer,
6. zwiększyć wyłącznie counter.

Jeden failure = domain `FAIL` i aggregate `FAIL`.

#### R7.3 Messages

Dla każdego rekordu:

- oba pola bez `enc:v1:` → expected legacy passthrough counter,
- oba pola z `enc:v1:` → decrypt subject i body,
- mixed encrypted/non-encrypted pair → `FAIL`,
- unknown `enc:vN:` → `FAIL CLOSED`.

Nie mierzyć, nie logować ani nie hashować plaintextu do outputu.

### R8 — result aggregation

Aggregate gate:

- dowolny domain `FAIL` → `FAIL`,
- brak required key lub niepełny test → `NOT_VERIFIED`,
- expected legacy + zero failures → zatwierdzone `PASS`,
- MFA 0 → `N/A`, nie failure.

Wynik musi być zgodny z dokumentem 66.

### R9 — mandatory rollback and process cleanup

Niezależnie od wyniku:

1. wykonać `ROLLBACK`,
2. zamknąć DB client/pool,
3. wyzerować referencje do buforów plaintext,
4. zakończyć proces diagnostyczny,
5. potwierdzić brak procesu potomnego,
6. potwierdzić brak listenera,
7. potwierdzić brak zmiany environment,
8. potwierdzić brak deployu/restartu,
9. potwierdzić brak zmiany danych,
10. potwierdzić stan freeze.

Brak cleanup evidence = wynik maksymalnie `NOT_VERIFIED`.

### R10 — evidence review

Reviewer sprawdza:

- run identity,
- exact SHA,
- full coverage,
- counters,
- zero failures,
- read-only proof,
- output safety,
- cleanup proof,
- brak odstępstw.

Operator nie może samodzielnie podnieść statusu do finalnego PASS bez przeglądu evidence contract.

## 7. Dozwolony output

Minimalny wynik:

```json
{
  "test": "e4.1-h-fresh-crypto-decryptability",
  "runId": "<non-secret-id>",
  "sourceSha": "<exact-approved-sha>",
  "readOnly": true,
  "targetIdentity": "EXPECTED_PRODUCTION_DATABASE",
  "isolationPrecheck": "PASS",
  "messages": {
    "total": 5,
    "encryptedRecords": 2,
    "legacyExpected": 3,
    "success": 5,
    "failure": 0,
    "status": "PASS"
  },
  "attachments": {
    "total": 2,
    "currentAad": 0,
    "legacyAad": 2,
    "success": 2,
    "failure": 0,
    "status": "PASS"
  },
  "mfa": {
    "total": 0,
    "success": 0,
    "failure": 0,
    "status": "N/A"
  },
  "databaseMutationCount": 0,
  "cleanup": "PASS",
  "e41hCandidate": "PASS"
}
```

`targetIdentity` jest klasyfikacją, nie hostem ani URL.

## 8. STOP/ABORT matrix

| Zdarzenie | Decyzja | Działanie |
|---|---|---|
| provider capability niepotwierdzona | HOLD | nie uruchamiać |
| potrzeba reveal/copy secret | ABORT | zatrzymać przygotowanie |
| source SHA mismatch | ABORT | nie uruchamiać |
| normal app/listener startuje | ABORT | zakończyć proces |
| target identity mismatch | ABORT | ROLLBACK i exit |
| read-only niepotwierdzone | ABORT | ROLLBACK i exit |
| decrypt failure > 0 | FAIL/ABORT | ROLLBACK, zachować safe counters |
| plaintext/secret w output | SECURITY INCIDENT | zatrzymać, zabezpieczyć i nie publikować logu |
| cleanup niepotwierdzony | NOT_VERIFIED | nie przyznawać PASS |
| nieoczekiwane nowe rows | HOLD | fresh reconciliation/review |
| environment/deploy zmienione | FREEZE BREACH | ABORT i ponowny baseline |

## 9. Incident handling

### Secret exposure

- nie wklejać logu do GitHuba/czatu,
- zatrzymać proces,
- ograniczyć dostęp do artefaktu,
- uruchomić zatwierdzoną procedurę credential rotation,
- powtórzyć baseline po remediacji.

### Plaintext exposure

- traktować jako incydent danych osobowych/poufności,
- nie publikować dowodu,
- usunąć niezatwierdzone kopie zgodnie z polityką,
- przeprowadzić security review przed ponowieniem.

### Mutation detected

- natychmiast zatrzymać test,
- nie wykonywać ad-hoc napraw,
- zebrać read-only incident evidence,
- ocenić backup/restore i restart E4.0/E4.1 baseline.

## 10. Operator worksheet

Przed run:

```text
RUN_ID=
AUTHORIZER=
OPERATOR=
SECURITY_OBSERVER=
ABORT_OWNER=
WINDOW_START=
WINDOW_END=
SOURCE_SHA=
SCRIPT_BLOB_SHA=
ARTIFACT_ID=
EXPECTED_TARGET_CLASS=
PROVIDER_CAPABILITY_PROOF=
FREEZE_STATE=
```

Po run:

```text
ISOLATION_PRECHECK=
READ_ONLY_PROOF=
MESSAGES_TOTAL=
MESSAGES_SUCCESS=
MESSAGES_FAILURE=
ATTACHMENTS_TOTAL=
ATTACHMENTS_SUCCESS=
ATTACHMENTS_FAILURE=
MFA_TOTAL=
MFA_STATUS=
DATABASE_MUTATION_COUNT=
ROLLBACK=
PROCESS_EXIT=
CLEANUP=
FREEZE_STATE_AFTER=
FINAL_CANDIDATE=
REVIEWER_DECISION=
```

Worksheet nie może zawierać sekretów, URL, hosta, usera DB, plaintextu ani ciphertextu.

## 11. Aktualna decyzja

```text
RUNBOOK = READY
EXECUTION = NOT AUTHORIZED
PROVIDER CAPABILITY = PENDING
E4.1-H = PENDING / SAFE HOLD
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER = UNCHANGED
SECRETS = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Następny artefakt: evidence contract i review checklist. Nie wykonywać runbooka przed formalną autoryzacją.


## 11. Governance amendment — dokument 69

Wykonanie kroków R1–R10 podlega dokumentowi:

- `69-ETAP4-E4.1-H-CHANGE-AUTHORIZATION-EXECUTION-WINDOW-ROLLBACK-CLEANUP-CONTRACT.md`.

Runbook nie może zostać rozpoczęty bez:

- `A1 = APPROVED/CLOSED`,
- `A2 = APPROVED/CAPABILITY PASS`,
- niewygasłego `A3 = APPROVED`,
- exact run/source/script/artifact/command identity,
- aktywnego controlled window,
- przypisanych operatora, Abort owner i reviewerów.

Obecnie:

```text
A1-A3 = NOT_AUTHORIZED
RUNBOOK = READY / DO NOT EXECUTE
FREEZE = ACTIVE
```

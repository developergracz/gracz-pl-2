# ETAP 4 — E4.1-H Evidence Contract and Review Checklist

Data przygotowania: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **EVIDENCE CONTRACT READY / DO NOT EXECUTE / FREEZE ACTIVE**  
Production V3: **NO-GO**

> Dokument określa, jaki dowód może zamknąć E4.1-H. Nie autoryzuje testu. Nie zawiera sekretów, plaintextu, ciphertextu ani danych osobowych.

## 1. Cel

Zapewnić, że przyszły wynik E4.1-H będzie:

- kompletny,
- jednoznaczny,
- maszynowo walidowalny,
- privacy-safe,
- powiązany z exact source/artifact,
- potwierdzony jako read-only,
- zweryfikowany po cleanupie,
- odporny na ręczne błędy przepisywania.

## 2. Zasady dowodowe

1. **Brak dowodu nie oznacza PASS.**
2. Historyczny PASS nie jest fresh PASS.
3. Screenshot nie jest źródłem kanonicznym, jeśli istnieje machine-generated artifact.
4. Ręcznie przepisany hash nie jest exact hash evidence.
5. Output zawierający sekret lub plaintext nie może zostać opublikowany.
6. `failure > 0` zawsze blokuje E4.1-H.
7. Brak cleanup proof obniża wynik do `NOT_VERIFIED`.
8. Niezgodność target/source/artifact oznacza `ABORT`.
9. Expected counts są kontrolą, nie wartością wymuszaną.
10. Review musi rozdzielać `test result` od `operator decision`.

## 3. Warstwy evidence

| Poziom | Nazwa | Wymaganie |
|---|---|---|
| E0 | Authorization | run ID, scope, role, okno, zgoda |
| E1 | Identity | source SHA, script blob SHA, artifact ID, target class |
| E2 | Safety | isolation, read-only, no listener/writer, safe output |
| E3 | Functional | pełne counters i decrypt success/failure |
| E4 | Cleanup | rollback, process exit, no leftovers, freeze state |
| E5 | Review | reviewer decision i final status |

Finalny PASS wymaga E0–E5.

## 4. Kanoniczny zestaw artefaktów

### 4.1. Przed run

1. authorization record,
2. provider capability record,
3. source/artifact lock record,
4. approved script review,
5. expected target classification,
6. freeze-state capture,
7. output schema version.

### 4.2. Z run

1. machine-generated JSON result,
2. process exit code,
3. provider run/job identifier,
4. start/end timestamp,
5. read-only/isolation proof fields,
6. privacy-safe error code, jeśli wystąpi.

### 4.3. Po run

1. cleanup confirmation,
2. absence of active diagnostic process,
3. no deploy/restart/environment-change confirmation,
4. freeze-state-after capture,
5. evidence reviewer checklist,
6. final E4.1-H decision.

## 5. Kanoniczny JSON schema — logiczny kontrakt

Wymagane pola:

| Pole | Typ | Wymóg |
|---|---|---|
| `schemaVersion` | string | exact approved version |
| `test` | string | `e4.1-h-fresh-crypto-decryptability` |
| `runId` | string | non-secret, unikalny |
| `capturedAt` | ISO timestamp | UTC |
| `sourceSha` | 40-char hex | exact approved commit |
| `scriptBlobSha` | 40-char hex | exact approved blob |
| `artifactId` | string | immutable/non-secret classification |
| `targetIdentity` | enum | expected classification, bez hosta/URL |
| `readOnly` | boolean | musi być true |
| `transactionIsolation` | string | `REPEATABLE READ` |
| `isolationPrecheck` | enum | `PASS` |
| `normalApplicationStarted` | boolean | musi być false |
| `publicListenerOpened` | boolean | musi być false |
| `writerStarted` | boolean | musi być false |
| `backgroundJobsStarted` | boolean | musi być false |
| `messages` | object | counters/status |
| `attachments` | object | counters/status |
| `mfa` | object | counters/status |
| `databaseMutationCount` | integer | musi być 0 |
| `rollback` | enum | `PASS` |
| `cleanup` | enum | `PASS` |
| `e41hCandidate` | enum | PASS/FAIL/NOT_VERIFIED |

## 6. Domain counters contract

### 6.1. Messages

Wymagane:

- `total`,
- `encryptedRecords`,
- `legacyExpected`,
- `mixedOrUnknown`,
- `success`,
- `failure`,
- `coverage`,
- `status`.

Reguły:

- `total = encryptedRecords + legacyExpected + mixedOrUnknown`,
- `mixedOrUnknown = 0`,
- encrypted subject/body liczą się jako jeden rekord dopiero po sukcesie obu pól,
- `failure = 0`,
- `coverage = 100`.

### 6.2. Attachments

Wymagane:

- `total`,
- `currentAad`,
- `legacyAad`,
- `success`,
- `failure`,
- `coverage`,
- `status`.

Reguły:

- `total = currentAad + legacyAad`,
- `success = total`,
- `failure = 0`,
- `coverage = 100`.

### 6.3. MFA

Wymagane:

- `total`,
- `success`,
- `failure`,
- `coverage`,
- `status`.

Reguły:

- jeśli `total=0`: `status=N/A`, success/failure = 0,
- jeśli `total>0`: success = total, failure = 0, coverage = 100.

## 7. Przykład dozwolonego artefaktu

```json
{
  "schemaVersion": "e4.1-h-evidence-v1",
  "test": "e4.1-h-fresh-crypto-decryptability",
  "runId": "E41H-YYYYMMDD-NNN",
  "capturedAt": "YYYY-MM-DDTHH:MM:SSZ",
  "sourceSha": "0000000000000000000000000000000000000000",
  "scriptBlobSha": "0000000000000000000000000000000000000000",
  "artifactId": "APPROVED_DIAGNOSTIC_ARTIFACT",
  "targetIdentity": "EXPECTED_PRODUCTION_DATABASE",
  "readOnly": true,
  "transactionIsolation": "REPEATABLE READ",
  "isolationPrecheck": "PASS",
  "normalApplicationStarted": false,
  "publicListenerOpened": false,
  "writerStarted": false,
  "backgroundJobsStarted": false,
  "messages": {
    "total": 5,
    "encryptedRecords": 2,
    "legacyExpected": 3,
    "mixedOrUnknown": 0,
    "success": 5,
    "failure": 0,
    "coverage": 100,
    "status": "PASS"
  },
  "attachments": {
    "total": 2,
    "currentAad": 0,
    "legacyAad": 2,
    "success": 2,
    "failure": 0,
    "coverage": 100,
    "status": "PASS"
  },
  "mfa": {
    "total": 0,
    "success": 0,
    "failure": 0,
    "coverage": 100,
    "status": "N/A"
  },
  "databaseMutationCount": 0,
  "rollback": "PASS",
  "cleanup": "PASS",
  "e41hCandidate": "PASS"
}
```

Zera w przykładowych SHA są placeholderem i nie mogą zostać użyte w realnym evidence.

## 8. Dozwolone i zabronione pola

### Dozwolone

- exact Git/source/blob SHA,
- provider run/job ID bez credential values,
- timestamp,
- licznik,
- boolean,
- enum status/error code,
- target classification,
- exit code,
- ciphertext dataset SHA-256 wyłącznie opcjonalnie i tylko jako machine-captured correlation evidence.

### Zabronione

- secret value,
- secret prefix/suffix,
- secret hash lub fingerprint,
- connection string,
- DB password,
- DB hostname/user, jeśli nie jest niezbędny i zatwierdzony,
- plaintext wiadomości,
- subject/body,
- attachment bytes,
- MFA secret,
- AAD,
- IV/tag/ciphertext,
- user ID, login, e-mail i inne PII,
- pełny process environment,
- stack trace zawierający wartości runtime.

## 9. Opcjonalny ciphertext correlation contract

Jeżeli exact runtime-versus-restore ciphertext comparison jest technicznie dostępne bez wypisywania ciphertext:

- użyć identycznego, zrecenzowanego algorytmu po obu stronach,
- uwzględnić stabilne sortowanie i dokładny binary/text encoding,
- capture wykonać maszynowo do artefaktu,
- nie przepisywać hashy ręcznie,
- porównać długość 64 hex i equality,
- nie mylić ciphertext fingerprintu z fingerprintem sekretu,
- mismatch = `HOLD / INVESTIGATE`, nie automatyczny decrypt failure.

Brak tej korelacji musi być jawnie opisany jako limitation, jeśli platforma jej nie udostępnia.

## 10. Safe error taxonomy

Dozwolone kody:

- `PROVIDER_CAPABILITY_NOT_CONFIRMED`,
- `SOURCE_IDENTITY_MISMATCH`,
- `ARTIFACT_IDENTITY_MISMATCH`,
- `ISOLATION_PRECHECK_FAILED`,
- `TARGET_IDENTITY_MISMATCH`,
- `READ_ONLY_NOT_CONFIRMED`,
- `KEY_CONFIGURATION_NOT_VERIFIED`,
- `MESSAGE_DECRYPT_FAILURE`,
- `ATTACHMENT_DECRYPT_FAILURE`,
- `MFA_DECRYPT_FAILURE`,
- `UNEXPECTED_DATASET_SHAPE`,
- `ROLLBACK_NOT_CONFIRMED`,
- `CLEANUP_NOT_CONFIRMED`,
- `UNSAFE_OUTPUT_DETECTED`,
- `UNKNOWN_SAFE_FAILURE`.

Error nie może zawierać dynamicznej wartości po znaku `=`, URL, SQL payload ani secret fragment.

## 11. Automatyczne reguły decyzji

### PASS candidate

Wszystkie:

- identity exact,
- isolation PASS,
- readOnly true,
- expected/full domain coverage,
- all decrypt failures = 0,
- mutation count = 0,
- rollback PASS,
- cleanup PASS,
- safe output PASS.

### FAIL

Dowolne:

- poprawny i kompletny test wykazał decrypt failure > 0,
- mixed/unknown crypto format w oczekiwanym zakresie,
- payload integrity validation failure.

### NOT_VERIFIED

Dowolne:

- test nie objął pełnego zakresu,
- brak key material/config presence,
- brak cleanup proof,
- provider/process interruption,
- niejednoznaczny wynik.

### ABORT

Dowolne:

- target/source/artifact mismatch,
- brak read-only,
- normal application/writer/listener wystartował,
- secret/plaintext leakage,
- mutation/freeze breach.

## 12. Review checklist

### A. Authorization

- [ ] run ID istnieje,
- [ ] operator i authorizer zapisani,
- [ ] scope zgodny,
- [ ] okno zgodne,
- [ ] brak nieautoryzowanego rozszerzenia.

### B. Identity

- [ ] source SHA ma 40 znaków hex,
- [ ] script blob SHA ma 40 znaków hex,
- [ ] oba SHA odpowiadają zatwierdzonym artefaktom,
- [ ] artifact ID jest immutable/non-secret,
- [ ] target classification jest oczekiwana.

### C. Isolation and safety

- [ ] normal app = false,
- [ ] listener = false,
- [ ] writer = false,
- [ ] background jobs = false,
- [ ] readOnly = true,
- [ ] isolation = REPEATABLE READ,
- [ ] mutation count = 0.

### D. Functional coverage

- [ ] messages equation poprawne,
- [ ] attachments equation poprawne,
- [ ] MFA logic poprawne,
- [ ] coverage 100%,
- [ ] failure 0,
- [ ] statusy zgodne z counters.

### E. Output privacy

- [ ] brak secret values/fingerprints,
- [ ] brak plaintext,
- [ ] brak ciphertext/IV/tag/AAD,
- [ ] brak connection strings,
- [ ] brak PII,
- [ ] error codes safe.

### F. Cleanup

- [ ] ROLLBACK PASS,
- [ ] DB client closed,
- [ ] diagnostic process exited,
- [ ] no leftover process,
- [ ] no environment change,
- [ ] no deploy/restart,
- [ ] freeze state potwierdzony.

### G. Final review

- [ ] machine artifact zachowany,
- [ ] screenshot nie jest jedynym źródłem,
- [ ] limitation jawnie zapisane,
- [ ] reviewer decision podpisana,
- [ ] dziennik nr 62 zaktualizowany,
- [ ] E4.1 manifest zaktualizowany.

## 13. Review decision template

```text
RUN_ID:
EVIDENCE_SCHEMA:
SOURCE_SHA:
SCRIPT_BLOB_SHA:
TARGET_CLASS:
E0_AUTHORIZATION: PASS|FAIL
E1_IDENTITY: PASS|FAIL
E2_SAFETY: PASS|FAIL
E3_FUNCTIONAL: PASS|FAIL
E4_CLEANUP: PASS|FAIL
E5_REVIEW: PASS|FAIL
LIMITATIONS:
FINAL_DECISION: PASS|FAIL|NOT_VERIFIED|ABORT
REVIEWER:
REVIEWED_AT:
```

## 14. Retencja

Do repozytorium wolno zapisać:

- privacy-safe JSON,
- review decision,
- run/job IDs,
- exact source/blob SHA,
- status i counters,
- limitation i cleanup result.

Poza repo/provider retention nie należy utrzymywać:

- raw process environment,
- nieprzefiltrowanych logów,
- transient plaintext buffers,
- lokalnych kopii sekretów,
- niezrecenzowanych debug artifacts.

## 15. Aktualna decyzja

```text
EVIDENCE CONTRACT = READY
REVIEW CHECKLIST = READY
EXECUTION EVIDENCE = NOT COLLECTED
E4.1-H = PENDING / SAFE HOLD
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER = UNCHANGED
SECRETS = UNCHANGED
PRODUCTION V3 = NO-GO
```

Następny krok dokumentacyjny: połączyć dokumenty 63–66 z kanonicznym dziennikiem E4.1 i zweryfikować cały łańcuch commitów. Żaden krok operacyjny nie jest autoryzowany.


## 16. Amendment — evidence schema v2

Dokument `68-ETAP4-E4.1-H-DIAGNOSTIC-COLLECTOR-DESIGN-SPECIFICATION.md` wprowadza dokładniejszy schemat `e4.1-h-evidence-v2`.

Zmiana semantyczna dla wiadomości:

- pole v1 `success` zostaje rozdzielone na `decryptSuccess`, `legacyReadable` i `readSuccess`,
- `decryptSuccess` obejmuje wyłącznie rekordy `enc:v1`,
- `legacyReadable` obejmuje rekordy legacy niewymagające odszyfrowania,
- `readSuccess` potwierdza pełną czytelność aplikacyjną zbioru,
- nie wolno przedstawiać rekordu legacy jako sukcesu odszyfrowania.

Dla przyszłego wykonania E4.1-H schema v2 ma pierwszeństwo przed przykładem v1 z sekcji 7. Pozostałe zasady bezpieczeństwa, retencji i niezależnego review z niniejszego dokumentu pozostają obowiązujące.

```text
EVIDENCE V1 = SUPERSEDED FOR FUTURE EXECUTION
EVIDENCE V2 = DESIGN CANONICAL / NOT YET IMPLEMENTED
EXECUTION = NOT AUTHORIZED
FREEZE = ACTIVE
```


## 17. Authorization prerequisite — dokument 69

Warstwa E0 Authorization jest kompletna wyłącznie na podstawie ważnego rekordu zgodnego z:

- `69-ETAP4-E4.1-H-CHANGE-AUTHORIZATION-EXECUTION-WINDOW-ROLLBACK-CLEANUP-CONTRACT.md`.

Wymagane są rozdzielone decyzje A1–A3. Sam machine JSON, exit code `0`, poprawne odszyfrowanie albo cleanup nie mogą zastąpić brakującej autoryzacji.

```text
E0 AUTHORIZATION = NOT COLLECTED
A1-A3 = NOT_AUTHORIZED
EXECUTION = NOT AUTHORIZED
FREEZE = ACTIVE
```

## 18. Final authorization evidence — dokument 77

Utworzono końcowy artefakt sekwencji:

- `77-ETAP4-E4.1-H-EXECUTION-AUTHORIZATION-RECORD-A1-A2-A3.md`.

Evidence schema v2 i frozen manifest są wymaganiami A3. Utworzenie kontraktu 77 nie jest evidence wykonania.

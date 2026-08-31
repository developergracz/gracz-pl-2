# ETAP 4 — E4.1-H Diagnostic Collector Design Specification

Data przygotowania: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **DESIGN READY / IMPLEMENTATION NOT AUTHORIZED / FREEZE ACTIVE**  
Production V3: **NO-GO**

> Dokument definiuje przyszły, jednorazowy kolektor diagnostyczny E4.1-H. Nie jest implementacją, nie autoryzuje dodania kodu do obrazu, deployu, zmiany planu Render, uruchomienia One-Off Job, wznowienia aplikacji, odczytu sekretów ani operacji na produkcji.

## 1. Kontekst i zależności

Obowiązujący stan:

```text
F0–F7 PASS / E4.1-H PENDING / SAFE HOLD / FREEZE ACTIVE
```

Dokumenty nadrzędne:

1. `63-ETAP4-E4.1-H-FRESH-CRYPTO-DECRYPTABILITY-EXECUTION-PLAN.md`,
2. `64-ETAP4-E4.1-H-CRYPTO-DIAGNOSTIC-ARCHITECTURE-DECISION.md`,
3. `65-ETAP4-E4.1-H-OPERATOR-RUNBOOK.md`,
4. `66-ETAP4-E4.1-H-EVIDENCE-CONTRACT-AND-REVIEW-CHECKLIST.md`,
5. `67-ETAP4-E4.1-H-RENDER-PROVIDER-CAPABILITY-ASSESSMENT.md`.

Provider capability pozostaje zablokowane przez bieżący plan Free. Niniejsza specyfikacja umożliwia dalszy review dokumentacyjny bez wykonywania testu.

## 2. Cel kolektora

Kolektor ma dostarczyć świeży, privacy-safe dowód, że:

- bieżący materiał kluczowy runtime jest poprawnie skonfigurowany,
- wszystkie rekordy `enc:v1` w badanym zakresie można odszyfrować,
- wszystkie rekordy legacy pozostają czytelne przez zatwierdzoną ścieżkę kompatybilności,
- wszystkie załączniki przechodzą uwierzytelnione odszyfrowanie i walidację integralności,
- rekordy MFA są odszyfrowywalne albo zakres jest prawidłowo oznaczony jako `N/A`,
- test nie uruchamia normalnej aplikacji,
- test nie wykonuje mutacji,
- output nie ujawnia danych ani sekretów.

## 3. Ważne rozdzielenie semantyczne

Dla wiadomości należy rozdzielić:

- `decryptSuccess` — rekordy rzeczywiście zaszyfrowane, dla których oba pola `enc:v1` zostały odszyfrowane,
- `legacyReadable` — rekordy legacy, które nie wymagają odszyfrowania,
- `readSuccess` — suma rekordów poprawnie obsłużonych przez aktualny kontrakt odczytu.

Dla znanego snapshotu oczekiwany kształt to:

```text
total = 5
encryptedRecords = 2
decryptSuccess = 2
legacyExpected = 3
legacyReadable = 3
readSuccess = 5
failure = 0
```

Nie wolno raportować `decryptSuccess = 5`, ponieważ trzy rekordy legacy nie są ciphertextem. Historyczny wynik `5/5 messages success` pozostaje poprawnym dowodem czytelności aplikacyjnej, lecz nowy kolektor ma dostarczyć dokładniejszą semantykę.

## 4. Zakres funkcjonalny

### 4.1. Wiadomości

Źródło danych: `public.gracz_messages`.

Kolektor klasyfikuje każdy rekord jako:

1. `ENCRYPTED_V1_PAIR` — subject i body mają `enc:v1`,
2. `LEGACY_PAIR` — subject i body nie mają `enc:v1`,
3. `MIXED_OR_UNKNOWN` — tylko jedno pole ma envelope albo envelope jest niepoprawny.

Dla `ENCRYPTED_V1_PAIR`:

- wyprowadzić klucz zgodnie z zatwierdzonym HKDF-SHA256,
- odszyfrować subject z AAD `message_id:subject`,
- odszyfrować body z AAD `message_id:body`,
- zaliczyć sukces dopiero po poprawnym uwierzytelnieniu obu pól,
- natychmiast zwolnić referencje do buforów plaintext.

Dla `LEGACY_PAIR`:

- nie wykonywać kryptografii,
- potwierdzić wyłącznie zgodność klasyfikacji ze znanym kontraktem legacy,
- nie wypisywać subject ani body.

Dla `MIXED_OR_UNKNOWN`:

- zwiększyć `failure`,
- ustawić bezpieczny kod `UNEXPECTED_MESSAGE_FORMAT`,
- nie podejmować naprawy ani fallbacku.

### 4.2. Załączniki

Źródło danych: `public.gracz_message_attachments`.

Kolektor:

- rozpoznaje current AAD oraz znany legacy AAD,
- używa AES-256-GCM i zatwierdzonego klucza po HKDF-SHA256,
- sprawdza auth tag,
- porównuje długość plaintext buffer z `file_size`,
- sprawdza zatwierdzone sygnatury MIME,
- nie zapisuje ani nie wypisuje odszyfrowanych bajtów,
- natychmiast zwalnia referencję do bufora po walidacji.

Nie wolno dodawać „próbuj dowolne AAD aż zadziała”. Lista wariantów AAD musi być jawna, skończona i zrecenzowana.

### 4.3. MFA

Źródło danych: `public.gracz_mfa`.

Jeżeli `total = 0`:

- status `N/A`,
- `decryptSuccess = 0`,
- `failure = 0`,
- coverage logicznie `100` dla pustego, kompletnego zakresu.

Jeżeli `total > 0`:

- odszyfrować przez zatwierdzony kontrakt AES-256-GCM/HKDF,
- użyć AAD zależnego od `user_id`,
- potwierdzić format Base32 bez wypisywania wartości,
- jeden błąd oznacza `FAIL`.

## 5. Architektura procesu

Kolektor ma być samodzielnym procesem Node.js:

```text
Provider One-Off Job
        |
        v
Standalone collector
        |
        +--> preflight identity and environment-presence checks
        +--> single PostgreSQL connection
        +--> REPEATABLE READ READ ONLY transaction
        +--> SELECT-only dataset scan
        +--> in-memory decrypt and integrity validation
        +--> ROLLBACK
        +--> one JSON evidence record
        +--> process exit
```

Wymagania:

- brak importu `main.js`,
- brak startu serwera HTTP,
- brak otwierania portu,
- brak inicjalizacji routingu,
- brak schedulerów,
- brak webhook consumers,
- brak mailerów,
- brak cleanup jobs,
- brak seedów,
- brak migratora,
- brak application bootstrap,
- brak dynamicznego ładowania modułów spoza zatwierdzonej listy.

## 6. Proponowana lokalizacja przyszłej implementacji

Proponowana ścieżka:

```text
modern/checkers-engine/scripts/preflight/e41h-runtime-decryptability-collector.mjs
```

Proponowana nazwa skryptu package managera:

```text
preflight:e41h:runtime-decryptability
```

Sama nazwa nie jest zgodą na dodanie pliku ani zmianę `package.json`.

## 7. Source i artifact identity

Kolektor nie może ufać wartościom source identity przekazanym dowolnie przez operatora.

Wymagane źródła:

- `sourceSha` — wstrzyknięty jako niezmienna metadana build lub potwierdzony przez zatwierdzony artifact manifest,
- `scriptBlobSha` — wyliczony przed build i zapisany w authorization record,
- `artifactId` — identyfikator dostawcy lub niezmienny identyfikator obrazu,
- `runId` — utworzony przed wykonaniem i zatwierdzony w oknie operacyjnym.

Mismatch któregokolwiek identyfikatora oznacza `ABORT` przed połączeniem z DB.

## 8. Kontrakt environment

### 8.1. Dozwolone odczyty

Kolektor może odczytać wyłącznie wartości wymagane do:

- połączenia DB,
- ustalenia materiału kluczowego przez istniejący kontrakt,
- potwierdzenia run/source/artifact identity,
- wymuszenia oczekiwanej klasy targetu.

### 8.2. Zabronione operacje

- wypisywanie `process.env`,
- logowanie długości, prefiksu, sufiksu lub hasha sekretu,
- przekazywanie sekretu w argumentach command line,
- zapis sekretu do pliku,
- serializacja konfiguracji połączenia,
- stack trace zawierający URL lub dynamiczne wartości,
- fallback do placeholdera,
- fallback do dowolnego lokalnego `AUTH_SECRET`,
- kopiowanie key material między środowiskami.

### 8.3. Presence checks

Do evidence wolno zapisać jedynie zbiorczy status:

```json
{
  "databaseConfiguration": "PRESENT",
  "messageKeyConfiguration": "PRESENT",
  "attachmentKeyConfiguration": "PRESENT",
  "mfaKeyConfiguration": "PRESENT_OR_FALLBACK_CONTRACT_VALID"
}
```

Presence nie oznacza poprawności klucza. Poprawność potwierdza wyłącznie uwierzytelnione odszyfrowanie.

## 9. Kontrakt połączenia z bazą

Kolektor musi:

1. użyć pojedynczego klienta,
2. ustawić `application_name` identyfikujące E4.1-H bez PII,
3. ustawić ograniczony connect timeout,
4. rozpocząć `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`,
5. ustawić lokalny `statement_timeout`,
6. ustawić lokalny `lock_timeout`,
7. ustawić lokalny `idle_in_transaction_session_timeout`,
8. potwierdzić `transaction_read_only = on`,
9. potwierdzić oczekiwaną klasyfikację bazy,
10. wykonywać wyłącznie statyczne zapytania `SELECT`,
11. zakończyć `ROLLBACK` również po błędzie,
12. zamknąć klienta i pool przed emisją finalnego statusu.

### 9.1. Zakazane SQL

- `INSERT`,
- `UPDATE`,
- `DELETE`,
- `MERGE`,
- `TRUNCATE`,
- `CREATE`,
- `ALTER`,
- `DROP`,
- `GRANT`,
- `REVOKE`,
- `CALL`,
- funkcje o niepotwierdzonej zmienności,
- blokady `FOR UPDATE` / `FOR SHARE`,
- polecenia maintenance.

Review implementacji musi potwierdzić statycznie brak tych operacji.

## 10. Minimalizacja danych w pamięci

- przetwarzanie ma być strumieniowe lub partiami, jeśli dataset wzrośnie,
- plaintext nie może być gromadzony w wynikowej strukturze,
- plaintext buffer musi mieć możliwie krótki czas życia,
- po walidacji należy nadpisać bufor zerami, jeśli implementacja runtime zapewnia kontrolowany `Buffer`,
- wyjątki nie mogą zawierać wartości wejściowych,
- garbage collection nie jest traktowane jako mechanizm bezpieczeństwa,
- żaden dump pamięci ani debug mode nie jest dozwolony w oknie testu.

## 11. Algorytmy kryptograficzne

Implementacja musi zachować kontrakt AS-IS:

### Messages

- AES-256-GCM,
- HKDF-SHA256,
- salt: `gracz.pl/messages/v1`,
- info: `private-message-encryption`,
- AAD: `message_id:field`,
- envelope: `enc:v1:<iv>.<tag>.<ciphertext>`.

### Attachments

- AES-256-GCM,
- HKDF-SHA256,
- salt: `gracz.pl/message-attachments/v1`,
- info: `private-message-attachment-encryption`,
- current i zatwierdzony legacy AAD zgodnie z inventory.

### MFA

- AES-256-GCM,
- HKDF-SHA256,
- salt: `gracz.pl/mfa/v1`,
- info: `totp-secret-encryption`,
- AAD: `user_id`.

Zmiana algorytmu, salt, info, AAD lub envelope wymaga osobnego ADR i nie może być dokonana w ramach E4.1-H.

## 12. Kanoniczny wynik JSON — wersja v2

```json
{
  "schemaVersion": "e4.1-h-evidence-v2",
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
    "decryptSuccess": 2,
    "legacyExpected": 3,
    "legacyReadable": 3,
    "mixedOrUnknown": 0,
    "readSuccess": 5,
    "failure": 0,
    "coverage": 100,
    "status": "PASS"
  },
  "attachments": {
    "total": 2,
    "currentAad": 0,
    "legacyAad": 2,
    "decryptSuccess": 2,
    "failure": 0,
    "coverage": 100,
    "status": "PASS"
  },
  "mfa": {
    "total": 0,
    "decryptSuccess": 0,
    "failure": 0,
    "coverage": 100,
    "status": "N/A"
  },
  "databaseMutationCount": 0,
  "rollback": "PASS",
  "clientClosed": true,
  "safeOutput": "PASS",
  "e41hCandidate": "PASS"
}
```

Zera w SHA są wyłącznie placeholderami. Realny run nie może ich zaakceptować.

Pole `cleanup` nie jest emitowane przez proces jako finalne `PASS`, ponieważ pełny cleanup wymaga niezależnej kontroli providerskiej po zakończeniu procesu. Kolektor może potwierdzić tylko `clientClosed=true`; końcowe `cleanup=PASS` nadaje reviewer po weryfikacji joba i środowiska.

## 13. Równania walidacyjne

### Messages

```text
total = encryptedRecords + legacyExpected + mixedOrUnknown
decryptSuccess = encryptedRecords
legacyReadable = legacyExpected
readSuccess = decryptSuccess + legacyReadable
readSuccess + failure = total
mixedOrUnknown = 0
failure = 0
coverage = 100
```

### Attachments

```text
total = currentAad + legacyAad
decryptSuccess + failure = total
decryptSuccess = total
failure = 0
coverage = 100
```

### MFA

Dla `total = 0`:

```text
decryptSuccess = 0
failure = 0
status = N/A
coverage = 100
```

Dla `total > 0`:

```text
decryptSuccess + failure = total
decryptSuccess = total
failure = 0
status = PASS
coverage = 100
```

## 14. Safe error taxonomy kolektora

Dozwolone kody:

- `SOURCE_IDENTITY_MISMATCH`,
- `SCRIPT_IDENTITY_MISMATCH`,
- `ARTIFACT_IDENTITY_MISMATCH`,
- `TARGET_IDENTITY_MISMATCH`,
- `DATABASE_CONFIGURATION_MISSING`,
- `KEY_CONFIGURATION_NOT_VERIFIED`,
- `READ_ONLY_NOT_CONFIRMED`,
- `TRANSACTION_START_FAILED`,
- `UNEXPECTED_MESSAGE_FORMAT`,
- `MESSAGE_DECRYPT_FAILURE`,
- `ATTACHMENT_DECRYPT_FAILURE`,
- `ATTACHMENT_INTEGRITY_FAILURE`,
- `MFA_DECRYPT_FAILURE`,
- `MFA_FORMAT_FAILURE`,
- `UNEXPECTED_DATASET_SHAPE`,
- `ROLLBACK_NOT_CONFIRMED`,
- `CLIENT_CLOSE_NOT_CONFIRMED`,
- `UNSAFE_OUTPUT_DETECTED`,
- `UNKNOWN_SAFE_FAILURE`.

Finalny błąd ma mieć wyłącznie kod z allowlisty. Bez stack trace, SQL, URL, identyfikatora rekordu i dynamicznego komunikatu.

## 15. Kody zakończenia procesu

| Exit code | Znaczenie |
|---:|---|
| 0 | candidate PASS; pełny PASS zależy od zewnętrznego cleanup/review |
| 1 | kompletny test wykazał funkcjonalny FAIL |
| 2 | NOT_VERIFIED / błąd preflight albo niepełny test |
| 3 | ABORT / naruszenie identity, read-only lub bezpieczeństwa |

Exit `0` nie zamyka samodzielnie E4.1-H.

## 16. Zasady logowania

Proces powinien wyemitować:

1. zero lub jedną bezpieczną linię startową zawierającą wyłącznie `runId`,
2. dokładnie jeden finalny obiekt JSON,
3. żadnych logów bibliotek na poziomie debug,
4. żadnych zapytań SQL,
5. żadnych rekordów jednostkowych,
6. żadnych wartości environment,
7. żadnych stack traces.

Przed publikacją artefaktu reviewer uruchamia kontrolę wzorców:

- schematy URL,
- `postgresql://` i `postgres://`,
- nazwy secret variables połączone z wartością,
- JWT-like tokens,
- PEM headers,
- pola subject/body,
- długie Base64/Base64URL,
- adresy e-mail i inne PII.

Wykrycie potencjalnego wycieku oznacza `ABORT / INCIDENT`.

## 17. Testy wymagane przed dopuszczeniem implementacji

### Unit tests

- klasyfikacja encrypted/legacy/mixed,
- poprawny i błędny envelope,
- właściwe AAD dla subject/body,
- current i legacy attachment AAD,
- błędny auth tag,
- niezgodna długość załącznika,
- niedozwolony MIME,
- MFA empty/N/A,
- MFA valid/invalid,
- safe error mapping,
- schema equations,
- output redaction.

### Integration tests — wyłącznie non-production

- poprawny lokalny restore,
- błędny klucz,
- brak klucza,
- niewłaściwa baza,
- brak read-only,
- timeout,
- przerwane połączenie,
- wymuszony rollback failure,
- dataset shape mismatch,
- pełne potwierdzenie braku mutacji.

### Static review

- brak importu entrypointu aplikacji,
- brak listenera,
- brak DDL/DCL/DML,
- brak write-capable helperów,
- brak logowania wartości dynamicznych,
- dependencies przypięte do zatwierdzonego lockfile,
- brak zmian kontraktu kryptograficznego.

## 18. Kryteria Implementation Ready

Specyfikacja może przejść do implementacji dopiero po:

1. provider capability PASS,
2. formalnej zgodzie na przygotowanie kodu,
3. wyborze gałęzi izolowanej od PR #26,
4. zatwierdzeniu schema `e4.1-h-evidence-v2`,
5. review rozdzielenia decrypt/read semantics,
6. zatwierdzeniu exact source/artifact identity,
7. zatwierdzeniu test planu non-production,
8. potwierdzeniu, że implementacja nie uruchomi deployu,
9. wskazaniu dwóch reviewerów: security i database/operations.

## 19. Kryteria Execution Ready

Nawet ukończona implementacja nie może być wykonana, dopóki:

- freeze nie zostanie formalnie zdjęty lub zakresowo zawieszony,
- Render nie obsługuje zatwierdzonego One-Off Job,
- approved artifact nie jest dostępny,
- job command nie jest dokładnie zatwierdzony,
- production target guard nie jest potwierdzony,
- maintenance/mutation lock nie jest aktywny,
- operator, authorizer i reviewer nie są przypisani,
- cleanup oraz rollback plan nie są gotowe.

## 20. Elementy jawnie poza zakresem

- rekey v1→v2,
- migracja danych,
- naprawa legacy,
- zmiana algorytmów,
- rotacja kluczy,
- zmiana ról DB,
- deployment aplikacji,
- uruchomienie migratora,
- SEO i indeksacja,
- scalanie PR #26,
- decyzja Production V3 GO.

## 21. Decyzja bieżąca

```text
COLLECTOR DESIGN = READY
COLLECTOR IMPLEMENTATION = NOT AUTHORIZED
PROVIDER CAPABILITY = BLOCKED BY CURRENT FREE PLAN
E4.1-H EXECUTION = PENDING / SAFE HOLD
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
RENDER = UNCHANGED
SECRETS = UNCHANGED
PR #26 = OPEN / DRAFT / NOT MERGED
PRODUCTION V3 = NO-GO
```

Dokument zwiększa gotowość projektową, ale nie zmienia statusu operacyjnego.

## 22. Final implementation authorization — dokument 77

Utworzono końcowy artefakt sekwencji:

- `77-ETAP4-E4.1-H-EXECUTION-AUTHORIZATION-RECORD-A1-A2-A3.md`.

Design kolektora jest wejściem do A1. Implementacja pozostaje NOT REQUESTED / NOT AUTHORIZED do czasu formalnego rekordu.

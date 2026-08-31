# ETAP 4 — E4.1-H Crypto Diagnostic Architecture Decision

Data przygotowania: 31.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Typ: **ADR / SECURITY ARCHITECTURE DECISION**  
Status: **ACCEPTED DESIGN / EXECUTION NOT AUTHORIZED / PROVIDER CAPABILITY VERIFICATION PENDING**  
Freeze: **ACTIVE**  
Production V3: **NO-GO**

> Decyzja dotyczy wyłącznie architektury przyszłego, świeżego testu decryptability. Nie zezwala na deploy, restart, resume usługi, zmianę środowiska, kopiowanie sekretów ani wykonanie testu.

## 1. Kontekst

E4.1-H wymaga świeżego potwierdzenia, że aktualny materiał kluczowy runtime odszyfrowuje istniejące dane v1.

Potwierdzony stan wejściowy:

- E4.1 F0–F7 = `PASS`,
- fresh restore = `PASS`,
- production-versus-restore row-count reconciliation = `28/28 tables / 17,711 rows / 0 differences`,
- crypto structure inventory = `PASS`,
- historyczna Bramka 11 = `5/5 messages / 2/2 attachments / 0 failures`,
- E4.1-H = `PENDING FRESH CONFIRMATION`,
- usługa aplikacyjna = zawieszona,
- freeze/mutation lock = aktywny,
- PR #26 = `OPEN / DRAFT / NOT MERGED`.

Historyczny PASS nie może zostać przedstawiony jako fresh E4.1-H PASS.

## 2. Problem architektoniczny

Aktualny materiał v1 pozostaje wewnątrz provider-managed runtime environment. Bezpieczny test musi jednocześnie:

1. użyć rzeczywistego materiału v1,
2. nie eksportować żadnego sekretu,
3. nie uruchomić normalnej aplikacji ani writerów,
4. wykonać wyłącznie odczyt,
5. nie ujawnić plaintextu,
6. pozostawić produkcję i konfigurację bez zmian,
7. dostarczyć audytowalny, privacy-safe wynik.

Te wymagania wykluczają zwykły lokalny test oraz normalne wznowienie aplikacji.

## 3. Siły i ograniczenia decyzyjne

| Obszar | Wymaganie |
|---|---|
| Poufność | klucze i plaintext nie opuszczają kontrolowanego procesu |
| Integralność | zero DDL/DCL/DML i zero zmian ciphertext |
| Dostępność | normalna aplikacja nie jest uruchamiana |
| Freeze | brak niezatwierdzonej zmiany Render/Git/DB |
| Powtarzalność | deterministyczny kontrakt outputu |
| Audyt | exact source SHA, run identity i cleanup evidence |
| Fail closed | niepewność targetu lub trybu read-only = ABORT |
| Least privilege | tylko minimalny dostęp wymagany do SELECT/decrypt in-memory |

## 4. Rozważone warianty

### Opcja A — kopiowanie kluczy z Render do lokalnego procesu

**Decyzja: REJECTED.**

Powody:

- sekret opuszcza provider-managed runtime,
- rośnie ryzyko schowka, historii, process list, pliku i screenshotu,
- tworzy nową, niekontrolowaną kopię key material,
- jest sprzeczne z obowiązującym secret storage contract.

### Opcja B — wznowienie normalnej aplikacji i użycie endpointu diagnostycznego

**Decyzja: REJECTED podczas obecnego freeze.**

Powody:

- normalny entrypoint może uruchomić listener, writer, cleanup jobs lub consumer,
- zwiększa blast radius,
- wymaga resume/deploy/restart,
- wynik byłby zależny od zachowania całej aplikacji, nie izolowanego collectora.

### Opcja C — lokalny test z wartością zastępczą

**Decyzja: REJECTED.**

Powód: testowałby implementację, ale nie zgodność istniejącego ciphertextu z aktualnym key material. Nie może otrzymać PASS.

### Opcja D — uznanie historycznej Bramki 11 za fresh PASS

**Decyzja: REJECTED.**

Historyczny wynik jest dowodem wspierającym, lecz nie spełnia wymagania świeżego capture po freeze.

### Opcja E — provider-side isolated diagnostic execution

**Decyzja: CONDITIONALLY ACCEPTED jako docelowy wzorzec.**

Warunki:

- proces otrzymuje istniejące secrets przez provider environment bez ich eksportu,
- nie uruchamia normalnego entrypointu,
- nie otwiera publicznego listenera,
- nie uruchamia writerów ani background jobs,
- wymusza DB read-only,
- raportuje wyłącznie agregaty,
- kończy się pełnym cleanupem.

### Opcja F — pozostawienie E4.1-H w HOLD

**Decyzja: ACCEPTED SAFE FALLBACK.**

Jeśli platforma nie pozwala spełnić wszystkich warunków Opcji E, poprawnym wynikiem jest dalszy `HOLD`, a nie obniżenie wymagań.

## 5. Decyzja

Przyjmujemy architekturę:

```text
Existing provider secret store
            |
            v
Isolated diagnostic process
(no HTTP / no normal app / no writers)
            |
            v
Read-only PostgreSQL transaction
(REPEATABLE READ READ ONLY)
            |
            v
In-memory decrypt validation
(no plaintext output)
            |
            v
Aggregate-only evidence + ROLLBACK + cleanup
```

Opcja E pozostaje **design-selected**, ale nie jest jeszcze execution-ready. Przed wykonaniem trzeba zweryfikować rzeczywiste możliwości Rendera i uzyskać formalną zgodę operacyjną.

## 6. Granice komponentów

### 6.1. Provider secret store

Odpowiada za:

- dostarczenie istniejących wartości bez prezentowania ich operatorowi,
- brak eksportu do pliku, czatu i command line,
- zachowanie obecnych wartości bez rotacji.

### 6.2. Diagnostic launcher

Odpowiada za:

- uruchomienie dokładnie jednego procesu,
- wyłączenie normalnego entrypointu,
- brak portu publicznego,
- brak równoległości,
- powiązanie z exact source/artifact identity,
- zakończenie procesu po jednym przebiegu.

### 6.3. Crypto collector

Odpowiada za:

- walidację obecności wymaganych logical keys bez ich wypisywania,
- użycie exact v1 HKDF/AAD compatibility,
- decrypt in-memory,
- natychmiastowe odrzucenie błędnej konfiguracji,
- output wyłącznie counters/status/error codes.

### 6.4. DB guard

Odpowiada za:

- potwierdzenie expected database identity,
- wymuszenie read-only na poziomie sesji i transakcji,
- statement/connect timeout,
- `ROLLBACK` również w failure path,
- brak funkcji mutacyjnych.

### 6.5. Evidence sink

Odpowiada za:

- zapis wyłącznie bezpiecznego JSON/statusu,
- brak plaintextu, ciphertextu, AAD, kluczy, URL i PII,
- run ID, timestamp, source SHA i aggregate counters,
- retencję zgodną z dokumentacją migracyjną.

## 7. Wymagane invariants

Podczas całego lifecycle muszą pozostać true:

- `normalApplicationStarted = false`,
- `publicListenerOpened = false`,
- `writerStarted = false`,
- `backgroundJobsStarted = false`,
- `transactionReadOnly = true`,
- `secretValueLogged = false`,
- `plaintextLogged = false`,
- `databaseMutationCount = 0`,
- `renderEnvironmentChanged = false`,
- `gitSourceChangedDuringRun = false`.

Brak dowodu któregokolwiek invariant = `NOT VERIFIED / ABORT`.

## 8. Threat model

| Zagrożenie | Kontrola |
|---|---|
| przypadkowy start aplikacji | osobny launcher i brak normalnego entrypointu |
| zapis do DB | session guard + read-only transaction + ROLLBACK |
| wyciek sekretu | brak wartości w args/output/files; provider injection only |
| wyciek plaintextu | aggregate-only logger; brak debug dump |
| zły target DB | exact identity probe przed SELECT danych |
| niezatwierdzony kod | exact source/artifact SHA allowlist |
| pozostawiony proces | post-run process/cleanup verification |
| fałszywy PASS | expected counts + zero failures + full coverage |
| częściowy test | domain-by-domain counters i aggregate gate |
| downgrade wymagań | HOLD zamiast obejścia zabezpieczeń |

## 9. Lifecycle przyszłego wykonania

```text
DESIGN_READY
  -> PROVIDER_CAPABILITY_VERIFIED
  -> CHANGE_WINDOW_AUTHORIZED
  -> PRECHECK_PASS
  -> DIAGNOSTIC_RUNNING
  -> EVIDENCE_CAPTURED
  -> CLEANUP_VERIFIED
  -> PASS | ABORT
```

Przejście pomijające dowolny stan jest zabronione.

## 10. Approval gates

### Gate A — architecture review

- dokumenty 63–66 spójne,
- metoda nie eksportuje sekretów,
- output contract zaakceptowany.

### Gate B — provider capability proof

- potwierdzone uruchomienie bez normalnego entrypointu,
- potwierdzone secret injection bez reveal/export,
- potwierdzony brak publicznego endpointu,
- potwierdzony cleanup.

### Gate C — operational authorization

- jawny operator,
- data/okno,
- exact source/artifact SHA,
- rollback/abort owner,
- freeze exception ograniczony tylko do diagnostyki, jeśli w ogóle wymagany.

### Gate D — execution evidence

- precheck PASS,
- decrypt counters complete,
- zero failures,
- cleanup PASS.

Bez Gate A–C nie uruchamiać diagnostyki.

## 11. Konsekwencje decyzji

### Pozytywne

- sekrety pozostają w provider boundary,
- brak potrzeby normalnego uruchomienia serwisu,
- minimalny blast radius,
- jednoznaczny wynik,
- możliwość zachowania freeze lub bardzo wąskiego wyjątku kontrolnego.

### Koszty

- konieczna weryfikacja funkcji platformy,
- możliwy brak odpowiedniej capability na aktualnym planie Render,
- potrzeba zatwierdzonego diagnostycznego artefaktu,
- dodatkowy formalny cleanup/evidence capture.

### Ryzyko resztkowe

Jeżeli platforma technicznie nie izoluje entrypointu lub nie gwarantuje bezpiecznego secret injection, test nie może być wykonany tą metodą. Status pozostaje `HOLD`.

## 12. Relacje z innymi dokumentami

- `15-CRYPTO-COMPATIBILITY-INVENTORY.md` — exact v1 format/HKDF/AAD,
- `16-CRYPTO-DECRYPTABILITY-SMOKE-TEST.md` — historyczny Gate 11,
- `17-RUNTIME-CRYPTO-SELFCHECK.md` — runtime evidence i limitation hash,
- `35-GATE-14C-CRYPTO-KEYRING-V1-V2-DESIGN.md` — future keyring,
- `38-GATE-14C-REKEY-RUNBOOK-AND-PASS-CRITERIA.md` — późniejszy rekey,
- `40-GATE-14D-PRODUCTION-ENV-CONTRACT.md` — secret/environment contract,
- `41-GATE-14D-READONLY-ENV-VERIFIER.mjs` — safe boolean output pattern,
- `62-ETAP4-E4.1-F-RESTORE-VALIDATION-EXECUTION-LOG.md` — current evidence,
- `63-ETAP4-E4.1-H-FRESH-CRYPTO-DECRYPTABILITY-EXECUTION-PLAN.md` — nadrzędny plan.

## 13. Status końcowy ADR

```text
ARCHITECTURE DECISION = CONDITIONALLY ACCEPTED
SELECTED PATTERN = PROVIDER-SIDE ISOLATED DIAGNOSTIC
EXECUTION READINESS = NOT READY
E4.1-H = PENDING / SAFE HOLD
FREEZE = ACTIVE
PRODUCTION = UNCHANGED
SECRETS = UNCHANGED
PRODUCTION V3 = NO-GO
```

Następny artefakt: szczegółowy operator runbook. Utworzenie runbooka nie autoryzuje wykonania.

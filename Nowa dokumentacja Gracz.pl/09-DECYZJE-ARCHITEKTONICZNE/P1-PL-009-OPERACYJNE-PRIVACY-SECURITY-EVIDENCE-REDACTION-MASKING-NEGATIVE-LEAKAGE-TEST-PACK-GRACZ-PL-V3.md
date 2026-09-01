# Gracz.pl V3 — P1-PL-009 Operacyjne Privacy/Security Evidence, redaction/masking i negative leakage test pack

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-009`  
Status: **READY FOR EXECUTION / OPEN P1 / OPERATIONAL EVIDENCE REQUIRED / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane kontrole/evidence: `PL-C19`, `PL-E06`, `PL-E11`, `PL-E15`, `P1-PL-005`, `P1-PL-006`, `P1-PL-007`, `P1-PL-008`

> Dokument przygotowuje kanoniczny pakiet wykonawczy dla ostatniego operacyjnego blockera Privacy/Legal P1. Nie twierdzi, że testy produkcyjne lub stagingowe zostały wykonane. Nie odczytuje sekretów, nie zmienia logowania, telemetry, providerów ani konfiguracji. Zamknięcie P1-PL-009 wymaga rzeczywistych dowodów działania kontroli.

---

## 1. Cel blockera

P1-PL-009 ma wykazać operacyjnie, że system i jego integracje nie ujawniają sekretów ani nadmiarowych danych osobowych w:

- application logs;
- security logs;
- traces i error reporting;
- audit events;
- outbox / dead-letter evidence;
- provider telemetry;
- support artifacts;
- privacy/security evidence;
- test reports i approval artifacts.

Warstwa dokumentacyjna jest już zdefiniowana przez PL-C19. Niniejszy dokument zamienia wymagania w jednoznaczny zestaw testów i kryteriów PASS.

---

## 2. Nienaruszalne reguły PASS

Przed zamknięciem P1-PL-009 muszą być spełnione wszystkie poniższe reguły:

1. plaintext password nie pojawia się w żadnym logu, trace, audit, telemetry ani evidence;
2. `Authorization` header, session cookie i aktywne tokeny są usuwane lub maskowane przed zapisem;
3. MFA secret, recovery secret i aktywne OTP nie są logowane;
4. plaintext prywatnej wiadomości i payload załącznika nie trafiają do zwykłych logów, audit, telemetry ani error reports;
5. request/response body nie jest automatycznie kopiowany do traces lub crash reports bez allowlist i redaction;
6. IP/UA/correlation identifiers są logowane wyłącznie dla zaakceptowanego celu, w minimalnym zakresie i z właściwą retencją;
7. provider telemetry otrzymuje wyłącznie zatwierdzony zakres pól;
8. support/export/evidence przed opuszczeniem systemu jest zredagowany;
9. secret-management evidence nie zawiera wartości sekretów;
10. istnieją negatywne testy potwierdzające brak leakage.

---

## 3. Field-level logging policy — wymagany artefakt

Przed wykonaniem testów należy mieć jawny, wersjonowany artefakt zawierający co najmniej:

```text
LOG CHANNEL
PURPOSE
ALLOWED FIELDS
PROHIBITED FIELDS
MASKED FIELDS
RETENTION CLASS
ACCESS ROLE
EXTERNAL PROVIDER = YES / NO
PROVIDER LOCATOR
OWNER
REVIEW DATE
```

Minimalny denylist dla wszystkich kanałów:

```text
password
password_hash gdy nie jest technicznie konieczny do bardzo wąskiego audytu
Authorization header
session cookie
access token
refresh token
reset token
registration token
unsubscribe token plaintext
MFA secret
OTP secret / seed
private encryption key
raw environment secret
private message body
attachment payload
full identity-document copy
complete account export
unredacted request body containing unrelated PII
```

Denylist nie zastępuje allowlist. Dla kanałów wysokiego ryzyka wymagany jest model allowlist-first.

---

## 4. Kanoniczna macierz testów P1-PL-009

| ID | Scenariusz | Wymagany wynik | Evidence |
|---|---|---|---|
| P1-009-T01 | logowanie/rejestracja z testowym hasłem-markerem | marker nie pojawia się w logs/traces/audit/error reports | sanitized log excerpt + test result |
| P1-009-T02 | request z testowym `Authorization: Bearer` | pełny token nie pojawia się w żadnym durable channel | grep/scan result + channel inventory |
| P1-009-T03 | request z session cookie | cookie value nie pojawia się w logs/traces/provider telemetry | scan result |
| P1-009-T04 | reset/recovery flow z testowym tokenem-markerem | plaintext token nie jest zapisany poza wymaganym secret/token store | test result + sanitized locator |
| P1-009-T05 | MFA flow z testowym secret/OTP markerem | secret/OTP nie pojawia się w logs/audit/traces/support evidence | test result |
| P1-009-T06 | prywatna wiadomość z unikalnym markerem w body | marker nie pojawia się w logs/audit/outbox/telemetry/error reports | multi-channel scan |
| P1-009-T07 | załącznik/testowy payload z markerem | payload nie jest kopiowany do logs/traces/evidence; tylko zatwierdzone metadata | scan + metadata sample |
| P1-009-T08 | kontrolowany błąd 4xx/5xx z request body zawierającym marker PII | error reporting nie ujawnia pełnego body ani sekretu | error report sample sanitized |
| P1-009-T09 | provider telemetry export | wysyłany field set odpowiada zatwierdzonej allowlist | provider field inventory + capture/locator |
| P1-009-T10 | support/debug artifact | przed eksportem wykonana skuteczna redakcja sekretów i zbędnego PII | before/after pattern without real secrets |
| P1-009-T11 | secret-management review | evidence potwierdza separację, rotację, least privilege bez ujawniania secret values | configuration metadata locator |
| P1-009-T12 | automatyczny scan artefaktów | brak markerów testowych i zakazanych klas danych w durable evidence | machine-readable scan result |
| P1-009-T13 | IP/UA/correlation ID review | pola występują tylko w zatwierdzonych kanałach/celu/retencji | field matrix + sample |
| P1-009-T14 | audit/outbox/dead-letter review | brak pełnych payloadów prywatnych treści i sekretów | sanitized sample + scan |
| P1-009-T15 | privacy/approval evidence review | tylko minimalne pseudonymous refs/locators, bez source payload | artifact review record |

Każdy test otrzymuje `PASS / FAIL / NOT RUN`. `NOT RUN` nie może zamknąć P1.

---

## 5. Test markers — zasada bezpieczeństwa

Do testów należy używać wyłącznie sztucznych markerów testowych, np.:

```text
TEST_PASSWORD_DO_NOT_LOG_001
TEST_BEARER_DO_NOT_LOG_002
TEST_MFA_SECRET_DO_NOT_LOG_003
TEST_PRIVATE_MESSAGE_DO_NOT_LOG_004
TEST_PII_MARKER_DO_NOT_LOG_005
```

Nie wolno używać prawdziwych haseł, aktywnych tokenów, realnych MFA secrets ani rzeczywistych prywatnych wiadomości jako materiału testowego.

---

## 6. Kanały wymagające obowiązkowego skanu

Po każdym odpowiednim teście należy sprawdzić co najmniej:

- stdout/stderr aplikacji;
- app logs;
- security logs;
- audit log;
- outbox i dead-letter records;
- traces/APM;
- error reporting;
- provider observability telemetry;
- support/debug artifacts;
- CI/test logs, jeżeli uczestniczą w scenariuszu;
- review/evidence artifacts generowane z testu.

Brak dostępu do konkretnego kanału musi zostać zapisany jako `NOT VERIFIED`, a nie automatyczny PASS.

---

## 7. Provider field-scope review

Dla każdego zewnętrznego providera mającego kontakt z logs/telemetry/support/e-mail/storage/edge należy utworzyć rekord:

```text
PROVIDER
SERVICE
DATA FLOW
ALLOWED FIELDS
PII FIELDS
SENSITIVE FIELDS
SECRET FIELDS = NONE EXPECTED
PRIVATE MESSAGE BODY = NO UNLESS SERVICE STRICTLY REQUIRES AND IS SEPARATELY APPROVED
RETENTION
REGION / TRANSFER LOCATOR
DPA LOCATOR
REDACTION BEFORE PROVIDER = YES / NO / N/A
SAMPLE VERIFIED = YES / NO
STATUS = PASS / PASS WITH CONDITIONS / HOLD
```

`P1-PL-006` i `P1-PL-007` pozostają źródłowymi blockerami dla finalnej akceptacji providerów i transferów. P1-PL-009 nie może zastąpić ich weryfikacji.

---

## 8. Secret-management evidence

Wymagany dowód nie może zawierać sekretów. Dopuszczalne evidence obejmuje wyłącznie metadata takie jak:

- nazwa mechanizmu/secret store;
- role z prawem dostępu;
- zasada least privilege;
- data ostatniej rotacji lub rotation policy;
- separation of duties;
- identyfikator konfiguracji/policy;
- locator do niepublicznego źródła, jeśli istnieje;
- wynik testu revoke/rotation bez ujawniania wartości.

Niedozwolone w artefakcie:

- `AUTH_SECRET` value;
- DB password;
- API key;
- private key;
- MFA seed;
- bearer token;
- connection string zawierający credential.

---

## 9. Automatyczny negative leakage scan

Docelowy test powinien przeszukiwać artefakty po wykonaniu scenariusza pod kątem:

1. unikalnych markerów testowych;
2. wartości syntetycznych tokenów;
3. znanych prefixów credentiali użytych w test harness;
4. pełnych nagłówków `Authorization`;
5. `Set-Cookie` / session-value leakage;
6. private-message marker;
7. synthetic PII marker;
8. niedozwolonych pól JSON, jeżeli zostały przesłane do provider telemetry.

Wynik testu powinien być maszynowo czytelny:

```text
SCAN ID =
ENVIRONMENT =
COMMIT / BUILD =
CHANNELS SCANNED =
PATTERNS = SYNTHETIC MARKERS ONLY
MATCHES = 0 REQUIRED
FALSE POSITIVES =
RESULT = PASS / FAIL
EXECUTED AT =
EXECUTED BY =
EVIDENCE LOCATOR =
```

---

## 10. Kryteria FAIL

Natychmiastowy `FAIL / BLOCKING P1` występuje, jeżeli:

- testowy password/token/MFA marker pojawi się w durable log/trace/audit/provider channel;
- plaintext private-message marker pojawi się poza zatwierdzonym message store/ściśle zatwierdzonym przetwarzaniem;
- provider otrzymuje niezatwierdzone PII/SENSITIVE fields;
- support artifact zawiera niezredagowany sekret;
- error report kopiuje pełny request body zawierający sekret/zbędne PII;
- brak możliwości ustalenia, jakie dane wysyłane są do zewnętrznego providera;
- secret-management evidence wymaga publikacji rzeczywistych wartości sekretów;
- testy nie obejmują wszystkich rzeczywiście aktywnych kanałów logging/telemetry.

FAIL wymaga remediation i ponownego wykonania pełnego odpowiedniego testu.

---

## 11. Warunki zamknięcia P1-PL-009

P1-PL-009 może otrzymać `CLOSED` dopiero, gdy łącznie:

1. field-level logging policy jest wersjonowana;
2. wszystkie testy materialne P1-009-T01..T15 są wykonane albo jawnie oznaczone jako N/A z zaakceptowanym uzasadnieniem;
3. wszystkie testy negatywnego leakage mają PASS;
4. provider field-scope jest zweryfikowany dla rzeczywiście używanych providerów;
5. secret-management operational evidence istnieje bez ujawniania sekretów;
6. istnieje trwały test/evidence locator;
7. nie istnieje otwarty FAIL dotyczący password/token/MFA/private-message leakage;
8. wynik został zsynchronizowany z PL-C19 i pełną DPIA;
9. final delta review nie wykazuje nowego P0/P1 w tym obszarze.

---

## 12. Aktualny status wykonania

Na datę utworzenia tego dokumentu:

```text
P1-PL-009 = OPEN
TEST PACK = COMPLETE / READY FOR EXECUTION
FIELD-LEVEL POLICY OPERATIONAL PROOF = NOT VERIFIED
TESTS T01-T15 = NOT RUN BY THIS REVIEW
PROVIDER FIELD-SCOPE OPERATIONAL SAMPLE = NOT VERIFIED
SECRET-MANAGEMENT OPERATIONAL EVIDENCE = NOT VERIFIED
NEGATIVE LEAKAGE SCAN = NOT RUN

REASON:
- review pozostaje w trybie freeze-safe;
- nie wykonano zmian runtime/logging/provider configuration;
- nie odczytywano sekretów;
- dokumentacja nie może zastąpić rzeczywistego testu operacyjnego.

CANONICAL P1 CLOSED = 4 OF 9
CANONICAL P1 OPEN = 5 OF 9
OPEN P0 PRIVACY/LEGAL = 0 KNOWN
FINAL ADR-V3-012 VERDICT = HOLD
SECOND FORMAL DOCUMENT FINAL SIGNATURE = NOT YET
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

## 13. Granica autoryzacji

Utworzenie pakietu:

- nie modyfikuje kodu ani konfiguracji logowania;
- nie włącza telemetry;
- nie pobiera ani nie ujawnia sekretów;
- nie uruchamia testów na produkcji;
- nie zatwierdza providera observability;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

Privacy/Legal Decision Owner: **Czesław Socha**  
Projekt: **Gracz.pl**
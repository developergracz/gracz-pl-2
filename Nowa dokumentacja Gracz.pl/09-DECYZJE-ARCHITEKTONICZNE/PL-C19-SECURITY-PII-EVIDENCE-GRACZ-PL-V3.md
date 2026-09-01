# Gracz.pl V3 — PL-C19 Security / PII evidence

Data decyzji: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — PASS WITH CONDITIONS / FREEZE-SAFE**  
Control ID: `PL-C19`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E06`, `PL-E11`, `PL-E12`, `PL-E14`, `PL-E15`, `PL-E16`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> PL-C19 ocenia, czy privacy/legal evidence i powiązane artefakty bezpieczeństwa są projektowane tak, aby nie zawierały sekretów ani zbędnych danych osobowych. Kontrola nie stanowi certyfikacji produkcyjnej konfiguracji logów, telemetry, secret store ani wszystkich integracji z providerami. Nie autoryzuje implementacji ani deploymentu.

---

## 1. Kryterium kontroli

Kryterium z review pack:

```text
PL-C19 — security / PII evidence
PASS = review artifact nie zawiera sekretów ani zbędnego PII
```

Kontrola jest spełniona na poziomie dokumentacji, jeżeli:

1. evidence zawiera wyłącznie dane potrzebne do wykazania decyzji lub wykonania kontroli;
2. hasła, aktywne tokeny, MFA secrets, klucze, credential material i inne `SECRET` nie są umieszczane w evidence;
3. plaintext prywatnych wiadomości i załączników nie jest kopiowany do audit, logów, outbox, telemetry ani governance artifacts;
4. identyfikatory osób są minimalizowane lub pseudonimizowane tam, gdzie pełna identyfikacja nie jest potrzebna;
5. artefakty incident/privacy/security nie kopiują pełnego payloadu tylko po to, aby udowodnić wykonanie procesu;
6. dane techniczne takie jak IP/UA/correlation ID są traktowane jako potencjalne dane osobowe i ograniczane do potrzebnego celu;
7. provider telemetry i support evidence podlegają tym samym zasadom minimalizacji i ochrony.

---

## 2. Istniejący model klasyfikacji

PL-E06 ustanawia klasy:

- `PUBLIC`;
- `INTERNAL`;
- `PERSONAL`;
- `SENSITIVE`;
- `EVIDENCE`;
- `SECRET`;
- `ANONYMIZED`.

Istotne dla PL-C19 reguły projektowe:

- pseudonimizacja nie oznacza anonimizacji;
- `SECRET` wymaga secret store lub równoważnego mechanizmu, least privilege i zakazu logowania;
- plaintext prywatnych wiadomości, credentiali, MFA secrets i tokenów nie może trafiać do audit, outbox, zwykłych logów, telemetry ani approval evidence;
- audit nie może zawierać pełnego payloadu prywatnej wiadomości, pełnych credentiali, pełnych tokenów ani zbędnego PII;
- privacy request evidence powinien zawierać minimalny subject reference i minimalny proof wykonania;
- logi/traces/telemetry wymagają field-level logging policy oraz automatycznej redakcji/masking przed production GO.

---

## 3. Ocena privacy/legal artifact set

Dla aktualnego zestawu formalnego review przyjmuje się:

| Obszar | Ocena |
|---|---|
| dokumenty PL-E / PL-R / PL-C jako governance artifacts | `PASS` — brak potrzeby umieszczania sekretów w treści |
| review pack ADR-V3-012 | `PASS FOR PACK` |
| mandaty / decision record | `PASS` pod warunkiem przechowywania tylko danych niezbędnych do governance |
| privacy request evidence model | `PASS WITH CONDITIONS` — minimalny proof, brak pełnych dokumentów/tożsamości bez wyjątkowej potrzeby |
| legal hold record | `PASS WITH CONDITIONS` — locator zamiast kopiowania całego poufnego materiału |
| backup/restore evidence | `PASS WITH CONDITIONS` — proof operacyjny bez kopiowania danych źródłowych do dokumentacji |
| logs/traces/telemetry | `OPEN OPERATIONAL EVIDENCE` |
| provider telemetry / support artifacts | `OPEN PROVIDER VERIFICATION` |
| secret-management operational evidence | `OPEN OPERATIONAL EVIDENCE` |

Dokumentacyjny `PASS` nie jest dowodem, że każda przyszła produkcyjna linia logowania, telemetry lub support workflow spełnia te zasady.

---

## 4. Wymagany minimalny evidence pattern

Gdy wystarcza dowód wykonania operacji, preferowany jest rekord typu:

```text
operation_id
control_id
actor_role / pseudonymous actor reference
subject_ref_hmac lub inny minimalny pseudonymous reference
occurred_at
result
scope
policy_version
exception / hold reference
artifact locator
```

Niedozwolone jako domyślny evidence payload:

```text
plaintext password
active token
MFA secret
private encryption key
raw secret environment value
full private message body
full attachment payload
full identity-document copy
complete account export
unredacted request/response body with unrelated PII
```

---

## 5. Security logs i telemetry

Przed produkcją system musi wykazać co najmniej:

1. jawny allowlist/denylist pól logowanych;
2. redaction/masking dla sekretów i PII;
3. brak logowania Authorization headers, cookies/session tokens i reset/recovery tokenów;
4. brak plaintext prywatnych wiadomości i załączników;
5. ograniczenie IP/UA do zaakceptowanego celu i okresu;
6. separację zwykłych app logs od security/audit evidence tam, gdzie mają inny cel i retencję;
7. brak przypadkowego kopiowania payloadów do traces/error reports;
8. testy negatywne potwierdzające brak sekretów/PII leakage.

Samo stwierdzenie w dokumentacji „nie logujemy sekretów” nie jest pełnym dowodem operacyjnym.

---

## 6. Provider evidence i support

Jeżeli dane trafiają do zewnętrznego observability, e-mail, storage, edge/security albo support providera:

- zakres danych musi być jawny i minimalny;
- DPA/rola/transfery muszą być zweryfikowane zgodnie z PL-C13/PL-C14;
- support ticket nie może automatycznie zawierać sekretów ani pełnych prywatnych treści;
- screenshot/dump/trace przed wysłaniem do providera wymaga redakcji;
- provider nie może otrzymywać pełnego profilu użytkownika, jeżeli cel wymaga tylko identyfikatora technicznego lub e-maila;
- retencja provider evidence musi mieć własne kryterium i ownera.

---

## 7. Incident / forensic evidence

Incydent bezpieczeństwa może wymagać zachowania rozszerzonego evidence, ale:

1. zakres musi wynikać z konkretnego incydentu;
2. dane muszą być ograniczone do tego, co potrzebne do analizy;
3. aktywny sekret, który został ujawniony, powinien być rotowany/revoked, a nie przechowywany jako zwykły proof;
4. do trwałego reportu preferuje się hash/fingerprint/locator zamiast kopiowania sekretu;
5. materialny forensic hold wymaga legal-hold record, ownera i expiry/review;
6. po zakończeniu celu evidence podlega zatwierdzonej retencji i purge.

---

## 8. Otwarte warunki

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C19-O01 | wykonać testy field-level redaction/masking dla logs, traces i error reporting | P1 Security/Privacy | Security + Engineering | `OPEN` |
| PL-C19-O02 | potwierdzić rzeczywisty zakres PII/metadata wysyłany do każdego zewnętrznego providera | P1 Privacy/Security | Privacy/Legal + Operations | `OPEN` |
| PL-C19-O03 | wprowadzić kontrolę zapobiegającą umieszczaniu sekretów i nadmiarowego PII w trwałych evidence artifacts | P1 Security/Governance | Security + Governance | `OPEN` |
| PL-C19-O04 | udokumentować produkcyjny model secret store, separacji kluczy, rotacji i least privilege bez ujawniania wartości sekretów | P1 Security | Security/Operations | `OPEN` |
| PL-C19-O05 | pełna DPIA ma objąć ryzyko leakage przez logi, telemetry, support i evidence | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-C19-O06 | po implementacji wykonać negatywny test potwierdzający brak password/token/MFA/private-message leakage | P1 Security/QA | Security + QA | `OPEN` |

---

## 9. Formalna decyzja PL-C19

```text
PL-C19 = PASS WITH CONDITIONS

PRIVACY/LEGAL REVIEW ARTIFACT SET = PASS FOR NO-SECRET / MINIMAL-PII DESIGN
DATA CLASSIFICATION = DEFINED
SECRET IN GOVERNANCE EVIDENCE = PROHIBITED
PASSWORD / TOKEN / MFA SECRET IN LOGS = PROHIBITED
PLAINTEXT PRIVATE MESSAGE IN LOGS / AUDIT / TELEMETRY = PROHIBITED
UNNECESSARY PII IN EVIDENCE = PROHIBITED
FIELD-LEVEL REDACTION OPERATIONAL PROOF = OPEN P1
PROVIDER TELEMETRY SCOPE VERIFICATION = OPEN P1
SECRET-MANAGEMENT OPERATIONAL EVIDENCE = OPEN P1
NEGATIVE LEAKAGE TESTS = OPEN P1

ADR-V3-012 FINAL VERDICT = NO CHANGE / HOLD
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

`PASS WITH CONDITIONS` oznacza, że kryterium review-artifact jest spełnione projektowo i governance'owo, ale pełny produkcyjny status wymaga operacyjnych dowodów redakcji, secret management i provider scope.

---

## 10. Granica autoryzacji

Utworzenie PL-C19:

- nie odczytuje ani nie publikuje sekretów;
- nie zmienia secret store ani konfiguracji środowiska;
- nie modyfikuje logów/telemetry produkcyjnej;
- nie zatwierdza providera observability;
- nie zamyka niezależnych otwartych ustaleń technicznego audytu bezpieczeństwa;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze ani `Production V3 = NO-GO`.

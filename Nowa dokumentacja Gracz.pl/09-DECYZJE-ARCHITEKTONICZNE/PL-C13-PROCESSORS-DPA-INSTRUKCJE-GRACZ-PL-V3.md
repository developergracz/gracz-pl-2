# Gracz.pl V3 — PL-C13 Procesorzy, DPA i instrukcje przetwarzania

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C13`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — HOLD / VERSIONED / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E07`, `PL-E08`, `PL-E09`, `PL-E15`, `PL-E16`

> PL-C13 weryfikuje, czy każdy dostawca przetwarzający dane osobowe w imieniu administratora Gracz.pl ma ustaloną rolę, właściwy kontrakt/DPA, udokumentowane instrukcje, kontrolę subprocesorów, retencji, deletion/return, backupów, incydentów i wsparcia praw osób. Kontrola nie zatwierdza żadnego providera ani nie zmienia konfiguracji produkcyjnej.

---

## 1. Kryterium kontroli

`PASS` dla PL-C13 wymaga, aby każdy rzeczywiście używany procesor danych osobowych spełniał łącznie:

1. zidentyfikowaną legal entity;
2. ustaloną rzeczywistą rolę prawną;
3. zatwierdzony DPA/processor contract, jeżeli wymagany;
4. udokumentowane instrukcje administratora;
5. jawny zakres danych, osób i celów;
6. listę lub mechanizm kontroli subprocesorów;
7. potwierdzone regiony przetwarzania i transfery;
8. wymagania bezpieczeństwa i incident notification;
9. mechanizmy wsparcia praw osób;
10. retencję, deletion/return i offboarding;
11. zasady backup/restore i deletion propagation;
12. trwały evidence locator, ownera review i datę ponownego przeglądu.

Brak materialnego dowodu dla aktywnego providera oznacza `HOLD`.

---

## 2. Stan evidence

### PL-E07 — rejestr odbiorców/procesorów

PL-E07 identyfikuje na poziomie architektury m.in. Render, Cloudflare Turnstile i Resend oraz klasy nadal przyszłych dostawców: object storage, observability i MFA/SMS.

Stan nie jest jednak finalny:

- Render: rola/DPA/regiony/subprocesorzy/transfery — `TO VERIFY`;
- Cloudflare Turnstile: `INTEGRATED IN CODE`; dokładna rola per usługa, account/widget approval, DPA/subprocesorzy/transfery — `ACCOUNT EVIDENCE PENDING`;
- e-mail/newsletter — Resend `INTEGRATED IN CODE`; account approval / executed DPA / aktywna domena i plan — `ACCOUNT EVIDENCE PENDING`;
- object storage — provider nie wybrany;
- observability — provider nie wybrany albo może być self-hosted;
- MFA/SMS — niezatwierdzone; inne przyszłe anti-abuse wymagają osobnego gate.

### PL-E08 — kontraktowa warstwa procesorów

PL-E08 definiuje minimalny standard DPA i instrukcji administratora, ale jego formalny status pozostaje `HOLD`, ponieważ rzeczywiste DPA/umowy nie zostały zweryfikowane.

---

## 3. Baseline instrukcji procesora

Dla każdego procesora Gracz.pl obowiązuje co najmniej:

- **purpose limitation** — przetwarzanie tylko dla zatwierdzonej usługi;
- **data minimization** — tylko dane rzeczywiście potrzebne;
- **no secrets leakage** — brak sekretów, tokenów, MFA secrets i plaintext prywatnych wiadomości w logach/support/evidence;
- **retention alignment** — provider nie może utrzymywać danych bezterminowo ani dłużej bez jawnej oceny;
- **deletion / return** — musi istnieć mechanizm skutecznego delete/return/offboarding;
- **backup / restore** — backup nie jest archiwum; restore musi respektować deletion/restriction/legal hold state;
- **subprocessors** — zmiany nie mogą pozostawać poza governance;
- **transfers** — dostęp spoza EOG wymaga odrębnej oceny;
- **incident handling** — wymagane terminowe powiadomienie administratora;
- **rights support** — provider musi wspierać access, export, rectification, restriction i deletion tam, gdzie dotyczy jego systemów.

---

## 4. Macierz PL-C13

| ID | Zakres | Status kontroli | Uzasadnienie |
|---|---|---|---|
| PL-C13-01 | inventory providerów | `PASS WITH CONDITIONS` | rejestr architektoniczny istnieje, lecz wymaga aktualizacji wraz z realnym stanem produkcyjnym |
| PL-C13-02 | ustalenie roli providera | `HOLD` | Render i Cloudflare nadal wymagają formalnej kwalifikacji per faktycznie używana usługa |
| PL-C13-03 | DPA / processor contract | `HOLD` | brak zweryfikowanego kontraktowego evidence dla aktywnych kandydatów |
| PL-C13-04 | instrukcje administratora | `PASS WITH CONDITIONS` | baseline I01–I10 jest udokumentowany w PL-E08 |
| PL-C13-05 | subprocessors | `HOLD` | listy/mechanizmy niezweryfikowane dla aktywnych providerów |
| PL-C13-06 | regiony / transfery | `HOLD` | wymagają kontroli per provider i per usługa |
| PL-C13-07 | retencja / deletion / return | `HOLD` | wymaga potwierdzenia kontraktowego i konfiguracyjnego |
| PL-C13-08 | backup / restore | `HOLD` | wymagane potwierdzenie provider lifecycle i zgodności z PL-E15 |
| PL-C13-09 | prawa osób | `HOLD` | brak dowodu praktycznej i kontraktowej obsługi przez providerów |
| PL-C13-10 | incident handling | `HOLD` | kontraktowe SLA/obowiązki jeszcze niezweryfikowane |
| PL-C13-11 | durable evidence locator | `HOLD` | brak kompletnego provider-contract register z locatorami |
| PL-C13-12 | provider approval gate | `PASS` jako reguła governance | niezweryfikowany provider nie może wejść do produkcyjnego przepływu danych |

---

## 5. Minimalny provider approval record

Dla każdego zatwierdzonego providera musi powstać trwały rekord co najmniej:

```text
PROVIDER LEGAL NAME =
SERVICE =
ROLE =
DATA CATEGORIES =
DATA SUBJECT CATEGORIES =
PURPOSE =
DPA / CONTRACT VERSION =
DPA EFFECTIVE DATE =
DPA LOCATOR =
SUBPROCESSOR LIST LOCATOR =
PROCESSING / STORAGE REGIONS =
REMOTE ACCESS REGIONS =
TRANSFER MECHANISM =
SECURITY TERMS LOCATOR =
INCIDENT / BREACH TERMS =
RETENTION / DELETE TERMS =
BACKUP / RESTORE TERMS =
RIGHTS SUPPORT =
OFFBOARDING / RETURN / DELETE TERMS =
REVIEWED BY =
REVIEW DATE =
NEXT REVIEW DATE =
FINAL STATUS = APPROVED / APPROVED WITH CONDITIONS / HOLD / REJECTED
```

Nie należy umieszczać w takim rejestrze sekretów ani poufnej treści kontraktowej, jeżeli wystarcza trwały locator.

---

## 6. Otwarte blokery

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C13-O01 | zweryfikować legal entity, rolę i DPA/contract Render | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C13-O02 | zweryfikować dokładny scope usług, rolę i DPA/transfer Cloudflare | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C13-O03 | zebrać account-specific evidence Resend i zatwierdzić provider przed produkcyjnym użyciem | P1 Privacy/Legal | Privacy/Legal + Technical Owner | `OPEN` |
| PL-C13-O04 | zatwierdzić object storage załączników przed produkcyjnym użyciem | P1 Privacy/Legal | Privacy/Legal + Messaging Owner | `OPEN` |
| PL-C13-O05 | zatwierdzić docelowy observability model/provider i zakres PII | P1 Privacy/Security | Privacy/Legal + Security/Ops | `OPEN` |
| PL-C13-O06 | dla każdego aktywnego providera potwierdzić subprocessors, regiony, transfery, deletion/return, backups i incident terms | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-C13-O07 | utworzyć provider-contract register z durable locatorami i next-review dates | P2 Governance | Privacy/Legal Decision Owner | `OPEN` |
| PL-C13-O08 | zsynchronizować finalny provider state z ROPA, privacy notice, PL-E07, PL-E08, PL-E15 | P1 Privacy/Legal | Privacy/Legal | `OPEN` |

---

## 7. Formalna decyzja PL-C13

```text
PL-C13 = HOLD

PROCESSOR INVENTORY = ESTABLISHED AT DESIGN LEVEL
PROCESSOR INSTRUCTION BASELINE = DOCUMENTED
ACTUAL DPA / CONTRACT EVIDENCE = NOT VERIFIED
RENDER = HOLD PENDING ROLE / DPA / SUBPROCESSORS / REGIONS / TRANSFERS
CLOUDFLARE = HOLD PENDING SERVICE-SPECIFIC ROLE / DPA / SUBPROCESSORS / TRANSFERS
RESEND EMAIL API = INTEGRATED IN CODE / ACCOUNT APPROVAL OR ACCOUNT-SPECIFIC EVIDENCE PENDING
CLOUDFLARE TURNSTILE = INTEGRATED IN CODE / ACCOUNT APPROVAL OR ACCOUNT-SPECIFIC EVIDENCE PENDING
FUTURE STORAGE / OBSERVABILITY PROVIDERS = NOT APPROVED
UNVERIFIED PROCESSOR MAY ENTER PRODUCTION = NO
DURABLE CONTRACT LOCATORS = INCOMPLETE
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

`HOLD` wynika z braku zweryfikowanych umów/DPA i rzeczywistych danych o providerach, a nie z odrzucenia samej architektury.

---

## 8. Granica autoryzacji

Utworzenie PL-C13:

- nie zatwierdza Render, Cloudflare ani żadnego nowego providera;
- nie zawiera zgody na transfer danych;
- nie zawiera ani nie publikuje kontraktów;
- nie zmienia Render, Cloudflare, DNS, bazy, sekretów ani konfiguracji produkcyjnej;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

# Gracz.pl V3 — PL-C17 Privacy by Design / Privacy by Default

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C17`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — PASS WITH CONDITIONS / ARCHITECTURE PASS / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E05`, `PL-E06`, `PL-E11`, `PL-E12`, `PL-E14`, `PL-E15`, `PL-E16`  
Powiązane kontrole: `PL-C01–PL-C16`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Ten dokument formalizuje kontrolę PL-C17 dla Gracz.pl V3. Ocenia, czy privacy by design/default jest rzeczywiście osadzona w architekturze, a nie tylko opisana jako deklaracja. Nie stanowi dowodu implementacji produkcyjnej i nie autoryzuje deploymentu ani zmian produkcyjnych.

---

## 1. Kryterium PASS

Kryterium z formalnego review pack:

```text
PL-C17 — privacy by design
PASS CRITERION = deletion ledger, receipts i anti-resurrection wspierają decyzję Privacy/Legal
```

Dla formalnego review Gracz.pl przyjmuje się szersze kryterium:

1. minimalizacja i purpose limitation są zaszyte w modelu danych i przepływach;
2. domyślna ekspozycja danych jest najwęższa rozsądna dla funkcji;
3. prawa osoby są wspierane jako projekt systemowy, a nie wyłącznie procedura ręczna;
4. deletion/restriction obejmuje wszystkie bounded contexts;
5. istnieje deletion ledger / receipts / replay po restore;
6. backup nie może odwrócić wcześniejszego delete/unsubscribe/restriction;
7. legal hold jest wąski, wersjonowany i nie zmienia zwykłego celu przetwarzania;
8. prywatna komunikacja i sekrety mają domyślnie ograniczony dostęp;
9. provider nie może wejść do produkcyjnego przepływu danych bez approval gate;
10. małoletni 16–17 otrzymują bardziej restrykcyjne ustawienia domyślne;
11. zmiana celu, danych, providera, telemetry lub ryzyka uruchamia ponowne Privacy/Legal review.

---

## 2. Ocena warstwowa

| Obszar | Wymaganie privacy by design/default | Stan review |
|---|---|---|
| Identity / konto | minimum danych, brak zbędnych danych identyfikacyjnych, revoke/delete workflow | `DESIGN PASS / IMPLEMENTATION EVIDENCE OPEN` |
| Publiczny profil | publikacja tylko jawnie zatwierdzonych pól | `DESIGN PASS / PRODUCT TEST OPEN` |
| Małoletni 16–17 | bardziej restrykcyjne privacy defaults, brak marketingowego profilingu | `DESIGN PASS / FULL DPIA OPEN` |
| Prywatne wiadomości | brak publicznej ekspozycji, ścisły dostęp, brak plaintext w logach/audit/outbox | `DESIGN PASS / ACCESS MODEL + TESTS OPEN` |
| Chat / social | kontrolowana ekspozycja, moderacja, delete/restriction | `DESIGN PASS / MINORS + MODERATION CONDITIONS` |
| Gry / ranking / replay | identyfikowalne dane czasowe, anonimowy replay tylko po skutecznej anonimizacji | `DESIGN PASS / ANONYMIZATION TEST OPEN` |
| Newsletter | odrębna zgoda, unsubscribe zatrzymuje marketing, brak reaktywacji po restore | `DESIGN PASS / RETENTION + PROVIDER HOLD` |
| Moderacja | human review dla poważnych sankcji, minimalne evidence | `DESIGN PASS / LIA + DPIA OPEN` |
| Audit | minimum metadata, bez sekretów i pełnych prywatnych payloadów | `DESIGN PASS / RETENTION + OPERATIONAL EVIDENCE OPEN` |
| Privacy requests | idempotent workflow, receipts, restriction, delete, access/export | `DESIGN PASS / OPERATIONAL TESTS OPEN` |
| Backup / restore | natural expiry, isolated restore, deletion replay, anti-resurrection | `ARCHITECTURE PASS / OPERATIONAL EVIDENCE OPEN` |
| Providerzy | approval gate przed produkcyjnym przepływem danych | `DESIGN PASS / PL-C13 + PL-C14 HOLD` |

---

## 3. Privacy by default — wymagania domyślne

Gracz.pl V3 nie może przyjmować ustawień domyślnych maksymalizujących publikację lub zakres przetwarzania.

### 3.1. Profil

Domyślnie:

- e-mail nie jest publiczny;
- dokładny wiek/data urodzenia nie są publiczne;
- lokalizacja nie jest zbierana ani publikowana w baseline;
- publiczna jest wyłącznie zatwierdzona nazwa/alias i elementy rzeczywiście wymagane przez funkcję;
- usunięcie konta wyłącza publiczną widoczność zgodnie z PL-R01.

### 3.2. Użytkownicy 16–17

Domyślnie:

- brak marketingowego profilowania;
- brak ujawniania wieku, danych kontaktowych i lokalizacji;
- bardziej restrykcyjne ustawienia ekspozycji;
- łatwy block/report;
- funkcje social i wiadomości wymagają safeguards ocenionych w pełnej DPIA.

### 3.3. Newsletter

Domyślnie:

- brak subskrypcji bez odrębnego działania użytkownika;
- brak łączenia newslettera z marketingowym profilem historii gier lub prywatnych wiadomości;
- unsubscribe/withdrawal blokuje przyszłe wysyłki;
- restore nie może reaktywować wcześniejszej zgody lub subskrypcji.

### 3.4. Telemetry / logi

Domyślnie:

- brak pełnych tokenów, haseł, MFA secrets i prywatnych wiadomości;
- IP/UA i inne sygnały osobowe wyłącznie, gdy zakres jest uzasadniony i zatwierdzony;
- agregaty bez identyfikatorów preferowane tam, gdzie cel nie wymaga danych osobowych.

---

## 4. Deletion ledger, receipts i anti-resurrection

Architektura Privacy/Legal wymaga:

```text
DELETE REQUEST
 -> SCOPE DISCOVERY
 -> PER-CONTEXT DECISION
 -> PURGE / ANONYMIZE / RESTRICT / VALID EXCEPTION
 -> RECEIPTS
 -> DELETION LEDGER
 -> VALIDATION
```

Po restore:

```text
RESTORE ISOLATED
 -> LOAD DELETION / RESTRICTION / CONSENT / HOLD STATE
 -> REPLAY
 -> NEGATIVE VALIDATION
 -> ONLY THEN ELIGIBLE FOR CONTROLLED USE
```

Wymagania bezwzględne:

- brak przywrócenia usuniętego konta jako aktywnego;
- brak ponownego pojawienia się publicznego profilu po delete;
- brak reaktywacji newslettera po unsubscribe;
- brak odtworzenia ważności revoked credentials/tokens;
- aktywne restriction nadal blokuje zwykłe użycie;
- active legal hold chroni tylko swój jawnie określony zakres;
- released hold nie może „ożyć” z backupu.

To właśnie ten model stanowi główną podstawę `ARCHITECTURE PASS` PL-C17.

---

## 5. Separation of purposes i bounded contexts

Privacy by design wymaga, aby wspólny `user_id` nie oznaczał dowolnego prawa łączenia danych pomiędzy domenami.

Niedozwolone bez odrębnego review:

- użycie prywatnych wiadomości do marketingu;
- użycie historii gier do newsletter profilingu;
- użycie moderation evidence do zwykłej personalizacji produktu;
- kopiowanie wiadomości do observability;
- kopiowanie security telemetry do marketing analytics;
- globalny stały pseudonim pozwalający śledzić użytkownika pomiędzy wszystkimi domenami bez potrzeby.

Każde wtórne użycie wymaga aktualizacji PL-C01/PL-C02, ROPA, privacy notice, retencji i — jeżeli właściwe — DPIA.

---

## 6. Security jako część privacy by design

Privacy by design obejmuje ochronę poufności i integralności danych, ale PL-C17 nie zastępuje odrębnej kontroli bezpieczeństwa.

Minimalne założenia projektowe:

- least privilege;
- RBAC i MFA dla uprzywilejowanego dostępu;
- oddzielenie sekretów od zwykłych danych aplikacyjnych;
- brak plaintext sekretów w logach/evidence;
- szyfrowanie prywatnej komunikacji tam, gdzie określa to architektura;
- audyt uprzywilejowanych działań;
- redaction telemetry;
- dostęp do prywatnych treści tylko według jawnego i zatwierdzonego modelu.

Dowód operacyjny tych mechanizmów pozostaje odrębnym warunkiem production readiness.

---

## 7. Provider approval gate jako privacy by design

Nowy provider nie może zostać uznany za dopuszczony wyłącznie dlatego, że integracja technicznie działa.

Przed wejściem danych osobowych do providera muszą zostać zamknięte, odpowiednio do roli:

- purpose i data scope;
- legal role;
- DPA/contract;
- subprocessors;
- regions i remote access;
- transfer mechanism;
- retention/delete/return;
- backup lifecycle;
- security/incidents;
- assistance with data subject rights;
- offboarding;
- privacy notice / ROPA update.

Aktualne `PL-C13 = HOLD` i `PL-C14 = HOLD` nie negują privacy-by-design architektury, ale blokują pełny production PASS.

---

## 8. Change triggers

Ponowny Privacy/Legal review jest wymagany co najmniej przy:

- dopuszczeniu użytkowników poniżej 16 lat;
- zmianie modelu 16–17;
- nowym profilu publicznym lub większej ekspozycji social;
- nowej telemetry, device fingerprinting lub anti-cheat;
- automatycznych sankcjach bez human review;
- nowym providerze albo subprocesorze;
- nowym transferze poza EOG;
- nowym celu wtórnego użycia danych;
- zwiększeniu zakresu prywatnych wiadomości/załączników;
- zmianie retencji lub legal hold;
- zmianie modelu backup/restore/deletion replay;
- nowej klasie danych osobowych lub szczególnych kategorii;
- zmianie skali mogącej wpływać na ryzyko DPIA.

---

## 9. Otwarte warunki

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C17-O01 | wykonać pełną DPIA i ocenić skuteczność privacy-by-default dla 16–17, wiadomości, moderacji i telemetry | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C17-O02 | przed produkcją wykonać end-to-end test delete/restriction/receipts/deletion-ledger | P1 Privacy/Operations | Engineering + Privacy/Legal | `OPEN` |
| PL-C17-O03 | wykonać restore + deletion replay + anti-resurrection test | P1 Privacy/Operations | Operations + Privacy/Legal | `OPEN` |
| PL-C17-O04 | zweryfikować privacy defaults publicznego profilu i użytkowników 16–17 | P1 Privacy/Product | Product + Privacy/Legal | `OPEN` |
| PL-C17-O05 | dostarczyć operational evidence redaction logów/telemetry i braku sekretów/private payloads | P1 Security/Privacy | Security + Engineering | `OPEN` |
| PL-C17-O06 | zamknąć provider approval gate dla realnie używanych providerów | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-C17-O07 | przetestować skuteczną anonimizację replay/agregatów, jeżeli mają być zachowywane jako anonimowe | P1 Privacy/Technical | Engineering + Privacy/Legal | `OPEN` |

---

## 10. Formalna decyzja PL-C17

```text
PL-C17 = PASS WITH CONDITIONS

PRIVACY BY DESIGN ARCHITECTURE = PASS
PRIVACY BY DEFAULT MODEL = DEFINED
DELETION LEDGER = REQUIRED BY DESIGN
PER-CONTEXT RECEIPTS = REQUIRED BY DESIGN
DELETION / RESTRICTION REPLAY AFTER RESTORE = REQUIRED
ANTI-RESURRECTION = REQUIRED
BACKUP AS HIDDEN ARCHIVE = PROHIBITED
UNSUBSCRIBE REACTIVATION AFTER RESTORE = PROHIBITED
MINORS 16–17 RESTRICTIVE DEFAULTS = REQUIRED
CROSS-PURPOSE DATA COMBINATION = NOT ALLOWED WITHOUT NEW REVIEW
PROVIDER APPROVAL GATE = REQUIRED
FULL DPIA = OPEN P1
OPERATIONAL E2E EVIDENCE = OPEN P1
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

Uzasadnienie: review pack już ocenia PL-C17 jako `ARCHITECTURE PASS`. Aktualny formalny review potwierdza ten wynik dla warstwy projektowej. Pełny bezwarunkowy PASS nie jest jednak jeszcze możliwy, ponieważ brak pełnej DPIA oraz operacyjnych dowodów end-to-end dla delete/restriction/restore/anti-resurrection i providerów.

---

## 11. Granica autoryzacji

Utworzenie PL-C17:

- potwierdza wyłącznie formalną ocenę warstwy privacy-by-design/default;
- nie potwierdza, że wszystkie mechanizmy są zaimplementowane;
- nie zamyka PL-C13, PL-C14 ani PL-C16;
- nie zastępuje testów produkcyjnych ani pre-production evidence;
- nie autoryzuje implementacji;
- nie autoryzuje deploymentu;
- nie zdejmuje freeze;
- nie zmienia `REVIEWED DESIGN GATE = HOLD` ani `Production V3 = NO-GO`.

# Gracz.pl V3 — PL-E08 Umowy powierzenia i instrukcje dla procesorów

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E08`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązany rejestr odbiorców/procesorów: `PL-E07-ODBIORCY-PROCESORZY-TRANSFER-DANYCH-GRACZ-PL-V3.md`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Ten dokument jest artefaktem evidence dla PL-E08. Określa wymagany kontrakt powierzenia/instrukcji dla dostawców, którzy przetwarzają dane osobowe w imieniu administratora Gracz.pl. Nie stanowi potwierdzenia, że konkretna umowa/DPA została już zawarta lub zaakceptowana. Brak zweryfikowanego DPA albo równoważnego kontraktu tam, gdzie jest wymagany, pozostawia danego providera w statusie `HOLD / NOT APPROVED FOR FINAL V3`.

---

## 1. Administrator i właściciel decyzji

| Pole | Wartość |
|---|---|
| Administrator | **Czesław Socha — osoba fizyczna prowadząca projekt Gracz.pl we własnym imieniu** |
| Projekt | `Gracz.pl` |
| Jurysdykcja | Polska / UE — RODO/GDPR |
| Privacy/Legal Decision Owner | Czesław Socha |
| Implementacja / deployment | `NOT AUTHORIZED / FREEZE ACTIVE` |

---

## 2. Zasada kwalifikacji

Dla każdego dostawcy należy najpierw ustalić rzeczywistą rolę prawną i operacyjną. Sama integracja techniczna albo nazwa usługi nie przesądza, czy podmiot jest procesorem, odrębnym administratorem, współadministratorem albo działa w innej roli.

Jeżeli podmiot przetwarza dane osobowe w imieniu administratora, przed produkcyjnym użyciem musi istnieć zatwierdzony kontrakt/DPA oraz udokumentowane instrukcje przetwarzania obejmujące co najmniej zakres danych, cele, bezpieczeństwo, podwykonawców, retencję, usuwanie/zwrot, incydenty i pomoc w realizacji praw osób.

---

## 3. Minimalna treść kontraktu/DPA

Dla procesu uznanego za relację administrator–procesor wymagany pakiet powinien obejmować co najmniej:

1. przedmiot i czas trwania przetwarzania;
2. charakter i cel przetwarzania;
3. rodzaje danych osobowych;
4. kategorie osób, których dane dotyczą;
5. obowiązki i prawa administratora;
6. zobowiązanie do przetwarzania wyłącznie na udokumentowane instrukcje administratora, z wyjątkiem przypadków wymaganych prawem;
7. poufność osób upoważnionych do przetwarzania;
8. odpowiednie środki techniczne i organizacyjne;
9. zasady korzystania z dalszych procesorów/subprocesorów;
10. obowiązek pomocy przy realizacji praw osób;
11. pomoc w zakresie bezpieczeństwa, incydentów, DPIA i konsultacji, jeśli ma zastosowanie;
12. po zakończeniu usługi — zwrot albo usunięcie danych według decyzji administratora, z uwzględnieniem obowiązków prawnych;
13. udostępnianie informacji potrzebnych do wykazania zgodności i umożliwienie rozsądnego audytu/oceny;
14. zasady lokalizacji i transferów poza EOG;
15. zasady backupów, restore i deletion propagation;
16. termin i sposób notyfikacji naruszenia lub incydentu;
17. zasady offboardingu, eksportu oraz potwierdzenia usunięcia/zwrotu danych.

---

## 4. Instrukcje administratora — baseline Gracz.pl

Każdy zatwierdzony procesor powinien otrzymać instrukcje zgodne z następującymi zasadami:

### PL-E08-I01 — purpose limitation
Procesor może używać danych wyłącznie w celu świadczenia zatwierdzonej usługi dla Gracz.pl. Własne cele dostawcy wymagają odrębnej oceny roli i podstawy.

### PL-E08-I02 — data minimisation
Przekazywany jest tylko zakres danych niezbędny do konkretnej funkcji. Provider newslettera nie otrzymuje pełnego profilu użytkownika, provider observability nie otrzymuje treści prywatnych wiadomości, a provider edge nie może być traktowany jako miejsce archiwizacji danych aplikacyjnych.

### PL-E08-I03 — secrets and private content
Sekrety, klucze, tokeny oraz plaintext prywatnych wiadomości nie mogą być umieszczane w logach, telemetry, standardowych zgłoszeniach support ani evidence artifacts.

### PL-E08-I04 — retention
Procesor nie może przechowywać danych dłużej niż wynika to z zatwierdzonego celu i polityki Gracz.pl. Własna retencja providera dłuższa niż polityka administratora wymaga jawnej oceny i uzasadnienia.

### PL-E08-I05 — deletion and return
Procesor musi wspierać skuteczne usunięcie lub zwrot danych po zakończeniu usługi i po prawidłowym privacy request, z uwzględnieniem kontrolowanego cyklu backupów.

### PL-E08-I06 — backup and restore
Backup nie jest ukrytym archiwum. Restore wymagający ponownego wprowadzenia danych musi respektować deletion ledger, aktywne holds oraz politykę anti-resurrection ADR-V3-012.

### PL-E08-I07 — subprocessors
Nowy subprocesor nie może zostać zignorowany w governance. Administrator musi mieć dostęp do aktualnej listy subprocesorów i mechanizmu zgłaszania istotnych zmian.

### PL-E08-I08 — transfer outside EEA
Dostęp lub przetwarzanie spoza EOG wymaga uprzedniej oceny mechanizmu transferowego i zgodności z PL-E07. Nie zakłada się braku transferu tylko dlatego, że storage ma region UE.

### PL-E08-I09 — incident handling
Procesor musi zgłosić administratorowi incydent lub naruszenie danych bez zbędnej zwłoki zgodnie z umową, wraz z informacjami umożliwiającymi ocenę skutków i obowiązków administratora.

### PL-E08-I10 — data subject rights
Procesor musi zapewnić techniczną i organizacyjną pomoc umożliwiającą lokalizację, eksport, sprostowanie, restriction i usunięcie danych w zakresie jego systemów.

---

## 5. Macierz statusu umów / DPA

| ID | Provider / kategoria | Rola z PL-E07 | DPA / kontrakt | Instrukcje delete/return | Subprocesorzy | Backup/deletion | Status PL-E08 |
|---|---|---|---|---|---|---|---|
| PL-E08-P01 | Render | `PROCESSOR CANDIDATE — TO VERIFY` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `HOLD` |
| PL-E08-P02 | Cloudflare | `ROLE DEPENDS ON SERVICE — TO VERIFY` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `NOT VERIFIED` | `HOLD` |
| PL-E08-P03 | provider poczty/newslettera | `NOT SELECTED` | `N/A UNTIL SELECTED` | `N/A UNTIL SELECTED` | `N/A UNTIL SELECTED` | `N/A UNTIL SELECTED` | `NOT APPROVED` |
| PL-E08-P04 | object storage / attachment storage | `NOT SELECTED` | `N/A UNTIL SELECTED` | `N/A UNTIL SELECTED` | `N/A UNTIL SELECTED` | `N/A UNTIL SELECTED` | `NOT APPROVED` |
| PL-E08-P05 | observability/logging | `NOT SELECTED / MAY BE SELF-HOSTED` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |
| PL-E08-P06 | MFA/SMS provider, jeśli użyty | `NOT CURRENTLY APPROVED` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |
| PL-E08-P07 | anti-abuse/CAPTCHA, jeśli użyty | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |

---

## 6. Wymagany evidence locator dla zatwierdzonego providera

Dla każdego providera oznaczonego przyszłościowo jako `APPROVED` należy zapisać trwały rekord bez umieszczania sekretów ani zbędnego PII:

```text
PROVIDER LEGAL NAME =
SERVICE / ROLE =
DPA / CONTRACT VERSION =
DPA EFFECTIVE DATE =
DPA LOCATOR =
SUBPROCESSOR LIST LOCATOR =
PROCESSING REGIONS =
TRANSFER MECHANISM =
SECURITY TERMS LOCATOR =
RETENTION / DELETE TERMS LOCATOR =
BACKUP / RESTORE TERMS LOCATOR =
BREACH NOTIFICATION TERMS =
DATA SUBJECT RIGHTS SUPPORT =
OFFBOARDING / RETURN / DELETE TERMS =
REVIEWED BY =
REVIEW DATE =
NEXT REVIEW DATE =
FINAL STATUS = APPROVED / APPROVED WITH CONDITIONS / HOLD / REJECTED
```

---

## 7. Kryteria PASS dla PL-E08

`PL-E08 = PASS` jest możliwe dopiero, gdy dla wszystkich providerów rzeczywiście używanych do przetwarzania danych osobowych:

1. ustalono ich rolę;
2. zweryfikowano wymagany DPA/kontrakt;
3. potwierdzono subprocesorów;
4. potwierdzono regiony i transfery;
5. potwierdzono bezpieczeństwo i incident handling;
6. potwierdzono realizację praw osób;
7. potwierdzono retencję, deletion/return i backup lifecycle;
8. zapisano durable evidence locatory;
9. nie istnieje otwarty materialny P0/P1 dotyczący relacji procesorowej.

Brak takiego dowodu dla aktywnego providera nie może zostać uznany za `PASS` tylko na podstawie standardowej nazwy usługi albo deklaracji marketingowej providera.

---

## 8. Otwarte ustalenia

| ID | Ustalenie | Severity | Owner | Status |
|---|---|---|---|---|
| PL-E08-O01 | Zweryfikować rzeczywistą rolę Render oraz DPA/contract terms | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-E08-O02 | Zweryfikować dokładny zakres usług Cloudflare i właściwe warunki DPA/transfer | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-E08-O03 | Dla przyszłego providera poczty/newslettera wykonać provider approval gate przed użyciem produkcyjnym | P1 Privacy/Legal | Privacy/Legal + Technical Owner | `OPEN` |
| PL-E08-O04 | Dla przyszłego object storage wykonać provider approval gate z naciskiem na attachment deletion i backup | P1 Privacy/Legal | Privacy/Legal + Messaging Owner | `OPEN` |
| PL-E08-O05 | Utworzyć trwały provider-contract register z locatorami umów/DPA | P2 Governance | Privacy/Legal Decision Owner | `OPEN` |

---

## 9. Ocena PL-E08

```text
PL-E08 = HOLD

REASON = ACTUAL DPA / PROCESSOR CONTRACT EVIDENCE NOT YET VERIFIED
RENDER DPA = NOT VERIFIED
CLOUDFLARE ROLE / DPA = NOT VERIFIED
FUTURE PROVIDERS = NOT SELECTED / NOT APPROVED
PROCESSOR INSTRUCTION BASELINE = DOCUMENTED
DURABLE CONTRACT LOCATORS = MISSING
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Status `HOLD` nie oznacza odrzucenia architektury ani providera. Oznacza wyłącznie, że formalny evidence wymagany dla PL-E08 nie został jeszcze zebrany i zweryfikowany.

---

## 10. Relacja do dalszego review

- PL-E07 pozostaje rejestrem providerów i transferów;
- PL-E08 jest kontraktową warstwą potwierdzenia relacji z procesorami;
- PL-E09 privacy notice nie może przedstawiać niezweryfikowanych dostawców jako finalnie zatwierdzonych;
- PL-E13/PL-E15 muszą odpowiadać rzeczywistym warunkom deletion, retention i backup zapisanym w umowach providerów;
- finalne `ADR-V3-012 PASS / ACCEPTED` nie jest możliwe, jeżeli aktywny provider wymagający DPA pozostaje bez zweryfikowanego kontraktu.

---

## 11. Granica autoryzacji

Utworzenie tego dokumentu:

- nie zawiera ani nie publikuje żadnej umowy z dostawcą;
- nie akceptuje automatycznie Render ani Cloudflare jako procesora;
- nie uruchamia nowego providera;
- nie zmienia produkcji, Rendera, Cloudflare, sekretów ani DNS;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze.

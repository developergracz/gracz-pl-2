# Gracz.pl V3 — PL-C14 Transfer danych poza EOG

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C14`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — HOLD / VERSIONED / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E07`, `PL-E08`, `PL-E09`, `PL-E11`, `PL-E16`  
Powiązane kontrole: `PL-C13`

> Dokument ocenia, czy projekt Gracz.pl V3 posiada wystarczający, udokumentowany model kontroli transferów danych osobowych poza Europejski Obszar Gospodarczy. Nie jest opinią prawną i nie potwierdza, że jakikolwiek konkretny transfer został już formalnie zatwierdzony.

---

## 1. Werdykt

```text
PL-C14 = HOLD

REASON:
- provider-specific transfer status is not yet verified;
- Render regions / subprocessors / remote access / transfer mechanism = TO VERIFY;
- Cloudflare service scope / subprocessors / remote access / transfer mechanism = TO VERIFY;
- future e-mail/newsletter, object-storage, observability, MFA/SMS and anti-abuse providers are not yet approved;
- actual DPA / processor contract evidence is not fully verified;
- privacy notice cannot yet describe a final transfer model;
- full DPIA remains required before production.

IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

`HOLD` nie oznacza, że transfer poza EOG na pewno występuje albo że jest niedopuszczalny. Oznacza, że brak jeszcze wystarczającego evidence, aby uczciwie oznaczyć kontrolę jako `PASS`.

---

## 2. Zasada nadrzędna

Gracz.pl nie przyjmuje uproszczenia typu:

```text
EU REGION = NO TRANSFER
PROVIDER HAS EU DATACENTER = NO TRANSFER
PROVIDER BRAND / COUNTRY = TRANSFER APPROVED
STANDARD CONTRACT = AUTOMATIC PASS
```

Dla każdego rzeczywiście używanego dostawcy i subprocesora należy zweryfikować faktyczny przepływ danych, role, miejsca storage i processing, dostęp support/operations oraz mechanizmy transferowe, jeżeli mają zastosowanie.

---

## 3. Minimalny zakres kontroli transferu per provider

Dla każdego providera należy ustalić co najmniej:

1. pełną nazwę prawną dostawcy;
2. rzeczywistą rolę prawną dla konkretnej usługi;
3. dokładny zakres danych i kategorii osób;
4. region storage;
5. region runtime/processing;
6. lokalizacje support i operations;
7. listę subprocesorów;
8. możliwość dostępu administracyjnego spoza EOG;
9. czy dochodzi do transferu albo udostępnienia wymagającego odrębnej podstawy transferowej;
10. właściwy mechanizm transferowy, jeśli jest wymagany;
11. czy potrzebna jest dodatkowa ocena ryzyka transferu;
12. dostępne środki techniczne ograniczające zakres transferu;
13. zasady retencji i deletion po stronie providera/subprocesorów;
14. zasady backupów i ich lokalizacji;
15. obsługę privacy requests i offboardingu;
16. durable evidence locator;
17. ownera, datę review i termin kolejnego przeglądu.

Brak materialnego elementu oznacza `HOLD` dla danego providera albo danej konfiguracji.

---

## 4. Aktualna macierz providerów

| Provider / kategoria | Status regionu / dostępu | Status transferu | DPA / contract | Decyzja PL-C14 |
|---|---|---|---|---|
| Render | `TO VERIFY` | `TO VERIFY` | `NOT VERIFIED` | `HOLD` |
| Cloudflare | `TO VERIFY PER SERVICE` | `TO VERIFY` | `NOT VERIFIED` | `HOLD` |
| provider e-mail/newsletter | `NOT SELECTED` | `PENDING` | `PENDING` | `NOT APPROVED` |
| object storage | `NOT SELECTED` | `PENDING` | `PENDING` | `NOT APPROVED` |
| observability/logging | `NOT SELECTED / MAY BE SELF-HOSTED` | `PENDING` | `PENDING` | `NOT APPROVED` |
| MFA/SMS provider | `NOT CURRENTLY APPROVED` | `PENDING` | `PENDING` | `NOT APPROVED` |
| anti-abuse/CAPTCHA | `PENDING` | `PENDING` | `PENDING` | `NOT APPROVED` |

Ta tabela jest governance inventory. Nie zatwierdza technicznie ani prawnie żadnego providera.

---

## 5. Zasada remote access

Ocena transferu musi uwzględniać nie tylko fizyczne położenie bazy lub pliku, ale także możliwość zdalnego dostępu przez:

- support;
- administratorów providera;
- security operations;
- incident response;
- subprocesorów;
- systemy telemetryczne lub supportowe powiązane z usługą.

Deklarowany region UE nie może samodzielnie zamknąć tej kontroli.

---

## 6. Minimalizacja i środki techniczne

Jeżeli transfer lub dostęp spoza EOG występuje, projekt powinien ocenić, czy zakres danych może zostać ograniczony przez:

- wyłączenie zbędnych pól;
- pseudonimizację tam, gdzie rzeczywiście zmniejsza ryzyko;
- szyfrowanie transportu i storage;
- oddzielenie kluczy lub mappingu od zewnętrznego providera, jeśli jest to architektonicznie możliwe;
- ograniczenie telemetry i logów;
- zakaz przesyłania plaintext prywatnych wiadomości do niepotrzebnych providerów;
- ograniczenie regionów i subprocesorów konfiguracją, jeżeli provider to umożliwia;
- krótszą retencję po stronie providera.

Pseudonimizacja nie oznacza automatycznie, że dane przestają być danymi osobowymi.

---

## 7. Relacja do DPA i procesorów

`PL-C14` nie może zostać zamknięty niezależnie od `PL-C13` / `PL-E08`.

Jeżeli provider działa jako procesor, kontrola wymaga spójności między:

- ustaloną rolą;
- DPA / processor contract;
- subprocesorami;
- regionami;
- mechanizmem transferowym;
- deletion/return;
- backup lifecycle;
- incident handling;
- rights assistance.

Brak zweryfikowanego kontraktu lub rzeczywistego zakresu usługi oznacza, że transfer status nie może być uznany za finalnie zweryfikowany.

---

## 8. Privacy notice i ROPA

Wersja publikacyjna privacy notice oraz ROPA muszą odzwierciedlać faktyczny, zatwierdzony stan providerów i transferów.

Nie wolno publikować kategorycznego stwierdzenia `brak transferów poza EOG`, jeśli:

- provider/subprocessor inventory jest niepełny;
- remote access nie został zweryfikowany;
- mechanizmy transferowe pozostają `TO VERIFY`;
- finalny provider nie został jeszcze wybrany.

Zmiana providera, zakresu usługi lub subprocesora może wymagać aktualizacji PL-E07, PL-E08, ROPA, privacy notice oraz ponownego review PL-C14.

---

## 9. Relacja do DPIA

Pełna DPIA V3 powinna uwzględnić co najmniej:

- providerów i subprocessors;
- transfery poza EOG i remote access;
- prywatne wiadomości i załączniki;
- telemetry / observability;
- użytkowników 16–17;
- wpływ transferów na prawa osób i skuteczność deletion;
- ryzyko rezydualne po zastosowaniu safeguards.

DPIA screening już ustalił, że pełna DPIA jest wymagana przed produkcją; PL-C14 nie zmienia tej decyzji.

---

## 10. Otwarte warunki

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C14-O01 | zweryfikować Render: legal entity, regiony, subprocessors, remote access, DPA i transfer mechanism | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C14-O02 | zweryfikować Cloudflare per faktycznie używana usługa: rola, subprocessors, remote access, DPA i transfer mechanism | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C14-O03 | każdy przyszły e-mail/newsletter/storage/observability/MFA/anti-abuse provider przechodzi provider approval gate przed produkcją | P1 Privacy/Legal | Privacy/Legal + Technical Owner | `OPEN` |
| PL-C14-O04 | utworzyć durable provider/transfer evidence register z locatorami | P2 Governance | Privacy/Legal Decision Owner | `OPEN` |
| PL-C14-O05 | zsynchronizować finalne transfery z ROPA i privacy notice | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C14-O06 | uwzględnić ocenę providerów/transferów i ryzyka rezydualnego w pełnej DPIA | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |

---

## 11. Kryteria przejścia z HOLD

`PL-C14` może przejść na `PASS WITH CONDITIONS` albo `PASS` dopiero, gdy:

- faktycznie używani providerzy są znani;
- ich role są ustalone;
- DPA/kontrakty są zweryfikowane, jeśli wymagane;
- subprocessors i remote access są zweryfikowani;
- regiony storage/processing są udokumentowane;
- każdy wymagany mechanizm transferowy jest wskazany i oceniony;
- finalne informacje są zsynchronizowane z privacy notice i ROPA;
- brak otwartego P0/P1 blokującego transfer/provider approval;
- istnieją durable evidence locatory;
- pełna DPIA nie pozostawia nierozwiązanego materialnego ryzyka transferowego.

---

## 12. Granica autoryzacji

Utworzenie PL-C14:

- nie ustanawia ani nie zatwierdza nowego transferu;
- nie zatwierdza Render ani Cloudflare jako finalnego providera V3;
- nie zmienia regionów, konfiguracji, DNS, sekretów ani usług;
- nie autoryzuje implementacji;
- nie autoryzuje deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

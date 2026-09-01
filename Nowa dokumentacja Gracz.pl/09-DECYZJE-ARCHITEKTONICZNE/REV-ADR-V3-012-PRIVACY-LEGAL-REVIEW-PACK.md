# ADR-V3-012 — Privacy/Legal Review Pack

Data przygotowania: 01.09.2026  
Review pack ID: `REV-ADR-V3-012-20260901-PL-01`  
Decision/document ID: `ADR-V3-012`  
Repository baseline HEAD: `28ff688e57814fc0bca1ce88192d94d021985e5d`  
Status: **READY FOR NAMED OWNER REVIEW / NOT APPROVED / FREEZE-SAFE**

> Ten pakiet jest kontraktem wejścia i zapisu formalnego review Privacy/Legal. Nie jest opinią prawną, nie wyznacza samodzielnie podstaw prawnych, nie zatwierdza okresów retencji i nie autoryzuje implementacji, deploymentu ani operacji produkcyjnych.

## 1. Cel

Celem review jest podjęcie przez jawnie umocowanego właściciela Privacy/Legal decyzji, czy projektowa polityka ADR-V3-012:

- przypisuje każdemu celowi przetwarzania prawidłową podstawę,
- utrzymuje dane nie dłużej, niż jest to niezbędne,
- ma uzasadnione i komunikowalne okresy lub kryteria retencji,
- prawidłowo rozdziela purge, anonimizację, pseudonimizację i restriction,
- obsługuje prawa osób, legal hold, backup i restore,
- uwzględnia użytkowników małoletnich, jeśli mogą korzystać z Gracz.pl,
- może zostać oznaczona jako `ACCEPTED / FINAL`.

## 2. Granice decyzji

Review Privacy/Legal:

- zatwierdza albo odrzuca politykę prawną i governance,
- nie potwierdza implementacji technicznej,
- nie zastępuje testów, DPIA ani dokumentacji obowiązków informacyjnych,
- nie zmienia freeze,
- nie uruchamia purge, migracji, workerów ani restore,
- nie może być zapisane jako `PASS` bez nazwanego właściciela, mandatu i trwałego recordu.

## 3. Wymagany reviewer i mandat

| Pole | Wartość |
|---|---|
| Privacy/Legal owner | `UNASSIGNED` |
| Reviewer name | `PENDING` |
| Reviewer role | `PENDING` |
| Organization / engagement basis | `PENDING` |
| Scope of mandate | `PENDING` |
| Jurisdiction reviewed | `PENDING` |
| Conflict-of-interest declaration | `PENDING` |
| Review date | `PENDING` |
| Signature / durable approval locator | `PENDING` |

Brak któregokolwiek z pól ownera, mandatu lub durable approval locator powoduje wynik `HOLD`, a nie dorozumianą akceptację.

## 4. Oficjalne źródła wejściowe

Źródła zweryfikowane jako dostępne 01.09.2026:

- RODO — oficjalny tekst EUR-Lex: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- UODO — „Czy trzeba precyzyjnie określać okres przechowywania danych?”: https://uodo.gov.pl/pl/676/4260
- UODO — zasada ograniczenia przechowywania i działania po upływie okresu: https://uodo.gov.pl/pl/676/4262

Minimalny zakres przepisów do oceny obejmuje co najmniej art. 5 ust. 1 lit. e i art. 5 ust. 2 RODO oraz — odpowiednio do procesu — art. 6, 13, 14, 17, 18, 21, 25, 28, 30, 32 i 35 RODO. Lista nie zastępuje ustalenia wszystkich właściwych przepisów polskich, unijnych ani sektorowych.

UODO wskazuje, że administrator powinien ustalić termin usuwania albo okresowego przeglądu, powiązać okres z celem i umożliwić osobie ocenę długości przechowywania. Samo ogólne stwierdzenie „tak długo, jak jest to niezbędne” nie wystarcza jako pełny obowiązek informacyjny.

## 5. Wymagany evidence pack przed decyzją

| ID | Dowód | Status |
|---|---|---|
| PL-E01 | tożsamość administratora i zakres podmiotów Gracz.pl | `MISSING / OWNER INPUT REQUIRED` |
| PL-E02 | aktualny rejestr czynności przetwarzania / ROPA | `MISSING / OWNER INPUT REQUIRED` |
| PL-E03 | mapa celów i podstaw prawnych per proces | `MISSING / OWNER INPUT REQUIRED` |
| PL-E04 | kategorie osób, w tym decyzja dotycząca małoletnich | `MISSING / OWNER INPUT REQUIRED` |
| PL-E05 | kategorie danych i klasyfikacja PUBLIC/INTERNAL/PERSONAL/SENSITIVE/EVIDENCE/SECRET | `PARTIAL / ADR DESIGN ONLY` |
| PL-E06 | odbiorcy, procesorzy, subprocessors i transfery państw trzecich | `MISSING / OWNER INPUT REQUIRED` |
| PL-E07 | umowy powierzenia i instrukcje usunięcia/zwrotu danych | `MISSING / OWNER INPUT REQUIRED` |
| PL-E08 | obowiązki informacyjne i privacy notice z okresami/kryteriami | `MISSING / OWNER INPUT REQUIRED` |
| PL-E09 | analiza prawnie uzasadnionego interesu, jeśli używany | `NOT VERIFIED` |
| PL-E10 | DPIA screening oraz DPIA, jeśli wymagane | `NOT VERIFIED` |
| PL-E11 | procedury dostępu, sprostowania, usunięcia, restriction, sprzeciwu i eksportu | `PARTIAL / DESIGN ONLY` |
| PL-E12 | uzasadnienie każdego okresu retencji i zdarzenia rozpoczynającego clock | `PENDING LEGAL REVIEW` |
| PL-E13 | katalog wyjątków ustawowych, roszczeń, sporów i legal hold | `PENDING LEGAL REVIEW` |
| PL-E14 | dokumentacja wieku/zgód opiekuna, jeśli usługa obejmuje małoletnich | `NOT VERIFIED` |
| PL-E15 | zgodność backupów, restore, processor deletion i deletion ledger | `ARCHITECTURE PASS / OPERATIONAL EVIDENCE NONE` |
| PL-E16 | wersjonowany decision record z podpisem/approval locator | `MISSING` |

Evidence pack nie może zawierać sekretów, treści prywatnych wiadomości ani zbędnych danych osobowych.

## 6. Macierz decyzji dla okresów ADR-V3-012

Reviewer ocenia każdy blok jako `APPROVE`, `APPROVE WITH CONDITIONS`, `HOLD` albo `REJECT`.

| ID | Zakres ADR-V3-012 | Wymagana decyzja | Status |
|---|---|---|---|
| PL-R01 | konto, profil, account deletion i publiczna widoczność | cel, podstawa, clock, 30 dni/24 h, akcja końcowa | `NOT REVIEWED` |
| PL-R02 | MFA, credentiale, sesje i tokeny | natychmiastowe revoke/purge, 24 h/30 dni/7 dni | `NOT REVIEWED` |
| PL-R03 | privacy request evidence i anty-abuse tombstone | podstawa i proporcjonalność 6 lat/24 miesięcy | `NOT REVIEWED` |
| PL-R04 | game events, snapshoty, replay, turnieje i ranking | 36 miesięcy/90 dni/anonimizacja/bezterminowy anonimowy agregat | `NOT REVIEWED` |
| PL-R05 | private messaging, załączniki, publiczny chat i social | party-state, 36/12/24 miesięcy, 30 dni grace | `NOT REVIEWED` |
| PL-R06 | newsletter, consent proof, unsubscribe, analytics i provider telemetry | podstawa 6 lat/24/13 miesięcy i obowiązki informacyjne | `NOT REVIEWED` |
| PL-R07 | moderation, sankcje, audit i security events | podstawa, roszczenia, 36 miesięcy/6 lat/12 miesięcy | `NOT REVIEWED` |
| PL-R08 | outbox, idempotency, logs, traces i metryki | minimalizacja oraz 14/30/90 dni/13 miesięcy | `NOT REVIEWED` |
| PL-R09 | backupy dzienne, tygodniowe, miesięczne i restore environments | 35 dni/12 tygodni/12 miesięcy/7 dni oraz deletion replay | `NOT REVIEWED` |

Dla każdego bloku reviewer zapisuje:

1. cele przetwarzania,
2. podstawę prawną,
3. kategorie osób i danych,
4. uzasadnienie okresu albo kryterium jego ustalenia,
5. zdarzenie rozpoczynające retention clock,
6. końcową akcję,
7. wyjątki i legal hold,
8. obowiązek informacyjny,
9. warunki wcześniejszego purge,
10. ownera przyszłego przeglądu.

## 7. Kontrole obowiązkowe

| ID | Kontrola | Kryterium PASS | Status |
|---|---|---|---|
| PL-C01 | purpose limitation | każdy proces ma konkretny, udokumentowany cel | `PENDING` |
| PL-C02 | lawful basis | każdy cel ma zatwierdzoną podstawę | `PENDING` |
| PL-C03 | storage limitation | okres/kryterium jest konieczne i proporcjonalne | `PENDING` |
| PL-C04 | transparency | privacy notice pozwala ustalić długość przechowywania | `PENDING` |
| PL-C05 | accountability | decyzje i wyjątki mają trwały evidence record | `PENDING` |
| PL-C06 | data minimization | zakres danych odpowiada celowi | `PENDING` |
| PL-C07 | deletion/restriction | wyjątki od usunięcia są jawne i obsługują restriction | `PENDING` |
| PL-C08 | objection/marketing | sprzeciw i unsubscribe zatrzymują właściwe operacje | `PENDING` |
| PL-C09 | anonymization | brak realnej możliwości reidentyfikacji i mapy zwrotnej | `PENDING` |
| PL-C10 | pseudonymization | dane nadal traktowane jako osobowe i chronione | `PENDING` |
| PL-C11 | legal hold | scope, reason, owner, review_at i expires_at są obowiązkowe | `PENDING` |
| PL-C12 | minors | wiek, zgody i projekt usług mają zatwierdzony model | `PENDING` |
| PL-C13 | processors | umowy i instrukcje pokrywają retencję, delete i backup | `PENDING` |
| PL-C14 | transfers | transfery i safeguards są zinwentaryzowane | `PENDING` |
| PL-C15 | ROPA | okresy/kryteria i środki bezpieczeństwa są zapisane | `PENDING` |
| PL-C16 | DPIA | screening jest wykonany, a wymagane ryzyka ocenione | `PENDING` |
| PL-C17 | privacy by design | deletion ledger, receipts i anti-resurrection wspierają decyzję | `ARCHITECTURE PASS` |
| PL-C18 | backup/restore | natural expiry i replay deletion są zgodne z decyzją prawną | `PENDING LEGAL / DESIGN PASS` |
| PL-C19 | security/PII evidence | review artifact nie zawiera sekretów ani zbędnego PII | `PASS FOR THIS PACK` |
| PL-C20 | implementation boundary | review nie autoryzuje implementacji ani deploymentu | `PASS FOR THIS PACK` |

## 8. Legal hold review

Wynik `PASS` wymaga potwierdzenia, że:

- hold ma konkretną podstawę i udokumentowany cel,
- zakres nie jest szerszy niż konieczny,
- wskazano ownera oraz rozdział obowiązków,
- `review_at` i `expires_at` są obowiązkowe,
- brak ważnego hold nie przedłuża retencji,
- backup nie jest używany jako ukryte archiwum hold,
- zwolnienie hold uruchamia ponowną ocenę purge,
- dostęp i eksport danych objętych hold są audytowane.

## 9. Małoletni i model usługi

Przed decyzją owner musi jawnie ustalić:

- minimalny wiek użytkownika,
- czy Gracz.pl oferuje usługę bezpośrednio dzieciom,
- czy i kiedy potrzebna jest zgoda lub autoryzacja opiekuna,
- jaki jest model age assurance bez nadmiernego zbierania danych,
- czy profile, chat, wiadomości i matchmaking wymagają dodatkowych ograniczeń,
- czy wymagany jest odrębny DPIA lub szczególne obowiązki informacyjne.

Brak tej decyzji powoduje `HOLD` dla finalnej akceptacji ADR-V3-012.

## 10. Dozwolone werdykty

| Werdykt | Znaczenie |
|---|---|
| `PASS / ACCEPTED` | wszystkie obowiązkowe dowody i kontrole zatwierdzone bez otwartego P0/P1 |
| `PASS WITH CONDITIONS` | warunki mają ownera, deadline i nie blokują legalności projektu; ADR pozostaje `REVIEW PENDING` do ich zamknięcia |
| `HOLD` | brak ownera, podstaw, dowodów albo rozstrzygnięcia istotnego ryzyka |
| `REJECT` | polityka wymaga przeprojektowania lub zawiera niedopuszczalne założenie |

`PASS WITH CONDITIONS` nie nadaje automatycznie statusu `ACCEPTED / FINAL`.

## 11. Formalny decision record

```text
REVIEW PACK ID =
REV-ADR-V3-012-20260901-PL-01

PRIVACY/LEGAL OWNER =
PENDING

REVIEWER / ROLE / MANDATE =
PENDING

REVIEWED REPOSITORY HEAD =
PENDING

REVIEW DATE =
PENDING

JURISDICTION / SERVICE SCOPE =
PENDING

DECISION =
PENDING

APPROVED RETENTION POLICY VERSION =
PENDING

APPROVED ROWS / EXCEPTIONS =
PENDING

LEGAL BASES / PURPOSES EVIDENCE LOCATOR =
PENDING

OPEN CONDITIONS P0/P1/P2 =
PENDING

NEXT REVIEW DATE =
PENDING

DURABLE APPROVAL LOCATOR =
PENDING
```

## 12. Bramka finalna ADR-V3-012

ADR-V3-012 może przejść do `ACCEPTED / FINAL / NOT IMPLEMENTED / FREEZE-SAFE` dopiero, gdy:

1. named Privacy/Legal owner i mandat są zapisane,
2. PL-E01–PL-E16 mają rozstrzygnięcie,
3. PL-R01–PL-R09 mają decyzję oraz uzasadnienie,
4. PL-C01–PL-C20 są zakończone albo mają formalnie dopuszczalne warunki,
5. legal hold i model małoletnich są zatwierdzone,
6. nie istnieje otwarty P0/P1 blokujący,
7. decision record ma durable approval locator,
8. provenance register wskazuje właściwy artifact i reviewed HEAD.

## 13. Stan po przygotowaniu pakietu

```text
PRIVACY/LEGAL REVIEW PACK = READY
PRIVACY/LEGAL OWNER = UNASSIGNED
FORMAL REVIEW = NOT EXECUTED
ADR-V3-012 = ARCHITECTURE PASS / PRIVACY-LEGAL REVIEW PENDING
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
FREEZE = ACTIVE
PRODUCTION / RENDER / SECRETS = UNCHANGED
```

# Gracz.pl V3 — PL-E16 Wersjonowany zapis decyzji Privacy/Legal

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Evidence ID: `PL-E16`  
Review ID: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Status dokumentu: **DECISION RECORD ESTABLISHED / FORMAL REVIEW OPEN / FREEZE-SAFE**

> Ten dokument jest trwałym, wersjonowanym rejestrem decyzji dla formalnego review Privacy/Legal ADR-V3-012. Nie jest podpisem końcowym ani automatycznym zatwierdzeniem ADR. Rejestr utrwala stan evidence, otwarte warunki oraz aktualny werdykt governance. Wszelkie przyszłe zmiany muszą być wersjonowane i pozostawić historię decyzji.

---

## 1. Decision Owner

| Pole | Wartość |
|---|---|
| Administrator / Decision Owner | **Czesław Socha — osoba fizyczna prowadząca projekt Gracz.pl we własnym imieniu** |
| Rola governance | Project Owner / Documentation Owner / Privacy-Legal Decision Owner |
| Mandat | ustanowiony w odrębnym podpisanym artefakcie mandatu |
| Jurysdykcja review | Polska / UE — RODO/GDPR |
| Zakres | ADR-V3-012 oraz evidence PL-E01–PL-E16 |
| Implementacja / deployment | `NOT AUTHORIZED / FREEZE ACTIVE` |

Ustanowienie Decision Ownera nie oznacza deklaracji kwalifikacji prawnika, radcy prawnego, adwokata ani IOD/DPO. Gdy rozstrzygnięcie wymaga profesjonalnej interpretacji prawnej, dokumentacja wymaga konsultacji kwalifikowanego specjalisty przed zmianą odpowiedniego punktu na `PASS`.

---

## 2. Zasada wersjonowania decyzji

Każda decyzja Privacy/Legal musi posiadać co najmniej:

1. identyfikator review;
2. datę;
3. nazwę Decision Ownera;
4. zakres decyzji;
5. status każdego evidence;
6. otwarte P0/P1 i warunki;
7. finalny lub tymczasowy werdykt;
8. wpływ na `REVIEWED DESIGN GATE`;
9. informację o autoryzacji implementacji/deploymentu;
10. locator do artefaktów evidence;
11. historię późniejszych zmian bez nadpisywania wcześniejszego stanu.

Brak któregoś z materialnych elementów oznacza, że decyzja nie może być traktowana jako finalne zatwierdzenie ADR-V3-012.

---

## 3. Rejestr evidence PL-E01–PL-E16

| Evidence | Zakres | Aktualny status review | Warunek / uwaga |
|---|---|---|---|
| PL-E01 | tożsamość administratora / ownera | `PASS WITH CONDITIONS` | przed produkcją uzupełnić pełne dane kontaktowe administratora do obowiązku informacyjnego |
| PL-E02 | ROPA | `PASS WITH CONDITIONS` | utrzymywać aktualność providerów, transferów, retencji i podstaw prawnych |
| PL-E03 | cele i podstawy prawne | `PASS WITH CONDITIONS` | LIA, konkretne obowiązki dla 6(1)(c), model zgody newslettera i finalny legal review |
| PL-E04 | kategorie osób | `PASS WITH CONDITIONS` | spójność z modelem małoletnich i incidental third-party data |
| PL-E05 | małoletni / wiek / zgody | `PASS WITH CONDITIONS` | baseline 16+; wymagane safeguards i spójność z DPIA/privacy notice |
| PL-E06 | klasyfikacja danych | `PASS WITH CONDITIONS` | utrzymać zakazy nadmiarowego zbierania i obsługę danych szczególnych w UGC |
| PL-E07 | odbiorcy / procesorzy / transfery | `PASS WITH CONDITIONS` | zweryfikować role, DPA, regiony, subprocesorów i transfery dla rzeczywistych providerów |
| PL-E08 | umowy powierzenia / instrukcje | `HOLD` | brak zweryfikowanych rzeczywistych DPA/umów dla wszystkich aktywnych providerów |
| PL-E09 | privacy notice / polityka prywatności | `PASS WITH CONDITIONS` | uzupełnić dane kontaktowe, providerów, transfery, finalne podstawy i retencję przed publikacją |
| PL-E10 | LIA | `PASS WITH CONDITIONS` | zamknąć materialne warunki, w tym moderation access, telemetry, audit retention i claims/proof |
| PL-E11 | DPIA screening | `PASS` | screening wykonany; **pełna DPIA jest wymagana przed produkcją** |
| PL-E12 | prawa osób | `PASS WITH CONDITIONS` | wymagane operacyjne testy workflow, identity verification i evidence wykonania |
| PL-E13 | uzasadnienia retencji | `PASS WITH CONDITIONS` | długie okresy evidence/audit wymagają konkretnego uzasadnienia prawnego |
| PL-E14 | legal hold / wyjątki od usuwania | `PASS WITH CONDITIONS` | każdy hold musi mieć konkretną podstawę, zakres, ownera i review date |
| PL-E15 | backup / restore / deletion replay | `PASS WITH CONDITIONS` | wymagany rzeczywisty test restore + deletion replay / anti-resurrection |
| PL-E16 | wersjonowany zapis decyzji | `PASS` | durable decision record został utworzony; finalny verdict nadal zależy od zamknięcia blockerów |

---

## 4. Materialne otwarte blokery

### PL-E16-B01 — PL-E08 / provider contracts

`P1 PRIVACY/LEGAL — OPEN`

Przed finalnym `PASS` należy zweryfikować dla faktycznie używanych providerów:

- rolę prawną;
- DPA/umowę powierzenia, jeśli wymagana;
- subprocesorów;
- regiony i dostęp operacyjny;
- mechanizmy transferów poza EOG;
- retencję, backup i deletion;
- wsparcie dla praw osób i incydentów.

### PL-E16-B02 — pełna DPIA

`P1 PRIVACY/LEGAL — OPEN`

Screening PL-E11 ustalił `DPIA REQUIRED BEFORE PRODUCTION`. Pełna DPIA nie jest jeszcze zakończona. Dopóki nie zostanie wykonana i zaakceptowane ryzyko rezydualne, wysokiego ryzyka przetwarzanie produkcyjne objęte V3 nie może zostać formalnie zatwierdzone.

### PL-E16-B03 — finalna akceptacja podstaw prawnych

`P1 LEGAL — OPEN`

Należy zamknąć:

- LIA dla wszystkich materialnych procesów 6(1)(f);
- konkretne obowiązki prawne dla pozycji 6(1)(c), jeśli pozostają;
- model zgody i evidence newslettera;
- finalne uzasadnienia długich okresów evidence/audit.

### PL-E16-B04 — finalni providerzy i transfery

`P1 PRIVACY/LEGAL — OPEN`

Render, Cloudflare oraz każdy provider poczty, storage, observability, MFA/SMS lub anti-abuse muszą zostać ocenieni w realnym, produkcyjnym zakresie. Design-time placeholder nie jest approvalem providera.

### PL-E16-B05 — operational evidence dla privacy deletion / restore

`P1 OPERATIONAL + PRIVACY — OPEN`

Przed produkcją wymagany jest dowód operacyjny, że:

- deletion workflow jest kompletny i restartowalny;
- read models/cache/indeksy są objęte usuwaniem;
- restore nie przywraca skutecznie usuniętych danych;
- deletion ledger replay działa po restore;
- aktywne legal holds zachowują wyłącznie dozwolony zakres.

---

## 5. Aktualny formalny werdykt

Na podstawie evidence PL-E01–PL-E16 i otwartych blockerów przyjmuje się na dzień 01.09.2026:

```text
PL-E16 DECISION RECORD = PASS
PRIVACY/LEGAL EVIDENCE SET PL-E01–PL-E16 = ESTABLISHED
ADR-V3-012 FORMAL PRIVACY/LEGAL VERDICT = HOLD

REASON:
- PL-E08 = HOLD
- FULL DPIA = REQUIRED / NOT YET COMPLETED
- FINAL PROVIDER/DPA/TRANSFER VERIFICATION = OPEN
- MATERIAL LAWFUL-BASIS / RETENTION CONDITIONS = OPEN
- OPERATIONAL PRIVACY-DELETION / RESTORE EVIDENCE = OPEN

REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

`PL-E16 = PASS` oznacza wyłącznie, że wymagany wersjonowany rejestr decyzji został ustanowiony i zawiera aktualny, uczciwy stan review. Nie oznacza `ADR-V3-012 = ACCEPTED`.

---

## 6. Warunki zmiany finalnego werdyktu

Finalny werdykt może zostać zmieniony z `HOLD` dopiero po udokumentowanym zamknięciu wszystkich materialnych blockerów. Dopuszczalne końcowe stany review:

- `PASS / ACCEPTED` — wszystkie wymagane evidence i kontrole zaakceptowane, brak otwartych blockerów P0/P1;
- `PASS WITH CONDITIONS` — tylko jeśli warunki są nieblokujące, mają nazwanych ownerów i terminy, a review framework dopuszcza pozostawienie ich po decyzji;
- `HOLD` — materialne evidence, decyzja lub ryzyko nadal otwarte;
- `REJECT` — przyjęty model jest niedopuszczalny i wymaga redesignu.

W obecnym stanie nie ma podstaw do `PASS / ACCEPTED`.

---

## 7. Approval artifact / locator

Aktualnym trwałym locatorami są:

- niniejszy plik `PL-E16-WERSJONOWANY-ZAPIS-DECYZJI-PRIVACY-LEGAL-GRACZ-PL-V3.md`;
- evidence `PL-E01–PL-E15` w folderze `09-DECYZJE-ARCHITEKTONICZNE/`;
- `ROPA-GRACZ-PL-V3.md`;
- `REV-ADR-V3-012-PRIVACY-LEGAL-REVIEW-PACK.md`;
- formalny formularz review/decision poza repo, jeśli podpisany przez Decision Ownera.

Podpisany formularz końcowy nie może być oznaczony jako `PASS / ACCEPTED`, dopóki stan blockerów z sekcji 4 nie zostanie zamknięty albo formalnie rozstrzygnięty w sposób zgodny z kryteriami review.

---

## 8. Historia decyzji

| Data | Wersja | Zdarzenie | Werdykt |
|---|---:|---|---|
| 01.09.2026 | 0.1 | Utworzono pierwszy trwały PL-E16 po przygotowaniu evidence PL-E01–PL-E15 | `HOLD` dla ADR-V3-012 |

Każda kolejna formalna decyzja powinna dopisać nowy rekord historii i zaktualizować statusy, bez usuwania poprzedniego werdyktu.

---

## 9. Granica autoryzacji

Utworzenie PL-E16:

- zamyka wyłącznie wymaganie posiadania wersjonowanego decision record;
- nie zamyka PL-E08 ani pełnej DPIA;
- nie zatwierdza providerów, transferów ani długich okresów retencji;
- nie oznacza akceptacji ryzyka rezydualnego;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

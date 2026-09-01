# Gracz.pl V3 — PL-C15 ROPA / rejestr czynności przetwarzania

Data review: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C15`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — PASS WITH CONDITIONS / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `ROPA-GRACZ-PL-V3.md`, `PL-E02`, `PL-E03`, `PL-E04`, `PL-E05`, `PL-E06`, `PL-E07`, `PL-E08`, `PL-E09`, `PL-E13`, `PL-E16`

> Ten dokument ocenia kontrolę PL-C15: czy Gracz.pl V3 posiada trwały, wersjonowany i wystarczająco kompletny rejestr czynności przetwarzania, który może pełnić funkcję bieżącego ROPA. Ocena nie jest zgodą na produkcję i nie zastępuje finalnego Privacy/Legal review.

---

## 1. Kryterium kontroli

PL-C15 może otrzymać pełny `PASS`, jeżeli:

1. istnieje wersjonowany rejestr czynności przetwarzania;
2. administrator i zakres organizacyjny są wskazane;
3. zidentyfikowano kategorie osób, danych, cele i podstawy prawne;
4. wskazano odbiorców/procesorów i status transferów;
5. wskazano okresy lub kryteria retencji oraz akcje końcowe;
6. wskazano środki bezpieczeństwa na odpowiednim poziomie ogólności;
7. rejestr jest spójny z aktualnymi decyzjami Privacy/Legal;
8. pola `PENDING / TO VERIFY / PROPOSED` są zamknięte albo jawnie zaakceptowane jako nieblokujące;
9. istnieje owner, data review i mechanizm aktualizacji po materialnej zmianie.

---

## 2. Evidence potwierdzające kontrolę

W repo istnieje `ROPA-GRACZ-PL-V3.md`, który obejmuje co najmniej:

- administratora i governance ownera;
- status danych kontaktowych i DPO/IOD;
- kategorie osób;
- klasy danych;
- konto/rejestrację/profil;
- auth, sesje, MFA i security;
- gry, mecze, ranking i turnieje;
- prywatne wiadomości, załączniki, publiczny chat i social;
- newsletter i consent evidence;
- moderację, sankcje i odwołania;
- privacy requests;
- audit/security/logi;
- backup/restore/deletion replay;
- odbiorców i providerów;
- transfery poza EOG;
- retencję i akcje końcowe;
- środki bezpieczeństwa i ownerów domenowych.

Strukturalne wymaganie posiadania ROPA jest więc spełnione.

---

## 3. Macierz oceny PL-C15

| Obszar | Stan | Ocena |
|---|---|---|
| wersjonowany ROPA istnieje | tak | `PASS` |
| administrator wskazany | tak | `PASS WITH CONDITIONS` — dane kontaktowe do publikacyjnej polityki nadal `PENDING` |
| kategorie osób | tak | `PASS WITH CONDITIONS` |
| kategorie danych | tak | `PASS` na poziomie design/governance |
| cele przetwarzania | tak | `PASS WITH CONDITIONS` |
| podstawy prawne | zmapowane, część `PROPOSED / LIA REQUIRED / PENDING` | `HOLD DEPENDENCY` |
| odbiorcy/procesorzy | zinwentaryzowani | `PASS WITH CONDITIONS` |
| DPA/role providerów | niezweryfikowane dla materialnych providerów | `HOLD DEPENDENCY` |
| transfery poza EOG | `TO VERIFY` | `HOLD DEPENDENCY` |
| retencja | szeroko udokumentowana | `PASS WITH CONDITIONS` — część okresów nadal `HOLD` |
| środki bezpieczeństwa | opisane projektowo | `PASS WITH CONDITIONS` — evidence operacyjne niepełne |
| ownerzy i cykl review | zdefiniowane | `PASS` |
| spójność z aktualnymi decyzjami | częściowa | `PASS WITH CONDITIONS / SYNC REQUIRED` |

---

## 4. Niespójność wymagająca synchronizacji

Aktualny ROPA zawiera starszy zapis, że model małoletnich jest `PENDING OWNER DECISION`.

Tymczasem późniejszy evidence `PL-E05` ustanowił już politykę projektową:

```text
BASELINE MINIMUM AGE = 16
UNDER 16 = NOT ALLOWED IN BASELINE
16–17 PRIVACY SAFEGUARDS = REQUIRED
```

ROPA musi zostać zsynchronizowany z tą decyzją przed pełnym `PASS` PL-C15 i przed finalnym approval artifact ADR-V3-012.

Ta rozbieżność nie unieważnia ROPA jako rejestru, ale oznacza, że jego wersja `0.1` nie może być traktowana jako finalny stan bez aktualizacji.

---

## 5. Otwarte warunki

| ID | Warunek | Severity | Status |
|---|---|---|---|
| PL-C15-O01 | zsynchronizować kategorię małoletnich z PL-E05 / baseline 16+ | P1 Privacy/Governance | `OPEN` |
| PL-C15-O02 | uzupełnić docelowe dane kontaktowe administratora wymagane do spójności z privacy notice | P1 Privacy/Legal | `OPEN` |
| PL-C15-O03 | zsynchronizować finalnie zatwierdzone lawful bases po zamknięciu PL-C02/LIA | P1 Legal | `OPEN` |
| PL-C15-O04 | zaktualizować providerów, role, DPA, subprocessors i transfery po zamknięciu PL-C13/PL-C14 | P1 Privacy/Legal | `OPEN` |
| PL-C15-O05 | zaktualizować okresy retencji po zamknięciu pozycji HOLD z PL-R03/PL-R06/PL-R07 | P1 Privacy/Legal | `OPEN` |
| PL-C15-O06 | po pełnej DPIA zsynchronizować środki i ryzyka wymagające wpisu do ROPA | P1 Privacy/Legal | `OPEN` |
| PL-C15-O07 | zachować review po każdej materialnej zmianie oraz nie rzadziej niż według przyjętego cyklu | P2 Governance | `ONGOING` |

---

## 6. Formalna decyzja PL-C15

```text
PL-C15 = PASS WITH CONDITIONS

VERSIONED ROPA EXISTS = YES
PROCESSING ACTIVITIES INVENTORIED = YES
PURPOSES / DATA CATEGORIES / SUBJECT CATEGORIES = SUBSTANTIALLY DEFINED
RETENTION / FINAL ACTIONS = SUBSTANTIALLY DEFINED
SECURITY MEASURES = DOCUMENTED AT DESIGN LEVEL
LAWFUL-BASE FINALIZATION = OPEN
PROCESSOR / DPA VERIFICATION = OPEN
TRANSFER VERIFICATION = OPEN
MINORS ROPA SYNC = OPEN
FINAL RETENTION SYNC = OPEN
FULL DPIA SYNC = OPEN

IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

`PASS WITH CONDITIONS` oznacza, że sama kontrola posiadania i prowadzenia ROPA jest spełniona na poziomie dokumentacyjnym, ale rejestr wymaga finalnej synchronizacji z decyzjami, które nadal pozostają otwarte w innych kontrolach.

---

## 7. Warunki pełnego PASS

Pełny `PL-C15 = PASS` wymaga łącznie:

1. synchronizacji modelu małoletnich z PL-E05;
2. finalizacji materialnych podstaw prawnych;
3. zatwierdzenia rzeczywistych providerów, DPA i transferów;
4. zamknięcia spornych okresów retencji;
5. synchronizacji z pełną DPIA;
6. braku materialnych, niesynchronizowanych `PENDING / TO VERIFY / HOLD` w ROPA;
7. wersjonowanego review potwierdzającego aktualność rejestru.

---

## 8. Granica autoryzacji

Utworzenie PL-C15:

- nie zmienia produkcyjnego przetwarzania;
- nie zatwierdza żadnego providera;
- nie zatwierdza transferów;
- nie finalizuje podstaw prawnych ani okresów retencji;
- nie jest pełną DPIA;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

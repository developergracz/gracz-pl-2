# 11 — SEARCH R4 Execution Control Plan

Data: 03.10.2026  
Status: **READY FOR CONTROLLED IMPLEMENTATION / CODE NOT STARTED**  
Owner: **Czesław Socha**  
Lead Architect / Control Tower: **ChatGPT**  
Primary implementer: **Codex**  
Primary independent auditor: **Claude**  
Optional escalation auditor: **Factory**

## 1. Cel

Ten dokument ustala pełny schemat wykonania SEARCH R4 od pierwszego commitu implementacyjnego do finalnego niezależnego audytu. Ma zapobiec sytuacji, w której jeden agent projektuje, koduje, zatwierdza i sam sobie nadaje PASS.

## 2. Rozdział odpowiedzialności

### Owner — Czesław Socha

Owner:

- autoryzuje rozpoczęcie etapu,
- zatwierdza istotne zmiany zakresu,
- zatwierdza wybór płatnego providera AI,
- zatwierdza deployment i produkcję,
- podejmuje decyzję przy HOLD/FAIL wymagającym trade-offu.

### Lead Architect / Control Tower — ChatGPT

Lead:

- utrzymuje zgodność z ADR-V3-014,
- przygotowuje mandat dla każdego etapu,
- kontroluje scope,
- sprawdza evidence i kryteria bramki,
- nie nadaje PASS wyłącznie na podstawie deklaracji wykonawcy,
- prowadzi finalny architectural/security review po niezależnym audycie.

### Codex — implementer

Codex:

- koduje wyłącznie zakres aktualnego mandatu,
- pracuje na osobnym branchu,
- nie merge'uje samodzielnie do `main`,
- nie wdraża na produkcję,
- nie zmienia sekretów,
- uruchamia wymagane testy,
- przygotowuje evidence pack,
- zgłasza zakres zmian i ryzyka,
- nie wystawia sobie finalnego PASS.

### Claude — independent auditor

Claude:

- zaczyna od świeżego odczytu PR/brancha,
- nie zakłada poprawności opisu implementera,
- porównuje kod do mandatu i dokumentacji,
- sprawdza testy, negatywne przypadki i granice bezpieczeństwa,
- wydaje `PASS / HOLD / FAIL`,
- nie modyfikuje kodu w ramach audytu.

### Factory — optional escalation

Factory jest używany, gdy:

- audyty są sprzeczne,
- występuje P0/P1 security finding,
- potrzebny jest trzeci niezależny review,
- Owner zażąda dodatkowego deep audit.

## 3. Model branch/PR

Dla każdego etapu:

```text
main
  └─ branch: search-r4/r4-X-<short-name>
       └─ commits
            └─ PR do main
```

Reguły:

- jeden etap = jeden główny PR,
- PR nie może zawierać zmian niezwiązanych z mandatem,
- brak direct push implementacyjnego do `main`,
- brak merge przed zakończeniem gate,
- poprawki audytowe trafiają do tego samego PR, jeśli zakres nadal jest ten sam.

## 4. Obowiązkowa sekwencja każdego etapu

```text
A. Owner authorization
B. Lead mandate
C. Codex implementation
D. Codex self-check + evidence pack
E. CI/test verification
F. Claude independent audit
G. Correction loop if needed
H. Fresh re-audit
I. Lead final gate review
J. Owner merge authorization
K. Merge
L. Post-merge verification
M. Status update
N. Dopiero następny etap
```

Nie wolno pomijać D, F, I lub L.

## 5. Gate verdicts

### PASS

Wszystkie wymagania mandatu spełnione, brak otwartego P0/P1 i evidence jest wystarczające.

### HOLD

Kod może być częściowo poprawny, ale brakuje dowodu, decyzji, testu, kontraktu albo istnieje nierozstrzygnięte ryzyko.

### FAIL

Istnieje materialna niezgodność z architekturą, bezpieczeństwem, privacy, source grounding albo kryteriami mandatu.

## 6. Severity

```text
P0 — krytyczne: secret leak, cross-user data leak, arbitrary action, critical auth bypass
P1 — wysokie: hallucinated canonical rules, broken source gate, unsafe cache isolation, uncontrolled cost path
P2 — średnie: correctness/performance/accessibility issue bez krytycznej ekspozycji
P3 — niskie: polish, maintainability, minor UX
```

Merge jest zabroniony przy otwartym P0/P1.

## 7. Evidence Pack wymagany od Codexa

Każdy etap ma zakończyć się pakietem:

```text
IMPLEMENTATION STATUS
BRANCH
BASE SHA
HEAD SHA
PR
FILES CHANGED
SCOPE IMPLEMENTED
SCOPE NOT IMPLEMENTED
TEST COMMANDS
TEST RESULTS
NEGATIVE TESTS
SECURITY CHECKS
KNOWN LIMITATIONS
DEVIATIONS FROM MANDATE
DEPLOYMENT = NO
SECRETS CHANGED = NO
```

Jeżeli którakolwiek pozycja jest nieprawdziwa lub nieznana, ma być zapisana jawnie.

## 8. Zakaz rozszerzania zakresu

Codex nie może samodzielnie:

- wybierać płatnego providera,
- kupować usług,
- tworzyć produkcyjnych sekretów,
- wdrażać R4,
- przebudowywać R2 od zera,
- przenosić danych użytkowników,
- dodawać nieplanowanej telemetrii pełnych promptów,
- zmieniać polityki prywatności bez mandatu,
- wdrażać kolejnego etapu „przy okazji”.

## 9. Kolejność R4

```text
R4.0 Documentation       = COMPLETE
R4.1 Corpus Foundation   = NEXT
R4.2 Semantic Retrieval
R4.3 Intent Router
R4.4 Grounded Ask AI
R4.5 Security/Privacy Hardening
R4.6 Learning Graph
R4.7 Player Context
R4.8 My Trainer
R4.9 Observability/Cost
R4.10 Production Readiness Review
```

## 10. Audit cadence

Minimum:

- independent audit po każdym etapie,
- świeży re-audit po każdej materialnej korekcie,
- finalny full-system audit po R4.9,
- osobny production readiness review R4.10.

## 11. Warunek finalnego merge R4

R4 nie może zostać uznane za ukończone, jeśli brakuje któregokolwiek z:

- canonical source enforcement,
- no-answer behavior,
- source citations,
- prompt injection defenses,
- cross-user isolation,
- cost hard limits,
- provider failure fallback,
- index rollback,
- load evidence,
- accessibility evidence,
- privacy/provider review,
- niezależny final audit.

## 12. Aktualny status

```text
CONTROL PLAN = COMPLETE
R4.0 = COMPLETE
R4.1 MANDATE = PREPARED
R4.1 IMPLEMENTATION = NOT STARTED
CODEX EXECUTION = WAITING FOR AVAILABILITY
CLAUDE AUDIT = NOT STARTED
MERGE = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
```

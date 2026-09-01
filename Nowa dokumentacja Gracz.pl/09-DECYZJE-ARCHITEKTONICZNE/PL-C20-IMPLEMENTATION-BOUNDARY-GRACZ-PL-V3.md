# Gracz.pl V3 — PL-C20 Implementation Boundary

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — PASS / VERSIONED / FREEZE-SAFE**  
Control ID: `PL-C20`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Ten dokument potwierdza wyłącznie granicę autoryzacji między formalnym Privacy/Legal review a implementacją techniczną. Nie autoryzuje wdrożenia żadnego mechanizmu, zmian produkcyjnych, zmian sekretów, zmian konfiguracji providerów ani deploymentu.

---

## 1. Kryterium kontroli

Kryterium PASS dla `PL-C20`:

```text
PRIVACY/LEGAL REVIEW DOES NOT AUTHORIZE IMPLEMENTATION OR DEPLOYMENT
```

Kontrola ma zapobiec sytuacji, w której dokumentacja, decyzja retencyjna, ocena legal hold, DPIA screening albo inny artefakt governance zostanie potraktowany jako polecenie wdrożeniowe.

---

## 2. Granica odpowiedzialności

Formalny Privacy/Legal review może:

- dokumentować cele i podstawy prawne;
- ustalać projektowe okresy i kryteria retencji;
- wskazywać wymagane mechanizmy deletion, restriction, anonymization i pseudonymization;
- ustanawiać model legal hold;
- ustanawiać model małoletnich;
- definiować wymagania wobec providerów, backupów, restore i evidence;
- klasyfikować warunki jako `PASS`, `PASS WITH CONDITIONS`, `HOLD` albo `REJECT`;
- wskazywać P0/P1/P2 i warunki przed produkcją.

Formalny Privacy/Legal review nie może samodzielnie:

- zmienić kodu aplikacji;
- wykonać migracji bazy danych;
- uruchomić purge lub retention workerów;
- zmienić konfiguracji Render, Cloudflare lub innego providera;
- zmienić sekretów, kluczy lub credentiali;
- włączyć nowego providera danych;
- wdrożyć mechanizmu age assurance;
- włączyć newslettera lub marketingu;
- rozpocząć przetwarzania wysokiego ryzyka;
- wykonać produkcyjnego restore;
- autoryzować deploymentu V3.

---

## 3. Zasada dwóch odrębnych decyzji

Dla każdej materialnej zmiany istnieją co najmniej dwa osobne poziomy decyzji:

1. **Privacy/Legal / Architecture decision** — czy projekt i zasady są dopuszczalne oraz jakie warunki muszą być spełnione;
2. **Implementation / Deployment authorization** — czy konkretna zmiana techniczna może zostać zbudowana, przetestowana i wdrożona.

Pierwszy poziom nie zastępuje drugiego.

Status `PASS` w kontroli Privacy/Legal nie oznacza:

```text
IMPLEMENT NOW = YES
DEPLOY NOW = YES
PRODUCTION READY = YES
```

---

## 4. Wymagany sygnał autoryzacji implementacji

Implementacja może rozpocząć się wyłącznie po odrębnej, jawnej decyzji właścicielskiej/projektowej, która określa co najmniej:

- zakres implementacji;
- zatwierdzony baseline dokumentacji;
- właściciela technicznego;
- warunki i ograniczenia;
- środowisko wykonania;
- wymagane testy;
- rollback / safety plan, jeżeli dotyczy;
- status Privacy/Legal blockerów;
- zgodę na zmianę freeze, jeżeli obowiązuje.

Brak takiej decyzji oznacza `IMPLEMENTATION = NOT AUTHORIZED`.

---

## 5. Wymagany sygnał autoryzacji deploymentu

Deployment jest osobną decyzją od implementacji.

Nawet po ukończeniu kodu deployment pozostaje niedozwolony, dopóki nie istnieje jawna decyzja `DEPLOYMENT AUTHORIZED` obejmująca odpowiednie gate'y techniczne, operacyjne, security i Privacy/Legal.

Dokumentacja, commit w repo, merge, test lokalny ani ukończenie review nie są samodzielnym upoważnieniem do produkcyjnego deploymentu.

---

## 6. Aktualny stan ADR-V3-012

Na dzień utworzenia PL-C20 obowiązuje:

```text
ADR-V3-012 FINAL PRIVACY/LEGAL VERDICT = HOLD
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

Utworzenie dokumentów PL-E, PL-R i PL-C nie zmienia tego stanu automatycznie.

---

## 7. Status dokumentów jako evidence, nie poleceń

Artefakty w `09-DECYZJE-ARCHITEKTONICZNE/` są dokumentami governance/evidence.

Ich obecność w repozytorium może:

- zwiększać kompletność review;
- tworzyć durable decision record;
- wyznaczać wymagania dla przyszłej implementacji;
- wskazywać otwarte blokery.

Nie może być interpretowana jako automatyczne polecenie wdrożenia.

---

## 8. Wyjątki niedopuszczalne

Następujące interpretacje są niedozwolone:

```text
DOCUMENT EXISTS = IMPLEMENTATION AUTHORIZED
PASS WITH CONDITIONS = DEPLOYMENT AUTHORIZED
ARCHITECTURE PASS = PRODUCTION READY
PRIVACY OWNER SIGNATURE = CODE CHANGE AUTHORIZED
DPIA SCREENING COMPLETED = HIGH-RISK PROCESSING MAY START
PROVIDER LISTED IN DOCS = PROVIDER APPROVED
RETENTION PERIOD DOCUMENTED = RETENTION WORKER MAY RUN
```

Każdy z tych kroków wymaga odpowiedniego, osobnego gate'u.

---

## 9. Dowód spełnienia kontroli

Review pack ADR-V3-012 już ustanawia, że Privacy/Legal review:

- nie potwierdza implementacji technicznej;
- nie zmienia freeze;
- nie uruchamia purge, migracji, workerów ani restore;
- nie autoryzuje implementation/deployment.

Analogiczna granica jest powtarzana w dokumentach PL-E, PL-R i PL-C.

Nie stwierdzono dokumentu governance, który sam w sobie nadaje produkcyjne upoważnienie implementacyjne.

---

## 10. Warunki utrzymania PASS

`PL-C20 = PASS` pozostaje ważne pod warunkiem ciągłego przestrzegania następujących zasad:

- każda przyszła implementacja ma odrębny jawny authorization record;
- każda produkcyjna zmiana ma osobny deployment gate;
- dokumenty Privacy/Legal nie są używane jako substytut zgody technicznej;
- zmiana `FREEZE`, `IMPLEMENTATION`, `DEPLOYMENT` albo `PRODUCTION V3` musi być jawna i wersjonowana;
- formalny podpis ADR-V3-012 nie może być interpretowany szerzej niż jego rzeczywista treść.

Jeżeli którykolwiek z tych warunków zostanie naruszony, PL-C20 wymaga ponownego review.

---

## 11. Formalna decyzja PL-C20

```text
PL-C20 = PASS

PRIVACY/LEGAL REVIEW AUTHORIZES IMPLEMENTATION = NO
PRIVACY/LEGAL REVIEW AUTHORIZES DEPLOYMENT = NO
DOCUMENTATION COMMIT AUTHORIZES CODE CHANGE = NO
ARCHITECTURE PASS EQUALS PRODUCTION GO = NO
SEPARATE IMPLEMENTATION AUTHORIZATION REQUIRED = YES
SEPARATE DEPLOYMENT AUTHORIZATION REQUIRED = YES
CURRENT IMPLEMENTATION AUTHORIZATION = NO
CURRENT DEPLOYMENT AUTHORIZATION = NO
REVIEWED DESIGN GATE = HOLD
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

Kontrola jest spełniona, ponieważ granica między review/governance a wykonaniem technicznym jest jawna, powtarzalna i nie pozostawia dorozumianej zgody na wdrożenie.

---

## 12. Granica autoryzacji tego dokumentu

Utworzenie PL-C20:

- nie zmienia kodu;
- nie zmienia bazy danych;
- nie zmienia Render/Cloudflare;
- nie zmienia sekretów;
- nie rozpoczyna implementacji;
- nie rozpoczyna deploymentu;
- nie zdejmuje freeze;
- nie zmienia `ADR-V3-012 = HOLD`;
- nie zmienia `Production V3 = NO-GO`.

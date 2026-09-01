# Gracz.pl V3 — PL-R01 Konto, profil, usunięcie konta i publiczna widoczność

Data: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — APPROVE WITH CONDITIONS / FREEZE-SAFE**  
Decision ID: `PL-R01`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`  
Powiązane evidence: `PL-E02`, `PL-E03`, `PL-E09`, `PL-E12`, `PL-E13`, `PL-E14`, `PL-E15`, `PL-E16`

> Ten dokument zapisuje decyzję review dla bloku retencyjnego PL-R01. Nie stanowi opinii prawnej, nie potwierdza implementacji i nie autoryzuje deploymentu ani zmian produkcyjnych. Wartości czasowe są zatwierdzane jako polityka projektowa z warunkami wskazanymi poniżej.

---

## 1. Zakres decyzji

PL-R01 obejmuje:

- aktywne konto i profil użytkownika;
- żądanie usunięcia konta;
- natychmiastowe zablokowanie dalszego uwierzytelniania po rozpoczęciu zweryfikowanego delete workflow;
- maksymalny czas obecności danych konta w aktywnych systemach po zweryfikowanym żądaniu;
- czas usunięcia publicznej widoczności profilu;
- końcową akcję purge/anonimizacji według bounded contextu;
- wyjątki wynikające z legal hold albo odrębnego obowiązku/uzasadnionego celu.

---

## 2. Cel przetwarzania

### 2.1. Konto aktywne

Cel: świadczenie użytkownikowi usługi Gracz.pl, utrzymanie profilu, ustawień, identyfikacji konta i powiązania z funkcjami serwisu.

### 2.2. Delete workflow

Cel po zweryfikowanym żądaniu usunięcia: bezpieczne i kompletne wykonanie żądania w wielu bounded contextach, przy jednoczesnym uniknięciu przypadkowego usunięcia danych należących do innych osób albo danych objętych prawidłowym wyjątkiem.

### 2.3. Publiczna widoczność

Po rozpoczęciu zweryfikowanego delete workflow dalsze publiczne prezentowanie profilu nie jest potrzebne do zwykłego świadczenia usługi i powinno zostać zakończone w możliwie krótkim czasie.

---

## 3. Podstawa prawna — stan review

| Operacja | Podstawa projektowa | Status |
|---|---|---|
| prowadzenie aktywnego konta i profilu niezbędnego do świadczenia usługi | `art. 6(1)(b) PROPOSED` | `APPROVE WITH CONDITIONS` |
| wykonanie obowiązków privacy/delete | właściwy obowiązek z RODO, mapowany w PL-E03 / PL-E12 | `APPROVE WITH CONDITIONS` |
| minimalny dowód wykonania żądania | odrębna podstawa zależna od konkretnego proof; nie może być zachowywany automatycznie bez limitu | `SEPARATE PL-R03 / LEGAL REVIEW` |

Warunek: przed finalnym `PASS / ACCEPTED` należy zamknąć końcową weryfikację podstaw prawnych w PL-E03 i zsynchronizować privacy notice.

---

## 4. Kategorie osób i danych

Kategorie osób:

- użytkownicy aktywni;
- użytkownicy, którzy złożyli zweryfikowane żądanie usunięcia;
- byli użytkownicy, których dane zostały prawidłowo zanonimizowane/pseudonimizowane w domenach, gdzie pełny purge nie jest właściwą akcją końcową.

Kategorie danych:

- user/account ID;
- login/nazwa;
- e-mail;
- dane profilu i ustawienia;
- status konta;
- timestamps i lifecycle metadata;
- powiązania domenowe, które podlegają osobnym regułom retencji.

Credentiale, MFA, sesje i tokeny są rozstrzygane osobno w `PL-R02`.

---

## 5. Decyzja retencyjna

| Pozycja | Retention clock | Okres | Akcja końcowa | Decyzja |
|---|---|---:|---|---|
| aktywne konto i profil | lifecycle konta | do czasu usunięcia konta lub innego prawidłowego zakończenia celu | privacy workflow | `APPROVE` |
| konto po zweryfikowanym żądaniu usunięcia | `verified_at` | **maks. 30 dni w aktywnych systemach** | purge albo nieodwracalna anonimizacja według domeny | `APPROVE WITH CONDITIONS` |
| publiczna widoczność profilu po rozpoczęciu delete | `verified_at` | **maks. 24 godziny** | ukrycie profilu/publicznej projekcji i dalsza realizacja workflow | `APPROVE` |

30 dni jest maksymalnym oknem wykonania złożonego privacy workflow, a nie domyślną zachętą do przetrzymywania danych przez pełne 30 dni. Jeżeli dana domena może wykonać bezpieczny purge wcześniej, powinna zrobić to wcześniej.

---

## 6. Uzasadnienie okresów

### 6.1. Aktywne konto — do zakończenia celu

Dane aktywnego konta są potrzebne tak długo, jak konto istnieje i użytkownik korzysta z funkcji zależnych od konta. Nie ustanawia się dodatkowego bezterminowego okresu po ustaniu celu.

### 6.2. Maks. 30 dni po zweryfikowanym żądaniu

Okno 30 dni ma umożliwić kontrolowane wykonanie wieloetapowego workflow w wielu bounded contextach, retry, obsługę zależności oraz udokumentowanie zakończenia. Jest to limit maksymalny dla aktywnych systemów, nie standardowy czas oczekiwania.

### 6.3. Maks. 24 godziny publicznej widoczności

Publiczny profil powinien przestać być widoczny szybko po wejściu konta w zweryfikowany delete workflow. 24 godziny jest maksymalnym budżetem propagacji do read modeli/cache/projekcji, nie celem retencyjnym.

---

## 7. Warunki wcześniejszego purge

Dane powinny zostać usunięte wcześniej niż maksymalny limit, gdy:

- dana domena nie ma już celu ani prawidłowego wyjątku;
- nie ma aktywnego legal hold;
- nie istnieje zależność wymagająca krótkiego, kontrolowanego oczekiwania;
- purge nie naruszy praw innej osoby;
- wymagana została natychmiastowa likwidacja credentialu lub sesji — wtedy stosuje się PL-R02.

---

## 8. Wyjątki i legal hold

1. Legal hold może wstrzymać purge wyłącznie dla konkretnego zakresu danych i konkretnego celu.
2. Hold nie przywraca profilu do publicznej widoczności.
3. Hold nie może pozostawić aktywnego logowania do usuwanego konta.
4. Po zwolnieniu hold system ponownie ocenia dane jako `eligible for purge`.
5. Dane innej osoby, np. historia meczu lub wiadomość nadal należąca do drugiej strony, nie mogą być niszczone przez prosty account cascade; stosuje się odpowiednią anonimizację/pseudonimizację domenową.

Model hold jest opisany w PL-E14.

---

## 9. Obowiązek informacyjny

Privacy notice przed produkcją musi jasno wskazywać co najmniej:

- że dane aktywnego konta są przetwarzane przez okres istnienia konta / realizacji usługi;
- że po zweryfikowanym żądaniu usunięcia dane w aktywnych systemach są usuwane lub anonimizowane bez zbędnej zwłoki, z projektowym limitem maks. 30 dni zależnie od domeny i wyjątków;
- że publiczna widoczność profilu jest wyłączana wcześniej, projektowo maks. w 24 godziny;
- że niektóre dane domenowe mogą zostać zachowane w formie anonimowej lub ograniczonej, jeżeli istnieje prawidłowa podstawa/wyjątek;
- że backupy wygasają według osobnej polityki i podlegają deletion replay po restore.

---

## 10. Wymagania techniczne i dowodowe przed produkcją

Przed finalnym zamknięciem PL-R01 jako `APPROVE / FINAL` wymagane są:

1. test pełnego account deletion workflow;
2. dowód blokady auth natychmiast po wejściu w delete workflow;
3. dowód usunięcia publicznej projekcji maks. w 24 h;
4. dowód purge/anonimizacji aktywnych danych maks. w 30 dni;
5. test retry/idempotency po częściowym błędzie;
6. test braku przypadkowego cascade na dane drugiej strony;
7. test legal hold + release;
8. test restore + deletion replay;
9. spójność privacy notice, ROPA i retention evidence.

---

## 11. Owner przyszłego przeglądu

| Pole | Wartość |
|---|---|
| Privacy/Legal Decision Owner | Czesław Socha |
| Technical owners | Identity & Access + właściciele bounded contextów |
| Review trigger | przed produkcją, po materialnej zmianie modelu konta/delete, po incydencie privacy, zmianie prawa lub zmianie okresów retencji |
| Regular review | co najmniej raz na 12 miesięcy po wejściu modelu do produkcji |

---

## 12. Werdykt PL-R01

```text
PL-R01 = APPROVE WITH CONDITIONS

ACTIVE ACCOUNT / PROFILE = APPROVE
ACCOUNT DELETE ACTIVE-SYSTEM LIMIT = MAX 30 DAYS — APPROVE WITH CONDITIONS
PUBLIC PROFILE VISIBILITY AFTER VERIFIED DELETE = MAX 24 HOURS — APPROVE
EARLIER PURGE WHEN POSSIBLE = REQUIRED
LEGAL HOLD MAY EXTEND ONLY SPECIFIC DATA SCOPE = YES
LEGAL HOLD MAY RESTORE PUBLIC VISIBILITY OR AUTH = NO
DOMAIN-SPECIFIC ANONYMIZATION / PSEUDONYMIZATION = ALLOWED ONLY WHEN JUSTIFIED
PRIVACY NOTICE SYNC = REQUIRED
OPERATIONAL TEST EVIDENCE = REQUIRED BEFORE FINAL
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Warunki są materialne dla gotowości produkcyjnej, ale nie wymagają przeprojektowania samej polityki PL-R01.

---

## 13. Granica autoryzacji

Utworzenie tego decision record:

- nie wykonuje usunięcia żadnego konta;
- nie uruchamia purge workerów;
- nie zmienia konfiguracji produkcyjnej;
- nie zatwierdza całego ADR-V3-012 jako `ACCEPTED / FINAL`;
- nie zdejmuje freeze;
- nie autoryzuje implementacji ani deploymentu.

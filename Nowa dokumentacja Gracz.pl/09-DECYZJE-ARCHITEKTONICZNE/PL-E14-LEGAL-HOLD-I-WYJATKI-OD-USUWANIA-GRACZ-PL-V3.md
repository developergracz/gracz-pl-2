# Gracz.pl V3 — PL-E14 Legal hold i wyjątki od usuwania

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E14`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E12-PROCEDURY-REALIZACJI-PRAW-OSOB-GRACZ-PL-V3.md`, `PL-E13-UZASADNIENIA-OKRESOW-RETENCJI-GRACZ-PL-V3.md`

> Dokument ustanawia projektowy model legal hold i wyjątków od zwykłego usuwania danych dla Gracz.pl V3. Nie stanowi opinii prawnej i nie tworzy samodzielnej podstawy do zatrzymywania danych. Każdy hold wymaga konkretnego, udokumentowanego celu, zakresu, ownera, podstawy i terminu ponownego przeglądu.

---

## 1. Zasada nadrzędna

Legal hold jest wyjątkiem od zwykłego zegara retencji i nie może być używany jako mechanizm „zachowaj wszystko na wszelki wypadek”.

Przyjmuje się następujące reguły:

1. hold jest wąski i dotyczy tylko danych rzeczywiście potrzebnych do konkretnej sprawy;
2. hold nie przywraca publicznej widoczności ani zwykłego dostępu do danych;
3. hold blokuje wyłącznie purge / anonimizację tych rekordów, których zachowanie jest konieczne;
4. każdy hold ma właściciela, powód, zakres, datę rozpoczęcia, datę review i warunek zakończenia;
5. brak udokumentowanej podstawy = brak legal hold;
6. backup nie jest legal hold i nie może zastępować mechanizmu hold;
7. zakończenie hold uruchamia ponowną ocenę retencji i purge bez nieuzasadnionej zwłoki;
8. legal hold nie może być automatycznie rozszerzany na całe konto, całą bazę lub wszystkie bounded contexts.

---

## 2. Dopuszczalne klasy powodów legal hold

| ID | Klasa | Przykładowy zakres | Status |
|---|---|---|---|
| LH-01 | trwające postępowanie / wiążące żądanie organu | wyłącznie dane objęte konkretnym żądaniem | `ALLOWED SUBJECT TO VERIFIED LEGAL BASIS` |
| LH-02 | istniejący spór lub roszczenie | minimalne dane i evidence potrzebne do ustalenia, dochodzenia lub obrony roszczeń | `ALLOWED SUBJECT TO CASE-SPECIFIC REVIEW` |
| LH-03 | aktywna sprawa moderacyjna / odwoławcza | konkretna sprawa, evidence, sankcja, appeal | `ALLOWED WITH STRICT SCOPE` |
| LH-04 | aktywny incydent bezpieczeństwa / forensic | logi i artefakty dotyczące konkretnego incydentu | `ALLOWED WITH SECURITY OWNER + EXPIRY` |
| LH-05 | obowiązek zachowania danych wynikający z konkretnego przepisu | tylko dane objęte takim obowiązkiem | `ALLOWED ONLY AFTER LEGAL BASIS IDENTIFIED` |
| LH-06 | zwykła ostrożność biznesowa / potencjalna przyszła potrzeba | nieokreślony szeroki zakres | `NOT ALLOWED` |
| LH-07 | „na wszelki wypadek”, bez terminu i ownera | dowolny zakres | `PROHIBITED` |

---

## 3. Minimalny rekord legal hold

Każdy hold musi być trwałym i audytowalnym rekordem zawierającym co najmniej:

- `hold_id`;
- `reason_class`;
- opis konkretnego celu;
- wskazanie podstawy prawnej / locatora decyzji;
- `scope_type` i `scope_ids` albo równoważny minimalny selektor;
- datę rozpoczęcia;
- ownera decyzji;
- datę następnego przeglądu;
- warunek zakończenia;
- status `ACTIVE / RELEASED / EXPIRED / REJECTED`;
- evidence locator do dokumentu źródłowego bez publikowania poufnej treści;
- historię zmian zakresu;
- datę zwolnienia hold i osobę zatwierdzającą.

Nie wolno przechowywać w rekordzie hold niepotrzebnych plaintext prywatnych wiadomości, sekretów, haseł, tokenów ani pełnych dokumentów tożsamości.

---

## 4. Model zakresu

Hold powinien preferować selektory o najmniejszym możliwym zakresie, np.:

- konkretne `moderation_case_id`;
- konkretne `message_id` / attachment ID, jeżeli rzeczywiście wymagane;
- konkretny `match_id` / tournament ID;
- konkretny przedział zdarzeń security;
- minimalny zbiór rekordów audit;
- konkretny subject reference tylko wtedy, gdy zawężenie per rekord nie jest możliwe.

`ALL DATA FOR USER`, `ALL LOGS`, `ALL MESSAGES`, `WHOLE DATABASE` są domyślnie niedopuszczalne i wymagają wyjątkowego, formalnego uzasadnienia oraz Privacy/Legal review.

---

## 5. Wpływ hold na privacy request

Jeżeli użytkownik składa żądanie usunięcia, a część danych podlega ważnemu hold:

1. zwykłe przetwarzanie i publiczna widoczność danych powinny zostać zakończone tam, gdzie nie ma podstawy do dalszego użycia;
2. dane poza hold powinny zostać usunięte/zanonimizowane zgodnie z normalnym workflow;
3. dane objęte hold pozostają ograniczone do celu hold;
4. system zapisuje minimalny dowód, które klasy danych zostały czasowo wyłączone z purge i dlaczego;
5. osoba otrzymuje odpowiednią informację o ograniczeniu realizacji żądania w zakresie dozwolonym prawem;
6. po release hold system automatycznie lub operacyjnie ponawia purge/anonimizację bez wymagania nowego żądania osoby.

Hold nie może zamieniać się w nową, nieograniczoną podstawę zwykłego użycia danych.

---

## 6. Prywatne wiadomości i załączniki

Prywatne wiadomości są szczególnie wrażliwą klasą projektową.

Zasady:

- hold może objąć wyłącznie konkretną wiadomość/załącznik lub wąski zakres niezbędny dla danej sprawy;
- rutynowe objęcie całej skrzynki hold jest niedopuszczalne;
- dostęp do plaintext nie wynika automatycznie z istnienia hold;
- kopia evidence nie może niepotrzebnie duplikować całej wiadomości w audit/logach;
- po zwolnieniu hold obowiązuje zwykła polityka party-state i retencji Messaging;
- dane drugiej strony nie mogą zostać przypadkowo usunięte lub ujawnione przez realizację praw jednej osoby.

---

## 7. Moderacja i sankcje

Dla aktywnej sprawy moderacyjnej legal hold może czasowo chronić przed purge:

- zgłoszenie;
- minimalne evidence;
- historię decyzji;
- sankcję;
- odwołanie;
- audyt dostępu i zmian.

Po prawomocnym/ostatecznym zamknięciu sprawy dane wracają do zwykłego zegara retencji, chyba że istnieje odrębny, udokumentowany powód dalszego hold.

Nie wolno przedłużać hold tylko dlatego, że konto było kiedyś moderowane.

---

## 8. Security / incident hold

W przypadku konkretnego incydentu bezpieczeństwa można czasowo zatrzymać potrzebne logi lub artefakty forensic ponad zwykły okres retencji, jeśli:

- istnieje identyfikator incydentu;
- zakres jest ograniczony do danych przydatnych do analizy;
- owner Security akceptuje potrzebę techniczną;
- Privacy/Legal akceptuje zakres, jeśli obejmuje dane osobowe;
- ustalony jest review/expiry;
- dane nie są wykorzystywane do niezwiązanych celów.

Po zakończeniu incident response wymagany jest review i purge danych, które nie mają dalszej podstawy zatrzymania.

---

## 9. Backup i restore

Backup nie jest mechanizmem legal hold.

Zasady:

- aktywny hold musi istnieć jako jawny rekord poza samym backupem;
- standardowe backupy wygasają według zwykłego harmonogramu;
- nie przedłuża się backupu tylko dlatego, że zawiera dane objęte hold, chyba że istnieje odrębna, jawna decyzja i brak technicznie lepszego mechanizmu;
- po restore obowiązkowy jest replay deletion ledger oraz aktywnych holds przed użyciem danych;
- release hold musi zostać odzwierciedlony także w deletion replay, aby stare backupy nie „wskrzeszały” danych.

---

## 10. Release / expiry workflow

Dla każdego aktywnego hold musi istnieć proces przeglądu.

Minimalny workflow:

1. `ACTIVE` — zakres zablokowany przed purge;
2. review w terminie wynikającym z charakteru sprawy;
3. jeżeli powód nadal istnieje — potwierdzenie + nowa data review;
4. jeżeli powód ustał — `RELEASED`;
5. ponowne przeliczenie normalnego retention clock;
6. purge / anonimizacja danych już przeterminowanych;
7. zapis minimalnego proof wykonania;
8. zamknięcie rekordu hold.

Hold bez daty review jest niezgodny z modelem V3.

---

## 11. Separation of duties i dostęp

- tworzenie hold: Privacy/Legal lub upoważniona rola według zatwierdzonej procedury;
- techniczne wykonanie hold: upoważniony operator/usługa;
- dostęp do danych na hold: need-to-know;
- zwolnienie materialnego hold: owner decyzji albo następca z równoważnym mandatem;
- wszystkie create/update/release muszą być audytowane;
- operator techniczny nie może samodzielnie tworzyć nieograniczonego hold bez formalnego powodu.

---

## 12. Wyjątki od usuwania poza legal hold

Nie każde pozostawienie danych po żądaniu usunięcia jest legal hold. Możliwe są także inne przypadki, lecz każdy wymaga własnej podstawy i minimalizacji, np.:

- konieczność zachowania minimalnego rekordu do wykonania obowiązku prawnego;
- ograniczenie przetwarzania zamiast usunięcia w sytuacji przewidzianej prawem;
- dane nadal potrzebne drugiej stronie funkcji, np. relacyjny stan prywatnej wiadomości — przy pseudonimizacji/usunięciu identyfikatora strony usuniętej;
- dane prawidłowo i nieodwracalnie zanonimizowane, które nie są już danymi osobowymi;
- dane objęte odrębną podstawą i celem, których żądanie nie obejmuje lub których usunięcia prawo nie wymaga.

Żaden z tych przypadków nie pozwala zachować większego zakresu danych niż konieczny.

---

## 13. Niedozwolone wzorce

```text
HOLD EVERYTHING FOR 6 YEARS = PROHIBITED
HOLD BECAUSE USER ASKED FOR DELETION = PROHIBITED
BACKUP AS LEGAL HOLD = PROHIBITED
NO OWNER / NO REASON / NO REVIEW DATE = PROHIBITED
UNLIMITED MODERATION HOLD = PROHIBITED
UNLIMITED MESSAGE BOX HOLD = PROHIBITED
HOLD THAT RESTORES PUBLIC VISIBILITY = PROHIBITED
HOLD THAT ALLOWS NEW UNRELATED PROCESSING = PROHIBITED
```

---

## 14. Otwarte warunki

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-E14-O01 | wskazać konkretne podstawy prawne dla każdej realnie używanej klasy hold | P1 Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-E14-O02 | zatwierdzić techniczny model scope selectorów i propagacji hold do bounded contexts | P1 Privacy/Architecture | Privacy/Legal + Architecture | `OPEN` |
| PL-E14-O03 | zdefiniować review/expiry SLA per klasa hold | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-E14-O04 | potwierdzić, że backup/restore respektuje aktywne hold i release | P1 Operations | Privacy/Legal + Operations | `OPEN` |
| PL-E14-O05 | przetestować deletion request z częściowym hold i późniejszym release | P1 Privacy/Operations | Privacy/Legal + Operations | `OPEN` |
| PL-E14-O06 | pełna DPIA ma uwzględnić ryzyko nadużycia legal hold i over-retention | P1 Privacy/Legal | Privacy/Legal | `OPEN` |

---

## 15. Ocena PL-E14

```text
PL-E14 = PASS WITH CONDITIONS

LEGAL HOLD MODEL = DEFINED
NARROW SCOPE = REQUIRED
OWNER = REQUIRED
LEGAL BASIS / CASE REASON = REQUIRED
REVIEW / EXPIRY = REQUIRED
BACKUP AS HOLD = NOT ALLOWED
PUBLIC VISIBILITY DURING HOLD = NOT ALLOWED
UNRELATED PROCESSING DURING HOLD = NOT ALLOWED
RELEASE -> RETENTION RE-EVALUATION = REQUIRED
TECHNICAL / OPERATIONAL EVIDENCE = PENDING
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Pełny `PASS` wymaga zatwierdzenia konkretnych podstaw i SLA, wdrożenia audytowalnego rejestru hold, propagacji do wszystkich bounded contexts oraz dowodu testowego dla create/release/purge/restore.

---

## 16. Granica autoryzacji

Utworzenie PL-E14:

- nie ustanawia żadnego aktywnego legal hold;
- nie upoważnia do zatrzymania żadnych konkretnych danych;
- nie zmienia retencji produkcyjnej;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia Production V3 NO-GO.

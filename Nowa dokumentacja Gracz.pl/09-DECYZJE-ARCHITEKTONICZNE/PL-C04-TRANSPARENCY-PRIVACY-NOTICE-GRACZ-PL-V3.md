# Gracz.pl V3 — PL-C04 Transparency / Privacy Notice

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — HOLD / VERSIONED / FREEZE-SAFE**  
Control ID: `PL-C04`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E03`, `PL-E07`, `PL-E09`, `PL-E11`, `PL-E13`, `PL-E15`  
Powiązane decisions: `PL-R01`–`PL-R09`

> Kryterium PL-C04: privacy notice ma pozwalać użytkownikowi zrozumieć kto przetwarza dane, w jakich celach, na jakiej podstawie, jakie dane i odbiorcy są objęci przetwarzaniem, czy występują transfery, jakie okresy lub kryteria retencji obowiązują, jakie prawa przysługują osobie oraz jakie szczególne zasady dotyczą małoletnich i istotnych technologii. Sam projekt dokumentu nie jest równoznaczny z gotowością publikacyjną.

---

## 1. Evidence wejściowe

Bieżący dokument `PL-E09-INFORMACJA-I-POLITYKA-PRYWATNOSCI-GRACZ-PL-V3.md` zawiera już projektowo:

- identyfikację administratora;
- zakres procesów Gracz.pl V3;
- kategorie danych;
- cele i proponowane podstawy prawne;
- odbiorców i kandydatów na procesorów;
- sekcję transferów poza EOG;
- tabelę okresów przechowywania;
- prawa osób;
- model małoletnich;
- środki bezpieczeństwa jako wymagania projektowe;
- sekcję automated decision-making/profiling;
- sekcję cookies/local storage;
- regułę wersjonowania zmian polityki.

To jest wystarczające jako **struktura disclosure**, ale nie jako końcowa informacja publikacyjna.

---

## 2. Kontrola kompletności disclosure

| Obszar | Stan | Ocena |
|---|---|---|
| Administrator | nazwany | `PASS WITH CONDITIONS` |
| Kontakt administratora | adres i privacy e-mail `PENDING` | `HOLD` |
| Cele przetwarzania | zmapowane | `PASS WITH CONDITIONS` |
| Podstawy prawne | część `PROPOSED / LIA REQUIRED / PENDING` | `HOLD` |
| Kategorie danych | opisane | `PASS WITH CONDITIONS` |
| Odbiorcy/procesorzy | model opisany, providerzy niezweryfikowani | `HOLD` |
| Transfery poza EOG | model kontroli opisany, stan faktyczny `TO VERIFY` | `HOLD` |
| Retencja | wartości projektowe opisane | `PASS WITH CONDITIONS` |
| Retencje sporne | PL-R03, PL-R06, PL-R07 pozostają częściowo `HOLD` | `HOLD` |
| Prawa osób | opisane, procedury produkcyjne niezweryfikowane | `PASS WITH CONDITIONS` |
| Małoletni | baseline 16+ opisany, finalne review/DPIA nadal otwarte | `HOLD` |
| Automated decision-making/profiling | `PENDING FINAL INVENTORY` | `HOLD` |
| Cookies/local storage | `PENDING SEPARATE INVENTORY` | `HOLD` |
| Security statements | właściwie opisane jako projektowe, nie jako wdrożone | `PASS` |
| Wersjonowanie | wymagane i opisane | `PASS` |

---

## 3. Wymagania przed publikacją

Przed oznaczeniem PL-C04 jako `PASS` należy co najmniej:

1. uzupełnić pełne dane kontaktowe administratora przeznaczone do publikacji;
2. zamknąć albo jednoznacznie zakwalifikować podstawy prawne objęte `LIA REQUIRED`, `PENDING` lub `TO VERIFY`;
3. zweryfikować rzeczywistych providerów, ich role, DPA, subprocesorów, regiony i transfery;
4. zsynchronizować privacy notice z końcowymi decyzjami PL-R01–PL-R09, w szczególności z pozycjami pozostającymi w `HOLD`;
5. uwzględnić wynik pełnej DPIA, ponieważ screening PL-E11 wskazał obowiązek wykonania DPIA przed produkcją;
6. potwierdzić końcowy model małoletnich w regulaminie i privacy notice;
7. wykonać faktyczny inventory cookies/local storage/edge technologies;
8. wykonać final inventory automatyzacji/profilowania i dopisać wymagane informacje, jeśli okażą się materialne;
9. potwierdzić, że opisy praw osób odpowiadają rzeczywiście gotowym procedurom PL-E12;
10. opublikować wyłącznie wersję odpowiadającą faktycznemu, zatwierdzonemu stanowi systemu i providerów.

---

## 4. Zakaz overclaim

Privacy notice nie może deklarować jako faktu czegoś, co istnieje wyłącznie w dokumentacji projektowej. W szczególności nie wolno deklarować jako wdrożonych lub potwierdzonych:

- pełnej zgodności providerów i transferów przed ich weryfikacją;
- kompletnego działania deletion replay bez dowodów operacyjnych PL-E15;
- pełnej gotowości praw osób bez testów procedur;
- braku cookies bez inventory technicznego;
- pełnej anonimowości danych bez potwierdzonego procesu anonimizacji;
- zakończonej DPIA, dopóki wykonany jest tylko screening;
- ostatecznie zatwierdzonych podstaw prawnych lub okresów, które nadal mają status `HOLD`.

---

## 5. Ocena PL-C04

```text
PL-C04 = HOLD

PRIVACY NOTICE STRUCTURE = PRESENT
CONTROLLER IDENTITY = PRESENT
CONTROLLER PUBLIC CONTACT = INCOMPLETE
PURPOSES = DOCUMENTED
LAWFUL BASES = NOT FULLY CLOSED
RETENTION DISCLOSURE = PRESENT / PARTIALLY UNRESOLVED
PROCESSORS / TRANSFERS = NOT VERIFIED
MINORS DISCLOSURE = PRESENT / FINAL REVIEW OPEN
COOKIES / LOCAL STORAGE INVENTORY = OPEN
AUTOMATED DECISION INVENTORY = OPEN
FULL DPIA = REQUIRED / NOT COMPLETED
PUBLICATION READY = NO
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
REVIEWED DESIGN GATE = HOLD
FREEZE = ACTIVE
```

`HOLD` jest wynikiem kontroli gotowości do publikacji, a nie braku dokumentu. Projekt PL-E09 jest wystarczającym evidence strukturalnym, lecz nie może jeszcze zostać uznany za finalną, prawdziwą i kompletną informację publikacyjną.

---

## 6. Granica autoryzacji

Utworzenie PL-C04:

- nie publikuje polityki prywatności;
- nie zmienia strony Gracz.pl;
- nie zmienia providerów, DNS, Render, bazy ani sekretów;
- nie zatwierdza automatycznie podstaw prawnych, transferów ani okresów `HOLD`;
- nie stanowi pełnej DPIA;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze ani `Production V3 = NOT READY`.

# Gracz.pl V3 — PL-C05 Accountability / trwały evidence record

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C05`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — FREEZE-SAFE**

> Celem kontroli PL-C05 jest potwierdzenie, że decyzje Privacy/Legal, wyjątki od standardowej retencji oraz materialne odstępstwa są zapisywane jako trwałe, wersjonowane i audytowalne evidence. Kontrola nie potwierdza jeszcze gotowości operacyjnej ani finalnego zatwierdzenia ADR-V3-012.

---

## 1. Kryterium kontroli

Kryterium PL-C05 z formalnego review packa:

```text
ACCOUNTABILITY = decyzje i wyjątki mają trwały evidence record
```

Dla `PASS` lub `PASS WITH CONDITIONS` wymagane jest, aby decyzje nie istniały wyłącznie jako ustne ustalenie, pamięć operatora, wiadomość czatu lub nieversionowany dokument roboczy.

---

## 2. Istniejące trwałe artefakty accountability

Na dzień review istnieją następujące klasy trwałych artefaktów:

- `REV-ADR-V3-012-PRIVACY-LEGAL-REVIEW-PACK.md` — formalny kontrakt review;
- `ROPA-GRACZ-PL-V3.md` — rejestr czynności i zakresów przetwarzania;
- evidence `PL-E01–PL-E16` — wersjonowane dowody i decyzje cząstkowe;
- decyzje retencyjne `PL-R01–PL-R09` — jawne rozstrzygnięcia per blok retencji;
- kontrole `PL-C01+` — formalne wyniki kontroli wraz z przyczyną PASS/HOLD;
- `PL-E16-WERSJONOWANY-ZAPIS-DECYZJI-PRIVACY-LEGAL-GRACZ-PL-V3.md` — centralny versioned decision record;
- `PL-E14-LEGAL-HOLD-I-WYJATKI-OD-USUWANIA-GRACZ-PL-V3.md` — model trwałego, audytowalnego rekordu legal hold i wyjątków.

Każdy nowy materialny review lub zmiana werdyktu powinny pozostawiać nową wersję/commit i nie usuwać wcześniejszej historii decyzji.

---

## 3. Minimalny record decyzji Privacy/Legal

Każda materialna decyzja powinna zawierać co najmniej:

1. identyfikator decyzji/review;
2. datę;
3. ownera / osobę podejmującą decyzję;
4. zakres procesu/danych;
5. podstawę lub rationale;
6. evidence locator;
7. status `PASS / PASS WITH CONDITIONS / HOLD / REJECT / N/A`;
8. warunki otwarte i ich severity;
9. wpływ na retention/deletion/legal hold;
10. wpływ na `REVIEWED DESIGN GATE`, implementację i deployment;
11. historię kolejnych zmian.

Brak trwałego locatora dla materialnej decyzji powoduje, że decyzja nie może być traktowana jako zamknięta.

---

## 4. Accountability dla wyjątków od usuwania

Wyjątek od normalnej retencji nie może istnieć jako nieformalna instrukcja operatora.

Dla legal hold / wyjątku wymagany jest minimalnie:

- `hold_id` lub równoważny identyfikator;
- konkretny powód i cel;
- podstawa / locator decyzji;
- minimalny scope;
- owner;
- data rozpoczęcia;
- `review_at`;
- warunek zakończenia / expiry;
- status `ACTIVE / RELEASED / EXPIRED / REJECTED`;
- historia zmian zakresu;
- release evidence i ponowne uruchomienie normalnego retention/purge.

Wzorce `HOLD EVERYTHING`, `NO OWNER`, `NO REASON`, `NO REVIEW DATE` oraz backup jako legal hold pozostają niedozwolone.

---

## 5. Accountability dla zmian polityki i retencji

Każda materialna zmiana dotycząca:

- celu przetwarzania;
- podstawy prawnej;
- retencji;
- klasy danych;
- małoletnich;
- providera / procesora;
- transferu;
- sposobu usunięcia, anonimizacji lub restriction;
- legal hold;
- backup/restore/deletion replay;

musi powodować aktualizację odpowiednich artefaktów i pozostawić wersjonowany ślad w repozytorium albo w innym zatwierdzonym durable evidence store.

Zmiana techniczna bez odpowiadającej jej aktualizacji governance nie może być traktowana jako automatyczna zmiana zatwierdzonej polityki.

---

## 6. Ocena istniejącego stanu

Pozytywne elementy:

- centralny versioned decision record PL-E16 istnieje;
- evidence PL-E01–PL-E16 jest zapisane jako trwałe artefakty;
- decyzje PL-R są zapisywane oddzielnie z jawnie wskazanym wynikiem;
- HOLD/PASS WITH CONDITIONS są zapisywane zamiast domyślnego PASS;
- legal hold ma zdefiniowany minimalny trwały record i obowiązek historii zmian;
- governance jawnie rozdziela dokumentację od implementacji i deploymentu.

Niezamknięte elementy:

- finalny podpisany formularz ADR-V3-012 nadal nie jest wykonanym durable approval artifact dla końcowego werdyktu;
- nie istnieje jeszcze operacyjny dowód, że każdy realny legal hold/create/update/release jest zapisywany w audytowalnym systemie;
- nie istnieje jeszcze operacyjny dowód, że deletion/restriction/restore receipts są trwale zapisywane i korelowane z decision record;
- pełna DPIA i provider/DPA review nadal pozostają otwarte i muszą zostać podłączone do finalnego recordu;
- wszystkie przyszłe odstępstwa produkcyjne będą wymagały własnego evidence locatora, ownera i daty review.

---

## 7. Otwarte warunki PL-C05

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C05-O01 | po zakończeniu całego review podpisać/utrwalić finalny formularz ADR-V3-012 jako durable approval artifact | P1 Governance | Privacy/Legal Decision Owner | `OPEN` |
| PL-C05-O02 | przed produkcją potwierdzić operacyjny audytowalny rejestr legal hold create/update/release | P1 Privacy/Operations | Privacy/Legal + Operations | `OPEN` |
| PL-C05-O03 | potwierdzić durable receipts dla delete/restrict/anonymize/consent withdrawal/restore replay | P1 Privacy/Operations | Privacy/Legal + Operations | `OPEN` |
| PL-C05-O04 | podpiąć pełną DPIA oraz finalne provider/DPA/transfer decisions do centralnego decision record | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C05-O05 | utrzymać historię zmian bez nadpisywania poprzednich werdyktów | P2 Governance | Documentation Owner | `ONGOING` |

---

## 8. Werdykt PL-C05

```text
PL-C05 = PASS WITH CONDITIONS

VERSIONED DECISION RECORD = PRESENT
EVIDENCE PL-E01–PL-E16 = VERSIONED
RETENTION DECISIONS PL-R01–PL-R09 = VERSIONED
LEGAL HOLD RECORD MODEL = DEFINED
MATERIAL EXCEPTIONS REQUIRE OWNER / REASON / REVIEW / LOCATOR = YES
FINAL SIGNED ADR APPROVAL ARTIFACT = PENDING
OPERATIONAL LEGAL-HOLD AUDIT EVIDENCE = PENDING
OPERATIONAL PRIVACY-ACTION RECEIPTS = PENDING

ADR-V3-012 FINAL VERDICT = NO CHANGE / HOLD
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
FREEZE = ACTIVE
```

`PASS WITH CONDITIONS` oznacza, że kontrola accountability jest spełniona na poziomie governance i dokumentacji, ale pełny `PASS` wymaga jeszcze finalnego durable approval artifact oraz operacyjnego dowodu działania rejestrów wyjątków i privacy actions.

---

## 9. Granica autoryzacji

Utworzenie PL-C05:

- nie podpisuje formalnego formularza końcowego;
- nie zmienia żadnego aktywnego legal hold;
- nie uruchamia purge, deletion ani restore;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `ADR-V3-012 = HOLD` ani `Production V3 = NO-GO`.

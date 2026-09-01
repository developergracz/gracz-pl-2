# Gracz.pl V3 — PL-C07 Deletion, restriction i wyjątki od usuwania

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C07`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E12`, `PL-E13`, `PL-E14`, `PL-E15`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — PASS WITH CONDITIONS / FREEZE-SAFE**

> Kontrola ocenia, czy Gracz.pl V3 posiada spójny model usuwania danych, ograniczenia przetwarzania, wyjątków od usunięcia oraz obsługi legal hold. Ocena dotyczy modelu governance i projektu. Nie stanowi dowodu wdrożenia technicznego ani produkcyjnego działania workflow.

---

## 1. Cel kontroli

PL-C07 ma potwierdzić, że:

1. żądanie usunięcia nie jest traktowane jako pojedynczy `DELETE` w jednej tabeli;
2. każdy bounded context uczestniczący w przetwarzaniu posiada jawny wynik `PURGE`, `ANONYMIZE`, `RESTRICT` albo `RETAIN UNDER VALID EXCEPTION`;
3. restriction rzeczywiście blokuje zwykłe użycie danych;
4. wyjątki od usuwania mają konkretną podstawę, zakres, ownera i termin review;
5. legal hold jest wąskim wyjątkiem i nie staje się retencją „na wszelki wypadek”;
6. backup/restore nie może odwrócić wcześniej wykonanego usunięcia lub restriction;
7. po ustaniu wyjątku albo hold dane wracają do zwykłego retention/purge workflow.

---

## 2. Model bazowy deletion workflow

Model przyjęty dla V3:

```text
REQUEST RECEIVED
 -> IDENTITY VERIFIED
 -> SCOPE DISCOVERY
 -> RIGHTS ASSESSMENT
 -> DOMAIN-BY-DOMAIN DECISION
      PURGE
      ANONYMIZE
      RESTRICT
      RETAIN UNDER VALID EXCEPTION
 -> EXECUTION
 -> RECEIPTS
 -> VALIDATION
 -> RESPONSE
 -> DELETION LEDGER / MINIMAL EVIDENCE
```

Żądanie nie może być oznaczone jako `COMPLETED`, jeżeli obowiązkowy bounded context nie zwrócił potwierdzenia wykonania albo jawnego, ważnego wyjątku.

---

## 3. Wymagane klasy działań

| Akcja | Znaczenie | Warunek |
|---|---|---|
| `PURGE` | fizyczne usunięcie danych z aktywnego zakresu | brak dalszego celu/podstawy |
| `ANONYMIZE` | nieodwracalne zerwanie powiązania z osobą | brak mapy zwrotnej i realnej możliwości reidentyfikacji |
| `RESTRICT` | pozostawienie danych przy blokadzie zwykłego użycia | istnieje ważny powód ograniczenia; dostęp i dalsze użycie są kontrolowane |
| `RETAIN UNDER VALID EXCEPTION` | czasowe zachowanie minimalnego zakresu | konkretny wyjątek, cel, podstawa, owner, scope, review/expiry |

Pseudonimizacja sama w sobie nie jest usunięciem ani anonimizacją.

---

## 4. Publiczna widoczność po usunięciu

Po skutecznym rozpoczęciu workflow usunięcia:

- profil i dane publiczne nie powinny pozostawać widoczne dłużej niż zatwierdzony okres operacyjny;
- ranking i publiczne projekcje muszą zostać usunięte albo odłączone od osoby;
- dane objęte restriction lub legal hold nie mogą zachować publicznej widoczności tylko dlatego, że są nadal technicznie przechowywane;
- cache, indeksy wyszukiwania i read models muszą należeć do zakresu deletion workflow.

---

## 5. Restriction

Restriction musi oznaczać realną zmianę sposobu przetwarzania, a nie tylko etykietę w dokumentacji.

Wymagane mechanizmy docelowe:

- jawny stan restriction per subject/scope;
- blokada użycia przez zwykłe workery i procesy produktowe;
- brak dalszego profilowania, publikacji i wtórnego użycia;
- dostęp tylko dla jawnie uprawnionych procesów/ownerów;
- audyt wejścia i wyjścia ze stanu restriction;
- ponowna ocena podstawy przed zdjęciem ograniczenia;
- propagacja restriction do read models, indeksów i procesorów, gdy ma zastosowanie.

---

## 6. Wyjątki od usuwania

Wyjątek nie może być deklaracją ogólną typu „zachowujemy dane ze względów prawnych”. Każdy przypadek musi wskazywać:

- konkretny `reason_code`;
- cel dalszego zachowania;
- podstawę prawną albo locator decyzji;
- minimalny zakres danych;
- ownera decyzji;
- datę rozpoczęcia;
- `review_at` / `expires_at` albo obiektywny end condition;
- dozwolony zakres przetwarzania w okresie wyjątku;
- akcję końcową po ustaniu powodu.

Brak któregoś z materialnych elementów oznacza, że wyjątek nie może automatycznie blokować purge.

---

## 7. Legal hold

Legal hold jest szczególnym, wąskim wyjątkiem.

Dozwolone klasy obejmują m.in. konkretne postępowanie/wiążące żądanie organu, istniejący spór lub roszczenie, aktywną sprawę moderacyjną, konkretny incydent bezpieczeństwa albo jawny obowiązek zachowania danych.

Niedozwolone wzorce:

```text
HOLD EVERYTHING = PROHIBITED
HOLD BECAUSE USER ASKED FOR DELETE = PROHIBITED
WHOLE DATABASE HOLD = PROHIBITED BY DEFAULT
UNLIMITED MESSAGE BOX HOLD = PROHIBITED
BACKUP AS LEGAL HOLD = PROHIBITED
NO OWNER / NO REASON / NO REVIEW DATE = PROHIBITED
```

Po release hold należy ponownie policzyć retencję i wykonać purge/anonimizację bez wymagania nowego żądania użytkownika.

---

## 8. Prawa innych osób i dane relacyjne

Usunięcie danych jednej osoby nie może automatycznie naruszać praw drugiej strony.

Przykłady:

- prywatna wiadomość po usunięciu konta jednej strony może wymagać party-state model i pseudonimizacji danych usuniętej osoby do czasu końca ważnej retencji drugiej strony;
- historia turnieju może pozostać po skutecznej anonimizacji uczestnika;
- moderation evidence może zostać czasowo ograniczone przy ważnym hold;
- publiczne projekcje osoby usuniętej powinny zostać wygaszone niezależnie od tego, że pewien minimalny evidence record pozostaje.

Każdy taki przypadek musi być udokumentowany jako wyjątek, a nie domyślna retencja.

---

## 9. Backup, restore i anti-resurrection

Deletion/restriction musi przetrwać restore starszej kopii.

Przed powrotem odtworzonych danych do normalnego ruchu wymagane jest:

1. restore do izolowanego lub zablokowanego środowiska;
2. wczytanie aktualnego deletion ledger i aktywnych holds/restrictions;
3. replay wszystkich privacy actions nowszych niż backup;
4. purge/anonimizacja/restriction zgodnie z aktualnym stanem;
5. revoke credentiali/sesji, które nie mogą zostać reaktywowane;
6. odbudowa read models/cache/indeksów dopiero po reconciliation;
7. negatywne testy anti-resurrection;
8. cleanup środowiska restore po zakończeniu.

Backup nie może być używany jako sposób obejścia prawa do usunięcia.

---

## 10. Minimalny evidence record

Dla zakończonego deletion/restriction workflow powinny istnieć minimalne receipts zawierające co najmniej:

- `privacy_action_id` / `request_id`;
- pseudonimowy subject reference;
- policy version;
- zakres bounded contexts;
- wykonana akcja per context;
- completion timestamp;
- wyjątek/hold reference, jeśli wystąpił;
- retry/error state;
- final validation result.

Evidence nie może kopiować pełnej treści prywatnych wiadomości, sekretów, haseł, MFA secrets ani pełnych dokumentów tożsamości.

---

## 11. Testy wymagane przed produkcją

Pełny `PASS` dla PL-C07 wymaga dowodu co najmniej dla:

1. delete aktywnego konta z danymi w wielu bounded contexts;
2. usunięcia publicznego profilu/rankingu/read models;
3. delete jednej strony prywatnej wiadomości;
4. delete obu stron prywatnej wiadomości i późniejszego purge;
5. restriction i późniejszego release;
6. aktywnego legal hold ograniczonego do wąskiego scope;
7. częściowego hold + usunięcia pozostałych danych;
8. release hold + ponownego purge;
9. błędu jednego bounded context i retry bez fałszywego `COMPLETED`;
10. restore backupu po delete/restriction + deletion replay;
11. potwierdzenia, że usunięte konto/profil/consent nie „wskrzeszają się” po restore;
12. braku leakage PII/secrets do audit/telemetry/evidence.

---

## 12. Otwarte warunki

| ID | Warunek | Severity | Owner | Termin bramkowy | Status |
|---|---|---|---|---|---|
| PL-C07-O01 | wdrożyć idempotentny, restartowalny privacy workflow we wszystkich bounded contexts | P1 Privacy/Engineering | Engineering Owner — `PENDING NAMED ASSIGNEE` | przed implementacyjnym/produkcyjnym GO | `OPEN` |
| PL-C07-O02 | wdrożyć i przetestować realny restriction enforcement, nie tylko flagę | P1 Privacy/Engineering | Engineering Owner — `PENDING NAMED ASSIGNEE` | przed produkcją | `OPEN` |
| PL-C07-O03 | zatwierdzić podstawy i review/expiry SLA dla używanych klas legal hold | P1 Legal | Privacy/Legal Decision Owner | przed finalnym ADR verdict | `OPEN` |
| PL-C07-O04 | wdrożyć deletion ledger + receipts i propagację do read models/cache/indeksów | P1 Privacy/Architecture | Architecture/Engineering — `PENDING NAMED ASSIGNEE` | przed produkcją | `OPEN` |
| PL-C07-O05 | wykonać testy delete/restrict/hold/release/restore/anti-resurrection | P1 Privacy/Operations | Privacy/Legal + Operations | przed produkcją | `OPEN` |
| PL-C07-O06 | potwierdzić propagację wymaganych działań do procesorów/providerów | P1 Privacy/Legal | Privacy/Legal + Operations | przed produkcją | `OPEN` |
| PL-C07-O07 | pełna DPIA musi uwzględnić ryzyka błędnego deletion/restriction i nadużycia hold | P1 Privacy/Legal | Privacy/Legal Decision Owner | przed produkcją | `OPEN` |

---

## 13. Ocena kontroli

```text
PL-C07 = PASS WITH CONDITIONS

DELETION MODEL = DEFINED
RESTRICTION MODEL = DEFINED
VALID-EXCEPTION MODEL = DEFINED
LEGAL HOLD = NARROW / AUDITABLE / REVIEWABLE
BACKUP AS HOLD = NOT ALLOWED
DELETION LEDGER / RECEIPTS = REQUIRED
RESTORE PRIVACY REPLAY = REQUIRED
ANTI-RESURRECTION TESTS = REQUIRED
OPERATIONAL IMPLEMENTATION EVIDENCE = OPEN
FULL DPIA = OPEN
```

Uzasadnienie: model governance jest spójny i obejmuje usunięcie, restriction, legal hold, prawa innych osób, backup/restore i ponowne wykonanie privacy actions. Nie ma jednak jeszcze dowodu, że wszystkie bounded contexts, procesorzy, read models, cache, indeksy i restore path rzeczywiście wykonują ten model. Dlatego pełny `PASS` byłby overclaimem.

---

## 14. Wpływ na ADR i gate

```text
ADR-V3-012 = HOLD (NO CHANGE)
REVIEWED DESIGN GATE = HOLD (NO CHANGE)
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

Utworzenie PL-C07 nie autoryzuje zmian kodu, produkcji, Render, bazy, providerów ani sekretów.
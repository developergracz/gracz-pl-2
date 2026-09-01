# Gracz.pl V3 — PL-C11 Legal hold

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — VERSIONED / FREEZE-SAFE**  
Control ID: `PL-C11`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E12`, `PL-E13`, `PL-E14`, `PL-E15`, `PL-E16`  
Powiązane decyzje retencyjne: `PL-R01–PL-R09`

> Dokument ocenia kontrolę legal hold dla Gracz.pl V3. Nie ustanawia żadnego aktywnego hold i nie tworzy samodzielnej podstawy prawnej do zatrzymania danych. Kontrola może zostać uznana za pełny PASS dopiero po wykazaniu działania rejestru, propagacji zakresu, release/purge oraz zgodności z backup/restore.

---

## 1. Cel kontroli

PL-C11 ma zagwarantować, że wyjątek od zwykłego usuwania danych jest stosowany wyłącznie wtedy, gdy istnieje konkretny, udokumentowany powód i minimalny zakres danych rzeczywiście potrzebnych do danej sprawy.

Kontrola ma zapobiegać w szczególności:

- przechowywaniu całych kont „na wszelki wypadek”;
- bezterminowemu blokowaniu purge;
- traktowaniu backupu jako legal hold;
- pozostawianiu danych w normalnym użyciu podczas hold;
- automatycznemu rozszerzaniu hold na wszystkie bounded contexts;
- reaktywacji zwolnionego hold po restore.

---

## 2. Wymagany model decyzji

Każdy legal hold musi posiadać co najmniej:

- `hold_id`;
- konkretną klasę powodu i opis celu;
- zweryfikowaną podstawę / locator decyzji;
- minimalny `scope_type` i `scope_ids` albo równoważny selektor;
- ownera decyzji;
- datę rozpoczęcia;
- `review_at`;
- warunek zakończenia / expiry;
- status `ACTIVE / RELEASED / EXPIRED / REJECTED`;
- historię zmian zakresu;
- evidence locator;
- datę i ownera release.

Brak materialnego elementu powoduje, że hold nie może być traktowany jako ważny wyjątek od zwykłego retention/purge workflow.

---

## 3. Dopuszczalny zakres

Preferowany jest zakres rekordowy lub case-specific, np.:

- konkretny `moderation_case_id`;
- konkretna wiadomość lub załącznik;
- konkretny `match_id` / tournament ID;
- konkretny incydent bezpieczeństwa i wskazany przedział eventów;
- wskazane rekordy audit;
- minimalny subject reference tylko wtedy, gdy węższy selektor nie jest technicznie możliwy.

Wzorce `ALL USER DATA`, `ALL LOGS`, `ALL MESSAGES`, `WHOLE DATABASE` są domyślnie niedopuszczalne i wymagają wyjątkowego, formalnie udokumentowanego uzasadnienia.

---

## 4. Wpływ na deletion i restriction

Legal hold blokuje wyłącznie purge/anonimizację danych objętych ważnym zakresem. Nie może:

- przywracać publicznej widoczności profilu;
- reaktywować konta, sesji, MFA lub newslettera;
- pozwalać na nowe, niezwiązane przetwarzanie;
- uniemożliwiać usunięcia danych poza zakresem hold;
- automatycznie blokować całego privacy request.

Dane objęte hold powinny pozostawać w stanie ograniczonego użycia `RESTRICT / RETAIN UNDER VALID EXCEPTION` z dostępem need-to-know.

Po release należy ponownie przeliczyć retention eligibility i wykonać purge/anonimizację danych, których zwykły okres już upłynął.

---

## 5. Prywatne wiadomości i evidence

Dla wiadomości prywatnych obowiązuje podwyższony próg proporcjonalności:

- hold nie daje automatycznie dostępu do plaintext;
- nie wolno utrzymywać całej skrzynki tylko dlatego, że jedna wiadomość jest evidence;
- kopia evidence nie może niepotrzebnie duplikować pełnej treści do audit/logów;
- dane drugiej strony muszą być chronione niezależnie od requestu pierwszej strony;
- po release wraca zwykły party-state retention model.

---

## 6. Moderacja i security

Dla aktywnej sprawy moderacyjnej hold może obejmować tylko konkretną sprawę, sankcję, appeal i minimalne evidence.

Dla incydentu bezpieczeństwa hold może czasowo zachować wskazane logi/artefakty ponad zwykły okres retencji, jeżeli istnieje incident ID, owner Security, określony zakres, review/expiry i Privacy/Legal review dla danych osobowych.

Po zakończeniu sprawy wymagany jest review i purge danych bez dalszej podstawy.

---

## 7. Backup i restore

```text
BACKUP = LEGAL HOLD -> NO
```

Standardowe backupy zachowują normalny lifecycle. Aktywny hold musi istnieć jako jawny rekord niezależny od kopii zapasowej.

Po restore obowiązkowe jest odtworzenie:

- aktualnych aktywnych holds;
- release/expiry history;
- deletion/restriction state;
- deletion ledger.

Restore nie może ponownie aktywować hold, który został wcześniej zwolniony lub wygasł.

---

## 8. Separation of duties i audyt

Kontrola wymaga:

- decyzji Privacy/Legal albo upoważnionej roli dla utworzenia materialnego hold;
- technicznego wykonania przez upoważnionego operatora/usługę;
- need-to-know dla dostępu do danych;
- audytu create/update/release;
- zakazu samodzielnego ustanawiania nieograniczonego hold przez operatora technicznego;
- zatwierdzenia release przez ownera albo upoważnionego następcę.

---

## 9. Niedozwolone wzorce

```text
HOLD EVERYTHING FOR 6 YEARS = PROHIBITED
HOLD BECAUSE USER REQUESTED DELETION = PROHIBITED
BACKUP AS HOLD = PROHIBITED
NO OWNER / NO REASON / NO REVIEW DATE = PROHIBITED
UNLIMITED MODERATION HOLD = PROHIBITED
UNLIMITED MESSAGE-BOX HOLD = PROHIBITED
HOLD RESTORES PUBLIC VISIBILITY = PROHIBITED
HOLD ENABLES UNRELATED PROCESSING = PROHIBITED
```

---

## 10. Otwarte warunki przed pełnym PASS

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C11-O01 | zatwierdzić konkretne podstawy prawne / reason classes dla realnie używanych holds | P1 Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-C11-O02 | wdrożyć audytowalny rejestr legal hold z minimalnym zakresem | P1 Privacy/Architecture | Architecture + Privacy/Legal | `OPEN` |
| PL-C11-O03 | zdefiniować review/expiry SLA per klasa hold | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-C11-O04 | przetestować propagację hold i release do wszystkich materialnych bounded contexts | P1 Operational/Privacy | Engineering + Privacy/Legal | `OPEN` |
| PL-C11-O05 | przetestować deletion request z częściowym hold oraz późniejszy release + purge | P1 Operational/Privacy | Engineering + Privacy/Legal | `OPEN` |
| PL-C11-O06 | potwierdzić restore z poprawnym replay active/released holds | P1 Operations | Operations + Privacy/Legal | `OPEN` |
| PL-C11-O07 | uwzględnić ryzyko over-retention / abuse of hold w pełnej DPIA | P1 Privacy/Legal | Privacy/Legal | `OPEN` |

---

## 11. Formalna decyzja PL-C11

```text
PL-C11 = PASS WITH CONDITIONS

LEGAL HOLD MODEL = DEFINED
NARROW / CASE-SPECIFIC SCOPE = REQUIRED
OWNER = REQUIRED
REASON + BASIS = REQUIRED
REVIEW / EXPIRY = REQUIRED
BACKUP AS LEGAL HOLD = NOT ALLOWED
PUBLIC VISIBILITY DURING HOLD = NOT ALLOWED
UNRELATED PROCESSING DURING HOLD = NOT ALLOWED
RELEASE -> RETENTION RE-EVALUATION = REQUIRED
AUDIT CREATE / UPDATE / RELEASE = REQUIRED
TECHNICAL / OPERATIONAL EVIDENCE = OPEN
FULL DPIA = OPEN
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Kontrola jest poprawnie zaprojektowana na poziomie governance, ale pełny `PASS` wymaga dowodu operacyjnego, że scope, release, purge i restore działają zgodnie z modelem.

---

## 12. Granica autoryzacji

Utworzenie PL-C11:

- nie tworzy żadnego aktywnego legal hold;
- nie zatwierdza żadnego konkretnego przypadku zatrzymania danych;
- nie zmienia obecnej retencji;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO` ani `REVIEWED DESIGN GATE = HOLD`.

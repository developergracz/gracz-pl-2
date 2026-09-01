# Gracz.pl V3 — PL-R03 Privacy request evidence i anti-abuse tombstone

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — RETENTION DECISION / FREEZE-SAFE**  
Decision ID: `PL-R03`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E10`, `PL-E12`, `PL-E13`, `PL-E14`, `PL-E16`

> Dokument rozstrzyga projektową retencję dla dwóch odrębnych klas: (1) minimalnego evidence wykonania żądania privacy/RODO oraz (2) minimalnego anti-abuse/privacy tombstone po zakończeniu privacy workflow. Nie ustanawia automatycznie 6-letniego okresu jako obowiązku ustawowego. Tam, gdzie brak wystarczającego uzasadnienia prawnego, decyzja pozostaje `HOLD`.

---

## 1. Zakres decyzji

PL-R03 obejmuje:

1. `privacy request evidence` po zakończeniu żądania osoby;
2. minimalny `privacy tombstone / anti-abuse tombstone` po wykonaniu usunięcia lub innego privacy workflow;
3. retention clock, okres, zakres danych, akcję końcową i wyjątki;
4. relację z legal hold, backup/restore i deletion replay;
5. zakaz przechowywania pełnych danych użytkownika wyłącznie jako „dowodu”.

---

## 2. PL-R03-A — privacy request evidence

| Pole | Decyzja |
|---|---|
| Cel | rozliczalność wykonania żądania, możliwość wykazania przebiegu i rezultatu procesu privacy oraz obrona przed konkretnym sporem, jeśli taki cel rzeczywiście istnieje |
| Kategorie danych | minimalny request ID, typ żądania, pseudonimowy/HMAC subject reference, status, timestamps, decision/result code, minimalny receipt/evidence locator |
| Dane zabronione w evidence | hasła, tokeny, MFA secrets, pełne kopie skrzynki, pełne załączniki, pełne dokumenty tożsamości, zbędny plaintext treści prywatnych |
| Retention clock | `completion` — zakończenie obsługi żądania |
| Okres projektowy z ADR | `6 lat` |
| Akcja końcowa | purge; wcześniej możliwa dodatkowa minimalizacja/pseudonimizacja |
| Podstawa | `PENDING CASE-SPECIFIC LEGAL REVIEW`; 6(1)(f) nie może być użyte jako uniwersalne uzasadnienie „na wszelki wypadek”; 6(1)(c) tylko przy wskazaniu konkretnego obowiązku prawnego |
| Status | `HOLD` |

### 2.1. Powód HOLD

Projektowy okres 6 lat nie został jeszcze wystarczająco uzasadniony dla wszystkich typów żądań i wszystkich kategorii evidence. Sam cel „rozliczalność” nie uzasadnia automatycznie maksymalnego, identycznego okresu dla każdego przypadku.

Przed `APPROVE` należy:

- wskazać konkretny cel i podstawę dla każdej klasy evidence;
- potwierdzić, czy wszystkie typy żądań potrzebują tego samego okresu;
- ograniczyć evidence do minimalnego proof zamiast przechowywania danych źródłowych;
- ustalić, czy krótszy okres jest wystarczający;
- skorelować okres z realnym ryzykiem sporu/roszczenia i właściwymi terminami prawa materialnego/procesowego, jeśli mają zastosowanie;
- zapewnić zgodność z privacy notice i ROPA.

Do czasu zamknięcia powyższego `6 lat` pozostaje wartością projektową, a nie zatwierdzonym terminem finalnym.

---

## 3. PL-R03-B — anti-abuse / privacy tombstone

| Pole | Decyzja |
|---|---|
| Cel | zapobieganie przypadkowemu odtworzeniu usuniętego stanu, wspieranie deletion replay/anti-resurrection oraz ograniczone przeciwdziałanie nadużyciom po delete |
| Kategorie danych | wyłącznie minimalny keyed HMAC/pseudonymous subject reference, reason class, completion timestamp, expiry timestamp, opcjonalny minimalny workflow/version locator |
| Retention clock | `completion` privacy workflow |
| Okres projektowy | `24 miesiące` |
| Akcja końcowa | physical purge tombstone po upływie okresu, chyba że istnieje ważny i wąski legal hold |
| Podstawa projektowa | `art. 6(1)(f) PROPOSED / LIA REQUIRED` dla anti-abuse/anti-resurrection; element techniczny deletion replay musi pozostać proporcjonalny |
| Status | `APPROVE WITH CONDITIONS` |

### 3.1. Warunki dla tombstone

1. Tombstone nie może zawierać e-maila, loginu, profilu, historii gry, wiadomości ani innych danych biznesowych, jeśli nie są niezbędne.
2. HMAC/keyed reference musi uniemożliwiać prostą reidentyfikację bez kontrolowanego klucza.
3. Tombstone nie może służyć do marketingu, profilowania ani odbudowy konta.
4. Dostęp wyłącznie need-to-know, a operacje uprzywilejowane muszą być audytowalne.
5. Okres 24 miesięcy wymaga utrzymania zgodności z LIA i DPIA; jeżeli cel można osiągnąć krócej, okres należy skrócić.
6. Po wygaśnięciu tombstone purge jest obowiązkowy; brak review nie przedłuża retencji automatycznie.
7. Backup/restore nie może przywracać wygasłych tombstonów jako aktywnych rekordów.

---

## 4. Relacja z legal hold

Legal hold może czasowo zatrzymać purge wyłącznie konkretnego evidence/tombstone, gdy istnieją:

- konkretny reason/purpose,
- jawny scope,
- owner,
- `review_at`,
- `expires_at` albo inny kontrolowany trigger zakończenia,
- evidence podstawy decyzji.

Legal hold nie tworzy nowego bezterminowego okresu i nie może obejmować wszystkich privacy requests lub wszystkich tombstonów automatycznie.

---

## 5. Backup, restore i anti-resurrection

Po restore środowisko musi odtworzyć aktualny deletion state i wykonać deletion replay przed przywróceniem danych do normalnego użycia. Privacy request evidence i tombstone nie mogą po restore:

- reaktywować usuniętego konta;
- przywrócić sesji lub credentiali;
- przywrócić publicznej widoczności profilu;
- anulować wykonanego usunięcia;
- wydłużyć własnego retention clock ponad zatwierdzony termin.

---

## 6. Decyzja PL-R03

```text
PL-R03 = HOLD

PRIVACY REQUEST EVIDENCE / 6 YEARS = HOLD — CASE-SPECIFIC LEGAL JUSTIFICATION REQUIRED
ANTI-ABUSE / PRIVACY TOMBSTONE / 24 MONTHS = APPROVE WITH CONDITIONS
MINIMAL EVIDENCE ONLY = REQUIRED
FULL SOURCE DATA AS PROOF = NOT APPROVED
LEGAL HOLD = SCOPE-LIMITED / TIME-BOUNDED ONLY
BACKUP MUST NOT EXTEND RETENTION = REQUIRED
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Powodem całkowitego statusu `HOLD` jest nierozstrzygnięta finalna podstawa i proporcjonalność projektowego 6-letniego okresu dla privacy request evidence. Część dotycząca 24-miesięcznego tombstone może zostać uznana za `APPROVE WITH CONDITIONS`, lecz nie usuwa to blokady całego PL-R03.

---

## 7. Warunki zamknięcia PL-R03

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-R03-O01 | wskazać finalną podstawę i cel dla retencji privacy request evidence | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-R03-O02 | potwierdzić lub skrócić projektowe 6 lat per klasa evidence | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-R03-O03 | zdefiniować minimalny schema evidence bez danych źródłowych | P1 Privacy/Legal + Technical | Privacy/Legal / Privacy Orchestration | `OPEN` |
| PL-R03-O04 | potwierdzić 24-miesięczny tombstone w LIA/DPIA i privacy notice, jeśli wymagane | P1 Privacy/Legal | Privacy/Legal Decision Owner | `OPEN` |
| PL-R03-O05 | zapewnić automatyczny purge i deletion replay dla obu klas | P1 Operational | Privacy Orchestration / Operations | `OPEN — IMPLEMENTATION NOT AUTHORIZED` |

---

## 8. Granica autoryzacji

Utworzenie tego recordu:

- nie zatwierdza 6-letniej retencji jako finalnej;
- nie zezwala na przechowywanie pełnych danych użytkownika jako evidence;
- nie wdraża tombstone ani purge jobów;
- nie zmienia produkcji;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze.

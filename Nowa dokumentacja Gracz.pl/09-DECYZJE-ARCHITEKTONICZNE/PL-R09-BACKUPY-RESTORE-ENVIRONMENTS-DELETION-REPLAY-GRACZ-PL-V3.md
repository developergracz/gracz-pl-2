# Gracz.pl V3 — PL-R09 Backupy, restore environments i deletion replay

Data decyzji: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL RETENTION REVIEW / APPROVE WITH CONDITIONS / FREEZE-SAFE**  
Decision ID: `PL-R09`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E13-UZASADNIENIA-OKRESOW-RETENCJI-GRACZ-PL-V3.md`, `PL-E15-BACKUP-RESTORE-DELETION-REPLAY-GRACZ-PL-V3.md`, `PL-E14-LEGAL-HOLD-I-WYJATKI-OD-USUWANIA-GRACZ-PL-V3.md`

> PL-R09 rozstrzyga projektową politykę retencji dla backupów dziennych, tygodniowych, miesięcznych oraz izolowanych środowisk restore. Decyzja nie potwierdza wdrożenia technicznego ani działania providera. Pełna akceptacja operacyjna wymaga testów restore, deletion replay i anti-resurrection oraz zweryfikowanego lifecycle providera.

---

## 1. Zakres decyzji

PL-R09 obejmuje:

- daily backup;
- weekly backup;
- monthly backup;
- restore environment;
- ad-hoc diagnostic copies;
- privacy reconciliation po restore;
- deletion ledger i replay wcześniejszych operacji privacy;
- wpływ legal hold na backup;
- provider retention / expiry;
- dowody operacyjne wymagane przed produkcją.

---

## 2. Decyzja retencyjna

| Zakres | Retention clock | Okres zatwierdzony projektowo | Akcja końcowa | Decyzja |
|---|---|---:|---|---|
| daily backup | `created_at` | 35 dni | automatyczne expiry / deletion | `APPROVE WITH CONDITIONS` |
| weekly backup | `created_at` | 12 tygodni | automatyczne expiry / deletion | `APPROVE WITH CONDITIONS` |
| monthly backup | `created_at` | 12 miesięcy | automatyczne expiry / deletion | `APPROVE WITH CONDITIONS / MATERIAL REVIEW` |
| restore environment | rozpoczęcie lub zakończenie testu zgodnie z runbookiem | maks. 7 dni | pełny cleanup + evidence | `APPROVE WITH CONDITIONS` |
| ad-hoc diagnostic copy | utworzenie kopii | tylko minimalny czas potrzebny do celu | purge po celu | `APPROVE ONLY CASE-SPECIFIC` |

Okresy są limitami projektowymi, nie minimalnymi ustawowymi okresami przechowywania.

---

## 3. Uzasadnienie

### 3.1. Daily — 35 dni

35 dni zapewnia rozsądne krótkoterminowe okno recovery przy ograniczeniu ilości historycznych danych osobowych. Kopia nie może być używana jako zwykłe archiwum ani przedłużenie retencji danych aplikacyjnych.

### 3.2. Weekly — 12 tygodni

12 tygodni zapewnia średnioterminowy zestaw punktów DR przy zachowaniu ograniczonej liczby kopii. Po upływie okresu kopia powinna wygasnąć automatycznie.

### 3.3. Monthly — 12 miesięcy

12 miesięcy jest maksymalnym projektowym oknem dla dłuższego recovery. Ze względu na zakres danych osobowych ten okres pozostaje materialny i wymaga:

- potwierdzonego lifecycle providera;
- ścisłego access control;
- deletion replay po każdym restore;
- braku użycia kopii jako archiwum legal hold;
- okresowego review potrzeby utrzymywania 12 miesięcy.

### 3.4. Restore environment — maks. 7 dni

Środowisko restore jest tymczasowym środowiskiem operacyjnym lub testowym. Nie może stać się równoległą, długowieczną kopią produkcji. Po zakończeniu celu musi zostać usunięte razem z tymczasowymi artefaktami i poświadczeniami.

---

## 4. Zasada privacy-safe restore

Restore nie może anulować wcześniej skutecznie wykonanych operacji privacy.

Przed dopuszczeniem odtworzonych danych do normalnego ruchu wymagane jest:

1. odtworzenie do środowiska izolowanego;
2. załadowanie aktualnego deletion ledger;
3. załadowanie aktualnych restriction / hold states;
4. replay wszystkich operacji delete, anonymize, restrict, revoke i consent withdrawal wykonanych po dacie backupu;
5. ponowne unieważnienie credentiali i sesji, które nie powinny być aktywne;
6. przebudowa read models/cache/search dopiero po reconciliation;
7. testy anti-resurrection;
8. evidence potwierdzające poprawny wynik.

Jeżeli replay zakończy się błędem, środowisko nie może zostać uznane za privacy-ready.

---

## 5. Anti-resurrection — kryteria obowiązkowe

Po restore należy wykazać co najmniej, że:

- usunięte konto nie może się ponownie zalogować;
- usunięty profil nie wraca do publicznej projekcji;
- cofnięta zgoda newslettera nie zostaje reaktywowana;
- revoked tokeny, MFA i sesje nie odzyskują ważności;
- restriction nadal ogranicza zwykłe użycie danych;
- wcześniej usunięte dane chat/social nie wracają publicznie bez ważnej podstawy;
- aktywne legal holds są zachowane wyłącznie w zatwierdzonym zakresie;
- wygasłe holds nie wracają jako aktywne;
- read models, cache i indeksy nie zawierają stanu sprzed reconciliation.

---

## 6. Legal hold

PL-R09 potwierdza zasadę:

```text
BACKUP IS NOT LEGAL HOLD
```

Legal hold nie może uzasadniać zatrzymania całej linii backupów ponad zatwierdzone okresy. Jeżeli konkretny materiał musi być zachowany dłużej, powinien zostać wydzielony do kontrolowanego evidence store z własnym zakresem, ownerem, podstawą, review i expiry.

---

## 7. Provider requirements

Pełna akceptacja produkcyjna wymaga potwierdzenia, że provider backup/storage:

- obsługuje zadane retention/expiry;
- ma znane regiony, subprocessors i transfery;
- ma zaakceptowane warunki powierzenia / DPA tam, gdzie wymagane;
- wspiera bezpieczny restore;
- umożliwia kontrolę dostępu i audyt;
- nie utrzymuje niejawnych, bezterminowych kopii sprzecznych z deklarowaną retencją;
- ma procedurę offboardingu i deletion/return;
- nie reaktywuje usuniętych danych poza kontrolowanym procesem restore.

Brak tych dowodów = `HOLD` dla konkretnego providera, nie dla samego modelu architektonicznego PL-R09.

---

## 8. Dowody operacyjne przed produkcją

| ID | Wymagany dowód | Status |
|---|---|---|
| PL-R09-O01 | rzeczywisty backup schedule zgodny z 35d / 12w / 12m | `OPEN` |
| PL-R09-O02 | provider lifecycle / DPA / region / subprocessors evidence | `OPEN` |
| PL-R09-O03 | restore test do izolowanego środowiska | `OPEN` |
| PL-R09-O04 | deletion replay test | `OPEN` |
| PL-R09-O05 | deleted-account anti-resurrection test | `OPEN` |
| PL-R09-O06 | withdrawn-consent anti-resurrection test | `OPEN` |
| PL-R09-O07 | restriction/legal-hold reconciliation test | `OPEN` |
| PL-R09-O08 | cleanup restore environment <= 7 dni | `OPEN` |
| PL-R09-O09 | cykliczny DR/restore evidence cadence | `OPEN` |

Jednorazowy historyczny restore nie wystarcza jako pełny dowód ciągłej gotowości.

---

## 9. Warunki wcześniejszego purge

Kopia lub restore environment mogą zostać usunięte wcześniej, jeżeli:

- przestał istnieć cel recovery/testu;
- provider lub polityka została zmieniona;
- kopia jest błędna/uszkodzona i nie ma wartości DR;
- istnieje nowa, bezpieczna kopia spełniająca wymagania;
- Privacy/Legal lub Security wymaga wcześniejszego usunięcia z powodu ryzyka.

Brak potrzeby nie uzasadnia utrzymywania kopii do pełnego maksimum okresu.

---

## 10. Owner i review

| Obszar | Owner |
|---|---|
| polityka retencji backupów | Privacy/Legal Decision Owner + Architecture/Operations |
| konfiguracja provider retention | Operations / Infrastructure |
| deletion replay | Privacy Orchestration + domain owners |
| anti-resurrection tests | QA / Security / Privacy |
| legal hold | Privacy/Legal |
| cykliczny DR review | Operations + Security + Privacy |

Polityka wymaga ponownego review przy zmianie providera, regionu, okresów backupu, mechanizmu deletion ledger, skali danych albo po incydencie restore/privacy.

---

## 11. Werdykt PL-R09

```text
PL-R09 = APPROVE WITH CONDITIONS

DAILY BACKUP = 35 DAYS
WEEKLY BACKUP = 12 WEEKS
MONTHLY BACKUP = 12 MONTHS
RESTORE ENVIRONMENT = MAX 7 DAYS
BACKUP IS LEGAL HOLD = NO
DELETION REPLAY AFTER RESTORE = MANDATORY
ANTI-RESURRECTION TESTS = MANDATORY
PROVIDER VERIFICATION = OPEN
RECURRING OPERATIONAL EVIDENCE = OPEN
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Warunki nie zmieniają faktu, że model retencyjny jest projektowo zaakceptowany. Pełny produkcyjny `PASS` wymaga realnego providera, automatyzacji, testów restore/deletion replay oraz cyklicznego evidence.

---

## 12. Granica autoryzacji

Utworzenie PL-R09:

- nie uruchamia backupów ani restore;
- nie zmienia Render, bazy, storage ani sekretów;
- nie zatwierdza konkretnego providera;
- nie stanowi dowodu wdrożenia deletion ledger;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze ani Production V3 NO-GO.

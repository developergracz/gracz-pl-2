# Gracz.pl V3 — PL-E15 Backup, restore i deletion replay

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E15`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązana retencja: `PL-E13-UZASADNIENIA-OKRESOW-RETENCJI-GRACZ-PL-V3.md`  
Powiązany legal hold: `PL-E14-LEGAL-HOLD-I-WYJATKI-OD-USUWANIA-GRACZ-PL-V3.md`  
Powiązane prawa osób: `PL-E12-PROCEDURY-REALIZACJI-PRAW-OSOB-GRACZ-PL-V3.md`

> Dokument stanowi formalny artefakt evidence dla PL-E15. Definiuje docelowy model privacy-safe backup/restore dla Gracz.pl V3, w tym zasady wygaszania kopii, odtwarzania, deletion ledger oraz obowiązkowego replay usunięć i ograniczeń po restore. Nie potwierdza jeszcze istnienia kompletnej automatyzacji ani dowodu operacyjnego w środowisku produkcyjnym.

---

## 1. Cel

Celem PL-E15 jest wyeliminowanie ryzyka, że poprawnie usunięte, zanonimizowane lub ograniczone dane użytkownika ponownie staną się aktywne po odtworzeniu starszej kopii zapasowej.

Model V3 przyjmuje zasadę:

```text
BACKUP MAY CONTAIN HISTORICAL PERSONAL DATA
BACKUP IS NOT NORMAL ACCESSIBLE ARCHIVE
RESTORE DOES NOT CANCEL PRIOR PRIVACY ACTIONS
DELETION / RESTRICTION STATE MUST BE REPLAYED BEFORE RESTORED DATA RETURNS TO SERVICE
```

---

## 2. Zasady nienaruszalne

1. Backup służy wyłącznie continuity/recovery, nie do obchodzenia retencji.
2. Backup nie jest legal hold.
3. Dane w kopii nie mogą być używane do zwykłych celów biznesowych bez restore do kontrolowanego środowiska.
4. Każdy restore obejmujący dane osobowe musi przejść procedurę privacy reconciliation.
5. Usunięcie konta nie wymaga natychmiastowego chirurgicznego usuwania rekordu z każdej immutable kopii, jeśli kopia jest izolowana, ma krótki lifecycle i po restore wymuszany jest replay usunięcia.
6. Kopia po przekroczeniu zatwierdzonego retention clock musi zostać skutecznie wygaszona/usunięta zgodnie z możliwościami providera.
7. Backup nie może być przechowywany bezterminowo jako ukryte archiwum.
8. Provider backup/storage musi przejść PL-E07/PL-E08.
9. Restore nie może automatycznie publikować danych przed zakończeniem privacy reconciliation.
10. Każda operacja restore musi być audytowalna.

---

## 3. Docelowe okresy backupów

Wartości projektowe wynikające z ADR-V3-012 i podlegające końcowemu review:

| Klasa kopii | Okres docelowy | Zasada końcowa |
|---|---:|---|
| daily backup | 35 dni | automatyczne wygaśnięcie/usunięcie |
| weekly backup | 12 tygodni | automatyczne wygaśnięcie/usunięcie |
| monthly backup | 12 miesięcy | automatyczne wygaśnięcie/usunięcie |
| restore environment | maks. 7 dni | purge po zakończeniu restore/verification |
| ad-hoc diagnostic copy | tylko wyjątkowo, minimalny czas | jawny owner, TTL, powód i usunięcie po celu |

Przechowywanie kopii dłużej wymaga osobnej decyzji Privacy/Legal, celu, podstawy, ownera i aktualizacji PL-E13/ROPA.

---

## 4. Deletion ledger

V3 powinien posiadać minimalny, trwały rejestr operacji privacy wystarczający do odtworzenia stanu po restore bez przechowywania pełnych danych osoby.

Minimalne pola logiczne:

- `privacy_action_id`;
- pseudonimowy lub keyed subject reference;
- typ działania: delete / anonymize / restrict / revoke / consent withdrawal / hold-related state;
- effective timestamp;
- zakres/bounded contexts;
- status wykonania per domena;
- retry / completion metadata;
- minimalny evidence locator;
- aktualny hold reference, jeśli istnieje;
- wersja polityki.

Deletion ledger nie może zawierać plaintext prywatnych wiadomości, sekretów, haseł, MFA secrets ani pełnych dokumentów tożsamości.

---

## 5. Procedura restore

Każdy restore z kopii zawierającej dane osobowe musi przebiegać co najmniej w następującej kolejności:

1. przywrócić dane do środowiska izolowanego albo zablokowanego przed normalnym ruchem użytkowników;
2. potwierdzić wersję schematu i integrity backupu;
3. załadować aktualny stan deletion ledger / privacy actions;
4. załadować aktywne legal holds i restriction state;
5. wykonać replay wszystkich privacy actions, których effective timestamp jest późniejszy niż stan odtworzonej kopii;
6. usunąć/zanonimizować/ograniczyć odtworzone dane zgodnie z aktualną polityką;
7. wymusić revoke sesji/credentiali, które nie powinny zostać reaktywowane;
8. ponownie zbudować read models, cache i indeksy dopiero po reconciliation;
9. wykonać kontrole kompletności i referential integrity;
10. zapisać evidence wykonania restore + replay;
11. dopiero po pozytywnym wyniku dopuścić środowisko do normalnego ruchu;
12. usunąć tymczasowe restore artifacts po zakończeniu procesu.

---

## 6. Anti-resurrection checks

Przed oznaczeniem restore jako zakończony należy zweryfikować co najmniej:

- usunięte konto nie może ponownie się uwierzytelnić;
- publiczny profil usuniętej osoby nie może się ponownie pojawić;
- wycofana zgoda newslettera nie może zostać reaktywowana;
- usunięte/revoked sesje i tokeny nie mogą odzyskać ważności;
- dane objęte restriction nie mogą wrócić do zwykłego użycia;
- dane usunięte z publicznego chatu/social nie mogą wrócić do publicznej projekcji bez ważnego wyjątku;
- zakończone privacy requests zachowują stan wykonania;
- aktywne legal holds pozostają aktywne w dokładnym, zaakceptowanym zakresie;
- expired holds nie mogą zostać przypadkowo odtworzone jako aktywne;
- read models/cache/search nie mogą zawierać danych sprzed poprawnego replay.

---

## 7. Legal hold a backup

Legal hold może wpływać na purge w aktywnych systemach lub kontrolowanych evidence stores, ale:

- nie zamienia wszystkich backupów w archiwum dowodowe;
- nie uzasadnia globalnego wydłużenia lifecycle wszystkich kopii;
- musi mieć zakres, cel, ownera, start, review i end condition;
- po ustaniu hold należy wrócić do normalnego retention/purge;
- jeśli konkretny dowód ma być zachowany dłużej, powinien być wydzielony do kontrolowanego evidence store zamiast utrzymywania całej kopii systemu.

---

## 8. Provider requirements

Dostawca backup/storage przed produkcyjnym użyciem musi umożliwiać lub kontraktowo wspierać:

1. określone okresy retention i expiry;
2. kontrolę regionu i dostępów;
3. ochronę szyfrowaniem w tranzycie i spoczynku;
4. role/access control i audyt;
5. deletion/expiry po zakończeniu retencji;
6. informację o subprocesorach i transferach;
7. procedurę zwrotu/usunięcia danych przy offboardingu;
8. kontrolowane testy restore;
9. obsługę incydentów i notification;
10. brak niejawnych, bezterminowych kopii sprzecznych z deklarowanym lifecycle.

Brak potwierdzenia tych elementów = `HOLD` dla finalnego approval providera.

---

## 9. Dowód operacyjny wymagany przed produkcją

Pełny `PASS` dla PL-E15 wymaga nie tylko dokumentu, lecz także dowodu działania procesu. Minimalne evidence:

| ID | Dowód | Status |
|---|---|---|
| PL-E15-O01 | udokumentowany backup schedule i retention policy | `OPEN` |
| PL-E15-O02 | potwierdzony provider, DPA, regiony i lifecycle | `OPEN` |
| PL-E15-O03 | test restore do izolowanego środowiska | `OPEN` |
| PL-E15-O04 | test deletion replay po restore | `OPEN` |
| PL-E15-O05 | test „deleted account does not resurrect” | `OPEN` |
| PL-E15-O06 | test „withdrawn newsletter consent does not resurrect” | `OPEN` |
| PL-E15-O07 | test restriction / legal hold reconciliation | `OPEN` |
| PL-E15-O08 | test purge restore environment po zakończeniu | `OPEN` |
| PL-E15-O09 | okresowy DR/restore runbook i evidence cadence | `OPEN` |

Jednorazowy historyczny restore nie zastępuje cyklicznego dowodu, że cały mechanizm privacy-safe restore nadal działa.

---

## 10. Błędy i retry

Jeżeli replay dowolnej materialnej operacji privacy zakończy się błędem:

- restore nie może zostać uznany za privacy-ready;
- odpowiednia domena pozostaje zablokowana dla normalnego ruchu lub w trybie ograniczonym;
- workflow musi być idempotentny i retryable;
- błąd musi być audytowalny bez zapisywania zbędnego PII;
- P1/P0 klasyfikacja zależy od zakresu i ryzyka ekspozycji;
- jeśli dane mogły zostać udostępnione niewłaściwie, uruchamia się incident/breach assessment.

---

## 11. Relacja do praw osób

Odpowiedź „dane mogą istnieć jeszcze przez ograniczony czas w izolowanych backupach” może być dopuszczalna wyłącznie wtedy, gdy projekt faktycznie spełnia wszystkie następujące warunki:

- kopie nie są używane do normalnego przetwarzania;
- mają zatwierdzony, ograniczony lifecycle;
- dostęp jest ściśle ograniczony;
- po restore wykonywane jest skuteczne privacy reconciliation;
- dane nie wracają do aktywnego użycia po usunięciu;
- istnieje evidence, że proces działa.

Ten dokument nie ustanawia uniwersalnego wyjątku od prawa do usunięcia; opisuje techniczno-governance'owy mechanizm zgodnego wygaszenia danych historycznych.

---

## 12. Ocena PL-E15

```text
PL-E15 = PASS WITH CONDITIONS

BACKUP PRIVACY MODEL = DEFINED
RESTORE ISOLATION = REQUIRED
DELETION LEDGER = REQUIRED
DELETION / RESTRICTION REPLAY = REQUIRED
ANTI-RESURRECTION CHECKS = REQUIRED
BACKUP IS LEGAL HOLD = NO
TARGET RETENTION = 35D DAILY / 12W WEEKLY / 12M MONTHLY
RESTORE ENVIRONMENT MAX LIFETIME = 7D
PROVIDER VERIFICATION = OPEN
RECURRING OPERATIONAL RESTORE EVIDENCE = OPEN
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Pełny `PASS` wymaga wdrożenia i cyklicznego dowodu restore + deletion replay, potwierdzenia lifecycle providera oraz testów anti-resurrection.

---

## 13. Granica autoryzacji

Utworzenie PL-E15:

- nie uruchamia backupów ani restore;
- nie modyfikuje Render, bazy, storage ani sekretów;
- nie zatwierdza providera backupowego;
- nie stanowi dowodu wdrożenia deletion ledger;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze ani Production V3 NO-GO.

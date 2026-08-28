# ETAP 3 — PLAN DML REMEDIATION

Data: 28.08.2026  
Status: **SZKIELET WYKONAWCZY — BEZ SQL / BEZ AUTORYZACJI DML / DDL V3 NO-GO**

## 1. Cel dokumentu

Dokument definiuje bezpieczną ramę wykonania przyszłej remediation dla:

- **DQ-001** — orphan friendship z principalem `guest-*`,
- **DQ-002** — dwie grupy kolizji normalized-email obejmujące 5 kont.

Na obecnym etapie dokument:

- nie zawiera zapytań `UPDATE`, `DELETE`, `INSERT`, `MERGE`,
- nie autoryzuje zmian produkcyjnych,
- nie zmienia statusu V3 DDL z `NO-GO`,
- rozdziela dowody, decyzje, wykonanie, rollback i walidację.

---

## 2. Zasady nadrzędne

1. **No evidence, no mutation.**
2. Każda operacja musi mieć jednoznaczny rekord/zakres docelowy.
3. Każda operacja musi być audytowalna i odwracalna lub mieć jawnie opisany brak pełnego rollbacku.
4. DML remediation musi być wykonywane osobno od V3 DDL.
5. Przed zmianą produkcyjną wymagane są prechecki oraz świeży snapshot data-quality.
6. Po zmianie wymagane są postchecki oraz ponowne uruchomienie collectorów jakości danych.
7. Brak automatycznego `MERGE` kont na podstawie samego e-maila.
8. Brak automatycznego `DELETE` orphan friendship bez decyzji DQ-001.
9. Brak ujawniania adresów e-mail ani zbędnych danych osobowych w dokumentacji i logach remediation.

---

## 3. Warunki wejścia do fazy DML

DML nie może zostać przygotowane do wykonania, dopóki nie są spełnione wszystkie poniższe warunki:

### DQ-001

- pochodzenie `guest-*` przeanalizowane,
- decyzja: `MAP-TO-CANONICAL`, `LEGACY-QUARANTINE` albo inna jawnie zatwierdzona,
- jeśli mapowanie do konta: istnieje jednoznaczny dowód identity mapping,
- znany wpływ na Social V3 / friendship backfill.

### DQ-002

- per-account evidence dla wszystkich 5 kont,
- status biznesowy każdego konta,
- mapa zależności każdego konta,
- decyzja per rekord: `KEEP-CANONICAL`, `REQUIRE-EMAIL-CHANGE`, `LEGACY-IDENTITY` lub wyjątkowo `MERGE`,
- zatwierdzona polityka password recovery podczas remediation.

### Preflight wspólny

- świeży schema snapshot,
- pełny backup,
- potwierdzony restore test,
- potwierdzone writery/endpointy wpływające na dane,
- plan okna zmian / maintenance jeśli wymagany,
- plan rollback,
- potwierdzona rotacja/stan poświadczeń i minimalne uprawnienia,
- świeży rerun data-quality tuż przed wykonaniem.

---

## 4. Artefakty wykonawcze

Po zatwierdzeniu decyzji mają powstać osobne, reviewowalne artefakty:

1. `09a-dml-precheck-readonly.sql`
2. `09b-dq001-remediation.sql`
3. `09c-dq002-remediation.sql`
4. `09d-dml-postcheck-readonly.sql`
5. `09e-rollback-procedure.md`
6. `09f-remediation-runbook.md`

Żaden z tych skryptów nie jest tworzony ani uruchamiany automatycznie na obecnym etapie.

---

# CZĘŚĆ A — DQ-001

## 5. Decision record DQ-001

Do uzupełnienia przed DML:

| Pole | Wartość |
|---|---|
| Rekord problemowy | 1 orphan friendship |
| Typ requestera | `guest-*` |
| Addressee canonical | Potwierdzony |
| Pochodzenie guest | TBD |
| Mapowanie guest -> konto | TBD |
| Decyzja końcowa | TBD |
| Uzasadnienie | TBD |
| Ryzyko użytkownika | TBD |
| Wymagany audit event | Tak |
| Rollback możliwy | TBD |

## 6. Warianty wykonawcze DQ-001

### A. MAP-TO-CANONICAL

Warunki:

- jednoznaczny dowód mapowania guest -> canonical account,
- brak konfliktu z innymi relations,
- zachowanie provenance.

Plan logiczny:

1. precheck rekordu,
2. zapis audit/provenance,
3. kontrolowane przepięcie requestera,
4. verify referential consistency,
5. postcheck Social graph.

### B. LEGACY-QUARANTINE

Warunki:

- brak wystarczającego dowodu do mapowania.

Plan logiczny:

1. zachować rekord historycznie,
2. wyłączyć go z backfillu do aktywnego Social V3,
3. oznaczyć w artefakcie migracyjnym jako legacy anomaly,
4. upewnić się, że docelowy writer nie pozwala tworzyć nowych orphanów.

### C. DELETE-AS-INVALID

Warunki:

- osobna decyzja biznesowa i techniczna,
- potwierdzenie braku wartości historycznej,
- backup i audit trail.

Na obecnym etapie: **nieautoryzowane**.

---

# CZĘŚĆ B — DQ-002

## 7. Decision record per account

Do uzupełnienia:

| Konto | Grupa | Status biznesowy | Evidence techniczne | Zależności | Decyzja | Ryzyko | UX | Rollback |
|---|---|---|---|---|---|---|---|---|
| `gamerpl` | A | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `gamerde` | A | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `gracz.pl` | B | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `gamerpolska` | B | TBD | TBD | TBD | TBD | TBD | TBD | TBD |
| `gamer` | B | TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## 8. Minimalny evidence pack per account

Dla każdego z 5 kont wymagane są co najmniej:

- `created_at`,
- ostatnia potwierdzona aktywność,
- liczba i stan auth sessions,
- prywatne wiadomości sent/received,
- załączniki,
- password reset tokens,
- registration codes,
- role/history/audit references,
- game-related references,
- tournament references,
- moderation references,
- newsletter references,
- status weryfikacji kontaktu,
- audit events dotyczące rejestracji/profile/recovery,
- identyfikacja writerów/deploy lineage jeśli możliwa.

---

## 9. Polityki wykonawcze DQ-002

### KEEP-CANONICAL

- konto zachowuje canonical normalized-email,
- pozostałe konta w grupie muszą otrzymać inną decyzję,
- wymaga potwierdzonego prawa do kanału kontaktowego.

### REQUIRE-EMAIL-CHANGE

- konto i historia pozostają,
- konfliktujący e-mail traci status canonical,
- użytkownik musi przejść ponowną weryfikację nowego adresu,
- recovery musi pozostać jednoznaczne.

### LEGACY-IDENTITY

- konto i historia pozostają,
- brak aktywnego canonical e-mail do czasu reactivation/reverification,
- odpowiednie tylko dla potwierdzonych kont legacy/test/inactive.

### MERGE

- wyjątek wysokiego ryzyka,
- wymaga silnego dowodu wspólnej osoby,
- wymaga pełnej mapy zależności i przepięć,
- wymaga immutable provenance/audit,
- wymaga osobnej autoryzacji właściciela systemu.

---

## 10. Kolejność wykonania przyszłego DML

Domyślna sekwencja:

1. **Freeze decyzji** — zatwierdzone rekordy i warianty.
2. **Readonly precheck** — ponowne potwierdzenie dokładnego stanu rekordów.
3. **Backup + restore evidence** — potwierdzenie gotowości rollbacku.
4. **Opcjonalne ograniczenie writerów** — jeśli ryzyko race condition.
5. **DQ-001 remediation** — osobna transakcja/artefakt.
6. **VERIFY DQ-001**.
7. **DQ-002 remediation grupa A**.
8. **VERIFY grupa A**.
9. **DQ-002 remediation grupa B**.
10. **VERIFY grupa B**.
11. **Global postcheck**.
12. **Ponowny data-quality collector**.
13. **Reconciliation z macierzą decyzji**.
14. Dopiero później ocena GO/NO-GO dla odpowiednich elementów V3 DDL.

---

## 11. Wymagania transakcyjne

Każdy przyszły skrypt DML powinien:

- zaczynać się od jawnego prechecku oczekiwanego stanu,
- przerwać wykonanie, jeśli liczba/wersja rekordów nie zgadza się z planem,
- używać pojedynczej transakcji tam, gdzie operacja jest atomowa,
- unikać szerokich warunków po samym e-mailu,
- adresować rekordy po stabilnych identyfikatorach,
- zapisywać audit/provenance zgodnie z docelową polityką,
- wykonać postcheck przed `COMMIT`, jeśli technicznie możliwe,
- posiadać jasno opisaną procedurę rollback.

---

## 12. Race-condition control

Przed wykonaniem remediation należy sprawdzić, czy w trakcie operacji aktywne writery mogą:

- utworzyć nowe friendship,
- zmienić e-mail któregoś z 5 kont,
- utworzyć nowe sesje/recovery tokeny,
- zmienić stan konta.

Jeśli tak, runbook musi zawierać jedno z:

- maintenance window,
- czasowe wyłączenie wybranych endpointów,
- feature flag/write freeze,
- kontrolę wersji/row locking tam, gdzie właściwe.

---

## 13. Rollback

Rollback musi być zdefiniowany osobno dla każdej operacji.

Minimalne wymagania:

- pre-remediation snapshot wartości zmienianych rekordów,
- identyfikatory wszystkich rekordów dotkniętych operacją,
- sposób odtworzenia poprzednich wartości,
- wpływ na sesje i recovery,
- wpływ na audyt i provenance,
- warunki, przy których rollback jest jeszcze bezpieczny,
- przypadki, w których wymagany jest restore zamiast logicznego rollbacku.

---

## 14. Postcheck

Po wykonaniu DML wymagane są:

- DQ-001 orphan count = 0 lub jawnie sklasyfikowany quarantine poza aktywnym backfillem,
- DQ-002 normalized-email collision count = 0 dla aktywnego canonical modelu,
- brak nowych orphan references,
- password recovery jednoznaczne,
- wszystkie zakładane zależności zachowane,
- audit trail kompletny,
- aplikacja przechodzi testy logowania/profile/messages/social,
- ponowny `05-DATA-QUALITY-ORPHAN-COLLISION-COLLECTOR.sql` potwierdza oczekiwany stan.

---

## 15. Kryteria zatrzymania

Natychmiastowy STOP / ROLLBACK, jeśli:

- precheck nie zgadza się z oczekiwanym snapshotem,
- pojawia się dodatkowy rekord w grupie kolizji,
- zmienił się e-mail lub status jednego z kont od czasu decyzji,
- pojawiają się nowe zależności nieujęte w evidence pack,
- skrypt dotyka większej liczby rekordów niż przewidziano,
- recovery/session behavior staje się niejednoznaczne,
- nie działa audit/provenance,
- postcheck nie daje jednoznacznego PASS.

---

## 16. Kryteria zakończenia remediation

Remediation DQ-001/DQ-002 uznaje się za zakończone dopiero, gdy:

- decyzja każdego rekordu jest udokumentowana,
- wykonanie ma identyfikowalny commit/runbook evidence,
- wszystkie postchecki przechodzą,
- collector data-quality potwierdza brak aktywnych blockerów,
- status i macierz decyzji są zaktualizowane,
- nie ma nieudokumentowanych wyjątków.

---

## 17. Relacja do V3 DDL

Zamknięcie DQ-001/DQ-002 **nie oznacza automatycznego globalnego GO dla V3 DDL**.

Po remediation nadal muszą być ocenione pozostałe bramki preflight, w szczególności:

- backup/restore,
- pełny writer inventory,
- crypto decryptability/key/AAD compatibility,
- active-state/cutover,
- security credentials/least privilege,
- rollback/maintenance/GO-NO-GO,
- fresh schema/environment baseline.

Status globalny pozostaje:

**DDL V3: NO-GO — do czasu zamknięcia wszystkich wymaganych bramek.**

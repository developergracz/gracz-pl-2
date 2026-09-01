# Gracz.pl V3 — P1-PL-008 Backup / restore / deletion replay — pakiet wykonawczy i status

Data: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-008`  
Status: **EXECUTION PACK READY / OPERATIONAL EVIDENCE OPEN / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązane evidence/decyzje: `PL-C18`, `PL-E15`, `PL-R09`, `PL-E14`, `P1-PL-006`, `P1-PL-007`

> Dokument porządkuje wykonanie kanonicznego P1-PL-008 i ustanawia jednoznaczny protokół zebrania dowodów operacyjnych. Nie wykonuje restore na produkcji, nie zmienia konfiguracji backupów, nie wdraża deletion ledger i nie autoryzuje implementacji ani deploymentu.

---

## 1. Stan wejściowy

Warstwa projektowa jest rozstrzygnięta:

```text
BACKUP / RESTORE ARCHITECTURE = PASS
DAILY BACKUP = 35 DAYS MAX
WEEKLY BACKUP = 12 WEEKS MAX
MONTHLY BACKUP = 12 MONTHS MAX
RESTORE ENVIRONMENT = MAX 7 DAYS
BACKUP AS LEGAL HOLD = NO
DELETION / RESTRICTION / CONSENT REPLAY = MANDATORY
ANTI-RESURRECTION = MANDATORY
```

Jednocześnie `PL-C18`, `PL-E15` i `PL-R09` wskazują, że pełny PASS wymaga rzeczywistych dowodów operacyjnych. Wszystkie pozycje O01–O09 pozostają do wykonania w środowisku kontrolowanym.

---

## 2. Kryterium zamknięcia P1-PL-008

`P1-PL-008 = CLOSED` jest możliwe dopiero po uzyskaniu pozytywnych, trwałych dowodów dla wszystkich dziewięciu obszarów:

| ID | Dowód wymagany | Wynik wymagany | Status |
|---|---|---|---|
| P1-PL-008-O01 | rzeczywisty backup schedule i expiry | zgodny z 35d / 12w / 12m albo krótszy | `OPEN` |
| P1-PL-008-O02 | provider lifecycle / DPA / region / subprocessors / transfer | zweryfikowany dla faktycznie używanej usługi | `OPEN — zależność P1-PL-006/007` |
| P1-PL-008-O03 | restore do izolowanego środowiska | restore bez ruchu użytkowników, poprawny schema/integrity | `OPEN` |
| P1-PL-008-O04 | deletion/restriction replay | wszystkie akcje po dacie backupu skutecznie odtworzone | `OPEN` |
| P1-PL-008-O05 | deleted-account anti-resurrection | konto/profil/session/token nie wracają do aktywnego stanu | `OPEN` |
| P1-PL-008-O06 | withdrawn-consent anti-resurrection | newsletter pozostaje unsubscribed po restore | `OPEN` |
| P1-PL-008-O07 | restriction / legal-hold reconciliation | aktywne hold/restriction poprawne, wygasłe nie resurrectują | `OPEN` |
| P1-PL-008-O08 | cleanup restore environment | pełny cleanup i evidence <= 7 dni | `OPEN` |
| P1-PL-008-O09 | recurring DR/restore cadence | zatwierdzony runbook, owner, częstotliwość i trwały evidence locator | `OPEN` |

Jednorazowy historyczny restore nie zamyka O03–O09 i nie zastępuje cyklicznego evidence.

---

## 3. Protokół testowy — izolowany restore

Test operacyjny powinien być wykonany wyłącznie po osobnej autoryzacji technicznej i przy zachowaniu freeze dla produkcji.

Minimalny przebieg:

1. wskazać konkretną kopię backupu i zapisać `backup_id / created_at / retention_class`;
2. utworzyć izolowane środowisko restore bez publicznego ruchu;
3. potwierdzić wersję schematu, integralność oraz zakres danych;
4. załadować aktualny deletion ledger/privacy-action state;
5. załadować aktualne restriction i legal-hold state;
6. wykonać replay `delete / anonymize / restrict / revoke / consent withdrawal` późniejszych niż backup;
7. wykonać revoke credentiali, sesji, tokenów i MFA, które nie mogą odzyskać ważności;
8. przebudować read models/cache/search dopiero po zakończeniu reconciliation;
9. wykonać anti-resurrection checks z sekcji 4;
10. zapisać wynik i locatory evidence;
11. nie dopuścić środowiska do ruchu przy jakimkolwiek materialnym błędzie replay;
12. usunąć środowisko i tymczasowe artefakty najpóźniej w ciągu 7 dni, preferencyjnie bezpośrednio po zakończeniu testu.

---

## 4. Obowiązkowe anti-resurrection checks

Każdy test powinien zawierać co najmniej następujące przypadki:

```text
AR-01 DELETED ACCOUNT LOGIN = DENIED
AR-02 DELETED PUBLIC PROFILE = NOT VISIBLE
AR-03 REVOKED SESSION / TOKEN = INVALID
AR-04 REVOKED / DELETED MFA STATE = NOT ACTIVE
AR-05 WITHDRAWN NEWSLETTER CONSENT = REMAINS WITHDRAWN
AR-06 DELETED / RESTRICTED CHAT-SOCIAL STATE = NOT REPUBLISHED
AR-07 RESTRICTION = STILL EFFECTIVE
AR-08 ACTIVE LEGAL HOLD = PRESERVED ONLY IN APPROVED SCOPE
AR-09 EXPIRED / RELEASED HOLD = NOT REACTIVATED
AR-10 READ MODEL / CACHE / SEARCH = NO PRE-RECONCILIATION PERSONAL STATE
```

Każde `FAIL` w AR-01–AR-10 oznacza, że P1-PL-008 pozostaje otwarty.

---

## 5. Dowód rzeczywistego backup schedule

Dla O01 wymagany jest account-specific evidence z rzeczywiście używanego środowiska/provider console albo równoważnego źródła operacyjnego. Dowód musi wskazywać:

- nazwę usługi/bazy;
- region;
- typ backupu;
- realny schedule;
- realny expiry/retention;
- timestamp review;
- ownera;
- locator lub screenshot/evidence artifact bez sekretów.

Publiczna dokumentacja providera nie zastępuje tego dowodu, ponieważ może opisywać możliwości produktu, a nie konkretną konfigurację Gracz.pl.

---

## 6. Provider lifecycle dependency

P1-PL-008-O02 pozostaje zależne od `P1-PL-006` i `P1-PL-007`.

Dla backup/storage należy potwierdzić co najmniej:

- legal entity i rolę;
- DPA/contract locator;
- region storage i processing;
- subprocessors;
- remote/support access;
- transfer mechanism, jeśli występuje;
- encryption/access controls;
- deklarowany i rzeczywisty lifecycle backupów;
- deletion/return/offboarding;
- brak niejawnego bezterminowego archive.

Dopóki account-specific provider evidence pozostaje otwarte, P1-PL-008 nie może zostać oznaczony jako CLOSED.

---

## 7. Runbook i cykliczny evidence cadence

Przed zamknięciem O09 musi istnieć wersjonowany runbook zawierający:

```text
RUNBOOK OWNER = Operations / Security / Privacy
TEST TYPE = ISOLATED RESTORE + PRIVACY RECONCILIATION
CADENCE = PERIODIC / AFTER MATERIAL CHANGE / AFTER INCIDENT
INPUT BACKUP = RECORDED
DELETION LEDGER VERSION = RECORDED
RESTORE START / END = RECORDED
ANTI-RESURRECTION RESULTS = RECORDED
CLEANUP COMPLETED = RECORDED
EVIDENCE LOCATOR = DURABLE
FAILURE ESCALATION = DEFINED
NEXT REVIEW DATE = RECORDED
```

Częstotliwość nie jest ustanawiana jako uniwersalny wymóg prawny. Powinna wynikać z ryzyka, zmian infrastruktury oraz polityki DR projektu.

---

## 8. Minimalny format artefaktu evidence z testu

```text
EVIDENCE ID =
TEST DATE =
ENVIRONMENT = ISOLATED RESTORE
BACKUP ID / TIMESTAMP =
PROVIDER / REGION =
SCHEMA VERSION =
DELETION LEDGER VERSION =
PRIVACY ACTIONS REPLAYED =
RESTRICTIONS RECONCILED =
LEGAL HOLDS RECONCILED =
AR-01..AR-10 RESULT = PASS / FAIL
RESTORE ENV CLEANUP DATE =
INCIDENT / EXCEPTION = NONE / REFERENCE
REVIEWED BY =
APPROVED BY =
EVIDENCE LOCATOR =
```

Artefakt nie może zawierać sekretów, aktywnych tokenów, MFA secrets ani plaintext prywatnych wiadomości.

---

## 9. Status po przygotowaniu pakietu

```text
P1-PL-008 DESIGN MODEL = COMPLETE
P1-PL-008 EXECUTION PROTOCOL = COMPLETE
P1-PL-008 ACCOUNT-SPECIFIC BACKUP EVIDENCE = OPEN
P1-PL-008 ISOLATED RESTORE TEST = OPEN
P1-PL-008 DELETION / RESTRICTION REPLAY = OPEN
P1-PL-008 ANTI-RESURRECTION TESTS = OPEN
P1-PL-008 RESTORE CLEANUP EVIDENCE = OPEN
P1-PL-008 RECURRING DR EVIDENCE = OPEN

P1-PL-008 = OPEN / BLOCKED BY OPERATIONAL EVIDENCE
OPEN P0 PRIVACY/LEGAL = 0 KNOWN
FINAL ADR-V3-012 VERDICT = HOLD
SECOND FORMAL DOCUMENT OWNER SIGNATURE = SIGNED 01.09.2026 / HOLD DECISION / P1-PL-008 REMAINS OPEN
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

## 10. Następna czynność wymagana do realnego postępu

Pierwszym dowodem operacyjnym do zebrania jest `P1-PL-008-O01`: account-specific potwierdzenie rzeczywistego backup schedule/retention dla używanej bazy/usługi. Następnie, po jawnej autoryzacji technicznej, można przejść do izolowanego restore i sekwencji O03–O09.

Do czasu tej autoryzacji niniejszy dokument jest maksymalnym bezpiecznym krokiem możliwym do wykonania bez zmiany runtime/produkcji.

---

## 11. Granica autoryzacji

Utworzenie tego dokumentu:

- nie zmienia backup schedule;
- nie wykonuje restore;
- nie tworzy kopii produkcyjnych;
- nie wdraża deletion ledger;
- nie uruchamia żadnego testu na danych produkcyjnych;
- nie zmienia Render, Cloudflare, bazy, storage, DNS ani sekretów;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

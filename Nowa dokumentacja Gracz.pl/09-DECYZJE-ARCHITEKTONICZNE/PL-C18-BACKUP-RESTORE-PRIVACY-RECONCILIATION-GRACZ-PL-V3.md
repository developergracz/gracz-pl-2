# Gracz.pl V3 — PL-C18 Backup / restore / privacy reconciliation

Data review: 01.09.2026  
Wersja: `0.1`  
Control ID: `PL-C18`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — HOLD / DESIGN PASS / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E15-BACKUP-RESTORE-DELETION-REPLAY-GRACZ-PL-V3.md`, `PL-R09-BACKUPY-RESTORE-ENVIRONMENTS-DELETION-REPLAY-GRACZ-PL-V3.md`, `PL-E14-LEGAL-HOLD-I-WYJATKI-OD-USUWANIA-GRACZ-PL-V3.md`

> PL-C18 ocenia, czy backup, restore, natural expiry oraz replay wcześniejszych operacji privacy są zgodne z przyjętym modelem Privacy/Legal. Dokument ocenia kontrolę governance i design. Nie potwierdza wdrożenia technicznego, nie uruchamia backupów ani restore i nie autoryzuje implementacji lub deploymentu.

---

## 1. Kryterium kontroli

Kryterium z review pack:

```text
PL-C18 — backup/restore
PASS = natural expiry i replay deletion są zgodne z decyzją prawną
```

Dla pełnego `PASS` wymagane jest jednocześnie:

1. zatwierdzony model retencji backupów;
2. natural expiry zgodny z tym modelem;
3. izolowany restore;
4. deletion/restriction/consent/hold reconciliation przed powrotem danych do ruchu;
5. anti-resurrection checks;
6. zweryfikowany provider i lifecycle;
7. cykliczny, trwały dowód operacyjny.

---

## 2. Model projektowy — ocena pozytywna

PL-E15 oraz PL-R09 definiują spójny model:

- daily backup: maks. `35 dni`;
- weekly backup: `12 tygodni`;
- monthly backup: `12 miesięcy`;
- restore environment: maks. `7 dni`;
- ad-hoc diagnostic copy: wyłącznie case-specific, z ownerem, TTL i purge po celu;
- backup nie jest legal hold;
- backup nie jest zwykłym archiwum biznesowym;
- restore nie anuluje wcześniejszych operacji privacy;
- deletion/restriction/consent withdrawal/hold state musi zostać odtworzony przed dopuszczeniem danych do normalnego ruchu.

Ocena design:

```text
BACKUP / RESTORE DESIGN = PASS
RETENTION POLICY = APPROVE WITH CONDITIONS
PRIVACY RECONCILIATION MODEL = DEFINED
```

---

## 3. Natural expiry

Każda klasa backupu musi mieć jawny retention clock i końcową akcję `expiry / deletion`.

Niedozwolone są:

- backupy bez TTL;
- niejawne kopie providerów zachowywane poza deklarowanym lifecycle;
- używanie backupu jako trwałego archiwum;
- globalne przedłużanie całej linii backupów z powodu pojedynczego legal hold;
- pozostawienie restore environment bez daty cleanup.

Jeżeli konkretny materiał wymaga zachowania dla legal hold, powinien zostać wydzielony do kontrolowanego evidence store zamiast utrzymywania całego backupu ponad standardowy lifecycle.

---

## 4. Privacy-safe restore

Restore zawierający dane osobowe musi odbyć się w środowisku izolowanym albo zablokowanym przed ruchem użytkowników.

Przed dopuszczeniem odtworzonych danych do normalnej pracy wymagane są co najmniej:

1. identyfikacja wersji backupu i schematu;
2. załadowanie aktualnego deletion ledger;
3. załadowanie restriction i legal-hold state;
4. replay `delete / anonymize / restrict / revoke / consent withdrawal` wykonanych po dacie backupu;
5. ponowne unieważnienie credentiali, MFA, sesji i tokenów, które nie powinny być aktywne;
6. przebudowa read models, cache i indeksów dopiero po reconciliation;
7. testy kompletności i anti-resurrection;
8. trwały evidence record;
9. cleanup restore environment i artefaktów tymczasowych.

Błąd materialnego replay = brak możliwości uznania restore za privacy-ready.

---

## 5. Anti-resurrection

Pełny `PASS` wymaga realnego dowodu, że po restore:

- usunięte konto nie może ponownie się zalogować;
- usunięty profil nie wraca publicznie;
- wycofana zgoda newslettera nie wraca do `subscribed`;
- revoked tokeny, sesje i MFA nie odzyskują ważności;
- restriction nadal obowiązuje;
- usunięte dane chat/social nie wracają publicznie bez ważnej podstawy;
- aktywne legal holds są zachowane tylko w zatwierdzonym zakresie;
- wygasłe lub zwolnione holds nie wracają jako aktywne;
- read models/cache/search nie zawierają przed-reconciliation state.

---

## 6. Provider gate

Provider backup/storage nie może otrzymać finalnego approval, dopóki nie zostaną potwierdzone co najmniej:

- realne retention/expiry;
- DPA/rola procesora, jeżeli ma zastosowanie;
- regiony i subprocessors;
- transfery poza EOG;
- szyfrowanie i access control;
- auditability;
- deletion/return/offboarding;
- restore capability;
- brak niejawnych bezterminowych kopii.

Otwarte kwestie PL-C13 i PL-C14 wpływają więc bezpośrednio na PL-C18.

---

## 7. Dowody operacyjne — status

| ID | Dowód | Severity | Status |
|---|---|---|---|
| PL-C18-O01 | rzeczywisty backup schedule zgodny z 35d / 12w / 12m | P1 Operations/Privacy | `OPEN` |
| PL-C18-O02 | provider lifecycle, DPA, regions, subprocessors i transfer evidence | P1 Privacy/Legal | `OPEN` |
| PL-C18-O03 | restore test do izolowanego środowiska | P1 Operations | `OPEN` |
| PL-C18-O04 | deletion/restriction replay test | P1 Privacy/Operations | `OPEN` |
| PL-C18-O05 | deleted-account anti-resurrection test | P1 Privacy/QA | `OPEN` |
| PL-C18-O06 | withdrawn-consent anti-resurrection test | P1 Privacy/QA | `OPEN` |
| PL-C18-O07 | legal-hold/restriction reconciliation test | P1 Privacy/Legal/Operations | `OPEN` |
| PL-C18-O08 | restore environment cleanup <= 7 dni + evidence | P1 Operations | `OPEN` |
| PL-C18-O09 | cykliczny DR/restore runbook i evidence cadence | P1 Operations/Security/Privacy | `OPEN` |

Jednorazowy historyczny restore nie zamyka tych warunków.

---

## 8. Formalna decyzja PL-C18

```text
PL-C18 = HOLD

BACKUP / RESTORE ARCHITECTURE = PASS
RETENTION MODEL PL-R09 = APPROVE WITH CONDITIONS
DAILY BACKUP = 35 DAYS
WEEKLY BACKUP = 12 WEEKS
MONTHLY BACKUP = 12 MONTHS
RESTORE ENVIRONMENT = MAX 7 DAYS
BACKUP AS LEGAL HOLD = NO
DELETION / RESTRICTION REPLAY = MANDATORY
ANTI-RESURRECTION = MANDATORY
PROVIDER LIFECYCLE VERIFICATION = OPEN P1
OPERATIONAL RESTORE + REPLAY EVIDENCE = OPEN P1
RECURRING DR EVIDENCE = OPEN P1

ADR-V3-012 FINAL VERDICT = NO CHANGE / HOLD
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

`HOLD` nie oznacza odrzucenia modelu backup/restore. Model projektowy jest poprawny i spójny z ADR-V3-012. Kontrola nie może jednak otrzymać pełnego `PASS`, ponieważ jej kryterium wymaga faktycznej zgodności natural expiry i deletion replay z decyzją Privacy/Legal, a dowody provider/restore/replay/anti-resurrection pozostają otwarte.

---

## 9. Warunki zamknięcia

PL-C18 może przejść do `PASS` dopiero po:

1. zamknięciu provider lifecycle/DPA/region/transfer evidence;
2. potwierdzeniu rzeczywistego schedule i expiry;
3. wykonaniu restore do izolowanego środowiska;
4. pozytywnym deletion/restriction/consent replay;
5. pozytywnych anti-resurrection checks;
6. potwierdzeniu legal-hold reconciliation;
7. potwierdzeniu cleanup restore environment;
8. ustanowieniu cyklicznego DR/restore evidence cadence;
9. zapisaniu trwałych locatorów dowodów w versioned decision record.

---

## 10. Granica autoryzacji

Utworzenie PL-C18:

- nie uruchamia backupu ani restore;
- nie zmienia konfiguracji Render, storage ani bazy;
- nie zmienia sekretów;
- nie wdraża deletion ledger;
- nie zatwierdza providera;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

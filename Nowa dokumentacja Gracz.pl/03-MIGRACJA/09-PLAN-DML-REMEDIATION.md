# ETAP 3 — PLAN DML REMEDIATION

Data: 28.08.2026  
Status: **SZKIELET WYKONAWCZY — DQ-001 DECISION-READY / DQ-002 OTWARTE / BEZ SQL / DDL V3 NO-GO**

## 1. Cel

Dokument definiuje bezpieczną ramę przyszłej remediation dla:

- **DQ-001** — orphan friendship utworzony przez ephemeral guest,
- **DQ-002** — 2 grupy kolizji normalized-email obejmujące 5 kont.

Dokument nie zawiera wykonywalnego DML i nie autoryzuje zmian produkcyjnych.

## 2. Zasady nadrzędne

1. **No evidence, no mutation.**
2. DML remediation jest wykonywane osobno od V3 DDL.
3. Każda zmiana ma precheck, transaction boundary, audit/provenance, postcheck i rollback.
4. Brak automatycznego MERGE/DELETE kont.
5. Brak mapowania guest -> account bez jednoznacznego dowodu.
6. Brak PII w dokumentacji remediation.

## 3. Warunki wejścia do wykonania DML

### DQ-001

Analiza przyczyny jest zamknięta. Przed wykonaniem nadal wymagane są:

- freeze dokładnego rekordu,
- backup + restore evidence,
- wybór sposobu technicznego realizacji quarantine,
- audit/provenance,
- postcheck,
- potwierdzenie, że writer nie tworzy nowych persistent Social records dla guest.

### DQ-002

Nadal wymagane:

- per-account evidence dla wszystkich 5 kont,
- status biznesowy i mapa zależności,
- decyzja per rekord,
- jednoznaczna polityka password recovery.

### Preflight wspólny

- fresh schema snapshot,
- pełny backup + restore test,
- writer/reader/endpoint/worker inventory,
- crypto compatibility,
- active-state/cutover,
- credential rotation/least privilege,
- rollback/maintenance plan,
- świeży rerun data-quality przed wykonaniem.

## 4. Planowane artefakty wykonawcze

1. `09a-dml-precheck-readonly.sql`
2. `09b-dq001-remediation.sql`
3. `09c-dq002-remediation.sql`
4. `09d-dml-postcheck-readonly.sql`
5. `09e-rollback-procedure.md`
6. `09f-remediation-runbook.md`

Nie tworzyć wykonywalnego SQL przed zamknięciem wymaganych gate'ów.

# CZĘŚĆ A — DQ-001

## 5. Decision record DQ-001

| Pole | Wartość |
|---|---|
| Rekord problemowy | 1 orphan friendship |
| Typ requestera | **EPHEMERAL-GUEST** |
| Generator | `POST /auth/guest`, `guest-` + 8 hex |
| TTL | 1800 s domyślnie |
| `gracz_accounts` | Celowo brak |
| Trwała auth session | Guest nie wymaga rekordu konta/session registry |
| Root cause | Authz/bounded-context gap: ephemeral guest dopuszczony do persistent Social write |
| Mapowanie guest -> konto | **Brak dowodu; nie wykonywać** |
| Decyzja końcowa | **LEGACY-QUARANTINE** |
| Backfill Social V3 | Wykluczyć z aktywnego canonical graph |
| Fizyczny DELETE | Nieautoryzowany; możliwy później wyłącznie jako osobna decyzja |
| Provenance/audit | Wymagane |

## 6. Logiczny plan DQ-001

### LEGACY-QUARANTINE — zatwierdzony kierunek

1. readonly precheck dokładnego relation ID i oczekiwanego stanu,
2. zapis/utrwalenie provenance przed mutacją lub oznaczeniem migracyjnym,
3. wyłączenie rekordu z aktywnego backfillu Social V3,
4. brak jakiegokolwiek przypięcia guest do registered identity,
5. writer guard: persistent Social wymaga canonical registered identity,
6. verify: aktywny canonical Social graph nie zawiera orphan principal,
7. ponowny data-quality check.

### MAP-TO-CANONICAL

**Odrzucone przy obecnym evidence.** Wspólny czas, display name lub późniejsze konto nie są wystarczającym dowodem.

### DELETE-AS-INVALID

Może być rozważone dopiero później, ponieważ relacja `pending` powstała przez potwierdzoną lukę capability/authz. Wymaga jednak osobnej autoryzacji DML, backupu i zachowania provenance. Nie jest obecnie wykonywane.

# CZĘŚĆ B — DQ-002

## 7. Decision record per account

| Konto | Grupa | Potwierdzony footprint | Status biznesowy | Decyzja | Status |
|---|---|---|---|---|---|
| `gamerpl` | A | registration code | TBD | TBD | EVIDENCE REQUIRED |
| `gamerde` | A | reset token + registration code | TBD | TBD | EVIDENCE REQUIRED |
| `gracz.pl` | B | private messages sent | TBD | TBD | EVIDENCE REQUIRED |
| `gamerpolska` | B | brak zależności w dotychczasowym drill-downie | TBD | TBD | EVIDENCE REQUIRED |
| `gamer` | B | auth sessions | TBD | TBD | EVIDENCE REQUIRED |

Wspólny normalized-email nie jest dowodem wspólnej osoby. Domyślnie: **NIE SCALAĆ**.

## 8. Minimalny evidence pack DQ-002

Dla każdego konta zebrać privacy-safe:

- `created_at`, status/weryfikację kontaktu,
- sesje i ostatnią aktywność,
- messages/attachments,
- reset tokens i registration codes,
- audit/role references,
- game/tournament/moderation/newsletter references,
- writer/deploy lineage, jeśli dostępne,
- status biznesowy: główne/poboczne/testowe/legacy.

## 9. Dozwolone decyzje DQ-002

- **KEEP-CANONICAL** — maksymalnie jedno konto w grupie dla danego canonical normalized-email.
- **REQUIRE-EMAIL-CHANGE** — historia zostaje, wymagany nowy zweryfikowany adres.
- **LEGACY-IDENTITY** — dla potwierdzonych legacy/test/inactive.
- **MERGE** — wyjątek wysokiego ryzyka, tylko przy silnym dowodzie wspólnej osoby i pełnej mapie zależności.

# CZĘŚĆ C — wykonanie

## 10. Kolejność przyszłego DML

1. Freeze decyzji i snapshotów.
2. Readonly precheck.
3. Backup + restore evidence.
4. Writer freeze/maintenance, jeśli potrzebne.
5. DQ-001 remediation/quarantine.
6. VERIFY DQ-001.
7. DQ-002 grupa A.
8. VERIFY A.
9. DQ-002 grupa B.
10. VERIFY B.
11. Global postcheck.
12. Rerun data-quality.
13. Reconciliation z macierzą decyzji.
14. Dopiero potem ocena właściwych gate'ów V3 DDL.

## 11. Wymagania transakcyjne

Każda operacja musi:

- sprawdzić oczekiwany rekord i stan przed mutacją,
- przerwać się przy niezgodności snapshotu,
- adresować stabilne identyfikatory, nie szerokie warunki e-mailowe,
- używać atomowej transakcji tam, gdzie właściwe,
- zachować audit/provenance,
- wykonać postcheck przed COMMIT, jeśli możliwe,
- mieć jawny rollback.

## 12. Race-condition control

Przed remediation sprawdzić, czy aktywne writery mogą równolegle:

- tworzyć friendship,
- zmieniać e-mail/status kont,
- tworzyć sesje/recovery tokeny.

W razie ryzyka zastosować maintenance window, feature flag/write freeze lub odpowiedni locking/version check.

## 13. Rollback

Minimalnie:

- pre-remediation snapshot,
- dokładne IDs dotkniętych rekordów,
- wartości przed/po,
- sposób odtworzenia,
- wpływ na sessions/recovery,
- audit/provenance,
- warunki logicznego rollbacku vs restore.

## 14. Postcheck

Po remediation:

- DQ-001 nie występuje w aktywnym canonical Social graph,
- DQ-002 collision count = 0 dla aktywnego canonical modelu,
- brak nowych orphan references,
- recovery jest jednoznaczne,
- wszystkie zależności zachowane,
- audit trail kompletny,
- testy auth/profile/messages/social przechodzą,
- data-quality collector potwierdza oczekiwany stan.

## 15. STOP conditions

STOP/ROLLBACK, gdy:

- precheck różni się od snapshotu,
- pojawia się nowy rekord w grupie,
- zmienił się status/e-mail konta,
- odkryto niezmapowaną zależność,
- operacja dotyka większej liczby rekordów,
- recovery/session semantics są niejednoznaczne,
- audit/provenance lub postcheck nie przechodzi.

## 16. Relacja do V3 DDL

**DDL V3: NO-GO.**

DQ-001 jest **DECISION-READY**, ale remediation nie została wykonana. DQ-002 nadal wymaga evidence i decyzji. Ponadto pozostają pozostałe bramki preflight: backup/restore, writer inventory, crypto compatibility, active-state/cutover, credentials/least privilege, rollback i finalny GO/NO-GO.
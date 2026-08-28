# ETAP 3 — PLAN DML REMEDIATION

Data: 28.08.2026  
Status: **DQ-001 DECISION-READY / DQ-002 EVIDENCE COMPLETE — BUSINESS RESOLUTION REQUIRED / BEZ SQL / DDL V3 NO-GO**

## 1. Cel

Bezpieczna rama przyszłej remediation DQ-001 i DQ-002. Dokument nie zawiera wykonywalnego DML i nie autoryzuje zmian produkcyjnych.

## 2. Zasady

1. No evidence, no mutation.
2. DML remediation osobno od V3 DDL.
3. Precheck, transakcja, audit/provenance, postcheck i rollback.
4. Brak automatycznego MERGE/DELETE kont.
5. Brak mapowania guest -> account bez dowodu.
6. Brak PII w dokumentacji remediation.

## 3. DQ-001

Decyzja: **LEGACY-QUARANTINE** dla 1 orphan friendship z EPHEMERAL-GUEST. Wykluczyć z aktywnego Social V3; brak guest->account mapping. Fizyczny DELETE wymaga osobnej autoryzacji. Przed DML nadal wymagane backup/restore evidence, writer guard, provenance i postcheck.

## 4. DQ-002 — evidence complete

Collector 11 potwierdził:

- Grupa A: `gamerpl`, `gamerde` — oba `contact_verified=false`.
- Grupa B: `gracz.pl`, `gamerpolska`, `gamer` — wszystkie `contact_verified=true`.
- `gamerpl`: registration code 1, bez auth/audit/messages.
- `gamerde`: reset token 1, registration code 1, audit pending-registration + 5 login.
- `gracz.pl`: 3 sent private messages, 4 login audit events.
- `gamerpolska`: activation verified, 5 login, 1 logout, 1 failed registration event.
- `gamer`: 4 historyczne sessions, 0 aktywnych; activation verified; login/logout.
- Wszystkie pięć: 0 Social/Global Chat/Moderation, 0 Tournament, 0 badanych Games references.
- Newsletter correlation: grupa A wskazuje pending confirmation; grupa B subscribed. To korelacja kanału, nie identity proof.

## 5. Decision record per account

| Konto | Grupa | Kierunek remediation | Status |
|---|---|---|---|
| `gamerpl` | A | aktywne -> `REQUIRE-EMAIL-CHANGE`; test/legacy/inactive -> `LEGACY-IDENTITY` | BUSINESS/OWNERSHIP REQUIRED |
| `gamerde` | A | aktywne -> `REQUIRE-EMAIL-CHANGE`; test/legacy/inactive -> `LEGACY-IDENTITY` | BUSINESS/OWNERSHIP REQUIRED |
| `gracz.pl` | B | zachować identity/history; `KEEP-CANONICAL` tylko jeśli potwierdzona kontrola kanału, inaczej `REQUIRE-EMAIL-CHANGE` | OWNERSHIP REQUIRED |
| `gamerpolska` | B | zachować identity/history; `KEEP-CANONICAL` tylko jeśli potwierdzona kontrola kanału, inaczej `REQUIRE-EMAIL-CHANGE` | OWNERSHIP REQUIRED |
| `gamer` | B | zachować identity/history; `KEEP-CANONICAL` tylko jeśli potwierdzona kontrola kanału, inaczej `REQUIRE-EMAIL-CHANGE` | OWNERSHIP REQUIRED |

**MERGE i DELETE pozostają niedozwolone na obecnym evidence.**

## 6. Co jest potrzebne przed wygenerowaniem wykonywalnego DML

- dla każdej grupy wskazać maksymalnie jedno konto uprawnione do zachowania obecnego canonical normalized-email,
- sklasyfikować pozostałe konta jako aktywne (`REQUIRE-EMAIL-CHANGE`) albo potwierdzone test/legacy/inactive (`LEGACY-IDENTITY`),
- ustalić jednoznaczną politykę password recovery po zmianie,
- zamrozić decision record,
- backup + restore test,
- pre-remediation snapshot,
- writer freeze/guard tam, gdzie wymagany,
- świeży rerun data-quality.

## 7. Planowane artefakty wykonawcze

1. `09a-dml-precheck-readonly.sql`
2. `09b-dq001-remediation.sql`
3. `09c-dq002-remediation.sql`
4. `09d-dml-postcheck-readonly.sql`
5. `09e-rollback-procedure.md`
6. `09f-remediation-runbook.md`

Nie tworzyć wykonywalnego SQL przed zamknięciem powyższych gate'ów.

## 8. Kolejność przyszłego wykonania

Freeze decyzji -> readonly precheck -> backup/restore evidence -> writer control -> DQ-001 quarantine -> verify -> DQ-002 grupa A -> verify -> grupa B -> verify -> global postcheck -> rerun data-quality -> reconciliation -> dopiero ocena V3 DDL gate.

## 9. STOP conditions

STOP/ROLLBACK gdy snapshot się zmieni, pojawi się nowy rekord w grupie, zmieni się e-mail/status, odkryta zostanie niezmapowana zależność, operacja dotknie większej liczby rekordów, recovery/session semantics są niejednoznaczne albo audit/postcheck nie przejdzie.

## 10. Formalny status

**DQ-001: DECISION-READY, DML niewykonany.**  
**DQ-002: EVIDENCE COMPLETE, oczekuje business/ownership resolution przed mutacją.**  
**DDL V3: NO-GO.**

Pozostałe preflight gates nadal obejmują fresh schema snapshot, backup/restore, writer/reader/endpoint/worker inventory, crypto compatibility, active-state/cutover, credential rotation/least privilege oraz rollback/maintenance/final GO-NO-GO.
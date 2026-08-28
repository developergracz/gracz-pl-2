# ETAP 3 — PLAN DML REMEDIATION

Data: 28.08.2026  
Status: **DQ-001 DECISION-READY / DQ-002 DECISION-READY — WSZYSTKIE 5 KONT TESTOWE / BEZ SQL / DDL V3 NO-GO**

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

Decyzja: **LEGACY-QUARANTINE** dla 1 orphan friendship z EPHEMERAL-GUEST. Wykluczyć z aktywnego Social V3; brak guest->account mapping. Fizyczny DELETE wymaga osobnej autoryzacji.

## 4. DQ-002 — evidence + decyzja biznesowa kompletne

Collector 11 potwierdził techniczny footprint pięciu kont. Właściciel projektu następnie potwierdził, że `gamerpl`, `gamerde`, `gracz.pl`, `gamerpolska` i `gamer` były kontami testowymi utworzonymi podczas prac nad Gracz.pl.

Formalna klasyfikacja wszystkich pięciu: **LEGACY-IDENTITY / TEST**.

Nie wykonywać automatycznego MERGE ani DELETE. Konto `gracz.pl` ma historyczne prywatne wiadomości; inne konta mają m.in. audit, recovery, registration, session i newsletter artefacts. Remediation musi zachować provenance i referential/history safety.

## 5. Decision record per account

| Konto | Grupa | Klasyfikacja | Kierunek przyszłej remediation |
|---|---|---|---|
| `gamerpl` | A | `LEGACY-IDENTITY / TEST` | wyłączyć z aktywnego modelu V3 po precheck; zachować provenance |
| `gamerde` | A | `LEGACY-IDENTITY / TEST` | jw.; uwzględnić reset/registration artefacts |
| `gracz.pl` | B | `LEGACY-IDENTITY / TEST` | jw.; obowiązkowo zachować historię wiadomości/provenance |
| `gamerpolska` | B | `LEGACY-IDENTITY / TEST` | jw.; uwzględnić audit/newsletter lineage |
| `gamer` | B | `LEGACY-IDENTITY / TEST` | jw.; uwzględnić historyczne sessions/audit/newsletter |

`KEEP-CANONICAL` i `REQUIRE-EMAIL-CHANGE` nie są wymagane dla tych pięciu jako aktywnych identity, ponieważ biznesowo potwierdzono ich testowy charakter.

## 6. Gate'y przed wykonywalnym DML

Decyzja biznesowa DQ-002 jest zamknięta. Nadal wymagane przed mutacją:

- pełny backup + udokumentowany restore test,
- świeży pre-remediation snapshot,
- writer freeze/guard tam, gdzie wymagany,
- jednoznaczna polityka zachowania historycznych zależności/provenance,
- postcheck i rollback procedure,
- świeży rerun data-quality,
- weryfikacja, że stan pięciu kont i ich zależności nie zmienił się od collectora 11.

## 7. Planowane artefakty wykonawcze

1. `09a-dml-precheck-readonly.sql`
2. `09b-dq001-remediation.sql`
3. `09c-dq002-remediation.sql`
4. `09d-dml-postcheck-readonly.sql`
5. `09e-rollback-procedure.md`
6. `09f-remediation-runbook.md`

Przygotowanie tych artefaktów może rozpocząć się jako następny krok ETAPU 3, ale ich wykonanie na produkcji pozostaje zabronione do zamknięcia wymaganych gate'ów.

## 8. Kolejność przyszłego wykonania

Freeze decision record -> readonly precheck -> backup/restore evidence -> writer control -> DQ-001 quarantine -> verify -> DQ-002 legacy/test remediation -> verify -> global postcheck -> rerun data-quality -> reconciliation -> dopiero ocena V3 DDL gate.

## 9. STOP conditions

STOP/ROLLBACK gdy snapshot się zmieni, pojawi się nowy rekord w grupie, zmieni się e-mail/status, odkryta zostanie niezmapowana zależność, operacja dotknie większej liczby rekordów, recovery/session semantics są niejednoznaczne albo audit/postcheck nie przejdzie.

## 10. Formalny status

**DQ-001: DECISION-READY, DML niewykonany.**  
**DQ-002: DECISION-READY — 5/5 kont `LEGACY-IDENTITY / TEST`, DML niewykonany.**  
**DDL V3: NO-GO.**

Pozostałe preflight gates nadal obejmują fresh schema snapshot, backup/restore, writer/reader/endpoint/worker inventory, crypto compatibility, active-state/cutover, credential rotation/least privilege oraz rollback/maintenance/final GO-NO-GO.
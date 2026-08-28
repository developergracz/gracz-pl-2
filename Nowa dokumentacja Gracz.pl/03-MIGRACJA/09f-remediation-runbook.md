# ETAP 3 — DML remediation runbook

Data: 28.08.2026  
Status: **REVIEWABLE PLAN / NIE URUCHAMIAĆ MUTUJĄCEGO DML NA PRODUKCJI**

## Artefakty

1. `09a-dml-precheck-readonly.sql` — snapshot i assertions DQ-001/DQ-002.
2. `09b-dq001-remediation.sql` — review-only `LEGACY-QUARANTINE`, obecnie NO-OP.
3. `09c-dq002-remediation.sql` — review-only 5x `LEGACY-IDENTITY / TEST`, obecnie NO-OP.
4. `09d-dml-postcheck-readonly.sql` — verify po planowanej/no-op fazie.
5. `09e-rollback-procedure.md` — STOP/rollback.

## Kolejność review

- zweryfikować zgodność 09a z ostatnim evidence;
- potwierdzić DQ-001 target 1/1 i brak canonical guest account;
- potwierdzić DQ-002 target 5/5 oraz niezmieniony dependency footprint;
- zatwierdzić provenance policy;
- zamknąć backup/restore i writer-control gates;
- dopiero wtedy zdecydować, czy potrzebny jest mutujący DML, czy remediation pozostaje logicznym quarantine/exclusion podczas backfill V3.

## Ważne

Dla DQ-002 decyzja `LEGACY-IDENTITY / TEST` nie oznacza automatycznego DELETE. Najbezpieczniejszym wariantem może być pozostawienie AS-IS rekordów historycznych i wykluczenie ich z aktywnego identity backfill V3, jeżeli preflight i model docelowy to potwierdzą.

DDL V3 pozostaje NO-GO do zamknięcia wszystkich krytycznych gate'ów.
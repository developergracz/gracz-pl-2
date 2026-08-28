# ETAP 3 — Bramka 12: decyzja biznesowa i reconciliation

Data: 29.08.2026  
Środowisko: `gracz_pl_database` / PostgreSQL 18.4  
Status: **BRAMKA 12 = PASS**

## 1. Decyzja biznesowa

Właściciel projektu jednoznacznie potwierdził 29.08.2026:

**`gracz` = `LEGACY-IDENTITY / TEST`.**

Decyzja rozszerza zatwierdzony zestaw quarantine z 5 do 6 kont:
- `gamerpl`,
- `gamerde`,
- `gracz.pl`,
- `gamerpolska`,
- `gamer`,
- `gracz`.

Nie wykonano MERGE, DELETE ani przypisania sztucznego e-maila. Historyczne zależności kont testowych pozostają provenance migracyjnym.

## 2. Fresh reconciliation po decyzji

Po decyzji wykonano ponowny privacy-safe collector na runtime Render. Zapytania działały wyłącznie w:

`BEGIN TRANSACTION READ ONLY`

oraz zakończyły się `ROLLBACK`.

Capture: `2026-08-28T23:58:14.581Z`.

Nie wykonano produkcyjnego DDL ani DML i nie wypisano e-maili, password hash/salt, tokenów, kodów, MFA secrets ani treści wiadomości.

## 3. Wynik finalnego collectora

- source accounts: **11**,
- quarantine present: **6**,
- canonical candidates: **5**,
- invalid/noncanonical canonical user_id: **0**,
- normalized username collision groups: **0**,
- normalized email collision groups: **0**,
- canonical blank email: **0**,
- unsupported password hash version: **0**,
- invalid salt shape: **0**,
- invalid hash shape: **0**,
- canonical active sessions now: **0**,
- canonical active reset tokens now: **0**,
- canonical active registration codes now: **0**,
- canonical MFA rows: **0**,
- unknown canonical role values: **0**,
- reconciliation mapping total: **11**.

Finalna reconciliation:

**`11 source = 6 QUARANTINE + 5 canonical candidates`**

oraz:

**`mapping_total = source_total = 11`**.

Collector zwrócił końcowy status: **PASS**.

## 4. Rozstrzygnięcie wcześniejszego blockera

Wcześniejszy blocker dotyczył `gracz`, które jako canonical candidate miało pusty e-mail i historyczne zależności.

Po jawnej decyzji właściciela projektu konto nie jest już canonical candidate. Jest klasyfikowane jako `LEGACY-IDENTITY / TEST`, bez usuwania historii.

Dzięki temu dla pozostałych 5 canonical candidates:
- wymagany e-mail jest obecny,
- normalized-email collisions = 0,
- user_id mapping = 1:1,
- credential material ma wspierany format,
- nie ma aktywnych sesji/resetów/registration workflows wymagających migracji,
- nie ma MFA ani nieznanych role values.

## 5. Status kryteriów Gate 12

Kryteria Gate 12 po fresh reconciliation:

1. canonical user_id 1:1 — **PASS**,
2. username collisions = 0 — **PASS**,
3. canonical email collisions = 0 — **PASS**,
4. puste wymagane identity fields = 0 — **PASS**,
5. password hash/salt/version shape — **PASS**,
6. zatwierdzony quarantine set obecny — **PASS (6/6)**,
7. unknown role values = 0 — **PASS**,
8. MFA = 0 — **PASS / N/A**,
9. active session/reset/registration drain state = 0/0/0 — **PASS na moment capture**,
10. pełna reconciliation source setu — **PASS (`11 = 6 + 5`)**.

## 6. Formalna decyzja

**BRAMKA 12 — IDENTITY / KEY MAPPING READINESS = PASS.**

Gate 12 nie jest już blockerem ETAPU 3.

Ta decyzja **nie oznacza jeszcze globalnego GO dla produkcyjnego DDL/DML V3 ani automatycznego zamknięcia całego ETAPU 3**. Preflight obejmuje 15 bramek; kolejne wymagania, w tym Active-state inventory (Gate 13), Security/credentials/DB permissions (Gate 14), Rollback/maintenance window/final GO-NO-GO (Gate 15), oraz wcześniej zapisany dokładny dowód SHA-256 runtime ciphertext ↔ `gracz_restore_test_20260828`, muszą pozostać oceniane osobno.

## 7. Cleanup runtime

Po zebraniu reconciliation evidence:
- `npm start` przywrócono do zwykłego `src/main.js`,
- tymczasowy reconciliation proxy usunięto,
- tymczasowy workflow reconciliation usunięto.

Tymczasowa diagnostyka nie pozostaje częścią docelowego runtime.

# ETAP 3 — Bramka 12: fresh runtime evidence

Data: 29.08.2026  
Środowisko: `gracz_pl_database` / PostgreSQL 18.4  
Status: **COLLECTOR PASS / BRAMKA 12 BLOCKED — 1 CANONICAL CANDIDATE Z PUSTYM E-MAILEM**

## 1. Sposób zebrania dowodu

Fresh evidence zebrano z runtime testowego Render przy użyciu tymczasowego collectora uruchamiającego wyłącznie zapytania w `BEGIN TRANSACTION READ ONLY` i kończącego je `ROLLBACK`.

Nie wykonywano produkcyjnego DDL ani DML. Collector nie wypisywał:
- surowych adresów e-mail,
- password hash/salt,
- tokenów ani kodów,
- MFA secretów,
- plaintextu prywatnych wiadomości.

Capture główny: `2026-08-28T23:47:48.327Z`.

## 2. Fresh wynik A–M

### A. Source set / quarantine reconciliation
- accounts total: **11**,
- DQ-002 quarantine present: **5**,
- canonical candidates: **6**.

Reconciliation: `11 = 5 QUARANTINE + 6 canonical candidates`.

### B. Canonical user_id / username readiness
- candidate count: **6**,
- invalid/noncanonical user_id: **0**,
- normalized username collision groups: **0**,
- accounts in username collision groups: **0**.

**PASS.**

### C. Canonical email readiness
- candidate blank email: **1**,
- normalized email collision groups: **0**,
- accounts in normalized email collision groups: **0**.

**BLOCKER: 1 pusty wymagany e-mail w canonical candidates.**

### D. Password envelope readiness
- candidate count: **6**,
- hash version 1: **1**,
- hash version 2: **5**,
- unsupported hash version: **0**,
- invalid salt shape: **0**,
- invalid hash shape: **0**.

**PASS.** Wszystkie 6 credential sets nadaje się do wersjonowanego envelope bez znajomości plaintextu hasła.

### E. Initial status mapping
- candidate → active: **6**,
- candidate → pending: **0**,
- quarantine verified: **3**,
- quarantine unverified: **2**.

Mapowanie `contact_verified=true -> active` obejmuje wszystkie 6 canonical candidates.

### F. Auth sessions
- sessions total: **3**,
- active now: **0**,
- canonical active now: **0**,
- quarantine active now: **0**.

**PASS dla drain/re-login.** Brak aktywnych sesji wymagających migracji.

### G. Password reset
- reset tokens total: **1**,
- active now: **0**,
- canonical active now: **0**,
- quarantine active now: **0**.

**PASS dla expiry/drain.**

### H. Registration codes
- registration codes total: **2**,
- active now: **0**,
- canonical active now: **0**,
- quarantine active now: **0**.

**PASS dla expiry/drain.**

### I. MFA
- MFA total: **0**,
- canonical MFA rows: **0**,
- quarantine MFA rows: **0**.

**N/A / PASS readiness.**

### J. Current roles
- current role rows: **0**,
- unknown role values: **0**,
- candidate role rows: **0**,
- quarantine role rows: **0**,
- privileged role rows: **0**.

**PASS.** Brak nieznanych lub uprzywilejowanych bieżących przypisań do przeniesienia.

### K. Role history footprint
- role history rows: **0**,
- role change rows: **0**.

### L. Quarantined identity historical references
Dla zatwierdzonego zestawu DQ-002 istnieją historyczne referencje, które należy zachować jako provenance:
- private message rows: **3**,
- audit rows: **25**,
- registration rows: **2**,
- reset rows: **1**,
- session rows: **0**.

To nie jest powód do tworzenia fikcyjnych canonical users. Snapshot/provenance musi zostać zachowany zgodnie z projektem V3.

### M. DQ-002 quarantine consistency
- quarantine accounts present: **5**,
- collision groups: **2**,
- accounts in collision groups: **5**.

**PASS względem zatwierdzonego DQ-002.** Zestaw odpowiada wcześniejszej decyzji biznesowej 5x `LEGACY-IDENTITY / TEST`.

## 3. Wąski drill-down blockera C

Ponieważ Gate 12 wymaga `0` pustych e-maili dla rekordów, które mają trafić do `v3.users`, wykonano drugi, wąski collector READ ONLY bez odczytu/wypisywania samego adresu e-mail.

Capture: `2026-08-28T23:51:25.443Z`.

Jedynym canonical candidate z pustym e-mailem jest:

- `user_id`: **`gracz`**,
- created_at: `2026-08-22T00:04:37.362Z`,
- `contact_verified=true`,
- `verification_channel=email`,
- `account_role=player`,
- `mfa_required=false`,
- `password_hash_version=1`,
- active sessions: **0**,
- persisted sessions: **0**,
- private messages received: **5**,
- private messages sent: **0**,
- audit references: **7**,
- friendship rows: **1**,
- reset rows: **0**,
- registration rows: **0**,
- role rows: **0**,
- MFA rows: **0**,
- tournament rows: **0**,
- global chat rows: **0**.

Wniosek: `gracz` nie może zostać automatycznie usunięty ani automatycznie przeniesiony do quarantine wyłącznie z powodu pustego e-maila. Ma credential i istniejące historyczne zależności.

## 4. Decyzja Gate 12

**BRAMKA 12 = BLOCKED / REVIEW — NIE PASS.**

Jedyny blocker wykryty przez fresh collector to brak wymaganego e-maila dla canonical candidate `gracz`.

Nie wolno:
- wymyślać zastępczego adresu e-mail,
- kopiować pustego e-maila do `v3.users`,
- oznaczać `gracz` jako test/quarantine bez jawnego rozstrzygnięcia biznesowego,
- usuwać konta lub jego zależności,
- uruchamiać produkcyjnego DDL/DML V3 przed rozstrzygnięciem.

Dopuszczalne ścieżki rozstrzygnięcia:
1. **KEEP-CANONICAL** — przypisać prawidłowy, unikalny i zweryfikowany e-mail normalną ścieżką aplikacyjną/account-management przed backfillem, a następnie ponowić Gate 12 email/reconciliation collector.
2. **LEGACY-IDENTITY / TEST** — wyłącznie po jawnym potwierdzeniu biznesowym, że `gracz` również jest kontem testowym; wtedy rozszerzyć quarantine i zachować jego 5 message refs, 7 audit refs oraz 1 friendship ref jako provenance.

Do czasu jednej z tych decyzji klasyfikacja `gracz` pozostaje **CANONICAL-CANDIDATE / BLOCKED-EMAIL**.

## 5. Cleanup diagnostyki

Po zebraniu dowodów rozpoczęto natychmiastowy cleanup gałęzi testowej:
- normalny `npm start` przywrócony do `src/main.js`,
- tymczasowy główny Gate 12 runtime proxy usunięty,
- tymczasowy blank-email drill-down proxy usunięty,
- tymczasowe workflow dowodowe usunięte.

Historia commitów pozostaje audytowalna; diagnostyka nie jest częścią docelowego kodu aplikacji.

## 6. Osobny otwarty dowód kryptograficzny

Bramka 11 decryptability pozostaje **PASS**. Osobno nadal obowiązuje wcześniej zapisany wymóg odzyskania dokładnych 64-znakowych fingerprintów SHA-256 z oryginalnego runtime capture w celu udowodnienia bitowej równości `runtime ciphertext ↔ gracz_restore_test_20260828`.

Ten punkt nie jest przyczyną blockera Gate 12, ale pozostaje otwartym wymaganiem dowodowym przed produkcyjnym GO.

## 7. Stan wykonawczy

- Gate 11 decryptability: **PASS**,
- Gate 12 collector: **PASS technicznie**,
- Gate 12 readiness: **BLOCKED / REVIEW**,
- produkcyjny DDL/DML V3: **NO-GO**,
- następne bezpieczne działanie dla Gate 12: rozstrzygnięcie `gracz` i fresh recheck C + reconciliation.

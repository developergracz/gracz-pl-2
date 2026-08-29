# ETAP 3 — Bramka 12: fresh runtime evidence

Data: 29.08.2026  
Środowisko: `gracz_pl_database` / PostgreSQL 18.4  
Status capture: **COLLECTOR PASS / BRAMKA 12 BYŁA BLOCKED — 1 CANONICAL CANDIDATE Z PUSTYM E-MAILEM**

> Uwaga audytowa: ten dokument zachowuje stan historycznego capture przed decyzją biznesową. Finalne rozstrzygnięcie i ponowny reconciliation zapisano w `21-GATE-12-DECISION-AND-RECONCILIATION.md`.

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

**BLOCKER W TYM CAPTURE: 1 pusty wymagany e-mail w canonical candidates.**

### D. Password envelope readiness
- candidate count: **6**,
- hash version 1: **1**,
- hash version 2: **5**,
- unsupported hash version: **0**,
- invalid salt shape: **0**,
- invalid hash shape: **0**.

**PASS.** Wszystkie 6 credential sets nadawało się do wersjonowanego envelope bez znajomości plaintextu hasła.

### E. Initial status mapping
- candidate → active: **6**,
- candidate → pending: **0**,
- quarantine verified: **3**,
- quarantine unverified: **2**.

### F. Auth sessions
- sessions total: **3**,
- active now: **0**,
- canonical active now: **0**,
- quarantine active now: **0**.

**PASS dla drain/re-login.**

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

**PASS.**

### K. Role history footprint
- role history rows: **0**,
- role change rows: **0**.

### L. Quarantined identity historical references
Dla zatwierdzonego w tym momencie zestawu DQ-002 istniały historyczne referencje, które należy zachować jako provenance:
- private message rows: **3**,
- audit rows: **25**,
- registration rows: **2**,
- reset rows: **1**,
- session rows: **0**.

### M. DQ-002 quarantine consistency
- quarantine accounts present: **5**,
- collision groups: **2**,
- accounts in collision groups: **5**.

**PASS względem ówczesnego zatwierdzonego DQ-002.**

## 3. Wąski drill-down blockera C

Ponieważ Gate 12 wymaga `0` pustych e-maili dla rekordów, które mają trafić do `v3.users`, wykonano drugi, wąski collector READ ONLY bez odczytu/wypisywania samego adresu e-mail.

Capture: `2026-08-28T23:51:25.443Z`.

Jedynym canonical candidate z pustym e-mailem był:

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

Wniosek z tego capture: `gracz` nie mogło zostać automatycznie usunięte ani przeniesione do quarantine bez decyzji biznesowej.

## 4. Decyzja w chwili pierwszego capture

**BRAMKA 12 = BLOCKED / REVIEW — w chwili tego capture.**

Jedynym blockerem był brak wymaganego e-maila dla canonical candidate `gracz`.

Dopuszczalne były dwie ścieżki:
1. `KEEP-CANONICAL` z prawidłowym zweryfikowanym e-mailem,
2. `LEGACY-IDENTITY / TEST` po jawnym potwierdzeniu biznesowym.

## 5. Cleanup diagnostyki pierwszego capture

Po zebraniu dowodów:
- normalny `npm start` przywrócono do `src/main.js`,
- tymczasowy główny Gate 12 runtime proxy usunięto,
- tymczasowy blank-email drill-down proxy usunięto,
- tymczasowe workflow dowodowe usunięto.

## 6. Osobny otwarty dowód kryptograficzny

Bramka 11 decryptability pozostaje **PASS**. Osobno nadal obowiązuje wcześniej zapisany wymóg odzyskania dokładnych 64-znakowych fingerprintów SHA-256 z oryginalnego runtime capture w celu udowodnienia bitowej równości `runtime ciphertext ↔ gracz_restore_test_20260828`.

Ten punkt nie był przyczyną blockera Gate 12, ale pozostaje otwartym wymaganiem dowodowym przed produkcyjnym GO.

## 7. Stan historyczny po pierwszym capture

- Gate 11 decryptability: **PASS**,
- Gate 12 collector: **PASS technicznie**,
- Gate 12 readiness: **BLOCKED / REVIEW w chwili capture**,
- produkcyjny DDL/DML V3: **NO-GO**.

## 8. Rozstrzygnięcie po decyzji biznesowej

29.08.2026 właściciel projektu jednoznacznie potwierdził:

**`gracz` = `LEGACY-IDENTITY / TEST`.**

Po rozszerzeniu approved quarantine do 6 kont wykonano nowy read-only reconciliation capture `2026-08-28T23:58:14.581Z`.

Finalny wynik:
- source accounts = **11**,
- quarantine = **6**,
- canonical candidates = **5**,
- canonical blank email = **0**,
- username collisions = **0**,
- email collisions = **0**,
- invalid credential shapes = **0**,
- active canonical sessions/reset/registration = **0/0/0**,
- canonical MFA = **0**,
- unknown role values = **0**,
- mapping total = **11**.

Finalna decyzja została zapisana w:

`21-GATE-12-DECISION-AND-RECONCILIATION.md`.

**Bramka 12 = PASS.**

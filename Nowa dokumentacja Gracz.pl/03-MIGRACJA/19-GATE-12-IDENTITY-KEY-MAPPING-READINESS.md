# ETAP 3 — Bramka 12: Identity / key mapping readiness

Data: 29.08.2026  
Status: **PASS — FRESH RECONCILIATION 11 = 6 QUARANTINE + 5 CANONICAL**

## 1. Cel

Bramka 12 ma udowodnić, że każda tożsamość i każdy credential/lifecycle artifact objęty migracją ma deterministyczny, bezpieczny sposób mapowania do V3 bez:
- zgadywania tożsamości,
- automatycznego merge kont,
- utraty historycznego provenance,
- resetowania haseł bez potrzeby,
- kopiowania jawnych tokenów lub sekretów,
- tworzenia nowych FK do nieistniejących canonical users.

Źródła:
- `01-PREFLIGHT-MIGRACJI.md` — Bramka 12 = Identity/key mapping readiness,
- `08-MACIERZ-DECYZJI-DQ-001-DQ-002.md`,
- `11-DQ-002-PER-ACCOUNT-EVIDENCE.md`,
- `20-GATE-12-FRESH-RUNTIME-EVIDENCE-20260829.md`,
- `21-GATE-12-DECISION-AND-RECONCILIATION.md`,
- PostgreSQL V3 Iteracja 4 Identity/Role/Audit,
- PostgreSQL V3 Iteracja 6 Messaging/Chat,
- aktualny kod `postgres-accounts.js`, `secure-accounts.js`, `auth-sessions.js`, `rbac-service.js`,
- Bramka 11 crypto decryptability = PASS.

## 2. POTWIERDZONE — AS-IS identity key

Aktualny writer normalizuje login przez `normalizeUserId()`:
- dozwolone 3–32 znaki `[a-zA-Z0-9._-]`,
- zapis/odczyt używa lowercase,
- `gracz_accounts.user_id` jest PK i jednocześnie bieżącym loginem użytkownika.

### Decyzja G12-001 — canonical user key

Dla kont dopuszczonych do canonical V3:
- `v3.users.user_id = gracz_accounts.user_id`,
- `v3.users.username = gracz_accounts.user_id`,
- `v3.users.username_normalized = lower(trim(gracz_accounts.user_id))`,
- `v3.user_profiles.display_name = gracz_accounts.display_name`.

Nie generujemy nowych user IDs bez konieczności.

## 3. LEGACY-IDENTITY / TEST — zatwierdzony quarantine set

Po decyzji właściciela projektu z 29.08.2026 zatwierdzony zestaw testowych identity obejmuje 6 kont:
- `gamerpl`,
- `gamerde`,
- `gracz.pl`,
- `gamerpolska`,
- `gamer`,
- `gracz`.

### Decyzja G12-002 — quarantine zamiast canonical merge

- nie wykonujemy MERGE,
- nie wykonujemy automatycznego DELETE,
- nie wymyślamy alternatywnych e-maili tylko po to, aby przejść `UNIQUE(email_normalized)`,
- te identity nie są automatycznie ładowane jako aktywne canonical `v3.users`,
- historyczne message/audit/session/recovery/newsletter/friendship provenance musi pozostać odtwarzalne.

Konto `gracz` zostało dodane do quarantine wyłącznie po jednoznacznym potwierdzeniu biznesowym. Jego istniejące zależności nie są kasowane.

## 4. Password hashes — krytyczne mapowanie

AS-IS przechowuje:
- `salt BYTEA`,
- `password_hash BYTEA`,
- `password_hash_version SMALLINT`.

Kod potwierdza dwa scrypt profiles:
- version 1: `N=16384, r=8, p=1`,
- version 2: `N=131072, r=8, p=1`.

V3 `users` ma jedno pole `password_hash TEXT`.

### Decyzja G12-003 — wersjonowany password envelope

Nie odszyfrowujemy i nie znamy plaintextu hasła. Backfill pakuje istniejące wartości do tekstowego envelope:

`gracz-scrypt-v<version>$<salt-base64url>$<hash-base64url>`

Docelowy verifier przed writer cutover musi:
1. rozpoznać `gracz-scrypt-v1` / `gracz-scrypt-v2`,
2. użyć odpowiednich parametrów scrypt,
3. porównać wynik constant-time,
4. po poprawnym logowaniu opcjonalnie przeliczyć credential do przyszłego current format.

Finalny fresh reconciliation dla 5 canonical candidates potwierdził:
- unsupported password hash version = **0**,
- invalid salt shape = **0**,
- invalid hash shape = **0**.

**Warunek password readiness = PASS.**

## 5. Email / status mapping

### Decyzja G12-004 — email

Dla canonical candidates:
- `email = trim(email)`,
- `email_normalized = lower(trim(email))`.

Pierwszy fresh capture wykrył 1 pusty e-mail w canonical candidates i zidentyfikował konto `gracz`. Po biznesowym sklasyfikowaniu `gracz` jako `LEGACY-IDENTITY / TEST` wykonano nowy read-only reconciliation collector.

Finalny wynik dla 5 canonical candidates:
- normalized email collision groups = **0**,
- blank email = **0**.

**Warunek email readiness = PASS.**

### Decyzja G12-005 — status initial mapping

Jeżeli kolejne bramki nie ujawnią dodatkowego persistent account-state modelu:
- `contact_verified = TRUE` -> `status='active'`,
- `contact_verified = FALSE` -> `status='pending'`.

`suspended/banned/deleted` nie są generowane z domysłu. Gate 13 / Moderation evidence może rozszerzyć mapping przed backfill.

## 6. Auth sessions

AS-IS `gracz_auth_sessions.token_id` jest UUID session/JTI key, a V3 wymaga `token_hash`.

### Decyzja G12-006

Nie kopiujemy `token_id` bezpośrednio jako `token_hash`.

Preferowany cutover: **drain / re-login** zamiast migracji istniejących sesji, jeśli fresh active-state pozostaje zerowy.

Finalny reconciliation:
- canonical active sessions now = **0**.

**Readiness dla drain/re-login = PASS na moment capture.**

## 7. Password reset / registration codes

### Decyzja G12-007

- nigdy nie przenosimy plaintext token/code,
- rekord związany z quarantined identity nie staje się aktywnym credential w V3,
- wygasłe/zużyte rekordy nie są reaktywowane,
- krótkotrwałe workflow preferują drain/expiry przed cutover.

Finalny reconciliation:
- canonical active reset tokens = **0**,
- canonical active registration codes = **0**.

**Readiness = PASS na moment capture.**

## 8. MFA

### Decyzja G12-008

Brak bieżącego MFA backfillu. `v3.mfa_credentials` pozostaje strukturą dla nowych danych.

Finalny reconciliation:
- canonical MFA rows = **0**.

**PASS / N/A.**

## 9. Role / privilege mapping

AS-IS `gracz_roles.role` dopuszcza:
- `player`,
- `moderator`,
- `administrator`,
- `owner`.

### Decyzja G12-009

- seed V3 roles używa stabilnych `code` z allowlisty,
- current roles mapują do `user_roles` tylko dla canonical users,
- legacy role history zachowuje provenance,
- quarantined identity nie tworzy aktywnego privileged V3 usera.

Finalny reconciliation:
- unknown canonical role values = **0**.

**PASS.**

## 10. Bramka 12 — finalne kryteria PASS

Fresh read-only reconciliation z `2026-08-28T23:58:14.581Z` potwierdził równocześnie:

1. canonical candidate `user_id` mapują się 1:1 — **PASS**,
2. normalized-username collisions = 0 — **PASS**,
3. normalized-email collisions = 0 — **PASS**,
4. puste wymagane identity fields = 0 — **PASS**,
5. password hash version/salt/hash shape — **PASS**,
6. approved quarantine set = 6/6 — **PASS**,
7. unknown role values = 0 — **PASS**,
8. MFA = 0 — **PASS / N/A**,
9. active sessions/reset/registration = 0/0/0 — **PASS na moment capture**,
10. mapping reconciliation: `11 source = 6 QUARANTINE + 5 canonical` — **PASS**.

## 11. Finalna reconciliation

Najważniejsze wartości:
- source accounts: **11**,
- approved quarantine: **6**,
- canonical candidates: **5**,
- invalid user IDs: **0**,
- username collision groups: **0**,
- canonical email collision groups: **0**,
- canonical blank email: **0**,
- unsupported password hash versions: **0**,
- invalid salt/hash shapes: **0/0**,
- active canonical sessions/reset/registration: **0/0/0**,
- canonical MFA rows: **0**,
- unknown canonical role values: **0**,
- mapping total: **11**.

Pełny zapis decyzji i fresh reconciliation:

`21-GATE-12-DECISION-AND-RECONCILIATION.md`.

## 12. Decyzja wykonawcza

**BRAMKA 12 = PASS.**

Gate 12 nie blokuje już dalszego preflight.

Nie jest to jednak globalne `GO` dla produkcyjnego DDL/DML V3 ani automatyczne zamknięcie ETAPU 3. Plan preflight definiuje 15 bramek. Kolejne formalne obszary obejmują m.in.:
- Gate 13 — Active-state inventory,
- Gate 14 — Security/credentials/DB permissions,
- Gate 15 — Rollback, maintenance window i końcowe GO/NO-GO.

Osobno pozostaje otwarte dokładne porównanie SHA-256 runtime ciphertext ↔ `gracz_restore_test_20260828`. Bramka 11 decryptability pozostaje PASS, ale ten dowód bitowej równości musi być domknięty przed produkcyjnym GO.

**PRODUKCYJNY DDL/DML V3 = nadal NO-GO do czasu zamknięcia pozostałych wymaganych bramek preflight.**

# ETAP 3 — Gate 15: ETAP 4 Entry Contract

Data: 29.08.2026  
Status: **AUTHORIZED PLAN / NO EXECUTION YET**

## 1. Cel

Ten dokument definiuje dokładny kontrakt wejścia do ETAPU 4 po decyzji Gate 15:

**GO TO ETAP 4 / PRODUCTION V3 NO-GO.**

ETAP 4 może rozpocząć się tylko od świeżego evidence i maintenance controls. Żaden krok mutacyjny nie może wyprzedzić verification prerequisites.

## 2. ETAP 4 — wymagany porządek

### E4.0 Freeze / maintenance

1. ogłosić maintenance window,
2. zatrzymać lub zablokować nowe mutacje użytkowników,
3. zatrzymać normalnego writera przed migracją,
4. potwierdzić brak równoległego deployu/writera,
5. zapisać dokładny source SHA/cutover package SHA.

### E4.1 Fresh pre-mutation evidence

Przed pierwszą mutacją wymagane:

1. fresh Gate 13 read-only active-state collector,
2. fresh Gate 14 AS-IS security/DB permissions collector,
3. backup wykonany,
4. restore rehearsal / restore validation zgodne z Gate 4,
5. row-count/integrity reconciliation,
6. Gate 11 legacy decryptability check,
7. migrator `--plan` na zatwierdzonym source SHA,
8. porównanie expected migration names/checksums.

Każdy blocker = ABORT.

### E4.2 Code prerequisite — Gate 14B probes

Przed strict runtime ACL:

- usunąć redundantny runtime `SELECT LIMIT 0` dla write-only tables:
  - `gracz_audit_log`,
  - `gracz_role_history`,
  - `gracz_moderation_appeals`,
  - `gracz_global_chat_reports`,
- pełne CI/Security Gate,
- potwierdzić brak rozszerzenia business logic poza wymagany contract.

### E4.3 Implement Gate 14C keyring-compatible runtime

W kontrolowanej branch/PR implementacji:

- centralny keyring v1/v2,
- exact legacy v1 derivation/AAD compatibility,
- v2 message prefix,
- attachment/MFA key version handling,
- proposed migration 015 po formalnym review,
- `CRYPTO_WRITE_VERSION` fail-closed,
- zero secret logging,
- regression tests v1 + v2.

Przed rozpoczęciem v2 writes rollback build musi również rozumieć v2.

### E4.4 Create least-privilege credentials

Dopiero po fresh prechecks:

- wymusić `password_encryption='scram-sha-256'`,
- utworzyć `gracz_migrator_v3`,
- utworzyć `gracz_runtime_v3`,
- credentials out-of-band / secret manager,
- potwierdzić `DATABASE_URL != MIGRATOR_DATABASE_URL`,
- nie wypisywać wartości do logów.

### E4.5 Ownership / migrator

W maintenance:

1. przenieść ownership wyłącznie zatwierdzonych V3 objects na migratora,
2. uruchomić migrator wyłącznie przez `MIGRATOR_DATABASE_URL`,
3. wykonać migration plan/apply/verify,
4. potwierdzić exact ledger,
5. brak unknown migration/checksum mismatch.

Mismatch = ABORT.

### E4.6 Runtime ACL

Po przygotowaniu schema:

- reset runtime object privileges do zero,
- zastosować jawny Gate 14B table DML matrix,
- sequence `USAGE` tylko dla zatwierdzonych sekwencji,
- brak runtime CREATE/ownership/TRUNCATE/REFERENCES/TRIGGER,
- unknown legacy objects = zero privilege,
- uruchomić Gate 14B read-only verifier.

### E4.7 Crypto environment transition

Kolejność obowiązkowa:

1. zamrozić current v1 material jako `LEGACY_CRYPTO_ROOT_V1`,
2. potwierdzić legacy decryptability,
3. provision niezależnych v2 roots,
4. pairwise-distinct presence-only verification,
5. ustawić keyring-compatible runtime,
6. dopiero potem przełączyć `CRYPTO_WRITE_VERSION=2`,
7. controlled rekey według Gate 14C runbook,
8. reconciliation `v1=0` dla migrowanych rekordów,
9. fresh decryptability verification.

Nie wolno wcześniej podmienić historycznych env names na nowe secrets.

### E4.8 Production security environment

W docelowym runtime:

- `NODE_ENV=production`,
- `PUBLIC_BASE_URL=https://gracz.pl`,
- `TURNSTILE_HOSTNAME=gracz.pl`,
- Turnstile pair complete,
- Resend config complete,
- Twilio complete albo fully disabled,
- `AUDIT_HASH_SALT` dedicated,
- proxy trust flags tylko według udowodnionej topologii,
- runtime `DATABASE_URL=gracz_runtime_v3`,
- normal runtime bez `MIGRATOR_DATABASE_URL`.

Uruchomić Gate 14D read-only env verifier.

### E4.9 Start target runtime

Start wyłącznie jeśli:

- schema ledger exact,
- runtime role strict ACL PASS,
- config verifier PASS,
- crypto verifier PASS,
- current runtime build SHA jest zatwierdzony.

Fail-closed startup failure = nie omijać, tylko ABORT/repair.

### E4.10 Fresh post-remediation evidence

Po starcie target runtime wymagane:

1. fresh Gate 14 collector,
2. Gate 14B ACL verifier,
3. Gate 14C version/rekey verifier,
4. Gate 14D env verifier,
5. Gate 11-style decryptability probe,
6. negative DDL/admin privilege tests,
7. browser/auth critical journeys,
8. Security Gate/CodeQL/gitleaks for exact deployed SHA.

Dopiero ten zestaw może zmienić:

**Gate 14 overall: BLOCKED -> PASS.**

## 3. Zakazane skróty

ETAP 4 nie może:

- merge'ować/deployować PR #26 przed przygotowaniem DB ledger,
- uruchamiać nowego runtime na starej schema bez ledger,
- używać obecnego owner/admin credential jako runtime,
- nadać runtime `ALL PRIVILEGES`,
- grantować na `ALL TABLES` jako finalny ACL,
- dodawać nowych crypto keys pod starymi nazwami przed keyringiem,
- rotować `AUTH_SECRET` zanim legacy root jest zamrożony i sprawdzony,
- wykonywać rekey przy aktywnych mutation writers,
- ignorować schema mismatch lub decrypt failure,
- usuwać legacy key przed v1=0 + fresh proof,
- ujawniać secret values/fingerprints w repo/logach.

## 4. Rollback anchor

Przed pierwszą nieodwracalną zmianą muszą istnieć:

- zatwierdzony backup,
- zweryfikowany restore path,
- exact source SHA przed cutover,
- rollback build z dual-read v1/v2,
- poprzednia konfiguracja env dostępna w bezpiecznym secret/config history,
- możliwość przywrócenia traffic po ABORT.

Po rozpoczęciu zapisów v2 nie wolno cofać runtime do kodu v1-only.

## 5. Decyzja

Ten dokument **nie wykonuje** ETAPU 4.

Potwierdza jedynie, że ETAP 4 ma deterministyczną sekwencję i twarde ABORT conditions, dlatego Gate 15 może wydać:

**GO TO ETAP 4 — CONTROLLED EXECUTION READINESS.**

Produkcja V3 pozostaje **NO-GO** do fresh post-remediation evidence i applied Gate 14 overall PASS.

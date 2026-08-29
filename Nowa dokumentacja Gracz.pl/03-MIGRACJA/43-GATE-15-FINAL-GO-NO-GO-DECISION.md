# ETAP 3 — Gate 15: Final GO/NO-GO Decision

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status: **GO TO ETAP 4 — CONTROLLED EXECUTION READINESS / PRODUCTION V3 NO-GO**

## 1. Zakres decyzji

Gate 15 nie jest cutoverem i nie wykonuje zmian produkcyjnych.

W tej dokumentacji słowo **GO** oznacza wyłącznie:

> zatwierdzenie wejścia do ETAPU 4, w którym można wykonywać wcześniej zaprojektowany, kontrolowany remediation/cutover pod warunkiem spełniania wszystkich kroków i ABORT conditions.

Nie oznacza:

- production GO,
- zgody na natychmiastowy merge/deploy,
- zgody na uruchomienie migratora poza maintenance contract,
- zgody na zmianę bazy bez fresh backup/restore/active-state checks,
- zgody na rotację sekretów poza Gate 14C/14D runbook.

**Produkcja V3 pozostaje NO-GO do czasu applied/fresh-evidence PASS w ETAPIE 4.**

## 2. Evidence wejściowe

### 2.1 Gate 11

Status: PASS decryptability.

Potwierdzone co najmniej:

- 5/5 private messages decryptable,
- 2/2 encrypted attachments decryptable,
- MFA rows = 0.

Otwarty production-GO evidence item: exact runtime-vs-restore ciphertext fingerprint reconciliation musi pozostać w finalnym cutover evidence.

### 2.2 Gate 12

Status: PASS.

Fresh identity/key mapping reconciliation wykazał:

- 11 accounts total,
- 6 quarantine/test identities,
- 5 canonical candidates,
- 0 invalid/noncanonical candidate user_id,
- 0 username collisions,
- 0 email collisions,
- 0 unsupported hashes,
- 0 active candidate sessions,
- 0 reset/registration/MFA blockers.

### 2.3 Gate 13

Status: PASS — PRE-CUTOVER READINESS.

Active-state decisions są udokumentowane, a cutover contract wymaga maintenance/stop mutations i fresh read-only recheck przed jakimikolwiek mutacjami migracyjnymi.

### 2.4 Gate 14A

Status: **PASS — CODE-LEVEL RUNTIME DDL SEPARATION COMPLETE**.

- 79/79 runtime DDL/DCL extracted,
- 0 executable runtime DDL/DCL in inventoried modules,
- migrations 001–014 contiguous,
- separate `MIGRATOR_DATABASE_URL`,
- fail-closed runtime schema checker before first PostgreSQL service,
- migrator not invoked by normal runtime.

Final code head:

`cb073bad3050ffc9726e0a1528c2ec4a4808f12e`

PR #26 remains:

- OPEN,
- DRAFT,
- NOT MERGED,
- mergeable,
- base `feature/homepage-game-center`,
- head `audit/gate14a2-runtime-ddl-separation`.

Final CI evidence for this head:

- CheckersEngine run `33226265016` — SUCCESS,
- Security Gate run `33226264999` — SUCCESS,
- 127/127 tests PASS,
- production dependency audit: 0 vulnerabilities,
- browser journeys PASS,
- CodeQL PASS,
- gitleaks PASS.

PR #26 intentionally remains DRAFT because current target database is not yet migrated to the fail-closed schema ledger contract.

### 2.5 Gate 14B

Status: **PASS — DESIGN-LEVEL / NOT APPLIED**.

Least-privilege model is complete:

- proposed migration principal `gracz_migrator_v3`,
- proposed runtime principal `gracz_runtime_v3`,
- exact DML/sequence matrix,
- ownership model,
- SCRAM creation policy,
- read-only verifier,
- no automatic grants to unknown legacy objects.

Current production/test target has NOT been changed to this model.

### 2.6 Gate 14C

Status: **PASS — DESIGN-LEVEL / NOT APPLIED**.

Crypto keyring v1/v2 design is complete:

- `LEGACY_CRYPTO_ROOT_V1`,
- independent message/attachment/MFA v2 roots,
- explicit write version,
- v1/v2 deterministic read contract,
- proposed migration 015,
- version inventory verifier,
- controlled rekey runbook.

Current runtime still uses the pre-keyring crypto config and fallback behavior. No secret rotation or ciphertext migration has occurred.

### 2.7 Gate 14D

Status: **PASS — DESIGN-LEVEL / NOT APPLIED**.

Production security contract is complete for:

- `NODE_ENV=production`,
- `PUBLIC_BASE_URL=https://gracz.pl`,
- `TURNSTILE_HOSTNAME=gracz.pl`,
- Resend / explicit sender,
- optional Twilio complete-or-disabled model,
- runtime/migrator DB credentials,
- SCRAM-SHA-256,
- DB transport policy,
- Gate 14C keyring variables,
- `AUDIT_HASH_SALT`,
- proxy trust flags,
- no-secret logging contract.

Current target environment has NOT been changed to this contract.

## 3. Fresh Gate 15 repository/code reconciliation

Na moment Gate 15 potwierdzono ponownie:

- PR #26 nadal OPEN/DRAFT/NOT MERGED,
- head nadal `cb073bad3050ffc9726e0a1528c2ec4a4808f12e`,
- workflow runs przypisane do tego head nadal zakończone SUCCESS,
- kod `config.js` na branchu Gate 14A nadal zawiera pre-keyring fallback `MESSAGE_ENCRYPTION_KEY` / `ATTACHMENT_ENCRYPTION_KEY` / `MFA_ENCRYPTION_KEY` -> `AUTH_SECRET`.

To jest poprawne: Gate 14C jest na razie projektem, a nie ukrytą częściową implementacją.

## 4. Dlaczego nie wykonano nowego live DB/runtime collectora w Gate 15

Ostatni Gate 14 collector był read-only i jego capture był poprawny. Tymczasowy privacy-safe diagnostic endpoint został następnie usunięty w cleanupie.

Powtórzenie tego samego GitHub Actions job obecnie nie daje niezależnego świeżego evidence bez ponownego udostępnienia endpointu diagnostycznego na Renderze. Ponowne wdrożenie/proxy/diagnostic surface byłoby zmianą target runtime, a zakres Gate 15 został jawnie zdefiniowany jako **zero zmian produkcyjnych / zero cutover**.

Dlatego Gate 15 nie odtwarza tymczasowej diagnostyki tylko po to, aby uzyskać nowszy timestamp.

Zamiast tego:

- fresh repository/CI/PR reconciliation wykonano teraz,
- ostatni poprawny read-only runtime evidence pozostaje baseline AS-IS,
- **nowy fresh runtime/DB/security collector jest obowiązkowym pierwszym verification step ETAPU 4 przed pierwszą mutacją oraz ponownie po applied remediation**.

Brak tego świeżego collectora oznacza, że Gate 15 nie może wydać production GO — i właśnie dlatego produkcja pozostaje NO-GO.

## 5. Aktualne blockery production GO

### 5.1 Least privilege nie jest applied

Current DB principal z ostatniego fresh Gate 14 evidence nadal był:

- database owner,
- `CREATEDB=1`,
- `CREATEROLE=1`,
- schema/database CREATE,
- owner 28/28 tables i 8/8 sequences,
- broad table privileges including TRUNCATE/TRIGGER/REFERENCES.

Gate 14B naprawia to projektowo, ale nie zostało to jeszcze zastosowane.

### 5.2 Crypto keyring nie jest implemented/applied

Current Gate 14A branch nadal ma legacy config behavior. Keyring Gate 14C oraz migration 015 są projektami, nie produkcyjną implementacją.

### 5.3 Production environment contract nie jest applied

Ostatni runtime evidence miał m.in.:

- `NODE_ENV=production` false,
- `TURNSTILE_HOSTNAME` absent,
- `PUBLIC_BASE_URL` not explicit,
- dedicated crypto keys absent.

Gate 14D definiuje target, ale go jeszcze nie zastosował.

### 5.4 Gate 14 overall

**Gate 14 overall pozostaje BLOCKED — APPLIED REMEDIATION REQUIRED.**

Nie wolno zmieniać tego statusu na PASS na podstawie samych design documents.

## 6. Gate 15 decision

### Decyzja A — wejście do ETAPU 4

**GO.**

Pakiet preflight jest wystarczająco kompletny i deterministyczny, aby rozpocząć kontrolowany ETAP 4.

Znane są:

- wymagane zmiany,
- ich kolejność,
- role i ACL,
- migracje,
- schema compatibility contract,
- crypto transition,
- env contract,
- read-only verifiers,
- rollback/ABORT criteria,
- zakazane skróty.

### Decyzja B — production V3

**NO-GO.**

Nie wolno uruchomić produkcji V3 dopóki ETAP 4 nie zastosuje i nie potwierdzi fresh evidence dla 14B/14C/14D oraz finalnego Gate 14 overall.

## 7. Co dokładnie autoryzuje Gate 15 GO

Gate 15 autoryzuje rozpoczęcie ETAPU 4 pod warunkiem zachowania runbooków.

Nie autoryzuje samodzielnie:

- merge PR #26,
- deployment nowego runtime,
- migratora,
- CREATE ROLE / GRANT / REVOKE / ALTER OWNER,
- zmiany `DATABASE_URL`,
- zmiany `MIGRATOR_DATABASE_URL`,
- ustawienia nowych crypto roots,
- rotacji `AUTH_SECRET`,
- re-encryption,
- cutover domeny/traffic.

Każdy z tych kroków może nastąpić tylko w odpowiednim kroku ETAPU 4 po spełnieniu preconditions.

## 8. Warunek natychmiastowego ABORT w ETAPIE 4

ETAP 4 musi przejść w ABORT/NO-GO, jeśli m.in.:

- fresh Gate 13 wykryje realny aktywny canonical state,
- backup/restore evidence jest nieaktualne lub niespójne,
- migrator plan/checksum różni się od zatwierdzonego,
- runtime/migrator credentials są identyczne,
- runtime role ma ownership/DDL/admin privilege,
- unknown legacy objects otrzymają runtime ACL bez dowodu potrzeby,
- v1 encrypted row przestanie być decryptable,
- v2 write/read roundtrip zawiedzie,
- runtime nie startuje fail-closed na exact schema ledger,
- production env verifier nie przejdzie,
- Turnstile production enforcement nie przejdzie,
- secrets pojawią się w logach/repo/artifactach,
- final fresh Gate 14 collector nie da PASS.

## 9. Formalny status po Gate 15

- Gate 11: PASS
- Gate 12: PASS
- Gate 13: PASS — PRE-CUTOVER READINESS
- Gate 14A: PASS — CODE-LEVEL
- Gate 14B: PASS — DESIGN-LEVEL / NOT APPLIED
- Gate 14C: PASS — DESIGN-LEVEL / NOT APPLIED
- Gate 14D: PASS — DESIGN-LEVEL / NOT APPLIED
- Gate 14 overall: BLOCKED — APPLIED REMEDIATION REQUIRED
- Gate 15: **GO TO ETAP 4 / PRODUCTION NO-GO**
- ETAP 3: **CLOSED — PREFLIGHT/READINESS PACKAGE COMPLETE**
- ETAP 4: **AUTHORIZED TO START UNDER CONTROLLED RUNBOOK**
- Production V3: **NO-GO**

## 10. Najważniejsza interpretacja

Zamknięcie ETAPU 3 nie jest równoznaczne z zamknięciem bezpieczeństwa produkcyjnego.

ETAP 3 zakończył projektowanie, inwentaryzację, dowody AS-IS oraz deterministyczny plan wykonania.

ETAP 4 ma zastosować ten plan i zebrać applied/fresh evidence. Dopiero wtedy Gate 14 overall może otrzymać PASS i może powstać osobna finalna decyzja production GO.

# ETAP 3 — Gate 14D: Applied PASS / Cutover Checklist

Data: 29.08.2026  
Status: **DESIGN ONLY / NO PRODUCTION EXECUTION AUTHORIZED**

## 1. Cel

Ten checklist definiuje evidence potrzebne, aby później zmienić Gate 14D z design-level PASS na applied/fresh-evidence PASS i umożliwić finalną decyzję Gate 15.

## 2. Przed maintenance window

Wymagane:

- Gate 14A code package zweryfikowany,
- Gate 14B role/ACL package zweryfikowany,
- Gate 14C keyring-compatible build + tests zweryfikowany,
- rollback build również rozumie v1+v2,
- backup + restore rehearsal aktualne,
- Gate 13 active-state fresh recheck plan gotowy,
- Render/config change list zatwierdzona,
- żaden sekret nie znajduje się w repo/logach.

## 3. Production env — non-secret

Przed startem target runtime sprawdzić:

- [ ] `NODE_ENV=production`
- [ ] `PUBLIC_BASE_URL=https://gracz.pl`
- [ ] `TURNSTILE_HOSTNAME=gracz.pl`
- [ ] `TURNSTILE_SITE_KEY` present
- [ ] `EMAIL_FROM` explicit
- [ ] `CRYPTO_WRITE_VERSION` ustawiony zgodnie z zatwierdzonym Gate 14C stage
- [ ] proxy trust flags zgodne z udowodnioną topologią, a nie intuicją

## 4. Production env — secrets

Presence-only / no-value evidence:

- [ ] `AUTH_SECRET` present + minimum met
- [ ] `AUDIT_HASH_SALT` present + minimum met
- [ ] `TURNSTILE_SECRET_KEY` present
- [ ] `RESEND_API_KEY` present
- [ ] `DATABASE_URL` present i wskazuje runtime principal
- [ ] Gate 14C roots present zgodnie z etapem
- [ ] wszystkie docelowe roots/salts distinct zgodnie z finalnym contract

Nigdy nie kopiować wartości do checklist/logów.

## 5. Ważny krok: oddzielenie AUTH od legacy crypto root

Gate 14C Stage C2 wymaga:

`LEGACY_CRYPTO_ROOT_V1 = dokładny obecny v1 key material`

Historycznie ten material pochodzi z obecnego `AUTH_SECRET`.

Aby finalnie spełnić zasadę „AUTH_SECRET tylko auth/signing” oraz distinctness:

1. najpierw zamrozić legacy material w `LEGACY_CRYPTO_ROOT_V1`,
2. potwierdzić v1 decrypt przez keyring używający explicit legacy root,
3. dopiero potem wygenerować **nowy niezależny `AUTH_SECRET`**,
4. przeprowadzić rotację auth w maintenance window,
5. uznać istniejące tokeny/cookies podpisane starym AUTH za unieważnione,
6. wymusić ponowne logowanie użytkowników po cutover,
7. fresh test auth/session PASS.

Nie wolno rotować `AUTH_SECRET` przed zamrożeniem i przetestowaniem `LEGACY_CRYPTO_ROOT_V1`, bo mogłoby to utracić jedyny dostęp do v1 encrypted data.

## 6. DB credential creation

- [ ] sesja: `SET password_encryption='scram-sha-256'`
- [ ] `gracz_migrator_v3` credential utworzony/rotowany bez logowania wartości
- [ ] `gracz_runtime_v3` credential utworzony/rotowany bez logowania wartości
- [ ] credentials różne
- [ ] runtime nie jest członkiem migrator/admin role
- [ ] provider/admin credential nie jest runtime `DATABASE_URL`

## 7. DB transport

Jedna ścieżka musi być jawnie potwierdzona:

### PRIVATE_RENDER_NETWORK

- [ ] host classified jako Render private `dpg-*`
- [ ] połączenie odbywa się po prywatnej sieci platformy
- [ ] nie używamy public plaintext route

### VERIFIED_TLS

- [ ] public endpoint
- [ ] `pg-secure-preload.cjs` aktywny
- [ ] `rejectUnauthorized=true`
- [ ] CA validation PASS, jeśli custom CA jest wymagane

## 8. Provider behavior

### Turnstile

- [ ] register bez challenge w production = blocked
- [ ] reset bez challenge w production = blocked
- [ ] poprawny challenge dla `gracz.pl` = accepted
- [ ] invalid hostname/token = blocked
- [ ] provider unavailable = fail-closed

### Resend

- [ ] controlled system mail accepted
- [ ] sender domain zweryfikowany
- [ ] log zawiera fingerprint odbiorcy, nie pełny adres
- [ ] API key nieobecny w logach

### Twilio

Jedno z:

- [ ] DISABLED cleanly (0/3 variables)
- [ ] ENABLED fully (3/3 + controlled test)

Partial = ABORT.

## 9. Proxy trust evidence

Jeżeli `TRUST_CLOUDFLARE_HEADERS=true`:

- [ ] origin/topology gwarantuje wiarygodność `CF-Connecting-IP`
- [ ] spoof test FAIL dla bezpośredniego klienta

Jeżeli `TRUST_PROXY_HEADERS=true`:

- [ ] semantics Render proxy potwierdzone
- [ ] spoof test potwierdza, że klient nie kontroluje wartości uznawanej za source

Jeżeli dowodu brak:

- [ ] obie flagi `false`

## 10. Fresh safe environment verifier

Uruchomić `41-GATE-14D-READONLY-ENV-VERIFIER.mjs` w target runtime context.

Artifact/output musi zawierać tylko bezpieczne booleany/classifications.

Required final PASS booleans co najmniej:

- `nodeEnvProduction=true`
- `publicBaseUrlCanonical=true`
- `turnstilePairComplete=true`
- `turnstileHostnameCanonical=true`
- `resendApiKeyPresent=true`
- `emailFromPresent=true`
- `authSecretMin32=true`
- `auditHashSaltMin32=true`
- `auditSaltDistinctFromAuth=true`
- Gate 14C v2 roots present/minimum=true
- `allCryptoAndAuditRootsPairwiseDistinct=true` w finalnym separation state
- `databaseUrlPresent=true`
- `migratorDatabaseUrlAbsentFromRuntime=true`
- `twilioPartial=false`

## 11. Fresh DB least-privilege verifier

Uruchomić Gate 14B read-only verifier jako `gracz_runtime_v3`.

Wymagane:

- admin role attributes false,
- database/schema CREATE false,
- ownership 0,
- exact table ACL match,
- sequence ACL match,
- unknown legacy objects bez runtime privileges,
- PUBLIC grants 0.

## 12. Fresh crypto reconciliation

Po wdrożeniu keyringu:

- Gate 11-style decryptability PASS,
- Gate 14C version inventory spójny,
- żadnego mixed/unknown version,
- przy finalnym retire legacy: v1 count = 0 przed usunięciem legacy root.

## 13. Fresh application behavior

- [ ] startup schema check PASS
- [ ] normal runtime nie uruchamia migratora
- [ ] registration/login/logout PASS
- [ ] password reset PASS
- [ ] private messages read/write PASS
- [ ] encrypted attachments read/write PASS
- [ ] MFA flow PASS/appropriate state
- [ ] checkers session persistence PASS
- [ ] Thousand persistence PASS
- [ ] newsletter confirmation links używają `https://gracz.pl`
- [ ] admin security endpoints require intended role/MFA

## 14. ABORT / NO-GO conditions

Natychmiastowy ABORT, jeśli:

- runtime nadal jest DB owner/admin,
- runtime ma schema/database CREATE,
- schema checksum mismatch,
- migrator URL == runtime URL,
- public DB route bez verified TLS,
- Turnstile production bypass,
- `PUBLIC_BASE_URL` non-canonical,
- partial provider config,
- jakikolwiek required secret missing,
- crypto root collision w final state,
- v1 decrypt failure,
- AUTH rotated przed zabezpieczeniem legacy root,
- sekrety pojawią się w logach/artifacts,
- active canonical gameplay pojawi się podczas maintenance/cutover,
- rollback build nie rozumie już powstałych danych v2.

## 15. Decyzja Gate 14D applied

Dopiero po zebraniu powyższych fresh evidence można oznaczyć:

**Gate 14D = PASS — APPLIED / FRESH EVIDENCE**

Do tego momentu obowiązuje:

**Gate 14D = PASS — DESIGN-LEVEL ONLY**

oraz:

**Production V3 = NO-GO.**

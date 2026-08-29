# ETAP 3 — Gate 14D: Production Security Configuration Design

Data: 29.08.2026  
Repozytorium: `developergracz/gracz-pl-2`  
Status Gate 14D: **PASS — DESIGN-LEVEL / NOT APPLIED / PRODUCTION NO-GO**

> Ten PASS dotyczy kompletności docelowego kontraktu konfiguracji produkcyjnej. Nie oznacza zmiany Render environment, sekretów, połączenia DB, providerów ani production GO. W Gate 14D nie wykonano żadnej zmiany w działającym środowisku.

## 1. Cel

Gate 14D zamyka projekt produkcyjnej konfiguracji bezpieczeństwa po Gate 14A–14C. Celem jest jednoznaczny, fail-closed kontrakt dla:

- `NODE_ENV=production`,
- canonical URL,
- Turnstile i hostname binding,
- e-mail/Resend,
- SMS/Twilio,
- PostgreSQL runtime/migrator credentials,
- SCRAM-SHA-256,
- transportu DB,
- crypto keyring v1/v2,
- audit hashing salt,
- trusted proxy headers,
- zasad logowania i ekspozycji sekretów.

## 2. Stan AS-IS z fresh Gate 14

Fresh Gate 14 wykazał:

- test runtime miał `NODE_ENV=production = false`,
- Turnstile site key = present,
- Turnstile secret key = present,
- Turnstile pair complete = true,
- `TURNSTILE_HOSTNAME` = absent,
- Resend API key = present,
- explicit sender = present,
- Twilio = disabled cleanly / no partial config,
- `PUBLIC_BASE_URL` = absent,
- DB connection evidence było szyfrowane w collectorze,
- bieżąca polityka `password_encryption` nie była potwierdzona jako SCRAM-SHA-256,
- obecny DB principal był zbyt szeroki,
- dedykowane crypto roots były nieobecne.

Gate 14A–14C przygotowały projekty rozdzielenia DDL/runtime, ról i keyringu, ale nie zostały jeszcze zastosowane.

## 3. Production mode — wymagany

Docelowy runtime V3 musi mieć:

`NODE_ENV=production`

To nie jest kosmetyka. `AdaptiveBotDefense` w production wymaga Turnstile dla wysokiego ryzyka:

- `register`,
- `reset`.

Jeżeli Turnstile nie jest kompletnie skonfigurowany, production request ma failować zamknięcie (`CHALLENGE_NOT_CONFIGURED`, HTTP 503), zamiast cicho omijać challenge.

### PASS criterion

Fresh production evidence musi pokazać:

- `NODE_ENV` dokładnie `production`,
- test rejestracji/resetu bez poprawnej odpowiedzi challenge jest blokowany,
- brak production bypassu wynikającego z trybu `development/staging/test`.

## 4. Canonical public origin

Docelowa wartość:

`PUBLIC_BASE_URL=https://gracz.pl`

Obecny newsletter ma fallback `https://gracz.pl`, ale production certification nie może zależeć od implicit default.

### Target contract

W production `PUBLIC_BASE_URL` powinien być:

- wymagany jawnie,
- HTTPS,
- origin-only — bez query/fragment,
- bez trailing slash po normalizacji,
- host dokładnie `gracz.pl` dla canonical links.

`www.gracz.pl` może przekierowywać do canonical `https://gracz.pl`, ale linki generowane przez aplikację powinny używać jednego originu.

### PASS criterion

Fresh verifier: wartość obecna i canonical match = true. Sam kodowy fallback nie daje PASS.

## 5. Cloudflare Turnstile

Docelowe zmienne:

- `TURNSTILE_SITE_KEY` — secret? **nie** (public site key),
- `TURNSTILE_SECRET_KEY` — **secret**,
- `TURNSTILE_HOSTNAME=gracz.pl` — non-secret.

Kod akceptuje hostname `gracz.pl`, a dla expected `gracz.pl` również `www.gracz.pl`.

### Target rules

1. site + secret muszą być obecne jako para,
2. partial configuration = FAIL,
3. hostname binding musi być jawne,
4. production register/reset musi wymagać challenge,
5. secret nie może być logowany,
6. verification endpoint pozostaje HTTPS Cloudflare,
7. timeout/fail-closed behavior pozostaje aktywne.

## 6. E-mail / Resend

Docelowo:

- `RESEND_API_KEY` — **secret, required** jeśli mail flows są aktywne,
- `EMAIL_FROM` — non-secret, **jawnie ustawiony**,
- `NEWSLETTER_FROM` — deprecated/compatibility only; nie używać jako jedynego production source jeśli `EMAIL_FROM` jest docelowym kontraktem.

Rekomendowany canonical sender:

`EMAIL_FROM=Gracz.pl <newsletter@gracz.pl>`

Dokładny sender musi odpowiadać zweryfikowanej domenie u providera.

### Logging contract

Obecny `SecureMailService` loguje:

- purpose,
- fingerprint odbiorcy,
- sender,
- status/provider id.

Nie loguje API key ani pełnego odbiorcy. Ten kontrakt należy utrzymać.

### PASS criterion

- API key present=true,
- explicit from present=true,
- sender domain verified provider-side,
- kontrolowany send test PASS,
- log nie zawiera pełnego adresu odbiorcy ani API key.

## 7. SMS / Twilio

SMS pozostaje opcjonalny, jeżeli product scope nie wymaga SMS recovery.

Dwa dozwolone stany:

### DISABLED — PASS

Wszystkie trzy nieobecne:

- `TWILIO_ACCOUNT_SID`,
- `TWILIO_AUTH_TOKEN`,
- `TWILIO_FROM_NUMBER`.

### ENABLED — PASS po osobnej walidacji

Wszystkie trzy obecne i działający controlled send test.

### Niedozwolone

Partial Twilio config = FAIL.

Nie włączamy Twilio tylko po to, by Gate 14D miał „więcej providerów”.

## 8. PostgreSQL credentials — target

Zgodnie z Gate 14B:

### Runtime

`DATABASE_URL` → credential wyłącznie `gracz_runtime_v3`.

### Migrator

`MIGRATOR_DATABASE_URL` → credential wyłącznie `gracz_migrator_v3`.

Warunki:

- URL-e muszą być różne,
- runtime nie zna migrator credential,
- migrator odmawia, gdy URL jest identyczny z runtime URL,
- obecny szeroki owner/admin credential nie może pozostać jako application `DATABASE_URL` po cutover.

## 9. SCRAM-SHA-256

Dla nowych login roles credential creation/rotation musi jawnie wykonać:

`SET password_encryption = 'scram-sha-256';`

przed `CREATE ROLE ... PASSWORD` / `ALTER ROLE ... PASSWORD`.

### PASS evidence

Nie wystarcza samo `SHOW password_encryption` po fakcie.

Przed Gate 15 trzeba udowodnić bez ujawnienia hashy/credentiali, że:

- nowe runtime/migrator credentials zostały utworzone w sesji wymuszającej SCRAM-SHA-256,
- log procesu nie zawierał wartości haseł,
- oba principals mogą się połączyć zgodnie ze swoim przeznaczeniem,
- runtime principal nie ma admin/DDL privileges.

## 10. DB transport contract

`pg-secure-preload.cjs` rozróżnia trzy przypadki:

1. localhost — SSL off,
2. Render private hostname `dpg-*` bez suffixu — private network, SSL off,
3. połączenie publiczne — TLS z `rejectUnauthorized=true`, opcjonalnie `DATABASE_SSL_CA_BASE64`.

Dlatego Gate 14D nie narzuca fałszywego wymogu „TLS=true dla każdego hosta”.

### Production acceptable modes

- **PRIVATE_RENDER_NETWORK** — tylko jeśli runtime faktycznie używa prywatnego endpointu Render i ten fakt jest potwierdzony bez ujawniania pełnego connection string,
- **VERIFIED_TLS** — dla public/external DB endpointu; `rejectUnauthorized=true`, a jeśli wymagane, `DATABASE_SSL_CA_BASE64` zawiera właściwy CA.

### FAIL

- public DB endpoint z `rejectUnauthorized=false`,
- przypadkowe wyłączenie preload,
- plaintext public route.

`npm start` musi nadal używać `--require ./src/pg-secure-preload.cjs`.

## 11. Crypto environment — Gate 14C integration

Po implementacji keyringu docelowy production contract ma używać:

- `LEGACY_CRYPTO_ROOT_V1` — secret, tylko legacy decrypt w compatibility/rekey stage,
- `MESSAGE_ENCRYPTION_KEY_V2` — secret,
- `ATTACHMENT_ENCRYPTION_KEY_V2` — secret,
- `MFA_ENCRYPTION_KEY_V2` — secret,
- `CRYPTO_WRITE_VERSION=2` — non-secret control, aktywowany dopiero po spełnieniu Gate 14C preconditions.

Stare compatibility names:

- `MESSAGE_ENCRYPTION_KEY`,
- `ATTACHMENT_ENCRYPTION_KEY`,
- `MFA_ENCRYPTION_KEY`

nie mogą zostać „po prostu” podmienione nowymi rootami w obecnym runtime.

## 12. AUTH_SECRET i AUDIT_HASH_SALT

Gate 14C przyjął zasadę, że `AUTH_SECRET` docelowo służy wyłącznie warstwie auth/signing.

Aktualny `AuditService` ma fallback:

`AUDIT_HASH_SALT || AUTH_SECRET`

Dlatego production V3 musi jawnie ustawić osobny:

`AUDIT_HASH_SALT`

Warunki:

- secret,
- >= 32 znaki,
- różny od `AUTH_SECRET`,
- różny od wszystkich crypto roots,
- nie jest logowany,
- nie jest przechowywany w DB/repo.

To usuwa ostatnie niezamierzone współdzielenie `AUTH_SECRET` poza funkcją auth.

## 13. Trusted proxy headers

Kod obsługuje:

- `TRUST_CLOUDFLARE_HEADERS=true`,
- `TRUST_PROXY_HEADERS=true`.

Obie flagi wpływają na source IP używany przez rate limiting/audyt.

### Target default

Obie = `false`, dopóki topology evidence nie udowodni, że aplikacja otrzymuje request wyłącznie przez zaufany proxy path, który nadpisuje/sanitizuje odpowiedni header.

### Cloudflare mode

`TRUST_CLOUDFLARE_HEADERS=true` dopiero po potwierdzeniu, że origin nie jest publicznie osiągalny z możliwością spoofowania `CF-Connecting-IP` albo że infrastruktura gwarantuje wiarygodność tego nagłówka.

### Generic proxy mode

`TRUST_PROXY_HEADERS=true` dopiero po potwierdzeniu Render proxy semantics i ochrony przed klientem samodzielnie podstawiającym lewy pierwszy element `X-Forwarded-For`.

Nie wolno włączyć obu flag bez uzasadnionej topologii.

## 14. Secret/non-secret classification

### Required secrets — target production

- `AUTH_SECRET`,
- `DATABASE_URL`,
- `TURNSTILE_SECRET_KEY`,
- `RESEND_API_KEY`,
- `AUDIT_HASH_SALT`,
- Gate 14C secrets po implementacji:
  - `LEGACY_CRYPTO_ROOT_V1` (tymczasowo),
  - `MESSAGE_ENCRYPTION_KEY_V2`,
  - `ATTACHMENT_ENCRYPTION_KEY_V2`,
  - `MFA_ENCRYPTION_KEY_V2`.

### Conditional secrets

- `MIGRATOR_DATABASE_URL` — tylko migration job/cutover, nie stały runtime,
- `TWILIO_AUTH_TOKEN` — tylko gdy Twilio enabled,
- `DATABASE_SSL_CA_BASE64` — tylko gdy public DB route wymaga custom CA.

### Non-secret config

- `NODE_ENV=production`,
- `PUBLIC_BASE_URL=https://gracz.pl`,
- `TURNSTILE_SITE_KEY`,
- `TURNSTILE_HOSTNAME=gracz.pl`,
- `EMAIL_FROM`,
- `TWILIO_ACCOUNT_SID` / `TWILIO_FROM_NUMBER` gdy enabled,
- `CRYPTO_WRITE_VERSION`,
- proxy trust flags,
- `HOST`, `PORT`.

## 15. Logging / observability contract

Nigdy nie logować:

- wartości `*_SECRET*`, `*_KEY*`, `*_TOKEN*`, credential/password,
- connection strings,
- ciphertext/IV/tag w diagnostic logs,
- pełnych e-maili,
- Turnstile response tokenów,
- MFA secrets / provisioning URI w server logs.

Dopuszczalne są wyłącznie:

- booleany presence/readiness,
- długość spełnia/nie spełnia minimum bez wartości,
- pairwise-distinct booleans,
- provider status,
- zanonimizowane/fingerprintowane identyfikatory,
- transport classification bez pełnego hosta/URL.

## 16. Current code gaps przed applied PASS

Gate 14D design jest kompletny, ale applied PASS wymaga jeszcze implementacji/konfiguracji:

1. jawnego production requirement/validation dla `PUBLIC_BASE_URL`,
2. jawnego production requirement dla `TURNSTILE_HOSTNAME`,
3. osobnego `AUDIT_HASH_SALT`,
4. wdrożonego Gate 14C keyring contract,
5. zastosowanego Gate 14B runtime credential,
6. utworzonych SCRAM credentials,
7. potwierdzonego DB transport mode,
8. decyzji proxy trust na podstawie realnej topologii,
9. fresh production-mode behavior test.

## 17. Gate 14D design PASS criteria

Projekt jest kompletny, ponieważ definiuje:

- required/optional production env,
- secret classification,
- canonical URL,
- Turnstile fail-closed contract,
- e-mail/SMS provider states,
- runtime/migrator credential separation,
- SCRAM policy,
- DB transport policy,
- Gate 14C integration,
- `AUDIT_HASH_SALT`,
- trusted proxy policy,
- logging policy,
- applied PASS evidence requirements.

## 18. Formalna decyzja

**GATE 14D = PASS — DESIGN-LEVEL PRODUCTION SECURITY CONFIG COMPLETE.**

Jednocześnie:

- Render environment nie został zmieniony,
- `NODE_ENV` nie został przełączony,
- `TURNSTILE_HOSTNAME` nie został ustawiony,
- `PUBLIC_BASE_URL` nie został ustawiony,
- żadnego sekretu nie dodano/zmieniono,
- żadnej roli/credentiala DB nie utworzono,
- żadnego providera nie przełączono,
- produkcja V3 pozostaje **NO-GO**.

Po Gate 14D wszystkie podprojekty Gate 14A–14D są kompletne na poziomie design/code extraction, ale **Gate 14 overall nie może otrzymać PASS, dopóki remediation nie zostanie zastosowane i potwierdzone fresh evidence**.

Następny formalny krok: przygotowanie **Gate 15 — final GO/NO-GO execution plan + remediation/cutover evidence contract**, nie produkcyjny GO sam w sobie.

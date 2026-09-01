# Gracz.pl V3 — P1-PL-006 / P1-PL-007 — Repo/config evidence delta: Render, Cloudflare i providerzy ujawnieni przez kod

Data review: 01.09.2026  
Wersja: `0.1`  
Zakres: `P1-PL-006`, `P1-PL-007`  
Status: **REPO/CONFIG EVIDENCE DELTA RECORDED / P1-PL-006 OPEN / P1-PL-007 OPEN / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Repozytorium: `developergracz/gracz-pl-2`  
Branch: `main`

> Ten dokument wykonuje wyłącznie odczytową weryfikację repozytorium i konfiguracji zapisanej w kodzie. Nie odczytuje sekretów, nie sprawdza panelu Render/Cloudflare/Resend, nie zmienia runtime ani produkcji i nie zastępuje account-specific contract/DPA/region/transfer evidence.

---

## 1. Cel delty

Poprzednie artefakty P1-PL-006 i P1-PL-007 poprawnie ustaliły publiczne warunki Render i Cloudflare, ale pozostawiły warstwę konta/konfiguracji jako `OPEN`.

Niniejsza delta odpowiada na węższe pytanie:

```text
CO REPOZYTORIUM GRACZ.PL FAKTYCZNIE DOWODZI O UŻYWANYCH / ZINTEGROWANYCH PROVIDERACH?
```

Zasada oceny:

```text
CODE / REPO EVIDENCE != ACCOUNT ACTIVE EVIDENCE
PUBLIC PROVIDER TERMS != ACCOUNT-SPECIFIC CONTRACT EVIDENCE
ENV VARIABLE NAME != SECRET VALUE
INTEGRATION PRESENT != PRODUCTION ENABLED
EU REGION AVAILABLE != ACTUAL GRACZ.PL REGION
```

---

# 2. Snapshot dowodów repozytoryjnych

W review zweryfikowano bez ujawniania sekretów co najmniej następujące artefakty:

1. `maintenance-site/render.yaml`
2. `modern/checkers-engine/src/pg-secure-preload.cjs`
3. `modern/checkers-engine/src/security-service.js`
4. `modern/checkers-engine/src/newsletter.js`
5. `modern/checkers-engine/src/secure-mail-service.js`
6. `modern/checkers-engine/package.json`

Repozytorium ma również historię commitów potwierdzającą świadome, provider-specific zmiany dotyczące Render, Cloudflare Turnstile i Resend.

---

# 3. Render — repo/config evidence

## 3.1. Render maintenance Blueprint

Plik:

`maintenance-site/render.yaml`

Zawiera jawny Blueprint:

```yaml
services:
  - type: web
    runtime: static
    name: gracz-pl-maintenance
    plan: free
    branch: main
    autoDeployTrigger: off
    buildCommand: echo "Static maintenance site - no build step"
    staticPublishPath: .
```

### Co ten dowód potwierdza

```text
RENDER STATIC MAINTENANCE SERVICE = EXPLICITLY DECLARED IN REPO
SERVICE NAME = gracz-pl-maintenance
RUNTIME = static
BRANCH = main
AUTO DEPLOY = off
```

### Czego nie potwierdza

Blueprint nie dowodzi:

- legal entity/contract przypisanego do konkretnego konta;
- DPA acceptance dla konta;
- regionu głównego runtime aplikacji;
- regionu PostgreSQL;
- billing/account owner;
- rzeczywistego statusu usługi w panelu Render;
- support/operations access;
- aktualnej listy subprocesorów dla konkretnego workloadu.

Wniosek:

`RENDER REPO BLUEPRINT EVIDENCE = PASS / LIMITED TO MAINTENANCE STATIC SERVICE`.

---

## 3.2. Render private PostgreSQL awareness

Plik:

`modern/checkers-engine/src/pg-secure-preload.cjs`

Kod rozpoznaje Render private PostgreSQL host jako hostname w formacie `dpg-*` bez publicznego suffixu DNS:

```text
/^dpg-[a-z0-9-]+$/i
```

Dla takiego hosta kod traktuje połączenie jako Render private PostgreSQL i nie wymusza zewnętrznej konfiguracji TLS CA dla ścieżki prywatnej.

### Co ten dowód potwierdza

```text
APPLICATION HAS RENDER-SPECIFIC PRIVATE POSTGRES SUPPORT = YES
RENDER PRIVATE NETWORK HOST PATTERN IS EXPLICITLY HANDLED = YES
DATABASE CONNECTION IS ENV-DRIVEN = YES
```

### Czego nie potwierdza

Kod nie ujawnia i nie powinien ujawniać:

- aktualnej wartości `DATABASE_URL`;
- nazwy rzeczywistego hosta;
- regionu bazy;
- planu bazy;
- backup lifecycle;
- account owner/DPA;
- czy bieżący runtime faktycznie używa private hostname w chwili review.

Wniosek:

`RENDER POSTGRES INTEGRATION = CODE-CONFIRMED / ACCOUNT-RUNTIME STATE NOT VERIFIED`.

---

# 4. Cloudflare — repo/config evidence

## 4.1. Cloudflare Turnstile jest rzeczywistą integracją kodową

Plik:

`modern/checkers-engine/src/security-service.js`

Kod posiada dedykowaną integrację Cloudflare Turnstile przez:

```text
TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
TURNSTILE_HOSTNAME
```

oraz wywołuje endpoint providera:

```text
https://challenges.cloudflare.com/turnstile/v0/siteverify
```

Do weryfikacji wysyłane są zgodnie z kodem co najmniej:

- `secret` — sekret usługi;
- `response` — token challenge;
- `remoteip` — źródłowy adres klienta wyliczony przez warstwę security.

W produkcyjnym flow newslettera `security.verifyTurnstile(..., { required: isProduction() })` wymaga challenge, gdy system działa jako production dla właściwego hosta i konfiguracja Turnstile jest dostępna.

### Decyzja

Poprzednia ogólna pozycja typu:

```text
anti-abuse/CAPTCHA = not selected
```

nie jest już wystarczająco dokładna na poziomie repozytorium.

Poprawny stan evidence brzmi:

```text
CLOUDFLARE TURNSTILE = EXPLICIT CODE INTEGRATION
PROVIDER-SPECIFIC DATA FLOW = PRESENT IN CODE
ACCOUNT/API KEY ACTIVATION = NOT VERIFIED
PRODUCTION ENABLEMENT = ENV/ACCOUNT-SPECIFIC / NOT VERIFIED BY REPO ALONE
```

To jest materialna korekta inventory dla P1-PL-006 i P1-PL-007.

---

## 4.2. Cloudflare proxy/header awareness

Ten sam `security-service.js` obsługuje opcjonalne zaufanie do:

```text
TRUST_CLOUDFLARE_HEADERS=true
cf-connecting-ip
```

Jeżeli flaga jest aktywna, `cf-connecting-ip` może być użyty jako źródłowy adres klienta.

### Decyzja

```text
CLOUDFLARE REVERSE-PROXY HEADER SUPPORT = PRESENT IN CODE
ACTUAL CLOUDFLARE PROXY ENABLEMENT FOR GRACZ.PL = NOT VERIFIED BY REPO ALONE
TRUST_CLOUDFLARE_HEADERS CURRENT RUNTIME VALUE = NOT READ / NOT VERIFIED
```

Nie wolno na podstawie samego kodu twierdzić, że cały ruch gracz.pl faktycznie przechodzi przez Cloudflare proxy/CDN.

---

# 5. Resend — nowy provider ujawniony przez repo

## 5.1. Provider e-mail nie jest już kategorią „not selected” na poziomie kodu

Plik:

`modern/checkers-engine/src/secure-mail-service.js`

Kod jawnie wykorzystuje:

```text
RESEND_API_KEY
https://api.resend.com/emails
provider = resend
```

Newsletter korzysta z `SecureMailService`, a wiadomości obejmują m.in. cele:

- `newsletter-confirm`;
- `newsletter-welcome`;
- `account-verify`;
- `password-reset`;
- `security-alert`.

Do Resend kod może przekazywać co najmniej:

- adres e-mail odbiorcy;
- nadawcę;
- subject;
- text/html wiadomości;
- token/link aplikacyjny osadzony w wiadomości, jeżeli dany flow go wymaga.

### Decyzja

Poprzedni wpis:

```text
e-mail/newsletter provider = not selected
```

jest nieaktualny na poziomie **repo/code integration inventory**.

Poprawny zapis:

```text
RESEND = EXPLICIT PROVIDER INTEGRATION IN CODE
RESEND ACCOUNT / CONTRACT / DPA = NOT VERIFIED
RESEND API KEY PRESENCE = NOT READ / NOT VERIFIED
RESEND PRODUCTION ACTIVITY = NOT VERIFIED
RESEND SUBPROCESSORS / TRANSFER PATH = NOT YET CLOSED IN P1-PL-006/007
```

To rozszerza zakres obu blockerów.

---

# 6. Provider inventory po repo/config delta

| Provider / service | Repo evidence | Możliwy data flow wg kodu | Account-specific evidence | P1-PL-006/007 status |
|---|---|---|---|---|
| Render static maintenance | Blueprint present | static website delivery | `OPEN` | `OPEN` |
| Render application/runtime | Render-specific architecture/history present | app hosting | `OPEN` | `OPEN` |
| Render PostgreSQL | private `dpg-*` support in code | account/game/newsletter/etc. DB data | `OPEN` | `OPEN` |
| Cloudflare Turnstile | explicit code integration | token + client IP + challenge verification | `OPEN` | `OPEN` |
| Cloudflare reverse proxy headers | explicit optional support | source IP/header processing | `OPEN` | `OPEN` |
| Resend | explicit code integration | e-mail address + message payload | `OPEN` | `OPEN` |
| object storage | no final provider established by this delta | attachments if selected later | n/a / `OPEN WHEN SELECTED` | not approved |
| external observability | no final provider established by this delta | logs/traces if selected later | n/a / `OPEN WHEN SELECTED` | not approved |
| MFA/SMS provider | no final provider established by this delta | phone/OTP if selected later | n/a / `OPEN WHEN SELECTED` | not approved |

---

# 7. Data-flow delta wymagany przez P1-PL-007

## 7.1. Cloudflare Turnstile transfer record candidate

Na podstawie repo można już zapisać minimalny kandydat:

```text
PROVIDER = Cloudflare
SERVICE = Turnstile
FLOW = browser/app -> Cloudflare Turnstile verification
DATA CATEGORIES = challenge token, client IP; provider response metadata
THIRD COUNTRY TRANSFER = POSSIBLE / MUST BE ASSESSED AGAINST ACTUAL ACCOUNT + DPA
MECHANISM = PUBLIC DPA MECHANISM PREVIOUSLY VERIFIED, ACCOUNT EFFECTIVENESS OPEN
ACCOUNT ENABLEMENT = NOT VERIFIED
DPA LOCATOR = PUBLIC LOCATOR EXISTS / ACCOUNT EFFECTIVENESS OPEN
FINAL STATUS = HOLD / ACCOUNT-SPECIFIC EVIDENCE REQUIRED
```

## 7.2. Resend transfer record candidate

```text
PROVIDER = Resend
SERVICE = transactional/system e-mail API
FLOW = Gracz.pl backend -> Resend API -> recipient mail system
DATA CATEGORIES = e-mail address, message subject/body, application links/tokens required for flow
THIRD COUNTRY TRANSFER = TO VERIFY AGAINST PROVIDER CONTRACT / PROCESSING LOCATIONS / SUBPROCESSORS
MECHANISM = NOT VERIFIED IN THIS DELTA
ACCOUNT ENABLEMENT = NOT VERIFIED
DPA LOCATOR = NOT VERIFIED
FINAL STATUS = HOLD / PROVIDER REVIEW REQUIRED
```

Resend musi wejść do formalnego P1-PL-006/P1-PL-007 provider gate przed finalnym ADR-V3-012 verdict.

---

# 8. Korekta wcześniejszych założeń

Niniejszy artefakt ma pierwszeństwo jako **repo/config delta** nad wcześniejszymi ogólnymi wpisami, które opisywały:

```text
e-mail/newsletter = not selected
anti-abuse/CAPTCHA = not selected
```

Po inspekcji aktualnego repo stan brzmi:

```text
EMAIL PROVIDER RESEND = SELECTED/INTEGRATED IN CODE, ACCOUNT STATE UNKNOWN
ANTI-ABUSE PROVIDER CLOUDFLARE TURNSTILE = INTEGRATED IN CODE, ACCOUNT STATE UNKNOWN
```

Nie oznacza to, że providerzy są Privacy/Legal `APPROVED`.

---

# 9. Co jest nadal wymagane do P1-PL-006 CLOSED

Dla Render, Cloudflare oraz teraz również Resend należy zachować durable account/provider evidence obejmujące:

1. faktycznie używane usługi i ich zakres;
2. właściwy legal entity / contracting entity;
3. obowiązujący dla konta DPA/contract locator;
4. subprocesorów właściwych dla użytej usługi;
5. retention/delete/return/backup lifecycle;
6. incident/security terms;
7. prawa osób i assistance;
8. faktyczne regiony/storage/processing/support path;
9. okresowy re-review provider evidence.

Brak tych dowodów oznacza:

`P1-PL-006 = OPEN`.

---

# 10. Co jest nadal wymagane do P1-PL-007 CLOSED

Dla każdego realnego flow należy ustalić:

- storage region;
- processing region;
- remote/support access;
- subprocessor path;
- transfer outside EEA: `YES / NO / CONDITIONAL`;
- właściwy mechanizm transferowy;
- TIA / additional assessment, gdy wymagane;
- supplementary safeguards;
- DPA/transfer locator;
- synchronizację z ROPA, privacy notice i DPIA.

Szczególnie nowo ujawnione przez repo:

```text
CLOUDFLARE TURNSTILE FLOW = MUST BE INCLUDED
RESEND E-MAIL FLOW = MUST BE INCLUDED
```

Brak tych dowodów oznacza:

`P1-PL-007 = OPEN`.

---

# 11. Delta względem P1-PL-009

Repo ujawnia również istotne wejścia dla operational privacy-control evidence:

- `SecureMailService` loguje zmaskowany/fingerprintowany target e-mail zamiast pełnego adresu w podstawowych logach;
- provider API key jest pobierany z env, a nie zapisany w repo;
- Turnstile secret jest pobierany z env;
- do Cloudflare siteverify kod przekazuje `remoteip`, co musi wejść do field-level provider inventory;
- realne negative leakage tests nadal nie zostały wykonane przez ten review.

To nie zamyka P1-PL-009.

---

# 12. Status po wykonaniu repo/config delta

```text
REPO/CONFIG PROVIDER INVENTORY = IMPROVED
RENDER MAINTENANCE BLUEPRINT = VERIFIED
RENDER PRIVATE POSTGRES SUPPORT = VERIFIED IN CODE
CLOUDFLARE TURNSTILE INTEGRATION = VERIFIED IN CODE
CLOUDFLARE HEADER SUPPORT = VERIFIED IN CODE
RESEND E-MAIL INTEGRATION = VERIFIED IN CODE
ACCOUNT-SPECIFIC PROVIDER ENABLEMENT = NOT VERIFIED
ACCOUNT-SPECIFIC DPA / CONTRACT = NOT VERIFIED
ACTUAL SERVICE / DATABASE REGIONS = NOT VERIFIED
ACTUAL TRANSFER PATHS = NOT FULLY VERIFIED

P1-PL-006 = OPEN
P1-PL-007 = OPEN
CANONICAL P1 CLOSED = 4 OF 9
CANONICAL P1 OPEN = 5 OF 9
OPEN P0 PRIVACY/LEGAL = 0 KNOWN
FINAL ADR-V3-012 VERDICT = HOLD
SECOND FORMAL DOCUMENT OWNER SIGNATURE = SIGNED 01.09.2026 / HOLD DECISION / P1-PL-006 AND P1-PL-007 REMAIN OPEN
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

# 13. Następny wymagany evidence step

Bez zmiany kodu ani produkcji kolejnym krokiem powinno być pozyskanie **account-specific non-secret evidence** z paneli/usług, w szczególności:

```text
RENDER:
- service inventory
- service region(s)
- PostgreSQL region
- account-effective DPA/terms locator

CLOUDFLARE:
- enabled product inventory
- Turnstile widget/account scope
- proxy/DNS status where relevant
- account-effective DPA/terms locator
- localization settings if any

RESEND:
- account/service use confirmation
- applicable DPA/terms
- processing/subprocessor locations
- transfer mechanism
- retention/deletion model
```

Evidence ma zawierać metadata, daty i locatory, ale **bez wartości sekretów, API keys, tokenów, haseł i pełnych connection strings**.

---

# 14. Granica decyzyjna

Ten dokument:

- poprawia inventory providerów na podstawie realnego repo;
- nie zmienia runtime;
- nie czyta sekretów;
- nie zatwierdza żadnego providera do produkcji;
- nie zamyka P1-PL-006 ani P1-PL-007;
- nie podnosi `REVIEWED DESIGN GATE`;
- nie autoryzuje implementacji/deploymentu;
- nie znosi freeze;
- nie jest profesjonalną opinią prawną.

# Gracz.pl V3 — P1-PL-006 / P1-PL-007 — Account-specific evidence reconciliation: Render, Cloudflare, Resend

Data review: 01.09.2026  
Wersja: `0.1`  
Zakres: `P1-PL-006`, `P1-PL-007`  
Status: **ACCOUNT-SPECIFIC EVIDENCE PARTIALLY RECONCILED / RENDER REGION + RESOURCE EVIDENCE VERIFIED / RESEND PUBLIC DPA ADDED / CLOUDFLARE + RESEND ACCOUNT LAYER OPEN / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Repozytorium: `developergracz/gracz-pl-2`  
Branch: `main`

> Dokument wykorzystuje istniejące operator evidence zapisane w repozytorium, aktualny kod oraz oficjalne dokumenty providerów. Nie odczytuje sekretów, nie zmienia Render/Cloudflare/Resend, nie wznawia runtime i nie autoryzuje deploymentu. Celem jest usunięcie nieaktualnych `NOT VERIFIED`, tam gdzie repo posiada już trwały dowód, oraz pozostawienie jawnego `OPEN` tam, gdzie wymagany jest dowód z konkretnego konta.

---

## 1. Źródła wejściowe

### Repo / operator evidence

- `Nowa dokumentacja Gracz.pl/03-MIGRACJA/46-ETAP4-E4.0-FREEZE-MAINTENANCE-EXECUTION-LOG.md`
- `Nowa dokumentacja Gracz.pl/03-MIGRACJA/58-ETAP4-E4.1-FRESH-PRE-MUTATION-EVIDENCE-LOG.md`
- `Nowa dokumentacja Gracz.pl/03-MIGRACJA/67-ETAP4-E4.1-H-RENDER-PROVIDER-CAPABILITY-ASSESSMENT.md`
- `Nowa dokumentacja Gracz.pl/03-MIGRACJA/71-ETAP4-E4.1-H-RENDER-POSTGRES-CONTINUITY-AND-RETENTION-PLAN.md`
- `modern/checkers-engine/src/security-service.js`
- `modern/checkers-engine/src/adaptive-bot-defense.js`
- `modern/checkers-engine/src/secure-mail-service.js`
- `modern/checkers-engine/src/newsletter.js`
- `maintenance-site/render.yaml`

### Poprzednie privacy/provider review

- `P1-PL-006-PROVIDER-PROCESSOR-DPA-WERYFIKACJA-PUBLICZNYCH-DOWODOW-I-STATUS-GRACZ-PL-V3.md`
- `P1-PL-007-TRANSFER-POZA-EOG-OCENA-PUBLICZNYCH-DOWODOW-I-STATUS-GRACZ-PL-V3.md`
- `P1-PL-006-007-REPO-CONFIG-EVIDENCE-DELTA-RENDER-CLOUDFLARE-GRACZ-PL-V3.md`

### Oficjalne źródła providerów zweryfikowane w tej delcie

Render:
- `https://render.com/dpa`
- `https://render.com/terms`

Resend:
- `https://resend.com/legal/dpa`
- `https://resend.com/legal/subprocessors`
- `https://resend.com/legal/terms-of-service`

Cloudflare pozostaje objęty wcześniejszym public-source review P1-PL-006/007; w tej delcie nie deklaruje się nowej account acceptance bez dowodu z konta.

---

# 2. Render — istniejące account-specific operator evidence

## 2.1. Rzeczywiste zasoby i region

Operator evidence z Render Dashboard, zapisane wcześniej w repozytorium, potwierdza dla projektu `My project` / środowiska `Production`:

```text
WEB SERVICE = gracz-checkers-test
WEB SERVICE RUNTIME = Docker
WEB SERVICE REGION = Frankfurt
POSTGRESQL RESOURCE = gracz-pl-database
POSTGRESQL STATUS = Available
POSTGRESQL VERSION DISPLAYED = PostgreSQL 18
POSTGRESQL REGION = Frankfurt
```

Dowód został zapisany z timestampem ekranu `29.08.2026 11:37 CEST`.

### Korekta wcześniejszego statusu P1-PL-007

Wcześniejszy wpis:

```text
Actual Gracz.pl service/database region = NOT VERIFIED IN THIS REVIEW
```

jest historycznie poprawny dla tamtego konkretnego review, ale nie jest już poprawnym stanem całego evidence set.

Po uwzględnieniu istniejącego operator evidence:

```text
RENDER WEB SERVICE REGION = VERIFIED ACCOUNT-SPECIFIC / FRANKFURT
RENDER POSTGRES REGION = VERIFIED ACCOUNT-SPECIFIC / FRANKFURT
```

Nie oznacza to `NO TRANSFER OUTSIDE EEA`, ponieważ support, operations i subprocessors mogą obejmować państwa poza EOG.

---

## 2.2. Rzeczywisty status usługi

Fresh operator evidence z 30.08.2026 potwierdza:

```text
RESOURCE = gracz-checkers-test
TYPE = Web Service / Docker / Free
STATE = Suspended by you
LATEST VISIBLE SUSPEND EVENT = 29.08.2026 15:37
NO LATER VISIBLE RESUME / DEPLOY / RESTART / ROLLBACK = CONFIRMED BY EVENTS VIEW
```

To jest account-specific provider evidence istnienia i kontroli nad konkretną usługą. Nie jest dowodem DPA acceptance samym w sobie, ale usuwa niepewność, czy Render jest tylko hipotetycznym providerem.

---

## 2.3. Render DPA — relacja z rzeczywistym kontem

Aktualny publiczny Render DPA wskazuje, że:

- jest dodatkiem do Render Terms of Service zawartego pomiędzy Customer a Render Services, Inc.;
- Render jako Company może działać jako processor dla Customer Personal Data;
- ex-EEA transfers są objęte DPF, a gdy DPF nie ma zastosowania — EU SCC;
- SCC są inkorporowane do DPA, a wejście w Agreement jest traktowane jako podpisanie odpowiednich SCC.

Aktualne Render Terms wskazują dodatkowo, że Personal Data przekazywane w ramach Agreement są objęte Render DPA, który jest włączony do Agreement i stanowi jego część.

### Decyzja evidence

Ponieważ repo zawiera trwałe operator evidence rzeczywistego konta/usług Render oraz publiczny kontrakt wprost inkorporuje DPA do Agreement:

```text
RENDER PROVIDER EXISTENCE = ACCOUNT-SPECIFIC VERIFIED
RENDER ACTUAL SERVICE SCOPE = PARTIALLY VERIFIED
RENDER DPA INCORPORATION INTO TERMS = VERIFIED PUBLICLY
RENDER DPA APPLICABILITY TO CUSTOMER PERSONAL DATA = SUBSTANTIATED AT TERMS + ACCOUNT-EXISTENCE LEVEL
RENDER INDIVIDUAL ACCOUNT HOLDER / BILLING IDENTITY SNAPSHOT = NOT CAPTURED IN THIS REVIEW
```

Dla P1-PL-006 oznacza to istotne zmniejszenie blockera Render. Nie utrzymuje się już blankietowego stanu `DPA APPLICABILITY UNKNOWN`.

---

# 3. Render — transfer decision delta

## 3.1. Storage/runtime

```text
WEB RUNTIME STORAGE/COMPUTE REGION = FRANKFURT / VERIFIED
POSTGRES STORAGE/COMPUTE REGION = FRANKFURT / VERIFIED
```

## 3.2. Transfer mechanism

Publiczny DPA definiuje:

```text
PRIMARY/AVAILABLE MECHANISM = EU-U.S. DPF WHERE APPLICABLE
FALLBACK / ALTERNATIVE = EU SCC
CONTROLLER -> PROCESSOR MODULE = MODULE TWO
```

## 3.3. Co nadal pozostaje poza EOG review

Nadal trzeba uwzględnić:

- Render corporate/support/operations access;
- subprocessors;
- global CDN dla statycznej strony maintenance, jeżeli przetwarza dane osobowe;
- provider logs/telemetry;
- ewentualne backup/storage ścieżki poza wskazanym regionem;
- aktualny status DPF konkretnego importera przed finalnym podpisem.

### Status Render w P1-PL-007

```text
RENDER ACCOUNT REGION = PASS / VERIFIED
RENDER TRANSFER MECHANISM MODEL = PASS / VERIFIED PUBLICLY
RENDER THIRD-COUNTRY POSSIBILITY = YES / MUST BE DISCLOSED AND GOVERNED
RENDER FINAL PROVIDER-SPECIFIC TRANSFER RECORD = PASS WITH CONDITIONS CANDIDATE
```

Render sam w sobie nie powinien już pozostawać otwarty z powodu `unknown region`.

---

# 4. Cloudflare — account-specific scope po delcie

Repozytorium potwierdza realną integrację Cloudflare Turnstile:

```text
ENDPOINT = https://challenges.cloudflare.com/turnstile/v0/siteverify
DATA = response token + remoteip + provider secret used for authentication
EXPECTED HOSTNAME = gracz.pl / www.gracz.pl logic supported
PRODUCTION REGISTER/RESET = CHALLENGE REQUIRED BY CODE WHEN PRODUCTION
NEWSLETTER = TURNSTILE VERIFICATION PRESENT
```

Kod obsługuje także opcjonalnie:

```text
TRUST_CLOUDFLARE_HEADERS
cf-connecting-ip
```

### Evidence classification

```text
CLOUDFLARE TURNSTILE INTEGRATION = VERIFIED IN CODE
CLOUDFLARE DATA FLOW DESIGN = VERIFIED
CLOUDFLARE ACCOUNT / WIDGET EXISTENCE = NOT VERIFIED BY CURRENT CONNECTOR
CLOUDFLARE DPA ACCEPTANCE / EFFECTIVE DATE FOR GRACZ.PL ACCOUNT = NOT CAPTURED
CLOUDFLARE DATA LOCALIZATION FEATURES = NOT VERIFIED
CLOUDFLARE PROXY/CDN ENABLEMENT FOR WHOLE DOMAIN = NOT ASSUMED
```

P1-PL-006 oraz P1-PL-007 nie mogą zostać zamknięte na podstawie kodu, jeśli Cloudflare Turnstile ma wejść do finalnego produkcyjnego zakresu V3.

---

# 5. Resend — public DPA i transfer model dodane do evidence set

## 5.1. Legal entity i rola

Aktualny Resend DPA identyfikuje:

```text
COMPANY / DATA IMPORTER = Plus Five Five, Inc. (Resend)
ADDRESS = 2261 Market Street #5039, San Francisco, CA 94114
DEFAULT ROLE FOR CUSTOMER PERSONAL DATA = PROCESSOR, subject to DPA/Agreement
ACCOUNT/USAGE DATA = separate controller role where described
```

DPA jest wiążący przy wejściu Customer w Agreement albo jego wykonaniu. Terms wskazują, że sign-up/free plan acceptance może stanowić wejście w Agreement.

## 5.2. Dane faktycznie ujawnione przez kod Gracz.pl

`secure-mail-service.js` wysyła do Resend przez `https://api.resend.com/emails` co najmniej:

- adres odbiorcy e-mail;
- adres/nazwę nadawcy;
- subject;
- text/html message body;
- autoryzację provider API key.

Provider jest więc materialny dla privacy review nawet wtedy, gdy aktywacja konkretnego konta wymaga jeszcze account evidence.

## 5.3. Retencja wg aktualnego DPA

Resend DPA wskazuje dla Customer Personal Data:

```text
PROCESSING DURATION = while Agreement active
POST-TERMINATION DELETION TARGET = within 90 days of account termination
```

To jest provider-side lifecycle i nie zastępuje własnych krótszych okresów retencji Gracz.pl. Jeżeli Gracz.pl usuwa dane wcześniej, aplikacja nie powinna nadal generować wiadomości ani utrzymywać zbędnych provider-side records bez celu.

## 5.4. Transfery

Resend DPA definiuje:

```text
EU SCC = AVAILABLE / INCORPORATED
EU-U.S. DPF = DECLARED
EX-EEA TRANSFER MODEL = DEFINED
```

DPA wskazuje także, że transfery danych związane z wysyłką e-mail mogą być ciągłe przez czas trwania Agreement.

## 5.5. Subprocessors

Publiczna lista Resend z 15.07.2026 wskazuje m.in. providerów w USA, w tym:

- AWS;
- Cloudflare;
- Datadog;
- Google;
- Inngest;
- PlanetScale;
- Supabase;
- Vercel;
- i inne podmioty zgodnie z aktualną listą.

### Decyzja evidence

```text
RESEND PUBLIC DPA = VERIFIED
RESEND LEGAL ENTITY = VERIFIED
RESEND PROCESSOR MODEL = VERIFIED
RESEND PUBLIC SUBPROCESSORS = VERIFIED
RESEND TRANSFER MECHANISMS = VERIFIED PUBLICLY
RESEND CODE INTEGRATION = VERIFIED
RESEND ACCOUNT EXISTENCE / ACTIVE DOMAIN / CURRENT PLAN = NOT VERIFIED
RESEND EXECUTED / ACCOUNT-EFFECTIVE DPA LOCATOR = NOT CAPTURED
```

Resend zostaje formalnie dodany do scope P1-PL-006 i P1-PL-007.

---

# 6. Skorygowany provider register

| Provider | Real use/integration evidence | Account-specific region/scope | DPA model | Third-country transfer model | Current status |
|---|---|---|---|---|---|
| Render | `YES — operator + repo evidence` | `Frankfurt web + DB verified` | `incorporated into Agreement / verified publicly` | `DPF + SCC; subprocessors/support may be ex-EEA` | `PASS WITH CONDITIONS at provider layer` |
| Cloudflare Turnstile | `YES — code integration` | `account/widget not verified` | `public DPA verified earlier; account acceptance open` | `global / DPF + SCC model` | `OPEN` |
| Resend | `YES — code integration` | `account/domain/plan not verified` | `public DPA verified; Agreement-based binding model` | `DPF + SCC; US subprocessors` | `OPEN` |
| Render maintenance static CDN | `YES — Blueprint` | `global CDN characteristic; account service exists/planned` | `Render DPA model` | `potential global processing` | `included in Render review` |

Future providers not yet selected remain `NOT APPROVED / NO PRODUCTION DATA` until separate provider gate.

---

# 7. Minimalne account evidence nadal potrzebne

Aby domknąć P1-PL-006/P1-PL-007 bez ujawniania sekretów, potrzebne są wyłącznie metadata/evidence, nie wartości kluczy.

## A. Cloudflare

Wymagany capture/record:

```text
ACCOUNT / ZONE = gracz.pl or relevant Turnstile account
TURNSTILE WIDGET / SITE = identifier/name without secret
HOSTNAMES = gracz.pl / www.gracz.pl as applicable
PLAN = metadata only
DPA ACCEPTANCE / EFFECTIVE LOCATOR = dashboard/legal record or equivalent
SERVICES ENABLED = Turnstile + any DNS/proxy/WAF actually active
DATA LOCALIZATION = enabled / not enabled / not applicable
```

Nie wolno ujawniać `TURNSTILE_SECRET_KEY`.

## B. Resend

Wymagany capture/record:

```text
ACCOUNT EXISTS = YES
SENDER DOMAIN = gracz.pl or actual verified sending domain
DOMAIN STATUS = verified / pending
PLAN = metadata only
DPA / AGREEMENT EFFECTIVE LOCATOR = dashboard executed DPA or account agreement evidence
TRACKING FEATURES = open tracking yes/no; click tracking yes/no
RETENTION / DATA FEATURES = provider settings if configurable
```

Nie wolno ujawniać `RESEND_API_KEY`.

## C. Render

Render nie wymaga ponownego dowodu regionu — Frankfurt został już potwierdzony operator evidence.

Przed finalnym podpisem należy tylko wykonać świeży provider snapshot:

```text
WEB SERVICE = gracz-checkers-test
WEB REGION = Frankfurt
DB = gracz-pl-database
DB REGION = Frankfurt
CURRENT PLAN/STATE = metadata
CURRENT DPA TERMS LOCATOR = https://render.com/dpa
CURRENT SUBPROCESSOR LOCATOR = provider public register
```

---

# 8. Status canonical blockers po tej delcie

```text
P1-PL-006 RENDER SUBSCOPE = MATERIALLY RESOLVED / PASS WITH CONDITIONS CANDIDATE
P1-PL-006 CLOUDFLARE ACCOUNT LAYER = OPEN
P1-PL-006 RESEND ACCOUNT LAYER = OPEN
P1-PL-006 OVERALL = OPEN

P1-PL-007 RENDER REGION UNKNOWN = RESOLVED
P1-PL-007 RENDER TRANSFER MODEL = DEFINED
P1-PL-007 CLOUDFLARE ACCOUNT/SERVICE TRANSFER SCOPE = OPEN
P1-PL-007 RESEND ACCOUNT/SERVICE TRANSFER SCOPE = OPEN
P1-PL-007 OVERALL = OPEN

CANONICAL P1 CLOSED = 4 OF 9
CANONICAL P1 OPEN = 5 OF 9
OPEN P0 PRIVACY/LEGAL = 0 KNOWN
FINAL ADR-V3-012 VERDICT = HOLD
SECOND FORMAL DOCUMENT FINAL SIGNATURE = NOT YET
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

# 9. Następna decyzja wykonawcza

Najkrótsza ścieżka do dalszego postępu nie wymaga zmian w kodzie ani produkcji.

Należy zebrać read-only account metadata dla:

1. Cloudflare — Turnstile/service inventory + DPA/effective account evidence;
2. Resend — account/domain + DPA/effective agreement evidence;
3. następnie wykonać jeden finalny provider/transfer delta review i zdecydować, czy P1-PL-006 i P1-PL-007 mogą być `CLOSED`.

Do tego czasu nie wolno sztucznie oznaczyć tych dwóch P1 jako zamknięte.

---

## 10. Governance boundary

Ten dokument:

- nie jest profesjonalną opinią prawną;
- nie zmienia signed mandate ani formalnego drugiego formularza;
- nie odczytuje sekretów;
- nie autoryzuje provider configuration changes;
- nie zdejmuje freeze;
- nie autoryzuje implementacji ani deploymentu;
- utrzymuje `Production V3 = NO-GO`.
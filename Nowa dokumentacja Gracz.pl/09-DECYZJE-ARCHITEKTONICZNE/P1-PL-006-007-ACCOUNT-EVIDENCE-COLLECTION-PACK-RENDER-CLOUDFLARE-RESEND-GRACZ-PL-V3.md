# Gracz.pl V3 — P1-PL-006 / P1-PL-007 — Account Evidence Collection Pack: Render, Cloudflare, Resend

Data przygotowania: 01.09.2026  
Wersja: `0.1`  
Repozytorium: `developergracz/gracz-pl-2`  
Branch: `main`  
Source baseline: `ea85afe0db98cc923ed11acf0251b6d9cb436c63`  
Zakres: `P1-PL-006`, `P1-PL-007`  
Status: **READY FOR OWNER EVIDENCE COLLECTION / NOT FINAL REVIEWED / FREEZE-SAFE**

```text
P1-PL-006 = OPEN
P1-PL-007 = OPEN
FINAL PRIVACY/LEGAL REVIEW = NOT PERFORMED BY THIS DOCUMENT
FINAL ARCHITECTURAL DECISION = NOT PERFORMED BY THIS DOCUMENT
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

> Ten dokument jest pakietem zbierania dowodów i synchronizacją stanu źródeł. Autor dokumentu nie działa w tym kroku jako niezależny reviewer. Dokument nie zamyka blockerów, nie stanowi opinii prawnej, nie akceptuje providera, transferu ani TIA i nie zastępuje późniejszego review przez uprawnionego Privacy/Legal Ownera oraz Lead Architecta.

---

## 1. Cel i granice

Celem jest przygotowanie jednego, minimalnego pakietu do zebrania account-specific evidence dla rzeczywiście występujących w projekcie providerów:

1. Render;
2. Cloudflare, w szczególności Turnstile;
3. Resend.

Pakiet:

- konsoliduje dowody już zapisane w repozytorium;
- oddziela kod, publiczne warunki providera i dowody z konkretnego konta;
- wskazuje pola, których nie wolno domniemywać bez panelu konta;
- wskazuje historyczne wpisy wymagające późniejszej synchronizacji;
- nie odczytuje i nie żąda haseł, tokenów, API keys, connection strings ani wartości sekretów;
- nie zmienia Render, Cloudflare, Resend, DNS, environment, bazy ani produkcji;
- nie wykonuje deployu, restartu ani wznowienia usługi.

---

## 2. Klasy dowodu

| Klasa | Znaczenie |
|---|---|
| `REPO-CONFIRMED` | Kod albo wersjonowany operator evidence w repo potwierdza fakt. |
| `PUBLIC-CONTRACT-CONFIRMED` | Aktualne oficjalne materiały providera potwierdzają model publiczny; nie dowodzą ustawień konkretnego konta. |
| `ACCOUNT-EVIDENCE-PENDING` | Wymagany bezpieczny zrzut lub eksport metadanych z panelu konta. |
| `NOT ASSUMED` | Brak dowodu; funkcja, region, plan albo transfer nie jest uznawany za aktywny. |

Zasada: integracja w kodzie dowodzi wyboru technicznego, lecz nie dowodzi aktywnego konta, aktywnego klucza, wykonania DPA ani ruchu produkcyjnego.

---

## 3. Źródła dowodowe

### 3.1. Repozytorium i operator evidence

- `Nowa dokumentacja Gracz.pl/03-MIGRACJA/46-ETAP4-E4.0-FREEZE-MAINTENANCE-EXECUTION-LOG.md`
- `Nowa dokumentacja Gracz.pl/03-MIGRACJA/58-ETAP4-E4.1-FRESH-PRE-MUTATION-EVIDENCE-LOG.md`
- `Nowa dokumentacja Gracz.pl/03-MIGRACJA/67-ETAP4-E4.1-H-RENDER-PROVIDER-CAPABILITY-ASSESSMENT.md`
- `Nowa dokumentacja Gracz.pl/03-MIGRACJA/71-ETAP4-E4.1-H-RENDER-POSTGRES-CONTINUITY-AND-RETENTION-PLAN.md`
- `Nowa dokumentacja Gracz.pl/09-DECYZJE-ARCHITEKTONICZNE/P1-PL-006-PROVIDER-PROCESSOR-DPA-WERYFIKACJA-PUBLICZNYCH-DOWODOW-I-STATUS-GRACZ-PL-V3.md`
- `Nowa dokumentacja Gracz.pl/09-DECYZJE-ARCHITEKTONICZNE/P1-PL-007-TRANSFER-POZA-EOG-OCENA-PUBLICZNYCH-DOWODOW-I-STATUS-GRACZ-PL-V3.md`
- `Nowa dokumentacja Gracz.pl/09-DECYZJE-ARCHITEKTONICZNE/P1-PL-006-007-REPO-CONFIG-EVIDENCE-DELTA-RENDER-CLOUDFLARE-GRACZ-PL-V3.md`
- `Nowa dokumentacja Gracz.pl/09-DECYZJE-ARCHITEKTONICZNE/P1-PL-006-007-ACCOUNT-SPECIFIC-EVIDENCE-RECONCILIATION-RENDER-CLOUDFLARE-RESEND-GRACZ-PL-V3.md`
- `modern/checkers-engine/src/security-service.js`
- `modern/checkers-engine/src/adaptive-bot-defense.js`
- `modern/checkers-engine/src/secure-mail-service.js`
- `modern/checkers-engine/src/newsletter.js`
- `maintenance-site/render.yaml`

### 3.2. Oficjalne locatory publiczne — odczyt 01.09.2026

Render:

- DPA: https://render.com/dpa
- Terms: https://render.com/terms
- Security, DPF i subprocessors: https://render.com/security
- Regions: https://render.com/docs/regions

Cloudflare:

- Customer DPA v6.4, effective 03.04.2026: https://www.cloudflare.com/cloudflare-customer-dpa/
- GDPR i transfer mechanisms: https://www.cloudflare.com/trust-hub/gdpr/
- Subprocessors: https://www.cloudflare.com/gdpr/subprocessors/
- Turnstile overview: https://developers.cloudflare.com/turnstile/
- Turnstile Siteverify: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Turnstile Privacy Addendum: https://www.cloudflare.com/turnstile-privacy-policy/

Resend:

- DPA: https://resend.com/legal/dpa
- Terms: https://resend.com/legal/terms-of-service
- Subprocessors, last update displayed 27.08.2026: https://resend.com/legal/subprocessors

Publiczne locatory są wejściem do review, a nie account-specific approval evidence.

---

# 4. Render — macierz providera

| Pole | Stan | Klasa dowodu / luka |
|---|---|---|
| Rzeczywiście używana usługa | `gracz-checkers-test` — Web Service / Docker / Free / Frankfurt / `Suspended by you`; `gracz-pl-database` — PostgreSQL 18 / Frankfurt / `Available`; `gracz-pl-maintenance` — Static Site / Global / `Deployed` | `REPO-CONFIRMED`; świeży account snapshot nadal wymagany przed finalnym review |
| Rola administrator/procesor | Gracz.pl: administrator danych użytkowników. Render: procesor dla hostingu/runtime/PostgreSQL i danych przekazanych w tym celu; odrębna rola administratora może dotyczyć danych konta, billing i usage | `PUBLIC-CONTRACT-CONFIRMED`; kwalifikacja per faktyczna usługa pozostaje do zatwierdzenia |
| Kategorie danych | Web/DB: konta, e-mail, auth/session metadata, dane gier/turniejów/rankingu, newsletter, moderacja/audit, logi i — zależnie od ścieżki — wiadomości/załączniki. Static Site: publiczna treść maintenance oraz request/IP/traffic metadata obsługiwane przez CDN; repo potwierdza brak Environment Variables, Secret Files i Linked Environment Groups dla static site | Zakres aplikacyjny `REPO-CONFIRMED`; provider telemetry wymaga account evidence |
| Region storage | Web/DB: Frankfurt potwierdzony. Static Site: global CDN, bez zwykłego wyboru regionu. Lokalizacja backupów/provider telemetry niepotwierdzona dla konta | Frankfurt `REPO-CONFIRMED`; reszta `ACCOUNT-EVIDENCE-PENDING` |
| Region processing | Web runtime i PostgreSQL: Frankfurt dla zasobów. Static CDN: global. Support/operations i ścieżka subprocesorów mogą wykraczać poza EOG | Częściowo potwierdzone; pełny processing path otwarty |
| Remote/support access | Możliwy; dokładne role, lokalizacje, procedury dostępu i historia dla konta Gracz.pl nie są zapisane | `ACCOUNT-EVIDENCE-PENDING` |
| Subprocesorzy | Publiczny rejestr Render wskazuje m.in. AWS, GCP, Cloudflare i ClickHouse w USA | `PUBLIC-CONTRACT-CONFIRMED`; faktyczny service path niepotwierdzony |
| DPA locator | Publiczny: https://render.com/dpa; Terms: https://render.com/terms | Publiczny locator potwierdzony; account/workspace-effective locator i tożsamość kontrahenta do zebrania |
| Transfer poza EOG | `CONDITIONAL` — storage/runtime Frankfurt nie wyklucza support, operations, global CDN ani subprocesorów poza EOG | Nie może zostać sklasyfikowany jako `NO` bez account evidence |
| Mechanizm transferu | Provider-declared DPF, gdy właściwy, oraz EU SCC jako mechanizm alternatywny/fallback; controller-to-processor: Module Two zgodnie z istniejącym review | Publiczny model potwierdzony; aktualny status importera i zastosowanie do konta wymagają finalnego review |
| Dodatkowe safeguards/TIA | Potwierdzić account-effective DPA, aktualny DPF importer status, faktyczny subprocessor path, support/operations access, backup location/lifecycle; utrzymać szyfrowanie, least privilege, data minimization i incident path | `ACCOUNT-EVIDENCE-PENDING`; decyzja TIA nie jest wykonywana przez ten dokument |
| Czego repo już dowodzi | Istnienia i nazw trzech zasobów; typów; stanu; Frankfurt dla Web/DB; planu Free Web Service; globalnego Static Site; zawieszenia writera; braku sekretów/DB w Static Site; publicznego DPA, regionów i subprocesorów | `REPO-CONFIRMED` + `PUBLIC-CONTRACT-CONFIRMED` |
| Czego nie można potwierdzić bez panelu | Bieżącego planu i stanu wszystkich zasobów, workspace/customer identity, account-effective Terms/DPA locator, ustawień backup/retention, dokładnej ścieżki support/subprocessor, aktualnego zakresu usług | `ACCOUNT-EVIDENCE-PENDING` |

---

# 5. Cloudflare — macierz providera

| Pole | Stan | Klasa dowodu / luka |
|---|---|---|
| Rzeczywiście używana usługa | Turnstile jest wybrany i zintegrowany w kodzie dla rejestracji/reset/newsletter anti-abuse. Kod wysyła Siteverify request. Obsługa `cf-connecting-ip` jest opcjonalna. Aktywne konto/widget, DNS proxy, CDN, WAF i inne produkty nie są potwierdzone | Integracja `REPO-CONFIRMED`; aktywacja konta `ACCOUNT-EVIDENCE-PENDING`; nie zakłada się całodomenowego proxy/CDN |
| Rola administrator/procesor | Dla Signals przetwarzanych w celu świadczenia Turnstile: Cloudflare opisuje rolę procesora, Gracz.pl rolę administratora. Dla Signals używanych przez Cloudflare do ulepszania bot detection Cloudflare opisuje odrębną rolę administratora. Dla danych konta/administratora również możliwa odrębna rola Cloudflare | `PUBLIC-CONTRACT-CONFIRMED`; wymagana service-specific kwalifikacja w finalnym review |
| Kategorie danych | Kod: token odpowiedzi, client IP (`remoteip`), expected/returned hostname i wynik challenge. Turnstile publicznie opisuje Signals, m.in. IP, TLS fingerprint, User-Agent, Sitekey i origin; nie należy rozszerzać zakresu o form content. Jeśli aktywne DNS/proxy/WAF: request/traffic metadata — zakres niepotwierdzony | Kod i publiczny opis potwierdzone; aktywne produkty i analytics do panelu |
| Region storage | Niepotwierdzony dla konta/widgetu. Cloudflare działa globalnie; Turnstile nie wymaga używania Cloudflare CDN | `ACCOUNT-EVIDENCE-PENDING`; brak podstaw do `EU-only` |
| Region processing | Global/service-dependent | Publiczny model globalny; account/product path do potwierdzenia |
| Remote/support access | Możliwy w globalnej organizacji i przez service-specific subprocessors; dokładny zakres konta niepotwierdzony | `ACCOUNT-EVIDENCE-PENDING` |
| Subprocesorzy | Publiczny, aktualizowany rejestr Cloudflare; zastosowanie zależy od konkretnej usługi | `PUBLIC-CONTRACT-CONFIRMED`; service-specific applicability otwarta |
| DPA locator | https://www.cloudflare.com/cloudflare-customer-dpa/ | Publiczny DPA potwierdzony; account-effective Main Agreement/DPA locator i data akceptacji do zebrania |
| Transfer poza EOG | `CONDITIONAL` — global processing i subprocesorzy mogą powodować transfer/dostęp poza EOG; zakres zależy od aktywnych produktów i konfiguracji | `ACCOUNT-EVIDENCE-PENDING` |
| Mechanizm transferu | Cloudflare deklaruje DPF dla kwalifikowanych transferów do USA oraz EU SCC i supplementary measures | `PUBLIC-CONTRACT-CONFIRMED`; zastosowanie do konta/usługi wymaga finalnego review |
| Dodatkowe safeguards/TIA | Potwierdzić aktywne produkty, widget hostnames/mode, Turnstile analytics/pre-clearance, DNS proxy/WAF, Data Localization Suite, DPA acceptance, subprocessor scope; zminimalizować logowanie IP/signals i ujawnić Turnstile w privacy notice. TIA/safeguards rozstrzygnąć per faktyczny transfer | `ACCOUNT-EVIDENCE-PENDING` |
| Czego repo już dowodzi | Wyboru Turnstile, endpointu Siteverify, przesyłania tokenu i remote IP, weryfikacji hostname, wymogu challenge dla wybranych produkcyjnych flow, opcjonalnej obsługi nagłówków Cloudflare | `REPO-CONFIRMED` |
| Czego nie można potwierdzić bez panelu | Istnienia i statusu widgetu, jego nazwy/hostnames/mode, planu, analytics/pre-clearance, strefy `gracz.pl`, proxy/DNS/WAF/CDN, Data Localization, account-effective DPA/Terms i pełnego service/subprocessor path | `ACCOUNT-EVIDENCE-PENDING` |

---

# 6. Resend — macierz providera

| Pole | Stan | Klasa dowodu / luka |
|---|---|---|
| Rzeczywiście używana usługa | Resend Email API jest wybrany i zintegrowany w `secure-mail-service.js`; wykorzystywany przez flow newsletter i inne e-maile aplikacyjne. Istnienie konta, aktywna domena, plan i production activity nie są potwierdzone | Integracja `REPO-CONFIRMED`; aktywacja `ACCOUNT-EVIDENCE-PENDING` |
| Rola administrator/procesor | Gracz.pl: administrator danych odbiorców. Plus Five Five, Inc. (Resend): procesor dla Customer Personal Data przekazanych do wysyłki; odrębny administrator dla account/usage data zgodnie z DPA/polityką | `PUBLIC-CONTRACT-CONFIRMED`; account-effective scope do zatwierdzenia |
| Kategorie danych | Kod: adres odbiorcy, adres/nazwa nadawcy, subject, text/html body, purpose/target metadata lokalnego audytu i provider message ID po przyjęciu. DPA: e-mail metadata, address i message content; opcjonalnie attachments oraz open/link tracking data, jeśli funkcje są włączone | Kod i DPA potwierdzone; tracking/attachments/account settings niepotwierdzone |
| Region storage | Publiczny DPA wskazuje główne operacje przetwarzania w USA; dokładna architektura storage/retention aktywnego konta niepotwierdzona | `PUBLIC-CONTRACT-CONFIRMED` + `ACCOUNT-EVIDENCE-PENDING` |
| Region processing | USA jako primary processing operations; dalsze przetwarzanie przez listę subprocesorów, obecnie głównie podmioty wskazane jako USA | Publicznie potwierdzone; account/product path do potwierdzenia |
| Remote/support access | Możliwy w USA i przez subprocesorów/support tooling; dokładne role i access evidence konta niepotwierdzone | `ACCOUNT-EVIDENCE-PENDING` |
| Subprocesorzy | Oficjalna lista, last update 27.08.2026, obejmuje m.in. AWS, Cloudflare, Datadog, Google, Inngest, PlanetScale, Supabase, Vercel i inne podmioty wskazane na stronie | `PUBLIC-CONTRACT-CONFIRMED`; faktyczne wykorzystanie per feature/account niepotwierdzone |
| DPA locator | https://resend.com/legal/dpa; executed version ma być dostępna w dashboardzie po wykonaniu zgodnie z publicznym DPA | Publiczny locator potwierdzony; dashboard executed-DPA locator do zebrania |
| Transfer poza EOG | `CONDITIONAL` na poziomie stanu konta; jeżeli Gracz.pl aktywnie wysyła e-maile przez Resend, transfer do USA występuje zgodnie z publicznym modelem usługi | Aktywność konta niepotwierdzona; model transferu publicznie określony |
| Mechanizm transferu | EU SCC włączone do DPA, w tym Module Two dla controller-to-processor; Resend deklaruje także DPF | `PUBLIC-CONTRACT-CONFIRMED`; account-effective DPA i aktualny importer status do finalnego review |
| Dodatkowe safeguards/TIA | Pozyskać executed DPA, potwierdzić plan/domain/status, tracking, logs/retention i subprocessors; wyłączyć zbędny tracking, minimalizować treść e-mail, nie wysyłać sekretów ani niepotrzebnych danych szczególnych; ocenić SCC/DPF i supplementary measures | `ACCOUNT-EVIDENCE-PENDING`; TIA nie jest finalizowana tutaj |
| Czego repo już dowodzi | Jawnego endpointu Resend API, wymagania `RESEND_API_KEY` bez ujawnienia wartości, pól payloadu e-mail, integracji newslettera, audytu provider ID i publicznego DPA/transfer/subprocessor modelu | `REPO-CONFIRMED` + `PUBLIC-CONTRACT-CONFIRMED` |
| Czego nie można potwierdzić bez panelu | Istnienia konta/team, planu, aktywnej domeny i statusu weryfikacji, production activity, executed DPA, tracking, log retention/data settings, active products i rzeczywistego subprocessor path | `ACCOUNT-EVIDENCE-PENDING` |

---

# 7. Reconciliation — stan potwierdzony i nadal otwarty

## 7.1. Potwierdzone

```text
RENDER WEB SERVICE = gracz-checkers-test
RENDER WEB SERVICE TYPE / PLAN = Docker / Free
RENDER WEB SERVICE REGION = Frankfurt
RENDER WEB SERVICE LAST RECORDED STATE = Suspended by you
RENDER POSTGRES = gracz-pl-database
RENDER POSTGRES VERSION / REGION = PostgreSQL 18 / Frankfurt
RENDER POSTGRES LAST RECORDED STATE = Available
RENDER STATIC SITE = gracz-pl-maintenance / Global / Deployed

CLOUDFLARE TURNSTILE = SELECTED / INTEGRATED IN CODE
CLOUDFLARE SITEVERIFY FLOW = CONFIRMED IN CODE
CLOUDFLARE FULL ACCOUNT/PRODUCT SCOPE = NOT CONFIRMED

RESEND EMAIL API = SELECTED / INTEGRATED IN CODE
RESEND MESSAGE PAYLOAD CLASS = CONFIRMED IN CODE
RESEND ACCOUNT/DOMAIN/PLAN/ACTIVITY = NOT CONFIRMED

PUBLIC DPA / SUBPROCESSOR / TRANSFER LOCATORS = AVAILABLE FOR ALL THREE PROVIDERS
```

## 7.2. Nadal otwarte

```text
P1-PL-006 = OPEN
P1-PL-007 = OPEN

RENDER ACCOUNT-EFFECTIVE CONTRACT LAYER = PARTIAL / OWNER EVIDENCE REQUIRED
CLOUDFLARE ACCOUNT + ACTIVE PRODUCT LAYER = OWNER EVIDENCE REQUIRED
RESEND ACCOUNT + ACTIVE DOMAIN + EXECUTED DPA LAYER = OWNER EVIDENCE REQUIRED

REMOTE/SUPPORT ACCESS = NOT FULLY CONFIRMED
ACCOUNT-SPECIFIC SUBPROCESSOR PATHS = NOT FULLY CONFIRMED
FINAL TRANSFER CLASSIFICATION / TIA = NOT PERFORMED
FINAL PRIVACY NOTICE / ROPA SYNC = NOT PERFORMED
```

---

# 8. Miejsca wymagające późniejszej synchronizacji

Line references odnoszą się do source baseline wskazanego w nagłówku. W tym commicie nie są zmieniane.

## 8.1. Resend nadal opisany jako provider niewybrany lub przyszły

| Plik | Miejsce | Nieaktualny element | Wymagana późniejsza korekta |
|---|---|---|---|
| `P1-PL-006-PROVIDER-PROCESSOR-DPA-WERYFIKACJA-PUBLICZNYCH-DOWODOW-I-STATUS-GRACZ-PL-V3.md` | sekcja 4, ok. linii 272–280; tabela ok. linii 293–300 | e-mail/newsletter w kategorii providerów niewybranych; w tabeli `not selected` | wpisać Resend jako `selected/integrated in code / account layer OPEN`; nie oznaczać jako zatwierdzony |
| `P1-PL-007-TRANSFER-POZA-EOG-OCENA-PUBLICZNYCH-DOWODOW-I-STATUS-GRACZ-PL-V3.md` | tabela, ok. linii 153–160 | `e-mail/newsletter = provider not selected` | wpisać Resend i jego publiczny US/SCC transfer model; account activity pozostawić `OPEN` |
| `PL-C13-PROCESSORS-DPA-INSTRUKCJE-GRACZ-PL-V3.md` | sekcja 2, ok. linii 39–48 | e-mail/newsletter jako klasa przyszła i provider niewybrany | rozdzielić integrację Resend od braku account approval |
| `PL-C14-TRANSFER-DANYCH-POZA-EOG-GRACZ-PL-V3.md` | werdykt ok. linii 21–24; macierz ok. linii 84–90; action item ok. linii 185 | future/not-selected e-mail/newsletter | wpisać Resend jako provider zdefiniowany w kodzie; transfer pozostawić `HOLD/CONDITIONAL` do account evidence |
| `PL-E07-ODBIORCY-PROCESORZY-TRANSFER-DANYCH-GRACZ-PL-V3.md` | `PL-E07-P03`, ok. linii 49; ocena ok. linii 155 | `PENDING PROVIDER SELECTION` / `EMAIL PROVIDER = NOT SELECTED` | nazwać Resend, dodać kategorie danych i utrzymać `NOT APPROVED / ACCOUNT EVIDENCE OPEN` |
| `PL-E08-UMOWY-POWIERZENIA-I-INSTRUKCJE-DLA-PROCESOROW-GRACZ-PL-V3.md` | `PL-E08-P03`, ok. linii 102 | provider poczty `NOT SELECTED` | wpisać Resend; public DPA `VERIFIED`, executed/account-effective DPA `OPEN` |
| `PL-E09-INFORMACJA-I-POLITYKA-PRYWATNOSCI-GRACZ-PL-V3.md` | sekcja 5.1, ok. linii 98–100 | provider poczty/newslettera `PENDING PROVIDER SELECTION` | wpisać Resend jako technicznie wybrany; final provider approval nadal `PENDING` |
| `P1-PL-003-PUBLICATION-READY-PRIVACY-NOTICE-CANDIDATE-I-DELTA-REVIEW-GRACZ-PL-V3.md` | sekcja odbiorców, ok. linii 203 | `przyszły provider poczty/newslettera` | zastąpić Resend z zastrzeżeniem account/DPA/transfer review |
| `ROPA-GRACZ-PL-V3.md` | `ROPA-02`, ok. linii 104; rejestr procesorów, ok. linii 240 | `ewentualny provider ... e-mail` i `PENDING PROVIDER SELECTION` | wpisać Resend jako wybrany w kodzie, bez nadania final approval |

`P1-PL-004...`, sekcja 12, stwierdza jedynie, że ten konkretny dokument nie wybiera dostawcy; jest to historyczna granica zakresu, a nie dowód aktualnego braku wyboru. Nie wymaga korekty sensu, tylko ewentualnego odnośnika do późniejszego wyboru Resend.

## 8.2. Cloudflare przedstawiony pośrednio jako wyłącznie przyszły anti-abuse/CAPTCHA

Nie znaleziono bezpośredniego twierdzenia `Cloudflare = future-only`. Znaleziono jednak wpisy, które nadal traktują anti-abuse/CAPTCHA jako niewybrany albo czysto przyszły provider, mimo że Turnstile jest zintegrowany w kodzie:

| Plik | Miejsce | Nieaktualny element | Wymagana późniejsza korekta |
|---|---|---|---|
| `P1-PL-006-PROVIDER-PROCESSOR-DPA-WERYFIKACJA-PUBLICZNYCH-DOWODOW-I-STATUS-GRACZ-PL-V3.md` | sekcja 4, ok. linii 280; tabela ok. linii 303 | anti-abuse/CAPTCHA `not selected` | wpisać `Cloudflare Turnstile = selected/integrated in code / account widget OPEN` |
| `PL-C13-PROCESSORS-DPA-INSTRUKCJE-GRACZ-PL-V3.md` | ok. linii 39 i 48 | anti-abuse jako przyszła/niezatwierdzona klasa | wskazać Turnstile jako integrację istniejącą; approval pozostawić otwarty |
| `PL-C14-TRANSFER-DANYCH-POZA-EOG-GRACZ-PL-V3.md` | ok. linii 24, 90 i 185 | future/pending anti-abuse provider | wskazać Turnstile i jego service-specific transfer review |
| `PL-E07-ODBIORCY-PROCESORZY-TRANSFER-DANYCH-GRACZ-PL-V3.md` | `PL-E07-P07`, ok. linii 53 | provider anti-abuse `jeśli użyty` / `PENDING` | wpisać Turnstile jako zintegrowany w kodzie; account/product state `OPEN` |
| `PL-E08-UMOWY-POWIERZENIA-I-INSTRUKCJE-DLA-PROCESOROW-GRACZ-PL-V3.md` | `PL-E08-P07`, ok. linii 106 | anti-abuse/CAPTCHA `jeśli użyty` | nazwać Turnstile; public DPA `VERIFIED`, account-effective evidence `OPEN` |
| `PL-E09-INFORMACJA-I-POLITYKA-PRYWATNOSCI-GRACZ-PL-V3.md` | sekcja 5.1, ok. linii 100 | anti-abuse jako `NOT APPROVED / PENDING` bez wskazania Turnstile | rozdzielić `integration selected` od `provider approval pending` |

Wpisy Cloudflare `TO VERIFY`, `account/widget not verified`, `service-specific role OPEN` i `full-domain proxy/CDN NOT ASSUMED` pozostają prawidłowe i nie powinny zostać sztucznie podniesione do `PASS`.

---

# 9. Minimalny account-specific evidence request

## 9.1. Zasady bezpiecznego capture

- Widoczne mogą być: nazwy usług, typy, plany, regiony, statusy, domeny, aktywne produkty, daty/wersje Terms lub DPA i ustawienia bez wartości sekretów.
- Należy ukryć: hasła, API keys, tokeny, connection strings, secret values, recovery codes, payment-card data, pełne dane billingowe i identyfikatory, których nie potrzeba do review.
- Nie otwierać widoku pokazującego wartość secretu. Nie kopiować sekretów do dokumentacji ani czatu.
- Zrzuty mają być read-only. Nie zapisywać zmian w panelach.

## 9.2. Render — potrzebne zrzuty/dane

1. **Project/Environment inventory** — jeden aktualny widok pokazujący:
   - `gracz-checkers-test`: typ, plan, status, region;
   - `gracz-pl-database`: typ/version, plan, status, region;
   - bez connection string i bez environment values.
2. **Static Site overview/settings** — `gracz-pl-maintenance`: typ, plan, status, oznaczenie Global, przypięta domena `gracz.pl`; bez DNS tokenów.
3. **Postgres backup/retention summary** — nazwa bazy, plan, region, dostępny backup/PITR/retention status; bez credentials i bez URL bazy.
4. **Workspace/account legal layer** — nazwa workspace/customer i plan/agreement type oraz widok/locator aktualnych Terms/DPA lub dokumentów compliance; zamaskować dane płatnicze i zbędne dane kontaktowe.

## 9.3. Cloudflare — potrzebne zrzuty/dane

1. **Account/zone overview** — konto i strefa `gracz.pl`, plan oraz lista aktywnych produktów. Jeśli DNS/proxy/WAF/CDN są aktywne, wystarczy status produktu; bez eksportu rekordów i bez wartości konfiguracyjnych.
2. **Turnstile widget overview** — nazwa widgetu, status, plan/tier, mode i dozwolone hostnames (`gracz.pl`, `www.gracz.pl` według faktycznego ustawienia). Nie pokazywać secret key; sitekey także może zostać zamaskowany, bo nie jest potrzebny do decyzji.
3. **Turnstile features** — status Analytics, Pre-Clearance, Ephemeral IDs/Enterprise features i ewentualny Offlabel; tylko enabled/disabled/not available.
4. **Data localization / logs** — widok pokazujący, czy Data Localization Suite lub regionalne log controls są enabled, disabled, unavailable albo not applicable.
5. **Legal/contract layer** — wersja/data Customer DPA albo account agreement/Terms locator dostępny dla konta; bez podpisów elektronicznych zawierających zbędne dane.

## 9.4. Resend — potrzebne zrzuty/dane

1. **Account/team/billing overview** — nazwa team/account, plan i status; zamaskować dane płatnicze i zbędne dane osobowe.
2. **Domains** — rzeczywista sending domain, np. `gracz.pl`, oraz status `verified/pending/failed`; bez DNS verification values i bez API keys.
3. **Active products/features** — Email API, Broadcasts/Audiences/Inbound/Webhooks lub inne funkcje: tylko enabled/used/not used.
4. **Tracking i retention/logs** — open tracking, click tracking, email logs/history/retention i suppression/contacts settings, jeśli panel je pokazuje; tylko statusy i okresy.
5. **Executed DPA / agreement** — dashboard locator, wersja i effective/execution date zgodnie z panelem; bez API keys, tokenów i sekretów.

---

# 10. Kryteria kompletności pakietu właściciela

Account evidence pack jest gotowy do przekazania reviewerowi, gdy:

1. każdy wymagany zrzut ma provider, konto/workspace, datę capture i zakres;
2. sekrety oraz wartości uwierzytelniające są niewidoczne;
3. active service inventory jest rozdzielone od funkcji tylko dostępnych w planie;
4. account-effective DPA/Terms locator jest zapisany albo jawnie `NOT AVAILABLE`;
5. region storage i processing są rozdzielone;
6. remote/support access i subprocessors nie są domniemane;
7. transfer ma wyłącznie status roboczy `YES/NO/CONDITIONAL` z dowodem;
8. późniejszy reviewer może prześledzić każdy wniosek do repo, publicznego locatora albo zrzutu konta.

Brak ekranu lub brak funkcji w panelu należy zapisać jako `NOT AVAILABLE / NOT VERIFIED`, a nie zastępować domniemaniem.

---

# 11. Status końcowy tego dokumentu

```text
ACCOUNT EVIDENCE COLLECTION PACK = READY
OWNER EVIDENCE COLLECTION = PENDING
P1-PL-006 = OPEN
P1-PL-007 = OPEN
FINAL REVIEW = NOT PERFORMED
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

Dokument nie zawiera finalnej decyzji architektonicznej ani prawnej.

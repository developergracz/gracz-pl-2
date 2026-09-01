# Gracz.pl V3 — P1-PL-007 Transfery poza EOG — ocena publicznych dowodów i status

Data review: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-007`  
Status: **PARTIALLY RESOLVED / PUBLIC TRANSFER MECHANISMS VERIFIED / ACCOUNT-SPECIFIC CONFIGURATION STILL OPEN / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence/control: `PL-E07`, `PL-E08`, `PL-C14`, `P1-PL-006`

> Dokument wykonuje warstwę public-source review dla transferów danych poza EOG dla providerów już występujących w architekturze Gracz.pl V3. Nie jest opinią prawną, nie zatwierdza konfiguracji konkretnego konta i nie autoryzuje implementacji ani deploymentu.

---

## 1. Kryterium kanonicznego blockera

P1-PL-007 może zostać formalnie `CLOSED`, gdy dla każdego rzeczywiście używanego providera i subprocesora:

1. znane są miejsca storage i processing;
2. znany jest remote/support/operations access;
3. znani są subprocesorzy;
4. dla transferów poza EOG wskazano właściwy mechanizm;
5. wykonano dodatkową ocenę/TIA i safeguards tam, gdzie jest wymagana;
6. wynik jest odzwierciedlony w DPA, ROPA i privacy notice;
7. nie pozostaje `TO VERIFY` dla providera faktycznie używanego w V3.

Publiczne materiały providera mogą potwierdzić dostępne mechanizmy i model kontraktowy, ale nie potwierdzają same z siebie ustawień konkretnego konta Gracz.pl.

---

## 2. Oficjalne źródła zweryfikowane w tym review

### Render

- Render Data Processing Addendum: `https://render.com/dpa`
- Render Security and Trust / subprocessors: `https://render.com/security`
- Render regions: `https://render.com/docs/regions`

Stan publicznego dokumentu DPA zweryfikowany podczas review:

- legal entity: `Render Services, Inc.`;
- siedziba importera wskazana w DPA: San Francisco, USA;
- DPA obejmuje model controller→processor;
- dla ex-EEA transfers Render przewiduje EU-U.S. Data Privacy Framework, a gdy nie ma zastosowania / nie jest dostępny — EU Standard Contractual Clauses;
- EU SCC Module Two jest wskazany dla sytuacji, gdy Customer jest controllerem, a Render procesorem;
- DPA zawiera supplementary measures dla transferów objętych SCC;
- Render publikuje listę autoryzowanych subprocesorów i mechanizm powiadomienia o zmianach;
- publiczna lista subprocesorów obejmuje podmioty z USA, m.in. AWS, GCP, Cloudflare i ClickHouse;
- Render oferuje m.in. region `Frankfurt, Germany`, ale wybór dostępnego regionu nie oznacza automatycznie, że cały ekosystem support/subprocessor/operations pozostaje wyłącznie w EOG;
- static sites korzystają z globalnego CDN i nie mają zwykłego wyboru regionu jak usługa/datastore.

### Cloudflare

- Cloudflare Customer DPA v6.4, effective 03.04.2026: `https://www.cloudflare.com/cloudflare-customer-dpa/`
- Cloudflare subprocessors: `https://www.cloudflare.com/gdpr/subprocessors/`
- Cloudflare GDPR / transfer information: `https://www.cloudflare.com/trust-hub/gdpr/`
- Cloudflare Data Localization Suite: `https://developers.cloudflare.com/data-localization/`

Stan publicznego dokumentu DPA zweryfikowany podczas review:

- legal entity: `Cloudflare, Inc.`;
- w standardowym modelu DPA Customer jest controllerem, a Cloudflare processorem w zakresie usług objętych DPA;
- DPA obejmuje EU SCCs i mechanizmy transferu dla danych z EOG;
- Cloudflare deklaruje używanie EU-U.S. Data Privacy Framework dla kwalifikowanych transferów do USA oraz SCCs jako alternatywę / dla innych transferów;
- lista subprocesorów obejmuje zarówno EOG, jak i państwa poza EOG, w tym USA, Singapur i inne lokalizacje zależne od konkretnej usługi;
- sama usługa Cloudflare jest globalna; nie wolno założyć `EU-only processing` bez faktycznego włączenia właściwych funkcji lokalizacyjnych;
- Cloudflare Data Localization Suite zawiera narzędzia regionalizacji, ale jest osobnym rozwiązaniem/zakresem produktu i nie wolno przyjąć, że jest aktywne dla Gracz.pl bez dowodu konfiguracji.

### Komisja Europejska

Źródło: `https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en`

Na dzień review Komisja Europejska nadal wskazuje Stany Zjednoczone — dla organizacji uczestniczących w EU-U.S. Data Privacy Framework — jako objęte decyzją stwierdzającą odpowiedni stopień ochrony. Nie oznacza to jednak automatycznego `PASS` dla każdego dostawcy: trzeba potwierdzić, że konkretny importer może faktycznie korzystać z właściwego mechanizmu dla danego transferu i zakresu danych.

---

## 3. Render — ocena transferowa

| Element | Wynik |
|---|---|
| Legal entity | `VERIFIED PUBLICLY — Render Services, Inc., USA` |
| Processor DPA model | `VERIFIED PUBLICLY` |
| EU-U.S. DPF mechanism | `DEFINED IN DPA` |
| EU SCC fallback / alternative | `DEFINED IN DPA` |
| SCC Module 2 controller→processor | `DEFINED IN DPA` |
| Supplementary measures | `DEFINED IN DPA` |
| Public subprocessors | `VERIFIED PUBLICLY / MULTI-JURISDICTION` |
| Frankfurt region available | `YES` |
| Actual Gracz.pl service/database region | `NOT VERIFIED IN THIS REVIEW` |
| Actual remote/support access for Gracz.pl account | `NOT VERIFIED` |
| Actual subprocessor path for Gracz.pl workload | `NOT VERIFIED` |
| Account-effective DPA / acceptance evidence | `P1-PL-006 OPEN` |
| Final transfer status | `PARTIAL / NOT YET CLOSABLE` |

### Wniosek Render

Publiczny model prawny dostawcy jest wystarczająco opisany, aby nie utrzymywać wcześniejszego stanu `TRANSFER MECHANISM UNKNOWN`. Mechanizm jest publicznie zdefiniowany. Nadal nie ma jednak dowodu, który konkretny region i faktyczny processing path obowiązuje dla konta/usług Gracz.pl.

Nie przyjmujemy uproszczenia:

```text
FRANKFURT REGION = NO TRANSFER OUTSIDE EEA
```

Nawet przy Frankfurt storage/runtime należy uwzględnić support, operations i subprocesorów.

---

## 4. Cloudflare — ocena transferowa

| Element | Wynik |
|---|---|
| Legal entity | `VERIFIED PUBLICLY — Cloudflare, Inc., USA` |
| Processor DPA model | `VERIFIED PUBLICLY FOR SERVICES COVERED BY DPA` |
| EU-U.S. DPF mechanism | `PUBLICLY DECLARED` |
| EU SCC mechanism | `DEFINED IN DPA` |
| Public subprocessors | `VERIFIED / GLOBAL` |
| Regionalization tools | `AVAILABLE, SERVICE/PLAN/CONFIG DEPENDENT` |
| Actual Gracz.pl Cloudflare services enabled | `NOT VERIFIED IN THIS REVIEW` |
| Data Localization Suite enabled | `NOT VERIFIED / MUST NOT BE ASSUMED` |
| Customer Metadata Boundary enabled | `NOT VERIFIED` |
| Regional Services EU enabled | `NOT VERIFIED` |
| Actual remote/support processing path | `NOT VERIFIED` |
| Account-effective DPA / acceptance evidence | `P1-PL-006 OPEN` |
| Final transfer status | `PARTIAL / NOT YET CLOSABLE` |

### Wniosek Cloudflare

Dla standardowego globalnego modelu należy zakładać możliwość międzynarodowego przetwarzania/dostępu zgodnie z DPA i listą subprocesorów, a nie deklarować `NO TRANSFER`. Jeżeli Gracz.pl później zastosuje konkretne funkcje Data Localization, transfer inventory należy zaktualizować zgodnie z faktycznie włączonym zakresem.

---

## 5. Data Privacy Framework i SCC — reguła projektu

Dla V3 przyjmuje się następującą regułę governance:

```text
DPF MAY BE USED ONLY WHERE THE IMPORTER AND TRANSFER ARE ELIGIBLE
SCC MAY BE USED WHERE REQUIRED / CONTRACTUALLY INCORPORATED
SCC EXISTENCE ALONE != COMPLETE TRANSFER REVIEW
EU REGION ALONE != NO INTERNATIONAL TRANSFER
SUBPROCESSORS + SUPPORT ACCESS MUST BE INCLUDED
```

Jeżeli transfer opiera się na DPF, evidence register powinien potwierdzić aktualny status uczestnictwa/certyfikacji właściwego importera w momencie finalnego provider approval.

Jeżeli transfer opiera się na SCC, należy wykonać i zachować odpowiednią ocenę transferu/safeguards w zakresie wymaganym dla faktycznego przepływu, danych i ryzyka. Nie tworzymy jednej abstrakcyjnej TIA dla wszystkich przyszłych providerów.

---

## 6. Publiczny provider-transfer register — stan po review

| Provider | Public transfer mechanism | Public subprocessor geography | Account-specific configuration | Status |
|---|---|---|---|---|
| Render | DPF + EU SCCs wg DPA | includes USA / multi-provider | `OPEN` | `PASS AT PUBLIC-EVIDENCE LAYER / OPEN ACCOUNT LAYER` |
| Cloudflare | DPF + EU SCCs wg DPA | global / service-dependent | `OPEN` | `PASS AT PUBLIC-EVIDENCE LAYER / OPEN ACCOUNT LAYER` |
| e-mail/newsletter — Resend | DPF + EU SCCs wg publicznego DPA | USA / global subprocessors | `OPEN — account activity/effective DPA` | `INTEGRATED IN CODE / TRANSFER CONDITIONAL / ACCOUNT EVIDENCE PENDING` |
| object storage | provider not selected | unknown | n/a | `NOT APPROVED` |
| observability | provider/model not selected | unknown | n/a | `NOT APPROVED` |
| MFA/SMS | not approved | unknown | n/a | `NOT APPROVED` |
| anti-abuse/CAPTCHA — Cloudflare Turnstile | DPF + EU SCCs wg publicznego DPA | global / service-dependent | `OPEN — widget/account scope` | `INTEGRATED IN CODE / TRANSFER CONDITIONAL / ACCOUNT EVIDENCE PENDING` |

Providerzy przyszli nie blokują oceny konkretnego transferu, dopóki nie wchodzą do zakresu produkcyjnego V3. Każdy z nich wymaga osobnego provider/transfer gate przed użyciem.

---

## 7. Elementy wymagane do formalnego zamknięcia P1-PL-007

### P1-PL-007-O01 — Render account evidence

Potwierdzić dla rzeczywiście używanych usług Gracz.pl:

- region każdego web/private/background service;
- region PostgreSQL/datastore;
- czy istnieją static sites/global CDN w zakresie danych osobowych;
- account-effective DPA / agreement locator;
- aktualny subprocessor register snapshot/locator;
- support/operations access model w zakresie możliwym do ustalenia;
- właściwy transfer mechanism record dla rzeczywistego przepływu.

Status: `OPEN P1 — account/provider evidence`.

### P1-PL-007-O02 — Cloudflare service inventory

Potwierdzić:

- które usługi Cloudflare faktycznie są aktywne dla Gracz.pl;
- czy zakres obejmuje tylko DNS/TLS/proxy/security czy również inne produkty;
- czy włączono Data Localization Suite / Regional Services / Customer Metadata Boundary;
- account-effective DPA / terms locator;
- właściwą listę subprocesorów dla używanych produktów;
- transfer mechanism dla faktycznego zakresu.

Status: `OPEN P1 — account/service evidence`.

### P1-PL-007-O03 — transfer/TIA decision record

Po ustaleniu O01/O02 utworzyć finalny record:

```text
PROVIDER =
SERVICE =
DATA CATEGORIES =
STORAGE REGION =
PROCESSING REGION =
REMOTE ACCESS =
SUBPROCESSORS =
THIRD COUNTRY TRANSFER = YES / NO / CONDITIONAL
MECHANISM = ADEQUACY/DPF / SCC / OTHER APPROVED MECHANISM
TIA / ADDITIONAL ASSESSMENT REQUIRED = YES / NO + REASON
SUPPLEMENTARY SAFEGUARDS =
DPA LOCATOR =
SUBPROCESSOR LOCATOR =
REVIEW DATE =
NEXT REVIEW DATE =
FINAL STATUS = APPROVED / APPROVED WITH CONDITIONS / HOLD / REJECTED
```

Status: `OPEN P1`.

### P1-PL-007-O04 — synchronization

Po finalizacji zaktualizować:

- ROPA;
- privacy notice;
- PL-E07;
- PL-E08;
- PL-C13;
- PL-C14;
- pełną DPIA/provider risk section;
- provider register.

Status: `OPEN P1`.

---

## 8. Decyzja o zamknięciu

Na podstawie publicznych, aktualnych materiałów można zamknąć wcześniejszą niewiedzę dotyczącą tego, **czy Render i Cloudflare w ogóle posiadają udokumentowane mechanizmy międzynarodowych transferów**.

Nie można jednak uczciwie stwierdzić, że dla Gracz.pl:

- znamy rzeczywisty region wszystkich usług Render;
- znamy rzeczywisty processing/support path;
- znamy dokładny Cloudflare product scope;
- wiemy, czy aktywowano funkcje lokalizacyjne Cloudflare;
- posiadamy account-specific/effective DPA locators;
- zakończyliśmy TIA/transfer decision per realny przepływ.

Dlatego:

```text
P1-PL-007 PUBLIC TRANSFER-MECHANISM REVIEW = PASS
RENDER PUBLIC DPA / SCC / DPF MODEL = VERIFIED
CLOUDFLARE PUBLIC DPA / SCC / DPF MODEL = VERIFIED
PUBLIC SUBPROCESSOR GEOGRAPHY = VERIFIED AT PROVIDER-PUBLISHED LEVEL
EU-US DPF ADEQUACY = CURRENTLY RECOGNIZED BY EUROPEAN COMMISSION

ACCOUNT-SPECIFIC RENDER REGION / PROCESSING PATH = OPEN
ACCOUNT-SPECIFIC CLOUDFLARE SERVICE / LOCALIZATION SCOPE = OPEN
EFFECTIVE CONTRACT / DPA LOCATORS = OPEN UNDER P1-PL-006
FINAL TRANSFER/TIA RECORD = OPEN

P1-PL-007 = PARTIALLY RESOLVED / STILL OPEN
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

## 9. Granica autoryzacji

Utworzenie tego dokumentu:

- nie zmienia regionu Render;
- nie zmienia konfiguracji Cloudflare;
- nie aktywuje Data Localization Suite;
- nie zawiera zgody na nowy transfer;
- nie dodaje providera;
- nie zmienia DNS, bazy, sekretów ani produkcji;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze.

Privacy/Legal Decision Owner: **Czesław Socha**  
Projekt: **Gracz.pl**

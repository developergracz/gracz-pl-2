# Gracz.pl V3 — P1-PL-006 Providerzy / procesorzy / DPA — weryfikacja publicznych dowodów i status

Data review: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-006`  
Status: **PARTIALLY RESOLVED / PUBLIC PROVIDER EVIDENCE VERIFIED / ACCOUNT-SPECIFIC CONTRACT EVIDENCE STILL OPEN / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązane evidence/control: `PL-E07`, `PL-E08`, `PL-C13`, `PL-C14`, `P1-PL-005`

> Dokument wykonuje provider/DPA review dla rzeczywiście obecnych w architekturze Gracz.pl providerów Render i Cloudflare na podstawie publicznie dostępnych oficjalnych dokumentów dostawców. Nie zastępuje account-specific evidence potwierdzającego, jakie dokładnie usługi są aktywne na koncie Gracz.pl i jaki DPA/contract jest wiążący dla tego konta. Nie autoryzuje implementacji ani deploymentu.

---

## 1. Kryterium kanonicznego P1-PL-006

P1-PL-006 może zostać `CLOSED` dopiero, gdy dla każdego providera rzeczywiście używanego do przetwarzania danych osobowych:

1. ustalono legal entity i rzeczywistą rolę;
2. zweryfikowano DPA/kontrakt tam, gdzie wymagany;
3. znani są subprocesorzy;
4. potwierdzono security/incident terms;
5. potwierdzono prawa osób, deletion/return, retencję i backup lifecycle;
6. istnieją durable evidence locatory;
7. providerzy planowani, ale niewybrani, pozostają poza produkcyjnym przepływem danych do czasu osobnego approval gate.

---

# 2. Render — public provider verification

## 2.1. Legal entity

Oficjalny DPA Render identyfikuje podmiot jako:

```text
Render Services, Inc.
```

Publiczny locator:

`https://render.com/dpa`

DPA wskazuje relację między `Customer` a Render Services, Inc. i rozróżnia przetwarzanie danych klienta jako procesor od określonych danych account/usage, dla których Render może działać jako administrator.

### Ocena

`LEGAL ENTITY = VERIFIED AT PUBLIC DOCUMENT LEVEL`.

---

## 2.2. Rola

Dla Customer Personal Data przetwarzanych w celu świadczenia hostingu/platformy DPA przewiduje model controller-to-processor i m.in. SCC Module Two, gdy klient jest administratorem, a Render działa jako procesor.

Dla danych account/usage Render może mieć odrębną rolę administratora zgodnie z własną polityką prywatności.

### Decyzja projektowa

Dla danych aplikacyjnych Gracz.pl umieszczanych w runtime/PostgreSQL/hostingu:

```text
RENDER ROLE = PROCESSOR CANDIDATE / PUBLIC DPA SUPPORTS CONTROLLER->PROCESSOR MODEL
```

Account-specific service scope nadal musi zostać potwierdzony przed finalnym `APPROVED`.

---

## 2.3. DPA i instrukcje

Oficjalny Render DPA:

`https://render.com/dpa`

Publicznie potwierdza m.in.:

- przetwarzanie Customer Personal Data dla świadczenia Services zgodnie z Agreement/DPA;
- obowiązek poufności;
- subprocesorów i mechanizm powiadomień/objection;
- środki bezpieczeństwa;
- pomoc przy prawach osób;
- delete/return po zakończeniu usługi, z wyjątkami prawnymi;
- mechanizmy transferowe dla transferów poza EOG;
- audyt/compliance assistance w zakresie DPA;
- SCC, w tym Module Two dla controller-to-processor;
- środki organizacyjne i techniczne opisane w załącznikach.

### Decyzja

```text
RENDER PUBLIC DPA = VERIFIED
RENDER ACCOUNT-SPECIFIC DPA APPLICABILITY / ACCEPTANCE EVIDENCE = OPEN
```

Publiczny DPA jest trwałym locator-em treści umownej, ale do finalnego `CLOSED` trzeba zachować dowód, że aktualny stosunek konta Gracz.pl do Render podlega tej wersji DPA/Agreement.

---

## 2.4. Subprocesorzy

Oficjalna strona Security and Trust Render publikuje listę subprocesorów, m.in.:

- Amazon Web Services (AWS) — hosting/cloud platform — United States;
- Google Cloud Platform (GCP) — hosting/cloud platform — United States;
- Cloudflare — hosting/cloud platform — United States;
- ClickHouse Inc. — hosting/cloud platform — United States.

Publiczny locator:

`https://render.com/security`

DPA odwołuje się do publicznej listy subprocesorów i przewiduje mechanizm aktualizacji/notification.

### Decyzja

`RENDER SUBPROCESSOR REGISTER = VERIFIED AT PUBLIC DOCUMENT LEVEL / MUST BE SNAPSHOTTED AGAIN BEFORE FINAL SIGNATURE`.

---

## 2.5. Regiony

Render publicznie dokumentuje regiony usług i baz danych, w tym:

- Oregon, USA;
- Ohio, USA;
- Virginia, USA;
- Frankfurt, Germany;
- Singapore.

Locator:

`https://render.com/docs/regions`

Statyczne strony są obsługiwane przez global CDN i nie wybiera się dla nich zwykłego regionu runtime.

### Decyzja

```text
RENDER AVAILABLE REGIONS = VERIFIED
ACTUAL GRACZ.PL SERVICE/DATABASE REGION = ACCOUNT-SPECIFIC / STILL OPEN
```

Sama dostępność Frankfurtu nie dowodzi, że wszystkie dane Gracz.pl są przetwarzane wyłącznie w EOG.

---

## 2.6. Deletion / return / rights

Render DPA przewiduje po zakończeniu Services, według wyboru Customer, zwrot albo usunięcie Customer Personal Data, chyba że dalsze przechowywanie jest wymagane lub dozwolone prawem. DPA opisuje także obsługę Data Subject Requests i wskazuje, że klient pozostaje odpowiedzialny za odpowiedź, z wykorzystaniem funkcji Services i pomocy Render tam, gdzie właściwe.

### Decyzja

`RENDER DELETE/RETURN + RIGHTS CONTRACT LANGUAGE = VERIFIED AT PUBLIC DOCUMENT LEVEL`.

Faktyczny lifecycle backupów i możliwy czas pozostawania danych po usunięciu musi zostać dodatkowo zmapowany do P1-PL-008.

---

## 2.7. Security

Render publicznie deklaruje m.in. SOC 2 Type 2, ISO 27001, encryption at rest dla customer-supplied databases oraz TLS dla transmisji; DPA zawiera załącznik z technical and organisational measures.

Locator:

`https://render.com/security`  
`https://render.com/dpa`

### Decyzja

`RENDER SECURITY TERMS = VERIFIED AT PUBLIC DOCUMENT LEVEL / CONFIGURATION-SPECIFIC EFFECTIVENESS NOT ASSERTED`.

---

# 3. Cloudflare — public provider verification

## 3.1. Legal entity

Oficjalne dokumenty Cloudflare identyfikują zasadniczy podmiot usługowy jako:

```text
Cloudflare, Inc.
101 Townsend Street
San Francisco, CA 94107
USA
```

Publiczne locatory:

`https://www.cloudflare.com/trust-hub/gdpr/`  
`https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/`

### Ocena

`CLOUDFLARE LEGAL ENTITY = VERIFIED AT PUBLIC DOCUMENT LEVEL`.

---

## 3.2. Rola

Cloudflare Customer DPA przewiduje przetwarzanie Personal Data na rzecz Customer w zakresie Services, obowiązki procesora i subprocesorów, ale rzeczywista kwalifikacja roli zależy od konkretnej użytej usługi i kategorii danych.

Dla projektowanego edge/DNS/TLS/security flow Gracz.pl nie zapisuje się blankietowo, że każda operacja Cloudflare ma wyłącznie jedną rolę prawną.

### Decyzja

```text
CLOUDFLARE PROCESSOR MODEL = SUPPORTED BY PUBLIC CUSTOMER DPA
SERVICE-SPECIFIC ROLE FOR GRACZ.PL = ACCOUNT/CONFIGURATION-SPECIFIC / OPEN
```

---

## 3.3. DPA

Cloudflare Trust Hub publikuje Customer Data Processing Addendum i materiały dotyczące GDPR.

Locatory:

`https://www.cloudflare.com/trust-hub/gdpr/`  
`https://cf-assets.www.cloudflare.com/slt3lc6tev37/3LmXORq5FW5EuJ0OT1B871/f466268011407efbc07f4fadbd1af466/Cloudflare_Customer_DPA_v6.3_June_20__2025.pdf`

Publiczne terms potwierdzają m.in.:

- ograniczenie użycia danych do Services/umowy;
- obowiązki poufności i bezpieczeństwa;
- korzystanie z subprocesorów na podstawie pisemnych zobowiązań;
- wsparcie dla praw osób;
- delete/return po zakończeniu usługi z wyjątkami prawnymi;
- assistance dla DPIA, security i breach response;
- mechanizm listy subprocesorów.

### Decyzja

```text
CLOUDFLARE PUBLIC DPA = VERIFIED
CLOUDFLARE ACCOUNT-SPECIFIC DPA / SERVICE SCOPE EVIDENCE = OPEN
```

---

## 3.4. Subprocesorzy

Cloudflare prowadzi oficjalną listę subprocesorów usług Cloudflare.

Locator:

`https://www.cloudflare.com/gdpr/subprocessors/cloudflare-services/`

Publiczna lista wskazuje podmioty i lokalizacje/obszary działania, np. wsparcie/customer management oraz service-specific subprocessors.

### Decyzja

`CLOUDFLARE SUBPROCESSOR REGISTER = VERIFIED AT PUBLIC DOCUMENT LEVEL / SERVICE-SPECIFIC APPLICABILITY MUST BE CONFIRMED`.

---

## 3.5. Rights, delete/return, incident/DPIA assistance

Customer DPA Cloudflare przewiduje m.in.:

- notification/assistance dla Data Subject Requests;
- delete/return Personal Data po zakończeniu usługi, z wyjątkami prawnymi;
- assistance związane z DPIA i bezpieczeństwem;
- obowiązki związane z breach notification;
- pisemne zobowiązania subprocesorów.

### Decyzja

`CLOUDFLARE RIGHTS / DELETE / INCIDENT CONTRACT LANGUAGE = VERIFIED AT PUBLIC DOCUMENT LEVEL`.

---

# 4. Providerzy niewybrani

Dla następujących kategorii nie istnieje obecnie finalny provider approval:

- e-mail/newsletter;
- object storage / attachments;
- observability/logging;
- MFA/SMS;
- anti-abuse/CAPTCHA, jeśli będzie używany odrębny provider.

Decyzja:

```text
UNSELECTED PROVIDER = OUTSIDE APPROVED PRODUCTION DATA FLOW
NO DATA MAY BE SENT BEFORE PROVIDER APPROVAL GATE
```

Brak wyboru providera nie oznacza automatycznie osobnego P1, jeśli usługa nie jest jeszcze częścią faktycznie zatwierdzonego produkcyjnego przepływu danych. Każdy wybrany później provider musi przejść ten sam approval gate przed użyciem.

---

# 5. Durable provider evidence register — stan 01.09.2026

| Provider | Legal entity | Public DPA | Public subprocessors | Security/rights/delete terms | Account-specific agreement evidence | Final status |
|---|---|---|---|---|---|---|
| Render | Render Services, Inc. | VERIFIED | VERIFIED | VERIFIED AT PUBLIC DOC LEVEL | `OPEN` | `APPROVED WITH CONDITIONS / P1 OPEN` |
| Cloudflare | Cloudflare, Inc. | VERIFIED | VERIFIED | VERIFIED AT PUBLIC DOC LEVEL | `OPEN` | `APPROVED WITH CONDITIONS / P1 OPEN` |
| e-mail/newsletter | not selected | N/A | N/A | N/A | N/A | `NOT APPROVED / NO PRODUCTION DATA` |
| object storage | not selected | N/A | N/A | N/A | N/A | `NOT APPROVED / NO PRODUCTION DATA` |
| observability | not selected / may be self-hosted | N/A | N/A | N/A | N/A | `NOT APPROVED / NO PRODUCTION DATA` |
| MFA/SMS | not approved | N/A | N/A | N/A | N/A | `NOT APPROVED / NO PRODUCTION DATA` |
| anti-abuse/CAPTCHA | not selected | N/A | N/A | N/A | N/A | `NOT APPROVED / NO PRODUCTION DATA` |

---

# 6. Co zostało rozwiązane

W porównaniu z wcześniejszym stanem `TO VERIFY / NOT VERIFIED` rozwiązano na poziomie publicznego evidence:

- Render legal entity;
- Render public DPA;
- Render public subprocessor register;
- Render dostępne regiony;
- Render public security, rights i delete/return terms;
- Cloudflare legal entity;
- Cloudflare public Customer DPA;
- Cloudflare public subprocessor register;
- Cloudflare public rights/delete/incident/DPIA-assistance terms;
- durable public locators dla powyższych dowodów.

---

# 7. Co nadal blokuje formalne CLOSED

Nie można uczciwie oznaczyć P1-PL-006 jako `CLOSED`, ponieważ sam publiczny dokument providera nie dowodzi jeszcze, że:

1. aktualne konto Gracz.pl jest związane dokładnie tą wersją DPA/Agreement;
2. wskazano account-specific/evidence locator potwierdzający wiążącą relację;
3. dokładny zakres aktywnych usług Render/Cloudflare został zapisany i sprawdzony;
4. faktyczna konfiguracja regionów i backup lifecycle odpowiada modelowi V3;
5. dla Cloudflare potwierdzono service-specific rolę dla rzeczywiście aktywnych funkcji;
6. provider-side backup/deletion lifecycle został zweryfikowany na poziomie faktycznej usługi i planu konta;
7. ostateczny stan został zsynchronizowany z P1-PL-007, ROPA i publication-ready privacy notice.

Te elementy wymagają account-specific evidence, którego nie wolno zastępować domniemaniem z publicznych stron providera.

---

# 8. Minimalny evidence potrzebny od właściciela kont przed CLOSED

Dla każdego faktycznie używanego providera należy zachować bez ujawniania sekretów:

```text
ACCOUNT / CONTRACT OWNER = Czesław Socha / Gracz.pl
SERVICE(S) IN USE =
PLAN / AGREEMENT TYPE =
DPA APPLICABLE VERSION =
DPA / CONTRACT ACCOUNT LOCATOR =
ACCOUNT-SPECIFIC REGION =
DATABASE REGION =
SERVICE REGION =
ACTIVE CLOUDFLARE PRODUCTS =
BACKUP / RETENTION SETTINGS =
PROCESSOR ROLE CONFIRMED = YES / NO / MIXED PER SERVICE
REVIEWED BY =
REVIEW DATE =
```

Nie wpisujemy haseł, tokenów, API keys ani innych sekretów.

---

# 9. Status kanoniczny

```text
P1-PL-006 PUBLIC PROVIDER REVIEW = COMPLETED
RENDER PUBLIC CONTRACT/DPA EVIDENCE = VERIFIED
RENDER SUBPROCESSOR REGISTER = VERIFIED
RENDER AVAILABLE REGIONS = VERIFIED
CLOUDFLARE PUBLIC DPA EVIDENCE = VERIFIED
CLOUDFLARE SUBPROCESSOR REGISTER = VERIFIED
UNSELECTED FUTURE PROVIDERS = BLOCKED FROM PRODUCTION UNTIL APPROVAL

ACCOUNT-SPECIFIC DPA / CONTRACT EVIDENCE = OPEN P1
ACCOUNT-SPECIFIC SERVICE SCOPE = OPEN P1
ACCOUNT-SPECIFIC REGION / BACKUP LIFECYCLE = OPEN P1
CLOUDFLARE SERVICE-SPECIFIC ROLE = OPEN P1

P1-PL-006 = PARTIALLY RESOLVED / STILL OPEN
CANONICAL P1 CLOSED = 4 OF 9
CANONICAL P1 OPEN = 5 OF 9
OPEN P0 PRIVACY/LEGAL = 0 KNOWN

ADR-V3-012 FINAL VERDICT = HOLD
SECOND FORMAL DECISION DOCUMENT = DO NOT FINAL-SIGN YET
REVIEWED DESIGN GATE = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

# 10. Relacja do P1-PL-007

Publiczne dowody z tego dokumentu są wejściem do `P1-PL-007 — Transfers outside EEA`, ponieważ oba providerzy publikują informacje wskazujące na możliwość wykorzystania podmiotów/lokalizacji poza EOG. P1-PL-007 musi osobno ocenić mechanizmy transferowe, remote access, subprocesorów i faktyczny account/service scope.

---

# 11. Granica autoryzacji

Utworzenie tego dokumentu:

- nie zmienia Render ani Cloudflare;
- nie zmienia regionów, planów, DNS, bazy ani sekretów;
- nie akceptuje automatycznie żadnego niewybranego providera;
- nie wysyła danych do nowego dostawcy;
- nie jest podpisaniem DPA w imieniu użytkownika;
- nie jest profesjonalną opinią prawną;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze ani Production V3 NO-GO.

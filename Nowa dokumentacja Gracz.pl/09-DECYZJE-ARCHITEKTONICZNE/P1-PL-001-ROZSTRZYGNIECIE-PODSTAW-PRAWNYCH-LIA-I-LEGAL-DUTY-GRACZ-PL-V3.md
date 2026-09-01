# Gracz.pl V3 — P1-PL-001 Rozstrzygnięcie podstaw prawnych, LIA i legal-duty

Data decyzji dokumentacyjnej: 01.09.2026  
Wersja: `0.1`  
Canonical blocker: `P1-PL-001`  
Status: **SUBSTANTIVE DECISION RECORDED / PARTIAL RESOLUTION / OPEN FOR SYNCHRONIZATION AND RESIDUAL LEGAL-REVIEW ITEMS / FREEZE-SAFE**  
Powiązany review: `REV-ADR-V3-012-20260901-PL-DECISION-01`  
Powiązane evidence: `PL-E03`, `PL-E10`, `PL-E11`, `PL-E13`  
Powiązane kontrole: `PL-C02`, `PL-C08`  
Powiązane canonical P1: `P1-PL-002`, `P1-PL-003`, `P1-PL-004`, `P1-PL-005`

> Dokument zapisuje projektowe rozstrzygnięcie podstaw prawnych dla bazowego modelu Gracz.pl V3. Nie jest opinią prawną i nie zastępuje profesjonalnej konsultacji tam, gdzie potrzebna jest interpretacja prawa lub case-specific analiza. Rozstrzygnięcie nie autoryzuje implementacji ani deploymentu.

---

## 1. Oficjalna podstawa regulacyjna

Źródło podstawowe: Rozporządzenie (UE) 2016/679 (RODO/GDPR), EUR-Lex:  
`https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=pl`

Na potrzeby tej decyzji przyjmuje się literalne rozróżnienie z art. 6 ust. 1 RODO:

- `6(1)(a)` — zgoda dla konkretnego celu;
- `6(1)(b)` — przetwarzanie niezbędne do wykonania umowy lub działań na żądanie osoby;
- `6(1)(c)` — przetwarzanie niezbędne do wykonania konkretnego obowiązku prawnego ciążącego na administratorze;
- `6(1)(f)` — przetwarzanie niezbędne do prawnie uzasadnionego interesu, jeżeli interesy lub podstawowe prawa i wolności osoby nie mają charakteru nadrzędnego, ze szczególną ostrożnością wobec dzieci.

Dla realizacji praw osób źródłem obowiązków są w szczególności art. 12–22 RODO, zależnie od rodzaju żądania.

---

## 2. Finalna mapa podstaw dla bazowego modelu V3

### LB-01 — konto, rejestracja i profil

**Decyzja projektowa:** `art. 6(1)(b) — ACCEPTED FOR BASELINE`, wyłącznie dla danych rzeczywiście niezbędnych do utworzenia i prowadzenia konta oraz udostępnienia funkcji konta.

Warunki:

- dane opcjonalne nie dziedziczą automatycznie tej podstawy;
- brak zbierania danych „na zapas”;
- zakres publicznego profilu wymaga jawnego celu i minimalizacji.

### LB-02 — uwierzytelnianie, sesje, recovery i MFA

**Decyzja projektowa:**

- `art. 6(1)(b) — ACCEPTED` dla podstawowego auth/session/recovery koniecznego do świadczenia usługi;
- `art. 6(1)(f) — ACCEPTED WITH SAFEGUARDS` dla dodatkowych środków bezpieczeństwa i anti-abuse w zakresie opisanym w LIA-01.

Granica:

- szeroki device fingerprinting, trwałe profilowanie urządzeń albo behawioralne śledzenie poza niezbędnym bezpieczeństwem nie jest zatwierdzone tym dokumentem.

### LB-03 — gry, mecze, replay, ranking i turnieje

**Decyzja projektowa:**

- `art. 6(1)(b) — ACCEPTED` dla prowadzenia rozgrywki, historii potrzebnej do funkcji gry, rankingu i turniejów;
- `art. 6(1)(f) — ACCEPTED WITH SAFEGUARDS` dla integralności rozgrywek, przeciwdziałania manipulacji i rozstrzygania sporów w zakresie LIA-02.

Granica:

- każdy nowy anti-cheat wykorzystujący szerokie sygnały urządzenia, profilowanie zachowania lub automatyczne poważne sankcje wymaga nowego review/DPIA update.

### LB-04 — prywatne wiadomości i załączniki

**Decyzja projektowa:** `art. 6(1)(b) — ACCEPTED` dla dostarczenia wiadomości i załączników między uprawnionymi stronami.

Nie zatwierdza się:

- rutynowego czytania plaintext prywatnych wiadomości przez administratora;
- ogólnego skanowania treści dla celów marketingowych;
- kopiowania treści prywatnych wiadomości do logów, audit, telemetry lub zwykłych evidence artifacts.

Case-specific dostęp moderacyjny może być rozważany tylko w wąskim, udokumentowanym zakresie, z need-to-know, audytem i odpowiednią podstawą dla konkretnego celu.

### LB-05 — publiczny chat i social

**Decyzja projektowa:**

- `art. 6(1)(b) — ACCEPTED` dla samego dostarczenia jawnie wybranej funkcji chat/social;
- `art. 6(1)(f) — ACCEPTED WITH SAFEGUARDS` dla moderacji, anti-spam i bezpieczeństwa społeczności w zakresie LIA-03.

Warunek szczególny: użytkownicy 16–17 wymagają privacy-by-default i pełnej DPIA z P1-PL-005.

### LB-06 — newsletter i komunikacja marketingowa

**Decyzja projektowa:** `art. 6(1)(a) — ACCEPTED` dla dobrowolnego newslettera/marketingu.

Zasady:

- newsletter nie jest warunkiem podstawowej usługi;
- zgoda jest odrębna od regulaminu;
- withdrawal/unsubscribe zatrzymuje przyszły marketing;
- ponowny zapis wymaga nowego consent event.

**NIE ROZSTRZYGA SIĘ tutaj** 24-miesięcznego suppression record ani 6-letniego consent proof. Te elementy pozostają w `P1-PL-002` i `P1-PL-004` jako osobne kwestie celu, retencji i case-specific podstawy.

### LB-07 — moderacja, zgłoszenia, sankcje i odwołania

**Decyzja projektowa:** `art. 6(1)(f) — ACCEPTED WITH MATERIAL SAFEGUARDS` dla ochrony użytkowników i platformy, obsługi zgłoszeń, sankcji i odwołań w zakresie LIA-03.

Warunki:

- human review dla poważnych sankcji;
- możliwość odwołania;
- minimalizacja evidence;
- brak blankietowego dostępu do prywatnej komunikacji;
- ograniczony legal hold;
- brak trwałego, ogólnego „risk profile” użytkownika bez osobnego review.

### LB-08 — audit, RBAC i działania uprzywilejowane

**Decyzja projektowa:** `art. 6(1)(f) — ACCEPTED WITH SAFEGUARDS` dla rozliczalności, ochrony systemu i wykrywania nadużyć administracyjnych w zakresie LIA-04.

Granica:

- sama podstawa nie zatwierdza retencji do 6 lat;
- okresy długoterminowe pozostają w `P1-PL-002`;
- audit nie może zawierać sekretów ani plaintext prywatnych wiadomości.

### LB-09 — realizacja praw osób

**Decyzja projektowa:** `art. 6(1)(c) — ACCEPTED FOR DIRECT GDPR RIGHTS OBLIGATIONS`.

Konkretny obowiązek prawny: realizacja obowiązków administratora wynikających z RODO, w szczególności procedur i komunikacji wymaganych przez art. 12 oraz praw wykonywanych zgodnie z art. 15–22, zależnie od konkretnego żądania.

Granica:

- ta decyzja obejmuje przetwarzanie konieczne do obsługi i wykonania żądania;
- nie daje automatycznej podstawy do 6-letniego przechowywania pełnego evidence po zakończeniu sprawy;
- długoterminowy proof pozostaje w `P1-PL-002`.

### LB-10 — security telemetry, logi, traces i anti-abuse

**Decyzja projektowa:** `art. 6(1)(f) — ACCEPTED WITH STRONG MINIMIZATION` w zakresie LIA-05; techniczne elementy bezpośrednio niezbędne do świadczenia usługi mogą dodatkowo mieścić się w `6(1)(b)` tylko w rzeczywiście niezbędnym zakresie.

Warunki:

- field-level policy;
- masking/redaction;
- krótkie retencje;
- brak message body, tokenów, haseł, MFA secrets i zbędnego PII;
- observability provider wymaga provider approval gate.

### LB-11 — backup, restore i anti-resurrection

**Decyzja projektowa:**

- dane w backupie zachowują podstawy właściwe dla danych źródłowych;
- `art. 6(1)(f) — ACCEPTED WITH SAFEGUARDS` dla continuity/recovery i mechanizmów anti-resurrection w zakresie LIA-07.

Granica:

- backup nie jest legal hold;
- retencja backupów i dowód operacyjny pozostają zależne od P1-PL-008;
- backup nie daje odrębnej podstawy do używania historycznych danych w nowych celach.

---

## 3. Rozstrzygnięcie LIA

Na poziomie modelu projektowego przyjmuje się:

```text
LIA-01 SECURITY / ANTI-ABUSE = ACCEPTED WITH SAFEGUARDS
LIA-02 GAME INTEGRITY = ACCEPTED WITH SAFEGUARDS
LIA-03 MODERATION = ACCEPTED WITH MATERIAL SAFEGUARDS
LIA-04 PRIVILEGED AUDIT = ACCEPTED WITH SAFEGUARDS
LIA-05 SECURITY TELEMETRY = ACCEPTED WITH STRONG MINIMIZATION
LIA-06 CLAIMS / GENERIC PROOF = NOT GENERALLY ACCEPTED / CASE-SPECIFIC ONLY
LIA-07 BACKUP / RESTORE CONTINUITY = ACCEPTED WITH SAFEGUARDS
```

`LIA-06` nie jest podstawą zbiorczą do retencji „na wszelki wypadek”. Każdy dłuższy proof/claims record wymaga osobnego celu, zakresu, okresu i — jeśli potrzebne — profesjonalnego review prawnego.

---

## 4. Reguła art. 6(1)(c)

`art. 6(1)(c)` jest dopuszczony tylko wtedy, gdy można wskazać konkretny obowiązek prawny.

Dla bazowego V3 niniejsza decyzja zatwierdza `6(1)(c)` dla realizacji bezpośrednich obowiązków wynikających z RODO w zakresie obsługi praw osób.

Nie zatwierdza się użycia `6(1)(c)` jako ogólnej podstawy dla:

- bezpieczeństwa,
- audit,
- marketingu,
- długiej retencji evidence,
- logów,
- backupów,
- moderacji,
- przechowywania danych „na wypadek sporu”.

Takie użycie wymagałoby wskazania odrębnej, konkretnej normy prawnej mającej zastosowanie do administratora.

---

## 5. Elementy przeniesione do innych kanonicznych P1

Aby uniknąć podwójnego liczenia blokad:

| Kwestia | Kanoniczny blocker |
|---|---|
| 6 lat privacy-request evidence | `P1-PL-002` |
| 24 miesiące suppression/unsubscribe record | `P1-PL-002` + `P1-PL-004` |
| 6 lat consent proof | `P1-PL-002` + `P1-PL-004` |
| do 6 lat privileged audit/role history | `P1-PL-002` |
| finalny newsletter consent/suppression/proof model | `P1-PL-004` |
| full DPIA i minors safeguards | `P1-PL-005` |
| publication-ready lawful-basis disclosure | `P1-PL-003` |

Te kwestie nie są uznane za rozwiązane przez P1-PL-001.

---

## 6. Warunki pozostające przed formalnym zamknięciem P1-PL-001

Substancja podstaw prawnych dla bazowych procesów została rozstrzygnięta, ale kanoniczny blocker **nie jest jeszcze formalnie CLOSED**, ponieważ jego własne kryteria wymagają pełnej synchronizacji z dokumentami nadrzędnymi.

Pozostaje:

1. zsynchronizować `PL-E03` z decyzjami `ACCEPTED / ACCEPTED WITH SAFEGUARDS` z tego dokumentu;
2. zsynchronizować ROPA z finalną mapą podstaw;
3. przenieść do publication-ready privacy notice opis finalnych podstaw i LIA;
4. usunąć z dokumentów bazowych zbędne `PROPOSED / LIA REQUIRED` dla procesów rozstrzygniętych tutaj, pozostawiając `HOLD` wyłącznie tam, gdzie rzeczywiście należy do P1-PL-002/P1-PL-004/P1-PL-005;
5. wykonać delta review spójności po synchronizacji.

---

## 7. Status kanoniczny po tej decyzji

```text
P1-PL-001 SUBSTANTIVE LAWFUL-BASIS DECISION = RECORDED
CORE 6(1)(b) BASES = ACCEPTED FOR NECESSARY SERVICE PROCESSING
NEWSLETTER 6(1)(a) = ACCEPTED FOR VOLUNTARY MARKETING
GDPR RIGHTS 6(1)(c) = ACCEPTED FOR DIRECT GDPR OBLIGATIONS
MATERIAL 6(1)(f) LIA = ACCEPTED WITH SAFEGUARDS
GENERIC CLAIMS / PROOF 6(1)(f) = NOT ACCEPTED AS BLANKET BASIS
LONG-TERM PROOF / RETENTION = MOVED TO P1-PL-002 / P1-PL-004
FULL DPIA / MINORS = P1-PL-005
ROPA / PL-E03 / PRIVACY NOTICE SYNC = OPEN

P1-PL-001 = PARTIALLY RESOLVED / STILL OPEN FOR SYNCHRONIZATION
OPEN P0 PRIVACY/LEGAL = 0 KNOWN
FINAL ADR-V3-012 VERDICT = HOLD
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
PRODUCTION V3 = NO-GO
FREEZE = ACTIVE
```

---

## 8. Decision Owner i granica mandatu

Privacy/Legal Decision Owner: **Czesław Socha**  
Projekt: **Gracz.pl**  
Data zapisu decyzji dokumentacyjnej: **01.09.2026**

Zapis oznacza decyzję governance właściciela projektu w granicach jego mandatu. Nie oznacza, że Decision Owner jest adwokatem, radcą prawnym, IOD/DPO ani że dokument zastępuje specjalistyczną opinię w sprawach wymagających profesjonalnej interpretacji.

---

## 9. Granica autoryzacji

Utworzenie tego dokumentu:

- nie zmienia kodu;
- nie zmienia Render, bazy, providerów, DNS ani sekretów;
- nie zatwierdza długiej retencji pozostającej w HOLD;
- nie zatwierdza blanketowego dostępu do prywatnych wiadomości;
- nie autoryzuje nowych mechanizmów profilowania ani device fingerprinting;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `Production V3 = NO-GO`.

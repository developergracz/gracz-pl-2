# Gracz.pl V3 — PL-E10 LIA / prawnie uzasadniony interes

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E10`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązana mapa celów/podstaw: `PL-E03-MAPA-CELOW-I-PODSTAW-PRAWNYCH-GRACZ-PL-V3.md`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`

> Dokument stanowi roboczy i wersjonowany balancing test dla procesów, dla których projektowo rozważana jest podstawa z art. 6 ust. 1 lit. f RODO. Nie jest opinią prawną. Każdy wynik wymaga formalnej akceptacji Privacy/Legal Decision Ownera, a procesy o podwyższonym ryzyku wymagają dodatkowej konsultacji i/lub DPIA screening.

---

## 1. Metoda LIA

Dla każdego procesu oceniamy trzy warunki:

1. **Purpose test** — czy istnieje konkretny, zgodny z prawem i rzeczywisty uzasadniony interes.
2. **Necessity test** — czy przetwarzanie jest konieczne do realizacji tego interesu i nie istnieje mniej ingerujący, równie skuteczny środek.
3. **Balancing test** — czy interes administratora nie jest nadrzędny wobec praw, wolności i uzasadnionych oczekiwań osoby.

Dodatkowo wymagane są środki ograniczające ryzyko: minimalizacja, retencja, ograniczenie dostępu, opt-out/sprzeciw tam gdzie właściwy, transparentność, brak danych nadmiarowych oraz osobna ocena małoletnich.

---

## 2. Zakres procesów objętych LIA

Niniejszy dokument obejmuje wyłącznie procesy oznaczone w PL-E03 jako `art. 6(1)(f) PROPOSED / LIA REQUIRED`:

- bezpieczeństwo konta i anti-abuse,
- integralność rozgrywek, rankingów i turniejów,
- moderacja i ochrona społeczności,
- audit i historia działań uprzywilejowanych,
- security telemetry, logi i wykrywanie incydentów,
- obrona przed roszczeniami / minimalny proof tam, gdzie nie wynika to z obowiązku prawnego,
- ochrona backup/restore przed przywróceniem wcześniej usuniętych danych.

Marketing/newsletter oparty na zgodzie nie korzysta automatycznie z 6(1)(f).

---

# 3. LIA-01 — bezpieczeństwo konta i anti-abuse

| Element | Ocena |
|---|---|
| Interes | ochrona kont użytkowników, infrastruktury i administratora przed przejęciami, fraudem, brute-force, credential stuffing i innymi nadużyciami |
| Legalność interesu | `YES — PROPOSED` |
| Konieczność | `YES WITH CONDITIONS` — niektóre security signals są konieczne; pełna telemetry behawioralna nie może być zbierana domyślnie |
| Kategorie danych | IP, UA, timestamps, session/security event metadata, correlation IDs, account identifiers |
| Alternatywy mniej ingerujące | rate limiting, device-independent heurystyki, krótsza retencja, agregacja, pseudonimizacja |
| Wpływ na osobę | umiarkowany; wzrasta przy trwałym device fingerprinting lub szerokim profilowaniu |
| Oczekiwania osoby | użytkownik rozsądnie oczekuje podstawowych mechanizmów bezpieczeństwa konta |
| Safeguards | minimalizacja, brak sekretów w logach, retencja 90 dni security logs / 12 miesięcy security events tylko gdy uzasadnione, dostęp need-to-know, brak marketingowego reuse |
| Małoletni | dodatkowa ostrożność; brak behawioralnego profilowania do celów innych niż bezpieczeństwo |
| Wynik | `PASS WITH CONDITIONS CANDIDATE` |

Warunek finalny: security telemetry musi być opisana w privacy notice, ograniczona do zakresu niezbędnego i objęta procedurą sprzeciwu tam, gdzie ma zastosowanie.

---

# 4. LIA-02 — integralność gier, rankingów i turniejów

| Element | Ocena |
|---|---|
| Interes | zapewnienie uczciwości rozgrywek, zapobieganie manipulacji wynikami, wykrywanie nadużyć i rozstrzyganie sporów |
| Legalność interesu | `YES — PROPOSED` |
| Konieczność | `YES WITH CONDITIONS` |
| Kategorie danych | match/game IDs, user IDs, ruchy, eventy, wynik, rating, timestamps, wybrane anti-cheat signals |
| Alternatywy | krótsza retencja danych identyfikowalnych, anonimizacja po zakończeniu sporu/okresu, ograniczenie anti-cheat telemetry |
| Wpływ | niski–umiarkowany dla zwykłej historii gry, wyższy przy szerokim profilowaniu zachowania |
| Oczekiwania | gracz oczekuje zapisu wyniku i mechanizmów uczciwej gry |
| Safeguards | brak danych spoza kontekstu gry, ograniczenie retencji, brak automatycznych sankcji wyłącznie na podstawie niejawnego profilu bez review, możliwość odwołania |
| Wynik | `PASS WITH CONDITIONS CANDIDATE` |

Warunek finalny: każdy mechanizm anti-cheat musi mieć osobny opis celu, danych i retencji.

---

# 5. LIA-03 — moderacja, zgłoszenia i sankcje

| Element | Ocena |
|---|---|
| Interes | ochrona użytkowników i platformy przed spamem, nadużyciami, groźbami, oszustwami i naruszeniami regulaminu |
| Legalność interesu | `YES — PROPOSED` |
| Konieczność | `YES WITH CONDITIONS` |
| Kategorie danych | reporter/reported IDs, treść zgłoszenia, fragmenty evidence, sanction metadata, timestamps |
| Alternatywy | minimalizacja evidence, ograniczenie do istotnego fragmentu treści, krótsza retencja, anonimizacja zamkniętych spraw |
| Wpływ | umiarkowany–wysoki; możliwe konsekwencje dla dostępu do usługi |
| Oczekiwania | użytkownik może oczekiwać moderacji, ale nie nieograniczonego monitorowania prywatnej komunikacji |
| Safeguards | human review dla poważnych sankcji, prawo odwołania, need-to-know, audyt, ograniczony legal hold, brak automatycznego permanentnego profilu „ryzyka” bez podstawy |
| Małoletni | szczególne safeguards i prostsza komunikacja decyzji |
| Wynik | `PASS WITH CONDITIONS / MATERIAL REVIEW REQUIRED` |

Warunek finalny: model dostępu do prywatnych wiadomości dla celów moderacji musi być odrębnie i jawnie rozstrzygnięty; brak ogólnego prawa administratora do rutynowego czytania plaintext prywatnych wiadomości.

---

# 6. LIA-04 — audit i działania uprzywilejowane

| Element | Ocena |
|---|---|
| Interes | rozliczalność, bezpieczeństwo, wykrywanie nadużyć administratora/moderatora, możliwość rekonstrukcji zmian krytycznych |
| Legalność interesu | `YES — PROPOSED` |
| Konieczność | `YES` dla działań uprzywilejowanych, `NO` dla logowania zbędnego payloadu |
| Kategorie danych | actor ID, action, target ID, role history, timestamp, correlation ID |
| Alternatywy | pseudonimizacja, brak pełnego payloadu, krótszy hot retention + kontrolowane archiwum |
| Wpływ | niski dla zwykłego audytu technicznego, wyższy dla długiej retencji personelu/użytkowników |
| Safeguards | append-only/best-effort tam gdzie technicznie możliwe, kontrola dostępu, brak sekretów, brak plaintext prywatnych wiadomości |
| Wynik | `PASS WITH CONDITIONS CANDIDATE` |

Warunek finalny: projektowana maksymalna retencja do 6 lat wymaga odrębnego uzasadnienia dla konkretnych klas audit evidence.

---

# 7. LIA-05 — security telemetry, logi, traces i monitoring

| Element | Ocena |
|---|---|
| Interes | diagnostyka, dostępność, bezpieczeństwo i wykrywanie incydentów |
| Legalność interesu | `YES — PROPOSED` |
| Konieczność | `YES WITH STRONG MINIMIZATION` |
| Kategorie danych | IP/UA gdy potrzebne, correlation IDs, error metadata, request metadata, timestamps |
| Alternatywy | sampling, redaction, pseudonimizacja, agregacja, krótkie retencje |
| Wpływ | umiarkowany, szczególnie jeśli logi pozwalają odtworzyć pełną aktywność użytkownika |
| Safeguards | raw traces 14 dni, app logs 30 dni, security logs 90 dni jako wartości projektowe do review; zakaz message body, tokenów, haseł, MFA secrets i zbędnego PII |
| Wynik | `PASS WITH CONDITIONS CANDIDATE` |

Warunek finalny: każdy przyszły observability provider musi przejść PL-E07/PL-E08 i privacy review.

---

# 8. LIA-06 — minimalny proof / defence of claims

| Element | Ocena |
|---|---|
| Interes | wykazanie wykonania obowiązku, obrona przed roszczeniem, dowód zgody lub żądania privacy tam, gdzie brak innej podstawy szczególnej |
| Legalność interesu | `POSSIBLE / REQUIRES CASE-SPECIFIC REVIEW` |
| Konieczność | `NOT GENERALLY ESTABLISHED` |
| Kategorie danych | minimalne proof metadata, timestamps, HMAC/pseudonymous subject ref, decision/receipt IDs |
| Ryzyko | długotrwałe przechowywanie może prowadzić do nadmiarowej retencji |
| Safeguards | minimalny zakres, brak pełnych dokumentów tożsamości, brak treści prywatnych, jawny retention clock, purge po terminie |
| Wynik | `HOLD FOR CASE-SPECIFIC LEGAL REVIEW` |

Nie wolno używać 6(1)(f) jako uniwersalnego uzasadnienia do zachowania danych „na wszelki wypadek”.

---

# 9. LIA-07 — backup/restore i anti-resurrection

| Element | Ocena |
|---|---|
| Interes | zapewnienie ciągłości działania i bezpiecznego recovery przy jednoczesnym niedopuszczeniu do ponownego aktywowania usuniętych danych |
| Legalność interesu | `YES — PROPOSED` |
| Konieczność | `YES WITH CONDITIONS` |
| Kategorie danych | kopie całych zbiorów zgodnie z backup scope, deletion ledger, restore metadata |
| Alternatywy | krótsze retention backupów, cryptographic expiry, isolated restore, deletion replay |
| Wpływ | wysoki potencjalnie ze względu na zakres backupu |
| Safeguards | 35 dni daily / 12 tygodni weekly / 12 miesięcy monthly jako projekt do review, brak użycia backupu jako zwykłego archiwum, deletion replay przed użyciem restore |
| Wynik | `PASS WITH CONDITIONS CANDIDATE` |

---

## 10. Zasady wspólne

1. `6(1)(f)` nie może zastępować zgody, gdy zgoda jest właściwą podstawą.
2. `6(1)(f)` nie może zastępować konkretnego obowiązku prawnego.
3. Każdy proces oparty na uzasadnionym interesie musi być ujawniony w privacy notice.
4. Użytkownik musi móc wnieść sprzeciw tam, gdzie art. 21 RODO ma zastosowanie.
5. Po sprzeciwie wymagane jest case-specific rozstrzygnięcie, a nie automatyczne ignorowanie sprzeciwu.
6. Dane małoletnich wymagają zaostrzonego balancing test.
7. Brak odrębnego celu = brak podstawy do rozszerzenia zakresu danych.
8. Brak zakończonego LIA = `HOLD` dla procesu, jeśli 6(1)(f) jest jedyną rozważaną podstawą.

---

## 11. Rejestr otwartych warunków

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-E10-O01 | zatwierdzić zakres security telemetry i IP/UA | P1 Privacy/Legal | Privacy/Legal + Security | `OPEN` |
| PL-E10-O02 | zatwierdzić anti-cheat scope i sposób odwołania | P1 Privacy/Legal | Privacy/Legal + Game Platform | `OPEN` |
| PL-E10-O03 | zatwierdzić prywatne wiadomości vs moderation access | P1 Privacy/Legal | Privacy/Legal + Messaging/Moderation | `OPEN` |
| PL-E10-O04 | uzasadnić retencję audit evidence do 6 lat per klasa | P1 Privacy/Legal | Privacy/Legal | `OPEN` |
| PL-E10-O05 | ustalić, które proof/claims faktycznie mogą opierać się na 6(1)(f) | P1 Legal | Privacy/Legal | `OPEN` |
| PL-E10-O06 | wykonać DPIA screening i ocenić kumulację ryzyka | P1 Privacy/Legal | Privacy/Legal | `OPEN` |

---

## 12. Ocena PL-E10

```text
PL-E10 = PASS WITH CONDITIONS

LIA METHOD = ESTABLISHED
SECURITY / ANTI-ABUSE = CONDITIONALLY JUSTIFIED
GAME INTEGRITY = CONDITIONALLY JUSTIFIED
MODERATION = CONDITIONALLY JUSTIFIED / MATERIAL REVIEW REQUIRED
AUDIT = CONDITIONALLY JUSTIFIED
TELEMETRY = CONDITIONALLY JUSTIFIED
CLAIMS / PROOF = HOLD FOR CASE-SPECIFIC REVIEW
BACKUP / RESTORE = CONDITIONALLY JUSTIFIED
DPIA SCREENING = STILL REQUIRED
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

Pełny `PASS` wymaga zamknięcia wszystkich materialnych warunków i zgodności z privacy notice, ROPA, retencją, modelem małoletnich oraz DPIA screening.

---

## 13. Granica autoryzacji

Utworzenie LIA:

- nie zatwierdza automatycznie żadnego procesu produkcyjnego,
- nie autoryzuje profilowania,
- nie zezwala na rozszerzenie telemetry,
- nie autoryzuje implementacji ani deploymentu,
- nie zdejmuje freeze.

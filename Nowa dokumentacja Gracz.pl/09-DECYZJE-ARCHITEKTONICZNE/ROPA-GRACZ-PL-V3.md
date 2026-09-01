# Gracz.pl V3 — Rejestr czynności przetwarzania (ROPA)

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`  

> Ten dokument jest rejestrem czynności przetwarzania / równoważną mapą ROPA dla Gracz.pl V3. Jest artefaktem governance i dokumentacji. Nie stanowi porady prawnej, nie potwierdza wdrożenia technicznego i nie autoryzuje implementacji, deploymentu ani zmian produkcyjnych. Pola oznaczone `PROPOSED`, `PENDING` lub `TO VERIFY` wymagają formalnego rozstrzygnięcia w review ADR-V3-012.

---

## 1. Administrator

| Pole | Wartość |
|---|---|
| Administrator | **Czesław Socha — osoba fizyczna prowadząca projekt Gracz.pl we własnym imieniu** |
| Projekt / serwis | `Gracz.pl` |
| Rola governance | Project Owner / Documentation Owner / Privacy-Legal Decision Owner |
| Jurysdykcja review | Polska / Unia Europejska — RODO/GDPR |
| Adres do kontaktu | `PENDING — do ustalenia przed publikacją privacy notice` |
| E-mail do spraw privacy | `PENDING — do ustalenia przed produkcyjnym uruchomieniem V3` |
| IOD/DPO | `NOT APPOINTED / REQUIREMENT TO BE ASSESSED` |
| Data ostatniego przeglądu | 01.09.2026 |
| Następny przegląd | przed `ADR-V3-012 ACCEPTED / FINAL`, następnie co najmniej raz na 12 miesięcy oraz po materialnej zmianie celu, providera, transferu, kategorii danych lub retencji |

Administrator ustala cele i sposoby przetwarzania danych w ramach projektu Gracz.pl. Dane kontaktowe przeznaczone do obowiązku informacyjnego muszą zostać uzupełnione przed produkcyjnym uruchomieniem modelu V3.

---

## 2. Status podstaw prawnych

Podstawy prawne w tabelach niżej są **propozycją projektową do formalnego Privacy/Legal review**. Nie są jeszcze zatwierdzoną opinią prawną.

Oznaczenia:

- `6(1)(b) PROPOSED` — wykonanie umowy / świadczenie usługi na żądanie użytkownika;
- `6(1)(a) PROPOSED` — zgoda, gdy proces rzeczywiście opiera się na zgodzie;
- `6(1)(c) PROPOSED` — obowiązek prawny, wyłącznie gdy konkretny obowiązek zostanie wskazany;
- `6(1)(f) PROPOSED / LIA REQUIRED` — prawnie uzasadniony interes, wymagający udokumentowanego balancing/LIA;
- `PENDING LEGAL REVIEW` — podstawa nie może zostać przesądzona przez dokumentację techniczną.

---

## 3. Kategorie osób, których dane dotyczą

ROPA obejmuje potencjalnie następujące kategorie osób:

1. zarejestrowani użytkownicy Gracz.pl;
2. użytkownicy oczekujący na rejestrację lub potwierdzenie adresu e-mail;
3. gracze uczestniczący w meczach, rankingach i turniejach;
4. nadawcy i odbiorcy wiadomości prywatnych;
5. użytkownicy publicznego chatu i funkcji społecznościowych;
6. subskrybenci newslettera;
7. osoby zgłaszające naruszenia i osoby objęte moderacją;
8. osoby składające żądania privacy/RODO;
9. administratorzy/moderatorzy/operatorzy systemu w zakresie zdarzeń audytowych;
10. użytkownicy małoletni — **PENDING OWNER DECISION; model wieku i zgód nie jest jeszcze zatwierdzony**.

---

## 4. Klasy danych

| Klasa | Przykłady | Zasada |
|---|---|---|
| `PUBLIC` | publiczny profil, ranking, publiczny chat | publikacja kontrolowana, moderacja, retencja |
| `INTERNAL` | identyfikatory techniczne, statusy workerów, correlation IDs | need-to-know, ograniczona ekspozycja |
| `PERSONAL` | e-mail, login, profil, historia aktywności | cel, podstawa, retencja, prawa osoby, kontrola dostępu |
| `SENSITIVE` w rozumieniu projektu | MFA, security signals, prywatne wiadomości | szyfrowanie, ścisły dostęp, audyt, minimalizacja; nie oznacza automatycznie szczególnej kategorii z art. 9 RODO |
| `EVIDENCE` | audit, consent proof, moderation evidence, privacy request proof | integralność, ograniczony dostęp, hold-aware purge |
| `SECRET` | klucze, tokeny, credentiale | secret store, zakaz logowania i umieszczania w evidence |
| `ANONYMIZED` | statystyki bez racjonalnej możliwości reidentyfikacji | brak mapy zwrotnej/reidentyfikacyjnej |

---

# 5. Rejestr czynności przetwarzania

## ROPA-01 — Konto, rejestracja i profil użytkownika

| Pole | Wartość |
|---|---|
| Cel | utworzenie i utrzymanie konta, logowanie do serwisu, prezentacja profilu, zarządzanie preferencjami i lifecycle konta |
| Kategorie osób | użytkownicy zarejestrowani i rejestrujący się |
| Kategorie danych | identyfikator użytkownika, login/nazwa, e-mail, hash hasła/credential metadata, status konta, dane profilu, timestamps, ustawienia |
| Klasy | `PERSONAL`, częściowo `PUBLIC`, `SECRET` dla credentiali |
| Podstawa | `art. 6(1)(b) PROPOSED`; dla wybranych funkcji opcjonalnych możliwa zgoda lub inna podstawa — `PENDING LEGAL REVIEW` |
| Odbiorcy / procesorzy | hosting/runtime i PostgreSQL: **Render — TO VERIFY CONTRACT/DPA/REGION**; Edge/DNS/TLS: **Cloudflare — zakres danych i rola TO VERIFY** |
| Transfer poza EOG | `TO VERIFY` na podstawie konfiguracji regionu, DPA, subprocessors i mechanizmów transferowych providerów |
| Retencja | aktywne konto — do usunięcia konta; po zweryfikowanym żądaniu maks. 30 dni w aktywnych systemach; publiczna widoczność po rozpoczęciu delete maks. 24 h |
| Akcja końcowa | privacy workflow: purge lub nieodwracalna anonimizacja zależnie od domeny; natychmiastowe zablokowanie dalszego auth po wejściu w delete workflow |
| Środki bezpieczeństwa | hashe credentiali, RBAC/MFA, minimalizacja, kontrola dostępu, audyt, szyfrowanie transportowe; szczegóły implementacyjne wymagają dowodu operacyjnego |
| Owner | Privacy/Legal Decision Owner + Identity & Access owner techniczny |
| Status | `OPEN / FORMAL REVIEW REQUIRED` |

## ROPA-02 — Uwierzytelnianie, sesje, MFA i bezpieczeństwo konta

| Pole | Wartość |
|---|---|
| Cel | bezpieczne uwierzytelnianie, utrzymanie sesji, recovery, MFA, wykrywanie nadużyć i zdarzeń bezpieczeństwa |
| Kategorie osób | użytkownicy, administratorzy/moderatorzy korzystający z uwierzytelniania |
| Kategorie danych | hashe haseł, identyfikatory sesji, token hashes, MFA secrets, security events, IP/UA tam gdzie niezbędne, timestamps |
| Klasy | `SECRET`, `SENSITIVE`, `EVIDENCE`, `PERSONAL` |
| Podstawa | świadczenie i zabezpieczenie usługi: `6(1)(b) PROPOSED`; bezpieczeństwo/nadużycia: `6(1)(f) PROPOSED / LIA REQUIRED`; obowiązki prawne wyłącznie jeśli wskazane — `PENDING` |
| Odbiorcy / procesorzy | Render/PostgreSQL; Cloudflare w zakresie edge/security telemetry — `TO VERIFY`; ewentualny provider MFA/e-mail — `PENDING PROVIDER SELECTION` |
| Transfer poza EOG | `TO VERIFY` |
| Retencja | MFA secrets i aktywne credentiale po zweryfikowanym delete: natychmiast, cel operacyjny 24 h; sesje: 30 dni po expiry/revoke/delete; reset/registration/public token metadata: 7 dni; security events: 12 miesięcy |
| Akcja końcowa | revoke + purge / cryptographic erase; security events — purge lub anonimowa agregacja |
| Środki bezpieczeństwa | secret store, zakaz logowania sekretów, rotacja kluczy, RBAC/MFA, audit, correlation IDs bez zbędnego PII |
| Owner | Identity & Access / Security |
| Status | `OPEN / LIA AND PROVIDER VERIFICATION REQUIRED` |

## ROPA-03 — Gry, mecze, wyniki, ranking i turnieje

| Pole | Wartość |
|---|---|
| Cel | organizacja rozgrywek, zapis wyników i historii meczu, ranking, turnieje, rozwiązywanie sporów związanych z rozgrywką |
| Kategorie osób | gracze, uczestnicy turniejów |
| Kategorie danych | user/game IDs, match IDs, ruchy, eventy, snapshoty, wyniki, rating/ranking, uczestnictwo turniejowe, timestamps |
| Klasy | `PERSONAL`, `PUBLIC`, `INTERNAL`; po prawidłowej anonimizacji `ANONYMIZED` |
| Podstawa | `6(1)(b) PROPOSED`; integralność rankingu/spory i bezpieczeństwo: możliwe `6(1)(f) PROPOSED / LIA REQUIRED` |
| Odbiorcy / procesorzy | Render/PostgreSQL; publiczni użytkownicy wyłącznie dla jawnych projekcji profilu/rankingu; inne providery `PENDING` |
| Transfer poza EOG | `TO VERIFY` |
| Retencja | zakończone game/match events z identyfikatorem: 36 miesięcy; snapshoty: 90 dni; tournament history z ID: 36 miesięcy; bieżący ranking: aktywne konto + 30 dni |
| Akcja końcowa | nieodwracalna anonimizacja identyfikatorów lub purge; anonimowy replay/agregat może pozostać bezterminowo tylko przy potwierdzonej anonimowości i przeglądzie ryzyka reidentyfikacji co 12 miesięcy |
| Środki bezpieczeństwa | autoryzacja, spójność i wersjonowanie, ograniczenie danych publicznych, audit, brak sekretów w historii |
| Owner | Game Platform / Match Runtime / Tournament |
| Status | `OPEN / RETENTION AND LAWFUL BASIS REVIEW REQUIRED` |

## ROPA-04 — Prywatne wiadomości, załączniki, publiczny chat i social

| Pole | Wartość |
|---|---|
| Cel | komunikacja pomiędzy użytkownikami, publiczna komunikacja społecznościowa, relacje social, moderacja treści i obsługa zgłoszeń |
| Kategorie osób | nadawcy, odbiorcy, użytkownicy chatu/social, osoby zgłaszające i zgłaszane |
| Kategorie danych | message metadata, szyfrowany payload wiadomości, treść publicznego chatu, metadane załączników, relacje social, reakcje, timestamps, moderation links |
| Klasy | `SENSITIVE` projektowo dla prywatnych wiadomości, `PERSONAL`, `PUBLIC`, `EVIDENCE` |
| Podstawa | komunikacja jako funkcja usługi: `6(1)(b) PROPOSED`; moderacja/ochrona społeczności: `6(1)(f) PROPOSED / LIA REQUIRED`; inne podstawy `PENDING LEGAL REVIEW` |
| Odbiorcy / procesorzy | właściwy odbiorca wiadomości; publiczni użytkownicy dla treści jawnie publicznych; Render/PostgreSQL; object storage dla załączników — `PROVIDER NOT YET APPROVED`; Cloudflare w warstwie transport/edge — `TO VERIFY` |
| Transfer poza EOG | `TO VERIFY` |
| Retencja | private message: 36 miesięcy; po delete obu stron: 30 dni grace; po delete jednej strony: do końca retencji drugiej strony z pseudonimizacją usuniętej strony; publiczny chat body: 12 miesięcy; chat edit/delete events: 24 miesiące; usunięte reakcje/relacje: 30 dni |
| Akcja końcowa | physical purge, minimalizacja lub nieodwracalna anonimizacja zgodnie z party-state i aktywnym hold |
| Środki bezpieczeństwa | szyfrowanie prywatnych wiadomości, ścisła autoryzacja nadawca/odbiorca, zakaz plaintext wiadomości w audit/outbox/logs/evidence JSON, kontrola załączników |
| Owner | Messaging / Global Chat & Social / Moderation |
| Status | `OPEN / PROVIDER, ACCESS MODEL AND LEGAL REVIEW REQUIRED` |

## ROPA-05 — Newsletter, zgody i komunikacja e-mail

| Pole | Wartość |
|---|---|
| Cel | zapis i obsługa newslettera, potwierdzenie subskrypcji, wysyłka, unsubscribe, dowód zgody, diagnostyka dostarczenia |
| Kategorie osób | subskrybenci newslettera i osoby w pending confirmation |
| Kategorie danych | e-mail, status subskrypcji, consent event/proof, token metadata, provider delivery telemetry, campaign/lifecycle timestamps |
| Klasy | `PERSONAL`, `EVIDENCE`, `SECRET` dla tokenów |
| Podstawa | `6(1)(a) PROPOSED` dla zgody marketingowej/newslettera; proof/defence/anti-abuse może wymagać odrębnej podstawy — `PENDING LEGAL REVIEW` |
| Odbiorcy / procesorzy | provider poczty/newslettera — `PENDING PROVIDER IDENTIFICATION`; Render/PostgreSQL |
| Transfer poza EOG | `PENDING PROVIDER / TO VERIFY` |
| Retencja | pending confirmation: 30 dni; public token metadata: 7 dni; unsubscribed current record: 24 miesiące; consent proof: projektowo 6 lat; lifecycle analytics: 24 miesiące; provider telemetry: 13 miesięcy |
| Akcja końcowa | purge lub anonimizacja/minimalizacja; unsubscribe ma natychmiast zatrzymać przyszłe wysyłki marketingowe |
| Środki bezpieczeństwa | double opt-in / lifecycle evidence zgodnie z zatwierdzonym modelem, tokeny niejawne, minimalizacja telemetry, audyt zdarzeń zgody |
| Owner | Newsletter / Privacy-Legal |
| Status | `OPEN / CONSENT MODEL AND PROVIDER REVIEW REQUIRED` |

## ROPA-06 — Moderacja, sankcje, audit i zdarzenia bezpieczeństwa

| Pole | Wartość |
|---|---|
| Cel | ochrona użytkowników i platformy, egzekwowanie regulaminu, obsługa zgłoszeń i odwołań, rozliczalność operacji uprzywilejowanych, wykrywanie incydentów |
| Kategorie osób | użytkownicy zgłaszający i zgłaszani, moderatorzy, administratorzy, użytkownicy objęci security event |
| Kategorie danych | case/action/appeal, reason codes, sankcje, minimalne evidence, audit actor/target IDs, security events, timestamps |
| Klasy | `EVIDENCE`, `PERSONAL`, `SENSITIVE` projektowo, `INTERNAL` |
| Podstawa | `6(1)(f) PROPOSED / LIA REQUIRED`; ewentualne obowiązki prawne i roszczenia — `PENDING LEGAL REVIEW` |
| Odbiorcy / procesorzy | uprawnieni moderatorzy/admini; Render/PostgreSQL; organy publiczne wyłącznie gdy istnieje właściwa podstawa i procedura — `PENDING PROCEDURE` |
| Transfer poza EOG | `TO VERIFY` |
| Retencja | moderation case/action/appeal: 36 miesięcy; moderation evidence: 36 miesięcy domyślnie; zakończone sankcje: 36 miesięcy; privileged audit/role history: 24 mies. hot + 48 mies. archive, łącznie 6 lat; security events: 12 miesięcy |
| Akcja końcowa | purge/minimalizacja; legal hold może czasowo wstrzymać purge wyłącznie w określonym zakresie |
| Środki bezpieczeństwa | append-only / tamper-resistant design, RBAC, audit dostępu, szyfrowanie evidence, zakaz zbędnego plaintext PII |
| Owner | Moderation / Audit / Security |
| Status | `OPEN / LIA, CLAIMS BASIS AND LEGAL HOLD REVIEW REQUIRED` |

## ROPA-07 — Realizacja praw osób i privacy request evidence

| Pole | Wartość |
|---|---|
| Cel | przyjęcie, weryfikacja, wykonanie i udokumentowanie żądań dostępu, eksportu, usunięcia, ograniczenia i sprostowania |
| Kategorie osób | osoby składające żądanie dotyczące ich danych |
| Kategorie danych | request ID, request type, subject reference HMAC, status, timestamps, policy version, exception code, receipts; bez kopiowania dokumentu tożsamości w zwykłym rekordzie |
| Klasy | `EVIDENCE`, `PERSONAL`, `INTERNAL` |
| Podstawa | `6(1)(c) PROPOSED` w zakresie wykonywania obowiązków RODO; zachowanie proof/roszczenia wymaga odrębnego potwierdzenia `PENDING LEGAL REVIEW` |
| Odbiorcy / procesorzy | osoby uprawnione do obsługi privacy; Render/PostgreSQL; processorzy realizujący delete/export wyłącznie według udokumentowanych instrukcji |
| Transfer poza EOG | zależnie od processorów — `TO VERIFY` |
| Retencja | privacy request evidence: projektowo 6 lat od completion; privacy tombstone anty-abuse: 24 miesiące |
| Akcja końcowa | minimalny proof po zakończeniu, następnie purge; tombstone tylko keyed HMAC + reason class, bez zbędnych identyfikatorów |
| Środki bezpieczeństwa | osobny privacy salt poza bazą, idempotentny orchestrator, receipts, deadline, restriction, audit, negative validation |
| Owner | Privacy-Legal / Privacy Request Orchestrator |
| Status | `OPEN / LEGAL RETENTION JUSTIFICATION REQUIRED` |

## ROPA-08 — Logi, tracing, metryki, outbox i idempotency

| Pole | Wartość |
|---|---|
| Cel | diagnostyka, niezawodność, bezpieczeństwo, retry/publikacja zdarzeń, ochrona przed podwójnym wykonaniem komendy i analiza incydentów |
| Kategorie osób | użytkownicy i operatorzy, jeśli ich identyfikatory pojawiają się w technicznych zdarzeniach |
| Kategorie danych | correlation/causation IDs, actor IDs w minimalnym zakresie, event metadata, IP/UA jeśli konieczne, logi błędów, trace metadata, idempotency records, outbox metadata |
| Klasy | `INTERNAL`, `PERSONAL` zależnie od identyfikowalności, `EVIDENCE` dla security/audit |
| Podstawa | `6(1)(f) PROPOSED / LIA REQUIRED`; elementy niezbędne do wykonania usługi mogą być związane z `6(1)(b) PROPOSED`; final mapping `PENDING` |
| Odbiorcy / procesorzy | Render/runtime; observability provider — `PENDING PROVIDER SELECTION/VERIFICATION`; Cloudflare telemetry w zakresie edge — `TO VERIFY` |
| Transfer poza EOG | `TO VERIFY` |
| Retencja | completed outbox: 30 dni; failed/dead-letter outbox: 90 dni; idempotency: 30 dni, 90 dni dla game/tournament/admin; application logs: 30 dni; security logs: 90 dni; raw traces: 14 dni; anonimowe agregowane metryki: 13 miesięcy |
| Akcja końcowa | purge lub dalsza anonimowa agregacja bez ID |
| Środki bezpieczeństwa | redakcja PII/secrets, zakaz plaintext private messages, ograniczony dostęp, correlation IDs, alerty, retencja provider-side zgodna z polityką |
| Owner | Platform / Observability / Security |
| Status | `OPEN / PROVIDER AND LIA REVIEW REQUIRED` |

## ROPA-09 — Backup, restore i deletion propagation

| Pole | Wartość |
|---|---|
| Cel | odporność, disaster recovery, odtworzenie po awarii oraz zachowanie skutków prawidłowo wykonanych usunięć po restore |
| Kategorie osób | wszystkie osoby, których dane znajdują się w systemach objętych backupem |
| Kategorie danych | kopie danych produkcyjnych w zakresie objętym snapshotem/backupem, deletion ledger, minimalne restore evidence |
| Klasy | odpowiadają klasom danych źródłowych; backup nie zmienia klasy ani podstawy prawnej |
| Podstawa | ciągłość i bezpieczeństwo usługi: `6(1)(f) PROPOSED / LIA REQUIRED` oraz art. 32 jako wymóg bezpieczeństwa do uwzględnienia w modelu; finalna podstawa `PENDING LEGAL REVIEW` |
| Odbiorcy / procesorzy | provider bazy/backup storage — Render i/lub wybrany storage provider `TO VERIFY`; dostęp tylko dla uprawnionych operatorów |
| Transfer poza EOG | `TO VERIFY` według fizycznej lokalizacji i subprocessors backupu |
| Retencja | backup dzienny: 35 dni; tygodniowy: 12 tygodni; miesięczny: 12 miesięcy; izolowane środowisko restore: maks. 7 dni po zakończeniu testu |
| Akcja końcowa | natural expiry / cryptographic lub physical deletion; po restore obowiązkowy replay deletion ledger i aktywnych holds przed użyciem środowiska |
| Środki bezpieczeństwa | szyfrowanie, kontrola dostępu, izolacja restore, cleanup evidence, anti-resurrection, deletion replay, audit restore |
| Owner | Platform / DR / Privacy-Legal |
| Status | `OPEN / OPERATIONAL EVIDENCE NONE / PROCESSOR VERIFICATION REQUIRED` |

---

## 6. Odbiorcy, procesorzy i subprocessors — rejestr roboczy

| Podmiot / kategoria | Rola projektowa | Zakres danych | Status Privacy/Legal |
|---|---|---|---|
| Render | hosting/runtime/PostgreSQL/backup zależnie od faktycznej konfiguracji | dane aplikacyjne i techniczne hostowane w usłudze | `TO VERIFY: contract, DPA, region, subprocessors, deletion/backup terms, transfers` |
| Cloudflare | DNS/TLS/edge/security | adresy IP, nagłówki i ruch edge w zakresie wynikającym z konfiguracji | `TO VERIFY: role, DPA, logs, region/transfers, retention` |
| GitHub | repozytorium kodu i dokumentacji | co do zasady nie powinien otrzymywać produkcyjnych danych użytkowników; może przechowywać dane developerów/contributors i artefakty projektowe | `BOUNDARY: NO PRODUCTION PII/SECRETS IN REPO; provider terms TO VERIFY if personal data used` |
| Provider poczty/newslettera | delivery e-mail/newsletter | e-mail, delivery metadata, campaign identifiers | `PENDING PROVIDER SELECTION / DPA / TRANSFER REVIEW` |
| Object storage załączników | załączniki prywatnych wiadomości i metadata | pliki użytkowników i metadane | `PENDING PROVIDER SELECTION / DPA / REGION / RETENTION` |
| Observability provider | logi/metryki/traces/alerty | techniczne identyfikatory, potencjalnie personal data w ograniczonym zakresie | `PENDING PROVIDER SELECTION / DPA / REDACTION / RETENTION / TRANSFER REVIEW` |

**Zasada:** żaden provider nie może otrzymać szerszego zakresu danych niż niezbędny do jego roli. Sekrety, plaintext prywatnych wiadomości i zbędne PII są zakazane w logach, audit evidence i artefaktach approval.

---

## 7. Transfery do państw trzecich

Stan: **NOT YET VERIFIED**.

Przed końcowym `PASS` wymagane jest dla każdego procesora/subprocessora:

1. ustalenie roli i faktycznej lokalizacji przetwarzania;
2. weryfikacja listy subprocessors;
3. ustalenie, czy dochodzi do transferu poza EOG;
4. wskazanie mechanizmu transferowego, jeśli wymagany;
5. udokumentowanie wymaganego assessmentu i safeguards;
6. zapisanie wersji DPA/terms i daty review;
7. potwierdzenie retencji, usuwania i zachowania backupów po zakończeniu usługi.

Do czasu wykonania powyższego `PL-E06/PL-E07` nie mogą zostać oznaczone jako bezwarunkowy `PASS`.

---

## 8. Ogólne środki bezpieczeństwa ROPA

Projekt V3 wymaga co najmniej:

- TLS na warstwie transportowej;
- szyfrowania danych wrażliwych zgodnie z klasą;
- dedykowanych kluczy dla obszarów wymagających separacji oraz rotacji kluczy;
- RBAC i MFA dla operacji uprzywilejowanych;
- principle of least privilege i need-to-know;
- zakazu sekretów i plaintext prywatnych wiadomości w logach/audit/outbox/evidence;
- redakcji PII w telemetry;
- audytu operacji uprzywilejowanych;
- idempotentnych workflow privacy;
- deletion ledger i receipts;
- legal hold z `scope`, `reason`, ownerem, `review_at` i `expires_at`;
- anti-resurrection po restore;
- automatycznego lub kontrolowanego enforcementu retencji po zaakceptowaniu polityki;
- testów usunięcia, restriction, anonymization, restore i backup deletion propagation;
- incident/breach handling jako odrębnej kontrolowanej procedury.

Status implementacyjny środków nie jest przez ten ROPA potwierdzany. ROPA zapisuje wymagany model i musi być uzupełniany dowodami operacyjnymi.

---

## 9. Legal hold

Legal hold może wstrzymać wyłącznie purge danych objętych konkretnym, udokumentowanym celem. Minimalny rekord hold musi zawierać:

- jednoznaczny zakres;
- reason/legal basis reference;
- ownera;
- datę utworzenia;
- obowiązkowe `review_at`;
- obowiązkowe `expires_at` albo jawnie uzasadniony tryb ponownej autoryzacji;
- audit dostępu i eksportu;
- procedurę zwolnienia hold i ponownej oceny purge.

Backup nie jest archiwum legal hold. Zwolnienie hold uruchamia ponowną ocenę eligibility for purge.

Status prawny katalogu powodów hold: **PENDING LEGAL REVIEW**.

---

## 10. Małoletni

Stan: **HOLD / OWNER DECISION REQUIRED**.

Przed dopuszczeniem modelu obejmującego osoby małoletnie należy zatwierdzić co najmniej:

- minimalny wiek użytkownika;
- czy Gracz.pl oferuje usługę bezpośrednio dzieciom;
- model zgody/autoryzacji opiekuna, jeżeli wymagany;
- age assurance bez nadmiernego zbierania danych;
- ograniczenia profilu, chatu, prywatnych wiadomości, matchmakingu i publicznej widoczności;
- wynik DPIA screening i — jeżeli wymagane — DPIA;
- dostosowaną warstwę obowiązku informacyjnego.

Do czasu jawnej decyzji właściciela finalny ADR-V3-012 pozostaje `HOLD`.

---

## 11. DPIA i LIA

| Artefakt | Status |
|---|---|
| DPIA screening | `PENDING` |
| DPIA | `NOT DETERMINED — DEPENDS ON SCREENING` |
| LIA dla bezpieczeństwa/anti-abuse | `PENDING` |
| LIA dla moderacji | `PENDING` |
| LIA dla technical logging/observability | `PENDING` |
| LIA dla części retention/claims | `PENDING` |

Wpis `6(1)(f) PROPOSED` w ROPA nie jest akceptacją podstawy bez wykonania odpowiedniej analizy interesu, konieczności i równowagi praw użytkownika.

---

## 12. Procedury praw osób — wymagany zakres

ROPA odwołuje się do docelowej procedury obejmującej:

- dostęp do danych;
- sprostowanie;
- usunięcie;
- ograniczenie przetwarzania;
- sprzeciw;
- eksport/przenoszenie, jeśli ma zastosowanie;
- weryfikację tożsamości proporcjonalną do ryzyka;
- discovery wszystkich bounded contexts;
- receipts per context;
- obsługę wyjątków i legal hold;
- potwierdzenie wykonania oraz negative validation po purge;
- replay deletion ledger po restore.

Status: `PARTIAL / DESIGN ONLY — PROCEDURE EVIDENCE REQUIRED`.

---

## 13. Zasady aktualizacji ROPA

ROPA podlega aktualizacji przed lub niezwłocznie po materialnej zmianie w co najmniej jednym z obszarów:

- nowy cel przetwarzania;
- nowa kategoria danych lub osób;
- nowy provider/procesor/subprocessor;
- nowy transfer poza EOG;
- zmiana retencji lub terminal action;
- uruchomienie nowej gry/funkcji społecznościowej zmieniającej zakres danych;
- zmiana modelu małoletnich;
- zmiana modelu reklamowego/analitycznego;
- decyzja DPIA/LIA;
- istotna zmiana security architecture;
- zmiana administratora lub danych kontaktowych.

Każda wersja musi mieć: datę, autora/ownera, powód zmiany, powiązanie z decyzją i zachowaną historię zmian w Git.

---

## 14. Otwarte działania przed bezwarunkowym PASS

| ID | Priorytet | Działanie | Owner |
|---|---|---|---|
| ROPA-A01 | P1 | uzupełnić publiczne dane kontaktowe administratora do privacy notice | Privacy/Legal Owner |
| ROPA-A02 | P1 | zweryfikować Render: DPA, region, subprocessors, retention, backup/delete, transfers | Privacy/Legal Owner |
| ROPA-A03 | P1 | zweryfikować Cloudflare: rola, DPA, logging, subprocessors i transfery | Privacy/Legal Owner |
| ROPA-A04 | P1 | wskazać i zweryfikować providera poczty/newslettera | Privacy/Legal Owner |
| ROPA-A05 | P1 | wskazać i zweryfikować object storage dla załączników, jeśli będzie używany | Architecture + Privacy/Legal |
| ROPA-A06 | P1 | wskazać i zweryfikować observability provider, jeśli będzie używany | Architecture + Privacy/Legal |
| ROPA-A07 | P1 | wykonać DPIA screening | Privacy/Legal Owner |
| ROPA-A08 | P1 | wykonać wymagane LIA dla procesów opartych na art. 6(1)(f), jeśli ta podstawa zostanie utrzymana | Privacy/Legal Owner |
| ROPA-A09 | P1 | zatwierdzić model małoletnich | Project Owner / Privacy-Legal Owner |
| ROPA-A10 | P1 | zatwierdzić katalog podstaw, celów i okresów retencji PL-R01–PL-R09 | Privacy/Legal Owner |
| ROPA-A11 | P1 | przygotować/zweryfikować privacy notice i procedury praw osób | Privacy/Legal Owner |
| ROPA-A12 | P1 | udokumentować DPA/instrukcje delete-return dla wszystkich procesorów | Privacy/Legal Owner |

---

## 15. Wpływ na formalny review ADR-V3-012

Po utworzeniu niniejszego artefaktu:

```text
PL-E02 — CURRENT ROPA / EQUIVALENT PROCESSING MAP
STATUS = PASS WITH CONDITIONS
EVIDENCE = 09-DECYZJE-ARCHITEKTONICZNE/ROPA-GRACZ-PL-V3.md
CONDITIONS = provider/transfer verification + legal basis/LIA/DPIA/minors/privacy notice review
```

To rozstrzygnięcie nie zmienia automatycznie statusów `PL-E03–PL-E16`, `PL-R01–PL-R09` ani `PL-C01–PL-C20` i nie podnosi całego ADR-V3-012 do `PASS`.

---

## 16. Status końcowy dokumentu

```text
ROPA ARTIFACT = CREATED / VERSIONED
ROPA VERSION = 0.1
ADMINISTRATOR = CZESŁAW SOCHA — PERSON / PROJECT OWNER
PL-E02 = PASS WITH CONDITIONS
LEGAL BASES = PROPOSED / FORMAL REVIEW PENDING
PROCESSOR INVENTORY = PARTIAL / VERIFICATION REQUIRED
THIRD-COUNTRY TRANSFERS = NOT YET VERIFIED
MINORS MODEL = HOLD / OWNER DECISION REQUIRED
DPIA SCREENING = PENDING
LIA = PENDING WHERE APPLICABLE
IMPLEMENTATION = NOT AUTHORIZED
DEPLOYMENT = NOT AUTHORIZED
FREEZE = ACTIVE
```

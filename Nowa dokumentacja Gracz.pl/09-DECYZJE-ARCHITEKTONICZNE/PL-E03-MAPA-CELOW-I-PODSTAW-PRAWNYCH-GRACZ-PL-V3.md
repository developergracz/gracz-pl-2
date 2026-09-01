# Gracz.pl V3 — PL-E03 Mapa celów i podstaw prawnych przetwarzania

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E03`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Ten dokument jest formalnym artefaktem evidence dla PL-E03. Mapuje cele przetwarzania na proponowane podstawy prawne. Nie jest poradą prawną ani automatycznym zatwierdzeniem podstaw prawnych. Wszędzie, gdzie wskazano `PROPOSED`, `LIA REQUIRED`, `PENDING` lub `TO VERIFY`, wymagane jest formalne rozstrzygnięcie Privacy/Legal Decision Ownera, a gdy potrzebna jest profesjonalna interpretacja prawna — konsultacja specjalisty przed oznaczeniem punktu jako `PASS`.

---

## 1. Administrator i zakres

| Pole | Wartość |
|---|---|
| Administrator | **Czesław Socha — osoba fizyczna prowadząca projekt Gracz.pl we własnym imieniu** |
| Projekt / usługa | `Gracz.pl` |
| Jurysdykcja review | Polska / Unia Europejska — RODO/GDPR |
| Decision Owner | Czesław Socha — Project Owner / Documentation Owner / Privacy-Legal Decision Owner |
| Zakres | konta, uwierzytelnianie, gry, ranking, turnieje, wiadomości, chat/social, newsletter, moderacja, audit, privacy requests, logi/telemetry, backup/restore |
| Status implementacji | `NOT AUTHORIZED / FREEZE ACTIVE` |

---

## 2. Reguły mapowania

1. Każdy cel musi mieć jedną lub więcej jawnie wskazanych podstaw prawnych.
2. `art. 6(1)(b) PROPOSED` oznacza, że przetwarzanie jest projektowo traktowane jako niezbędne do wykonania usługi lub działań na żądanie użytkownika; wymaga końcowego review zakresu niezbędności.
3. `art. 6(1)(a) PROPOSED` oznacza zgodę; zgoda musi być dobrowolna, konkretna, świadoma, jednoznaczna i możliwa do wycofania bez negatywnego wpływu na przetwarzanie, które nie zależy od zgody.
4. `art. 6(1)(f) PROPOSED / LIA REQUIRED` oznacza prawnie uzasadniony interes; przed `PASS` wymagany jest udokumentowany LIA/balancing test.
5. `art. 6(1)(c) PENDING` może być użyte tylko wtedy, gdy zostanie wskazany konkretny obowiązek prawny mający zastosowanie do administratora.
6. Dane nie mogą być używane dla nowego, niezgodnego celu bez odrębnej oceny zgodności i aktualizacji ROPA, privacy notice oraz retencji.
7. Podstawa prawna nie może być dobierana „po fakcie” wyłącznie dla uzasadnienia istniejącego przetwarzania.

---

# 3. Mapa celów i podstaw prawnych

## PL-E03-01 — Rejestracja i prowadzenie konta

| Element | Wartość |
|---|---|
| Cel główny | utworzenie konta, utrzymanie profilu, umożliwienie logowania i korzystania z podstawowych funkcji serwisu |
| Kategorie danych | login/nazwa, e-mail, identyfikator użytkownika, status konta, ustawienia, dane profilu, timestamps, credential metadata |
| Podstawa projektowa | `art. 6(1)(b) PROPOSED` |
| Uzasadnienie | bez przetworzenia minimalnych danych konta nie jest możliwe świadczenie spersonalizowanej usługi użytkownikowi zalogowanemu |
| Warunek PASS | potwierdzić, że zakres danych obowiązkowych jest ograniczony do danych rzeczywiście niezbędnych; elementy opcjonalne muszą mieć własny cel/podstawę |
| Status | `PASS WITH CONDITIONS CANDIDATE / FORMAL OWNER DECISION PENDING` |

## PL-E03-02 — Uwierzytelnianie, sesje, recovery i MFA

| Element | Wartość |
|---|---|
| Cel główny | uwierzytelnienie użytkownika, utrzymanie sesji, odzyskiwanie dostępu, MFA, ochrona konta |
| Kategorie danych | hash hasła, session/token IDs i hashe, MFA secrets, recovery metadata, timestamps, wybrane security signals |
| Podstawa projektowa | `art. 6(1)(b) PROPOSED` dla działania usługi; `art. 6(1)(f) PROPOSED / LIA REQUIRED` dla części bezpieczeństwa i anti-abuse |
| Uzasadnienie | bezpieczeństwo uwierzytelniania jest konieczne do świadczenia usługi; dodatkowe mechanizmy anti-abuse wymagają oceny proporcjonalności |
| Warunek PASS | LIA dla przetwarzania opartego na 6(1)(f); minimalizacja IP/UA/security telemetry; rozdzielenie secretów od zwykłego PII |
| Status | `HOLD UNTIL LIA FOR 6(1)(f)` |

## PL-E03-03 — Rozgrywki, mecze i historia gry

| Element | Wartość |
|---|---|
| Cel główny | przeprowadzenie rozgrywki, zapis stanu i wyniku, obsługa reconnect/replay, integralność rozgrywki |
| Kategorie danych | user/game/match IDs, ruchy, eventy, snapshoty, wynik, timestamps |
| Podstawa projektowa | `art. 6(1)(b) PROPOSED`; dla przeciwdziałania nadużyciom/sporom możliwe `art. 6(1)(f) PROPOSED / LIA REQUIRED` |
| Uzasadnienie | dane meczu są niezbędne do realizacji usługi gry; dłuższa retencja identyfikowalnych danych wymaga osobnego uzasadnienia |
| Warunek PASS | zatwierdzić okresy 36 miesięcy / 90 dni i zakres danych identyfikowalnych; LIA, jeśli spory/anti-cheat opierają się na 6(1)(f) |
| Status | `PASS WITH CONDITIONS CANDIDATE` |

## PL-E03-04 — Ranking i turnieje

| Element | Wartość |
|---|---|
| Cel główny | obliczanie i publikacja rankingu, prowadzenie turniejów, historia wyników |
| Kategorie danych | identyfikator gracza, publiczna nazwa, rating, wynik, uczestnictwo, tournament/match IDs, timestamps |
| Podstawa projektowa | `art. 6(1)(b) PROPOSED`; integralność i ochrona przed manipulacją — możliwe `art. 6(1)(f) PROPOSED / LIA REQUIRED` |
| Uzasadnienie | ranking i turnieje są funkcją serwisu; publikacja musi być ograniczona do danych koniecznych do funkcji społecznej/gry |
| Warunek PASS | określić jawny zakres publicznego profilu/rankingu; potwierdzić usuwanie z projekcji po delete konta; LIA dla anti-abuse |
| Status | `PASS WITH CONDITIONS CANDIDATE` |

## PL-E03-05 — Prywatne wiadomości i załączniki

| Element | Wartość |
|---|---|
| Cel główny | umożliwienie prywatnej komunikacji pomiędzy użytkownikami i dostarczenie załączników |
| Kategorie danych | sender/recipient IDs, message metadata, zaszyfrowana treść, metadata i payload załączników, timestamps |
| Podstawa projektowa | `art. 6(1)(b) PROPOSED` |
| Uzasadnienie | przetwarzanie jest funkcjonalnie wymagane do dostarczenia wiadomości pomiędzy stronami |
| Warunek PASS | zatwierdzić party-state retention, model dostępu do plaintext, provider object storage, zakres moderacji/abuse handling i zasady po usunięciu jednej strony |
| Status | `PASS WITH CONDITIONS CANDIDATE` |

## PL-E03-06 — Publiczny chat, reakcje i relacje społecznościowe

| Element | Wartość |
|---|---|
| Cel główny | komunikacja publiczna, funkcje społecznościowe, reakcje i relacje pomiędzy użytkownikami |
| Kategorie danych | publiczna nazwa, treść chatu, reakcje, relacje social, timestamps, user IDs |
| Podstawa projektowa | `art. 6(1)(b) PROPOSED`; moderacja/ochrona społeczności — `art. 6(1)(f) PROPOSED / LIA REQUIRED` |
| Uzasadnienie | funkcje publiczne są częścią serwisu, lecz retencja treści i działań moderacyjnych musi być proporcjonalna |
| Warunek PASS | LIA dla moderacji i bezpieczeństwa; jasne privacy notice, zasady widoczności i retencji; model małoletnich musi zostać rozstrzygnięty |
| Status | `HOLD FOR LIA + MINORS DECISION` |

## PL-E03-07 — Newsletter i komunikacja marketingowa

| Element | Wartość |
|---|---|
| Cel główny | wysyłka newslettera i informacji marketingowych, obsługa subskrypcji i rezygnacji |
| Kategorie danych | e-mail, status zgody/subskrypcji, timestamps, consent proof, delivery telemetry |
| Podstawa projektowa | `art. 6(1)(a) PROPOSED` dla dobrowolnej zgody marketingowej; utrzymanie minimalnego proof po wycofaniu zgody — `PENDING LEGAL REVIEW`, potencjalnie 6(1)(f) lub 6(1)(c) tylko po wykazaniu podstawy |
| Uzasadnienie | marketing/newsletter nie powinien być warunkiem korzystania z podstawowych funkcji Gracz.pl |
| Warunek PASS | zatwierdzić model double opt-in, tekst zgody, łatwe wycofanie, suppression/unsubscribe, retencję proof i konkretnego providera |
| Status | `HOLD UNTIL CONSENT MODEL + LEGAL BASIS FOR PROOF` |

## PL-E03-08 — Moderacja, zgłoszenia, sankcje i odwołania

| Element | Wartość |
|---|---|
| Cel główny | ochrona społeczności, obsługa zgłoszeń, nakładanie i weryfikacja sankcji, rozpatrywanie odwołań |
| Kategorie danych | reporter/reported IDs, treść zgłoszenia, moderation case/action, evidence, timestamps, sanction metadata |
| Podstawa projektowa | `art. 6(1)(f) PROPOSED / LIA REQUIRED`; w szczególnych przypadkach `art. 6(1)(c) PENDING` tylko przy wskazanym obowiązku prawnym |
| Uzasadnienie | administrator ma uzasadniony interes w ochronie platformy i użytkowników, ale wymaga to balancing test i ograniczenia zakresu evidence |
| Warunek PASS | formalny LIA; policy moderacji; ograniczenia dostępu; retencja 36 miesięcy i legal hold muszą mieć zaakceptowane uzasadnienie |
| Status | `HOLD UNTIL LIA` |

## PL-E03-09 — Audit, RBAC i historia działań uprzywilejowanych

| Element | Wartość |
|---|---|
| Cel główny | rozliczalność, wykrywanie nadużyć administracyjnych, bezpieczeństwo i możliwość odtworzenia zmian krytycznych |
| Kategorie danych | actor ID, action, target ID, timestamp, correlation ID, role history, minimalne evidence metadata |
| Podstawa projektowa | `art. 6(1)(f) PROPOSED / LIA REQUIRED`; `art. 6(1)(c) PENDING` wyłącznie dla konkretnych obowiązków prawnych |
| Uzasadnienie | rozliczalność i bezpieczeństwo platformy wymagają śladu audytowego, ale nie usprawiedliwiają logowania plaintext sekretów lub prywatnych wiadomości |
| Warunek PASS | LIA, zatwierdzenie zakresu audit, 6-letniej maksymalnej retencji projektowej i ochrony dostępu |
| Status | `HOLD UNTIL LIA` |

## PL-E03-10 — Obsługa praw osób / privacy requests

| Element | Wartość |
|---|---|
| Cel główny | przyjęcie, weryfikacja i wykonanie żądań dostępu, sprostowania, usunięcia, restriction, sprzeciwu i eksportu |
| Kategorie danych | request ID, typ żądania, subject reference, status, timestamps, minimalny proof wykonania, wyjątki/hold reference |
| Podstawa projektowa | `art. 6(1)(c) PROPOSED/PENDING SPECIFIC LEGAL DUTY` dla wykonania obowiązków RODO; dodatkowy minimalny proof/defence — `PENDING LEGAL REVIEW` |
| Uzasadnienie | obsługa praw osób jest obowiązkiem administratora, lecz zakres i retencja proof muszą pozostać minimalne |
| Warunek PASS | wskazać dokładne obowiązki prawne; zatwierdzić model identity verification bez nadmiernego gromadzenia dokumentów; zatwierdzić 6-letnią retencję proof lub ją skorygować |
| Status | `PASS WITH CONDITIONS CANDIDATE / LEGAL REVIEW REQUIRED` |

## PL-E03-11 — Security telemetry, logi, traces i anti-abuse

| Element | Wartość |
|---|---|
| Cel główny | bezpieczeństwo systemu, wykrywanie incydentów, diagnostyka i odporność operacyjna |
| Kategorie danych | IP/UA tam gdzie niezbędne, event metadata, correlation IDs, error/log data, security signals, timestamps |
| Podstawa projektowa | `art. 6(1)(f) PROPOSED / LIA REQUIRED`; węższe logi konieczne do realizacji usługi mogą częściowo wspierać się na `6(1)(b) PROPOSED` |
| Uzasadnienie | bezpieczeństwo i diagnostyka są konieczne do ochrony platformy, lecz telemetry musi być minimalizowane i ograniczone czasowo |
| Warunek PASS | LIA; zatwierdzenie zakresu IP/UA; potwierdzenie 14/30/90 dni i 13 miesięcy dla anonimowych/agregowanych metryk; zakaz sekretów i plaintext prywatnych wiadomości |
| Status | `HOLD UNTIL LIA` |

## PL-E03-12 — Backup, restore i deletion replay

| Element | Wartość |
|---|---|
| Cel główny | ciągłość działania, odzyskiwanie po awarii, integralność danych i zapobieganie przywróceniu danych wcześniej usuniętych |
| Kategorie danych | kopie danych objętych systemem źródłowym; deletion ledger/hold metadata w minimalnym zakresie |
| Podstawa projektowa | baza odpowiada podstawom procesów źródłowych; utrzymanie backupu dla bezpieczeństwa/odporności — `art. 6(1)(f) PROPOSED / LIA REQUIRED` w zakresie danych osobowych |
| Uzasadnienie | backup nie może tworzyć nowego celu ani ukrytego archiwum; powinien wygasać naturalnie i respektować deletion replay po restore |
| Warunek PASS | LIA/ocena proporcjonalności; zatwierdzić 35 dni / 12 tygodni / 12 miesięcy / 7 dni restore environment; udokumentować provider deletion i deletion replay |
| Status | `HOLD UNTIL LEGAL REVIEW + OPERATIONAL EVIDENCE` |

---

# 4. Cele wymagające osobnej podstawy lub dodatkowego review

Następujących przypadków nie wolno automatycznie podpinać pod istniejący cel:

- reklama behawioralna lub profiling użytkownika;
- sprzedaż/udostępnianie danych partnerom dla ich własnego marketingu;
- przetwarzanie danych szczególnych kategorii w rozumieniu art. 9 RODO;
- weryfikacja wieku wymagająca dokumentu tożsamości lub biometrii;
- geolokalizacja precyzyjna;
- płatności, gry o realne pieniądze, hazard lub KYC/AML;
- automatyczne decyzje wywołujące skutki prawne lub podobnie istotne;
- nowe analityki cross-site / advertising IDs;
- wykorzystanie treści prywatnych wiadomości do trenowania modeli lub innych wtórnych celów.

Każdy taki zakres wymaga nowej decyzji, aktualizacji ROPA, oceny podstawy prawnej, retencji, obowiązków informacyjnych i — gdzie trzeba — DPIA.

---

# 5. Matryca statusu podstaw

| Typ podstawy | Status globalny | Wymaganie przed finalnym PASS |
|---|---|---|
| `art. 6(1)(b)` | `PROPOSED` | wykazać rzeczywistą niezbędność dla wykonania funkcji usługi; oddzielić funkcje opcjonalne |
| `art. 6(1)(a)` | `PROPOSED` | zatwierdzić model zgody, dowód, wycofanie i brak bundlingu |
| `art. 6(1)(f)` | `PROPOSED / NOT APPROVED` | osobny LIA/balancing dla bezpieczeństwa, moderacji, anti-abuse, audytu, telemetry i backupów |
| `art. 6(1)(c)` | `PENDING` | wskazać konkretny obowiązek prawny i zakres danych wymagany przez ten obowiązek |
| art. 9 | `NOT IN SCOPE / NO INTENTIONAL PROCESSING` | w razie pojawienia się szczególnych kategorii — osobny program prawny i techniczny |

---

# 6. Wniosek evidence PL-E03

```text
PL-E03 ARTIFACT = CREATED / VERSIONED
PURPOSE MAP = COMPLETE AT DESIGN LEVEL
LAWFUL BASIS MAP = COMPLETE AS PROPOSED MODEL
FORMAL LEGAL APPROVAL = NOT YET COMPLETE
LIA = REQUIRED FOR ALL 6(1)(f) ROWS
CONSENT MODEL = PENDING FOR NEWSLETTER
MINORS MODEL = PENDING
SPECIFIC 6(1)(c) DUTIES = TO BE IDENTIFIED
DPIA SCREENING = SEPARATE EVIDENCE ITEM
IMPLEMENTATION / DEPLOYMENT = NOT AUTHORIZED
FREEZE = ACTIVE
```

**Rekomendowany status PL-E03 na obecnym etapie:** `PASS WITH CONDITIONS` jako dowód kompletności mapy projektowej, przy czym nie oznacza to jeszcze zatwierdzenia wszystkich podstaw prawnych. Warunki blokujące finalny `PASS` całego ADR-V3-012 są przeniesione jawnie do LIA, modelu zgody, modelu małoletnich, DPIA i konkretnych obowiązków prawnych.

---

## 7. Warunki zamknięcia PL-E03 do pełnego PASS

1. Formalnie zatwierdzić lub skorygować każdą pozycję `art. 6(1)(b)`.
2. Zatwierdzić model zgody newslettera i proof of consent.
3. Wykonać LIA dla wszystkich pozycji opartych na `art. 6(1)(f)`.
4. Dla `art. 6(1)(c)` wskazać konkretny przepis/obowiązek albo usunąć tę podstawę z procesu.
5. Rozstrzygnąć model użytkowników małoletnich.
6. Wykonać DPIA screening i ewentualną DPIA.
7. Zsynchronizować mapę z finalną polityką prywatności i ROPA.
8. Utrwalić finalną decyzję w decision record ADR-V3-012.

---

**Koniec dokumentu PL-E03.**
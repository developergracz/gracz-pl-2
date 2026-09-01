# Gracz.pl V3 — PL-E06 Klasyfikacja danych i zakres danych osobowych

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL REVIEW — OPEN / VERSIONED EVIDENCE / FREEZE-SAFE**  
Evidence ID: `PL-E06`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązany ROPA: `ROPA-GRACZ-PL-V3.md`  
Powiązany review pack: `REV-ADR-V3-012-20260901-PL-01`

> Ten dokument klasyfikuje dane przetwarzane lub projektowane do przetwarzania w Gracz.pl V3 i wyznacza granice danych osobowych, danych technicznych, sekretów, evidence i danych anonimowych. Jest artefaktem governance. Nie potwierdza implementacji i nie autoryzuje deploymentu ani zmian produkcyjnych.

---

## 1. Zasady nadrzędne

1. Dane są klasyfikowane według faktycznego ryzyka, celu i możliwości powiązania z osobą, a nie wyłącznie według nazwy kolumny lub tabeli.
2. Identyfikator techniczny, IP, user-agent, correlation ID, identyfikator urządzenia lub inny sygnał może być daną osobową, jeżeli pozwala bezpośrednio lub pośrednio odnieść informację do osoby.
3. Pseudonimizacja nie zmienia danych automatycznie w dane anonimowe.
4. Dane są `ANONYMIZED` dopiero wtedy, gdy przy użyciu racjonalnie dostępnych środków nie istnieje realna możliwość reidentyfikacji i nie istnieje mapa zwrotna.
5. Klasa projektowa `SENSITIVE` oznacza podwyższone ryzyko i wymagania ochrony w Gracz.pl; **nie oznacza automatycznie szczególnej kategorii danych osobowych z art. 9 RODO**.
6. `SECRET` nie jest kategorią prawną RODO, lecz techniczną klasą bezpieczeństwa. Sekret może jednocześnie zawierać lub chronić dane osobowe.
7. Dane niepotrzebne do celu nie powinny być zbierane „na zapas”.
8. Plaintext prywatnych wiadomości, credentiali, MFA secrets i tokenów nie może trafiać do audit, outbox, zwykłych logów, telemetry ani approval evidence.
9. Każda nowa kategoria danych wymaga aktualizacji ROPA, mapy celów/podstaw, retencji i privacy notice przed produkcyjnym użyciem.

---

## 2. Kanoniczne klasy danych Gracz.pl V3

| Klasa | Definicja | Przykłady | Minimalne wymagania |
|---|---|---|---|
| `PUBLIC` | dane przeznaczone do kontrolowanej publikacji | publiczna nazwa gracza, ranking, publiczny profil w zatwierdzonym zakresie, publiczny chat | jawny cel publikacji, minimalizacja, moderacja, możliwość ograniczenia widoczności, retencja |
| `INTERNAL` | dane operacyjne nieprzeznaczone do publicznej ekspozycji | identyfikatory techniczne, command IDs, correlation IDs, statusy workerów | need-to-know, ograniczony dostęp, brak sekretów, retencja |
| `PERSONAL` | informacje dotyczące zidentyfikowanej lub możliwej do zidentyfikowania osoby | e-mail, login, user ID, profil, historia aktywności, część IP/UA i metadanych | cel i podstawa, prawa osoby, retencja, kontrola dostępu |
| `SENSITIVE` | projektowa klasa podwyższonego ryzyka | prywatne wiadomości, security signals, MFA metadata, część moderation evidence | szyfrowanie tam gdzie właściwe, ścisły dostęp, audyt, minimalizacja, krótsza retencja gdy możliwe |
| `EVIDENCE` | dane potrzebne do rozliczalności, obrony, audytu, moderacji lub dowodu decyzji | consent proof, audit events, moderation case evidence, privacy request proof | integralność, dostęp ograniczony, jawny okres retencji, legal-hold awareness |
| `SECRET` | informacje, których ujawnienie umożliwia dostęp lub podważa ochronę systemu | klucze, aktywne tokeny, MFA secrets, credential secrets, privacy HMAC salt | wyłącznie secret store lub równoważny mechanizm, zakaz logowania, rotacja, least privilege |
| `ANONYMIZED` | informacje bez racjonalnej możliwości ponownego powiązania z osobą | statystyki po nieodwracalnej anonimizacji, anonimowe agregaty | brak mapy zwrotnej, przegląd ryzyka reidentyfikacji, brak ukrytego identyfikatora |

---

## 3. Zakres danych osobowych — macierz domenowa

### PL-E06-01 — Konto i profil

**Dane osobowe:** user ID, login/nazwa, e-mail, status konta, dane profilu, preferencje, timestamps, historia lifecycle.  
**Publiczne tylko warunkowo:** nazwa użytkownika i zatwierdzone elementy publicznego profilu.  
**Sekrety:** nie przechowuje się plaintext hasła; credential material i reset/recovery secrets podlegają `SECRET`.  
**Zakaz domyślny:** brak potrzeby zbierania imienia i nazwiska, adresu zamieszkania, numeru dokumentu, PESEL, telefonu lub daty urodzenia, dopóki konkretny proces i podstawa nie wykażą konieczności.

Status: `DEFINED / MINIMIZATION REQUIRED`.

### PL-E06-02 — Uwierzytelnianie, sesje i MFA

**Dane osobowe / techniczne możliwe do powiązania:** session IDs, token metadata, timestamps, IP, UA, security events, recovery metadata.  
**SECRET:** MFA secrets, aktywne tokeny/credential material, klucze.  
**EVIDENCE/SENSITIVE:** wybrane security events i dowody działań uprzywilejowanych.  
**Minimalizacja:** IP/UA mogą być rejestrowane wyłącznie w zakresie uzasadnionym bezpieczeństwem i retencją.

Status: `DEFINED / LIA AND OPERATIONAL SCOPE PENDING`.

### PL-E06-03 — Gry, mecze, ranking i turnieje

**Dane osobowe:** user ID powiązany z game/match IDs, ruchami, wynikami, ratingiem, historią meczu i uczestnictwem turniejowym.  
**PUBLIC:** nazwa gracza, rating, wynik lub pozycja w rankingu wyłącznie w zatwierdzonym zakresie publicznym.  
**ANONYMIZED:** historia/replay może pozostać dłużej tylko po nieodwracalnym zerwaniu powiązania z osobą.  
**INTERNAL:** wersje agregatu, command IDs, technical match metadata.

Status: `DEFINED / PUBLIC SCOPE AND RETENTION REVIEW REQUIRED`.

### PL-E06-04 — Prywatne wiadomości i załączniki

**PERSONAL/SENSITIVE:** nadawca, odbiorca, treść wiadomości, metadane, timestamp, metadata i payload załączników.  
**Zakaz:** plaintext prywatnych wiadomości i załączników nie może być kopiowany do audit/logs/outbox/evidence JSON.  
**Publiczność:** brak; dane są dostępne wyłącznie uprawnionym stronom i kontrolowanym procesom bezpieczeństwa/moderacji zgodnie z zatwierdzonym modelem.  
**Szczególne kategorie:** użytkownik może sam wpisać do wiadomości dane szczególnych kategorii; system nie powinien ich aktywnie pozyskiwać ani profilować. Ryzyko treści user-generated wymaga ujęcia w DPIA screening i zasadach dostępu.

Status: `DEFINED / ACCESS MODEL + DPIA SCREENING REQUIRED`.

### PL-E06-05 — Publiczny chat i social

**PUBLIC/PERSONAL:** publiczna nazwa, treść chatu, reakcje i widoczne relacje społeczne.  
**INTERNAL/PERSONAL:** identyfikatory wewnętrzne, moderation links, timestamps.  
**Ryzyko:** treść użytkownika może ujawniać dodatkowe dane osobowe lub szczególne kategorie mimo braku takiego celu po stronie Gracz.pl.  
**Wymaganie:** moderacja, możliwość usunięcia/ograniczenia treści i szczególna ostrożność dla użytkowników 16–17 lat.

Status: `DEFINED / MINORS + MODERATION CONDITIONS`.

### PL-E06-06 — Newsletter i komunikacja e-mail

**PERSONAL:** adres e-mail, status subskrypcji, lifecycle timestamps.  
**EVIDENCE:** consent proof / withdrawal proof w minimalnym zakresie.  
**SECRET:** confirmation/unsubscribe token material.  
**Telemetry:** provider delivery metadata może stanowić dane osobowe, jeśli jest powiązane z subskrybentem.

Status: `DEFINED / CONSENT MODEL + PROVIDER SCOPE PENDING`.

### PL-E06-07 — Moderacja, zgłoszenia, sankcje i odwołania

**PERSONAL/EVIDENCE/SENSITIVE:** reporter ID, reported-user ID, treść zgłoszenia, moderation reason, action, appeal, dowody, timestamps.  
**Ryzyko:** evidence może zawierać treści użytkownika, prywatne informacje lub dane osób trzecich.  
**Wymaganie:** ścisły dostęp, minimalny zakres dowodu, jawny legal hold, retencja i rejestr dostępu.

Status: `DEFINED / LIA + LEGAL HOLD REVIEW REQUIRED`.

### PL-E06-08 — Audit i działania uprzywilejowane

**PERSONAL/EVIDENCE:** actor ID, action, target reference, timestamp, correlation ID, role history, minimalne metadata.  
**Zakaz:** sekretów, pełnego payloadu prywatnej wiadomości, pełnych credentiali, pełnych tokenów, zbędnego PII.  
**Wymaganie:** append-only/tamper-resistant design, kontrola dostępu i wersjonowana retencja.

Status: `DEFINED / LIA + RETENTION REVIEW REQUIRED`.

### PL-E06-09 — Privacy requests / prawa osób

**PERSONAL/EVIDENCE:** request ID, subject reference, typ żądania, status, timestamps, wynik, minimalny dowód wykonania, hold/exception reference.  
**Zakaz domyślny:** przechowywania kopii dokumentów tożsamości i nadmiarowych danych identyfikacyjnych, jeśli nie są konieczne.  
**Projekt:** subject reference powinien być minimalizowany/pseudonimizowany tam, gdzie to możliwe.

Status: `DEFINED / IDENTITY VERIFICATION MODEL PENDING`.

### PL-E06-10 — Logi, traces, telemetry i anti-abuse

**INTERNAL/PERSONAL:** correlation IDs, request metadata, wybrane IP/UA, error context, timestamps.  
**ANONYMIZED:** agregaty metryk bez identyfikatorów po potwierdzonej anonimizacji.  
**Zakaz:** plaintext prywatnych wiadomości, sekretów, pełnych tokenów, MFA secrets, credential payloads, pełnych załączników.  
**Wymaganie:** field-level logging policy i automatyczna redakcja/masking przed produkcyjnym GO.

Status: `DEFINED / OPERATIONAL REDACTION EVIDENCE REQUIRED`.

### PL-E06-11 — Backup i restore

Backup dziedziczy klasyfikację danych źródłowych. Backup nie staje się mniej wrażliwy tylko dlatego, że jest kopią.  
**Wymaganie:** dostęp ograniczony, szyfrowanie, jawna retencja, natural expiry, deletion replay po restore, izolowany restore environment i cleanup evidence.  
**Zakaz:** używania backupu jako ukrytego archiwum bezterminowego lub legal hold.

Status: `DEFINED / OPERATIONAL EVIDENCE PENDING`.

---

## 4. Dane szczególnych kategorii i dane karne

Baseline Gracz.pl V3 **nie zakłada celowego pozyskiwania ani profilowania danych szczególnych kategorii z art. 9 RODO ani danych o wyrokach/skazaniach z art. 10 RODO**.

Możliwe jest jednak, że użytkownik dobrowolnie umieści takie informacje w:

- prywatnej wiadomości,
- publicznym chacie,
- załączniku,
- zgłoszeniu moderacyjnym.

To nie tworzy automatycznie celu ich wykorzystywania przez Gracz.pl. System powinien:

1. nie wymagać takich danych,
2. nie tworzyć na ich podstawie profili ani segmentów,
3. ograniczać dostęp do treści,
4. stosować moderację i minimalizację,
5. ująć to ryzyko w DPIA screening,
6. przeprowadzić odrębny Privacy/Legal review przed wprowadzeniem funkcji, która celowo przetwarzałaby takie dane.

Status: `NO INTENTIONAL SPECIAL-CATEGORY PROCESSING IN BASELINE / USER-GENERATED CONTENT RISK EXISTS`.

---

## 5. Dane wyłączone z bazowego zakresu

Bez odrębnej decyzji i wykazanej konieczności Gracz.pl V3 nie powinien zbierać:

- PESEL,
- numeru dowodu/paszportu,
- skanów dokumentów tożsamości,
- danych biometrycznych,
- dokładnej lokalizacji GPS,
- danych zdrowotnych,
- poglądów politycznych, religijnych lub światopoglądowych,
- informacji o orientacji seksualnej,
- numerów kart płatniczych,
- danych rachunku bankowego,
- danych o skazaniach i czynach zabronionych,
- pełnego adresu zamieszkania,
- daty urodzenia, jeśli model wieku może zostać spełniony mniej inwazyjnie.

Każde odstępstwo wymaga nowego celu, podstawy, minimalizacji, oceny ryzyka, aktualizacji ROPA i — gdy właściwe — DPIA.

---

## 6. Reguły ekspozycji

| Klasa | Publiczny frontend | Zwykły backend | Uprzywilejowany dostęp | Logi/telemetry | Backup |
|---|---|---|---|---|---|
| `PUBLIC` | tylko jawnie zatwierdzony zakres | tak | wg potrzeby | minimalnie | tak wg polityki |
| `INTERNAL` | nie | tak | wg roli | minimalnie | tak wg polityki |
| `PERSONAL` | tylko gdy funkcja jest jawnie publiczna | tak wg celu | least privilege | redakcja/minimalizacja | tak wg polityki |
| `SENSITIVE` | nie, chyba że sam użytkownik jawnie publikuje treść w funkcji publicznej | ściśle wg celu | ścisłe role + audyt | co do zasady nie; tylko bezpieczne metadata | szyfrowany/chroniony |
| `EVIDENCE` | nie | procesowo | ścisłe role + audyt | bez payloadu źródłowego | wg jawnej retencji |
| `SECRET` | nigdy | tylko komponent potrzebujący sekretu | wyjątkowo / admin security | nigdy | tylko jeśli wymagane i odpowiednio chronione |
| `ANONYMIZED` | możliwe | tak | tak | tak | tak, jeśli anonimowość jest rzeczywista |

---

## 7. Kryteria walidacji PL-E06 przed pełnym PASS

Pełne `PASS` wymaga potwierdzenia, że:

1. ROPA i PL-E03 pozostają zsynchronizowane z tą klasyfikacją;
2. publiczny zakres profilu/rankingu jest jawnie zatwierdzony;
3. model dostępu do prywatnych wiadomości i załączników jest zatwierdzony;
4. logging/redaction policy uniemożliwia wycieki sekretów i zbędnego PII;
5. model małoletnich jest zgodny z PL-E05;
6. DPIA screening uwzględnia user-generated content, messaging, moderację i osoby 16–17;
7. providery/storage/transfery mają potwierdzony zakres danych;
8. żadna funkcja nie wymaga danych z sekcji 5 bez nowego formalnego review;
9. istnieje dowód operacyjny dla kontroli dostępu i redakcji przed produkcyjnym GO.

---

## 8. Formalna ocena evidence

```text
EVIDENCE ID = PL-E06
ARTIFACT = PL-E06-KLASYFIKACJA-DANYCH-I-ZAKRES-DANYCH-OSOBOWYCH-GRACZ-PL-V3.md
OWNER = Czesław Socha / Privacy-Legal Decision Owner
CLASSIFICATION MODEL = DEFINED
PERSONAL DATA SCOPE = DEFINED
SPECIAL-CATEGORY BASELINE = NOT INTENTIONALLY COLLECTED
USER-GENERATED SPECIAL-CATEGORY RISK = RECOGNIZED
DATA MINIMIZATION BOUNDARY = DEFINED
PRODUCTION IMPLEMENTATION = NOT AUTHORIZED
FREEZE = ACTIVE
RECOMMENDED REVIEW STATUS = PASS WITH CONDITIONS
```

Warunki nie powinny zostać interpretowane jako zgoda na implementację ani deployment.

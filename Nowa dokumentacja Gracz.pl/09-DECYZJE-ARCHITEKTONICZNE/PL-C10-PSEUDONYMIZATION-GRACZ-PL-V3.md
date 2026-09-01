# Gracz.pl V3 — PL-C10 Pseudonymization

Data utworzenia: 01.09.2026  
Wersja: `0.1`  
Status: **FORMAL PRIVACY/LEGAL CONTROL REVIEW — VERSIONED / FREEZE-SAFE**  
Control ID: `PL-C10`  
Powiązany ADR: `ADR-V3-012 — Data Retention, Privacy Deletion i Legal Hold`  
Powiązane evidence: `PL-E06`, `PL-E12`, `PL-E13`, `PL-E14`, `PL-E15`  
Powiązane kontrole: `PL-C06`, `PL-C07`, `PL-C09`

> Dokument ustanawia kontrolę pseudonimizacji dla Gracz.pl V3. Pseudonimizacja jest środkiem ograniczającym ryzyko i linkowalność danych, ale nie jest anonimizacją. Dane pseudonimizowane nadal są traktowane jako dane osobowe, jeżeli istnieje realna możliwość ponownego powiązania ich z osobą.

---

## 1. Decyzja w skrócie

```text
PL-C10 = PASS WITH CONDITIONS

PSEUDONYMIZATION = REQUIRED WHERE PRACTICABLE FOR HIGH-RISK / EVIDENCE / PRIVACY WORKFLOWS
PSEUDONYMIZED DATA = PERSONAL DATA
PSEUDONYMIZATION = NOT ANONYMIZATION
DIRECT IDENTIFIER SEPARATION = REQUIRED
REIDENTIFICATION MAPPING / KEY = STRICTLY CONTROLLED
CROSS-DOMAIN STABLE PSEUDONYM = NOT ALLOWED BY DEFAULT
SECRET / HMAC MATERIAL IN LOGS = PROHIBITED
PRODUCTION TECHNICAL EVIDENCE = OPEN
IMPLEMENTATION / DEPLOYMENT AUTHORIZATION = NO CHANGE
FREEZE = ACTIVE
```

---

## 2. Cel kontroli

Celem PL-C10 jest ograniczenie skutków nieuprawnionego dostępu, przypadkowego ujawnienia i nadmiernej korelacji danych poprzez zastępowanie bezpośrednich identyfikatorów kontrolowanymi referencjami technicznymi tam, gdzie pełna identyfikacja osoby nie jest potrzebna do bieżącego celu.

Pseudonimizacja powinna być stosowana w szczególności dla:

- privacy request evidence;
- deletion ledger i deletion receipts;
- legal hold references;
- wybranych audit/security events;
- telemetry i logów, gdy identyfikacja bezpośrednia nie jest konieczna;
- historycznych rekordów domenowych, jeżeli nadal muszą pozostawać danymi osobowymi, lecz można ograniczyć bezpośrednią identyfikowalność;
- komunikacji pomiędzy bounded contexts, jeśli przekazywanie loginu/e-maila nie jest konieczne.

---

## 3. Zasada: pseudonimizacja nie oznacza anonimizacji

Model V3 rozróżnia trzy stany:

| Stan | Charakter | Reguła |
|---|---|---|
| bezpośrednio identyfikowalne | np. e-mail, login, publiczna nazwa, user ID z łatwym lookupem | pełne wymogi dla danych osobowych |
| pseudonimizowane | np. keyed subject reference / HMAC, tokenized internal reference | nadal dane osobowe; lookup/key musi być chroniony |
| zanonimizowane | brak racjonalnej możliwości reidentyfikacji i brak mapy zwrotnej | może wyjść poza zakres danych osobowych dopiero po skutecznej anonimizacji |

Nie wolno oznaczać danych jako `ANONYMIZED` tylko dlatego, że zastąpiono `user_id` innym stabilnym identyfikatorem.

---

## 4. Kanoniczny subject reference

Dla workflow privacy/evidence preferowany jest pseudonimowy reference, np.:

```text
subject_ref_hmac = HMAC(secret_scope_key, canonical_subject_id)
```

Jest to wzorzec projektowy, nie wymóg konkretnego algorytmu implementacyjnego.

Warunki:

1. secret/key nie może znajdować się w tej samej tabeli lub payloadzie co pseudonim;
2. key/material musi należeć do klasy `SECRET`;
3. logi, traces, audit payload i approval evidence nie mogą zawierać secretu/HMAC salt;
4. możliwość ponownego powiązania subject reference z osobą musi być ograniczona do jawnie uprawnionych procesów;
5. należy unikać jednego globalnego, stabilnego pseudonimu używanego przez wszystkie domeny, jeżeli zwiększa to niepotrzebną korelację;
6. scope-specific pseudonyms są preferowane tam, gdzie ograniczają linkowalność bez utraty celu operacyjnego.

---

## 5. Rozdzielenie identyfikatorów od danych operacyjnych

Pseudonimizacja powinna zmniejszać możliwość prostego połączenia rekordu z kontem.

Wymagane zasady:

- dane bezpośrednio identyfikujące powinny być przechowywane w systemie źródłowym lub wydzielonej warstwie identity;
- downstream evidence/log/telemetry powinny otrzymywać minimalną referencję zamiast e-maila/loginu, jeśli bezpośredni identyfikator nie jest potrzebny;
- mapping lub zdolność reverse lookup musi posiadać oddzielny access path;
- operator posiadający dostęp do logów nie powinien automatycznie posiadać dostępu do mapowania pseudonimu na osobę;
- eksporty diagnostyczne i support bundles nie mogą zawierać mapowania, chyba że istnieje konkretny, zatwierdzony cel.

---

## 6. Privacy requests i deletion ledger

Dla evidence realizacji praw osób preferowany jest minimalny rekord zawierający pseudonimowy subject reference zamiast trwałego przechowywania e-maila, loginu lub pełnego profilu.

Minimalizacja obejmuje:

- `request_id`;
- pseudonimowy subject reference;
- typ działania;
- timestamps;
- status i receipts;
- policy version;
- minimalny locator evidence;
- hold/exception reference, jeśli występuje.

Pseudonimizacja nie usprawiedliwia nadmiernej retencji. Okres przechowywania nadal wynika z PL-E13 / PL-R03.

---

## 7. Account deletion

Po skutecznym usunięciu konta:

- pseudonim nie może służyć do dalszego publicznego śledzenia osoby;
- nie wolno zachować stabilnego aliasu tylko po to, aby obejść delete;
- powiązanie z osobą powinno zostać zerwane tam, gdzie cel ustał;
- minimalny tombstone/subject reference może pozostać wyłącznie w zakresie zatwierdzonym przez PL-R03 i właściwą podstawę;
- jeżeli dalszy lookup nie jest już potrzebny, należy usunąć możliwość reidentyfikacji albo wykonać pełną anonimizację, jeśli jest to właściwa akcja końcowa.

---

## 8. Gry, ranking i replay

Pseudonimizacja może być etapem pośrednim przy usuwaniu linku do gracza, ale nie wystarcza do bezterminowego zachowania danych jako anonimowych.

Przykład niedopuszczalny:

```text
user_id = 123 -> player_hash = ABCXYZ
stable player_hash is retained forever across all matches
mapping remains available
status = "anonymous"
```

Taki rekord pozostaje pseudonimizowany i musi mieć cel, podstawę oraz okres retencji.

Bezterminowy replay jest dopuszczalny wyłącznie po spełnieniu PL-C09, czyli po rzeczywistej, nieodwracalnej anonimizacji.

---

## 9. Logi, telemetry i security

Tam, gdzie pełne ID użytkownika nie jest potrzebne do diagnostyki lub korelacji incydentu:

- należy preferować pseudonimowe subject/device/session reference;
- pseudonim nie może zawierać czytelnego e-maila/loginu;
- nie wolno zapisywać plaintext tokenów, MFA secrets ani kluczy;
- IP/UA nadal mogą być danymi osobowymi i pseudonimizacja innego pola nie zmienia ich statusu;
- korelacja pomiędzy logami a identity powinna być ograniczona RBAC/need-to-know;
- po upływie okresu retencji lookup oraz rekord muszą podlegać właściwemu purge.

---

## 10. Moderacja i legal hold

Pseudonimizacja powinna być stosowana tam, gdzie moderator lub operator nie potrzebuje bezpośrednich danych konta.

Jednocześnie:

- legal hold może utrzymać pseudonimowy reference wyłącznie w wąskim, zatwierdzonym zakresie;
- istnienie hold nie pozwala na tworzenie globalnej mapy korelacyjnej użytkownika;
- dostęp do reidentyfikacji musi być audytowany;
- po release hold należy ponownie ocenić potrzebę mappingu i wykonać purge/anonimizację zgodnie z normalną retencją.

---

## 11. Klucze, mapping i separation of duties

Pełny PASS wymaga technicznego potwierdzenia następującego modelu:

1. materiał kryptograficzny pseudonimizacji znajduje się w secret store lub równoważnym kontrolowanym mechanizmie;
2. dostęp do klucza/mappingu jest węższy niż dostęp do samych danych pseudonimizowanych;
3. wszystkie próby reidentyfikacji dla celów uprzywilejowanych są audytowalne tam, gdzie właściwe;
4. rotacja/zmiana kluczy nie prowadzi do utraty wymaganych privacy/deletion controls;
5. backup klucza/mappingu ma właściwą ochronę i retention;
6. klucz nie jest współdzielony z systemami, które nie wymagają zdolności reidentyfikacji;
7. awaria mappingu nie prowadzi do fallbacku na plaintext PII w logach.

---

## 12. Providerzy

Jeżeli pseudonimizowane dane są przekazywane procesorowi/providerowi:

- nadal traktuje się je jako dane osobowe, jeśli Gracz.pl lub inny podmiot posiada realną możliwość ponownego powiązania;
- pseudonimizacja nie eliminuje wymagań PL-E07/PL-E08 dotyczących DPA, transferów i subprocesorów;
- provider nie powinien otrzymywać mapowania, jeśli nie jest ono niezbędne do celu usługi;
- zakres pseudonimów powinien być ograniczony do funkcji danego providera.

---

## 13. Backup i restore

Backup zachowuje status danych pseudonimizowanych.

Po restore:

- nie wolno odtwarzać starych mappingów w sposób, który reaktywuje usunięte konto lub nieaktualny stan privacy;
- deletion replay musi zostać wykonany przed normalnym użyciem restore;
- mapping/key używany do privacy reconciliation musi być chroniony jak `SECRET`;
- kopia nie może stać się dodatkowym, bezterminowym repozytorium mapowania.

---

## 14. Niedozwolone wzorce

```text
HASHED USER ID = ANONYMOUS = PROHIBITED ASSUMPTION
GLOBAL STABLE USER PSEUDONYM FOR ALL DOMAINS = NOT ALLOWED BY DEFAULT
PSEUDONYM + LOOKUP TABLE WITH SAME ACCESS = INSUFFICIENT SEPARATION
HMAC SECRET IN LOGS / CONFIG EXPORT = PROHIBITED
PSEUDONYMIZATION AS JUSTIFICATION FOR INDEFINITE RETENTION = PROHIBITED
PSEUDONYMIZATION AS DPA / TRANSFER EXEMPTION = PROHIBITED
ACCOUNT DELETE WITH PERMANENT TRACKABLE ALIAS = PROHIBITED
```

---

## 15. Warunki otwarte przed pełnym PASS

| ID | Warunek | Severity | Owner | Status |
|---|---|---|---|---|
| PL-C10-O01 | wskazać techniczny standard subject reference/HMAC/tokenization per workflow | P1 Privacy/Architecture | Privacy/Legal + Architecture | `OPEN` |
| PL-C10-O02 | potwierdzić separację key/mapping od pseudonimizowanych danych oraz RBAC | P1 Security/Privacy | Security + Privacy/Legal | `OPEN` |
| PL-C10-O03 | przetestować, że logi/telemetry nie ujawniają bezpośrednich identyfikatorów tam, gdzie pseudonimizacja jest wymagana | P1 Privacy/Operational | Engineering + Privacy/Legal | `OPEN` |
| PL-C10-O04 | przetestować account delete + deletion ledger bez utrzymania nieuzasadnionego trackable aliasu | P1 Privacy/Operational | Engineering + Privacy/Legal | `OPEN` |
| PL-C10-O05 | potwierdzić zachowanie mapping/key po backup/restore i deletion replay | P1 Privacy/Operations | Operations + Privacy/Legal | `OPEN` |
| PL-C10-O06 | ująć ryzyko korelacji i reidentyfikacji pseudonimów w pełnej DPIA | P1 Privacy/Legal | Privacy/Legal | `OPEN` |

---

## 16. Formalna decyzja PL-C10

Kontrola projektowa jest wystarczająco zdefiniowana, aby uznać ją za `PASS WITH CONDITIONS`, ponieważ dokumentacja V3 rozróżnia pseudonimizację od anonimizacji, wymaga minimalizacji identyfikatorów, przewiduje pseudonimowe subject references w privacy workflow oraz traktuje secret/mapping jako odrębnie chroniony materiał.

Pełny `PASS` jest blokowany do czasu uzyskania dowodu technicznego dla kluczy/mappingu, RBAC, log redaction, deletion workflow i restore.

---

## 17. Granica autoryzacji

Utworzenie PL-C10:

- nie wdraża pseudonimizacji;
- nie tworzy ani nie rotuje kluczy;
- nie zmienia bazy danych, logów, telemetry ani providerów;
- nie zatwierdza produkcyjnej konfiguracji sekretów;
- nie autoryzuje implementacji ani deploymentu;
- nie zdejmuje freeze;
- nie zmienia `REVIEWED DESIGN GATE = HOLD` ani `Production V3 = NO-GO`.

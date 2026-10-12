# 03 — Program testów, audytów, rollback i decyzji właściciela

Status: **MANDATE PROPOSAL / READ-ONLY DOCS PR**.

## 1. Reguła jakości

Priorytet: **jakość, spójność i bezpieczeństwo fundamentu ponad szybkość**. Nie pomijać audytu dla wygody użytkownika. Każdy produkcyjny PR posiada niezmienny HEAD/TREE, zakres, testy, niezależnego recenzenta, decyzję Owner merge GO, post-merge CI i plan cofnięcia.

## 2. Testy PR-1: backend, dane, biznes i bezpieczeństwo

| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| D01 | nowy e-mail, ważna zgoda | jedna kontrolowana próba DOI, rejestr opt_in_requested, brak aktywacji marketingowej przed potwierdzeniem |
| D02 | ten sam e-mail w PENDING x10 | cooldown/limity, nie ma x10 wiadomości ani x10 niezależnych operacji |
| D03 | ten sam aktywny e-mail x10 | 0 kolejnych DOI i welcome, bez zmiany zgody |
| D04 | dwa równoległe POST na różnych instancjach | atomowy claim, pojedyncza skuteczna operacja DOI |
| D05 | restart pomiędzy claim a provider response | stan niejednoznaczny odzyskiwany bez mnożenia wiadomości i bez zagubienia uprawnionego żądania |
| D06 | Resend 429, timeout, 5xx lub odpowiedź spóźniona | bounded retry/idempotency, fail-closed, brak bezwarunkowego resend |
| D07 | unsubscribed / hosted unsubscribe | brak automatycznego opt-in, nowy potwierdzony DOI konieczny |
| D08 | token przestarzały i odtwarzany | brak ponownej aktywacji, stary token nie wygrywa z opt-out |
| D09 | legacy Resend-active, brak wpisu consent ledger | brak re-DIO, brak sfałszowanej historii zgody, właściwy status |
| D10 | rozbieżność provider/PG | brak fałszywego ACTIVE, widoczny alarm audit, bez automatycznej destrukcyjnej „naprawy” |
| D11 | baza PostgreSQL nieosiągalna | fail-closed przy krytycznej operacji; bez przejścia na Maps |
| D12 | publiczne sondowanie 100 losowych adresów | brak możliwości stwierdzenia członkostwa z treści, kodu, timingów, nagłówków i rozmiaru odpowiedzi |
| D13 | masowe boty/szybkie wysyłki | per-IP, per-hash, globalne limity, kontrolowany koszt i alerty |
| D14 | formularz kontaktowy + newsletter zaznaczony | dostarczona wiadomość kontaktowa niezależna od błędu newslettera |
| D15 | newsletter bez zgody, błędny adres | walidacja i brak operacji marketingowej |
| D16 | regresja /newsletter/ i wszystkie stopki | jeden modal premium i jedna ścieżka API bez double-handler |
| D17 | testy accessibility | focus trap, Escape, reduced-motion, keyboard-only, screen readers, mobile |
| D18 | brak regresji Resend confirmation/unsubscribe/resubscribe | dotychczasowe zachowanie, brak dubli po restartach |
| D19 | adapter providera opóźniony/niespójny | spójny model ACTIVE, fallback nie wycieka stanu |

Wszystkie testy z fałszywymi adresami/mock provider w CI. Test rzeczywistego DOI na adresie testowym i potwierdzenie w Resend **dopiero po osobnym Owner GO**, bez naruszania aktywnych subskrybentów. Jeśli migracja pending-claim jest wymagana: real PostgreSQL concurrency oraz rollback/expand-only test (zero operacji produkcyjnych w PR docs).

## 3. Testy PR-2: panel właściciela

| ID | Scenariusz | Oczekiwany rezultat |
|---|---|---|
| A01 | anonimowy GET każdej trasy admin | 401/403, zero PII w treści odpowiedzi/cache/logach |
| A02 | użytkownik zalogowany bez roli OWNER | 403, brak obejścia przez UI, IDOR i path traversal |
| A03 | OWNER + wymagana MFA | dostęp wyłącznie po przejściu MFA |
| A04 | sesja wygasła/wylogowanie/unieważnienie | brak ponownego dostępu, brak wrażliwego cache |
| A05 | test CSRF/CORS/Origin oraz session fixation | odmowa dla niedozwolonego origin, cookie tylko Secure/HttpOnly/SameSite |
| A06 | lista większa niż jedna strona i duża liczba kontaktów | poprawne kursory, brak duplikacji/utraty rekordów, limity pamięci |
| A07 | contact topic opt_out lub nie jest w segmencie | nie figuruje jako aktywny; zgodność z provider truth |
| A08 | pending consent HMAC bez jawnego e-maila | nie ujawniamy adresu; wyłącznie dozwolone statystyki |
| A09 | Resend 429/5xx | status degradacji zamiast „0 subskrybentów” |
| A10 | dostęp do audytu pojedynczej osoby | minimalizacja PII, brak zgód zmyślonych lub dopisywanych automatycznie |
| A11 | skan bundla/browser devtools | brak API key, haseł, DB URL, sekretów, HMAC subject hash i PII w telemetry |
| A12 | masowe odczyty / brute-force | throttling, audyt i alerty, niezawodność |
| A13 | Chrome/Firefox/Safari/Edge + desktop/tablet/mobile | spójny layout i obsługa klawiaturą |
| A14 | próba eksportu/mutacji w R1 | brak dostępnej funkcji oraz backend odmawia żądań |
| A15 | dostępne logi audytowe | metadane bez jawnych e-maili, identyfikacja operatora i requestId |
| A16 | backup/restore DR | nowy moduł nie obniża istniejącej odzyskiwalności bazy i kluczy |

## 4. Niezależne audyty obowiązkowe przed wdrożeniem

- **Security / AppSec**: enumeration, spam amplification, race conditions, token replay, Resend permissions, public API, RBAC, MFA, session/CSRF, injection/IDOR, secrets.
- **Database / integrity**: HMAC, consent append-only, CAS and crash safety, migration expansion, transakcje, zasady retencji.
- **Privacy / legal**: double opt-in, RODO, odbiorcy danych, możliwość wypisania, administrator ma prawo dostępu, brak dodatkowego jawnego rejestru.
- **Frontend / accessibility**: modal Full Max Premium, jednorodność na podstronach, WCAG, mobilne, CSP, regresje stopki i kontaktu.
- **Architecture**: jeden provider marketing state (Resend), jedna first-party consent evidence (PostgreSQL), brak drugiego engine i zależności od Gracz Next L6.
- **Operations/DR**: alerty błędów dostawcy, bezpieczny rollback, zero sekretów w dowodach, Recovery/backup gates nienaruszone.
- **Independent exact-head audit**: niezależny recenzent nie może być autorem audytowanych zmian; po poprawkach nowy HEAD wymaga nowego przeglądu zmienionego zakresu, a krytyczne zmiany całościowego re-review.

Używać istniejących GitHub CI i audytów projektu, nie wymyślać fikcyjnego PASS. Na PR docs nie uruchamiać testów zewnętrznych usług ani nie wysyłać newsletterów.

## 5. Kontrolowana sekwencja realizacji

**Gate 0 — DOCS:** osobna gałąź i DRAFT PR, zero zmian wykonywalnych; sprawdzenie brakujących decyzji, niezależna recenzja dokumentacji. MERGE wyłącznie po Owner GO.

**Gate 1 — PR-1 scope:** owner-approved spec + konflikt PR + test plan + API compatibility. Kod tylko w przydzielonym osobnym PR.

**Gate 2 — PR-1 CI:** unit/contract/adversarial + real PostgreSQL integration, security scan, exact-head green.

**Gate 3 — PR-1 independent audit:** bez blockerów; akceptacja Owner merge GO; merge; post-merge CI; kontrolowany, autoryzowany release i smoke test.

**Gate 4 — PR-2 architecture and access:** projekt sesji OWNER + MFA/role + audit; konkretny model hostowania i koszty; oddzielna zgoda na realizację.

**Gate 5 — PR-2 CI/audit:** security/PII/Resend pagination, testy A01–A16, zero key leakage; independent GO -> Owner merge GO -> post-merge -> osobny deploy GO.

**Gate 6 — produkcyjna akceptacja:** test właściciela, lista aktywnych zgodna z Resend, logi bez PII, wycofanie zgody i rollback sprawdzony, dokumentacja polityki prywatności zaakceptowana.

Żadna bramka nie jest automatycznie zaliczona samym istnieniem dokumentacji. Daty wdrożenia nie są obiecywane bez audytu.

## 6. Rollback, STOP i dowody

STOP: naruszona ochrona istniejących zgód, podwójne wiadomości mimo dedup, enumeration, brak MFA, jawne tokeny/PII, wadliwa migracja, provider status niejednoznaczny, niezgodny CSP/CORS, brak niezależnego PASS, niesprawdzony klucz szyfrowania/backup gdy dotykamy DB. HOLD na płatny zasób i deploy bez Owner GO.

Rollback PR-1: przywrócić poprzedni kontrakt UI/API w zatwierdzonym release; nie usuwać append-only consent events ani nie wykonywać odwrotnej destrukcyjnej migracji. Wybór feature flag tylko po osobnej ocenie, ponieważ nie może otwierać ponownie podatności na spam.

Rollback PR-2: zamknąć wszystkie endpointy/feature flag ADMIN default-deny, unieważnić sesje, zachować logi audytu o ograniczonym zakresie, nie naruszać publicznego newslettera. W razie wycieku kluczy: reagować na incydent i rotować sekrety pod osobnym mandatem, a nie publicznie.

W dossier PASS: exact HEAD/TREE, zakres zmian, workflow run URLs, lista scenariuszy PASS/FAIL, rewizje reviewerów, logi wyłącznie z danymi zanonimizowanymi, status migracji i powrót, decyzje Owner. **Zero rzeczywistych adresów/sekretów w GitHub.**

## 7. Ostateczny stan mandatu

Dokumentacja tylko określa plan. **Nie zezwala** na merge, deploy, zmianę Render/Postgres/Resend, uruchomienie nowych paid resources ani ujawnianie listy subskrybentów. Nawet pozytywny audyt wymaga osobnej zgody właściciela przed zmianą produkcji.

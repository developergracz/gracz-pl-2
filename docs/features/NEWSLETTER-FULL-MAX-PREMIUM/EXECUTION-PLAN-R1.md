# FULL MAX NEWSLETTER — PLAN WYKONAWCZY R1
Data bazowa: 2026-10-16. Status: zatwierdzony zakres produktu, realizacja NIEPOTWIERDZONA. Dokument nadrzędny: MASTER-SPEC-R1-2026-10-16.md (PR #259). Repo: developergracz/gracz-pl-2.

## Reguła sterująca
**Zamrażamy zakres dokładnie ośmiu modułów i trzech pakietów A/B/C.** Żadnego Panelu Reklamodawcy, faktur, komercyjnych zamówień reklam ani usług e-mail.pl. Po odbiorze A+B+C oraz produkcyjnym PASS, przejście do Gracz Next L6 i podwarstw. Drobne poprawki bezpieczeństwa i zgodności nie stanowią rozszerzenia produktu. Pierwsze wdrożenie może przebiegać etapami; końcowe CLOSED wyłącznie po wszystkich kryteriach.

## Źródła i priorytety
- PR #258: inert read-only OWNER R1; **DRAFT / NO MERGE / NO DEPLOY**; synthetic harness, actual admin permanently 403; niezależny audyt WebAuthn HOLD.
- PR #259: master Full Max Premium scope, **DRAFT**; dokumentacja, nie kod.
- Obowiązujące reguły: ZIP1 architektura/jakość, ZIP2 wykonanie/audyty, DR/P0, CodeQL/secrets/node-security/SEO/CSP, migracja 005 HARD HOLD. Jeżeli aktualne bramki są inne, zanotować kolizję i poprosić Owner o decyzję, nie zgadywać.
- Żaden zapis w dokumentacji ani status CI dla syntetycznego demo nie stanowi autoryzacji produkcyjnego wdrożenia, rzeczywistych wysyłek lub zmian danych.

## Pakiet A: Fundament i dane (M1–M3)
**M1 OWNER Security**: jedna tożsamość OWNER, niezależnie zatwierdzona architektura WebAuthn, origin/RP, bezpieczny enrollment i recovery, trwałe sesje z odwołaniem, cookie HttpOnly Secure SameSite, CSRF, limitowanie, audit trail, role po stronie serwera, odmowa przy awarii DB. Test: anonim/legacy/expired/replay/origin mismatch/recovery/logout/brute-force => deny; OWNER => minimalny autoryzowany dostęp. Realny deployment po osobnym Owner GO.
**M2 Subscriber Center**: stany aktywny/pending/wypisany/suppressed/unknown, sort/paginacja/filtr, detale, źródło zapisu, dokładny timestamp serwera do sekundy wraz z Europe/Warsaw i etykietą strefy, historia zdarzeń; brak surowych tokenów/IP, jawne brakujące dane. Wpisy w PostgreSQL/Resend zgodne z rzeczywistą semantyką; nie obiecywać globalnego licznika z niepełnej strony Resend. Testy zakresu zapytań, cursor, 429/5xx, stale results, utrata dostępu.
**M3 RODO/Consent**: stopka na startowej i każdej właściwej podstronie, formularze i modal auth, DOI, unikalność/duplikaty, resend limits, unsubscribe, suppression, consent version/time/source/proof, antyspam/rate limit, dowody i retencja; synchronizacja Resend/PG; zgoda marketingowa i dobór odbiorcy weryfikowane ponownie przed wysyłką. Testy równoległości, restartu, wycofania zgody, email enumeration i crash recovery.

**A ACCEPT:** produkcyjnie działające, chronione logowanie właściciela i przegląd prawdziwych danych; rzeczywisty zapis/DOI/wypisanie w kontrolowanym smoke; brak naruszeń danych. PASS jedynie przy audycie, backup/restore oraz zgodach Owner.

## Pakiet B: Analityka (M4–M5)
**M4 Dashboard**: tylko liczniki potwierdzone źródłem i zakresem, dzień/7/30 dni, aktywni/pending/wypisani/suppressed, DOI rate, trendy, źródła, freshness, provider health, brakujące dane jako „niedostępne”, nie zero; odróżnić current-page vs global.
**M5 Conversion**: kampania -> zweryfikowane kliknięcie -> faktyczna wizyta -> udana rejestracja konta; UTM i pseudonimowy ograniczony czasowo identyfikator, brak email/PII w URL, filtrowanie botów/security scanners, dokładna definicja unikalności i okna atrybucji, identyfikacja braków i ograniczeń wynikających ze zgody; rejestracja działa mimo awarii telemetrii. Raport liczba/kampania/okres/denominator/metodologia i rozdzielone confirmed/estimated/unknown.

**B ACCEPT:** raporty możliwe do odtworzenia na danych testowych, prawidłowa anonimizacja/pseudonimizacja, testy braków i fraud/replay, przegląd prywatności, samodzielne działanie rejestracji.

## Pakiet C: Komunikacja Premium (M6–M8)
**M6 Campaign Management**: własne wiadomości gracz.pl; jeden/wybrani/segment/wszyscy UPRAWNIENI odbiorcy; draft/review/approved/scheduled/queued/sending/paused/cancelled/completed/failed; przed wysyłką bieżące sprawdzenie consent+DOI+suppression i ponowna walidacja liczby odbiorców, podwójna autoryzacja OWNER. Bez cudzych płatnych kampanii.
**M7 Premium Editor**: sanitizowany HTML i czytelny tekst, szablony logo/grafiki/link/CTA, WCAG/mobile, podgląd, kopia wersji, test-send wyłącznie na zatwierdzony adres, zgodna stopka z unsubscribe, bez niebezpiecznych zewnętrznych treści.
**M8 Monitoring/Resend**: kolejka/outbox, batche/tempo i quota, idempotencja recipient+campaign, retry limits/jitter, suppression na ostatniej bramce, błędy, webhook podpis/replay, delivery/bounce/complaints/unsubscribe, alarmy i logi bez PII. Realne bulk sends tylko po wyraźnej odrębnej autoryzacji.

**C ACCEPT:** test dry-run, dokładne przewidywane odbiorcy i wykluczenia, test jednego maila na whitelist, brak duplikatów po restart/retry, stop/pause nie powoduje nowych wysyłek, dostarczenia/odbicia wiernie z webhooków.

## Bramki obowiązkowe i kolejność
G0 AS-IS inventory + konflikt PR/migracji + estymata kosztu/limitu. G1 niezależny arch/AppSec WebAuthn i Owner GO na implementację. G2 A implementacja/test/independent audit + dry-run i produkcyjna akceptacja. G3 B implementacja i privacy/analytics audit. G4 C implementacja i bezpieczeństwo wysyłek + testy tylko syntetyczne. G5 niezależny final cross-module audit, regresja, RODO + legal basis marketing, backup/DR, rollback, produkcyjny smoke, Owner GO do uruchomienia kampanii. G6 Owner manual UAT i CLOSED; dopiero potem L6.

Każda bramka: konkretne SHA commitów, odnośniki PR/checks, zakres testów, braki, werdykt PASS/HOLD/FAIL, rekomendacja i podpis/akceptacja Owner. Brak dowodu = NOT VERIFIED / HOLD. Brak samoczynnego przejścia przez HOLD.

## Reguły anty-opóźnieniowe
Jeden stabilny kontrakt danych, jeden backlog i delta-audyt względem poprzednio zatwierdzonego SHA; nie dublować przeglądów bez zmiany zagrożeń. Jeden PR na logiczną jednostkę zmian, minimum scope creep. Sekwencja bramek nie oznacza obowiązku czekania z pisaniem wyłącznie nieprodukcyjnych specyfikacji/testów. Bezpieczeństwo/RODO/DR i osobne Owner GO pozostają nienaruszalne.

## Sposób cotygodniowej i każdorazowej kontroli
Przy **każdym** zgłoszeniu wykonania/PR: pobrać aktualny HEAD main i danego PR, porównać z listą M1–M8 i kontrolą dowodów, nanieść zmianę statusu do TRACKER-R1.md na nowej gałęzi i PR (bez zmiany main w ciemno), podać Ownerowi: co doszło, co jest niegotowe, blocker, najbliższy krok. Bez czynnej automatyzacji sprawdzanie odbywa się podczas kolejnych zleceń lub po ustawieniu osobnego harmonogramu. Weryfikować też wpływ na terminy Gracz Next L6. Nie traktować raportu agenta jako PASS bez niezależnych dowodów.

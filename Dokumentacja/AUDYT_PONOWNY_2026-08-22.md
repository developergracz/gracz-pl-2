# Ponowny audyt modernizacji Gracz.pl — 22.08.2026

## Cel

Ponowny przegląd gałęzi `feature/checkers-engine-foundation` po pierwszej serii modernizacji, ze szczególnym naciskiem na bezpieczeństwo, utrzymywalność i możliwość rozwoju przez kolejne lata.

## Stan po audycie

### Fundament oceniony pozytywnie

- Node.js 24 LTS jako baza produkcyjna.
- Serwer autorytatywny dla rozgrywki.
- PostgreSQL dla kont i trwałych sesji gier.
- Szyfrowanie prywatnych wiadomości i załączników.
- Wersjonowane haszowanie haseł z migracją starszych skrótów do mocniejszego scrypt.
- Sesja przeglądarkowa oparta o `__Host-` cookie z `HttpOnly`, `Secure` i `SameSite`.
- Ograniczenia rozmiaru żądań i załączników.
- Testy Node oraz testy przeglądarkowe Playwright.
- Automatyczny deployment z GitHub do Render.

## Poprawki wykonane w tej rundzie

1. Podniesiono minimalne środowisko Node.js do wersji 24 LTS.
2. Zaktualizowano `pg` do bieżącej stabilnej linii 8.23.x.
3. Zaktualizowano Playwright do bieżącej stabilnej linii 1.62.x.
4. Dodano kontrolę składni krytycznych modułów przed testami.
5. Dodano `npm audit --omit=dev --audit-level=high` do CI.
6. Dodano limit czasu całego joba CI.
7. Usunięto błędną konfigurację cache npm opartą o `package.json` bez lockfile.
8. Rozbudowano nagłówki przeglądarkowe o CORP, Origin-Agent-Cluster i zakaz cross-domain policy.
9. Wydłużono HSTS do 1 roku.
10. Rozszerzono CSP o `font-src`, `media-src`, `worker-src` i `upgrade-insecure-requests`.
11. Usprawniono migrację starych tokenów Bearer do `HttpOnly` cookie.
12. Dodano odtwarzanie stanu użytkownika z `/auth/me`, gdy cookie istnieje, a pamięć karty jest pusta.
13. Usunięto ryzyko nieograniczonego wzrostu pamięci w lokalnym limiterze logowania przez czyszczenie i limit wpisów.

## Ustalenia wymagające następnych etapów

### P0 — przed publiczną wersją produkcyjną

- Pełny przepływ odzyskiwania hasła wymaga dostawcy poczty i wysyłania jednorazowego tokenu; token nie może być ujawniany w UI ani API.
- Należy ostatecznie wycofać zgodność z dawnymi tokenami Bearer po zakończeniu migracji użytkowników.
- Sesje logowania powinny uzyskać serwerową możliwość unieważniania (`jti`/session registry), aby wylogowanie i zmiana hasła unieważniały przejętą sesję również po stronie serwera.
- Rate limiting powinien zostać przeniesiony z pamięci procesu do współdzielonego magazynu (PostgreSQL/Redis) przed skalowaniem do wielu instancji.
- Endpointy tworzenia gier i pozostałe mutacje trzeba objąć pełnym przeglądem autoryzacji/IDOR przed publicznym ruchem.

### P1 — bezpieczeństwo frontendu

- Obecny CSP nadal czasowo dopuszcza `unsafe-inline`, ponieważ lobby zawiera skrypty i style inline. Należy przenieść je do osobnych plików i przejść na Strict CSP z nonce/hash.
- Należy usunąć pozostałości zależności frontendu od `sessionStorage`; może w nim pozostawać wyłącznie niesekretny stan UI, nigdy token uwierzytelniający.
- Formularz hasła powinien docelowo stosować ocenę jakości i blokowanie haseł popularnych/wyciekłych bez wymuszania sztucznych reguł typu „koniecznie wielka litera + symbol”.

### P1 — baza i operacje

- Dodać wersjonowane migracje SQL zamiast wykonywania wszystkich zmian schematu przy starcie procesu.
- Dodać test odtworzenia backupu PostgreSQL.
- Zweryfikować tryb TLS połączeń PostgreSQL i usunąć `rejectUnauthorized:false`, gdy środowisko zapewni poprawny łańcuch CA.
- Dodać centralne logi strukturalne i identyfikator żądania bez logowania sekretów, tokenów i treści prywatnych wiadomości.

### P2 — architektura długoterminowa

- Wydzielić wspólną platformę `games-core` dla Warcabów i Gomoku zamiast rozbudowywać moduł o nazwie `checkers-engine` jako monolit.
- Rozdzielić API kont, lobby, wiadomości i silniki gier na logiczne moduły z jasno zdefiniowanymi interfejsami.
- Dodać obserwowalność: metryki, health/readiness, monitoring błędów i alerty.
- Dodać politykę wersjonowania API i migracji protokołu klient-serwer.

## Ocena po ponownym audycie

Aktualny `modern/checkers-engine` jest wartościowym i nowoczesnym fundamentem, ale nadal jest etapem przedprodukcyjnym. Największą poprawą względem historycznego systemu jest odejście od Flash/SmartFox jako warstwy klienckiej, serwerowa kontrola reguł gry, PostgreSQL, nowoczesne haszowanie i bezpieczniejsze sesje. Największe pozostałe zadania przed publicznym uruchomieniem to pełny reset hasła przez e-mail, unieważnianie sesji po stronie serwera, współdzielony rate limit, Strict CSP oraz kompletny przegląd autoryzacji endpointów.

## Zasada dalszego rozwoju

Nie wprowadzamy technologii tylko dlatego, że są nowe. Preferujemy rozwiązania stabilne, szeroko wspierane, łatwe do wymiany i o długim cyklu życia. Aktualizacje zależności są automatycznie wykrywane, ale każda większa aktualizacja powinna przejść testy jednostkowe, integracyjne i przeglądarkowe przed wdrożeniem.

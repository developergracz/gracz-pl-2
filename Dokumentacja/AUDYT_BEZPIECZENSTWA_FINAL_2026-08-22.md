# Końcowy status audytu bezpieczeństwa — 2026-08-22

## Status ogólny

Audyt kodu został przeprowadzony na gałęzi `feature/checkers-engine-foundation`. Gałąź jest przed `main` i zawiera zarówno nowy silnik Warcabów, poprawki starego Gomoku, jak i serię zabezpieczeń starego serwisu PHP.

Nie należy jeszcze scalać tej gałęzi do produkcji bez wykonania punktów z sekcji „Wymagane przed wdrożeniem”.

## NAPRAWIONE — krytyczne / wysokie

- usunięcie jawnych sekretów z `website/variables_global.php`; konfiguracja przez zmienne środowiskowe,
- usunięcie wersjonowanego `.htpasswd` i blokada `.htpasswd`/`.env` w repo,
- przygotowanie rotacji ujawnionych sekretów,
- wymuszenie bezpieczniejszych sesji PHP i usunięcie możliwości narzucenia `PHPSESSID`,
- kryptograficzne tokeny CSRF (`random_bytes`) zamiast `rand()`,
- POST + CSRF dla operacji zmieniających stan w AJAX i panelach administracyjnych,
- migracja logowania ze starego SHA-1 do `password_hash()` z kompatybilnością przejściową,
- nowe rejestracje i zmiany hasła zapisują nowoczesne hashe,
- minimum 15 znaków dla nowych haseł,
- wyłączenie starego, niebezpiecznego resetu hasła generującego hasło,
- parametryzowane PDO w przebudowanych ścieżkach rejestracji, ustawień profilu i raportowania,
- kontekstowe escapowanie profilu, rankingów, widoków użytkowników i zapisów rozgrywek,
- zabezpieczenie zgłoszeń błędów/nadużyć przed stored XSS przeciw administratorowi,
- ograniczenie i utwardzenie uploadów reklam; usunięcie SWF/Flash,
- kontrola ADMINISTRATOR dla mailingu, reklam i wklejania kodów,
- poprawienie integralności załączników prywatnych wiadomości w nowym backendzie,
- TLS verification dla PostgreSQL w nowym backendzie,
- ochrona przed spoofowaniem nagłówków proxy w limiterach,
- poprawienie kolejności walidacji ruchu w starym serwerze Gomoku,
- serwerowa kontrola gracza i tury w nowym silniku Warcabów.

## ŚREDNIE / architektoniczne

- część rate limiting/Turnstile/lobby nowego silnika używa pamięci procesu; przy skalowaniu wieloinstancyjnym należy przenieść stan do wspólnego magazynu,
- stara biblioteka `website/library_main.php` nadal zawiera historyczne funkcje o słabych wzorcach; zabezpieczone ścieżki produkcyjne omijają część z nich, ale docelowo bibliotekę należy zastąpić,
- stary mechanizm wklejania arbitralnego kodu reklamowego jest funkcją wysokiego zaufania i powinien być docelowo zastąpiony kontrolowaną integracją reklamową.

## Wymagane przed wdrożeniem

1. Zmienić hasło produkcyjnej bazy MySQL, które historycznie znajdowało się w repozytorium.
2. Zmienić Facebook App Secret, który historycznie znajdował się w repozytorium.
3. Ustawić sekrety jako zmienne środowiskowe: co najmniej `DATABASE_PASSWORD`, `LEGACY_PASSWORD_PEPPER`, `FACEBOOK_APP_SECRET`.
4. Wykonać `website/migrations/2026-08-22_password_hash_upgrade.sql` i potwierdzić `prefix_users.password VARCHAR(255)`.
5. Przetestować istniejące konto SHA-1: pierwsze logowanie -> migracja hasha -> drugie logowanie na nowym hashu.
6. Przetestować rejestrację, zmianę profilu, zmianę hasła, wiadomości, znajomych, blacklistę, zgłoszenie błędu/nadużycia, panel administratora i upload reklamy.
7. Podłączyć nowy jednorazowy reset hasła do usługi e-mail przed ponownym włączeniem funkcji „zapomniałem hasła”.
8. Nie używać starego peppera po zakończeniu migracji wszystkich hashy SHA-1; wtedy należy go wycofać i usunąć zależność `LEGACY_PASSWORD_PEPPER`.

## Automatyczna regresja

Dodano `.github/workflows/legacy-php-security.yml`, który dla zmian w `website/**`:

- uruchamia `php -l` na wszystkich plikach PHP,
- odrzuca `.htpasswd`, `.env` i `.env.*`,
- próbuje wykryć oczywiste ponowne wpisanie sekretów do PHP.

Istniejący workflow `checkers-engine.yml` obejmuje nowy silnik Node.js (syntax, unit/integration, npm audit, testy przeglądarkowe), ale nie obejmuje starego PHP.

W momencie sporządzenia tego dokumentu API statusów GitHub nie zwracało jeszcze wyniku dla nowo dodanego workflow PHP, dlatego nie wolno interpretować samego istnienia workflow jako zaliczonego testu.

## Decyzja

Stan kodu po audycie jest istotnie bezpieczniejszy niż stan początkowy, ale status produkcyjny pozostaje: **WARUNKOWO GOTOWY DO TESTÓW, NIE GOTOWY DO BEZPOŚREDNIEGO SCALENIA NA PRODUKCJĘ** do czasu rotacji sekretów, migracji schematu hasła i przejścia testów regresyjnych.

# Audyt modernizacji Gracz.pl — 22 sierpnia 2026

## Cel

Celem tego przeglądu jest ocena aktualnie wdrażanej gałęzi `feature/checkers-engine-foundation` jako fundamentu platformy Gracz.pl rozwijanej przez kolejne 10–15 lat. Audyt obejmuje architekturę, bezpieczeństwo, przechowywanie danych, multiplayer, CI/CD, frontend oraz gotowość do skalowania.

## Decyzja architektoniczna

Aktualnego projektu nie należy wyrzucać ani przepisywać od zera. Nowy moduł `modern/checkers-engine` jest właściwym kierunkiem i powinien stać się bazą nowej platformy. Historyczne katalogi `website` i `games-dev` powinny pozostać materiałem referencyjnym do odtwarzania funkcji i wyglądu, ale nie powinny być używane jako kod produkcyjny.

Docelowa zasada: serwer jest autorytatywny dla stanu gry, dane trwałe są przechowywane w PostgreSQL, klient HTML5 odpowiada za prezentację i wejście użytkownika, a poszczególne gry są rozwijane jako osobne moduły domenowe korzystające ze wspólnych usług kont, lobby, wiadomości, rankingu i bezpieczeństwa.

## Co już jest dobre i zostaje

- Node.js w nowoczesnej wersji i kod modułowy ES Modules.
- Serwer autorytatywny dla Warcabów zamiast zaufania do klienta.
- PostgreSQL dla kont i wiadomości.
- Scrypt z indywidualną solą dla nowych haseł.
- Szyfrowanie prywatnych wiadomości i załączników przy użyciu AES-256-GCM i kluczy wyprowadzanych przez HKDF.
- Ograniczenie typów i rozmiaru załączników oraz kontrola sygnatur plików.
- Rate limiting logowania jako pierwszy poziom ochrony.
- Testy jednostkowe, integracyjne i testy przeglądarkowe Playwright.
- Kontener uruchamiany jako użytkownik nieuprzywilejowany `node` i healthcheck.
- Rozdzielenie nowoczesnego modułu od historycznego kodu Flash/PHP.
- Automatyczne wdrażanie na Render jako środowisko testowe.

## Zmiany wykonane podczas tego audytu

### 1. Trwałe sesje multiplayer w PostgreSQL — wykonane

Dotychczas konta były przechowywane w PostgreSQL, natomiast aktywne sesje gier w plikach lokalnych. Taki układ nie jest odpowiedni dla hostingu z efemerycznym systemem plików ani dla wielu instancji aplikacji.

Dodano `PostgresSessionStore`, tabelę `gracz_game_sessions` oraz automatyczny wybór PostgreSQL, gdy dostępny jest `DATABASE_URL`. Plikowy magazyn sesji pozostaje wyłącznie jako tryb developerski.

Efekt: stan rozgrywek nie jest już zależny od lokalnego dysku jednej instancji Render i powstaje podstawa do skalowania poziomego.

### 2. Kontrolowane zamykanie usług — wykonane

Proces zamyka serwer HTTP i połączenia z PostgreSQL podczas `SIGINT`/`SIGTERM`. Ogranicza to ryzyko niedomkniętych zasobów podczas restartów i wdrożeń.

### 3. CI dla faktycznie wdrażanej gałęzi — wykonane

Workflow `CheckersEngine` uruchamia się teraz również dla `feature/checkers-engine-foundation`, a nie tylko `main`. Dodano kontrolę współbieżności, aby starszy test był anulowany po nadejściu nowszego commitu.

## Najważniejsze otwarte ryzyka

### P0 — przed publicznym uruchomieniem

1. **Reset hasła oparty na samym loginie i adresie e-mail.** Obecny mechanizm zmienia hasło po podaniu danych konta. Docelowo reset musi używać kryptograficznego, jednorazowego tokenu o krótkim czasie życia, wysłanego na zweryfikowany adres. Token powinien być przechowywany w bazie jako skrót i unieważniany po użyciu.

2. **Brak pełnego modelu sesji produkcyjnej.** Obecny token HMAC jest krótko żyjący, ale nie ma mechanizmu centralnego unieważnienia, rotacji odświeżania i zarządzania urządzeniami. Docelowo należy zastosować krótką sesję dostępową oraz bezpieczny mechanizm odświeżania albo sesje serwerowe w cookie `HttpOnly`, `Secure`, `SameSite`.

3. **TLS PostgreSQL z `rejectUnauthorized: false`.** Jest praktyczne dla części usług zarządzanych, ale docelowo połączenie produkcyjne powinno weryfikować certyfikat CA dostawcy bazy.

4. **Brak wersjonowanych migracji bazy.** Schemat jest obecnie tworzony i rozszerzany podczas startu aplikacji. Należy wprowadzić migracje z numerami wersji, kontrolą kolejności oraz procedurą backup/restore.

5. **Brak twardej polityki nagłówków HTTP/CSP.** Przed produkcją należy wdrożyć CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` i politykę ramek. Część obecnego frontendu wykorzystuje kod inline, więc CSP wymaga wcześniejszego wyniesienia skryptów do plików.

### P1 — przed większym ruchem

6. **Rate limiter jest lokalny dla procesu.** Przy wielu instancjach próby logowania nie będą współdzielone. Należy przenieść licznik do PostgreSQL/Redis lub zewnętrznego rate limitera na brzegu infrastruktury.

7. **Brak centralnej obserwowalności.** Należy wprowadzić strukturalne logi JSON, identyfikatory requestów, metryki błędów i opóźnień oraz alarmy.

8. **Brak wersjonowania API.** Wraz z Gomoku i kolejnymi grami należy ustalić stabilny kontrakt `/api/v1/...` albo równoważny schemat kompatybilności.

9. **Brak oddzielnej warstwy wspólnych usług.** Konta, lobby, wiadomości i gry są jeszcze w jednym procesie. Nie trzeba od razu budować mikroserwisów, ale granice modułów powinny być jawne, aby później możliwe było ich rozdzielenie bez przepisywania klienta.

10. **Brak pełnego modelu uprawnień i moderacji.** Przed publikacją trzeba wprowadzić role, blokady, raportowanie nadużyć, audyt operacji administracyjnych i reguły retencji danych.

### P2 — rozwój długoterminowy

11. Wydzielenie wspólnego SDK/protokołu dla Warcabów, Gomoku i kolejnych gier.
12. Ranking i matchmaking jako niezależny moduł domenowy.
13. Kolejka zdarzeń dla zdarzeń asynchronicznych, jeżeli skala będzie tego wymagać.
14. CDN/cache dla zasobów statycznych.
15. Testy obciążeniowe multiplayer i długich połączeń SSE/WebSocket.
16. Progressive Web App lub natywna otoczka dopiero po ustabilizowaniu wersji webowej.

## Docelowy model na 10–15 lat

Zalecana architektura to modułowy monolit z wyraźnymi granicami domenowymi na początku, a nie przedwczesne mikroserwisy. Wspólny rdzeń powinien obejmować konto, sesję, profil, wiadomości, lobby, ranking i moderację. Każda gra powinna mieć własny silnik reguł i adapter multiplayer, ale korzystać ze wspólnej tożsamości i infrastruktury.

Proponowane moduły:

- `identity` — konta, sesje, MFA, reset hasła, urządzenia;
- `social` — profile, kontakty, prywatne wiadomości, blokady;
- `lobby` — obecność, pokoje, zaproszenia, obserwatorzy;
- `games/checkers` — zasady Warcabów, stan partii, walidacja ruchów;
- `games/gomoku` — zasady Gomoku i stan partii;
- `ranking` — wyniki, ELO/wybrany system, historia;
- `moderation` — zgłoszenia, bany, audyt administratora;
- `web` — responsywny klient HTML5;
- `platform` — konfiguracja, logowanie, migracje, monitoring i deployment.

## Zasady dalszej przebudowy

1. Nie kopiować starego kodu PHP/Flash do nowej części projektu.
2. Stare rozwiązania traktować jako specyfikację zachowania i wyglądu.
3. Każda logika wpływająca na wynik gry musi być walidowana po stronie serwera.
4. Każda trwała informacja użytkownika lub partii musi mieć trwałe repozytorium danych i migrację.
5. Każda nowa funkcja musi mieć test co najmniej na poziomie jednostkowym lub integracyjnym; krytyczne ścieżki również E2E.
6. Nie wprowadzać zależności bez uzasadnienia i planu aktualizacji.
7. Bezpieczeństwo kont, prywatność i audyt administracyjny traktować jako część architektury, nie dodatek na końcu.
8. Rozwój mobile-first/responsive, ale z zachowaniem pełnej wersji desktopowej dla graczy.
9. Każda większa zmiana powinna przejść CI przed uznaniem jej za gotową.
10. Produkcja i środowisko testowe muszą mieć oddzielne dane i sekrety.

## Kolejność dalszych prac

1. Bezpieczny reset hasła i weryfikacja e-mail.
2. Produkcyjny model sesji użytkownika i możliwość unieważnienia sesji.
3. Migracje PostgreSQL i rozdzielenie inicjalizacji od startu aplikacji.
4. Nagłówki bezpieczeństwa i CSP po usunięciu skryptów inline.
5. Współdzielony rate limiting.
6. Dokończenie Warcabów wraz z rankingiem i pełnym lifecycle partii.
7. Przeniesienie Gomoku na ten sam wspólny protokół multiplayer.
8. Responsywność/mobile oraz testy na głównych przeglądarkach.
9. Monitoring, backup/restore i testy obciążeniowe.
10. Dopiero potem rozbudowa o kolejne gry, turnieje, sklep i funkcje społecznościowe.

## Wniosek

Obecna nowa część Gracz.pl jest wartościowym fundamentem, ale nadal jest etapem przedprodukcyjnym. Najlepszą strategią jest dalsza ewolucyjna przebudowa, bez cofania się do historycznego stosu i bez przepisywania wszystkiego jednocześnie. Po wykonanych podczas tego audytu zmianach najważniejsza luka infrastrukturalna — nietrwałe sesje rozgrywek — została usunięta dla środowiska z PostgreSQL. Kolejne prace powinny koncentrować się na bezpieczeństwie tożsamości, migracjach i wspólnych usługach platformy.

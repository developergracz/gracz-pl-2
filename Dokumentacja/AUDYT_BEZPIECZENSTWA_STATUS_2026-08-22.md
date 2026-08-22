# Gracz.pl — status audytu bezpieczeństwa

Data: 2026-08-22
Gałąź: `feature/checkers-engine-foundation`

## KRYTYCZNE — wykryte i naprawione

- Usunięto wersjonowany `website/.htpasswd`; pliki `.htpasswd` i `.env*` są ignorowane przez Git.
- Usunięto jawne sekrety z `website/variables_global.php`. Hasło bazy, legacy password pepper i sekret Facebooka muszą pochodzić ze zmiennych środowiskowych.
- Ujawnione wcześniej sekrety należy uznać za skompromitowane i obrócić/zmienić po stronie usług przed wdrożeniem.

## WYSOKIE — naprawione

- Zablokowano możliwość narzucenia `PHPSESSID` przez POST (session fixation).
- Włączono strict mode i cookie-only dla sesji; cookie ma `HttpOnly`, `SameSite=Lax`, a przy HTTPS także `Secure`.
- Logi błędów maskują pola hasła, tokenów i sesji.
- Operacje zmieniające stan w AJAX (wiadomości, blacklisty, znajomi, zaproszenia, zgłoszenia błędów/nadużyć) wymagają POST zamiast `$_REQUEST`.
- Panele `admin_reported_abuses.php` i `admin_reported_bugs.php` wymagają roli administratora i nie wykonują akcji przez GET.
- Rejestracja używa parametryzowanego PDO, `random_int()`, CSRF tokenu, sprawdza zgodę regulaminową oraz wymaga minimum 15 znaków hasła.
- Zmiana hasła używa parametryzowanego PDO, CSRF tokenu, minimum 15 znaków i ponownej weryfikacji starego hasła.
- Niebezpieczny stary reset hasła (generowane hasło + liczbowy kod) został wyłączony do czasu podłączenia nowego resetu jednorazowym tokenem.
- Stary `Gomoku MoveHandler` waliduje zakres współrzędnych, turę, stan gry i wolne pole przed zapisem ruchu do bazy.
- PostgreSQL w nowym backendzie ma wymuszoną weryfikację certyfikatu TLS.

## WYSOKIE — pozostaje do wykonania

1. `FormatujTekst()` w `website/library_main.php` jest legacy formatterem HTML/BBCode. Dopuszcza niebezpieczne konstrukcje URL i nie wykonuje nowoczesnej sanitizacji wejścia. Należy zastąpić go allowlistowym parserem/sanitizerem i przetestować wszystkie miejsca użycia.
2. Stary model haseł SHA-1 + pepper pozostaje kompatybilnościowo aktywny. Należy sprawdzić schemat kolumny `users.password`, rozszerzyć ją do `VARCHAR(255)` (jeśli potrzeba), a następnie wdrożyć migrację przy logowaniu do `password_hash()`/Argon2id lub bcrypt.
3. Wszystkie sekrety ujawnione historycznie w Git muszą zostać obrócone; samo usunięcie z bieżącej wersji nie usuwa ich z historii Git.
4. `CreateAccountFromFacebook()` i część innych starych funkcji w `library_main.php` nadal budują SQL przez konkatenację. Muszą zostać zastąpione zapytaniami parametryzowanymi przed przywróceniem tych funkcji do produkcji.

## ŚREDNIE — pozostaje do wykonania

- `profil.php` i część starych widoków nie kodują konsekwentnie wszystkich danych pochodzących z bazy przed HTML. Należy przejść pole po polu i zastosować `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')` lub odpowiednie kodowanie kontekstowe.
- Stary kod korzysta z bibliotek jQuery z bardzo dawnych wersji. Docelowo należy je usunąć/zaktualizować.
- Stary PHP miesza PDO z pozostałościami `mysql_*`; wymaga pełnej konsolidacji na PDO.
- Lobby nowego multiplayera przechowuje część stanu w pamięci procesu i wymaga limitów/TTL lub wspólnego magazynu przy skalowaniu.

## Stan nowych modułów

- Nowe sesje/autoryzacja: HMAC-SHA256, `jti`, `iss`, `aud`, wygasanie tokenów, unieważnianie sesji.
- Hasła nowego backendu: scrypt z parametrami zgodnymi z aktualnymi rekomendacjami projektu.
- Reset nowego backendu: losowy token, w bazie tylko hash, ważność 15 minut, jednorazowość.
- Załączniki wiadomości: PNG/JPEG, weryfikacja sygnatury, limit 1 MB, AES-256-GCM, brak późniejszej podmiany.
- Warcaby: serwer weryfikuje członkostwo w partii, kolejkę ruchu i idempotencję requestów.

## Kolejność następnych prac

1. Obrócić historycznie ujawnione sekrety i skonfigurować zmienne środowiskowe.
2. Podłączyć bezpieczną wysyłkę e-mail do nowego resetu hasła.
3. Zastąpić/odizolować `FormatujTekst()` i sprawdzić stored XSS w starych widokach.
4. Migracja SHA-1 po potwierdzeniu schematu bazy.
5. Dokończyć parametryzację legacy SQL, zaczynając od Facebook registration i funkcji administracyjnych.
6. Test regresyjny całego przepływu: rejestracja → aktywacja → logowanie → wiadomość → gra → zmiana hasła → wylogowanie.

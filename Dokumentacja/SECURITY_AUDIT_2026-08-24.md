# Gracz.pl — audyt bezpieczeństwa

Data: 2026-08-24
Repozytorium: developergracz/gracz-pl-2
Status: etap 1 — krytyczne ryzyka i fundamenty uwierzytelniania

## P0 — krytyczne

1. Repozytorium jest publiczne, a w kodzie znajdowały się aktywne sekrety.
2. `website/.htpasswd` był śledzony przez Git. Plik usunięto z bieżącej gałęzi i dodano reguły ignorowania.
3. `website/variables_global.php` zawiera jawne dane dostępowe i sekrety aplikacyjne. Należy je NATYCHMIAST obrócić u dostawców i przenieść do zmiennych środowiskowych. Samo usunięcie ich z aktualnego pliku nie wystarczy, ponieważ pozostają w historii Git.
4. Przed wdrożeniem zmian należy potwierdzić, która wersja repozytorium jest aktualnie źródłem wdrożenia Render, ponieważ bieżące repo ma tylko starą linię kodu PHP i może nie zawierać późniejszych zmian wykonanych w serwisie testowym.

## P1 — wysokie

1. Uwierzytelnianie wykorzystuje SHA-1 z prywatnym ziarnem. Migracja: `password_hash()` + Argon2id/bcrypt oraz `password_verify()`.
2. Hash hasła jest zapisywany w `$_SESSION`; należy usunąć to zachowanie.
3. Minimalna długość hasła wynosi 6 znaków. Docelowo wymagane minimum 10–12 znaków oraz blokada haseł popularnych/ujawnionych.
4. Konfiguracja bazowego adresu używa `http://`; produkcja powinna wymuszać HTTPS i HSTS.
5. `production_mode` jest ustawione na `false` w wersji repozytorium.

## P2 — kolejne obszary audytu

- CSRF dla wszystkich operacji zmieniających dane.
- XSS i sposób renderowania treści użytkowników.
- SQL Injection i kompletność użycia prepared statements.
- uploady/załączniki: MIME, rozszerzenia, limity, skanowanie, izolacja katalogu.
- sesje: Secure, HttpOnly, SameSite, regeneracja ID, czas życia, unieważnianie.
- reset hasła i aktywacja konta.
- uprawnienia administratora i IDOR.
- rate limiting logowania, rejestracji, wiadomości i endpointów AJAX.
- nagłówki bezpieczeństwa: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- logi i dane osobowe.
- zależności i podatności bibliotek.

## Zmiany wykonane w etapie 1

- Usunięto `website/.htpasswd` z bieżącej gałęzi.
- Rozszerzono `website/.gitignore` o `.htpasswd`, `.env`, klucze/certyfikaty i logi runtime.
- Rozpoczęto audyt logowania i rejestracji.

## Następny krok

1. Ustalić aktualne źródło wdrożenia Render i zsynchronizować je z GitHub.
2. Obrócić wszystkie ujawnione sekrety.
3. Przenieść sekrety do zmiennych środowiskowych.
4. Zmodernizować mechanizm haseł i sesji bez utraty istniejących kont.
5. Wykonać audyt endpointów AJAX i formularzy pod kątem CSRF/XSS/IDOR.

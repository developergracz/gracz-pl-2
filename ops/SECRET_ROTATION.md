# Gracz.pl — rotacja sekretów

W historycznym kodzie repozytorium znajdowały się dane uwierzytelniające zapisane bezpośrednio w plikach. Samo usunięcie ich z bieżącej wersji nie unieważnia starych wartości ani nie usuwa ich z historii Git.

## Wykonać przed produkcyjnym wdrożeniem
1. Zmień hasło użytkownika bazy danych aplikacji i zapisz nowe wyłącznie w managerze sekretów hostingu.
2. Wygeneruj/obróć wszystkie klucze API i OAuth, które kiedykolwiek były commitowane, w tym klucze usług mailowych, Facebook/OAuth, Cloudflare/Turnstile jeśli dotyczy.
3. Wygeneruj nowe `GRACZ_APP_KEY`, `GRACZ_AUDIT_PEPPER` i `GRACZ_DATA_ENCRYPTION_KEY` osobno dla production/staging/development.
4. `GRACZ_PASSWORD_PEPPER` jest związany ze starymi hashami haseł. Nie obracaj go samodzielnie przed migracją haseł, bo stare konta przestaną się logować. Zaplanuj migrację do `password_hash()`/Argon2id.
5. Sprawdź logi usług pod kątem użycia starych sekretów po dacie rotacji.
6. Po rotacji rozważ oczyszczenie historii Git za pomocą `git filter-repo`/BFG, jeśli repozytorium było udostępniane. Rotacja pozostaje obowiązkowa nawet po przepisaniu historii.
7. Włącz ochronę push/secret scanning w ustawieniach GitHub, jeśli plan repozytorium to obsługuje, i pozostaw Gitleaks w CI jako niezależną warstwę.

## Zasada
Sekret znaleziony choć raz w publicznym lub współdzielonym repozytorium traktujemy jako ujawniony — niezależnie od tego, czy plik został później usunięty.

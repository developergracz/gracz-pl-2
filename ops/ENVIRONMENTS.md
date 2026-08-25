# Gracz.pl — separacja środowisk

## Production
- `GRACZ_ENV=production`, osobna baza, osobny użytkownik DB, osobne klucze szyfrowania, Turnstile i poczty.
- Wyłącznie prawdziwe dane użytkowników.
- Debug wyłączony; HTTPS wymagany; backup szyfrowany i monitorowany.

## Staging
- Osobna baza bez kopii danych produkcyjnych.
- Syntetyczne konta/testowe adresy e-mail.
- Inne klucze `GRACZ_APP_KEY`, `GRACZ_DATA_ENCRYPTION_KEY`, DB, OAuth i Turnstile niż production.
- Tu najpierw uruchamiać migracje i test odtworzenia backupu.

## Development
- Lokalna/izolowana baza z danymi sztucznymi.
- Brak dostępu do produkcyjnych sekretów i backupów.
- `display_errors` może być włączone, ale logowanie nadal korzysta z redakcji sekretów.

## Zasady wdrożenia
1. Nigdy nie kopiuj `.env` między środowiskami.
2. Nigdy nie importuj produkcyjnej bazy do staging/dev. Jeśli wyjątkowo potrzebny jest realistyczny zestaw danych, najpierw wykonaj nieodwracalną anonimizację poza środowiskiem testowym.
3. Migracje bezpieczeństwa uruchamiaj najpierw na staging.
4. Produkcja powinna wdrażać wyłącznie commit, który przeszedł `Security gates`.
5. Po wdrożeniu wykonaj smoke test: rejestracja, logowanie, błędne logowanie, reset hasła, newsletter, wylogowanie, 2FA administratora, wiadomości i upload.
6. Sekrety przechowuj w managerze sekretów hostingu/Cloudflare/Render, nigdy w GitHubie ani w plikach repozytorium.

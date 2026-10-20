# gracz.pl — prywatny panel Newsletter OWNER R1
**Zakres:** tylko nowe subskrypcje z `newsletter_new`. Nie importuje historycznych adresów, nie wysyła kampanii, nie edytuje zgód, nie instaluje zewnętrznego IdP.

## Jedyna kolejność produkcyjnego uruchomienia
1. Potwierdź istniejący punkt odzyskania PITR lub przywracalną kopię DB Render.
2. W prywatnym **Render Shell gracz-contact-api** zastosuj **raz** `contact-api/persistence/new-only/003_owner_sessions.sql` do tej samej bazy, co API, używając `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f contact-api/persistence/new-only/003_owner_sessions.sql`. Zmienia wyłącznie nowy schemat `newsletter_owner`, nie migrację 005 ani subskrybentów. Dla wydzielonej roli API: USAGE schematu, SELECT/UPDATE guard; SELECT/INSERT/UPDATE/DELETE sessions; SELECT/INSERT audit. **Brak uprawnień UPDATE/DELETE/TRUNCATE audit**. Używana dotychczas rola właściciela schematu może nie wymagać oddzielnych GRANT.
3. Dopiero po potwierdzonym CI i zatwierdzeniu produkcyjnego wdrożenia zmerguj PR i zrób manualny deploy **tylko** `gracz-contact-api`. `NEWSLETTER_OWNER_ADMIN_ENABLED` pozostawiać pusty/0 aż do skonfigurowania właściciela. Przy 0 wszystkie trasy admina odpowiadają 403.
4. Uruchom **interaktywnie, prywatnie** `node contact-api/admin-r1/setup-owner.mjs` w Render Shell. Wpisz mocne hasło bez echa i dodaj wygenerowany klucz do aplikacji Authenticator (TOTP SHA1/6 cyfr/30 sekund). Skrypt sprawdzi kod przed wydaniem dwóch wartości dla prywatnych ustawień Render. **Nie wykonuj zrzutów ekranu, nie przesyłaj sekretów do GitHub, czatu ani logów.**
5. W `gracz-contact-api → Environment` wpisz wyłącznie `NEWSLETTER_OWNER_PASSWORD_VERIFIER` (wygenerowany scrypt), `NEWSLETTER_OWNER_TOTP_SECRET` (wygenerowany klucz) oraz `NEWSLETTER_OWNER_ADMIN_ENABLED=1`. Zachowaj je jako prywatne Render secret env. Po redeploy otwórz `https://gracz-contact-api.onrender.com/owner/newsletter/login` i zaloguj się.
6. Sprawdź jedną prywatną sesję: błędny kod odrzucony, prawidłowy kod wpuszcza, lista pokazuje nowe potwierdzone zgody, a wylogowanie natychmiast blokuje dane. Panel wyłącznie do odczytu.

## Bezpieczeństwo i wyłączenie
- Wyłącznie HTTPS, na sztywno: host `gracz-contact-api.onrender.com`, bez `www`, bez CORS, bez dowolnego hosta w X-Forwarded-Host.
- Hasło jest scrypt; 20-bajtowy klucz TOTP **tylko** w prywatnych ustawieniach Render, nigdy w bazie; jeden wykorzystany krok kodu nie może być ponownie użyty.
- 5 błędnych prób → 15 minut blokady w PostgreSQL. Sesja: max 8 h, bezczynność max 15 min, token tylko jako SHA-256 w DB; cookie Secure HttpOnly SameSite Strict; CSRF i kontrola Origin; trwały audyt bez PII.
- Zmiana hasła lub seed unieważnia dotychczasowe sesje. Utrata telefonu wymaga bezpiecznego ponownego skonfigurowania właściciela przez dostęp do Render; nigdy nie ma zdalnego obejścia kodu.
- W razie problemu ustaw `NEWSLETTER_OWNER_ADMIN_ENABLED=0` i zapisz Render Environment. Nie kasuj bazowych tabel zgód ani `newsletter_owner.audit`. Publiczny newsletter nadal działa niezależnie.


## Opcja OWNER bez telefonu — nick + hasło

Zmiana wyłącznie sposobu logowania, bez zmian w bazie, liście subskrybentów ani w migracji 003. Wymaga jawnego wyboru przez właściciela. Brak drugiego składnika to niższy poziom ochrony niż TOTP.

1. Po przejściu obowiązkowego CI scal PR na `main`, a następnie wykonaj jeden manualny deploy samego `gracz-contact-api`. **Nie aktywuj nowego trybu przed wdrożeniem kodu.** Domyślnie pozostaje dotychczasowy Authenticator.
2. W prywatnym Render Environment usługi `gracz-contact-api` ustaw:
   - `NEWSLETTER_OWNER_USERNAME` — wybrany nick: od 3 do 32 znaków, pierwsza litera A–Z/a–z, dalej tylko litery, cyfry, `.`, `_`, `-`; wielkość liter ma znaczenie;
   - `NEWSLETTER_OWNER_PASSWORD_ONLY_ENABLED=1` — świadome wyłączenie wymogu TOTP;
   - pozostaw istniejące `NEWSLETTER_OWNER_PASSWORD_VERIFIER` i `NEWSLETTER_OWNER_ADMIN_ENABLED=1` bez zmian.
3. Wybierz `Save, deploy` w Render lub po `Save only` wykonaj **jedno** ręczne wdrożenie. Sprawdź w prywatnym oknie `https://gracz-contact-api.onrender.com/owner/newsletter/login`, czy pojawiają się wyłącznie nick i hasło. Zaloguj się, potwierdź listę i wylogowanie. **Nie udostępniaj hasła ani zmiennych środowiskowych.**
4. Po potwierdzeniu działania możesz usunąć nieużywany `NEWSLETTER_OWNER_TOTP_SECRET`; wymaga to osobnego zapisu. Jeżeli chcesz zachować możliwość przywrócenia TOTP, przechowuj sekret tylko w prywatnym Render Environment.
5. Rollback: ustaw `NEWSLETTER_OWNER_PASSWORD_ONLY_ENABLED=0` i ponownie uruchom usługę; wymagany jest prawidłowy dotychczasowy `NEWSLETTER_OWNER_TOTP_SECRET`. Zmiana trybu/nicku/weryfikatora unieważnia stare sesje.

**Bezpieczeństwo:** w obu trybach pozostają: scrypt hasła, jedna sesja OWNER, blokada po 5 próbach na 15 min w PostgreSQL, audyt bez danych osobowych, limit 8 godzin i bezczynność 15 min, Secure/HttpOnly/SameSite cookies, CSRF, HTTPS i ograniczenie hosta. Nie ma możliwości rejestracji, resetu hasła przez e-mail ani publicznej edycji subskrybentów.

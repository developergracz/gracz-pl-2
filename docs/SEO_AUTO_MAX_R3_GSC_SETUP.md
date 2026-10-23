# GRACZ.PL SEO AUTO MAX R3 — podłączenie Google Search Console

## Zakres
Panel OWNER: `https://gracz-contact-api.onrender.com/owner/newsletter/seo`
Dane wyłącznie do odczytu: Search Analytics, indeks URL, PageSpeed, SEO LIVE.
Brak nowego loginu, automatycznego publikowania treści i zmian newslettera.

## Jednorazowa konfiguracja Google
1. W Google Cloud wybierz własny projekt i aktywuj **Google Search Console API**.
2. Utwórz **service account** (konto usługi Google) i prywatny klucz JSON.
   Nie wysyłaj klucza w rozmowie, e-mailu ani do GitHuba.
3. W Search Console > Ustawienia > Użytkownicy i uprawnienia dodaj adres
   e-mail konta usługi jako uprawnionego użytkownika właściwości gracz.pl.
   Do odczytu raportów użyj co najmniej wymaganych praw Search Console.
4. W Render > `gracz-contact-api` > Environment dodaj **sekrety**:
   - `SEO_GSC_CLIENT_EMAIL` — `client_email` z JSON Google.
   - `SEO_GSC_PRIVATE_KEY` — `private_key` (PEM, także zapis z `\\n`).
   - `SEO_GSC_PROPERTY` — dokładnie `sc-domain:gracz.pl`
     **albo** `https://gracz.pl/` zależnie od własności w Search Console.
5. Zapisz i wdroż Render. Zaloguj się istniejącym kontem OWNER;
   otwórz sekcję **Google Search Console** w panelu SEO.

Nie ustawiaj sekretów w kodzie, w GitHub Actions ani po stronie przeglądarki.
Brak któregoś parametru oznacza stan `needs_configuration`, a błąd API —
`unavailable`, nigdy domyślne "zero" ani "indeksowane".
Pozycje są uśredniane przez Google, raport przychodzi z opóźnieniem.

## Bezpieczeństwo i częstotliwości
- OAuth 2.0 **JWT service-account** + scope `webmasters.readonly`.
- Token dostępowy wyłącznie w pamięci procesu, odnawiany automatycznie.
- Raport Search Analytics: maksymalnie cztery zapytania, pamięć 6 godzin.
- Kontrola indeksu: wyłącznie adresy z aktualnej mapy witryny,
  po zalogowaniu OWNER i weryfikacji CSRF; pamięć 12 godzin na URL.
- PageSpeed: strona główna, mobile, ręczny odczyt, pamięć 24 godziny.
  `SEO_PAGESPEED_API_KEY` opcjonalny; Google może ograniczać dostęp bez klucza.
- Historia panelu jest tymczasowa i może się zerować po restarcie. GitHub
  Actions nadal monitoruje techniczne SEO raz na godzinę i zachowuje wyniki w CI.
- Google URL Inspection zwraca stan **indeksu Google**, a nie test LIVE.

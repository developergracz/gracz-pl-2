# Cloudflare WAF dla newslettera Gracz.pl

Status: reguły przygotowane do włączenia w strefie `gracz.pl`. Backend pozostaje ostateczną warstwą ochrony; WAF ma odcinać oczywisty ruch zanim dotrze do Rendera.

## Kolejność wdrożenia

1. W Cloudflare ustaw SSL/TLS na **Full (strict)** i potwierdź poprawny certyfikat originu.
2. W Security > WAF > Custom rules dodaj regułę blokującą metody inne niż GET/POST dla ścieżek zaczynających się od `/newsletter/`:
   `starts_with(http.request.uri.path, "/newsletter/") and not http.request.method in {"GET" "POST"}`
3. Dodaj regułę Managed Challenge dla ruchu o wysokim wyniku botowym do `/newsletter/subscribe` i `/newsletter/resend`. Wyklucz zweryfikowane boty i nie opieraj reguły wyłącznie na kraju.
4. Dodaj łagodne limity brzegowe (per IP), pozostawiając dokładniejsze limity per e-mail/nick backendowi:
   - POST `/newsletter/subscribe`: 20 żądań / 10 min, Managed Challenge;
   - POST `/newsletter/resend`: 10 / godz., Managed Challenge;
   - GET `/newsletter/nick-availability`: 120 / godz., Managed Challenge;
   - GET lub POST `/newsletter/confirm`: 60 / 15 min, Managed Challenge.
5. Najpierw uruchom reguły w trybie Log/Managed Challenge na 24–48 godzin. Po sprawdzeniu fałszywych trafień dopiero podnoś reakcję do Block dla jednoznacznych nadużyć.
6. Nie cache'uj `/newsletter/*`. Usuń parametry `token` z logów i analityki URL.

## Alerty aplikacji

Ustaw w Renderze:
- `SECURITY_ALERT_WEBHOOK` — prywatny webhook odbierający JSON z alertem;
- `MONITOR_HASH_SALT` — losowy sekret używany wyłącznie do pseudonimizacji źródeł.

Webhook otrzymuje tylko typ alertu, czas, licznik i 16-znakowy fingerprint źródła. Nie otrzymuje IP, adresu e-mail, nicku ani tokenu. Rotacja `MONITOR_HASH_SALT` uniemożliwia łączenie fingerprintów sprzed i po rotacji.

## Weryfikacja po wdrożeniu

- sprawdź normalny zapis i Turnstile na komputerze oraz telefonie;
- wyślij kontrolowaną serię żądań i potwierdź 429/Managed Challenge;
- potwierdź, że alert dochodzi tylko raz w czasie cooldownu;
- wyszukaj w logach przykładowy e-mail, token i IP — nie mogą występować w payloadzie webhooka;
- obserwuj Security Events oraz błędy 403/429 przez pierwsze 48 godzin.

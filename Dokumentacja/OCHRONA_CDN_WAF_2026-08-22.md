# Gracz.pl — ochrona CDN/WAF i anty-bot

## Stan aplikacji

Aplikacja posiada warstwowe limity po IP, koncie, parze IP+konto i klasie endpointu. Osobne progi obowiązują dla logowania, rejestracji, resetu hasła, wiadomości, załączników, zaproszeń, pokoi, chatu i ruchów gry. Dodatkowo działa adaptacyjny mechanizm challenge oparty o Cloudflare Turnstile, ale aktywuje się dopiero po ustawieniu kluczy środowiskowych.

## Zmienne środowiskowe Render

- `TURNSTILE_SITE_KEY` — publiczny klucz widgetu Cloudflare Turnstile.
- `TURNSTILE_SECRET_KEY` — tajny klucz weryfikacji Turnstile; nigdy nie umieszczać go w repozytorium.
- `TURNSTILE_HOSTNAME` — docelowo `gracz.pl`.
- `TRUST_CLOUDFLARE_HEADERS=true` — ustawić dopiero po przełączeniu ruchu przez Cloudflare i zablokowaniu bezpośredniego dostępu do originu na ile pozwala platforma.

## Zalecana warstwa Cloudflare

1. DNS domeny Gracz.pl powinien być proxyowany przez Cloudflare (pomarańczowa chmura), a użytkownicy nie powinni korzystać bezpośrednio z adresu Render.
2. WAF Managed Rules: włączyć Cloudflare Managed Ruleset i OWASP Core Ruleset, rozpoczynając od trybu obserwacji dla reguł o ryzyku false-positive, a następnie przejść do blokowania.
3. Rate Limiting na brzegu sieci: osobne reguły dla `/auth/login`, `/auth/register`, `/auth/reset-password`, `/messages`, `/lobby/invitations` i `/games/*/chat`.
4. Bot Management / Super Bot Fight Mode zależnie od planu Cloudflare. Automaty powinny otrzymywać Managed Challenge przed blokadą, jeżeli ruch wygląda podejrzanie, ale nie jest jednoznacznie złośliwy.
5. Turnstile: widget powinien pozostać adaptacyjny — zwykły użytkownik nie widzi challenge, dopóki backend nie zwróci `CHALLENGE_REQUIRED`.
6. DDoS: pozostawić automatyczną ochronę L3/L4/L7 Cloudflare oraz ograniczać kosztowne endpointy także w aplikacji, ponieważ WAF nie zastępuje limitów backendu.
7. Origin: po uruchomieniu Cloudflare ograniczyć możliwość obchodzenia WAF przez bezpośredni adres Render. Jeżeli pełne ograniczenie originu nie jest dostępne, traktować adres Render jako techniczny i nie publikować go jako adres produkcyjny.

## Minimalny zestaw reguł WAF

- Challenge dla gwałtownych serii żądań do logowania i rejestracji.
- Block dla oczywistych skanerów podatności, prób dostępu do nieistniejących paneli administracyjnych i znanych sygnatur exploitów.
- Challenge lub block dla nietypowo wysokiej liczby różnych loginów z jednego źródła.
- Osobne progi dla wiadomości/chatu, aby nie dopuścić do spamu przy zachowaniu normalnej rozgrywki.
- Nie stosować jednej agresywnej reguły IP dla całej witryny; ruch powinien być oceniany warstwowo.

## Ważne

Klucze Turnstile i konfiguracja strefy Cloudflare są sekretami/ustawieniami zewnętrznego konta i nie powinny być commitowane do GitHub. Kod Gracz.pl jest przygotowany do ich użycia po ustawieniu zmiennych w Render i konfiguracji domeny w Cloudflare.

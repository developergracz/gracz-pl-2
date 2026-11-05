# Rejestracja społecznościowa gracz.pl (Google / Microsoft / Discord)

Stan: kod gotowy i bezpiecznie nieaktywny, dopóki każde konto OAuth nie otrzyma własnego `client_id` oraz `client_secret` w produkcyjnym Render `gracz-contact-api`.

## Konfiguracja po stronie dostawców (wykonuje właściciel aplikacji)

Utwórz po jednej aplikacji webowej w Google Cloud Console, Microsoft Entra ID (rejestracja aplikacji, odbiorcy: także konta osobiste, jeśli są potrzebne) i Discord Developer Portal.

**Dokładne dozwolone URI przekierowania:**

- Google: `https://gracz-contact-api.onrender.com/auth/oauth/google/callback`
- Microsoft: `https://gracz-contact-api.onrender.com/auth/oauth/microsoft/callback`
- Discord: `https://gracz-contact-api.onrender.com/auth/oauth/discord/callback`

Ustaw bezpośrednio w Render Environment (nigdy w kodzie/GitHub/chat):

| Dostawca | Zmienne |
|---|---|
| Google | `GRACZ_GOOGLE_CLIENT_ID`, `GRACZ_GOOGLE_CLIENT_SECRET` |
| Microsoft | `GRACZ_MICROSOFT_CLIENT_ID`, `GRACZ_MICROSOFT_CLIENT_SECRET` |
| Discord | `GRACZ_DISCORD_CLIENT_ID`, `GRACZ_DISCORD_CLIENT_SECRET` |

Po zmianie zmiennych wykonaj restart/redeploy usługi API; sprawdź tylko flagi (bez sekretów): `GET https://gracz-contact-api.onrender.com/auth/oauth/providers`. UI aktywuje przycisk odpowiedniego dostawcy wyłącznie po `true`.

## Istotne zasady bezpieczeństwa

- Authorization Code + PKCE S256 + state w HttpOnly/Secure/SameSite=Lax cookie i w jednorazowym rekordzie PostgreSQL (10 min).
- Google/Microsoft: podpis JWT sprawdzany z publicznym JWKS, wymagane issuer, audience, exp i nonce. Discord: wyłącznie oficjalny OAuth2 i endpoint użytkownika.
- Konta mapowane po niezmiennym `(provider, subject)`, nie po samym adresie e-mail; istniejące konto z takim samym e-mailem nie jest automatycznie łączone.
- Microsoft i niezweryfikowany e-mail wymagają osobnego potwierdzenia wiadomością e-mail w gracz.pl.
- Konta społecznościowe korzystają z istniejącej sesji `__Host-gracz_session` i praw dostępu po weryfikacji.
- Zmienne/sekrety nie są dostępne w publicznym API, które zwraca wyłącznie booleany.
- W razie awarii dostawcy istniejąca rejestracja e-mail działa nadal.

## Wymagane domknięcie

Przed oznaczeniem Google/Microsoft/Discord jako „działające”: konfiguracja w konsoli dostawcy i Render, test rejestracji na nowym koncie, powtórnego logowania, odmowy/timeout, potwierdzenia e-mail i kolizji z istniejącym kontem. Bez prawdziwych danych aplikacji OAuth nie da się uczciwie potwierdzić produkcyjnej rejestracji.
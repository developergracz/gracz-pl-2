# Gracz.pl – Security Hardening 2026-08-24

## Wdrożone w kodzie

- centralne moduły `security_core.php` i `security_services.php`;
- sesje tylko cookie, `HttpOnly`, `Secure`, `SameSite=Lax`, strict mode, krótszy TTL, rotacja ID po logowaniu;
- zablokowane przyjmowanie `PHPSESSID` z POST;
- CSRF + kontrola Origin/Referer dla logowania, rejestracji, resetu i wylogowania;
- rate limiting dla logowania, rejestracji, resetu hasła i prywatnych wiadomości;
- progresywna ochrona logowania: soft-limit + Turnstile oraz hard-limit + czasowa blokada;
- Cloudflare Turnstile dla logowania, rejestracji i resetu (aktywuje się po ustawieniu kluczy ENV);
- neutralna odpowiedź resetu hasła, aby ograniczyć enumerację kont;
- centralny, hashowany audit log z łańcuchem `prev_hash` / `entry_hash`;
- centralny RBAC: player, moderator, administrator, owner;
- brama dla paneli administratora oraz przygotowanie obowiązkowego MFA dla kont uprzywilejowanych;
- TokenService przechowujący wyłącznie SHA-256 tokenów jednorazowych;
- szyfrowanie danych AES-256-GCM z kluczem wyłącznie z ENV;
- walidator uploadów: MIME/magic bytes przez `finfo`, limit rozmiaru, losowa nazwa;
- prywatne wiadomości: limity wysyłania, ograniczenie długości, usunięcie HTML do czasu wdrożenia sanitizera whitelistowego;
- redakcja sekretów w logach błędów i hashowanie adresów IP;
- usunięcie runtime logów/IP z repo i rozszerzenie `.gitignore`;
- Dependabot oraz CI Security Gate;
- migracja MySQL: rate limits, audit log, secure tokens, RBAC, MFA.

## Zmienne środowiskowe do ustawienia na staging/production

Nie wpisywać wartości do GitHub.

- `SECURITY_HASH_PEPPER` – co najmniej 32 losowe bajty;
- `AUDIT_LOG_HMAC_KEY` – osobny losowy klucz;
- `DATA_ENCRYPTION_KEY` – dokładnie 32 bajty zakodowane Base64;
- `TURNSTILE_SITE_KEY`;
- `TURNSTILE_SECRET_KEY`;
- `OWNER_USER_ID`;
- `PRIVILEGED_MFA_REQUIRED=0` podczas migracji, następnie `1` po rejestracji MFA wszystkich kont uprzywilejowanych;
- `SESSION_IDLE_TTL=1800`;
- `SESSION_ABSOLUTE_TTL=7200`.

## Elementy infrastrukturalne wymagające konfiguracji poza samym repo

1. Cloudflare: utworzyć widget Turnstile i ustawić klucze jako sekrety środowiska.
2. Cloudflare DNS/e-mail: SPF i DKIM, następnie DMARC `p=none`; po obserwacji przejść do `quarantine`, docelowo `reject`.
3. Hosting/DB: utworzyć osobnego użytkownika MySQL z minimalnymi uprawnieniami dla aplikacji.
4. Backup: automatyczny szyfrowany backup bazy + regularny test odtworzenia na stagingu.
5. Monitoring: alerty dla 5xx, wzrostu nieudanych logowań, masowej rejestracji i przekroczeń rate limit.
6. GitHub: włączyć natywne Secret Scanning/Push Protection i ochronę gałęzi wymagającą przejścia `Security Gate`.
7. Środowiska: osobne production/staging/development, osobne bazy i osobne sekrety; brak danych produkcyjnych w testach.

## Krytyczny dług techniczny wykryty podczas wdrożenia

Repozytorium zawiera stare biblioteki Java/SmartFox, m.in. Log4j 1.x, Commons Collections 3.2.1 i stary MySQL Connector/J. Nowy `Security Gate` celowo blokuje ich bezrefleksyjne wdrożenie. Należy je zaktualizować albo całkowicie odizolować od współczesnej części produkcyjnej.

## Kolejność wdrożenia

1. uruchomić migrację SQL na stagingu;
2. ustawić ENV/secrets;
3. wdrożyć gałąź na staging;
4. przeprowadzić testy logowania/rejestracji/resetu/wylogowania/wiadomości;
5. skonfigurować MFA dla administratorów/moderatorów;
6. ustawić `PRIVILEGED_MFA_REQUIRED=1`;
7. dopiero po zielonym audycie połączyć do produkcji.

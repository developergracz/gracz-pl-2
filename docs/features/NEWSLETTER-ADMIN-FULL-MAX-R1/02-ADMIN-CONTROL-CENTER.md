# 02 — Gracz.pl Owner Newsletter Control Center — Full Max Premium

**Status: DESIGN ONLY / ADMIN ACCESS BLOCKED UNTIL VERIFIED.** Specyfikacja pierwszego modułu przyszłego panelu administracyjnego gracz.pl.

## 1. Cel i zasięg

Właściciel otrzymuje jeden chroniony panel, pokazujący **pełną listę jawnych adresów rzeczywiście zapisanych do newslettera** wraz ze stanem w Resend. Istniejący PostgreSQL przechowuje HMAC(e-mail) i zdarzenia zgód; to nie jest źródło jawnych e-maili i nie wolno rekonstruować ich z hashów ani kopiować wszystkich danych do nowej tabeli.

Pierwsza wersja **R1 read-only**: widok listy, filtrowanie i wyszukiwanie, licznik aktywnych, audyt statusów, czasy i alerty o niespójności. Administrator nie staje się operatorem kampanii marketingowych, dopóki nie ma oddzielnej autoryzacji.

## 2. Funkcje panelu Premium

- Bezpieczna strona administracyjna z logo gracz.pl (gracz biały / .pl czerwone), grafitowo-granatowym tłem i akcentem turkus, kontrast AAA w krytycznych kontrolkach.
- Dashboard: aktywni, wymagający potwierdzenia (agregat bez jawnych adresów jeśli ich nie ma), wypisani, weryfikacja synchronizacji, zdrowie integracji oraz dzienne trendy (wyłącznie dane dowiedzione).
- Lista z Resend: e-mail, imię jeśli podane, status global unsubscribe, członkostwo w segmencie, topic opt_in/out, data utworzenia jeśli dostępna, provider ID wyłącznie po stronie backendu. Widok „aktywni” tylko gdy wszystkie warunki aktywności są spełnione.
- Paginacja server-side z kursorem; sortowanie i wyszukiwarka nie mogą bazować na pobraniu całej listy do przeglądarki. Gdy Resend nie udostępnia wyszukiwania globalnego, backend używa ograniczonego planu lub jawnie sygnalizuje ograniczenia, nigdy nie udaje pełnego wyniku.
- Szczegółowy widok pojedynczego subskrybenta: stan operacyjny Resend i potwierdzony stan dowodu w PostgreSQL identyfikowany HMAC obliczonym po stronie serwera. Brak zapisu jawnych danych do consent ledger.
- Widoki: aktywne subskrypcje, wycofane zgody, ryzyka suppression, historia zdarzeń (dane minimalne), jakość systemu i opóźnienia API. Kategoria pending z PostgreSQL pozwala na liczniki i diagnostykę, lecz nie na kompletną jawną listę e-maili oczekujących bez zmiany polityki przechowywania.
- Eksport CSV jawnych e-maili, akcje wykluczania, masowe operacje oraz synchronizacja naprawcza: **R1 DISABLED**. Wymagają osobnego zakresu, legal review, step-up auth, audytu i Owner GO.
- Dodatkowo: stan read-only „integracja niedostępna” bez przypadkowego wyświetlenia danych z cache po wylogowaniu.

## 3. Architektura zaufania

Przeglądarka panelu -> endpointy admin pod sesją OWNER -> serwerowe adaptery Resend i PostgreSQL. Nigdy:
- direct fetch przeglądarki do Resend z API key;
- DATABASE_URL lub HMAC secret w HTML/JS, LocalStorage, logach albo źródłach;
- serwer publiczny bez sprawdzenia roli;
- przekazywanie adresów e-mail do telemetrycznych vendorów i analytics;
- bootstrap konta administratora na podstawie publicznego „mam ten e-mail”.

Preferowany wariant techniczny: wydzielony namespace /internal/admin/newsletter w istniejącym backendzie **tylko po audycie izolacji**; osobny serwis może być bezpieczniejszy, ale wymaga oddzielnej zgody na koszty i routing. Endpointy serwerowe muszą działać w trybie deny-by-default i zabezpieczać każde zapytanie niezależnie od widoczności UI.

Proponowany kontrakt read-only:
- GET /internal/admin/newsletter/summary — agregaty + fetched_at + quality flags, bez identyfikatorów osób.
- GET /internal/admin/newsletter/subscribers?cursor=&limit=&state= — server-side paginated active list, minimalne pola i nextCursor, bounded limit; poprawna autoryzacja.
- GET /internal/admin/newsletter/subscribers/:opaqueId — szczegóły tylko autoryzowane, server-side mapowanie ID, bez możliwości enumeracji HMAC.
- GET /internal/admin/newsletter/consent-audit?subject=:opaqueId — pierwszostronna historia zgód z legalnie dozwolonymi polami, bez logowania treści.

Wdrożeniowe nazwy tras są propozycją. Nie rozszerzać istniejących publicznych /newsletter/* uprawnieniami admin. Każde API otrzymuje Cache-Control no-store, Referrer-Policy no-referrer, CSP, restrykcyjne CORS i Content-Security-Policy sprawdzone z faktycznym hostowaniem.

## 4. Uwierzytelnienie i autoryzacja — gate ZERO TRUST

- Silne uwierzytelnienie właściciela z **MFA** (preferowany passkey/WebAuthn; alternatywny TOTP z ochroną odzyskiwania). Nie deklarować mechanizmu gotowym przed audytem.
- Pierwotna rola OWNER ustawiana przez zaufany tryb administracyjny, nie przez frontend; nie zakładać, że sam e-mail daje rolę.
- Serwerowa sesja: podpisany, rotowany identyfikator tylko w Secure/HttpOnly/SameSite=Strict cookies, ograniczona bezczynność i lifetime, unieważnienie po wylogowaniu/zmianie danych, anti-session-fixation; mechanizm sesji musi mieć trwałe źródło prawdy, zależnie od audytowanej architektury.
- CSRF (gdy cookie auth), Origin + Referer i metody bezpieczne dla odczytu, bez wildcard CORS; middleware obowiązkowy dla każdej trasy admin (także błędów i plików).
- Least privilege: osobny serwerowy klucz Resend do read-only contact access jeśli provider pozwala, w przeciwnym razie osobno zatwierdzona i kontrolowana tożsamość/zakres z monitoringiem; nie używać klucza do dowolnego marketingu gdy niepotrzebne.
- Rozróżnienie odpowiedzialności: OWNER ma dostęp, przyszli operatorzy mogą otrzymać minimalne, jawnie zdefiniowane role; brak anonimowego „admin mode”.
- Rate limit, ochrona brute force, audyt failed logins, zmiany sesji, read access do PII, alert o masowym odczycie / podejrzanych wzorcach, brak sekretów i plaintext PII w logach.
- Step-up verification i osobne Owner GO dla eksportów, trwałego usunięcia, modyfikacji zgód i automatycznych kampanii.

## 5. RODO, retencja, poufność

- Pokaż dane tylko w zakresie koniecznym dla obsługi subskrypcji. Rozdziel podstawę prawną przetwarzania, historię zgód oraz operacyjne funkcje wysyłkowe.
- Doprecyzować politykę prywatności i informację o dostawcy Resend, odbiorcach danych, okresach retencji, prawie wycofania, obsłudze żądań dostępu/usunięcia, transferach danych i procedurze incydentów przed produkcją. Ocena prawna i umowa powierzenia — przed aktywacją.
- Nie tworzyć eksportów do ZIP/CSV domyślnie ani nie używać narzędzi analitycznych śledzących odwiedziny administratora z adresami.
- Paginowana lista adresów jest dostępna wyłącznie przez backend, bez publicznego indeksowania, no-store i bez obecności adresów w URL.
- HMAC w PostgreSQL nie jest zamiennikiem podstawy prawnej; zalecany przegląd zasad przechowywania po unsubscribe i retencji dowodu zgody.

## 6. Błędy i niezawodność

- Resend 429: Retry-After/backoff z limitami, nie nieskończone kolejki i nie pobieranie wszystkich stron na raz.
- Resend timeout/5xx: panel read-only degraduje się z wyraźnym brakiem świeżych danych; **nie wyświetla fałszywej listy „0 użytkowników”**.
- PostgreSQL niedostępny: nie pokazuj „zgoda potwierdzona” na podstawie samego cache; lista operacyjna może być odczytana z Resend tylko z widocznym brakiem pełnego dowodu consent, bez modyfikacji.
- Sesja wygasła albo brak roli: 401/403, bez wycieku zawartości, redirect do zaufanego logowania.
- Pager: stale cursor, nieznane identyfikatory, rate limit i koszty API; ograniczać odpowiedzi i pamięć.
- Rozjazd Resend/ledger: wskaźnik data-quality + ślad do ręcznego audytu, bez automatycznej, niesprawdzonej naprawy subskrypcji.

## 7. Zakres odłożony do następnych wersji

Kampanie / broadcasty, edytor HTML, segmentacja marketingowa, harmonogram wysyłki, ręczny opt-in, masowe importy, eksporty CSV, usuwanie i ręczne zmiany zgody, multi-admin, raporty BI. Nie zakładać, że wszystkie funkcje są konieczne w pierwszym panelu. Budować fundament RBAC + odczyt listy, później funkcje tylko po Owner GO.

## 8. Bramka akceptacyjna R1

Pełna paginacja poprawnie odtwarza aktywne adresy z istniejącego segmentu Resend bez duplikatów; zero API keys, sesji i pełnych adresów w frontendowym bundle, logach i telemetry; nieautoryzowani użytkownicy mają 401/403 na każdej drodze; Owner MFA działa; historia zgód nie fałszuje informacji o zapisaniu; sesja po logout traci dostęp; przegląd mobile i dostępności PASS; niezależny security/RODO audit PASS.

**R1 nie jest wdrożony ani zakodowany przez ten dokument.**

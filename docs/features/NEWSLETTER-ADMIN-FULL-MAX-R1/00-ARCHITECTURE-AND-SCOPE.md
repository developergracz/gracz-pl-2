# 00 — Architektura docelowa i granice zadania

**Status: PROPOSED / OWNER REVIEW.** Data 2026-10-12. Wymaga zatwierdzenia przed implementacją.

## 1. Problem i rezultat biznesowy

Użytkownik może dowolną liczbę razy wpisać ten sam e-mail w zapisie do newslettera. Z systemu wychodzą kolejne żądania potwierdzenia, mimo wcześniejszej aktywacji albo oczekiwania na DOI. Wymagana jest idempotentna, spójna obsługa przy ponownym zapisie, powiadomienie wizualne klasy Full Max Premium i pierwszy panel administracyjny z pełną listą **faktycznie zapisanych** adresów.

Kryterium sukcesu: potwierdzony aktywny subskrybent nie otrzymuje nowej sekwencji DOI/powitania po ponownym wysłaniu formularza; równoległe próby nie powodują mnożenia operacji ani przyznania nieautoryzowanego opt-in; administrator w chronionej sesji widzi spójny widok z Resend i zakres dowodów z PostgreSQL.

## 2. Stan zastany — źródło, nie przypuszczenie

Repozytorium gracz-pl-2, main przy audycie:
- contact-api/newsletter.mjs: funkcja requestOptIn() przed wysłaniem nowego DOI czyta wpis consentStore, ale nie odrzuca istniejącego subscribed ani nie deduplikuje oczekujących żądań. Generuje nowy JTI, zapisuje opt_in_requested, wysyła kolejny e-mail.
- contact-api/newsletter.mjs: funkcja confirm() rozpoznaje already_subscribed i korzysta z Resend + first-party consent ledger. Za późno dla problemu ponownego kliknięcia „Zapisz”.
- contact-api/routes/newsletter-route.mjs: POST /newsletter/subscribe zwraca obecnie stan confirmation_sent po requestOptIn().
- contact-api/persistence/migrations/001_persistent_state.sql: newsletter_contacts z unikalnym email_hash, current_state pending/subscribed/unsubscribed; newsletter_consent_events append-only; w bazie nie ma jawnego e-maila.
- contact-api/persistence/migrations/003_newsletter_state_version.sql: CAS/state_version i provider_blocked_at.
- maintenance-site/assets/legal-links.js: podłącza kontakt i wszystkie formularze stopki do API oraz wzbogaca je o zgodę.
- maintenance-site/assets/newsletter-full-max-r1.js: samodzielna strona newslettera korzysta z tego samego API.
- maintenance-site/assets/home.js: zawiera starszy informacyjny handler formularza stopki; legal-links.js używa nasłuchu capture i stopImmediatePropagation, co należy zabezpieczyć testem przed regresją.
- contact-api/README.md — „FINAL newsletter architecture — hybrid” stanowi istniejącą decyzję: Resend zarządza rzeczywistą subskrypcją, PostgreSQL jest jedynie first-party audit/control.

Na Render działa usługa gracz-contact-api, migracje 001–004 wykonały się na istniejącej bazie. W logach za 2026-10-11 potwierdzono żądanie i potwierdzenie newslettera. Nie jest to dowód kompletności panelu ani pełnego testu nowej funkcji.

## 3. Źródła prawdy i kierunek przepływu

Przeglądarka -> publiczne trasy /newsletter/subscribe, /confirm, /unsubscribe -> contact-api:
- Walidacja, limitowanie, DOI i idempotencja: backend gracz.pl.
- PostgreSQL Render: HMAC(email), wersja zgody, stan pomocniczy, zdarzenia consent append-only, zabezpieczenia replay/CAS, ewentualny minimalny rejestr wysyłek oczekujących.
- Resend Contacts + segment „gracz.pl Newsletter” + topic „Newsletter gracz.pl”: **autorytatywna informacja o aktywności marketingowej, jawne e-maile, segmenty, unsubscribe, suppression i wysyłka**.
- Panel Admin -> autoryzowany backend -> Resend + kontrolowane zagregowane zapytania PostgreSQL; nigdy bezpośrednio z browsera do bazy ani do Resend z kluczem.

Nie wolno definiować current_state=„subscribed” z samego zaznaczenia checkboxa. Zgłoszenie ≠ potwierdzona zgoda. DOI pozostaje obowiązkowe. Błędy synchronizacji lub awarie Resend nie mogą powodować bezwarunkowego uznania aktywności na podstawie starego zapisu PostgreSQL.

## 4. Rekomendowana strategia: HYBRID, nie nowy system marketingowy

**Wykonujemy własny admin UI, ale nie drugi silnik mailingowy.**

Alternatywy odrzucone w R1:
- drugi, niezależny magazyn pełnych e-maili w PostgreSQL — podwójne dane osobowe, konflikty „active”, koszt utrzymania, migracje i incydenty RODO;
- publiczny endpoint „czy ten e-mail istnieje?” — enumeracja i wyciek statusu subskrypcji;
- klucz Resend w HTML/JS albo renderowanie jawnej listy bez osobnego backendu — krytyczny wyciek;
- „automatyczny opt-in” po samym checkboxie, bypass DOI — zakazane;
- budowa panelu przed mechanizmami autoryzacji, audytu i możliwości wycofania zgody — zabroniona.

## 5. Zakres prac i odpowiedzialności

PR-1 — **DUPLICATE OPT-IN + PREMIUM UX**: funkcja newsletter.mjs i ewentualnie minimalna, osobno audytowana migracja wyłącznie dla pending suppression/claim; wspólny publiczny kontrakt API, okno na stronie newslettera i na każdej stopce, spójny kontakt+newsletter, niezależne testy i audyt.

PR-2 — **OWNER NEWSLETTER ADMIN R1**: tylko po weryfikacji autoryzacji; panel administracyjny FULL MAX z listą confirmed/active z Resend, filtrowaniem, metrykami i read-only audytem zgód. Operacje mutujące i eksporty są osobnymi bramkami podwyższonych uprawnień, nie należy ich domyślnie aktywować.

PR-3 opcjonalny — **ADVANCED ADMIN ACTIONS**: świadomie zatwierdzone operacje (np. eksport, usuwanie, sync repair) z osobnym audytem prawnym i architektonicznym; domyślnie OUT OF SCOPE.

Nie wprowadzać domyślnie nowego płatnego zasobu Render, domeny, logowania użytkownika ani automatycznego deployu. Wykorzystać aktualny backend tylko po audycie izolacji administratora; osobny serwis jeśli wymagany, po kosztorysie i Owner GO.

## 6. Zależności i preconditions

- Potwierdzić aktualny HEAD main, otwarte PR na te same pliki, wymogi branch protection, CI, CSP/CORS, stosowane sesje i model właściciela.
- Potwierdzić zasoby Resend, jego paginację i semantykę unsubscribed / topic / segment / suppressed na rzeczywistym kontrakcie API oraz możliwe błędy rate limit.
- Istniejący rejestr consent HMAC ma pozostać append-only. Zmiany DB: tylko expand-only, niedestrukcyjne, oddzielnie testowane, kopia/restore gate zgodnie z polityką; nie łączyć z contact backfill ani migration 005.
- Admin z jawnie widocznymi adresami nie może ruszyć bez sesji z MFA, ograniczeń sieciowych, zasad dostępu, RODO i audit trail.
- Dotychczasowa ścieżka wysyłki wiadomości kontaktowych ma pozostać niezmieniona. Nie wysyłać dodatkowych e-maili w testach bez wyraźnej autoryzacji.

## 7. Decyzje wymagające Owner GO

A. Akceptacja tej dokumentacji i bezpiecznej neutralnej odpowiedzi formularza publicznego (patrz 01).
B. Odrębne uruchomienie PR-1, przejście audytów i wdrożenie.
C. Zakres PR-2 (read-only), technologia MFA/session, miejsce hostowania admin bez nowych kosztów, oddzielny GO.
D. Czy przyszły eksport jawnych adresów i mutacje subskrypcji są w ogóle potrzebne: osobna decyzja i legal review.

**Brak GO oznacza HOLD. Dokumentacja nie stanowi zgody na kodowanie, zmianę produkcji ani scalanie.**

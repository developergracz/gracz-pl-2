# 01 — Deduplikacja DOI, bezpieczeństwo i okno Full Max Premium

Status: **SPECIFICATION / IMPLEMENTATION HOLD**.

## 1. Dlaczego dziś występuje błąd

Publiczny POST /newsletter/subscribe wywołuje requestOptIn(). Obecnie funkcja pobiera stan first-party, buduje świeży token JTI i żądanie e-mail, nie kończąc wcześnie w przypadku subscriber=active ani pending request. Blokada duplikatów w confirm() nie chroni przed nadmiarem e-maili na etapie zgłoszenia. To osobna poprawka backendu, a nie tylko warstwa UI.

## 2. Zdefiniowane stany i rozstrzygnięcie

- **NEW / UNKNOWN**: brak wcześniej potwierdzonego opt-in; wolno rozpocząć jeden DOI po pozytywnej walidacji, antyspamie i zapisaniu zdarzenia.
- **PENDING_VALID**: aktywne okno potwierdzenia; nie tworzyć nowego nieograniczonego strumienia wiadomości. Zwrócić bezpieczną, neutralną odpowiedź. Opcjonalne ponowienie linku tylko po cooldown, z limitem dobowym oraz regułą bezpiecznej nieważności starszych tokenów; dokładne progi zatwierdzić w PR-1.
- **ACTIVE_CONFIRMED**: Resend wskazuje aktywny adres (contact istnieje, nie jest globalnie unsubscribed, należy do właściwego segmentu, Topic opt_in; uwzględnić suppression). Nie tworzyć opt_in_requested, nowego DOI, drugiego welcome ani modyfikować zgody. Rejestr żądania można zapisać wyłącznie jako prywatny techniczny licznik antyspam, nie jako nową zgodę.
- **UNSUBSCRIBED / PROVIDER_DISABLED**: nie reaktywować automatycznie. Świadomy ponowny zapis wymaga nowego linku i skutecznego DOI. Stare linki fail-closed.
- **PROVIDER_UNKNOWN / DB_ERROR / CONSENT_CONFLICT**: nie zgadywać statusu ani aktywować subskrypcji. Neutralny komunikat publiczny; serwerowe zdarzenie techniczne z korelacją i monitoringiem; retry/circuit breaker bez ujawniania stanu.
- **LEGACY_SUBSCRIBED**: potwierdzone w Resend przed R4 ledger; nie fabrykować consent event, nie rozpoczynać DOI tylko z powodu braku historycznego wpisu w PostgreSQL.
- **CONCURRENT REQUESTS**: dwa formularze i dwa urządzenia nie tworzą dwóch niezależnych procesów DOI ani nie omijają odwołanej zgody.

## 3. Reguły backendu (szkic bez wykonania)

1. Po normalizacji e-maila, walidacji zgody, honeypot/form timing i rate limit obliczyć istniejący HMAC identyfikator; nigdy nie ufać statusowi przesłanemu przez klienta.
2. Odczytać bezpieczny stan first-party i stan operacyjny Resend przez funkcję o jawnej semantyce. Nie budować ciężkiego drugiego silnika resynchronizacji R4.5; przy rozbieżności zachować fail-closed i zarejestrować zdarzenie, zamiast przepisywać stan.
3. Stosować atomową rezerwację dla NOWEGO pending. Projekt preferowany: ograniczony, osobno przejrzany rejestr email_hash + last_request_at + last_sent_at + expiry + claim epoch/lease + idempotency metadata, bez jawnych adresów lub tokenów; weryfikacja, czy już istniejące mechanizmy DB pozwalają osiągnąć to bez nowej tabeli jest obowiązkowa. Transakcja/unikalny klucz/CAS muszą obsługiwać współbieżność kilku instancji i ponowne próby.
4. Wywołanie Resend jest nieatomowe względem PostgreSQL: zaprojektować bezpieczne stany IN_FLIGHT / SENT / UNKNOWN, timeout, retry pod tą samą idempotency key, naprawę po crash/restart i odzyskiwanie lease; nie markować SENT przed potwierdzonym wynikiem. Nie emitować kolejnego JTI przy niepewnym wyniku dostawcy.
5. Consent event opt_in_requested dopisywać najwyżej raz na faktycznie rozpoczęty DOI. Nie osłabiać immutability consent ledger i nie zmieniać funkcji confirm() w sposób dopuszczający replay, stale link albo odwrócony opt-out.
6. Potwierdzenie nadal aktywuje Resend dopiero po skutecznym durable consent evidence; żadna publiczna odpowiedź nie staje się źródłem prawdy o subskrypcji.
7. Przy wysyłce przez formularz kontaktowy błędny newsletter nigdy nie unieważnia poprawnie przyjętej wiadomości kontaktowej. Antyspam i idempotencja kontaktu pozostają niezależne.

Nie używać niezweryfikowanych heurystyk (sam obecny PG current_state jako dowód aktywacji, sam istnienie kontaktu w Resend, tylko data utworzenia) zamiast pełnego statusu segment+topic+unsubscribe.

## 4. Prywatność: dwa rodzaje odpowiedzi

**A — NIEZWERYFIKOWANY PUBLICZNY FORMULARZ**
- Ten sam status HTTP i schemat odpowiedzi dla ACTIVE, PENDING i przypadków, w których rozpoczęcie DOI jest dozwolone (poza prawdziwą odmową walidacji lub awarią).
- Proponowany response: HTTP 200, {ok:true, state:"request_received"}; frontend renderuje: „Sprawdź swoją skrzynkę e-mail. Jeśli adres wymaga potwierdzenia, wyślemy bezpieczny link. Jeśli już jesteś zapisany, nie musisz robić nic więcej.”
- Nie zwracać pól already_subscribed, exists, resubscribed, provider_contact_id, HMAC ani statusu zgody. Nie narażać na enumerację przez różne statusy, treści, wielkości payloadu lub przewidywalne timingi. Dokładnie sprawdzić także błędy i limity.
- Ta zmiana kontraktu wymaga aktualizacji WSZYSTKICH konsumentów endpointu i regresji kompatybilności.

**B — ZWERYFIKOWANA KONTROLA NAD ADRESEM / ADMIN**
- Po weryfikacji e-mail (ważny jednorazowy token do tego adresu) lub w administracyjnej sesji MFA wolno pokazać dokładny stan: „Ten adres e-mail jest już zapisany do newslettera gracz.pl”.
- Nie przekazywać dokładnego stanu do jawnej przeglądarki przed dowiedzeniem posiadania skrzynki. Opcjonalne „Sprawdź status” wymaga osobnego, audytowanego mechanizmu weryfikacji i limiterów.
- Nie ujawniać, że adres został wcześniej wypisany, zablokowany, odrzucony przez dostawcę ani którejś z dat zgód.

## 5. PREMIUM MODAL — kontrakt UX

Wygląd gracz.pl: ciemny granat / turkus, białe logo „gracz” i czerwone „.pl”, brak złotych ramek, 16:9 desktop / adaptacyjny mobile, spójność z istniejącymi modalami. Nie wymuszać pełnego ekranu na urządzeniach małych.

Zawartość:
- Icon: bezpieczna koperta / tarcza.
- Tytuł neutralny: **Zgłoszenie przyjęte**.
- Tekst dla niezweryfikowanego: **„Jeżeli Twój adres nie jest jeszcze aktywny, otrzymasz e-mail z potwierdzeniem. Jeśli subskrypcja już działa, nie musisz wykonywać żadnych działań.”**
- Status po zweryfikowaniu adresu: **„Ten adres e-mail jest już zapisany do newslettera gracz.pl.”**
- Wariant dla przerwanego żądania: „Nie mogliśmy teraz sprawdzić zgłoszenia. Spróbuj później.” Nie sugerować sukcesu bez dowodu.
- Akcje: „Rozumiem”, opcjonalnie „Przejdź do newslettera”, odpowiednia informacja o prawie do wycofania zgody.
- Bez użycia alert() przeglądarki i bez automatycznego wypisywania.

Wymagania dostępności: dialog role/aria-labelledby/aria-describedby, fokus początkowy i powrót fokusu, klawiatura ESC/Tab, screen reader aria-live, reduced motion, wysokie kontrasty, przewijanie wewnętrzne bez blokowania przycisków, 320–1920px i Safari/Chrome/Firefox/Edge. Wspólny komponent w stopkach i na /newsletter/; brak kolizji z contact modal.


## 5A. Wymagany protokół weryfikacji właściciela adresu (doprecyzowanie audytowe)

**Uzasadnienie:** Żądanie właściciela przewiduje ekranowy komunikat „Ten adres jest już zapisany”. Nie wolno realizować go przez publiczne sprawdzanie istnienia adresów, ponieważ napastnik otrzymałby możliwość enumeracji bazy. W PR-1 konieczny jest jawny, testowalny przepływ proof-of-mailbox.

**Publiczne zgłoszenie bez weryfikacji:** wynik request_received (ten sam kod/schemat dla nowego, pending i active); premium modal z informacją neutralną. Nie rozpoczynamy dodatkowego DOI dla aktywnego adresu. Sam status first-party bez autorytatywnego Resend NIE pozwala pokazać „już zapisany”.

**Osobna dobrowolna akcja „Sprawdź status”** (wymagana jako element zakresu UX, jej ostateczne nazwy API zatwierdza PR-1):

1. Formularz przyjmuje e-mail i wyraźne żądanie **sprawdzenia statusu**, niezależne od opt-in marketingowego. Odpowiedź HTTP/schemat są zawsze neutralne i nie zdradzają istnienia subskrypcji.
2. Backend stosuje limity per-IP / per-HMAC / globalne, cooldown, antybot oraz budżet wiadomości. Weryfikacyjny e-mail trafia wyłącznie do podanego adresu; mail ma taką samą treść niezależnie od stanu aktywności, nie zawiera statusu subskrypcji.
3. Jednorazowy kryptograficzny token **STATUS_CHECK** jest rozdzielony od DOI i unsubscribe: oddzielny purpose/audience, CSPRNG nonce, krótki TTL (projektowo do 10 minut, sprawdzić faktyczną politykę), powiązanie z adresem i ograniczenie użyć. Preferować AEAD z oddzielnie wyprowadzonym kontekstowym kluczem oraz trwałe serwerowe zużycie nonce po stronie PostgreSQL (hash/TTL, bez jawnego adresu). Nie wolno używać tokenu STATUS_CHECK do aktywowania ani wycofywania zgody.
4. Link kieruje na /newsletter/ ze stanem przekazanym w fragmencie URL i natychmiast usuwanym z historii przez replaceState, następnie frontend przesyła token w body POST po HTTPS z no-store, referrer-policy no-referrer i bez zewnętrznych skryptów na tej ścieżce. Endpoint weryfikacji atomowo zużywa token; chroni przed replay, stale expiry, brute force i zmianą tożsamości.
5. **Dopiero po pozytywnym dowodzie kontroli skrzynki** backend odczytuje rzeczywisty stan Resend (segment+topic+unsubscribed+suppression) i zwraca ograniczony status do tej samej sesji/odpowiedzi: ACTIVE -> „Ten adres e-mail jest już zapisany do newslettera gracz.pl”; PENDING -> „Zapis oczekuje na potwierdzenie”; brak subskrypcji -> „Brak aktywnej subskrypcji”. Nie dopisywać zgody przy samym status-check.
6. Tokenów i e-maili nie zapisywać w logach, telemetry, błędach, cache, HTML startowym, analityce ani parametrach URL zapytań. Konieczne osobne testy CSP, przejść pomiędzy podstronami, sesji i referrer leakage. E-mail status-check nie powinien być wysyłany automatycznie przy każdym ponownym kliknięciu „Zapisz”.
7. Po czasowym błędzie dostawcy lub niespójności obu źródeł **nie** zgłaszać statusu ACTIVE/PENDING na podstawie zgadywania. Pokaż bezpieczny błąd i zapisz nieosobowe dowody diagnostyczne.

**Alternatywa zatwierdzana wyłącznie przez Owner:** zrezygnować z akcji „Sprawdź status” i pozostawić wyłącznie neutralny modal publiczny. Wtedy nie wolno przedstawiać wymogu dokładnego ekranowego komunikatu jako spełnionego. Ta decyzja musi być jawnie odnotowana przed rozpoczęciem PR-1.

## 6. Ograniczanie nadużyć

IP + HMAC(email) + globalne limity, niezależne liczniki dla wysyłki a odczytu; krótkie cooldown i dzienny limit DOI, rotacja bez utraty poprawnego tokenu, przeciwdziałanie botom i provider-cost exhaustion, brak PII w logach, stała korelacja requestId. Nigdy nie stosować CAPTCHA jako jedynej kontroli. W PR-1 określić oraz przetestować liczbowe progi i retencję według rzeczywistych ograniczeń dostawcy, nie wymyślać ich w tej propozycji.

## 7. Kryteria odbioru PR-1

- Potwierdzony subskrybent: 0 dodatkowych emaili DOI, 0 dodatkowych welcome, 0 nowych opt-in-confirmed z powodu ponownego wysłania.
- Równoległe żądania: co najwyżej jedno skuteczne DOI w dozwolonym okresie; trwałość po restartach API, także 2 instancje.
- Ponowny zapis po rezygnacji: świeży DOI, brak reaktywacji starym tokenem.
- Publiczne odpowiedzi nie rozróżniają istniejącego/nieistniejącego adresu; dokładny „już zapisany” tylko po weryfikacji.
- Wspólny zachowany kontrakt w stopce, kontakcie, /newsletter/ i na wszystkich podstronach, bez utraty wysyłania kontaktu.
- E2E testy z testowym adresem pod osobnym Owner GO, bez prawdziwych niezamówionych e-maili w CI.

# P3 — współdzielona synchronizacja rozgrywek

## Architektura i aktywacja

Gomoku i Warcaby korzystają z tego samego adaptera WebSocket, klienta przeglądarki,
routera kont oraz puli PostgreSQL. `/auth/gomoku/realtime` pozostaje zgodny z P2;
`/auth/match/realtime` udostępnia ten sam protokół obu grom. Komendy nadal używają
istniejącego uwierzytelnionego HTTP z kontrolą `version`. Zatwierdzenie następuje
po zapisie PostgreSQL, nigdy na podstawie odpowiedzi Redis.

`GAME_REDIS_URL` włącza transport Redis/Valkey. Bez tej zmiennej adapter zachowuje
lokalne powiadomienia P2. Kod klienta `@redis/client` ładowany jest tylko przy
skonfigurowanym URL. Ten PR nie konfiguruje usług ani zmiennych produkcyjnych.
Aktywacja nowej zależności produkcyjnej i ewentualne koszty wymagają zgody Ownera.
Dla wielu instancji trzeba wskazać ten sam prywatny Redis/Valkey i PostgreSQL.
Zalecane TLS (`rediss://`), uwierzytelnienie, ACL kanału
`gracz:match:invalidate:v1`; brak publicznego dostępu do transportu.

Redis przenosi tylko identyfikatory zmienionych partii i losowy identyfikator
nadawcy. Żadnych cookies, profili, czatu czy stanu planszy. Odbiorca ponownie
sprawdza sesję, uczestnictwo i blokady w PostgreSQL. Powtórzone albo przestawione
powiadomienia oznaczają ponowny odczyt aktualnego stanu, nie ponowne wykonanie ruchu.

## Awaria i ograniczenia

- Reconnect otrzymuje pełny autoryzowany snapshot. Sekwencja WebSocket i wersja
  partii wykrywają luki; klient przywraca HTTP i łączy się z opóźnieniem losowym.
- Pub/Sub nie jest trwałym dziennikiem. Zgubione ostatnie zdarzenie (także po
  śmierci procesu między COMMIT a publish) naprawia rozłożone w czasie odczytywanie
  PostgreSQL co 60 s na połączenie. Opóźnienie może być większe przy przeciążeniu
  bazy/kolejki. Nie gwarantujemy natychmiastowej dostawy podczas awarii Redis.
- HTTP pozostaje awaryjnym kanałem. Awaria Redis nie cofa zatwierdzonego ruchu;
  ponowienie starej wersji dostaje 409 i wymaga odświeżenia.
- Maksymalnie 4096 WebSocketów na instancję, 4 na konto, 32 trwające handshaki,
  200 prób przyjęcia/s, 8 równoległych synchronizacji. Jeden oczekujący odczyt
  na połączenie, jeden wpis powiadomienia na partię, do 16 384 wpisów i 8 publikacji.
  Bufor wyjściowy 256 KiB; powolny odbiorca jest rozłączany. Brak nieograniczonej
  kolejki poleceń Redis podczas awarii.
- Router dopuszcza najwyżej 32 równoległe żądania rozgrywek na instancję;
  nadmiar otrzymuje 503. Odbiór POST ma osobny budżet: 2 niedokończone
  treści na sesję, 64 na instancję, timeout 5 s; nie zajmuje miejsc odczytu bazy. Istniejąca pula: domyślnie 10 połączeń, `DB_POOL_MAX`
  ograniczone do 1–50, timeout uzyskania połączenia domyślnie 5 s.
  Budżet PostgreSQL musi uwzględniać **sumę pul wszystkich instancji** i rezerwę
  dla pozostałych modułów. Sam limit socketów nie potwierdza pojemności 30 000.

## PostgreSQL

Istniejący snapshot wymagał dwóch pełnych ścieżek HTTP (partia i czat), każda
z ponawianym INSERT ON CONFLICT. Wspólny wewnętrzny odczyt używa trzech zapytań
na ustabilizowaną partię: sesja, autoryzowana projekcja partii, ostatnie wiadomości.
Tworzenie partii odbywa się tylko przy pierwszym odczycie. Wewnętrzny odczyt
jest oznaczony prywatnym Symbol, którego HTTP nie może ustawić; limity komend
publicznych pozostają zachowane. Heartbeat nie odczytuje bazy.

Wykorzystane istniejące indeksy: sessions(token_digest) PK,
game_matches(challenge_id) PK, game_challenges(id) PK, accounts(id) PK,
friend_blocks(blocker,blocked) PK oraz
`gracz_match_messages_recent(match_id,created_at DESC,id DESC)`.
Nie dodajemy redundantnych indeksów ani migracji niepowiązanych tabel.

## Odtworzenie odbioru P3

Wyłącznie lokalne, jednorazowe PostgreSQL 16 i Valkey 8. Skrypt odrzuca bazę poza
loopback i niezatwierdzoną nazwę; Redis również wymaga loopback. Brak wysyłki maili.

```sh
cd contact-api
npm ci --ignore-scripts --no-fund --no-audit
DATABASE_URL=postgresql://gracz:local_integration_only@127.0.0.1:5432/gracz_test \
GAME_REDIS_URL=redis://127.0.0.1:6379 npm run test:scaling
```

Test uruchamia dwa niezależne procesy Node z produkcyjnym routerem, adapterem
bazy i WebSocket. Tworzy testowe zweryfikowane konta i ich sesje w PostgreSQL.
Sprawdza obie gry, prywatne projekcje i czat, współbieżne powtórzenie ruchu,
cofanie Gomoku, zegar i jednorazowe zatwierdzenie timeoutu, utratę ostatniego
powiadomienia, zerwanie transportu do Valkey i odbudowę subskrypcji,
SIGKILL instancji, reconnect do drugiej instancji oraz cofnięcie sesji.
Testy utraty transportu wykorzystują lokalny TCP proxy; nie zatrzymują cudzych usług.

W odbiorze lokalnym 2026-11-05: test integracyjny P3 (4 testy wraz z nadrzędnym)
PASS; powiązane testy Gomoku/Warcabów i ochrony przyjmowania żądań (81) PASS; kontrola składni modułów PASS.
Po uzupełnieniu jawnego manifestu importów pełny wymagany przez CI zestaw
`contact-api` przechodzi: 571/571, bez pominięć.
To jest wynik poprawności P3, **nie wynik wydajności P4**. Test integracyjny skraca
reconciliation do 1 s i heartbeat do 250 ms, aby zweryfikować awarie bez minut oczekiwania.
P4 musi użyć ustawień docelowych i wykonać rzeczywiste operacje kolejno przy
1000 / 5000 / 10000 / 20000 / 30000 zalogowanych graczy na odizolowanym środowisku.

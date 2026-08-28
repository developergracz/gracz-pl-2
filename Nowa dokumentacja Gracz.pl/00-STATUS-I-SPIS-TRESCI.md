# Nowa dokumentacja Gracz.pl — status i spis treści

Data: 28.08.2026

## Zasada źródła prawdy

Dokumentacja audytowa powstaje wyłącznie na podstawie potwierdzonych dowodów z repozytorium. Dla rozpoczętej sesji audytu punktem odniesienia był `origin/main @ db3c15a`. Należy zawsze rozdzielać:

1. **POTWIERDZONE** — fakty wynikające z kodu/repozytorium,
2. **WYMAGA WERYFIKACJI ŚRODOWISKA** — rzeczy zależne od produkcji, Rendera, konfiguracji lub danych runtime,
3. **ARCHITEKTURA DOCELOWA** — rekomendowany przyszły stan, a nie opis obecnego systemu.

Nie wolno dopisywać niepotwierdzonych tabel, kolumn, metod ani zachowań.

## Stan audytu

### ETAP 1 — baza i architektura

- Ustalono bazowy stan repozytorium do analizy.
- Potwierdzono współistnienie nowej warstwy Node.js oraz elementów legacy SmartFox/Java/Flash.
- PostgreSQL jest analizowany jako trwała warstwa danych.
- W kodzie występuje SSE; WebSocket/realtime w architekturze docelowej należy traktować oddzielnie od stanu obecnego.

### ETAP 1B — mapa PostgreSQL

Zakres mapy: **26 tabel**.

Opracowane obszary:
- tożsamość — 7 tabel,
- audyt — 1 tabela,
- gry / Warcaby — `gracz_game_sessions`, AS-IS zamknięte, w tym realne ryzyko lost update i brak single-writer,
- gry / Tysiąc — `gracz_thousand_games`, AS-IS zamknięte, w tym JSONB, revision i optimistic locking,
- gry / Gomoku — AS-IS zamknięte jako model pamięciowy; aktualny kod nie posiada persistence PostgreSQL dla tej gry,
- wiadomości prywatne — `gracz_messages` oraz `gracz_message_attachments`, AS-IS zamknięte na poziomie kodu; zweryfikowane DDL/DML, relacje, szyfrowanie, załączniki, soft-delete i fizyczny delete po usunięciu przez obie strony,
- moderacja — `gracz_moderation_decisions` oraz `gracz_moderation_appeals`, rdzeń AS-IS zamknięty; zweryfikowane DDL/DML, filtry treści, odwołania, integracja z audytem i RBAC oraz braki trwałego workflow ban/review w analizowanym module,
- globalny chat — `gracz_chat_topics`, `gracz_global_chat`, `gracz_chat_friends`, `gracz_global_chat_reports`, AS-IS zamknięte na poziomie kodu; zweryfikowane DDL/DML, SSE/presence, raporty, relacje znajomych, soft-delete, integracja z moderacją oraz ryzyka concurrency/integralności,
- turnieje — `gracz_tournaments`, `gracz_tournament_players`, `gracz_tournament_matches`, AS-IS zamknięte na poziomie kodu; zweryfikowane DDL/DML, zapisy uczestników, pairingi, wyniki, standings, awans rund i ryzyka concurrency/atomowości,
- newsletter — `gracz_newsletter_subscribers`, `newsletter_sources`, `newsletter_subscriber_sources`, `newsletter_consent_history`, `newsletter_events`, AS-IS zamknięte na poziomie kodu; zweryfikowane double opt-in, token hashes, source attribution, historia zgód, analytics/events, transakcje oraz granice atomowości,
- legacy Checkers `prefix_gameplays`, `prefix_moves`, `prefix_scores` — udokumentowane porównawczo jako MySQL/SmartFox, nie liczone automatycznie do mapy PostgreSQL.

### Stan inwentaryzacji ETAPU 1B

**26/26 tabel PostgreSQL zostało zmapowanych na podstawie kodu.**

Do formalnego zamknięcia ETAPU 1B pozostają:
1. porównanie mapy repozytorium z rzeczywistym schematem produkcyjnym PostgreSQL/Render,
2. końcowy model match i rejestr rozbieżności.

## Spis dokumentacji

- `README.md` — zasady prowadzenia nowej dokumentacji.
- `00-STATUS-I-SPIS-TRESCI.md` — niniejszy dokument statusowy.
- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md` — potwierdzony punkt wyjścia architektury.
- `02-BAZA-DANYCH/00-MAPA-POSTGRESQL-STATUS.md` — status kompletnej mapy 26 tabel.
- `02-BAZA-DANYCH/01-TOZSAMOSC-I-AUDYT.md` — zakres pierwszych ukończonych partii mapowania.
- `02-BAZA-DANYCH/02-GRY-WARCABY-POSTGRESQL-AS-IS.md` — Warcaby: legacy SmartFox/MySQL vs modern PostgreSQL, DDL/DML `gracz_game_sessions`, sesja, ranking i concurrency.
- `02-BAZA-DANYCH/03-GRY-TYSIAC-POSTGRESQL-AS-IS.md` — Tysiąc: `gracz_thousand_games`, JSONB, revision, optimistic locking, API i realtime.
- `02-BAZA-DANYCH/04-GRY-GOMOKU-AS-IS.md` — Gomoku: model pamięciowy, ruchy, revision w RAM, idempotency requestId, lobby i brak persistence PostgreSQL.
- `02-BAZA-DANYCH/05-WIADOMOSCI-PRYWATNE-POSTGRESQL-AS-IS.md` — wiadomości prywatne i załączniki: DDL/DML, FK, indeksy, szyfrowanie, foldery, pełna ścieżka delete i AES-256-GCM.
- `02-BAZA-DANYCH/06-MODERACJA-POSTGRESQL-AS-IS.md` — moderacja: decyzje automatycznego filtra, odwołania, DDL/DML, integracja z kontami/chatem/audytem/RBAC oraz ryzyka i niepotwierdzone elementy workflow.
- `02-BAZA-DANYCH/07-GLOBAL-CHAT-POSTGRESQL-AS-IS.md` — Global Chat: cztery tabele PostgreSQL, DDL/DML, SSE/presence, tematy, znajomi, raportowanie, reakcje JSONB, soft-delete i ryzyka concurrency/integralności.
- `02-BAZA-DANYCH/08-TURNIEJE-POSTGRESQL-AS-IS.md` — turnieje: trzy tabele PostgreSQL, DDL/DML, uczestnicy, pairingi, raportowanie wyników, standings, awans rund, autoryzacja i ryzyka concurrency/atomowości.
- `02-BAZA-DANYCH/09-NEWSLETTER-POSTGRESQL-AS-IS.md` — newsletter: pięć tabel PostgreSQL, double opt-in, tokeny, consent/source/event history, administracja, bezpieczeństwo, retencja i granice atomowości.

## Reguła dalszej pracy

Każdy następny ukończony fragment audytu ma zostać zapisany w tym katalogu po weryfikacji z kodem. Dokumentacja nie może wyprzedzać dowodów z repozytorium.
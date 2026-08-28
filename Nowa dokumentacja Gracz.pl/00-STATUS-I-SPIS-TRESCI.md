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
- Stan części funkcji Gomoku/lobby występuje w pamięci procesu i wymaga uwzględnienia w dalszej analizie architektury.
- W kodzie występuje SSE; WebSocket/realtime w architekturze docelowej należy traktować oddzielnie od stanu obecnego.

### ETAP 1B — mapa PostgreSQL

Zakres mapy: **26 tabel**.

Opracowane/rozpoczęte obszary:
- tożsamość — 7 tabel,
- audyt — 1 tabela,
- gry / Warcaby — potwierdzono i udokumentowano PostgreSQL `gracz_game_sessions`; analiza concurrency wyższej warstwy pozostaje do domknięcia,
- legacy Checkers `prefix_gameplays`, `prefix_moves`, `prefix_scores` — udokumentowane porównawczo jako MySQL/SmartFox, nie liczone automatycznie do mapy PostgreSQL.

Do pełnego zamknięcia mapy pozostają dalsze tabele gier oraz wiadomości, moderacja, chat globalny, turnieje, newsletter i końcowe porównanie z produkcją/model match.

## Spis dokumentacji

- `README.md` — zasady prowadzenia nowej dokumentacji.
- `00-STATUS-I-SPIS-TRESCI.md` — niniejszy dokument statusowy.
- `01-ARCHITEKTURA/01-BAZA-AUDYTU-ARCHITEKTURY.md` — potwierdzony punkt wyjścia architektury.
- `02-BAZA-DANYCH/00-MAPA-POSTGRESQL-STATUS.md` — status kompletnej mapy 26 tabel.
- `02-BAZA-DANYCH/01-TOZSAMOSC-I-AUDYT.md` — zakres pierwszych ukończonych partii mapowania.
- `02-BAZA-DANYCH/02-GRY-WARCABY-POSTGRESQL-AS-IS.md` — Warcaby: legacy SmartFox/MySQL vs modern PostgreSQL, DDL/DML `gracz_game_sessions`, model sesji, ranking i ryzyka concurrency.

## Reguła dalszej pracy

Każdy następny ukończony fragment audytu ma zostać zapisany w tym katalogu po weryfikacji z kodem. Dokumentacja nie może wyprzedzać dowodów z repozytorium.
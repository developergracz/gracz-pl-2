# Gracz.pl 2.0 — nowa dokumentacja techniczna

## Punkt kontrolny — 2026-08-28

Ten katalog przechowuje nową dokumentację Gracz.pl 2.0 tworzoną od podstaw. Nie zastępuje ani nie nadpisuje wcześniejszych audytów znajdujących się w katalogu `Dokumentacja/`.

## Cel projektu

Gracz.pl 2.0 ma być nowoczesną, modułową platformą multiplayer, projektowaną z myślą o dużym ruchu, odporności na awarie i rozwoju przez 10–15 lat.

## ETAP 1A — kierunek architektoniczny

Przyjęty kierunek bazowy:

- modularny monolit jako punkt startowy,
- TypeScript / Node.js,
- React / Next.js,
- REST / OpenAPI,
- WebSocket dla komunikacji czasu rzeczywistego,
- PostgreSQL jako główna relacyjna baza danych,
- Redis dla danych ulotnych, cache i mechanizmów realtime,
- kolejka / mechanizm zdarzeń,
- autorytatywny serwer gry,
- Game Orchestrator,
- możliwość stopniowego wydzielania mikroserwisów w przyszłości (Strangler Fig).

### Warunki architektoniczne wymagane przed docelową implementacją

- single-writer / match-actor dla stanu pojedynczego meczu,
- wersjonowanie stanu i idempotencja operacji,
- Transactional Outbox,
- rozdzielenie widoku gracza i obserwatora,
- backpressure dla komunikacji realtime,
- bezpieczne mechanizmy losowości dla gier, które jej wymagają,
- serwer jako źródło czasu i prawdy o stanie gry,
- klasyfikacja danych,
- migracja starego systemu metodą Strangler Fig.

Status ETAPU 1A: zatwierdzony warunkowo jako kierunek dalszego projektowania.

## ETAP 1B — diagnostyczny audyt istniejącego systemu

ETAP 1B jest w toku. Nie wolno oznaczać go jako zakończonego przed zmapowaniem wszystkich wymaganych obszarów istniejącego systemu i porównaniem ich z produkcją.

### Punkt odniesienia repozytorium

Repozytorium: `developergracz/gracz-pl-2`

Punkt odniesienia używany podczas dzisiejszej analizy: `origin/main` / commit z rodziny `db3c15a…`.

### Zakres zidentyfikowany podczas audytu backendu V2

Audyt obejmuje między innymi:

- auth / tożsamość,
- lobby,
- Warcaby,
- Gomoku,
- Tysiąca,
- wiadomości,
- newsletter,
- mechanizmy bezpieczeństwa,
- CI/CD i wdrożenie,
- model danych PostgreSQL,
- model przyszłego match runtime.

## ETAP 1B — mapa PostgreSQL

Pierwotny zakres mapy PostgreSQL obejmuje 26 tabel.

Dotychczas zamknięto dwa obszary:

1. Tożsamość — 7 tabel.
2. Audyt — 1 tabela.

Łącznie zmapowano 8 z 26 tabel w ramach tego punktu kontrolnego.

Pozostaje 18 tabel, obejmujących w szczególności:

- gry,
- wiadomości,
- moderację,
- chat globalny,
- turnieje,
- newsletter,
- pozostałe zależności wymagane przez istniejący system.

Po zakończeniu mapy tabel wymagane jest również:

- porównanie modelu repozytorium ze stanem produkcyjnym,
- identyfikacja rozbieżności schematu,
- przygotowanie docelowego modelu `match`,
- powiązanie modelu danych z single-writer / match-actor,
- zaprojektowanie granic transakcji i Transactional Outbox.

## Ostatni zakończony punkt

Zakończone:

- PostgreSQL — część 1: tożsamość (7 tabel),
- PostgreSQL — część 2: audyt (1 tabela).

## Następny krok

**MAPA POSTGRESQL — CZĘŚĆ 3: GRY**

Gry są następnym logicznym obszarem, ponieważ stanowią największy i najbardziej złożony fragment systemu poza tożsamością. Pełne zmapowanie tabel gier jest wymagane przed zaprojektowaniem docelowego modelu meczu, match-actora/single-writer oraz Transactional Outbox.

## Zasada kontynuacji

Po wznowieniu pracy nie rozpoczynać ETAPU 1B ani mapowania PostgreSQL od początku. Kontynuować od: **CZĘŚĆ 3 — GRY**.

Każdy kolejny zamknięty większy fragment nowej dokumentacji powinien być zapisywany w tym katalogu, aby repozytorium GitHub stanowiło trwały punkt kontrolny niezależny od sesji ChatGPT/Copilot.

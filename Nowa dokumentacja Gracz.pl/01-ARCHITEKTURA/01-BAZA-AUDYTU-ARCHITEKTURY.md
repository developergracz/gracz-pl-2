# Baza audytu architektury Gracz.pl

## Punkt odniesienia

Pierwotny punkt odniesienia rozpoczętej analizy: `developergracz/gracz-pl-2`, `origin/main @ db3c15a`.

> Uwaga: repozytorium może później zawierać nowsze commity. Ten SHA identyfikuje stan, względem którego wykonywano rozpoczętą analizę.

## Potwierdzone elementy stanu obecnego

- Projekt zawiera warstwę Node.js.
- W repozytorium występują elementy historycznej architektury SmartFox/Java/Flash.
- PostgreSQL pełni rolę trwałej warstwy danych w analizowanej części nowej aplikacji.
- Część stanu Gomoku/lobby jest utrzymywana w pamięci procesu.
- W analizowanym kodzie występuje mechanizm SSE.

## Ważne rozdzielenie

### Stan obecny

Dokumentuje wyłącznie zachowanie potwierdzone kodem i konfiguracją repozytorium.

### Wymaga sprawdzenia środowiska

Elementy zależne od rzeczywistej konfiguracji Render/produkcji, zmiennych środowiskowych, faktycznego schematu uruchomionej bazy lub danych runtime nie mogą zostać uznane za potwierdzone wyłącznie na podstawie repozytorium.

### Architektura docelowa

Nowoczesna, modularna, real-time i skalowalna architektura jest celem modernizacji. Rekomendowane mechanizmy docelowe nie mogą być opisywane jako już wdrożone, jeśli kod tego nie potwierdza.

## Zasada audytowa

Każdy wniosek architektoniczny powinien wskazywać dowód w kodzie albo zostać oznaczony jako wymagający weryfikacji środowiska bądź rekomendacja docelowa.

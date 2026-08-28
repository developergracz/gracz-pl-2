# Mapa PostgreSQL — status

## Cel

Zbudowanie kompletnej, dowodowej mapy PostgreSQL projektu Gracz.pl.

## Zakres

Mapa obejmuje **26 tabel** zidentyfikowanych w ramach rozpoczętego audytu.

## Metodyka

Dla każdej tabeli należy dokumentować osobno:

- dowody DDL — definicja/utworzenie/zmiany schematu,
- dowody DML — rzeczywiste odczyty i zapisy wykonywane przez aplikację,
- relacje i zależności tylko wtedy, gdy wynikają z kodu lub schematu,
- miejsca użycia w aplikacji,
- ryzyka i niespójności,
- elementy wymagające porównania z rzeczywistym środowiskiem produkcyjnym.

Nie wolno rekonstruować brakujących kolumn lub metod na podstawie domysłów.

## Postęp

| Obszar | Liczba tabel | Status |
|---|---:|---|
| Tożsamość | 7 | opracowane w pierwszej partii |
| Audyt | 1 | opracowane |
| Pozostałe obszary | 18 | do pełnego opracowania/weryfikacji |
| **Łącznie** | **26** | mapa w toku |

## Pozostałe obszary

Dalsza mapa obejmuje m.in.:

- gry,
- wiadomości,
- moderację,
- chat globalny,
- turnieje,
- newsletter,
- porównanie ze środowiskiem produkcyjnym,
- analizę modelu match.

## Kryterium zakończenia ETAPU 1B

ETAP 1B można uznać za zakończony dopiero po udokumentowaniu wszystkich 26 tabel, sprawdzeniu dowodów DDL/DML i oznaczeniu rozbieżności wymagających weryfikacji środowiska.

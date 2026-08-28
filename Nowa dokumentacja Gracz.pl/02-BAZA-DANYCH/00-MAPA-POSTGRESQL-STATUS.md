# Mapa PostgreSQL — status

## Cel

Zbudowanie kompletnej, dowodowej mapy PostgreSQL projektu Gracz.pl.

## Zakres

Mapa obejmuje **26 tabel** zidentyfikowanych w ramach rozpoczętego audytu.

## Metodyka

Dla każdej tabeli należy dokumentować osobno:
- dowody DDL,
- dowody DML,
- relacje i zależności tylko potwierdzone kodem/schematem,
- miejsca użycia,
- ryzyka i niespójności,
- elementy wymagające weryfikacji środowiska.

Nie wolno rekonstruować brakujących kolumn lub metod na podstawie domysłów.

## Postęp

| Obszar | Status |
|---|---|
| Tożsamość — 7 tabel | opracowane w pierwszej partii |
| Audyt — 1 tabela | opracowane |
| Gry — Warcaby / `gracz_game_sessions` | DDL/DML i model sesji opracowane; wymaga domknięcia analizy concurrency/callerów `save()` |
| Gry — legacy `prefix_*` | materiał porównawczy MySQL; DDL legacy do weryfikacji, nie liczyć automatycznie do mapy PostgreSQL |
| Gry — pozostałe | w toku |
| Pozostałe obszary | do opracowania/weryfikacji |
| **Łącznie** | **mapa 26 tabel w toku** |

## Potwierdzony PostgreSQL — Gry

`gracz_game_sessions`:
- `game_id VARCHAR(128) PRIMARY KEY`,
- `state TEXT NOT NULL`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- indeks `gracz_game_sessions_updated_idx(updated_at DESC)`.

Dokument szczegółowy: `02-GRY-WARCABY-POSTGRESQL-AS-IS.md`.

## Pozostałe obszary

Dalsza mapa obejmuje m.in. gry (w tym dalsze modele PostgreSQL), wiadomości, moderację, chat globalny, turnieje, newsletter, porównanie ze środowiskiem produkcyjnym i analizę modelu match.

## Kryterium zakończenia ETAPU 1B

ETAP 1B można uznać za zakończony dopiero po udokumentowaniu wszystkich 26 tabel, sprawdzeniu dowodów DDL/DML i oznaczeniu rozbieżności wymagających weryfikacji środowiska.
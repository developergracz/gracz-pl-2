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
| Gry — Warcaby / `gracz_game_sessions` | AS-IS zamknięte; DDL/DML, sesja, ranking i concurrency zweryfikowane |
| Gry — Tysiąc / `gracz_thousand_games` | AS-IS zamknięte; JSONB, revision i optimistic locking zweryfikowane |
| Gry — Gomoku | AS-IS zamknięte; brak persistence PostgreSQL, stan wyłącznie w pamięci procesu |
| Gry — legacy `prefix_*` | materiał porównawczy MySQL; DDL legacy do weryfikacji, nie liczyć automatycznie do mapy PostgreSQL |
| Pozostałe obszary | do opracowania/weryfikacji |
| **Łącznie** | **mapa 26 tabel w toku** |

## Potwierdzony PostgreSQL — Gry

### `gracz_game_sessions`
- `game_id VARCHAR(128) PRIMARY KEY`,
- `state TEXT NOT NULL`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- indeks `gracz_game_sessions_updated_idx(updated_at DESC)`.

Dokument: `02-GRY-WARCABY-POSTGRESQL-AS-IS.md`.

### `gracz_thousand_games`
- `game_id VARCHAR(96) PRIMARY KEY`,
- `players JSONB NOT NULL`,
- `state JSONB NOT NULL`,
- `revision BIGINT NOT NULL DEFAULT 1`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

Kod stosuje optimistic locking przez `WHERE game_id = ... AND revision = ...` oraz konflikt wersji mapowany na błąd concurrency/HTTP 409.

Dokument: `03-GRY-TYSIAC-POSTGRESQL-AS-IS.md`.

### Gomoku

Aktualny kod nie tworzy ani nie używa tabeli PostgreSQL dla Gomoku. `GomokuService` przechowuje partie w `Map()` w pamięci procesu; `revision` jest licznikiem RAM, nie mechanizmem optimistic lockingu.

Dokument: `04-GRY-GOMOKU-AS-IS.md`.

## Pozostałe obszary

Dalsza mapa obejmuje m.in. wiadomości, moderację, chat globalny, turnieje, newsletter, porównanie ze środowiskiem produkcyjnym i analizę modelu match.

## Kryterium zakończenia ETAPU 1B

ETAP 1B można uznać za zakończony dopiero po udokumentowaniu wszystkich 26 tabel, sprawdzeniu dowodów DDL/DML i oznaczeniu rozbieżności wymagających weryfikacji środowiska.
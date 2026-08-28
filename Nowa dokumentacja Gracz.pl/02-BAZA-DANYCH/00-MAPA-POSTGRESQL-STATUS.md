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
| Wiadomości prywatne — `gracz_messages` | DDL/DML, FK, indeksy, szyfrowanie i foldery opracowane |
| Załączniki wiadomości — `gracz_message_attachments` | DDL/DML, FK 1:1, AES-256-GCM i walidacja plików opracowane |
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

## Potwierdzony PostgreSQL — Wiadomości prywatne

### `gracz_messages`
- `message_id UUID PRIMARY KEY`,
- `sender_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE`,
- `recipient_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE`,
- `subject TEXT NOT NULL` po wykonaniu `ALTER COLUMN`,
- `body TEXT NOT NULL`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
- `read_at TIMESTAMPTZ`,
- `recipient_archived BOOLEAN NOT NULL DEFAULT FALSE`,
- `sender_deleted BOOLEAN NOT NULL DEFAULT FALSE`,
- `recipient_deleted BOOLEAN NOT NULL DEFAULT FALSE`,
- indeksy po `(recipient_id, created_at DESC)` i `(sender_id, created_at DESC)`.

Temat i treść są szyfrowane aplikacyjnie przed zapisem.

### `gracz_message_attachments`
- `message_id UUID PRIMARY KEY REFERENCES gracz_messages(message_id) ON DELETE CASCADE`,
- `file_name VARCHAR(120) NOT NULL`,
- `storage_name VARCHAR(80)`,
- `mime_type VARCHAR(32) NOT NULL`,
- `file_size INTEGER NOT NULL`,
- `iv BYTEA NOT NULL`,
- `auth_tag BYTEA NOT NULL`,
- `ciphertext BYTEA NOT NULL`,
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

Model jest 1:1 z wiadomością; załączniki są szyfrowane AES-256-GCM.

Dokument: `05-WIADOMOSCI-PRYWATNE-POSTGRESQL-AS-IS.md`.

## Pozostałe obszary

Dalsza mapa obejmuje m.in. moderację, chat globalny, turnieje, newsletter, porównanie ze środowiskiem produkcyjnym i analizę modelu match.

## Kryterium zakończenia ETAPU 1B

ETAP 1B można uznać za zakończony dopiero po udokumentowaniu wszystkich 26 tabel, sprawdzeniu dowodów DDL/DML i oznaczeniu rozbieżności wymagających weryfikacji środowiska.
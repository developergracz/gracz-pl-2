# ETAP 1B — Mapa PostgreSQL — Wiadomości prywatne AS-IS

Data: 28.08.2026

## Status i źródła

Zweryfikowany fragment audytu AS-IS prywatnej komunikacji na podstawie:
- `modern/checkers-engine/src/postgres-accounts.js`,
- `modern/checkers-engine/src/message-attachments.js`,
- ścieżek HTTP `/messages` w `server.js`.

Dokument obejmuje wyłącznie potwierdzone DDL/DML i zachowanie aktualnego kodu.

## 1. Potwierdzone tabele PostgreSQL

### `gracz_messages`

DDL:
```sql
CREATE TABLE IF NOT EXISTS gracz_messages (
  message_id UUID PRIMARY KEY,
  sender_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  recipient_id VARCHAR(32) NOT NULL REFERENCES gracz_accounts(user_id) ON DELETE CASCADE,
  subject VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  recipient_archived BOOLEAN NOT NULL DEFAULT FALSE,
  sender_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  recipient_deleted BOOLEAN NOT NULL DEFAULT FALSE
)
```

Następnie kod wykonuje:
```sql
ALTER TABLE gracz_messages ALTER COLUMN subject TYPE TEXT
```

Efektywny typ `subject` w schemacie tworzonym przez aktualny kod to więc `TEXT NOT NULL`.

Indeksy:
```sql
CREATE INDEX IF NOT EXISTS gracz_messages_recipient_idx
ON gracz_messages(recipient_id, created_at DESC)
```

```sql
CREATE INDEX IF NOT EXISTS gracz_messages_sender_idx
ON gracz_messages(sender_id, created_at DESC)
```

Relacje:
- `sender_id -> gracz_accounts.user_id` z `ON DELETE CASCADE`,
- `recipient_id -> gracz_accounts.user_id` z `ON DELETE CASCADE`.

### `gracz_message_attachments`

DDL:
```sql
CREATE TABLE IF NOT EXISTS gracz_message_attachments(
  message_id UUID PRIMARY KEY REFERENCES gracz_messages(message_id) ON DELETE CASCADE,
  file_name VARCHAR(120) NOT NULL,
  storage_name VARCHAR(80),
  mime_type VARCHAR(32) NOT NULL,
  file_size INTEGER NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  ciphertext BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Dodatkowo:
```sql
ALTER TABLE gracz_message_attachments
ADD COLUMN IF NOT EXISTS storage_name VARCHAR(80)
```

`message_id` jest jednocześnie PK i FK, więc aktualny model dopuszcza maksymalnie jeden załącznik do jednej wiadomości.

## 2. Szyfrowanie wiadomości

`PostgresAccountService` wyprowadza 32-bajtowy klucz wiadomości przez HKDF-SHA256 z sekretu aplikacji.

Przed INSERT do `gracz_messages`:
- temat jest szyfrowany aplikacyjnie,
- treść jest szyfrowana aplikacyjnie,
- do bazy trafiają wartości zaszyfrowane, nie tekst jawny.

Identyfikator wiadomości jest generowany przez `randomUUID()`.

DML zapisu:
```sql
INSERT INTO gracz_messages
(message_id, sender_id, recipient_id, subject, body)
VALUES ($1,$2,$3,$4,$5)
```

## 3. Walidacja wysyłania wiadomości

Potwierdzone ograniczenia aplikacyjne:
- nadawca nie może wysłać wiadomości do samego siebie,
- odbiorca musi istnieć,
- odbiorca może wyłączyć przyjmowanie wiadomości przez `profile_data.allowMessages=false`,
- temat jest wymagany i wejściowo ograniczany do 120 znaków przed szyfrowaniem,
- treść jest wymagana i wejściowo ograniczana do 5000 znaków przed szyfrowaniem.

## 4. Odczyt i foldery

Obsługiwane foldery:
- `inbox`,
- `unread`,
- `sent`,
- `archive`.

Lista wiadomości łączy `gracz_messages` z `gracz_accounts` dla nadawcy i odbiorcy.

Wiadomości są sortowane po `created_at DESC`, limit 100.

Licznik nieprzeczytanych używa:
```sql
SELECT COUNT(*)::int AS count
FROM gracz_messages
WHERE recipient_id=$1
  AND recipient_deleted=FALSE
  AND read_at IS NULL
```

## 5. Operacje użytkownika na wiadomości

### Oznaczenie jako przeczytana

```sql
UPDATE gracz_messages
SET read_at=COALESCE(read_at,NOW())
WHERE message_id=$1
  AND recipient_id=$2
  AND recipient_deleted=FALSE
```

Operacja jest idempotentna dzięki `COALESCE(read_at,NOW())`.

### Archiwizacja

Kod aktualizuje `recipient_archived` tylko dla odbiorcy i tylko jeśli wiadomość nie została wcześniej logicznie usunięta po stronie odbiorcy.

### Usuwanie

Model zawiera osobne flagi:
- `sender_deleted`,
- `recipient_deleted`.

Jest to soft-delete zależny od roli użytkownika, a nie natychmiastowe fizyczne usunięcie rekordu po pierwszym usunięciu przez jedną stronę.

## 6. Załączniki

Aktualny kod zezwala tylko na:
- `image/png`,
- `image/jpeg`.

Maksymalny rozmiar: 1 MiB.

Walidowane są:
- MIME type,
- rozszerzenie pliku,
- format base64,
- rzeczywisty rozmiar po dekodowaniu,
- sygnatura pliku PNG/JPEG.

Załącznik może dodać wyłącznie nadawca wiadomości.

Nie można:
- podmienić istniejącego załącznika,
- dodać załącznika po przeczytaniu wiadomości przez odbiorcę.

## 7. Szyfrowanie załączników

Załączniki są szyfrowane aplikacyjnie przez AES-256-GCM.

W bazie zapisywane są:
- `iv`,
- `auth_tag`,
- `ciphertext`,
- metadane pliku.

AAD obejmuje identyfikator wiadomości oraz metadane związane z plikiem, dzięki czemu integralność tych wartości jest kryptograficznie związana z ciphertextem.

DML:
```sql
INSERT INTO gracz_message_attachments
(message_id,file_name,storage_name,mime_type,file_size,iv,auth_tag,ciphertext)
VALUES($1,$2,$3,$4,$5,$6,$7,$8)
```

Konflikt PK (`23505`) jest mapowany na błąd oznaczający, że istniejącego załącznika nie można podmienić.

## 8. Odczyt załącznika

Odczyt wykonuje JOIN z `gracz_messages` i sprawdza, czy użytkownik jest nadawcą lub odbiorcą oraz czy dana strona nie usunęła wiadomości.

Dopiero po tej autoryzacji ciphertext jest odszyfrowywany AES-256-GCM.

`ON DELETE CASCADE` powoduje fizyczne usunięcie rekordu załącznika, gdy fizycznie usunięta zostanie wiadomość nadrzędna.

## 9. Integralność i bezpieczeństwo — POTWIERDZONE

- FK z wiadomości do `gracz_accounts` są rzeczywiście obecne w DDL.
- FK załącznika do wiadomości jest rzeczywiście obecny w DDL.
- `ON DELETE CASCADE` występuje na obu relacjach wiadomość->konto i załącznik->wiadomość.
- Temat i treść są szyfrowane przed zapisem.
- Załącznik jest szyfrowany AES-256-GCM.
- Dostęp do załącznika jest ograniczony do nadawcy/odbiorcy, z uwzględnieniem flag usunięcia.
- Model załączników jest 1:1 z wiadomością.
- Indeksy wspierają skrzynkę odbiorczą i wysłane wiadomości po użytkowniku i czasie.

## 10. Ryzyka / obserwacje AS-IS

### HIGH
- Usunięcie konta przez `ON DELETE CASCADE` usuwa fizycznie wiadomości, w których konto jest nadawcą albo odbiorcą, co ma wpływ na retencję/audyt i wymaga świadomej decyzji biznesowej w architekturze docelowej.

### MEDIUM
- `subject` jest tworzony jako `VARCHAR(120)`, a następnie zmieniany na `TEXT`; ograniczenie 120 znaków jest więc utrzymywane przez aplikację, nie przez końcowy typ kolumny.
- Brak potwierdzonego CHECK na `file_size`, MIME czy długość subject/body — te ograniczenia są aplikacyjne.
- Jeden załącznik na wiadomość wynika z PK `message_id`; jest to twarde ograniczenie schematu.

### LOW / obserwacja
- `storage_name` jest nullable ze względu na kompatybilność z wcześniejszymi rekordami; kod odszyfrowania ma fallback dla starszego formatu AAD bez `storage_name`.

## 11. WYMAGA DALSZEJ WERYFIKACJI

- pełna logika fizycznego usuwania rekordu po ustawieniu flag obu stron,
- czy istnieją dodatkowe `ALTER TABLE`/indeksy poza analizowanymi plikami,
- rzeczywisty stan schematu na produkcyjnym PostgreSQL/Render,
- polityka retencji i backupów zaszyfrowanych wiadomości,
- rotacja kluczy szyfrowania i migracja ciphertextów.

## 12. Status obszaru

Potwierdzone tabele PostgreSQL prywatnej komunikacji:
1. `gracz_messages`,
2. `gracz_message_attachments`.

DDL, główne DML, relacje, szyfrowanie, foldery i załączniki zostały zmapowane AS-IS. Obszar wymaga jeszcze punktowej weryfikacji pełnej ścieżki delete/retencji i produkcyjnego schematu, ale jego rdzeń PostgreSQL jest udokumentowany.
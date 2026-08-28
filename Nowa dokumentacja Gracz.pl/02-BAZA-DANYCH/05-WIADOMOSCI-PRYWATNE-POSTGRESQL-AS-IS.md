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

Efektywny typ `subject` w schemacie tworzonym przez aktualny kod to `TEXT NOT NULL`.

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

### Usuwanie — pełna ścieżka POTWIERDZONA

Po sprawdzeniu `deletePrivateMessage()` potwierdzono pełny model usuwania:

1. Kod pobiera `sender_id` i `recipient_id` dla `message_id`.
2. Operacja jest dozwolona tylko wtedy, gdy bieżący użytkownik jest nadawcą albo odbiorcą.
3. Jeśli usuwa nadawca:
```sql
UPDATE gracz_messages
SET sender_deleted=TRUE
WHERE message_id=$1
```
4. Jeśli usuwa odbiorca:
```sql
UPDATE gracz_messages
SET recipient_deleted=TRUE
WHERE message_id=$1
```
5. Po każdej operacji wykonywane jest:
```sql
DELETE FROM gracz_messages
WHERE message_id=$1
  AND sender_deleted=TRUE
  AND recipient_deleted=TRUE
```

Wniosek AS-IS:
- pierwsze usunięcie przez jedną stronę jest soft-delete,
- rekord pozostaje w PostgreSQL dla drugiej strony,
- fizyczne usunięcie następuje dopiero po logicznym usunięciu przez nadawcę i odbiorcę,
- fizyczny `DELETE` wiadomości usuwa również załącznik przez FK `ON DELETE CASCADE`.

W analizowanej ścieżce nie ma mechanizmu automatycznego usuwania wiadomości po określonym czasie ani pola `expires_at`/`retention_until`.

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
- Soft-delete jest niezależny dla nadawcy i odbiorcy.
- Fizyczny DELETE rekordu jest wykonywany dopiero po ustawieniu obu flag usunięcia.
- Fizyczne usunięcie wiadomości kaskadowo usuwa załącznik.

## 10. Ryzyka / obserwacje AS-IS

### HIGH
- Usunięcie konta przez `ON DELETE CASCADE` usuwa fizycznie wiadomości, w których konto jest nadawcą albo odbiorcą, niezależnie od tego, czy druga strona zachowała wiadomość. Ma to wpływ na retencję/audyt i wymaga świadomej decyzji biznesowej w architekturze docelowej.

### MEDIUM
- Brak potwierdzonej polityki czasowej retencji w kodzie: wiadomość może pozostawać w DB bezterminowo, dopóki nie zostanie usunięta przez obie strony lub przez kaskadę po usunięciu konta.
- `subject` jest tworzony jako `VARCHAR(120)`, a następnie zmieniany na `TEXT`; ograniczenie 120 znaków jest utrzymywane przez aplikację, nie przez końcowy typ kolumny.
- Brak potwierdzonego CHECK na `file_size`, MIME czy długość subject/body — te ograniczenia są aplikacyjne.
- Jeden załącznik na wiadomość wynika z PK `message_id`; jest to twarde ograniczenie schematu.

### LOW / obserwacja
- `storage_name` jest nullable ze względu na kompatybilność z wcześniejszymi rekordami; kod odszyfrowania ma fallback dla starszego formatu AAD bez `storage_name`.

## 11. WYMAGA WERYFIKACJI ŚRODOWISKA

- rzeczywisty stan schematu na produkcyjnym PostgreSQL/Render,
- polityka backupów i retencji danych poza kodem aplikacji,
- rotacja kluczy szyfrowania i migracja istniejących ciphertextów,
- ewentualne zewnętrzne joby/cron/procedury DB realizujące retencję poza analizowanym repozytorium.

## 12. Status obszaru

Potwierdzone tabele PostgreSQL prywatnej komunikacji:
1. `gracz_messages`,
2. `gracz_message_attachments`.

DDL, DML, relacje, szyfrowanie, foldery, załączniki oraz pełna ścieżka soft-delete -> physical delete zostały zmapowane AS-IS na poziomie kodu repozytorium.

**Status: WIADOMOŚCI PRYWATNE — AS-IS ZAMKNIĘTE NA POZIOMIE KODU.**

Otwarte pozostają wyłącznie elementy zależne od środowiska produkcyjnego/operacyjnego, których nie należy dopowiadać bez dowodu.
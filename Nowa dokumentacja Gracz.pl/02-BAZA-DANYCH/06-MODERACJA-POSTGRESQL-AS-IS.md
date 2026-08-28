# ETAP 1B — Mapa PostgreSQL — Moderacja AS-IS

Data: 28.08.2026

## Status i źródła

Zweryfikowany fragment audytu AS-IS na podstawie:
- `modern/checkers-engine/src/moderation-service.js`,
- `modern/checkers-engine/src/main.js`,
- `modern/checkers-engine/src/rbac-service.js`,
- `modern/checkers-engine/src/global-chat.js` wyłącznie dla rozdzielenia raportów chatu od rdzenia moderacji.

Dokument opisuje stan potwierdzony kodem. Nie zakłada istnienia osobnych tabel `gracz_bans`, `gracz_blocks`, `gracz_reports` ani `gracz_moderation_actions`, ponieważ nie zostały potwierdzone w analizowanym module.

## 1. Potwierdzone tabele rdzenia moderacji

### `gracz_moderation_decisions`

```sql
CREATE TABLE IF NOT EXISTS gracz_moderation_decisions(
  decision_id UUID PRIMARY KEY,
  user_id VARCHAR(32),
  context VARCHAR(32) NOT NULL,
  outcome VARCHAR(16) NOT NULL,
  reason VARCHAR(64),
  content_hash CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

Potwierdzone cechy:
- `decision_id` jest UUID generowanym w aplikacji,
- `user_id` jest nullable,
- brak FK z `user_id` do `gracz_accounts` w tym DDL,
- `context`, `outcome` i `reason` są tekstowymi polami klasyfikującymi decyzję,
- `content_hash` istnieje w schemacie, ale analizowana metoda `record()` nie zapisuje do niego wartości,
- brak indeksów widocznych w analizowanym pliku.

DML zapisu:
```sql
INSERT INTO gracz_moderation_decisions
(decision_id,user_id,context,outcome,reason)
VALUES($1,$2,$3,$4,$5)
```

## 2. `gracz_moderation_appeals`

```sql
CREATE TABLE IF NOT EXISTS gracz_moderation_appeals(
  appeal_id UUID PRIMARY KEY,
  decision_id UUID NOT NULL
    REFERENCES gracz_moderation_decisions(decision_id)
    ON DELETE CASCADE,
  user_id VARCHAR(32) NOT NULL,
  explanation TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  reviewed_by VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
)
```

Potwierdzone relacje:
- `decision_id` ma rzeczywisty FK do `gracz_moderation_decisions`,
- `ON DELETE CASCADE` usuwa odwołania po usunięciu decyzji,
- `user_id` i `reviewed_by` nie mają FK w pokazanym DDL.

DML tworzenia odwołania:
```sql
SELECT 1
FROM gracz_moderation_decisions
WHERE decision_id=$1 AND user_id=$2
```

następnie:
```sql
INSERT INTO gracz_moderation_appeals
(appeal_id,decision_id,user_id,explanation)
VALUES($1,$2,$3,$4)
```

Kod wymaga, aby decyzja należała do użytkownika składającego odwołanie. Wyjaśnienie jest przycinane do 2000 znaków i musi mieć co najmniej 10 znaków.

## 3. Co jest faktycznie moderowane

`ModerationService` filtruje tekst przed zapisem dla:
- loginu/nicku przy rejestracji,
- display name przy rejestracji i zmianie profilu,
- tematu prywatnej wiadomości,
- treści prywatnej wiadomości,
- wiadomości globalnego chatu,
- tytułu i opisu tematu chatu.

Blokowane są potwierdzone wzorce:
- aktywna treść typu `<script>`, `javascript:`, event handlery, iframe, `data:text/html`,
- wybrane wzorce phishingu po hasło/kod MFA/SMS,
- nadmiar linków: ponad 4 dla wiadomości prywatnej i ponad 2 dla chatu,
- zastrzeżone nazwy typu `admin`, `administrator`, `moderator`, `support`, `gracz.pl`, `system`, `owner`, `właściciel`,
- znaki `<` i `>` w nazwie.

Przy blokadzie kod zapisuje decyzję i wysyła zdarzenie do `AuditService` jako `moderation.blocked`.

## 4. Integracja z audytem

Potwierdzone zdarzenia audytowe obejmują m.in.:
- `moderation.blocked`,
- `moderation.appeal.created`,
- `account.registered`,
- `account.registration.failed` / pending verification,
- `account.password.reset`,
- `account.profile.updated`,
- `private-message.sent`,
- `private-message.deleted`.

Zapis moderacyjny i zapis audytowy są wykonywane jako oddzielne wywołania aplikacyjne. W analizowanym kodzie nie ma wspólnej transakcji PostgreSQL obejmującej oba zapisy.

## 5. RBAC a moderacja

`RbacService` definiuje role:
- `player`,
- `moderator`,
- `administrator`,
- `owner`.

Rola moderatora posiada uprawnienia:
- `moderation.review`,
- `moderation.warn`,
- `moderation.ban`.

To jest model uprawnień. W samym `moderation-service.js` nie ma jednak potwierdzonej implementacji trwałego bana, ostrzeżenia ani metody zamykającej/reviewującej odwołanie.

## 6. Rozdzielenie od globalnego chatu

`global-chat.js` tworzy osobną tabelę:
`gracz_global_chat_reports`.

Nie jest ona częścią DDL `ModerationService`, dlatego zostanie szczegółowo udokumentowana razem z globalnym chatem. Jest to ważne rozdzielenie: raport użytkownika na wiadomość chatu i automatyczna decyzja filtra moderacji to dwa różne modele danych.

## 7. Concurrency i atomiczność

- `record()` wykonuje pojedynczy INSERT bez revision/optimistic lockingu; dla append-only decyzji nie ma tu klasycznego lost update.
- `appeal()` najpierw wykonuje SELECT sprawdzający własność decyzji, a potem osobny INSERT.
- brak transakcji obejmującej SELECT + INSERT odwołania,
- brak widocznego UNIQUE na `decision_id` w tabeli odwołań, więc schemat sam w sobie nie ogranicza liczby odwołań do jednego na decyzję,
- zapis decyzji moderacyjnej i zapis zdarzenia audytowego nie są atomowe.

## 8. Ryzyka / obserwacje AS-IS

### HIGH
- model ma uprawnienia `moderation.ban`, ale w analizowanym rdzeniu moderacji nie ma potwierdzonej trwałej implementacji bana ani tabeli banów; nie należy utożsamiać permission z wykonanym mechanizmem,
- decyzja moderacji i odpowiadający wpis audytowy nie są objęte jedną transakcją.

### MEDIUM
- `user_id` w decyzjach oraz `user_id`/`reviewed_by` w odwołaniach nie mają FK w pokazanym DDL,
- `content_hash` istnieje, ale bieżący zapis `record()` go nie wypełnia,
- brak CHECK ograniczających wartości `context`, `outcome`, `status` i `reason`,
- brak indeksów moderacyjnych widocznych w analizowanym pliku,
- brak potwierdzonego mechanizmu review/close odwołań mimo pól `status`, `reviewed_by`, `reviewed_at`.

### LOW / obserwacja
- bez PostgreSQL decyzje moderacyjne trafiają jedynie do tablicy `memory`, więc środowisko bez DB nie zachowuje ich po restarcie; odwołanie w trybie bez DB również nie ma trwałego zapisu.

## 9. WYMAGA WERYFIKACJI ŚRODOWISKA

- czy produkcyjny schemat ma dodatkowe migracje, indeksy lub FK niewidoczne w analizowanym kodzie,
- czy istnieją zewnętrzne procesy obsługi odwołań,
- czy istnieje poza analizowanym modułem trwały system banów/ostrzeżeń,
- polityka retencji decyzji i odwołań,
- rzeczywisty workflow moderatora na produkcji.

## 10. Status obszaru

Rdzeń moderacji PostgreSQL jest zmapowany AS-IS dla dwóch potwierdzonych tabel:
1. `gracz_moderation_decisions`,
2. `gracz_moderation_appeals`.

Integracja z kontami, prywatnymi wiadomościami, chatem, audytem i RBAC została potwierdzona. `gracz_global_chat_reports` pozostaje do pełnego opracowania w następnym obszarze — Global Chat.
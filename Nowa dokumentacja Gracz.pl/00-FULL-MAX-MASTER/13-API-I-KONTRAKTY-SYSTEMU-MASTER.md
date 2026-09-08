# GRACZ.PL — FULL API & SYSTEM CONTRACT CATALOG

**Dokument:** TOM 1 / API & Contracts  
**Status:** LIVING DOCUMENTATION / EVIDENCE-BASED / NOT FROZEN  
**Data checkpointu:** 2026-09-08  
**Repozytorium:** `developergracz/gracz-pl-2`  
**Baseline kodu:** `main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`  
**Baseline TREE:** `04f72af50f6fad2ba01bf7eaa6b4d856267d517b`  
**P8:** PR #43 OPEN / NOT MERGED / audit pending  
**Merge / deploy / production authorization:** NONE

---

## 1. Cel dokumentu

Ten dokument kataloguje aktualne kontrakty HTTP/API portalu Gracz.pl na wskazanym baseline `main` oraz jawnie oddziela zmiany oczekujące w P8/PR #43.

Dokument ma odpowiadać na pytania:

- jaki endpoint istnieje,
- jaka metoda HTTP jest obsługiwana,
- czy endpoint wymaga logowania,
- jaki moduł/plik odpowiada za endpoint,
- jakie dane wejściowe są istotne,
- jaki jest typ odpowiedzi,
- jakie klasy błędów/statusy są oczekiwane,
- czy operacja zapisuje do PostgreSQL,
- czy używa CAS / revision / idempotency,
- czy emituje realtime,
- jaki jest model prywatności,
- gdzie znajdują się testy pokrywające dany kontrakt,
- czy kontrakt jest current-main czy pending-P8.

To jest dokumentacja stanu technicznego, a nie autoryzacja wdrożenia.

---

# 2. Globalny model HTTP

## 2.1. Główna kompozycja

Głównym composition root jest:

`modern/checkers-engine/src/main.js`

Łączy on m.in.:

- `server-p7.js` / `server.js`,
- Auth + Session Registry,
- Accounts,
- Lobby,
- Checkers,
- Gomoku,
- Thousand,
- Global Chat,
- Tournaments,
- Rankings,
- Newsletter,
- Admin Security,
- RBAC/MFA,
- Audit/Security Monitor,
- distributed rate limiting/realtime,
- health/readiness.

## 2.2. Authentication transport

Podstawowy cookie:

`__Host-gracz_session`

W części API obsługiwany jest również:

`Authorization: Bearer <token>`

W produkcyjnym flow frontend otrzymuje marker `cookie` zamiast ujawniania tokenu sesji w JSON, tam gdzie implementacja stosuje `clientSessionToken()`.

## 2.3. Mutations / CSRF boundary

Dla mutacji `POST / PUT / PATCH / DELETE` większość głównych handlerów stosuje same-origin enforcement oparty o:

- `Sec-Fetch-Site`,
- `Origin`,
- porównanie hosta Origin z `Host`.

Cross-site mutation jest odrzucana jako `403 CROSS_SITE_REQUEST`.

## 2.4. Standard odpowiedzi JSON

Typowo:

`Content-Type: application/json; charset=utf-8`

oraz:

`Cache-Control: no-store`

Standard błędu w większości API:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Opis błędu"
  }
}
```

Nie wszystkie historyczne moduły mają identyczny error mapper; ujednolicenie należy ocenić w pełnym audycie projektu.

## 2.5. Rate limiting

Warstwy obejmują zależnie od endpointu:

- lokalny `TrafficGuard`,
- współdzielony `PostgresDistributedTrafficGuard`,
- credential/login limiter,
- per-account action limiting,
- własne limitery modułowe (np. Thousand, Chat, Newsletter/Admin).

Brak współdzielonej infrastruktury w ścieżkach wymagających shared guard może skutkować fail-closed `503`.

---

# 3. Health / readiness

Implementacja:

`src/health.js`

| Method | Endpoint | Auth | Contract |
|---|---|---|---|
| GET | `/health` | NO | `{status:"ok"}` |
| GET | `/health/live` | NO | liveness: `{status:"ok",probe:"liveness"}` |
| GET | `/health/ready` | NO | sprawdza `store.healthCheck()` gdy dostępne |

`/health/ready`:

- `200` → `{status:"ready",probe:"readiness"}`,
- `503` → `{status:"not-ready",probe:"readiness",error:{code:"DEPENDENCY_UNAVAILABLE"}}`.

Persistence: READ ONLY / probe.  
Realtime: NO.

---

# 4. Authentication / account lifecycle

Główna implementacja routingu:

`src/server.js`

Warstwa kont produkcyjnych:

`src/secure-accounts.js` + `src/postgres-accounts.js`

## 4.1. Konfiguracja SMS

### `GET /auth/sms-config`

Auth: NO.

Response:

```json
{"enabled": true|false}
```

Wartość zależy od kompletności konfiguracji Twilio ENV.

## 4.2. Bot challenge config

### `GET /security/challenge-config`

Auth: NO.

Zwraca m.in.:

- `enabled`,
- `provider` (`turnstile` albo null),
- publiczny `siteKey` gdy challenge jest aktywny.

## 4.3. Availability

### `GET /auth/availability?userId=...&displayName=...`

Auth: NO.

Response:

```json
{
  "availability": {
    "userId": true|false|null,
    "displayName": true|false|null
  }
}
```

Persistence: PostgreSQL lookup.

## 4.4. Register

### `POST /auth/register`

Auth: NO.

Istotne pola requestu wynikające z warstw kont:

- `userId`,
- `displayName`,
- `password`,
- e-mail / dane rejestracyjne wymagane przez bazowy account service,
- opcjonalny `phone`,
- `verificationChannel` (`email` / `sms`),
- `challengeToken` gdy bot-defense go wymaga.

Kontrole:

- registration rate limit,
- adaptive bot defense / Turnstile,
- walidacja hasła,
- unikalność konta,
- weryfikacja kanału kontaktowego,
- 6-cyfrowy kod aktywacyjny.

W produkcyjnej SecureAccountService nowa rejestracja przechodzi przez stan wymagający weryfikacji kontaktu.

Typowe statusy:

- `201` po skutecznym pełnym flow obsługiwanym przez route,
- `400` validation,
- `409 ACCOUNT_EXISTS`,
- `403` challenge,
- `429` rate limit,
- `503` shared infrastructure / provider dependency.

Persistence: WRITE PostgreSQL.  
Realtime: NO.

## 4.5. Login / registration verification

### `POST /auth/login`

Standardowy request:

```json
{
  "userId": "...",
  "password": "...",
  "challengeToken": "..."
}
```

SecureAccountService obsługuje również wariant aktywacji poprzez:

```json
{
  "userId": "...",
  "verificationCode": "123456"
}
```

Response po poprawnym logowaniu:

```json
{
  "token": "cookie",
  "user": {
    "userId": "...",
    "displayName": "..."
  }
}
```

W nieprodukcyjnym środowisku `token` może zawierać rzeczywisty token zamiast markera `cookie`.

Kontrole:

- credential rate limit,
- login rate limiter,
- bot challenge,
- scrypt password verification,
- contact verification,
- session registry.

## 4.6. Logout

### `POST /auth/logout`

Auth: toleruje brak/wygaśnięcie aktywnej sesji przy czyszczeniu cookie.

Response:

```json
{"ok":true}
```

Aktywna sesja jest revoke'owana, a cookie czyszczone.

## 4.7. Current user

### `GET /auth/me`

Auth: REQUIRED.

Response:

```json
{
  "user": {
    "userId": "...",
    "displayName": "..."
  }
}
```

## 4.8. Session migration

### `POST /auth/migrate`

Wymaga Bearer tokenu do migracji.

Cel: migracja starszego transportu tokenowego do `__Host-gracz_session` cookie i revoke starego tokenu.

## 4.9. Password recovery request

### `POST /auth/request-password-reset`

Istotne pola zależne od kanału:

- `email` lub `userId` + `phone`,
- `verificationChannel`,
- `challengeToken`.

Response celowo neutralny, aby ograniczyć account enumeration:

```json
{
  "ok": true,
  "message": "Jeżeli adres e-mail pasuje do jednego konta, kod odzyskiwania został wysłany."
}
```

## 4.10. Reset password

### `POST /auth/reset-password`

Istotne pola:

- identyfikacja konta zależnie od kanału,
- `token` / 6-cyfrowy kod,
- `newPassword`,
- `challengeToken`.

Po sukcesie:

- hasło jest zmienione,
- wcześniejsze auth sessions użytkownika są revoke'owane,
- cookie bieżącej sesji jest czyszczone.

## 4.11. Internal/session bootstrap

### `POST /auth/session`

Aktywne tylko gdy `auth` istnieje, ale `accounts` nie jest podłączone.

Źródło user identity:

- `x-authenticated-user-id`,
- `x-authenticated-display-name`.

To jest kontrakt środowiskowy/dev/integracyjny, nie preferowany publiczny flow produkcyjny.

## 4.12. Guest session

Implementacja:

`src/platform-lobby-http.js`

### `POST /auth/guest`

Auth: NO.

Tworzy krótkotrwałego guest usera:

- `guest-<random>`,
- ttl około 1800 s,
- cookie `__Host-gracz_session`,
- `SameSite=Lax` dla guest flow.

Response `201` zawiera publiczny user + `guest:true`.

---

# 5. Account profile / players

## 5.1. Profile

### `GET /account/profile`

Auth: REQUIRED.

Response:

```json
{"profile": {...}}
```

### `PUT /account/profile`

Auth: REQUIRED.

Po zmianie profilu/displayName:

- wydawana jest nowa sesja,
- poprzedni tokenId jest revoke'owany,
- response zawiera `profile`, `user`, `token:"cookie"`.

Persistence: WRITE PostgreSQL.

## 5.2. Player search

### `GET /players/search?q=...`

Auth: REQUIRED.

Response:

```json
{"players":[...]}
```

Persistence: READ PostgreSQL.

---

# 6. Private messages and attachments

## 6.1. Message list

### `GET /messages?folder=inbox|...`

Auth: REQUIRED.

Response pochodzi z account service; gdy attachment service jest aktywny, wiadomości są wzbogacane o metadata załącznika.

## 6.2. Send message

### `POST /messages`

Auth: REQUIRED.

Request: obiekt wiadomości interpretowany przez account service.

Response `201`:

```json
{"message": {...}}
```

Persistence: WRITE PostgreSQL.

## 6.3. Message action

### `PATCH /messages/:messageId`

Request:

```json
{"action":"..."}
```

Operacja delegowana do `updatePrivateMessage()`.

## 6.4. Delete message

### `DELETE /messages/:messageId`

Auth: REQUIRED.

## 6.5. Attachment upload/save

### `POST /messages/:messageId/attachment`

Auth: REQUIRED.

Limit request body w route: około 1.5 MB.

Response `201`:

```json
{"attachment": {...}}
```

## 6.6. Attachment read

### `GET /messages/:messageId/attachment`

Auth: REQUIRED.

Odczyt jest autoryzowany względem użytkownika i wiadomości przez attachment service.

---

# 7. Platform Lobby

Implementacja:

- `src/lobby.js`,
- `src/platform-lobby-http.js`,
- część legacy-compatible w `src/server.js`.

## 7.1. Lobby state

### `GET /lobby/state`

Auth: REQUIRED.

Response:

```json
{
  "rooms": [...],
  "players": [...],
  "invitations": [...]
}
```

## 7.2. Rooms list

### `GET /lobby/rooms`

Auth: REQUIRED.

Response:

```json
{"rooms":[...]}
```

## 7.3. Create room

### `POST /lobby/rooms`

Auth: REQUIRED.

Request istotny:

```json
{
  "roomName": "...",
  "gameType": "...",
  "maxPlayers": 2
}
```

Response: `201` room object.

### CURRENT MAIN

Na baseline `main` istnieją dwie ścieżki routingu; `platform-lobby-http.js` używa historycznego `body.gameType || "checkers"`.

### P8 / PR #43 PENDING

P8 zmienia kontrakt tak, aby:

- brak `gameType` mógł zachować kontrolowany default,
- jawne `null`, pusty tekst lub invalid identifier nie były maskowane jako `checkers`,
- canonical IDs były `checkers / gomoku / thousand`,
- `warcaby` było aliasem do `checkers`,
- capability `lobby` była sprawdzana centralnie.

P8 NIE JEST JESZ częścią `main`.

## 7.4. Join room

### `POST /lobby/rooms/:roomId/join`

Auth: REQUIRED.

Player identity pochodzi z sesji; klient nie wybiera dowolnej tożsamości joinującego gracza.

## 7.5. Invitation

### `POST /lobby/invitations`

Request:

```json
{
  "toId": "...",
  "roomId": "..."
}
```

Response `201`: invitation object.

## 7.6. Invitation response

### `POST /lobby/invitations/:invitationId/respond`

Request:

```json
{"accept":true|false}
```

---

# 8. Checkers API

Implementacja:

- `src/server-p7.js`,
- `src/server.js`,
- `src/session.js`,
- `src/index.js`,
- `src/match-runtime.js`,
- `src/checkers-match-runtime-adapter.js`,
- `src/postgres-session-store.js`.

## 8.1. Create game

### `POST /games`

Auth: REQUIRED w normalnej kompozycji produkcyjnej.

Request zawiera dane `createGameSession()`, w tym identity graczy; przy aktywnym auth serwer wymusza:

`body.whitePlayerId === authenticated userId`

w przeciwnym razie `403 FORBIDDEN`.

Response `201`:

```json
{"gameId":"..."}
```

Persistence: WRITE.

## 8.2. Game snapshot

### `GET /games/:gameId`

Auth: REQUIRED.

Response to player-specific:

`getSessionSnapshot(session, playerId)`

Nie jest to surowy authoritative state.

## 8.3. Move — CURRENT P7 CUTOVER

### `POST /games/:gameId/moves`

Na store wspierającym MatchRuntime endpoint jest przechwytywany przez `server-p7.js`.

Request:

```json
{
  "requestId": "client-unique-id",
  "move": {...}
}
```

Warunki:

- authenticated player,
- same-origin mutation,
- local + optional shared traffic guard,
- `requestId` 1..128,
- current runtime version ładowana z repository,
- durable idempotency key = SHA-256 z domeną `checkers:move` + playerId + requestId,
- `MatchRuntime.executeCommand()` z `expectedVersion`,
- ownership fencing przez `ownershipEpoch`,
- repository CAS/transaction.

Success `200`:

```json
{
  "duplicate": false,
  "eventSequence": 123,
  "snapshot": {...}
}
```

Replay tej samej komendy zwraca `duplicate:true` bez ponownego wykonania logical mutation.

Persistence jest authoritative. Realtime jest signal-only i jego awaria po commicie nie cofa poprawnie zapisanej mutacji.

Typowe błędy:

- `400` invalid request/move,
- `401` unauthenticated,
- `403` cross-site / authz,
- `404` session not found,
- `409` version/ownership/idempotency conflict,
- `429` rate limit,
- `503` shared infrastructure unavailable,
- `500` sanitized internal error.

## 8.4. Chat inside Checkers session

### `POST /games/:gameId/chat`

Aktualnie pozostaje w legacy session route.

Request:

```json
{"text":"..."}
```

Persistence: session save.  
Realtime signal: `chat.message`.

## 8.5. Generic game action

### `POST /games/:gameId/actions`

Request:

```json
{"action": {...}}
```

Persistence: session save.  
Realtime: `game.action`.

## 8.6. Disconnect / reconnect

### `POST /games/:gameId/disconnect`

Response:

```json
{"disconnected":true}
```

Realtime: `player.disconnected`.

### `POST /games/:gameId/reconnect`

Response: reconnect player snapshot.  
Realtime: `player.reconnected`.

## 8.7. Checkers events

### `GET /games/:gameId/events`

Auth: REQUIRED.

SSE/realtime subscription.

UWAGA ARCHITEKTONICZNA: P7 cutover dotyczy referencyjnie ścieżki moves; chat/actions/disconnect/reconnect nie powinny być automatycznie opisywane jako pełny MatchRuntime cutover.

---

# 9. Gomoku API

Implementacja:

- `src/gomoku-http.js`,
- `src/gomoku-service.js`,
- `src/postgres-gomoku-service.js`.

## 9.1. View

### `GET /gomoku/games/:gameId`

Auth: REQUIRED.

Response: player view zawierający m.in.:

- game state,
- `color`,
- `canMove`,
- `revision`.

Gracz spoza gry otrzymuje `403 PLAYER_NOT_IN_GAME`.

## 9.2. Move

### `POST /gomoku/games/:gameId/moves`

Auth: REQUIRED.

Request:

```json
{
  "row": 0,
  "column": 0,
  "requestId": "..."
}
```

Gomoku posiada własny durability/CAS model:

- persisted `revision`,
- `UPDATE ... WHERE game_id=$1 AND revision=$expected`,
- requestId idempotency,
- idempotency conflict gdy ten sam requestId zostaje użyty dla innego ruchu,
- po przegranym CAS sprawdzany jest latest state i możliwość idempotent replay,
- w przeciwnym razie `409 GOMOKU_CONCURRENCY_CONFLICT`.

Typowe statusy:

- `200` success/replay,
- `400` invalid move/input,
- `401` unauthenticated,
- `403 PLAYER_NOT_IN_GAME`,
- `404 GAME_NOT_FOUND`,
- `409` OUT_OF_TURN / FIELD_OCCUPIED / GAME_FINISHED / concurrency / idempotency,
- `413` payload too large,
- `500` sanitized Gomoku internal error.

Persistence: WRITE PostgreSQL w produkcyjnej kompozycji.  
Shared MatchRuntime: NO — własny mechanizm durability.

---

# 10. Thousand API

Implementacja:

- `src/thousand-http.js`,
- `src/thousand-service.js`,
- `src/thousand-repository.js`,
- `src/thousand-engine.js`,
- `src/thousand-realtime.js`.

## 10.1. Create game

### `POST /thousand/games`

Auth: REQUIRED.

Request istotny:

```json
{
  "players": [
    {"userId":"...","displayName":"..."}
  ],
  "dealerIndex": 0,
  "rules": {...}
}
```

Warunek: authenticated creator musi należeć do `players`.

Response `201`:

```json
{
  "gameId": "...",
  "revision": 0
}
```

Obsługiwanych jest obecnie 2–4 graczy na poziomie service contract.

## 10.2. Player view

### `GET /thousand/games/:gameId`

Auth: REQUIRED i user musi być uczestnikiem gry.

Response zawiera m.in.:

- `gameId`,
- `revision`,
- `playerCount`,
- publiczną listę graczy/seats,
- `viewerIndex`,
- player-projected `state`,
- `legalCardIds`,
- `updatedAt`.

`state.history` jest zerowane w buildView, aby nie ujawniać pełnej historii wewnętrznej.

## 10.3. Perform action

### `POST /thousand/games/:gameId/actions`

Request:

```json
{
  "action": {...},
  "expectedRevision": 12
}
```

Kontrakt optimistic concurrency:

- jeśli `expectedRevision` podano i nie odpowiada current revision → `STALE_GAME_REVISION` → HTTP `409`,
- repository save używa bieżącej revision jako expected revision,
- concurrency repository error → `409`.

Po sukcesie realtime publikuje:

`thousand.updated`

## 10.4. Next round

### `POST /thousand/games/:gameId/next-round`

Request:

```json
{"expectedRevision":12}
```

Po sukcesie:

`thousand.round-started`

## 10.5. Realtime events

### `GET /thousand/games/:gameId/events`

Auth: REQUIRED.

Jeśli realtime nie jest podłączony:

`501 THOUSAND_REALTIME_DISABLED`.

## 10.6. Ważna granica przed FairPlay MAX

Aktualny `ThousandGameService` ma domyślny RNG:

`random = Math.random`

i wykonuje `shuffleThousandDeck()` lokalnie przy tworzeniu gry i kolejnej rundzie.

To jest **stan obecnego silnika**, a nie przyszły standard FairPlay MAX.

Docelowy GFPE wymaga:

`NO GAME-LOCAL RNG` oraz `NO FAIRPLAY = NO DEAL`.

W związku z tym obecny kontrakt Tysiąca nie jest jeszcze kontraktem Full Max Core.

---

# 11. Rankings API

Implementacja:

`src/rankings.js`

## 11.1. Leaderboard

### `GET /rankings`

Auth: REQUIRED.

Query params:

- `period` = `7d | 30d | 90d | season | all`,
- `q`,
- `minGames`,
- `game`,
- `limit`.

Response:

```json
{
  "rankings": [...],
  "summary": {...},
  "generatedAt": "...",
  "period": "...",
  "game": "..."
}
```

Current main games:

`all / checkers / thousand`.

### CURRENT MAIN caveat

Nieznany `game` jest obecnie redukowany do `all`.

### P8 / PR #43 PENDING

P8 wprowadza fail-closed canonical resolution:

- `all` pozostaje osobnym selektorem agregującym, nie game type,
- `warcaby → checkers`,
- invalid game identifier nie może cicho stać się `all`,
- Gomoku jest canonical, ale rankings capability = false i ma być jawnie `UNSUPPORTED_GAME_TYPE`.

## 11.2. Current player ranking

### `GET /rankings/me`

Auth: REQUIRED.

Response:

```json
{
  "player": {...}|null,
  "summary": {...},
  "period": "...",
  "game": "..."
}
```

Persistence: READ PostgreSQL z zakończonych Checkers/Thousand sessions.

---

# 12. Tournaments API

Implementacja:

`src/tournaments.js`

Wszystkie poniższe endpointy wymagają authenticated user.

## 12.1. List

### `GET /tournaments`

Query jest przekazywany do filter/list logic.

Response:

```json
{"tournaments":[...]}
```

## 12.2. Create

### `POST /tournaments`

Request obejmuje m.in.:

- `title`,
- `description`,
- `game`,
- `format`,
- `maxPlayers`,
- `rounds`,
- `timeControl`,
- `startsAt`,
- `rated`,
- `visibility`.

Response `201`:

```json
{"tournament": {...}}
```

### CURRENT MAIN caveat

Current main ma lokalny słownik:

`warcaby / gomoku / szachy`

i invalid game może być domyślnie mapowany do `warcaby`.

### P8 / PR #43 PENDING

P8 usuwa ten lokalny model i wymusza centralny game type contract:

- `checkers`,
- `gomoku`,
- `thousand`,
- alias `warcaby → checkers`,
- `szachy` i inne unknown → reject,
- nowe zapisy canonical,
- historyczne `warcaby` mogą być normalizowane przy odczycie bez migracji production DB.

## 12.3. Detail

### `GET /tournaments/:tournamentId`

Response:

```json
{
  "tournament": {...},
  "players": [...],
  "matches": [...]
}
```

## 12.4. Join

### `POST /tournaments/:tournamentId/join`

Registration-only; full tournament → `409`.

## 12.5. Leave

### `POST /tournaments/:tournamentId/leave`

Owner nie może opuścić własnego turnieju. Po starcie leave jest blokowany.

## 12.6. Start

### `POST /tournaments/:tournamentId/start`

Tylko owner/organizer.

Warunki m.in.:

- status registration,
- minimum 2 players.

## 12.7. Report result

### `POST /tournaments/:tournamentId/matches/:matchId/result`

Request:

```json
{"result":"1-0|0-1|1/2-1/2"}
```

Authorization:

- tournament owner albo uczestnik danej pary.

PostgreSQL flow używa transaction + `FOR UPDATE`, conditional update i recompute standings; ponowny zapis zakończonego matcha → `409 MATCH_COMPLETED`.

Persistence: WRITE PostgreSQL.

---

# 13. Global Chat API

Implementacja:

`src/global-chat.js`

Auth: REQUIRED dla wszystkich `/global-chat...` operations.

## 13.1. SSE

### `GET /global-chat/events`

SSE events obejmują m.in.:

- `connected`,
- `ping`,
- `message.created`,
- `message.updated`,
- `message.deleted`,
- `topic.created`.

## 13.2. Messages list/search

### `GET /global-chat/messages`

Query params:

- `limit`,
- `q`,
- `user`,
- `topic`,
- `from`,
- `to`.

Response:

```json
{
  "messages": [...],
  "online": [...]
}
```

## 13.3. Presence

### `GET /global-chat/presence`

Response:

```json
{"online":[...]}
```

Presence jest procesowa/in-memory z krótkim TTL widoczności.

## 13.4. Send

### `POST /global-chat/messages`

Request m.in.:

```json
{
  "body":"...",
  "replyTo":"uuid|null",
  "topicId":"uuid|null"
}
```

Kontrole:

- max body 600 chars,
- max 2 links,
- anti-duplicate,
- per-user chat rate limiting.

Response `201`:

```json
{"message": {...}}
```

## 13.5. Edit/Delete

### `PATCH /global-chat/messages/:messageId`

Request:

```json
{"body":"..."}
```

W PostgreSQL edit window = 15 min.

### `DELETE /global-chat/messages/:messageId`

Owner-only semantics w service.

## 13.6. Reactions

### `POST /global-chat/messages/:messageId/reaction`

Request:

```json
{"emoji":"👍"}
```

Dozwolony zestaw jest whitelistowany.

## 13.7. Report message

### `POST /global-chat/messages/:messageId/report`

Request:

```json
{"reason":"..."}
```

## 13.8. Topics

### `GET /global-chat/topics`

Query:

- `q`,
- `category`.

### `POST /global-chat/topics`

Tworzy topic; response `201`.

## 13.9. Friends

### `GET /global-chat/friends`

### `POST /global-chat/friends`

Tworzy request relacji.

### `PATCH /global-chat/friends/:relationId`

Request:

```json
{"action":"..."}
```

### `DELETE /global-chat/friends/:relationId`

Usuwa relację po autoryzacji uczestnika relacji.

---

# 14. Newsletter public API

Implementacja:

`src/newsletter.js`

W production public operations są ograniczane do hostów:

- `gracz.pl`,
- `www.gracz.pl`.

## 14.1. Challenge config

### `GET /newsletter/challenge-config`

Public.

## 14.2. Subscribe

### `POST /newsletter/subscribe`

Public, same-origin.

Request obejmuje:

- `email`,
- `preferredNick` opcjonalnie,
- `consent:true`,
- `legal:true`,
- `challengeToken`,
- antybotowe `website` honeypot,
- `formStartedAt`,
- `submissionId`.

Response `202` jest celowo neutralny.

Double opt-in:

- status pending,
- confirmation token hash,
- TTL 24 h,
- mail confirmation,
- po confirm status subscribed.

## 14.3. Resend confirmation

### `POST /newsletter/resend`

Public, same-origin, rate-limited, Turnstile w production.

## 14.4. Nick availability

### `GET /newsletter/nick-availability?nick=...`

Public, rate-limited.

## 14.5. Confirmation page + action

### `GET /newsletter/confirm?token=...`

HTML confirmation page.

### `POST /newsletter/confirm`

Form-encoded token; aktywuje subscribed state.

## 14.6. Position

### `GET /newsletter/position?token=...`

HTML z aktualnym miejscem na liście.

## 14.7. Unsubscribe

### `GET /newsletter/unsubscribe?token=...`

HTML confirmation page.

### `POST /newsletter/unsubscribe`

Form-encoded token; status → unsubscribed.

---

# 15. Admin Security API

Implementacja:

`src/admin-security-handler.js`

Wymagania globalne:

- session cookie,
- role != player,
- same-origin,
- admin-specific rate limit,
- wybrane operacje wymagają RBAC permission,
- operacje uprzywilejowane wymagają MFA.

## 15.1. Panel

### `GET /admin/security`
### `GET /admin/security/`

HTML panel.

### `GET /admin/security/panel.js`

JS panelu.

## 15.2. Current privileged identity

### `GET /admin/security/me`

Response zawiera:

- userId,
- displayName,
- role,
- `mfaEnabled`.

## 15.3. MFA setup

### `POST /admin/security/mfa/setup`

Dla ról innych niż moderator wymagane permission `admin.settings`.

Zwraca setup TOTP.

## 15.4. MFA enable

### `POST /admin/security/mfa/enable`

Request:

```json
{"code":"123456"}
```

## 15.5. Change role

### `POST /admin/security/roles`

Wymaga:

- aktywnego MFA,
- kodu w headerze `x-gracz-mfa-code`,
- permission `admin.users`.

Request:

```json
{
  "userId":"...",
  "role":"player|moderator|administrator|owner"
}
```

Operacja jest auditowana.

## 15.6. Audit health

### `GET /admin/security/audit-health`

Wymaga MFA + `admin.audit`.

Response deklaruje m.in. stan:

- audit append-only,
- MFA required,
- current role.

---

# 16. Newsletter Admin API

Implementacja:

`src/newsletter-admin-handler.js`

Wszystkie operacje wymagają authenticated privileged user i odpowiedniego RBAC.

## 16.1. Dashboard

### `GET /admin/newsletter/dashboard`

Permission: `newsletter.read`.

## 16.2. Subscribers

### `GET /admin/newsletter/subscribers`

Permission: `newsletter.read`.

Query → service pagination/filter options.

## 16.3. Subscriber detail

### `GET /admin/newsletter/subscribers/:id`

Permission: `newsletter.read`.

## 16.4. Reveal subscriber e-mail

### `GET /admin/newsletter/subscribers/:id/email`

Wymaga:

- `newsletter.email.reveal`,
- privileged MFA,
- `x-gracz-mfa-code`,
- dodatkowego throttlingu.

Operacja jest jawnie auditowana.

## 16.5. Stats

### `GET /admin/newsletter/stats`

Permission: `newsletter.read`.

## 16.6. Newsletter security events

### `GET /admin/newsletter/security/events?limit=...`

Permission: `newsletter.security.read`.

---

# 17. Static/UI routes mające znaczenie kontraktowe

Serwer udostępnia m.in. strony/asset paths dla:

- `/` / lobby,
- `/game.html`,
- `/messages.html`,
- `/players.html`,
- `/gomoku.html`,
- `/settings.html`,
- `/global-chat.html`,
- `/coming-soon.html`,
- `/aktualnosci.html`,
- `/polityka-prywatnosci.html`,
- `/tournaments.html`,
- `/community.html`,
- `/ranking.html`,
- `/thousand.html`.

Statyczne asset routes nie są traktowane w tym katalogu jako business API, ale ich dostępność należy uwzględnić w browser/E2E matrix.

---

# 18. Concurrency / idempotency matrix

| Domena | Mechanizm current main | Publiczny token/wersja | Conflict |
|---|---|---|---|
| Checkers moves | MatchRuntime + repository CAS + ownershipEpoch + durable command idempotency | `requestId`; server loads expectedVersion | 409 |
| Checkers chat/actions/reconnect | legacy session save path | różne, zależne od session contract | wymaga dalszej oceny pełnego audytu |
| Gomoku move | PostgreSQL revision CAS + requestId replay | `requestId` | 409 |
| Thousand action | repository revision + optional client `expectedRevision` | `expectedRevision` | 409 |
| Tournament result | DB transaction + row locks + conditional completed-state update | match identity | 409 duplicate/completed |
| Lobby | service-level room/invitation constraints | identifiers | 404/409 |
| Global Chat | application/service constraints; message IDs UUID | message/topic/friend IDs | 4xx |
| Newsletter | row locks/token hashes/rate limits | opaque tokens | 4xx/429 |

---

# 19. Realtime matrix

| Domena | Endpoint/transport | Model |
|---|---|---|
| Checkers | `/games/:id/events` | SSE/realtime; moves P7 persistence authoritative, publish signal-only |
| Thousand | `/thousand/games/:id/events` | SSE via ThousandRealtimeHub |
| Global Chat | `/global-chat/events` | SSE + broadcast events |
| Gomoku | brak osobnego SSE endpointu w `gomoku-http.js` | client HTTP state flow / external lobby UI integration |
| Lobby | brak canonical SSE endpointu w analizowanym handlerze | polling/state style na current contract |

---

# 20. Privacy / projection matrix

## Checkers

`getSessionSnapshot(session, playerId)` / MatchRuntime adapter projection. Klient nie powinien otrzymywać surowego authoritative state bez projection.

## Gomoku

Cały board/moves jest publiczny z natury gry, ale view jest ograniczony do uczestnika i wzbogacony o jego `color/canMove`.

## Thousand

Player-specific `thousandPublicView()` + `viewerIndex` + `legalCardIds`; prywatne ręce muszą pozostać w projekcji właściwego gracza.

## Messages

Access control jest delegowany do account/message attachment services na bazie current authenticated user.

## Admin

Role/RBAC + MFA dla high-risk operations.

## Newsletter

Public endpoints używają opaque tokenów; admin e-mail reveal wymaga specjalnego permission + MFA + audit.

---

# 21. Test coverage references — current repo

Istotne testy obejmują m.in.:

### Auth / Account / Lobby

- `test/accounts.test.js`
- `test/auth-lobby.test.js`
- `test/auth-session-registry.test.js`
- `test/security-foundation.test.js`

### Checkers / Session / P1-C-01 / P7

- `test/checkers-engine.test.js`
- `test/session.test.js`
- `test/server.test.js`
- `test/p1-c-01-cas.test.js`
- `test/p1-c-01-http-conflict.test.js`
- `test/p1-c-01-concurrent-http-postgres.test.js`
- `test/p1-c-01-postgres-cas.test.js`
- `test/p1-u-02-checkers-runtime.test.js`
- `test/p1-u-02-match-runtime-postgres.test.js`
- `test/p1-u-02-slice2-checkers-http.test.js`
- `test/p1-u-02-p7-f01-privacy.test.js`
- `test/p1-u-02-p7-f02-projection-contract.test.js`
- `test/p1-u-02-p7-f03-current-replay.test.js`

### Gomoku

- `test/gomoku-service.test.js`
- `test/gomoku-multiplayer-http.test.js`
- `test/p1-aud3-04-gomoku-http-concurrency.test.js`
- `test/p1-aud3-04-gomoku-postgres.test.js`

### Thousand

- `test/thousand-engine.test.js`
- `test/thousand-service.test.js`

### Tournaments

- `test/p1-h-01-tournament-concurrency.test.js`

### Security / distributed infra

- `test/traffic-guard.test.js`
- `test/adaptive-bot-defense.test.js`
- `test/security-monitor.test.js`
- `test/p1-aud3-01-runtime-contract.test.js`
- `test/p1-aud3-01-shared-infrastructure.test.js`
- `test/p1-aud3-03-crypto-key-separation.test.js`
- `test/p1-aud3-07-readiness.test.js`
- `test/p1-aud3-07-postgres-readiness.test.js`

### Newsletter

- `test/newsletter-account-form.test.js`
- `test/newsletter-admin.test.js`
- `test/newsletter-lifecycle-analytics.test.js`
- `test/newsletter-penetration.test.js`
- `test/newsletter-security.test.js`

### Browser

- `e2e/lobby.browser.mjs`
- `e2e/gomoku.browser.mjs`

Ten katalog nie twierdzi, że każdy endpoint ma już indywidualny pozytywny i negatywny test HTTP. Pełna `endpoint → exact test case` traceability matrix będzie osobnym tomem i częścią pełnego audytu.

---

# 22. P8 / PR #43 — pending API contract delta

P8 jest wdrożone na branchu:

`fix/p1-u-01-canonical-game-types-p8`

HEAD:

`d7220f57d60779584048cc5c695d40dbb948b9cb`

TREE:

`4cbb8504036d26ed2e257f52a475968f5d4cd827`

P8 definiuje canonical registry:

- `checkers`,
- `gomoku`,
- `thousand`,
- alias `warcaby → checkers`.

Capability matrix P8:

| Game | Lobby | Rankings | Tournaments |
|---|---:|---:|---:|
| checkers | YES | YES | YES |
| gomoku | YES | NO | YES |
| thousand | YES | YES | YES |

P8 wpływa bezpośrednio na kontrakty:

- `POST /lobby/rooms`,
- `GET /rankings`,
- `GET /rankings/me`,
- `POST /tournaments`,
- tournament list/detail/filter semantics.

Do czasu formalnego audytu + autoryzowanego merge ten rozdział ma status:

`PENDING DELTA / NOT CURRENT MAIN`.

---

# 23. Jawne luki / przyszłe tomy

Następujące elementy powinny zostać doprecyzowane w kolejnych tomach FULL MAX:

1. Exact OpenAPI-like JSON schema dla każdego request/response.
2. Endpoint → exact test case traceability matrix.
3. Complete PostgreSQL table/column mapping per endpoint.
4. Complete authorization matrix role/permission/ownership per endpoint.
5. Error-code registry bez duplikatów/niejednoznaczności.
6. API versioning strategy (`/v1` lub negotiated protocol) przed publicznym stabilnym API.
7. Deprecation policy i backward compatibility.
8. Request/response size limits jako centralny standard.
9. Central idempotency contract dla wszystkich write endpoints.
10. Central observability contract: requestId/traceId/audit correlation.
11. GFPE/FairPlay API dopiero po zatwierdzeniu specyfikacji.
12. Tysiąc Full Max API po migracji z game-local RNG do GFPE.

---

# 24. Docelowy kontrakt FairPlay MAX — jeszcze NIE ISTNIEJE

Przyszły Full Max Core powinien dołożyć osobny kontrakt, np. logicznie:

- utworzenie FairPlay session,
- commit/reveal,
- deck/shoe commitment,
- authoritative deal cursor,
- player proof projection,
- Verify Hand / Verify Deal,
- ledger/proof retrieval.

Nazwy endpointów NIE SĄ jeszcze zamrożone i ten dokument nie autoryzuje ich implementacji.

Krytyczne założenie pozostaje:

`Game HTTP/API → Game Service / MatchRuntime → GFPE Adapter → GFPE Core`

Silnik gry nie ma mieć własnego RNG po migracji do Full Max.

---

# 25. Status katalogu

`FULL API & CONTRACT CATALOG = BASELINE CREATED`

`SOURCE BASELINE = main @ ad0739190fe2f9d1657b2b77c8b5f8e825830c08`

`P8 DELTA = RECORDED AS PENDING / NOT MERGED`

`OPENAPI FREEZE = NOT YET`

`FULL PROJECT AUDIT = NOT YET`

`PRODUCTION CONTRACT CERTIFICATION = NOT YET`

`MERGE / DEPLOY AUTHORIZATION = NONE`

---

## 26. Następny zalecany dokument

Po tym katalogu najbardziej wartościowy kolejny artefakt to:

`14-POSTGRESQL-DATA-CATALOG-TABELA-PO-TABELI.md`

Powinien mapować każdą tabelę/kolumnę/constraint/index do:

- właściciela domenowego,
- endpointów zapisujących i czytających,
- klasy danych,
- retencji,
- szyfrowania,
- concurrency semantics,
- backup/restore,
- migracji,
- testów i evidence.
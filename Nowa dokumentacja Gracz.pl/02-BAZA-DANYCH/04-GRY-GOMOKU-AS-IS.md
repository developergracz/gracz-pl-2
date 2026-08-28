# ETAP 1B — Gry: Gomoku AS-IS

Data: 28.08.2026

## Status

Zweryfikowany audyt AS-IS Gomoku na podstawie:
- `modern/checkers-engine/src/gomoku-service.js`,
- `modern/checkers-engine/src/gomoku-http.js`,
- `modern/checkers-engine/src/main.js`,
- `modern/checkers-engine/src/lobby.js`.

## 1. Najważniejsze ustalenie

W aktualnym kodzie Gomoku **nie korzysta z PostgreSQL**.

`GomokuService` utrzymuje partie w prywatnym magazynie pamięci procesu:

```js
#games = new Map();
```

W `main.js` serwis jest tworzony bez repozytorium/persistence:

```js
const gomokuService=new GomokuService();
const gomokuHandler=createGomokuHttpHandler({service:gomokuService,auth,authSessions});
```

Nie ma odpowiednika `PostgresSessionStore` ani `PostgresThousandRepository` dla Gomoku w analizowanym kodzie.

## 2. Model gry w pamięci

Przy utworzeniu partii powstaje obiekt:

```js
{
  gameId,
  size,
  players: {
    black,
    white
  },
  turn: "black",
  status: "active",
  winner: null,
  moves: [],
  revision: 0,
  createdAt,
  updatedAt
}
```

`revision` zwiększa się po każdym zaakceptowanym ruchu:

```js
game.revision += 1;
```

Jest to jednak wyłącznie licznik w obiekcie RAM. Nie występuje warunek typu `expectedRevision`, porównanie wersji przy zapisie ani SQL `WHERE revision = ...`.

## 3. Ruchy i walidacja

`move()` potwierdzenie sprawdza:
- członkostwo gracza w partii,
- opcjonalny `requestId`,
- idempotency powtórzonego ruchu tego samego użytkownika,
- status gry,
- turę,
- zakres współrzędnych,
- zajętość pola.

Ruch jest zapisywany do tablicy `moves` jako:

```js
{
  row,
  column,
  color,
  userId,
  requestId,
  sequence
}
```

## 4. Idempotency

Potwierdzony jest częściowy mechanizm idempotency dla ruchów:

```js
if (requestId && game.moves.some(
  move => move.requestId === requestId && move.userId === userId
)) return this.view(gameId, userId);
```

Mechanizm dotyczy tylko ruchów i istnieje wyłącznie w aktualnym stanie pamięci procesu.

Po restarcie procesu historia `moves` znika, a wraz z nią pamięć o obsłużonych `requestId`.

## 5. HTTP

`gomoku-http.js` udostępnia:
- `GET /gomoku/games/:gameId` — widok gry,
- `POST /gomoku/games/:gameId/moves` — wykonanie ruchu.

Nie ma w tym module endpointów dla:
- reconnect,
- disconnect,
- chat,
- draw/undo,
- event stream/realtime.

## 6. Tworzenie partii przez lobby

`LobbyService` przechowuje pokoje i obecność w pamięci procesu (`Map`). Po zapełnieniu stołu Gomoku wykonuje:

```js
room.gameId=`gomoku-${room.roomId}`;
this.gomokuService.createGame({
  gameId: room.gameId,
  players: room.seats.map(...)
});
```

W przeciwieństwie do Warcabów i Tysiąca nie następuje zapis do PostgreSQL.

## 7. Persistence i restart procesu

### POTWIERDZONE

- Partie Gomoku istnieją tylko w `GomokuService.#games`.
- Pokoje lobby istnieją tylko w `LobbyService.#rooms`.
- Brak warstwy PostgreSQL dla Gomoku w analizowanym kodzie.
- Brak pliku `gomoku-repository.js` / `PostgresGomokuRepository` w analizowanej strukturze.

### Konsekwencja

Restart procesu usuwa:
- aktywne partie Gomoku,
- historię ruchów,
- `revision`,
- informacje potrzebne do kontynuacji bieżącej partii,
- aplikacyjną pamięć `requestId`.

## 8. Concurrency

Model różni się od Warcabów i Tysiąca.

Nie ma read-modify-write do PostgreSQL, więc nie występuje dokładnie ten sam problem lost update co w `gracz_game_sessions`.

Jednocześnie `revision` nie jest optimistic lockingiem. Jest zwykłym licznikiem aktualizowanym w jednym obiekcie JS. API nie przyjmuje `expectedRevision` i nie odrzuca nieaktualnego widoku na podstawie wersji.

Każdy ruch jest wykonywany synchronicznie wewnątrz `GomokuService.move()`, ale trwałość i współbieżność między wieloma procesami/instancjami nie są rozwiązane, ponieważ stan nie jest współdzielony.

## 9. Realtime

W analizowanym kodzie Gomoku nie posiada odpowiednika `ThousandRealtimeHub` ani SSE dedykowanego Gomoku.

`gomoku-http.js` obsługuje tylko GET widoku i POST ruchu. Aktualizacja przeciwnika wymaga więc mechanizmu poza tym modułem albo odpytywania; analizowany kod nie potwierdza dedykowanej publikacji realtime dla Gomoku.

## 10. Ranking

`RankingService` obsługuje zestaw gier:

```js
new Set(["all","checkers","thousand"])
```

Gomoku nie jest uwzględnione w analizowanym rankingu PostgreSQL.

## 11. PostgreSQL — klasyfikacja

Gomoku **nie dodaje kolejnej tabeli do mapy 26 tabel PostgreSQL**, ponieważ aktualny kod nie posiada persistence PostgreSQL dla tej gry.

To jest ważny wynik audytu, a nie brak danych: obecny model Gomoku jest pamięciowy.

## 12. Porównanie trzech modeli gier

| Cecha | Warcaby | Tysiąc | Gomoku |
|---|---|---|---|
| Persistence | PostgreSQL | PostgreSQL | pamięć procesu |
| Tabela | `gracz_game_sessions` | `gracz_thousand_games` | brak |
| Stan | `TEXT` JSON | `JSONB` | obiekt JS |
| Revision | brak | `BIGINT` | licznik w RAM |
| Optimistic locking | brak | tak | nie |
| Idempotency | `processedRequests` | brak osobnego requestId w analizowanym repozytorium | `requestId` dla ruchów |
| Reconnect model | tak | brak osobnego modelu reconnect w analizowanych plikach | brak |
| Realtime | osobna publikacja po save | SSE po save | brak dedykowanego realtime w analizowanym module |
| Odporność na restart | stan w DB | stan w DB | brak — stan przepada |

## 13. Wnioski audytowe

### HIGH
- Brak trwałości stanu Gomoku: restart procesu usuwa aktywne partie i historię ruchów.
- Brak współdzielonego stanu między wieloma instancjami aplikacji.
- `revision` nie pełni funkcji concurrency control.

### MEDIUM
- Idempotency ruchów znika wraz z restartem procesu.
- Brak dedykowanego mechanizmu realtime/reconnect w analizowanych modułach.
- Gomoku nie uczestniczy w obecnym `RankingService`.

### LOW / obserwacja
- Model pamięciowy jest prosty i spójny dla pojedynczego procesu, ale nie stanowi trwałej warstwy danych.

## 14. Status podsekcji

Gomoku AS-IS jest udokumentowane na poziomie aktualnego kodu.

Wniosek dla ETAPU 1B: Gomoku nie posiada tabeli PostgreSQL do zmapowania; należy uwzględnić je jako pamięciowy wyjątek w architekturze gier oraz w późniejszym projekcie docelowym.
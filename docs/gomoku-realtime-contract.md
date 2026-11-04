# Gomoku — kontrakt przyszłej synchronizacji (P1, bez wdrożenia WebSocket)

Stan rozpoznany: `contact-api/auth/public-identity.mjs` udostępnia autoryzowane
HTTP `/auth/match`, `/auth/match/chat`, `/auth/match/undo` i obecność znajomych.
Konsola odpytuje partię co 4 s, czat co 8 s, obecność online co 45 s.
P1 zachowuje te interwały. Nie deklaruje wydajności dla 30 000 graczy.

GRACZ NEXT (`developergracz/gracz-next`, main `85423de`) ma:
- `apps/realtime-gateway/src/service.ts`: WebSocket z limitem połączeń/payloadu,
  kontrolą gotowości i zamykaniem połączeń; brak obsługi wiadomości Gomoku.
- `packages/contracts/src/lobby-rooms.ts`: kontrakt pokoi niezależny od transportu.
- `packages/authorization`, `packages/data-access`, `packages/game-engine`:
  istniejące granice autoryzacji, trwałości i silnika, bez kopiowania legacy.
- Zamrożoną architekturę w
  `docs/gracz-next/01-ARCHITECTURE/GRACZ-NEXT-TARGET-ARCHITECTURE-v1.0-FREEZE.md`:
  PostgreSQL jako trwały autorytet, durable ACK, revision, commandId, snapshot/replay.

## Kontrakt do uzgodnienia przy wdrażaniu transportu

1. Uwierzytelnione połączenie używa istniejącej Identity. Serwer wiąże aktora i
   scope; klient nie wybiera tożsamości ani uprawnień. Każda subskrypcja sesji
   i komenda wymaga autoryzacji istniejących Rooms/Matches, również po reconnect.
2. `subscribe {sessionId, schemaVersion, lastRevision, lastEventIndex}` otrzymuje
   prywatną projekcję `snapshot {sessionId, schemaVersion, rulesVersion, revision,
   state, serverTime}` albo ograniczony replay. Nie przesyła danych innych pokoi.
3. Zmiany partii, wyniku, cofnięcia i czatu: zdarzenia z `eventId`, `eventIndex`
   i `revision`. Klient deduplikuje, odrzuca starszy stan i przy luce pobiera
   snapshot. Watermark wykrywa także utratę ostatniej wiadomości.
4. Zegary przesyłają autorytatywny stan czasu/tury i `serverTime` przy zmianie
   lub synchronizacji; odliczanie jest lokalne, bez pakietów co ułamek sekundy.
5. Komendy NEXT: `{sessionId, commandId, expectedRevision, commandType,
   schemaVersion, payload}`. ACK dopiero po trwałym commit, z `decisionRevision`;
   opcjonalny snapshot ma osobne `currentStateRevision`. Po niepewnym wyniku
   ponawiana jest ta sama intencja/commandId. Dzisiejsze POST legacy nie mają
   takiego kontraktu i P1 nie ponawia ich automatycznie.
6. Reconnect: ograniczony backoff z jitterem, autoryzacja i resync przed dalszą
   grą. Ograniczenia kolejki, replay, payloadu i wolnych klientów są obowiązkowe.
   HTTP polling i WebSocket nie działają równolegle jako dwa źródła synchronizacji.
7. Obliczenia AI pozostają w Web Worker, ustawienia wyglądu w localStorage.
   Brak nowej Identity/Rooms/Matches, Redis lub usług w tym etapie.

# CheckersEngine

Pierwszy niezależny moduł Gracz.pl 2.0. Silnik nie zawiera interfejsu ani
połączeń sieciowych. Dzięki temu ten sam kod może sprawdzać ruchy w przeglądarce
i — jako źródło prawdy — na serwerze multiplayer.

## Zakres wersji 0.1

- plansza 8×8 i 12 pionków na gracza,
- ruchy po ciemnych polach,
- obowiązkowe bicie,
- wielokrotne bicie w jednej turze,
- promocja pionka na damkę,
- sprawdzanie kolejności tur,
- zakończenie gry po utracie pionków lub legalnych ruchów,
- remis przez trzykrotne powtórzenie pozycji lub 80 półruchów bez postępu,
- zapis, odczyt i deterministyczne odtwarzanie partii,
- wersjonowany kontrakt wiadomości multiplayer z walidacją danych wejściowych,
- autorytatywna sesja serwerowa z przypisaniem graczy do kolorów,
- bezpieczne rozłączenie i ponowne połączenie z migawką stanu,
- idempotentne żądania ruchu i trwały dziennik zdarzeń,
- niemutowalny wynik operacji (stan wejściowy nie jest zmieniany).

Wersja 0.1 odwzorowuje wariant 8×8 widoczny w starym serwerze Gracz.pl:
zwykłe pionki poruszają się i biją do przodu, a damki poruszają się o jedno
pole w obu kierunkach. Reguły są odseparowane od transportu, bazy danych i UI.

## Uruchomienie testów

```bash
npm test
```

## Przykład

```js
import { applyMove, createInitialState, getLegalMoves } from "@gracz/checkers-engine";

const state = createInitialState();
const legalMoves = getLegalMoves(state);
const nextState = applyMove(state, legalMoves[0]);
```

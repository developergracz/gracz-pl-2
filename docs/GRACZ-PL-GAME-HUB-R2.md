# GRACZ.PL GAME HUB R2 — FROZEN SPECIFICATION

Status: FROZEN BASELINE
Target: /gry/
Scope: Phase 1 static Game Hub, no AI, no live fabrication, no game-engine changes.

## 1. Product principle
/gry/ is a decision hub, not a tile catalog. The page should ask one clear question, recommend one current game, and keep alternatives close without repeating the same four titles across multiple panels.

## 2. Current catalog
- Poker treningowy — Texas Hold'em, 2–6 players, cards, hidden information, training-only chips.
- Tysiąc — 2–4 players, 24-card game, bidding, melds, tricks, target 1000.
- Warcaby — 2 players, logical board game, declared average time 10–30 minutes.
- Gomoku — 2 players, 15×15 board, declared average time 5–20 minutes.

Where a source page does not define a play-time range, the hub must not invent one.

## 3. Phase 1 modules
### 3.1 Hero / Find your game
Three local-only questions:
1. How much time do you have?
2. Who do you want to play with?
3. Cards or board?

The result is one primary recommendation and up to two alternatives. The rules are deterministic and read only from the catalog data file. No AI.

### 3.2 Single four-game row
Exactly one primary visual row/card set containing Poker, Tysiąc, Warcaby and Gomoku. No duplicated right sidebar with the same four titles.

### 3.3 Comparison
User selects two games and sees only verified metadata: players, medium, information model, core mechanics, and time when explicitly present in source pages.

### 3.4 Honest live-hub placeholder
Until real platform data exists, show “Zbieramy pierwszych graczy”. Do not show fake online counts, fake open tables, fake tournament counts or fake rankings.

### 3.5 Future sections
Micro-demos, live lobby, tournaments, rankings, player journey and AI are specified but not activated in Phase 1.

## 4. Future phases
- Phase 2: 60-second micro-demos for Warcaby and Gomoku; Tysiąc only after R2 engine implementation.
- Phase 3: real lobby status, calendar, tournaments and rankings after platform/L10 gates.
- Phase 4: /coach assistant and explain-simpler trainer using verified catalog/rules only.

## 5. Data contract
Single source: /assets/games-hub-data.json
Required per game:
id, name, url, rulesUrl, icon, medium, players, information, mechanics, verifiedTime, quiz tags, status.

## 6. Honesty rules
- No fabricated player counts, activity, rankings, tournaments or time estimates.
- “In preparation” and “collecting first players” are explicit states.
- AI must never invent game rules or catalog entries.

## 7. UX
- No sidebar on /gry/.
- One scene per viewport rhythm.
- Mobile: quiz first, recommendation immediately below, later sections linear.
- Preserve keyboard focus, aria-live result, aria-pressed comparison controls, reduced-motion support.

## 8. Phase 1 tests
- JSON parses.
- Four unique games.
- All game/rules URLs present.
- Quiz always returns a catalog game.
- Comparison requires two distinct games.
- No duplicate HTML ids.
- No eval/new Function.
- No fake numeric activity counters.
- All current game and rules links preserved.

## 9. Frozen implementation boundary
Phase 1 may change only the /gry/ page, its dedicated CSS/JS and its catalog JSON/specification. It must not change individual game pages, game engines, L10 roadmap, Tysiąc R2 engine, /coach, lobby backends or rankings.

# GRACZ-SEO-01 — Public Site Architecture and URL Map

Version: `R1 CANDIDATE INFORMATION ARCHITECTURE`  
Status: `DESIGN / KEYWORD HYPOTHESES NOT YET VALIDATED BY SEARCH CONSOLE OR KEYWORD-VOLUME DATA`  
Date: 2026-09-29  
Public domain: `https://gracz.pl/`  
Implementation family: Gracz Next may render these pages, but the public SEO identity remains Gracz.pl.

## 1. Purpose

This document defines the first detailed public-page architecture for Gracz.pl. It turns the SEO Control Center design into a concrete URL/content backlog.

Important: the phrases below are strategic seed hypotheses. They are NOT claims of measured search volume, ranking difficulty or guaranteed traffic. SEO-05/SEO-07 must later validate them using fresh Search Console and/or approved research evidence.

## 2. Core architecture decision

Use a small number of strong topical hubs plus focused supporting pages.

Primary hierarchy:

`/gry/`
→ `/gry/poker/`
→ `/gry/tysiac/`
→ `/gry/warcaby/`
→ `/gry/gomoku/`

Supporting taxonomy hubs:

`/gry-karciane/`  
`/gry-planszowe/`  
`/poradniki/`  
`/akademia-pokera/`

Product/community pages:

`/gry-multiplayer/`  
`/turnieje/`  
`/rankingi/`  
`/spolecznosc/`

Do not create multiple near-identical URLs such as `/tysiac-online/`, `/gra-tysiac-online/` and `/tysiac-gra-online/` for the same intent. One strong primary URL is preferred.

## 3. Publication states

### DESIGN_ONLY
URL exists only in documentation.

### PRELAUNCH
A factual public page may exist, but it must clearly say the feature/game is being prepared. No "Graj teraz" CTA unless the game is actually available.

### LIVE
The game/function is genuinely usable and the page may use play-oriented copy.

### EDUCATIONAL
Rules/guide content may be public even when the game runtime is not live, provided the content is complete and useful in its own right.

### HOLD
Do not publish/index until factual/product/privacy/quality prerequisites are satisfied.

## 4. URL rules

- lowercase slugs,
- Polish ASCII slugs without diacritics for stable URLs,
- trailing-slash policy must be selected in SEO-00 and applied consistently,
- HTTPS canonical on `gracz.pl`,
- one primary intent per URL,
- no keyword-stuffed paths,
- redirects required if a public URL later changes,
- all public pages must be registered in SEO Registry before sitemap inclusion.

## 5. Candidate map — 48 public pages

### A. Core hubs and game landing pages

| # | URL | Primary phrase hypothesis | Intent | H1 | Title candidate | Meta description candidate | Primary internal links | Initial wave |
|---:|---|---|---|---|---|---|---|---|
| 1 | `/gry/` | gry online | discovery / play | Gry online na Gracz.pl | Gry online — karciane, planszowe i multiplayer | Gracz.pl | Odkrywaj gry rozwijane na Gracz.pl: poker treningowy, Tysiąc, warcaby, Gomoku i rozgrywki multiplayer. | gry-karciane, gry-planszowe, 4 game landings, multiplayer | W1 |
| 2 | `/gry-karciane/` | gry karciane online | discovery | Gry karciane online | Gry karciane online — Poker i Tysiąc | Gracz.pl | Gry karciane na Gracz.pl: poker treningowy i Tysiąc, zasady, poradniki oraz rozwijane tryby rozgrywki online. | poker, tysiac, Akademia, poradniki Tysiąca | W1 |
| 3 | `/gry-planszowe/` | gry planszowe online | discovery | Gry planszowe online | Gry planszowe online — Warcaby i Gomoku | Gracz.pl | Poznaj rozwijane gry planszowe na Gracz.pl: warcaby i Gomoku, wraz z zasadami, strategiami i poradnikami. | warcaby, gomoku, rules/strategy guides | W1 |
| 4 | `/gry/poker/` | poker treningowy online | play / product | Poker treningowy online | Poker treningowy online — Texas Hold'em | Gracz.pl | Poznaj poker treningowy Texas Hold'em na Gracz.pl. Ćwicz decyzje, zasady i strategię bez obiecywania gry o realne pieniądze. | Akademia, zasady, układy, 6-max, heads-up | W1 |
| 5 | `/gry/tysiac/` | tysiąc online | play / product | Tysiąc online | Tysiąc online — gra karciana | Gracz.pl | Tysiąc na Gracz.pl: strona gry, zasady, licytacja, meldunki, punktacja i poradniki dla różnych wariantów rozgrywki. | rules, scoring, bidding, melds, player-count guides | W1 |
| 6 | `/gry/warcaby/` | warcaby online | play / product | Warcaby online | Warcaby online — gra i zasady | Gracz.pl | Warcaby na Gracz.pl: rozgrywka, zasady bicia, damka, ruchy i materiały pomagające lepiej grać. | rules, capture, king, strategy | W1 |
| 7 | `/gry/gomoku/` | gomoku online | play / product | Gomoku online | Gomoku online — gra i zasady | Gracz.pl | Gomoku na Gracz.pl: rozgrywka, zasady, debiuty, strategia ataku i obrony oraz najczęstsze błędy. | rules, how-to, strategy, openings | W1 |
| 8 | `/akademia-pokera/` | akademia pokera | learn / hub | Akademia Pokera Gracz.pl | Akademia Pokera — nauka Texas Hold'em | Gracz.pl | Ucz się Texas Hold'em krok po kroku: zasady, układy kart, pozycje, preflop, postflop, pot odds, blef i gra 6-max oraz heads-up. | all poker lessons, poker game landing | W1 |

### B. Poker Academy cluster

| # | URL | Primary phrase hypothesis | Intent | H1 | Title candidate | Meta description candidate | Primary internal links | Wave |
|---:|---|---|---|---|---|---|---|---|
| 9 | `/akademia-pokera/zasady/` | zasady pokera Texas Hold'em | informational | Zasady pokera Texas Hold'em | Zasady pokera Texas Hold'em — poradnik | Gracz.pl | Poznaj przebieg rozdania Texas Hold'em, rundy licytacji, blindy, showdown i podstawowe zasady gry. | poker landing, układy, preflop, słownik | W2 |
| 10 | `/akademia-pokera/uklady-kart/` | układy kart w pokerze | informational | Układy kart w pokerze | Układy kart w pokerze — kolejność i przykłady | Gracz.pl | Sprawdź kolejność układów pokerowych od wysokiej karty do pokera królewskiego wraz z prostymi przykładami. | zasady, słownik, poker landing | W2 |
| 11 | `/akademia-pokera/pozycje/` | pozycje przy stole pokerowym | informational | Pozycje przy stole pokerowym | Pozycje w pokerze — BTN, CO, blinds i wcześniejsze | Gracz.pl | Dowiedz się, czym są pozycje przy stole Texas Hold'em i dlaczego kolejność decyzji wpływa na strategię. | preflop, 6-max, heads-up | W2 |
| 12 | `/akademia-pokera/preflop/` | poker preflop | learn | Gra preflop w Texas Hold'em | Preflop w pokerze — podstawy decyzji | Gracz.pl | Naucz się podstaw decyzji przed flopem: pozycja, siła ręki, otwarcie, call i re-raise w treningowym ujęciu. | pozycje, flop, 6-max | W2 |
| 13 | `/akademia-pokera/flop/` | poker flop | learn | Jak grać na flopie | Flop w pokerze — jak analizować sytuację | Gracz.pl | Jak czytać flop, oceniać siłę ręki i planować dalsze decyzje w Texas Hold'em. | preflop, turn, pot odds | W3 |
| 14 | `/akademia-pokera/turn/` | poker turn | learn | Jak grać na turnie | Turn w pokerze — decyzje po czwartej karcie | Gracz.pl | Poznaj podstawy gry na turnie: zakresy, siła układu, szanse i plan na river. | flop, river, pot odds | W3 |
| 15 | `/akademia-pokera/river/` | poker river | learn | Jak grać na riverze | River w pokerze — końcowe decyzje | Gracz.pl | Jak podejmować końcowe decyzje na riverze, rozważać value bet, check i blef w Texas Hold'em. | turn, value bet, blef | W3 |
| 16 | `/akademia-pokera/pot-odds/` | pot odds | learn | Pot odds w pokerze | Pot odds w pokerze — proste wyjaśnienie | Gracz.pl | Zrozum pot odds i porównywanie kosztu sprawdzenia z szansą na poprawę układu na prostych przykładach. | flop, turn, słownik | W3 |
| 17 | `/akademia-pokera/blef/` | blef w pokerze | learn | Blef w pokerze | Blef w pokerze — kiedy ma sens | Gracz.pl | Poznaj podstawy blefowania: historia rozdania, zakres przeciwnika, sizing i sytuacje, w których blef bywa błędem. | river, value bet, pozycje | W3 |
| 18 | `/akademia-pokera/value-bet/` | value bet poker | learn | Value bet w pokerze | Value bet — jak grać dla wartości | Gracz.pl | Wyjaśnienie value betu w Texas Hold'em: kiedy słabsze ręce mogą sprawdzić i jak myśleć o wielkości zakładu. | river, blef, pot odds | W3 |
| 19 | `/akademia-pokera/heads-up/` | poker heads up | learn / format | Poker heads-up | Poker heads-up — podstawy gry 1 na 1 | Gracz.pl | Podstawy Texas Hold'em heads-up: pozycja, częstotliwość rąk, blindy i dostosowanie strategii do gry 1 na 1. | poker landing, pozycje, preflop | W3 |
| 20 | `/akademia-pokera/6-max/` | poker 6 max | learn / format | Poker 6-max | Poker 6-max — pozycje i podstawy strategii | Gracz.pl | Poznaj podstawy gry 6-max w Texas Hold'em: pozycje, zakresy startowe i różnice względem heads-up. | poker landing, pozycje, preflop | W3 |
| 21 | `/akademia-pokera/slownik/` | słownik pokerowy | reference | Słownik pojęć pokerowych | Słownik pokerowy — najważniejsze pojęcia | Gracz.pl | Wyjaśnienia najważniejszych pojęć Texas Hold'em: blind, flop, turn, river, fold, call, raise, pot odds i więcej. | all Academy lessons | W2 |

### C. Tysiąc cluster

| # | URL | Primary phrase hypothesis | Intent | H1 | Title candidate | Meta description candidate | Primary internal links | Wave |
|---:|---|---|---|---|---|---|---|---|
| 22 | `/poradniki/tysiac/zasady/` | zasady gry w tysiąca | informational | Zasady gry w Tysiąca | Zasady gry w Tysiąca — poradnik | Gracz.pl | Poznaj zasady Tysiąca: rozdanie kart, licytację, meldunki, lewy, punktację i zakończenie rozgrywki. | Tysiąc landing, scoring, bidding, melds | W2 |
| 23 | `/poradniki/tysiac/punktacja/` | punktacja w tysiącu | informational | Punktacja w Tysiącu | Punktacja w Tysiącu — jak liczyć punkty | Gracz.pl | Jak liczyć punkty w Tysiącu: wartości kart, meldunki, wynik rozdania i rozliczenie zadeklarowanej gry. | rules, melds, bidding | W2 |
| 24 | `/poradniki/tysiac/licytacja/` | licytacja w tysiącu | informational | Licytacja w Tysiącu | Licytacja w Tysiącu — zasady i przebieg | Gracz.pl | Wyjaśnienie licytacji w Tysiącu: deklaracje, wybór rozgrywającego i wpływ licytacji na dalszą grę. | rules, scoring, strategy | W2 |
| 25 | `/poradniki/tysiac/meldunki/` | meldunki w tysiącu | informational | Meldunki w Tysiącu | Meldunki w Tysiącu — wartości i zasady | Gracz.pl | Sprawdź, czym są meldunki w Tysiącu, kiedy można je zgłosić i jak wpływają na punktację rozdania. | rules, scoring | W2 |
| 26 | `/poradniki/tysiac/kontra/` | kontra w tysiącu | informational | Kontra w Tysiącu | Kontra w Tysiącu — zasady wariantu | Gracz.pl | Poznaj zasady kontry w wariantach Tysiąca. Strona powinna jasno wskazywać, którego zestawu zasad dotyczy opis. | rules, variants | W3 |
| 27 | `/poradniki/tysiac/2-osoby/` | tysiąc dla 2 osób | informational | Tysiąc dla 2 osób | Tysiąc dla 2 osób — zasady wariantu | Gracz.pl | Jak grać w Tysiąca w 2 osoby: przygotowanie, rozdanie, przebieg i różnice względem innych wariantów. | rules, landing | W3 |
| 28 | `/poradniki/tysiac/3-osoby/` | tysiąc dla 3 osób | informational | Tysiąc dla 3 osób | Tysiąc dla 3 osób — zasady gry | Gracz.pl | Zasady Tysiąca dla 3 osób: rozdanie, licytacja, meldunki, rozgrywka i punktacja. | rules, landing, scoring | W3 |
| 29 | `/poradniki/tysiac/4-osoby/` | tysiąc dla 4 osób | informational | Tysiąc dla 4 osób | Tysiąc dla 4 osób — zasady wariantu | Gracz.pl | Poznaj wariant Tysiąca dla 4 osób i różnice w organizacji rozgrywki. Publikować tylko po zatwierdzeniu konkretnego rulesetu. | rules, landing | W3 |
| 30 | `/poradniki/tysiac/strategia/` | strategia gry w tysiąca | learn | Strategia gry w Tysiąca | Strategia w Tysiącu — podstawowe wskazówki | Gracz.pl | Podstawy strategii Tysiąca: licytacja, liczenie punktów, meldunki, planowanie lew i ocena ryzyka. | bidding, scoring, melds, landing | W3 |

### D. Warcaby cluster

| # | URL | Primary phrase hypothesis | Intent | H1 | Title candidate | Meta description candidate | Primary internal links | Wave |
|---:|---|---|---|---|---|---|---|---|
| 31 | `/poradniki/warcaby/zasady/` | zasady warcabów | informational | Zasady gry w warcaby | Zasady warcabów — ruchy, bicie i damka | Gracz.pl | Poznaj podstawowe zasady warcabów: ustawienie pionków, ruchy, obowiązek bicia, wielokrotne bicie i damkę. | landing, capture, king | W2 |
| 32 | `/poradniki/warcaby/bicie/` | bicie w warcabach | informational | Bicie w warcabach | Bicie w warcabach — zasady | Gracz.pl | Wyjaśnienie zasad bicia w warcabach wraz z przykładami legalnych ruchów i sytuacji wymagających bicia. | rules, multi-capture | W2 |
| 33 | `/poradniki/warcaby/bicie-wielokrotne/` | wielokrotne bicie w warcabach | informational | Wielokrotne bicie w warcabach | Wielokrotne bicie w warcabach — jak działa | Gracz.pl | Zobacz, jak działa sekwencja wielokrotnego bicia w warcabach i kiedy ten sam pionek kontynuuje ruch. | capture, rules, landing | W3 |
| 34 | `/poradniki/warcaby/damka/` | damka w warcabach | informational | Damka w warcabach | Damka w warcabach — ruchy i bicie | Gracz.pl | Kiedy pionek staje się damką i jak zmieniają się jego możliwości ruchu oraz bicia w przyjętym wariancie zasad. | rules, strategy | W2 |
| 35 | `/poradniki/warcaby/ruchy/` | ruchy w warcabach | informational | Jak poruszają się pionki w warcabach | Ruchy w warcabach — pionek i damka | Gracz.pl | Prosty przewodnik po legalnych ruchach pionków i damki, z odwołaniem do używanego na Gracz.pl wariantu zasad. | rules, king | W3 |
| 36 | `/poradniki/warcaby/strategia/` | strategia warcabów | learn | Strategia gry w warcaby | Strategia warcabów — podstawowe zasady gry | Gracz.pl | Podstawowe wskazówki strategiczne w warcabach: centrum, tempo, wymiany, promocja i planowanie sekwencji bicia. | rules, openings, landing | W3 |
| 37 | `/poradniki/warcaby/otwarcia/` | otwarcia w warcabach | learn | Otwarcia w warcabach | Otwarcia w warcabach — jak zacząć partię | Gracz.pl | Poznaj podstawowe idee otwarcia w warcabach i typowe cele pierwszych ruchów bez obiecywania jednej zawsze najlepszej sekwencji. | strategy, landing | W4 |

### E. Gomoku cluster

| # | URL | Primary phrase hypothesis | Intent | H1 | Title candidate | Meta description candidate | Primary internal links | Wave |
|---:|---|---|---|---|---|---|---|---|
| 38 | `/poradniki/gomoku/zasady/` | zasady gomoku | informational | Zasady gry w Gomoku | Zasady Gomoku — jak grać | Gracz.pl | Poznaj zasady Gomoku: plansza, wykonywanie ruchów, cel gry oraz warunki zwycięstwa w przyjętym wariancie. | landing, how-to, strategy | W2 |
| 39 | `/poradniki/gomoku/jak-grac/` | jak grać w gomoku | learn | Jak grać w Gomoku | Jak grać w Gomoku — poradnik dla początkujących | Gracz.pl | Zacznij grać w Gomoku: cel, pierwsze ruchy, budowanie linii i podstawowe sposoby blokowania przeciwnika. | rules, strategy, errors | W2 |
| 40 | `/poradniki/gomoku/strategia/` | strategia gomoku | learn | Strategia gry w Gomoku | Strategia Gomoku — atak, obrona i plan | Gracz.pl | Podstawy strategii Gomoku: tworzenie zagrożeń, obrona, inicjatywa i planowanie kilku ruchów naprzód. | attack-defense, openings, landing | W3 |
| 41 | `/poradniki/gomoku/debiuty/` | debiuty gomoku | learn | Debiuty w Gomoku | Debiuty w Gomoku — pierwsze ruchy | Gracz.pl | Jak myśleć o pierwszych ruchach w Gomoku, centrum planszy i budowaniu elastycznych układów. | strategy, attack-defense | W3 |
| 42 | `/poradniki/gomoku/atak-obrona/` | atak i obrona w gomoku | learn | Atak i obrona w Gomoku | Gomoku — atak i obrona | Gracz.pl | Jak rozpoznawać zagrożenia w Gomoku, tworzyć własne linie i wybierać ruchy obronne. | strategy, errors | W3 |
| 43 | `/poradniki/gomoku/typowe-bledy/` | błędy w gomoku | learn | Typowe błędy w Gomoku | Gomoku — najczęstsze błędy początkujących | Gracz.pl | Najczęstsze błędy w Gomoku: ignorowanie zagrożeń, zbyt wąski plan, pasywna gra i brak kontroli kluczowych pól. | how-to, strategy | W4 |

### F. Cross-product, community and content hubs

| # | URL | Primary phrase hypothesis | Intent | H1 | Title candidate | Meta description candidate | Primary internal links | Wave |
|---:|---|---|---|---|---|---|---|---|
| 44 | `/gry-multiplayer/` | gry multiplayer online | discovery / social | Gry multiplayer na Gracz.pl | Gry multiplayer online | Gracz.pl | Poznaj gry multiplayer rozwijane na Gracz.pl i sposoby wspólnej rozgrywki. Publikować pełną wersję po potwierdzeniu działających trybów. | /gry/, game landings, community | W2/PRELAUNCH |
| 45 | `/turnieje/` | turnieje online | event/discovery | Turnieje na Gracz.pl | Turnieje gier online | Gracz.pl | Informacje o turniejach Gracz.pl, formatach i zapisach. Indeksować jako produktową stronę dopiero przy rzeczywistym programie turniejowym. | rankings, community, relevant games | W4/HOLD until real |
| 46 | `/rankingi/` | rankingi graczy | navigational/social | Rankingi graczy | Rankingi graczy i gier | Gracz.pl | Rankingi Gracz.pl prezentujące wyniki według zatwierdzonych zasad. Publikować pełną stronę dopiero, gdy ranking ma realne dane i reguły. | games, tournaments, community | W4/HOLD until real |
| 47 | `/spolecznosc/` | społeczność graczy | community | Społeczność Gracz.pl | Społeczność graczy | Gracz.pl | Społeczność Gracz.pl: funkcje wspólnej gry, profilu i interakcji opisane zgodnie z faktycznie dostępnym produktem. | multiplayer, rankings, tournaments, games | W4/HOLD until real |
| 48 | `/poradniki/` | poradniki do gier | informational hub | Poradniki do gier | Poradniki do gier — Poker, Tysiąc, Warcaby, Gomoku | Gracz.pl | Zbiór poradników Gracz.pl: zasady, strategie i materiały edukacyjne do Pokera, Tysiąca, Warcabów i Gomoku. | four guide clusters, game landings | W1 |

## 6. Why these 48 and not hundreds

The architecture intentionally starts with a finite editorial set. Each URL must satisfy a distinct intent and have enough unique value to justify indexing.

New pages should be created only when at least one of these is true:
- Search Console shows meaningful unmapped demand,
- a game/product introduces a distinct user task,
- a ruleset needs a genuinely separate explanation,
- a strategic editorial need is approved,
- a new feature creates a meaningful landing page.

Do not create pages solely because another keyword variant exists.

## 7. Status-aware game metadata

Game landing pages need two copy states.

### PRELAUNCH template
Title example:
`Tysiąc online — gra w przygotowaniu | Gracz.pl`

H1:
`Tysiąc online na Gracz.pl`

Visible statement near top:
`Pracujemy nad uruchomieniem tej gry. Poniżej znajdziesz zasady i informacje o planowanej rozgrywce.`

CTA:
`Poznaj zasady` or `Zobacz, co powstaje`

Never:
`Graj teraz` if no playable game exists.

### LIVE template
Title example:
`Tysiąc online — zagraj na Gracz.pl`

H1:
`Tysiąc online`

CTA:
`Zagraj`

The SEO registry records which state is active and tests that metadata matches product availability.

## 8. Poker safety/product framing

The planned Poker experience is educational/training-oriented. Public copy must accurately represent the actual product.

Do not imply:
- real-money wagering,
- cash prizes,
- gambling availability,
- financial winnings,

unless such a product is legally reviewed, explicitly authorized and truly exists. That is outside this SEO design.

Preferred language while training-only:
- poker treningowy,
- nauka Texas Hold'em,
- żetony treningowe if factually implemented,
- analiza decyzji,
- Akademia Pokera.

## 9. Ruleset accuracy gate

Card/board game rules have variants. Before publishing detailed rules, the owning game specification must identify the exact ruleset implemented by Gracz.pl.

Particularly important:
- Warcaby variant and capture rules,
- Tysiąc 2/3/4-player variants,
- Kontra and optional rules,
- Gomoku win/restriction variant.

A guide must not describe a different ruleset than the playable game.

## 10. Structured-data baseline by page type

### Hub
`WebPage + BreadcrumbList` where breadcrumbs are visible and implemented.

### Game landing
`WebPage` plus only a more specific game/software type after schema eligibility review. Do not force unsupported schema.

### Educational guide
`WebPage` and optionally `Article` if the page genuinely qualifies and visible author/date/editorial data exists.

### Glossary
`WebPage`; additional schema only after validation.

### Tournament
Specific event schema only if a real public event satisfies required facts. Never generate fake future events for SEO.

## 11. Canonical and sitemap policy

A candidate URL enters the sitemap only when:
- page exists in production,
- returns intended 200 response,
- is approved as indexable,
- self-canonical or follows approved canonical policy,
- content is substantive,
- no HOLD applies.

DESIGN_ONLY/HOLD URLs are absent from production sitemap.

## 12. Initial strategic keyword map

Primary ownership examples:

- `gry online` → `/gry/`
- `gry karciane online` → `/gry-karciane/`
- `gry planszowe online` → `/gry-planszowe/`
- `poker treningowy online` → `/gry/poker/`
- `akademia pokera / nauka pokera` → `/akademia-pokera/`
- `tysiąc online` → `/gry/tysiac/`
- `warcaby online` → `/gry/warcaby/`
- `gomoku online` → `/gry/gomoku/`
- `zasady + game` → corresponding guide
- `strategy + game` → corresponding strategy guide

Brand query `gracz` remains primarily owned by the homepage `/`. Do not create another page targeting exactly the same navigational brand intent.

## 13. Cannibalization prevention

Before creating any new URL, SEO Control Center must answer:
1. Does a target URL already own this intent?
2. Would the new page add a separate user task?
3. Is a section inside the existing page sufficient?
4. Are internal links clear about primary/supporting relationships?

Examples:
- `poker zasady` belongs to Academy rules page, not game landing.
- `poker treningowy online` belongs to game landing.
- `tysiąc online` belongs to game landing.
- `zasady tysiąca` belongs to the rules guide.

## 14. Wave definitions

### W1 — Core authority structure
Publish only high-quality hubs and core game/product pages:
1, 2, 3, 4, 5, 6, 7, 8, 48.

### W2 — Essential rules/reference
9, 10, 11, 12, 21, 22, 23, 24, 25, 31, 32, 34, 38, 39, 44 if factual.

### W3 — Deeper strategy/long-tail
13–20 except already W2; 26–30; 33, 35, 36; 40–42.

### W4 — Advanced / product-dependent
37, 43, 45, 46, 47 and other evidence-backed future pages.

The exact deployment order is controlled by `15-SEO-CONTENT-ROLLOUT-AND-INTERNAL-LINKING.md`.

## 15. Minimum quality bar per page

No page is `READY TO INDEX` until it has:
- distinct user intent,
- factual product state,
- unique title,
- unique description,
- one canonical URL,
- one meaningful H1,
- useful visible copy,
- appropriate H2 hierarchy,
- internal links in and out,
- correct breadcrumbs if used,
- valid structured data where present,
- no keyword stuffing,
- no thin/placeholder-only content,
- responsive rendering,
- indexability and sitemap review.

## 16. Measurement after publication

For each page store:
- publication date,
- initial content hash,
- initial target cluster,
- first crawl verification,
- first Search Console evidence date,
- 28-day and later comparison windows when enough data exists.

Do not judge a page after only a few low-volume days.

## 17. Expansion rule

Future URL additions require a short decision record:
`INTENT | EVIDENCE | EXISTING TARGETS | NEW VALUE | URL | LINKS | INDEX POLICY | APPROVER`

This keeps the architecture from growing into uncontrolled SEO-page sprawl.

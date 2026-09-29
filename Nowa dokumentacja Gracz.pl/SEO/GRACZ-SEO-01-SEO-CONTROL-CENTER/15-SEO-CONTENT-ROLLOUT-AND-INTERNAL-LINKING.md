# GRACZ-SEO-01 — SEO Content Rollout and Internal Linking Plan

Version: `R1 EXECUTION BACKLOG`  
Status: `DESIGN / NOT AUTHORIZATION TO PUBLISH`  
Depends on: `14-PUBLIC-SITE-ARCHITECTURE-AND-URL-MAP.md`

## 1. Goal

Define the exact order in which the 48 candidate pages should be researched, written, reviewed, linked, published and measured so Gracz.pl builds topical structure without thin content or cannibalization.

## 2. Fundamental rule

Do not publish the full 48-page map at once.

Each page moves through:

`CANDIDATE → EVIDENCE_READY → BRIEF_APPROVED → CONTENT_READY → TECHNICAL_READY → PUBLISH_APPROVED → LIVE → VERIFIED → MONITORED`

Possible stop states:
`HOLD`, `REJECTED`, `MERGE_INTO_EXISTING_PAGE`.

## 3. Pre-content gate

Before writing a page, record:

- page ID / candidate URL,
- page type,
- primary intent,
- primary keyword hypothesis,
- supporting concepts,
- existing Gracz.pl pages with overlapping intent,
- product state `DESIGN/PRELAUNCH/LIVE`,
- exact ruleset/product facts source,
- target internal links,
- required screenshots/media if any,
- schema eligibility,
- owner/editor,
- evidence date.

If the page lacks distinct intent or factual source, set `HOLD`.

## 4. Wave 1 — Core topical architecture

Target pages:

- `/gry/`
- `/gry-karciane/`
- `/gry-planszowe/`
- `/gry/poker/`
- `/gry/tysiac/`
- `/gry/warcaby/`
- `/gry/gomoku/`
- `/akademia-pokera/`
- `/poradniki/`

### Purpose
Create a small, coherent public site graph before long-tail expansion.

### Required linking

Homepage should naturally link to:
- `/gry/`
- flagship game pages that are factually ready,
- `/poradniki/` or `/akademia-pokera/` when substantive.

`/gry/` links to all 4 game landings and category hubs.

`/gry-karciane/` links to Poker and Tysiąc plus their educational hubs.

`/gry-planszowe/` links to Warcaby and Gomoku plus rules pages when live.

`/poradniki/` links to each educational cluster.

### Wave 1 gate
Do not proceed to broad W2 until:
- all published W1 pages have unique intent,
- no accidental duplicate canonical,
- each page has at least one meaningful inbound link,
- game availability copy is truthful,
- sitemap/index policy matches reality,
- crawl smoke passes.

## 5. Wave 2 — Essential rules and reference

Priority pages:

Poker:
- rules,
- hand rankings,
- positions,
- preflop,
- glossary.

Tysiąc:
- rules,
- scoring,
- bidding,
- melds.

Warcaby:
- rules,
- capture,
- king/damka.

Gomoku:
- rules,
- beginner how-to.

Optional:
- multiplayer page only if product state can be described accurately.

### Purpose
Answer the highest-confidence informational tasks around the games.

### Link pattern
Each rules page:
- links up to its game landing,
- links laterally to 2–4 closely related guides,
- receives link from game landing,
- receives link from `/poradniki/`,
- may receive one contextual link from relevant hub.

Do not sitewide-link every guide.

## 6. Wave 3 — Deeper educational coverage

Publish only after W1/W2 evidence shows:
- crawl/indexing healthy,
- no major cannibalization,
- content quality process works,
- Search Console or strategic evidence supports expansion.

Includes:
- advanced Poker streets/concepts,
- Tysiąc variants and strategy,
- Warcaby multi-capture/movement/strategy,
- Gomoku strategy/openings/attack-defense.

### Quality rule
A W3 page must contain meaningful teaching value beyond restating W2.

## 7. Wave 4 — Advanced and product-dependent

Includes:
- Warcaby openings,
- Gomoku common mistakes,
- tournaments,
- rankings,
- community.

### Product gate
`/turnieje/`, `/rankingi/` and `/spolecznosc/` remain HOLD until the underlying feature is real enough to produce substantive, truthful content.

Do not index empty shells just to reserve URLs.

## 8. Cluster linking architecture

### 8.1 Poker cluster

Primary product:
`/gry/poker/`

Educational hub:
`/akademia-pokera/`

Mandatory conceptual flow:
`Game → Academy → Rules/Hands/Positions/Preflop → deeper strategy`

Each advanced lesson links back to:
- Academy hub,
- at least one prerequisite lesson,
- at most a small set of genuinely relevant next lessons.

Examples:

`/akademia-pokera/preflop/`
→ positions
→ flop
→ 6-max
→ game landing

`/akademia-pokera/river/`
→ turn
→ value-bet
→ bluff
→ pot-odds when relevant.

### 8.2 Tysiąc cluster

Primary:
`/gry/tysiac/`

Core educational center:
`/poradniki/tysiac/zasady/`

Flow:
`Game → Rules → Bidding / Melds / Scoring → player variants / strategy`

Player-count variant pages must link to the shared rules page and clearly state what differs.

### 8.3 Warcaby cluster

Primary:
`/gry/warcaby/`

Core:
`/poradniki/warcaby/zasady/`

Flow:
`Game → Rules → Capture → Multi-capture / King → Strategy → Openings`

### 8.4 Gomoku cluster

Primary:
`/gry/gomoku/`

Core:
`/poradniki/gomoku/zasady/`

Flow:
`Game → Rules → Beginner How-to → Strategy → Openings / Attack-Defense / Errors`

## 9. Breadcrumb model

Examples:

`Gracz.pl > Gry > Poker`

`Gracz.pl > Akademia Pokera > Preflop`

`Gracz.pl > Poradniki > Tysiąc > Licytacja`

`Gracz.pl > Poradniki > Warcaby > Damka`

`Gracz.pl > Poradniki > Gomoku > Strategia`

Breadcrumbs should:
- reflect real navigation hierarchy,
- be visible to users if structured-data BreadcrumbList is emitted,
- use canonical URLs,
- avoid invented hierarchy that UI does not support.

## 10. Anchor text policy

Allowed:
- natural descriptive anchors,
- brand anchors,
- partial-match phrases,
- action/context phrases.

Examples:
- `zasady Tysiąca`
- `zobacz punktację`
- `Akademia Pokera`
- `wróć do strony gry`
- `strategia Gomoku`

Avoid repeating the exact same keyword-rich anchor across every page.

The link engine should track anchor distribution but must not try to mimic an artificial "optimal percentage."

## 11. Page content template — game landing

Recommended sections:

1. H1 and product state.
2. Concise explanation of the game.
3. Availability / play CTA appropriate to PRELAUNCH or LIVE.
4. How the game works.
5. Key features actually implemented/planned and clearly labeled.
6. Rules overview.
7. Links to full rules/guides.
8. Multiplayer/modes if factual.
9. FAQ only if questions are genuinely useful.
10. Related games.
11. Technical/footer navigation.

Avoid stuffing an encyclopedia into the game landing; informational depth belongs in guides.

## 12. Page content template — educational guide

1. H1 answering the exact intent.
2. Short direct answer/definition.
3. Rules/concept explanation.
4. Worked examples where appropriate.
5. Common mistakes.
6. Relationship to the playable game.
7. Related guides.
8. Sources/ruleset note if variants matter.

Do not pad with generic filler.

## 13. Page content template — hub

1. H1 naming category/topic.
2. Explain what the hub contains.
3. Curated cards/links to primary pages.
4. Short category guidance.
5. Optional "where to start" path.
6. No duplicated full article content.

## 14. Content uniqueness test

Before approval, compare candidate against:
- game landing,
- sibling guides,
- category hub,
- homepage.

Reject or merge if:
- > page mainly repeats existing prose,
- same user task already answered well,
- only difference is a keyword variant,
- unique section value is too small.

No fixed similarity percentage is a Google rule; use semantic/editorial review plus tooling as support.

## 15. Title ownership

Each primary title concept should belong to one URL.

Examples:
- `Poker treningowy online` → game landing.
- `Zasady pokera Texas Hold'em` → rules guide.
- `Układy kart w pokerze` → hand rankings.
- `Tysiąc online` → game landing.
- `Zasady gry w Tysiąca` → rules guide.

If two pages need nearly the same title, revisit intent split.

## 16. H1 ownership

H1 should express the page task, not mechanically copy title.

One primary semantic H1 per planned content page unless a future framework/template has a justified exception reviewed by SEO-01.

## 17. Metadata workflow

For each page:

`Content facts → intent → H1 → title → description → canonical → social metadata → schema → validation`

Do not write the title first and force content around it.

## 18. Image/media workflow

Per page determine:
- does the page need a hero?
- instructional diagrams/screenshots?
- social image?
- alt text?
- intrinsic dimensions?
- modern format/fallback?

Rules pages should use diagrams only when they clarify the rule.

Avoid decorative image weight that harms performance.

## 19. Structured-data decision

Every page starts with:
`WebPage = eligible baseline`

Then review:
- BreadcrumbList if visible breadcrumb exists.
- Article if page has genuine editorial article semantics.
- ImageObject if primary image is meaningful.
- game/software-specific schema only after explicit schema review.

Never add FAQ/HowTo or other schema only because SEO folklore suggests it.

## 20. Prelaunch content rule

For a game not yet playable:
- page may explain the project,
- page may link to rules,
- status must be obvious,
- CTA must not pretend play availability,
- screenshots must not misrepresent production,
- structured data must not imply a live downloadable/playable product if false.

When game becomes LIVE:
- update product state,
- update CTA/title/description if needed,
- record content/version change,
- post-deploy verify,
- monitor Search Console.

## 21. Editorial production workflow

### Step A — Evidence
SEO system/editor selects candidate from URL map.

### Step B — Brief
Create approved brief with intent and factual sources.

### Step C — Draft
Human or AI-assisted draft. AI status retained.

### Step D — Editorial review
Check factual accuracy, clarity, uniqueness, language, product state.

### Step E — SEO review
Check target map, cannibalization, metadata, internal links, schema eligibility.

### Step F — Technical preview
Render page at representative viewports.

### Step G — Publish approval
Owner/editor policy depending on page class.

### Step H — Post-publish crawl
Verify HTTP/canonical/robots/H1/schema/links.

### Step I — Sitemap
Add only after eligibility confirmed.

### Step J — Monitor
Search Console and crawl history.

## 22. Implementation batching

Recommended engineering batches:

### Batch A — templates and registry
No mass content yet.
- hub template,
- game landing template,
- guide template,
- breadcrumb component,
- SEO metadata interface,
- registry integration.

### Batch B — 2 canary pages
Suggested:
- one game landing,
- one guide.

Choose based on product readiness, not keyword ambition.

### Batch C — W1 rollout
Only after canary PASS.

### Batch D — W2
Essential guides.

### Batch E — W3/W4
Evidence-driven expansion.

## 23. Canary acceptance

Canary must prove:
- route stable,
- canonical correct,
- responsive content,
- metadata deterministic,
- schema valid,
- sitemap eligibility correct,
- internal links crawlable,
- page speed acceptable,
- no SEO hidden content,
- no runtime regression.

## 24. Internal-link minimums

Operational targets, not search-engine guarantees:

For each strategic new page:
- at least one crawlable inbound link from an already indexed/important page before sitemap reliance alone,
- at least one upward link to hub/product,
- 1–4 contextual sibling links when useful,
- no forced links where context does not justify them.

The system may flag absence, but human review decides usefulness.

## 25. Orphan prevention

At publish transaction time or post-publish gate:
- calculate inbound graph,
- if intended indexable and zero meaningful inbound edges, open `ORPHAN_PAGE`,
- page may remain published but should not be considered SEO rollout complete until linked or intentionally exempted.

## 26. Redirect policy

If a candidate slug changes after publication:
- permanent redirect old → new canonical where appropriate,
- update all internal links,
- update sitemap,
- verify no chains,
- retain redirect mapping history.

Never delete a previously indexed strategic URL without a successor decision.

## 27. Search Console feedback loop

After enough data exists:

For each cluster:
- impressions,
- clicks,
- CTR,
- average position,
- actual landing pages.

Actions:
- validate target mapping,
- detect unexpected URL competition,
- find content gaps,
- prioritize internal links,
- revise titles/snippets only with hypothesis/evidence.

Do not overreact to a few days of low-volume noise.

## 28. Decision rules for new pages

Create a new page when:
- distinct intent exists AND
- enough unique content exists AND
- it improves user navigation/understanding AND
- it does not duplicate an existing target.

Prefer expanding an existing page when:
- query variation has same intent,
- content would be short/repetitive,
- no distinct navigation need exists.

## 29. Do-not-build list

Do not create:
- city pages without real local service,
- thousands of keyword permutations,
- pages for every card combination,
- fake tournament pages,
- fake player profiles,
- empty rankings,
- AI-spun variants,
- doorway pages redirecting immediately to the same game,
- hidden link directories,
- search-result-like thin pages just for indexing.

## 30. Measurement milestones

For each wave:

### T0
Pre-publication baseline.

### T+1 day
Technical crawl only; do not judge rankings.

### T+7 days
Indexability/freshness check; performance data may still be immature.

### T+28 days
First useful comparative window if impressions exist.

### T+90 days
Strategic review: keep/improve/merge/retarget.

These are operational review points, not promises of indexing speed.

## 31. Wave closure report

Each wave closes with:

`WAVE ID`  
`PUBLISHED URLS`  
`HELD URLS`  
`CANONICAL/ROBOTS/SITEMAP PASS`  
`INTERNAL LINK GRAPH PASS`  
`CONTENT QUALITY PASS`  
`SCHEMA PASS`  
`SEARCH CONSOLE CONNECTED YES/NO`  
`OPEN BLOCKER/HIGH/MEDIUM`  
`INDEPENDENT REVIEW VERDICT`  
`NEXT WAVE AUTHORIZED YES/NO`

## 32. Current state

At creation:

`48 CANDIDATE URLS = DESIGNED`  
`PUBLISHED BY THIS DOCUMENT = 0`  
`W1 IMPLEMENTATION = NOT STARTED`  
`KEYWORD VOLUME VALIDATION = NOT PERFORMED`  
`SEARCH CONSOLE EVIDENCE = NOT ATTACHED TO THIS MAP`  
`NEXT ACTION = SEO-00 DISCOVERY, THEN VALIDATE W1 AGAINST CURRENT PRODUCT/ROUTES`

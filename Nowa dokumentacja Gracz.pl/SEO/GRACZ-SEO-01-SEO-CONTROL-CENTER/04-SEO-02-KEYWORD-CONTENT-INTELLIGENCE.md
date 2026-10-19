# GRACZ-SEO-01 — SEO-02 Keyword & Content Intelligence

Status: `TARGET DESIGN / NOT IMPLEMENTED`

## 1. Objective

Create one controlled map from search intent to Gracz.pl content so the portal knows what each strategic page is supposed to rank for, where content is missing, and where multiple pages unintentionally compete.

The module must improve editorial decisions without mass-producing low-value pages.

## 2. Core concepts

### Keyword
A literal query or strategic phrase.

Examples:
- gracz
- gry online
- gry karciane
- poker treningowy
- tysiąc online
- zasady tysiąca
- warcaby online
- gomoku online

Examples are strategic seeds, not hard-coded production targets.

### Keyword cluster
A group of semantically related queries sharing substantially the same search intent.

### Search intent
At minimum:
- navigational,
- informational,
- play/game,
- rules/how-to,
- discovery/comparison,
- community.

### Target URL
The page intentionally assigned as the primary answer for a cluster.

### Supporting URL
A page that covers a narrower sub-intent and links naturally toward the primary page.

## 3. Keyword lifecycle

`DISCOVERED → REVIEWED → CLUSTERED → TARGET_ASSIGNED → MONITORED`

Exceptional:
- `REJECTED`
- `DUPLICATE`
- `OUT_OF_SCOPE`
- `NEEDS_RESEARCH`

Every status change is auditable.

## 4. Sources

Supported sources may include:
- Owner/editor strategic seeds,
- Search Console query data,
- internal site search where available and privacy-approved,
- manual competitor/topic research,
- external keyword provider later,
- AI-assisted expansion.

Source must be recorded. Machine-generated ideas are never treated as observed demand unless supported by provider evidence.

## 5. Normalization

Preserve:
- raw phrase,
- normalized phrase,
- language,
- accents/diacritics,
- source.

Normalization may lowercase and normalize whitespace for grouping, but raw evidence must remain intact.

Do not silently merge phrases solely because tokens are similar.

## 6. Clustering

Clustering can use:
- lexical similarity,
- semantic embeddings,
- Search Console co-occurrence,
- same target-page behavior,
- human judgment.

Every cluster has:
- primary topic,
- intent,
- representative query,
- confidence,
- reviewer status.

Low-confidence clusters require manual review.

## 7. Target mapping

Rules:
1. One cluster has one primary target page.
2. One page may target several closely related clusters if intent is coherent.
3. Two pages may intentionally share a topic only if their intents differ clearly.
4. Changing target mapping creates history.
5. Unassigned high-value clusters become content-gap candidates.

## 8. Cannibalization detection

Signals:
- same cluster receives significant impressions on multiple URLs,
- near-duplicate titles/H1s,
- pages swap positions over time,
- target map conflicts,
- internal links send mixed signals.

Output must distinguish:
- `LIKELY_CANNIBALIZATION`
- `INTENTIONAL_MULTI_PAGE`
- `INSUFFICIENT_EVIDENCE`

Do not automatically merge/delete pages.

## 9. Content gap engine

A gap is not simply "keyword exists, page missing."

Candidate score may combine:
- strategic priority,
- impressions without a strong target,
- position range,
- current target quality,
- business relevance,
- topical coverage,
- internal-link support,
- freshness.

Output:
- proposed page or section,
- intended user intent,
- supporting evidence,
- recommended parent/category,
- related pages,
- risk of duplication.

## 10. Content brief contract

Every generated brief should include:

### Identity
- brief ID,
- cluster ID,
- proposed URL/path,
- page type,
- locale,
- owner/editor.

### User need
- primary intent,
- expected user task,
- main question answered.

### Topic coverage
- required concepts,
- optional concepts,
- common questions,
- factual constraints.

### SEO
- working title ideas,
- meta-description ideas,
- H1 concept,
- suggested H2 sections,
- canonical policy,
- internal-link targets,
- schema eligibility.

### Evidence
- source queries,
- Search Console evidence where available,
- date range,
- current target pages,
- competing internal pages.

### Quality guardrails
- minimum unique value,
- no unsupported claims,
- no hidden keyword blocks,
- no copied competitor text,
- no fake reviews/testimonials,
- no invented availability.

## 11. AI assistance policy

AI may:
- cluster,
- summarize query themes,
- propose briefs,
- propose title/description options,
- draft outlines,
- identify missing concepts,
- suggest internal links.

AI may NOT by default:
- publish,
- create hundreds of pages,
- overwrite approved copy,
- fabricate rankings/traffic,
- claim a game exists when it does not,
- generate fake user-generated content,
- produce spun near-duplicates.

Every AI artifact stores:
- generation timestamp,
- model/provider label if available,
- input evidence IDs,
- status `DRAFT_AI`,
- reviewer outcome.

## 12. Editorial quality gates

Before publication:
- target intent unique enough,
- page adds user value,
- factual claims verified,
- page type correct,
- title/H1 coherent,
- primary copy visible and crawlable,
- internal links intentional,
- canonical/index policy reviewed,
- schema appropriate,
- no thin/doorway-page pattern.

## 13. Strategic site architecture examples

Potential cluster families:
- brand: Gracz.pl / gracz
- broad games: gry online / gry karciane
- Poker: game, training, rules, strategy
- Tysiąc: game, rules, scoring, player-count variants
- Warcaby: game, rules, strategy
- Gomoku: game, rules, strategy
- tournaments/community when product is actually available

This is a planning map, not authorization to create every page.

## 14. Content freshness

Each content page may define:
- evergreen,
- periodic review,
- event/time-sensitive.

The system flags stale review dates but does not automatically rewrite content.

## 15. Performance loop

For each published target:
1. record activation date and content hash,
2. wait for sufficient provider data,
3. compare before/after windows carefully,
4. account for seasonality and low sample size,
5. record outcome as observation, not causal proof unless experiment design supports it.

## 16. Acceptance

SEO-02 is complete when:
- keyword registry works,
- cluster/intent review workflow exists,
- one-cluster/one-primary-target invariant is enforced,
- cannibalization report is evidence-based,
- content briefs are approval-gated,
- AI cannot auto-publish,
- Search Console metrics can attach to clusters when SEO-04 becomes available,
- independent review passes.

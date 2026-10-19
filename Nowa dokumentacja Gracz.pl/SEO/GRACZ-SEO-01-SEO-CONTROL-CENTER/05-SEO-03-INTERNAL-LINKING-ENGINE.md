# GRACZ-SEO-01 — SEO-03 Internal Linking Engine

Status: `TARGET DESIGN / NOT IMPLEMENTED`

## 1. Objective

Maintain a coherent crawl and topical graph across Gracz.pl so important pages are discoverable, contextually linked and not isolated.

The engine is recommendation-first. It must not become an exact-match anchor spam generator.

## 2. Inputs

- page registry,
- latest crawl snapshots,
- parsed internal links,
- page type,
- keyword clusters,
- content similarity,
- strategic priority,
- navigation/breadcrumb structure,
- manual exclusions.

## 3. Graph model

Directed edge:
`source_page → target_page`

Attributes:
- anchor text,
- DOM/context location,
- follow policy,
- first/last seen,
- sitewide vs contextual,
- navigation vs editorial,
- source fingerprint.

Differentiate:
- global navigation,
- breadcrumb,
- footer,
- contextual body link,
- card/recommendation module,
- generated system link.

## 4. Core diagnostics

### Orphan page
An intended indexable page with no meaningful crawlable inbound path from the controlled site graph.

### Weakly linked page
A strategic page with only low-context or deep links.

### Broken internal link
Internal href resolves to error, loop or invalid route.

### Redirected internal link
Source points through a redirect when a direct canonical target is available.

### Conflicting target
Anchor/context strongly indicates one intent but points to another page.

### Excessive exact-match concentration
One anchor phrase is repeated unnaturally across many contexts.

## 5. Recommendation algorithm

Candidate recommendation consists of:
- source page,
- target page,
- reason,
- evidence,
- suggested anchor concepts,
- confidence,
- score components.

Potential score factors:
- topical similarity,
- user journey usefulness,
- target strategic priority,
- current inbound-link deficit,
- page depth,
- cluster relationship,
- freshness.

Weights must be configuration and explainable.

## 6. Hard constraints

Never recommend:
- self-link with no purpose,
- link to non-indexable/error page,
- hidden link,
- link inserted solely as keyword repetition,
- irrelevant cross-topic link,
- excessive repeated exact-match anchor,
- links into private/admin/user-sensitive routes.

## 7. Game/content linking patterns

Examples of intentional relationships:

`Game landing → rules → strategy/guide → game`

`Homepage/category → game landing`

`Game landing → tournament/community` only when those features are public and relevant.

`Rules article → related game landing`

The system must prefer useful user pathways over raw link-count growth.

## 8. Breadcrumb support

Breadcrumbs should reflect real information architecture. If BreadcrumbList schema is emitted, visible breadcrumb structure and schema must be consistent.

## 9. Recommendation statuses

`PROPOSED → REVIEWED → APPROVED → APPLIED → VERIFIED`

Alternatives:
- `REJECTED` with reason,
- `STALE` when source/target changes,
- `SUPERSEDED`.

## 10. Automatic insertion policy

R1 default:
`DISABLED`

A future auto-link mode would require:
- explicit Owner authorization,
- bounded page types,
- anchor diversity controls,
- maximum links per page,
- preview/diff,
- rollback,
- A/B or holdout analysis where meaningful,
- independent security/SEO review.

## 11. Link equity language

The product UI should avoid pretending it can calculate Google's internal PageRank. It may calculate a site-graph importance metric for operational prioritization, clearly labeled as an internal metric.

## 12. Depth and crawl-path report

For each indexable page, compute:
- shortest click depth from approved entry points,
- count of unique inbound contextual sources,
- count of navigation sources,
- broken-edge count,
- last verified timestamp.

## 13. Verification

After applying approved links:
1. crawl source,
2. verify href exists,
3. resolve target,
4. verify canonical target,
5. update graph,
6. close recommendation only on observed evidence.

## 14. Acceptance

SEO-03 is complete when:
- internal graph is extracted deterministically,
- orphan/broken/redirected link detection is tested,
- recommendation scores are explainable,
- spam guardrails exist,
- default mode cannot mutate content,
- applied recommendations require verification,
- independent review passes.

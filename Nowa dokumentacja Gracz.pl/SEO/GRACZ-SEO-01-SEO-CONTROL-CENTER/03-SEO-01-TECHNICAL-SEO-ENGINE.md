# GRACZ-SEO-01 — SEO-01 Technical SEO Engine

Status: `TARGET DESIGN / NOT IMPLEMENTED`

## 1. Objective

Provide deterministic technical SEO generation and continuous defect detection for every registered public Gracz.pl URL.

## 2. Core submodules

### 2.1 Indexability Evaluator
Inputs:
- expected index policy,
- HTTP response,
- redirect chain,
- robots meta,
- Googlebot meta,
- X-Robots-Tag if observable,
- robots.txt result,
- canonical,
- access restrictions.

Output:
- decision,
- evidence,
- issue codes,
- confidence/freshness.

Never equate `index,follow` with guaranteed Google indexing.

### 2.2 Canonical Resolver
Rules:
- one canonical per indexable page,
- HTTPS production host,
- stable trailing-slash policy,
- strip tracking parameters unless product semantics require otherwise,
- canonical must not point to 4xx/5xx,
- self-canonical by default for unique content,
- cross-canonical only by explicit policy.

Issue examples:
- `CANONICAL_MISSING`
- `CANONICAL_MULTIPLE`
- `CANONICAL_NON_HTTPS`
- `CANONICAL_WRONG_HOST`
- `CANONICAL_TO_ERROR`
- `CANONICAL_CONFLICT_REDIRECT`

### 2.3 Metadata Renderer
Inputs:
- page type,
- approved page data,
- optional approved SEO override,
- brand rules.

Output:
- title,
- description,
- canonical,
- robots,
- Googlebot,
- hreflang,
- OG/Twitter.

Rules:
- deterministic,
- escaped safely,
- no empty placeholders,
- no title/description duplication at scale without flag,
- no unsupported factual claims.

### 2.4 Heading/Semantic Validator
Checks:
- exactly one intended primary H1 where page design calls for it,
- logical hierarchy,
- heading text available in crawlable semantic HTML,
- no SEO-only hidden text,
- equivalent primary content across responsive layouts.

### 2.5 Structured Data Builder
Typed graph generation.

Core graph for general pages:
`WebSite → Organization`
`WebPage → WebSite/Organization/ImageObject`

Optional builders only if content qualifies:
- BreadcrumbList,
- Article,
- other schema types after documented eligibility review.

Validation layers:
1. JSON syntax,
2. schema shape,
3. internal @id reference resolution,
4. URL/canonical consistency,
5. visible-content consistency,
6. image existence/dimensions where declared.

### 2.6 Robots Builder
Policy inputs:
- production/test environment,
- global allow/disallow rules,
- sitemap locations.

Safety:
- test/staging may have restrictive rules;
- production output requires an environment assertion;
- a global production `Disallow: /` or noindex-all change is BLOCKER-class and requires explicit approval.

### 2.7 Sitemap Builder
Generate from registry, not from uncontrolled filesystem discovery.

Eligibility:
- production URL,
- intended indexable,
- successful/valid destination,
- canonical to itself or explicitly allowed canonical policy,
- not redirected,
- not duplicate.

Scale:
- support sitemap index and partitioning from the start.

### 2.8 Image SEO Validator
Checks:
- source exists,
- intrinsic dimensions,
- declared dimensions,
- modern format preference where appropriate,
- fallback,
- alt policy,
- social image size/type,
- oversized assets,
- broken image URLs.

### 2.9 Crawl/HTTP Validator
Checks:
- 2xx/3xx/4xx/5xx distribution,
- redirect hops/loops,
- soft-error heuristics as advisory,
- content type,
- duplicate canonical,
- broken internal links,
- orphan signals,
- mixed host/protocol.

## 3. Technical issue catalog

Initial codes:

### Indexing
- `IDX_NO_INDEX_UNEXPECTED`
- `IDX_ROBOTS_BLOCKED_UNEXPECTED`
- `IDX_X_ROBOTS_BLOCKED`
- `IDX_AUTH_REQUIRED`
- `IDX_ERROR_STATUS`

### Canonical
- `CANONICAL_MISSING`
- `CANONICAL_MULTIPLE`
- `CANONICAL_WRONG_HOST`
- `CANONICAL_TARGET_NON_200`
- `CANONICAL_LOOP`

### Metadata
- `TITLE_MISSING`
- `TITLE_DUPLICATE`
- `DESCRIPTION_MISSING`
- `DESCRIPTION_DUPLICATE`
- `OG_IMAGE_MISSING`
- `SOCIAL_META_INCOMPLETE`

### Semantics
- `H1_MISSING`
- `H1_MULTIPLE`
- `HEADING_HIERARCHY`
- `PRIMARY_CONTENT_HIDDEN`
- `RESPONSIVE_CONTENT_DIVERGENCE`

### Structured data
- `SCHEMA_INVALID_JSON`
- `SCHEMA_REFERENCE_BROKEN`
- `SCHEMA_CANONICAL_MISMATCH`
- `SCHEMA_CONTENT_MISMATCH`

### Sitemap/robots
- `SITEMAP_INVALID_XML`
- `SITEMAP_NON_CANONICAL_URL`
- `SITEMAP_BLOCKED_URL`
- `SITEMAP_ERROR_URL`
- `ROBOTS_GLOBAL_BLOCK`

### Links/images
- `BROKEN_INTERNAL_LINK`
- `ORPHAN_PAGE`
- `IMAGE_MISSING_DIMENSIONS`
- `IMAGE_BROKEN`
- `IMAGE_OVERSIZED`

## 4. Safe automation matrix

### May be automatic after implementation review
- read-only crawl,
- metadata validation,
- sitemap candidate calculation,
- structured-data validation,
- issue opening/reopening,
- performance snapshot comparison,
- duplicate detection.

### May be generated but requires approval before public effect
- title/description changes,
- canonical changes,
- robots changes,
- sitemap publication,
- schema type additions,
- redirects.

### Must not be automatic in R1
- global noindex/index policy switch,
- production robots global block/unblock,
- bulk canonical reassignment,
- mass page creation,
- mass AI publishing,
- deletion of strategic pages.

## 5. Page-type metadata contracts

### Homepage
Must communicate brand/entity and primary portal purpose; canonical root; WebSite/Organization/WebPage graph.

### Game landing page
Unique game intent, factual availability status, playable/coming-soon distinction, links to rules/guides/community where applicable.

### Rules/guide
Informational intent; avoid pretending the page is the game itself. Article/Breadcrumb schema only when eligible.

### Tournament
Indexability depends on lifecycle. Expired event pages need an explicit archive/retention strategy.

### Community/profile-like pages
Default index policy must be explicitly designed with privacy, thin-content and scale considerations before enabling broad indexing.

## 6. Scanner cadence

Cadence is configurable:
- high-priority URLs: frequent,
- sitemap inventory: daily or change-triggered,
- full crawl: scheduled based on site size/cost,
- post-deploy smoke: immediate controlled run.

Avoid unnecessary request load.

## 7. Technical health score

A dashboard score may exist only as a transparent operational summary.

Example factors:
- blocker count,
- high/medium issue counts,
- indexability coverage,
- sitemap integrity,
- metadata coverage,
- structured-data validity,
- broken links,
- evidence freshness.

The UI must label it `SEO health score`, never `Google ranking score`.

## 8. Acceptance

SEO-01 is complete only when:
- page registry and normalization are implemented,
- scanner is allowlisted and SSRF-safe,
- deterministic metadata/schema tests pass,
- robots/sitemap generation has golden tests,
- issue engine is idempotent,
- one independent review passes,
- no production policy changes occur without explicit rollout authorization.

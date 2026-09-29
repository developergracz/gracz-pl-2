# GRACZ-SEO-01 — SEO-04 Search Console Intelligence

Status: `TARGET DESIGN / PROVIDER CONNECTION NOT IMPLEMENTED`

## 1. Objective

Import first-party search-performance evidence from Google Search Console into the SEO Control Center without making public page delivery dependent on Google APIs.

## 2. Provider adapter boundary

Define a provider-neutral interface:

- list/configure property identity,
- fetch search analytics,
- fetch sitemap state where available,
- submit sitemap only via explicit action,
- inspect URL where supported,
- return provider capability/limit errors,
- expose freshness.

Google-specific request/response mapping stays inside `seo-provider-search-console`.

Do not hard-code numeric API quotas into domain logic. Quotas and capabilities change; adapters must surface current limits/errors.

## 3. Authentication

Requirements:
- minimal necessary OAuth/service permissions,
- secrets in approved secret store,
- database stores only secret references/connection metadata,
- no access token in logs,
- revocation supported,
- connection health visible to Admin.

## 4. Property configuration

Each connection records:
- provider,
- verified property identifier,
- environment association,
- canonical production host relationship,
- capability set,
- owner,
- last successful sync.

Never mix production Search Console data into a staging environment identity.

## 5. Search analytics import

Import dimensions only as needed:
- date,
- query,
- page,
- country optionally,
- device optionally,
- search appearance optionally.

Metrics:
- clicks,
- impressions,
- CTR,
- average position.

Always record:
- requested date range,
- provider response timestamp,
- ingestion timestamp,
- dimensions used,
- filters,
- provider/source identity.

## 6. Data-delay handling

The UI must show the latest available provider date and never label incomplete days as complete.

Trend calculations should default to complete comparable windows.

## 7. Pagination and completeness

Importer must:
- paginate until provider indicates completion,
- checkpoint progress,
- deduplicate idempotently,
- retry bounded transient failures,
- mark partial imports explicitly,
- never silently treat truncated data as complete.

## 8. Query privacy and storage

Search Console query data is operational SEO data. Access should be role-controlled.

Do not join query data to individual Gracz.pl users.

## 9. URL Inspection

Where provider API supports it, store normalized inspection snapshots.

Possible evidence categories:
- inspection verdict,
- crawl/index status,
- user-declared vs provider canonical where returned,
- last crawl timestamp where returned,
- robots result where returned,
- mobile/usability/rich-results fields only if actually supplied.

The adapter must use `UNKNOWN / NOT_RETURNED` rather than inventing missing fields.

## 10. Inspection scheduling

Use selectively:
- strategic URLs,
- recently deployed SEO changes,
- pages with indexability discrepancies,
- post-incident verification.

Do not spam inspection requests.

## 11. Sitemap actions

Two separate operations:

### Local sitemap validation
Automatic/read-only.

### Provider sitemap submission
Explicit authenticated action.

Before submission:
- sitemap URL is HTTPS production,
- local/HTTP validation passes,
- Owner/Admin authorization policy passes,
- action is logged.

## 12. Metric aggregations

Build views for:

### Query
- clicks,
- impressions,
- CTR,
- average position,
- assigned cluster,
- target page,
- trend.

### Page
- total search metrics,
- top queries,
- query diversity,
- target-cluster performance.

### Cluster
Aggregate mapped query metrics with documented methodology.

### Section/game
Aggregate by page taxonomy.

## 13. Opportunity patterns

Examples:

### High impressions / low CTR
Potential title/snippet alignment opportunity. Do not assume title rewrite will necessarily improve CTR.

### Position band opportunity
Pages with meaningful impressions in a configurable position range may deserve content/link review.

### Rising query
Sustained multi-window growth.

### Declining query/page
Sustained decline after minimum-volume and data-completeness checks.

### Unmapped demand
Queries with meaningful evidence but no reviewed cluster/target.

## 14. Cannibalization evidence

Provider data can strengthen a cannibalization finding when the same query/cluster repeatedly appears for several pages.

Do not label any multi-URL query as a defect automatically; intent may legitimately differ.

## 15. Alerts

Initial rules:

- `GSC_SYNC_FAILED`
- `GSC_DATA_STALE`
- `GSC_PROPERTY_MISMATCH`
- `INDEXED_CANONICAL_MISMATCH` where evidence exists
- `CRITICAL_PAGE_NOT_INDEXABLE` where provider evidence supports it
- `CLICKS_DECLINE`
- `IMPRESSIONS_DECLINE`
- `CTR_ANOMALY`
- `QUERY_TARGET_SPLIT`

Trend alerts require:
- minimum volume,
- complete windows,
- dedupe/cooldown,
- evidence link.

## 16. Causality warning

A before/after graph is not proof that an SEO change caused the change.

The system should annotate change dates and experiments but phrase results as correlation unless a stronger experiment design supports a causal claim.

## 17. Failure behavior

If Search Console is unavailable:
- public site unaffected,
- last successful data remains visible with stale marker,
- job retries according to policy,
- Admin alert opens after threshold,
- no destructive reset.

## 18. Acceptance

SEO-04 is complete when:
- provider tokens are securely stored,
- imports are idempotent and complete/partial status is explicit,
- metrics preserve source/date dimensions,
- URL Inspection does not invent fields,
- provider outage cannot affect page serving,
- sitemap submission is explicit and audited,
- alert thresholds are configurable,
- independent review passes.

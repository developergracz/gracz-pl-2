# GRACZ-SEO-01 — Architecture and Data Model

Status: `TARGET DESIGN / NOT IMPLEMENTED`

## 1. Architectural style

SEO Control Center is an asynchronous control-plane capability. Public page rendering must remain available if the SEO database, crawler or Search Console provider is unavailable.

Logical components:

`Public Page Runtime`
→ emits deterministic SEO fields from approved configuration/content

`SEO Registry`
→ canonical inventory of public URLs and intended policies

`Technical Analyzer`
→ parses stored/live snapshots and creates normalized findings

`Crawler`
→ allowlisted fetcher for Gracz.pl URLs

`Metadata & Schema Builder`
→ typed deterministic renderers

`Sitemap/Robots Builder`
→ deterministic public artifacts from approved policy

`Keyword & Content Intelligence`
→ query clusters, target maps, briefs, cannibalization

`Internal Link Graph`
→ graph extraction and recommendations

`Provider Adapter Layer`
→ Search Console and future providers

`Metric Warehouse`
→ daily query/page measurements

`Alert/Opportunity Engine`
→ rules over technical and performance evidence

`Admin Control Center`
→ read/review/approve/rollback workflows

`Audit Log`
→ append-oriented mutation evidence

## 2. Dependency rule

Public request path MUST NOT synchronously call:
- Search Console,
- crawler,
- AI provider,
- external keyword provider,
- analytics aggregation jobs.

Only approved local configuration/content may affect response rendering.

## 3. Recommended package boundaries

Technology-specific locations must be chosen only after implementation discovery. Logical packages should remain separable:

- `seo-domain` — types, rules, issue codes, normalization.
- `seo-renderer` — metadata/schema/robots/sitemap deterministic rendering.
- `seo-crawler` — fetch/snapshot extraction.
- `seo-keywords` — keyword clusters and target mapping.
- `seo-links` — link graph and recommendations.
- `seo-provider-search-console` — provider adapter.
- `seo-jobs` — scheduled orchestration/checkpoints.
- `seo-admin-api` — authorization and application services.
- `seo-admin-ui` — operator interface.
- `seo-observability` — metrics/events.

If the existing project structure cannot support these names directly, preserve the boundaries conceptually.

## 4. Core data entities

The following is a logical model, not production DDL authorization.

### seo_page

Fields:
- `id` UUID/internal key
- `path` normalized path
- `canonical_url`
- `page_type`
- `locale`
- `environment`
- `lifecycle_state`
- `index_policy`
- `owner_domain`
- `primary_keyword_cluster_id` nullable
- `created_at`
- `updated_at`
- `last_published_at`
- `last_content_hash`
- `last_scan_at`

Unique constraints:
- environment + canonical_url
- environment + normalized path as appropriate

### seo_page_version

Immutable/versioned SEO configuration:
- page_id
- version
- title
- description
- canonical_override nullable
- robots_policy
- googlebot_policy
- hreflang JSON/normalized child rows
- open_graph fields
- twitter fields
- schema_configuration
- status: draft/approved/active/retired
- created_by
- approved_by
- reason
- created_at
- activated_at

### seo_crawl_snapshot

- id
- page_id or discovered_url
- fetched_url
- final_url
- fetched_at
- http_status
- content_type
- response_bytes
- duration_ms
- redirect_chain
- robots headers/meta
- canonical
- title
- description
- h1/h2 summary
- structured_data_summary
- internal_link_count
- content_hash
- extraction_version
- error_code

Large raw bodies should not be retained indefinitely unless needed for evidence; prefer normalized fields plus bounded evidence excerpts/hashes.

### seo_issue

- id
- issue_code
- severity
- page_id nullable
- scope_key
- state
- evidence_json
- source_snapshot_id
- first_seen_at
- last_seen_at
- acknowledged_by
- resolution_note
- closed_at

Uniqueness/idempotency key should prevent duplicate open issues for the same issue_code/scope/evidence generation.

### seo_keyword

- id
- raw_phrase
- normalized_phrase
- locale
- intent
- strategic_priority
- source
- status
- notes

### seo_keyword_cluster

- id
- name
- normalized_topic
- intent
- primary_keyword_id
- target_page_id nullable
- status

### seo_keyword_cluster_member

Many-to-many membership with confidence and source.

### seo_keyword_target_history

Tracks changes in keyword cluster → target URL assignment to analyze cannibalization and effects.

### seo_search_metric_daily

Dimensions, depending on provider data:
- property_id
- date
- query_key/raw query
- page/canonical key
- country nullable
- device nullable
- search appearance nullable
- clicks
- impressions
- ctr
- position
- imported_at
- provider_revision/source fingerprint

Storage should allow aggregate tables/materialized summaries later.

### seo_url_inspection_snapshot

- page_id/url
- inspected_at
- provider
- verdict fields returned by adapter
- indexed/crawl status if supplied
- canonical signals if supplied
- last crawl if supplied
- raw provider payload hash
- normalized result version

Do not infer fields the provider did not return.

### seo_internal_link

Observed directed edge:
- source_page_id
- target_page_id
- anchor_text
- context_hash
- first_seen
- last_seen
- follow_policy
- extraction_version

### seo_link_recommendation

- source_page_id
- target_page_id
- reason_code
- anchor_concepts
- score_components
- status
- reviewed_by
- created_at
- applied_at

### seo_alert_rule

- code
- scope
- enabled
- threshold_json
- minimum_volume
- comparison_window
- severity
- notification_policy

### seo_alert_event

- rule_id
- triggered_at
- evidence
- dedupe_key
- state
- resolved_at

### seo_provider_connection

Never store secret values here.

Store only:
- provider
- property/resource identifier
- connection status
- granted capabilities/scopes metadata
- last successful sync
- token secret reference
- owner
- created_at

### seo_job_checkpoint

- job_name
- partition
- cursor/watermark
- last_started_at
- last_completed_at
- result
- items_processed
- error_summary

### seo_audit_log

Append-oriented:
- actor_type
- actor_id
- action
- entity_type
- entity_id
- before_hash
- after_hash
- diff_json where safe
- reason
- approval_reference
- occurred_at
- correlation_id

## 5. Derived read models

For UI performance, build derived/read models rather than expensive live joins:

### seo_health_summary
Counts by severity, indexability, freshness and section.

### seo_page_health
One row/document per page with latest technical snapshot, issue counts, target keyword and performance summary.

### seo_query_opportunity
Cluster/query with recent metrics, assigned page, trend and transparent opportunity factors.

### seo_cannibalization_view
Clusters where multiple pages receive meaningful impressions for the same intent.

### seo_orphan_view
Indexable pages with insufficient internal inbound links.

## 6. Event model

Suggested domain events:
- `SeoPageRegistered`
- `SeoPagePolicyChanged`
- `SeoPagePublished`
- `SeoCrawlCompleted`
- `SeoIssueOpened`
- `SeoIssueResolved`
- `SeoKeywordTargetChanged`
- `SeoMetricsImported`
- `SeoInspectionCompleted`
- `SeoAlertTriggered`
- `SeoAlertResolved`

Events are useful for jobs/observability but do not require an event-sourced system.

## 7. Content fingerprinting

Use stable hashes to decide whether:
- lastmod should change,
- structured-data regeneration is required,
- a crawl snapshot materially differs,
- a content-change experiment starts/ends.

Fingerprint should exclude volatile values such as request timestamps.

## 8. Source of truth hierarchy

1. Public content system/domain data — factual page content.
2. SEO approved configuration — title/canonical/schema policy.
3. SEO registry — expected public URL inventory.
4. Live crawl snapshot — observed technical behavior.
5. Search Console — search-engine/provider evidence.
6. Derived recommendations — never source of truth.

When sources disagree, the UI must show the disagreement; it must not silently overwrite one with another.

## 9. Retention concept

Suggested policy categories:
- audit log: long-lived according to project governance,
- daily search metrics: long-lived enough for year-over-year analysis,
- normalized crawl snapshots: retain meaningful history plus recent rolling window,
- raw crawl bodies: minimize or avoid,
- provider raw payloads: bounded evidence/hash, not unlimited,
- AI prompts/drafts: only if editorially necessary and without secrets.

Exact retention durations require the project's privacy/operations policy before implementation.

## 10. Migration rule

No DDL in this document is executable. Actual schema migrations must be created in the project's approved migration mechanism, reviewed separately and tested against disposable/non-production PostgreSQL before any production action.

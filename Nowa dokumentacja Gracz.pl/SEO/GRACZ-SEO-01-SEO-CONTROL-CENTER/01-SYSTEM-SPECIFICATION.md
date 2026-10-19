# GRACZ-SEO-01 — System Specification

Status: `DESIGN BASELINE / NOT IMPLEMENTED`

## 1. Product objective

Build a durable SEO control plane for Gracz.pl that continuously inventories public pages, validates technical SEO, maps search demand to intentional landing pages, recommends internal links, imports Search Console evidence and gives the Owner/Admin a controlled workflow for remediation.

The platform must improve consistency and speed of SEO operations without turning SEO into uncontrolled content automation.

## 2. Actors

### Owner
Can approve implementation phases, high-impact SEO policy, publishing actions and provider connections.

### SEO Admin
Can manage targets, metadata proposals, keyword maps, sitemaps, issue triage and approved provider actions within permissions.

### Editor
Can create/edit content briefs and SEO fields but cannot change global indexing policy without approval.

### Reviewer
Read-only review plus approve/reject rights where explicitly delegated.

### System Worker
Executes deterministic scans, imports, validators and scheduled jobs. It cannot grant itself additional permissions.

### External Provider
Google Search Console or another explicitly configured source behind an adapter.

## 3. Functional requirements

### FR-001 — Page registry
Maintain one canonical record for every SEO-relevant public URL.

Each record must contain at minimum:
- internal ID,
- normalized path,
- absolute canonical URL,
- page type,
- locale,
- lifecycle status,
- intended index policy,
- owning content/domain module,
- primary keyword cluster where assigned,
- last observed HTTP status,
- last content fingerprint,
- last scan timestamp.

### FR-002 — URL normalization
Normalize scheme, host, trailing-slash policy, percent encoding, query-parameter policy and fragments according to one documented canonical policy.

### FR-003 — Indexability evaluator
For a given page, combine:
- HTTP status,
- robots meta,
- Googlebot meta,
- X-Robots-Tag if observable,
- robots.txt policy,
- canonical,
- redirect chain,
- authentication/access state,
- content availability.

Return:
`INDEXABLE`, `NON_INDEXABLE_EXPECTED`, `NON_INDEXABLE_DEFECT` or `UNKNOWN` with evidence.

### FR-004 — Metadata registry
Track title, meta description, canonical, hreflang, Open Graph and Twitter fields as versioned values.

### FR-005 — Metadata rules
Support page-type templates and deterministic validation:
- missing title,
- duplicate title,
- title outside configured guidance,
- missing/duplicate description,
- canonical mismatch,
- multiple canonicals,
- invalid hreflang relationships,
- missing social image/alt.

Length guidance is advisory/configurable, not a hard search-engine ranking rule.

### FR-006 — Heading/semantic analysis
Validate:
- H1 count,
- heading hierarchy,
- semantic content availability,
- duplicate or empty headings,
- important content hidden from normal presentation.

### FR-007 — Structured-data registry
Generate and validate JSON-LD from typed builders, not arbitrary string concatenation.

Initial supported entities:
- WebSite,
- Organization,
- WebPage,
- ImageObject,
- BreadcrumbList,
- Article where actually applicable,
- Game or SoftwareApplication only after schema suitability is explicitly reviewed.

The system must not add schema types merely because they are available.

### FR-008 — Robots policy
Maintain a human-readable policy model and render robots.txt from reviewed rules.

### FR-009 — Sitemap generation
Generate sitemap indexes and child sitemaps from the page registry. Exclude non-indexable, redirected, error and duplicate-canonical URLs.

### FR-010 — Sitemap integrity
Validate XML, URL count, host, protocol, canonical alignment and lastmod provenance.

`lastmod` must reflect meaningful page modification, not merely job execution time.

### FR-011 — Crawl scanner
Crawl only allowlisted Gracz.pl origins and configured environments. Capture:
- status,
- redirect chain,
- content type,
- canonical,
- robots,
- headings,
- metadata,
- structured data,
- internal links,
- image references,
- content fingerprint,
- response timing for diagnostics.

### FR-012 — Crawl safety
Crawler must enforce:
- host allowlist,
- no private-network pivoting,
- bounded redirects,
- timeout,
- maximum response size,
- concurrency limit,
- user agent identification,
- retry budget,
- cancellation.

### FR-013 — SEO issue engine
Create normalized issues with:
- issue code,
- severity,
- affected URL,
- evidence,
- first_seen,
- last_seen,
- state,
- owner,
- remediation guidance,
- source snapshot.

### FR-014 — Issue lifecycle
States:
`OPEN → ACKNOWLEDGED → FIX_PLANNED → FIXED_PENDING_VERIFY → CLOSED`
and `WONT_FIX` with reason.

A closed issue must reopen if fresh evidence detects recurrence.

### FR-015 — Change history
Every SEO configuration change must record:
- actor,
- timestamp,
- before,
- after,
- reason,
- approval source where required,
- related issue/experiment.

### FR-016 — Keyword registry
Store keyword/query concepts independently from Search Console measurements.

### FR-017 — Search intent
Classify intent at minimum:
- navigational,
- informational,
- game/play,
- rules/how-to,
- comparison/discovery,
- community.

Intent classification may be machine-assisted but must be reviewable.

### FR-018 — Target URL mapping
Allow one primary target URL per keyword cluster and multiple secondary/supporting URLs.

### FR-019 — Cannibalization detection
Flag when multiple pages compete for substantially the same target intent without an intentional relationship.

### FR-020 — Content gap analysis
Identify query clusters with measurable demand or strategic value but no adequate target page.

### FR-021 — Content brief
Generate an editorial brief containing:
- target intent,
- primary/secondary concepts,
- user questions,
- required factual sections,
- recommended internal links,
- structured-data eligibility,
- risk notes,
- evidence/source fields.

### FR-022 — AI guardrail
AI may propose titles, descriptions, outlines and draft copy. Drafts must be marked as generated and require human approval before publication.

### FR-023 — No mass auto-publication
No job may autonomously generate and publish large numbers of pages.

### FR-024 — Internal-link graph
Build a directed graph of crawlable internal links.

### FR-025 — Orphan detection
Flag indexable pages with no meaningful internal inbound links, excluding intentional special cases.

### FR-026 — Link recommendations
Recommend source page, target page, contextual reason and possible anchor concepts.

### FR-027 — Anchor quality
Detect excessive exact-match repetition and unnatural anchor concentration.

### FR-028 — Link approval
Default mode is recommendation-only. Automatic insertion requires a later explicit policy and separate Owner authorization.

### FR-029 — Search Console property registry
Store configured provider property IDs and connection status without exposing tokens.

### FR-030 — Search analytics import
Import query/page/country/device/date metrics available from the provider:
- clicks,
- impressions,
- CTR,
- average position.

### FR-031 — Query normalization
Preserve raw query for evidence and a separate normalized key for clustering.

### FR-032 — Search Console URL inspection
Where provider capability permits, fetch inspection evidence on demand or through controlled jobs.

### FR-033 — Sitemap provider actions
Submitting a sitemap is an explicit action, not a side effect of saving configuration.

### FR-034 — Trend engine
Calculate configurable comparison windows such as:
- latest complete 7 days vs previous 7,
- 28 vs previous 28,
- rolling baselines.

### FR-035 — Alert engine
Support alerts for:
- important URL becomes non-indexable,
- canonical changes unexpectedly,
- sitemap fails,
- sustained clicks/impressions decline,
- CTR anomaly,
- query-target cannibalization,
- new 404/5xx cluster,
- Search Console connection failure.

Thresholds must be configurable and include minimum-volume guards.

### FR-036 — Opportunity engine
Rank opportunities by transparent factors such as impressions, position band, CTR gap, page quality issues and strategic priority.

This priority score is not a ranking prediction.

### FR-037 — Dashboard
Provide a summary of:
- health,
- open issues,
- indexing status,
- top opportunities,
- recent changes,
- query/page trends,
- alerts,
- provider freshness.

### FR-038 — Page Inspector
For one URL show:
- expected policy,
- live snapshot,
- metadata,
- headings,
- JSON-LD,
- internal links,
- Search Console metrics,
- issues,
- change history,
- recommendations.

### FR-039 — Preview
Before applying SEO metadata changes, render a structured diff and validation result.

### FR-040 — Rollback
Versioned configuration changes must support rollback to a known prior version. Content rollback follows the owning content system.

### FR-041 — Export
Allow export of issue list, keyword map and performance snapshots in machine-readable formats.

### FR-042 — Evidence timestamps
Every imported/observed datum must record when it was measured and its source.

### FR-043 — Freshness
UI must distinguish current, stale and unknown provider/crawl evidence.

### FR-044 — Multi-environment safety
Production, preview and test environments must be explicitly labeled and never mixed in canonical reporting.

### FR-045 — Production action gate
Any action that changes public indexing behavior must require a permission check and, for high-impact settings, approval.

## 4. Non-functional requirements

### NFR-001 Determinism
The same stored inputs must produce the same technical metadata output.

### NFR-002 Idempotency
Scheduled imports and scans must be safely repeatable.

### NFR-003 Auditability
No silent mutation of SEO policy.

### NFR-004 Resilience
Provider outages must not break page rendering.

### NFR-005 Separation
Search Console ingestion is asynchronous and cannot become a runtime dependency for serving pages.

### NFR-006 Performance
SEO instrumentation must not materially increase public page LCP/CLS or add blocking client-side JavaScript without justification.

### NFR-007 Security
OAuth tokens/credentials only in secret storage; never database plaintext or logs.

### NFR-008 Least privilege
Provider scopes and internal roles must be minimal.

### NFR-009 Privacy
Store only search-performance data needed for SEO. Do not expand the system into user profiling.

### NFR-010 Observability
Jobs expose success/failure, duration, items processed, retry count and last successful checkpoint.

### NFR-011 Scalability
The data model must support at least tens of thousands of URLs and long-term daily search metrics without redesign.

### NFR-012 Provider independence
External provider-specific fields remain isolated behind adapters.

## 5. Page lifecycle

`DISCOVERED → REGISTERED → REVIEWED → PUBLISHED → MONITORED`

Exceptional states:
`NOINDEX_EXPECTED`, `REDIRECTED`, `RETIRED`, `ERROR`.

Retiring a page requires:
- successor/canonical decision,
- redirect decision where applicable,
- internal-link cleanup,
- sitemap removal,
- post-change verification.

## 6. Severity model

### BLOCKER
System-wide accidental noindex, broken canonical host, robots blocking all intended content, sitemap poisoning, credentials exposure.

### HIGH
Major indexable section broken, widespread 5xx/redirect loops, structured-data generation corrupts pages, provider credential compromise.

### MEDIUM
Duplicate/missing canonical on limited set, orphaned strategic pages, widespread duplicate metadata, persistent broken internal links.

### LOW
Non-blocking metadata quality issue, isolated alt/preview weakness, minor validation warning.

### INFO
Observation with no defect.

## 7. Completion rule

This specification is complete for planning when every requirement has:
- owner,
- implementation phase,
- acceptance criterion,
- test type.

The mapping is defined in `11-ACCEPTANCE-MATRIX.md`.

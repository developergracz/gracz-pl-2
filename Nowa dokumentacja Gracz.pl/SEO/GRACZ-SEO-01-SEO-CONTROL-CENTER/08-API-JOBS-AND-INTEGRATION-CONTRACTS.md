# GRACZ-SEO-01 — API, Jobs and Integration Contracts

Status: `TARGET CONTRACT / NOT IMPLEMENTED`

## 1. Principle

APIs serve the Admin/application layer; workers perform scans/imports asynchronously. Public page rendering consumes only approved local SEO configuration and must not depend on worker/provider availability.

Exact HTTP framework/routes may change with implementation stack. The semantic contracts below should remain.

## 2. Internal application commands

### RegisterPage
Input:
- path,
- page_type,
- locale,
- owner_domain,
- intended index policy.

Output:
- page ID,
- normalized canonical candidate,
- validation findings.

### ProposeSeoVersion
Input:
- page ID,
- metadata/schema changes,
- reason.

Output:
- draft version ID,
- validation result,
- required approval class.

### ApproveSeoVersion
Requires authorized actor.

### ActivateSeoVersion
Only approved version; writes audit record.

### RollbackSeoVersion
Activates prior approved version through a new audited action; do not erase history.

### AssignKeywordTarget
Updates cluster mapping with conflict validation.

### CreateContentBrief
Produces draft object, never direct publication.

### ReviewLinkRecommendation
Approve/reject recommendation.

### SubmitSitemap
Explicit provider action with capability/authorization check.

### RequestUrlInspection
Controlled provider action.

## 3. Read APIs

Conceptual resources:
- `/seo/health`
- `/seo/pages`
- `/seo/pages/{id}`
- `/seo/issues`
- `/seo/keywords`
- `/seo/clusters`
- `/seo/opportunities`
- `/seo/links`
- `/seo/search-console`
- `/seo/sitemaps`
- `/seo/alerts`
- `/seo/audit-log`

The actual route namespace must conform to the project's existing API standards.

## 4. Job catalog

### SEO-JOB-01 Registry Reconciliation
Purpose: compare route/content inventory with SEO registry.

Trigger:
- scheduled,
- deployment/content event.

Output:
- discovered/missing/retired candidates,
- no automatic deletion.

### SEO-JOB-02 Priority Crawl
Crawls changed/strategic URLs.

### SEO-JOB-03 Full Crawl
Bounded complete crawl of registered public scope.

### SEO-JOB-04 Technical Analysis
Runs deterministic validators over snapshots.

### SEO-JOB-05 Sitemap Build
Builds candidate artifact from registry.

Publication remains a controlled stage.

### SEO-JOB-06 Keyword/Target Analysis
Recomputes gaps/cannibalization/recommendations.

### SEO-JOB-07 Internal Link Graph
Extracts graph and recommendations.

### SEO-JOB-08 Search Console Daily Import
Imports complete provider date ranges idempotently.

### SEO-JOB-09 URL Inspection Queue
Processes selected URLs within provider constraints.

### SEO-JOB-10 Alert Evaluation
Evaluates technical/performance rules.

### SEO-JOB-11 Post-Deploy SEO Smoke
Checks a small critical URL set after authorized deploy.

### SEO-JOB-12 Evidence Retention
Applies approved retention policies to snapshots, not audit history indiscriminately.

## 5. Job execution contract

Every run records:
- job ID,
- definition version,
- start/end,
- source revision/config hash,
- partition/scope,
- checkpoint,
- processed count,
- success/failure/partial,
- retry count,
- sanitized error summary,
- correlation ID.

## 6. Idempotency

Use natural/idempotency keys such as:
- provider + property + date + dimensions + row key,
- page + snapshot content hash + extraction version,
- issue code + scope + generation,
- job + partition + watermark.

Retry must not duplicate metrics/issues/actions.

## 7. Concurrency

Use bounded concurrency.

Never let:
- full crawl overwhelm Gracz.pl,
- provider import exhaust quotas,
- two sitemap publishers race,
- two policy activations overwrite each other.

For configuration writes, use optimistic version/CAS or equivalent.

## 8. Retries

Classify errors:

### Retryable
- timeout,
- temporary 5xx,
- provider rate limit with retry guidance,
- transient network.

### Non-retryable
- auth revoked,
- invalid configuration,
- forbidden scope,
- malformed payload,
- host outside allowlist.

Retries:
- exponential/backoff policy,
- max attempts,
- dead-letter/failed state,
- alert after threshold.

## 9. Crawler SSRF contract

URL fetcher must:
- construct URLs from allowlisted origins/registry,
- reject arbitrary user-supplied schemes,
- allow only HTTP/HTTPS as needed,
- reject localhost/link-local/private networks unless explicitly non-production test fixture,
- revalidate redirect destinations,
- cap redirect count,
- cap DNS/connection/read time,
- cap body size.

## 10. Provider adapter interface

Conceptual methods:
- `getCapabilities()`
- `validateConnection()`
- `fetchSearchAnalytics(request)`
- `inspectUrl(request)`
- `listSitemaps()`
- `submitSitemap(request)`

Return normalized domain DTOs plus a provider evidence envelope.

## 11. Evidence envelope

Every external result should include:
- provider,
- property/resource,
- requested_at,
- received_at,
- source range,
- request fingerprint,
- adapter version,
- raw payload hash where useful,
- completeness state.

## 12. Events/hooks from site

The SEO system should be notified of:
- page published/updated,
- route changed,
- page retired,
- game availability changed,
- deployment completed.

If such events do not exist in the current architecture, phase SEO-00 must map the available alternatives before implementation.

## 13. Cache behavior

Approved metadata may be cached with the page response.

Invalidation should key off:
- page SEO version activation,
- content version change where metadata derived,
- deploy/config rollout.

Provider metrics must never be required for cache fill.

## 14. Observability

Metrics:
- job duration,
- job failures,
- URLs crawled,
- HTTP error distribution,
- open issues by severity,
- provider sync lag,
- inspection queue age,
- alerts triggered,
- sitemap build/publish status.

Logs:
- structured,
- correlation IDs,
- no secrets,
- no OAuth tokens,
- bounded provider payload excerpts.

## 15. Acceptance

This contract is complete when implementation maps every command/job to:
- code owner,
- data writes,
- authorization,
- idempotency key,
- retry behavior,
- tests,
- observability.

No production scheduler should be enabled merely because job code exists.

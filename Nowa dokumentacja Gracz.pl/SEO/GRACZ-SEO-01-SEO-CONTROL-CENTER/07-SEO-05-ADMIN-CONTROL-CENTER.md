# GRACZ-SEO-01 — SEO-05 Admin Control Center

Status: `TARGET UX/CONTROL DESIGN / NOT IMPLEMENTED`

## 1. Objective

Provide one advanced Owner/Admin interface for understanding SEO health, reviewing recommendations and approving controlled changes across Gracz.pl.

The panel is part of the broader administration capability, not a public SEO page.

## 2. Navigation

Suggested top-level screens:

1. `Overview`
2. `Pages`
3. `Issues`
4. `Keywords`
5. `Content Opportunities`
6. `Internal Links`
7. `Search Console`
8. `Sitemaps & Robots`
9. `Structured Data`
10. `Alerts`
11. `Change History`
12. `Settings & Connections`

## 3. Overview

Cards:
- technical health,
- intended indexable URLs,
- observed indexability failures,
- open blocker/high/medium issues,
- Search Console freshness,
- clicks/impressions trend,
- top opportunities,
- recent SEO changes,
- active alerts.

Every number links to evidence.

## 4. Pages screen

Table columns:
- URL,
- page type,
- lifecycle,
- expected index policy,
- live HTTP,
- canonical state,
- H1 state,
- schema state,
- sitemap membership,
- internal-link depth,
- Search Console metrics,
- issues,
- last scan.

Filters:
- game/section,
- page type,
- severity,
- indexability,
- stale evidence,
- no target keyword,
- orphan,
- changed recently.

## 5. Page Inspector

Tabs:

### Expected
Registry and approved SEO configuration.

### Live
Latest crawl evidence.

### Search
Search Console metrics/queries.

### Content
H1/H2/topic/keyword assignment.

### Links
Inbound/outbound graph.

### Schema
Parsed JSON-LD graph and validation.

### History
Changes, approvals and issue lifecycle.

### Actions
Only actions permitted by RBAC, always with preview.

## 6. Issue Center

Issue row:
- severity,
- code,
- URL/scope,
- concise reason,
- first/last seen,
- evidence timestamp,
- owner,
- state.

Bulk actions may acknowledge/assign but should not bulk-fix dangerous policies without a specialized workflow.

## 7. Keyword Map

Visual/table mapping:

`Cluster → Intent → Primary URL → Supporting URLs → Clicks → Impressions → Position → Issues`

Warnings:
- no target,
- target non-indexable,
- duplicate primary target,
- probable cannibalization,
- stale/no evidence.

## 8. Content Opportunity screen

Each opportunity shows:
- user intent,
- strategic value,
- observed demand evidence,
- current pages,
- proposed action,
- confidence,
- duplication risk,
- content brief status.

Buttons:
- create/review brief,
- assign existing page,
- dismiss with reason.

No direct `Publish AI page` button in initial release.

## 9. Internal Linking screen

Views:
- orphan pages,
- weakly linked strategic pages,
- broken links,
- redirecting links,
- recommendations.

Recommendation preview displays the source context and target rationale.

## 10. Search Console screen

Display:
- connection health,
- property,
- last complete date,
- sync state,
- trends,
- query/page explorer,
- URL inspection snapshots,
- sitemap provider state.

Provider errors must show actionable, sanitized messages.

## 11. Robots & Sitemap screen

### Robots
Show:
- generated policy,
- production preview,
- diff against current public version,
- dangerous-rule warnings.

### Sitemap
Show:
- sitemap partitions,
- URL counts,
- validation,
- last generated/published hash,
- provider submission state.

Global robots changes require elevated approval.

## 12. Structured Data screen

Per page:
- graph nodes,
- @ids,
- references,
- canonical consistency,
- eligibility warnings,
- JSON preview.

Do not allow arbitrary unvalidated JSON-LD injection by normal editors.

## 13. Change workflow

`DRAFT → VALIDATED → REVIEW_REQUESTED → APPROVED → APPLIED → VERIFIED`

Rejected path:
`REJECTED` with reason.

High-impact policy examples requiring Owner or delegated approver:
- global robots,
- homepage canonical,
- broad noindex/index changes,
- sitemap root changes,
- provider connection,
- bulk target remapping.

## 14. Preview and diff

Before apply:
- old/new values,
- affected URLs count,
- validation result,
- issue impact,
- rollback version,
- approval requirement.

No blind Save for high-impact changes.

## 15. Roles matrix

### Owner
All SEO control actions including dangerous-policy approval.

### SEO Admin
Normal configuration, issue triage, briefs, provider read actions; dangerous actions only if explicitly delegated.

### Editor
Content/metadata drafts, no global policies.

### Reviewer
Read + approve assigned review classes.

### Viewer
Read-only.

## 16. Audit history

Every mutation screen links to:
- who,
- what,
- before/after,
- why,
- approval,
- exact timestamp,
- correlation ID,
- related PR/deployment if applicable.

## 17. Mobile administration

The panel should remain usable on phone for:
- overview,
- alerts,
- approval/reject,
- issue triage,
- provider status.

Complex graph editing may remain desktop-optimized.

## 18. Accessibility

Requirements:
- keyboard navigation,
- semantic labels,
- status not encoded by color alone,
- accessible tables/forms,
- confirmation dialogs with clear consequences,
- no destructive action hidden behind ambiguous icons.

## 19. Notification design

Alert delivery adapters may later support:
- in-app,
- email,
- other approved channels.

Notifications must dedupe and respect severity/cooldown.

## 20. Acceptance

SEO-05 is complete when:
- every screen maps to explicit backend capabilities,
- RBAC is enforced server-side,
- dangerous changes have approval and preview,
- audit log is immutable through normal UI,
- rollback exists for versioned SEO config,
- mobile critical operations work,
- accessibility checks pass,
- independent review passes.

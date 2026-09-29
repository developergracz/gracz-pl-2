# GRACZ-SEO-01 — Implementation Roadmap and Gates

Status: `CANONICAL EXECUTION PLAN / NOT STARTED`

## 1. Rule

Implementation proceeds phase by phase. The next phase does not begin merely because previous code was written; its exit gate must be evidenced.

Every phase has:
- scope,
- source identity lock,
- implementation owner,
- tests,
- audit evidence,
- PASS/HOLD/FAIL,
- no production action unless explicitly authorized.

## 2. Phase SEO-00 — Discovery and Baseline

### Goal
Map the real current stack before writing SEO platform code.

### Required work
- identify current routing/page-generation mechanisms,
- identify current admin architecture,
- identify PostgreSQL migration mechanism,
- inventory existing SEO tags/schema/robots/sitemaps,
- inventory deployment environments,
- inventory auth/RBAC available to admin,
- map event/job scheduler capabilities,
- locate current Search Console ownership/configuration if connected,
- record current production crawl/indexing baseline,
- define canonical production host/trailing-slash/query policy.

### Deliverables
- `SEO-00-AS-IS-INVENTORY.md`
- route/page taxonomy snapshot,
- environment boundary,
- implementation location decision,
- risk register.

### Exit gate
PASS only if implementation locations and boundaries are evidence-backed.

No DDL or production changes.

## 3. Phase SEO-01 — Domain Foundation and Page Registry

### Goal
Implement domain types and read-only registry without affecting public output.

### Scope
- page type enum,
- URL normalization,
- lifecycle/index policy,
- registry persistence,
- audit foundations,
- read-only inventory reconciler.

### Tests
- URL canonicalization table tests,
- uniqueness,
- idempotent reconciliation,
- environment separation.

### Exit
Registry can describe current public pages without changing them.

## 4. Phase SEO-02 — Metadata and Structured Data Engine

### Goal
Deterministic builders and validators.

### Scope
- metadata DTOs,
- title/description/canonical/hreflang,
- OG/Twitter,
- JSON-LD graph builders,
- validation issue codes,
- preview/diff.

### Important
Initially run in shadow/read-only comparison against existing pages.

### Exit
Golden fixtures pass and no public rendering regression in shadow tests.

## 5. Phase SEO-03 — Robots and Sitemap Engine

### Goal
Build candidate robots/sitemap deterministically.

### Scope
- policy model,
- sitemap eligibility,
- lastmod provenance,
- partition support,
- XML validation.

### Mode
Generate candidate artifacts first; do not publish automatically.

### Exit
Candidate output matches approved policy and passes independent review.

## 6. Phase SEO-04 — Crawl and Technical Issue Engine

### Goal
Observe actual pages and open normalized findings.

### Scope
- safe crawler,
- extraction,
- indexability evaluator,
- canonical/heading/schema checks,
- broken links/images,
- issue lifecycle,
- technical health summary.

### Security gate
SSRF/redirect/timeout/body-limit tests mandatory.

### Exit
Crawler cannot escape allowlist and issue detection is idempotent.

## 7. Phase SEO-05 — Keyword and Content Intelligence

### Goal
Create controlled query-to-page map.

### Scope
- keyword registry,
- clusters,
- intent,
- target mapping,
- cannibalization,
- content gaps,
- content briefs.

### AI
Draft assistance may be added only behind `DRAFT_AI` and approval.

### Exit
No auto-publication path exists; target conflicts are detectable.

## 8. Phase SEO-06 — Internal Linking Engine

### Goal
Build graph and recommendations.

### Scope
- link extraction,
- orphan/depth analysis,
- broken/redirecting link detection,
- contextual recommendations,
- review workflow.

### Mode
Recommendation-only.

### Exit
No autonomous content mutation; recommendations are explainable and verified after manual apply.

## 9. Phase SEO-07 — Search Console Integration

### Goal
Import provider evidence securely.

### Scope
- provider adapter,
- authentication,
- property config,
- analytics importer,
- checkpoints,
- URL inspection,
- sitemap provider read/actions.

### Security
Credentials in secret storage only.

### Exit
Daily import is idempotent; partial/truncated state explicit; provider outage cannot affect public runtime.

## 10. Phase SEO-08 — Admin Control Center

### Goal
Expose system safely to Owner/Admin.

### Scope
- overview,
- pages,
- issues,
- keywords,
- links,
- provider,
- sitemaps/robots,
- schema,
- history,
- approvals.

### Exit
Server-side RBAC, diff/preview, audit log and critical mobile flows pass.

## 11. Phase SEO-09 — Alerts, Opportunities and Change History

### Goal
Turn evidence into controlled operational signals.

### Scope
- alert rules,
- trends,
- volume guards,
- opportunity scoring,
- change annotations,
- notification adapters.

### Exit
Alert dedupe/cooldown tested; no ranking prediction claims.

## 12. Phase SEO-10 — Controlled Production Rollout

### Entry requirements
- all required previous phase gates PASS,
- independent final review,
- Owner rollout authorization,
- rollback plan,
- production baseline captured.

### Rollout sequence

#### R0 — read-only production observation
Crawler/provider only; no public SEO mutation.

#### R1 — metadata on a small canary set
Compare HTML snapshots and Search Console state.

#### R2 — sitemap/robots controlled publication
Only after explicit diff approval.

#### R3 — broader page-type rollout
One page class at a time.

#### R4 — full control center operational
Alerting and governance active.

### Post-deploy checks
- HTTP status,
- canonical,
- robots/meta,
- sitemap,
- schema parse,
- responsive semantic content,
- no traffic/indexing anomaly,
- provider evidence when available.

## 13. Gate format

Every gate report:

`IDENTITY | SCOPE | TESTS | SECURITY | DATA | RENDERING | PROVIDER | FINDINGS | VERDICT`

Findings:
- BLOCKER
- HIGH
- MEDIUM
- LOW
- INFO

Verdict:
- PASS
- HOLD
- FAIL

## 14. Independence

High-impact phases require fresh independent review of the locked implementation HEAD.

The author/fixer should not be the only independent reviewer of its own correction.

## 15. Change discipline

If a review finds a defect:
1. HOLD,
2. correction on the existing phase branch unless architecture requires otherwise,
3. new HEAD,
4. delta tests,
5. fresh review of the new HEAD,
6. merge only after gate.

## 16. Cost-control rule

Do not require multiple redundant full audits for low-risk changes. Default:
- implementation self-check,
- CI,
- one independent review.

Use additional specialist review only for high-risk areas such as robots-wide changes, auth/secrets, DB migrations, provider credentials or major architecture changes.

## 17. Current resume point

As of this design document:

`SEO CONTROL CENTER IMPLEMENTATION = NOT STARTED`

The first future executable step is:
`SEO-00 — Discovery and Baseline`

Do not skip SEO-00 even if parts of the site are already known from older chats; current repository evidence must be refreshed.

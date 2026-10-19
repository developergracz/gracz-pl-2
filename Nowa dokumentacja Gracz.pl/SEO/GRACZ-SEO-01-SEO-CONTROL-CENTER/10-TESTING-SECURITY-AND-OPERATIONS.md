# GRACZ-SEO-01 — Testing, Security and Operations

Status: `QUALITY PLAN / NOT IMPLEMENTED`

## 1. Quality objective

SEO Control Center must be safer than manual ad-hoc editing. A defect in the system must not be able to silently deindex the portal, expose credentials or overload production.

## 2. Test pyramid

### Unit tests
- URL normalization,
- canonical resolver,
- metadata templates,
- robots policy,
- sitemap eligibility,
- JSON-LD builders,
- issue severity/rules,
- keyword normalization,
- clustering helpers,
- link recommendation constraints,
- trend math,
- alert threshold logic.

### Contract tests
- provider adapter normalization,
- public content integration,
- admin authorization,
- job checkpoints,
- migration repositories.

### Integration tests
- disposable database,
- sitemap generation from registry,
- crawler against controlled fixture site,
- issue lifecycle,
- Search Console mocked provider,
- change audit.

### End-to-end tests
- Admin draft → validation → approval → activation → verification,
- page inspector,
- critical policy approval,
- rollback,
- provider connection failure.

### Browser/render tests
For representative public templates:
- desktop,
- landscape,
- portrait,
- semantic H1/H2 availability,
- canonical/head output,
- JSON-LD parse,
- no horizontal overflow,
- image dimensions,
- no unexpected layout regressions.

## 3. Golden fixtures

Maintain approved fixtures for:
- homepage,
- game,
- rules/guide,
- category,
- article.

Each fixture captures expected:
- title,
- description,
- canonical,
- robots,
- hreflang,
- OG/Twitter,
- schema graph,
- sitemap inclusion.

Intentional changes update fixtures through reviewed diffs.

## 4. Property/invariant tests

Examples:
- normalized canonical is idempotent,
- sitemap never includes `NOINDEX_EXPECTED`,
- sitemap URL host equals configured production host,
- no active SEO version can have two canonical tags,
- structured-data references resolve within graph,
- provider metrics upsert is idempotent,
- audit log entry created for every activation,
- dangerous policy cannot activate without required role/approval.

## 5. Security threat model

### SSRF through crawler
Control:
allowlist, DNS/IP checks, redirect revalidation, private-range rejection, scheme restrictions.

### OAuth/token disclosure
Control:
secret store, redaction, minimal scopes, rotation/revocation, no payload logging.

### Privilege escalation
Control:
server-side RBAC, deny by default, approval classes, authorization tests.

### Stored XSS via metadata/briefs
Control:
strict output encoding, no arbitrary HTML in SEO fields, content sanitization where rich text exists.

### JSON-LD injection
Control:
typed builders and escaping; no raw script injection for normal editors.

### SQL injection
Control:
parameterized persistence layer and repository patterns.

### Denial of service
Control:
crawler concurrency, job budgets, response-size caps, cancellation, rate limits.

### Accidental deindex
Control:
dangerous-policy detection, preview, approval, canary, post-deploy smoke, rollback.

### Supply-chain risk
Control:
lockfiles, dependency scanning, CodeQL/static analysis where applicable.

## 6. Secret policy

Forbidden in:
- repo,
- Markdown docs,
- database plaintext,
- frontend bundle,
- logs,
- screenshots/evidence packs.

Store only secret references in configuration data.

## 7. RBAC tests

Minimum cases:
- Viewer cannot mutate.
- Editor cannot change global robots.
- SEO Admin cannot exceed delegated dangerous-action scope.
- Owner can approve high-impact changes.
- Worker identity can execute only job-specific service operations.
- Revoked user cannot use stale client authorization.

## 8. Database safety

Before any SEO schema migration:
- migration diff reviewed,
- disposable PostgreSQL PASS,
- forward migration PASS,
- rollback/forward-fix strategy documented,
- indexes examined for large metric tables,
- retention impact reviewed.

No production migration is authorized by this document.

## 9. Performance tests

Public path:
- no external API call,
- no new blocking JS by default,
- metadata generation bounded,
- sitemap generation offline/job-based.

Admin path:
- pagination for large page/query tables,
- aggregate/read models,
- no unbounded query export,
- background jobs for expensive analysis.

## 10. Crawler load test

Test:
- concurrency,
- timeout,
- cancellation,
- retry storm prevention,
- redirect loops,
- huge response,
- slow response,
- malformed HTML,
- compressed content limits.

## 11. Provider resilience tests

Simulate:
- 401/403 revoked auth,
- 429/rate limit,
- 5xx,
- timeout,
- partial pagination,
- duplicate rows,
- late data,
- changed provider fields.

Expected:
- public runtime unaffected,
- job ends partial/fail explicitly,
- checkpoint safe,
- alert generated where appropriate.

## 12. SEO regression suite

Every production-facing SEO change checks:
- accidental noindex,
- robots global block,
- canonical host,
- sitemap canonical URLs,
- title/H1 existence,
- structured-data parse,
- social image,
- key responsive content,
- status/redirect.

## 13. Production smoke set

Maintain a small critical list:
- homepage,
- each flagship game page,
- one guide/rules page per game family,
- category/index,
- sitemap,
- robots.

The actual list is configuration and evolves with the product.

## 14. Observability

Operational metrics:
- crawl success rate,
- issue count by severity,
- registry reconciliation drift,
- sitemap build state,
- provider sync lag,
- job retries/failures,
- inspection queue age,
- alert volume,
- admin activation/rollback count.

## 15. Alert hygiene

Alerts must have:
- owner,
- severity,
- evidence,
- dedupe key,
- cooldown,
- resolution condition.

Avoid alerting on normal low-volume metric noise.

## 16. Incident runbooks

### Accidental noindex/global robots
1. freeze SEO mutations,
2. verify scope/live headers,
3. restore last approved version,
4. validate critical URLs,
5. republish sitemap if required,
6. record incident,
7. provider inspection after public fix where useful.

### Canonical host regression
1. freeze,
2. compare active SEO version/deploy,
3. restore policy,
4. crawl critical set,
5. check sitemap/schema/social URLs.

### Search Console auth failure
1. public runtime remains untouched,
2. mark data stale,
3. notify authorized owner,
4. reauthorize connection,
5. resume from checkpoint.

### Crawler runaway
1. cancel job,
2. disable schedule,
3. inspect scope/allowlist/concurrency,
4. do not retry until cause known.

## 17. Backup/DR

SEO configuration and audit data should follow the project's approved database backup/restore program once implemented.

Search Console data can be re-imported where provider retention permits, but approved configuration/audit history must be treated as primary project data.

## 18. Definition of quality PASS

A phase cannot PASS with:
- open BLOCKER,
- open HIGH affecting phase scope,
- uncontrolled dangerous mutation,
- secret exposure,
- failed mandatory tests,
- unknown source identity.

MEDIUM findings require explicit closure or documented gate decision; do not silently waive.

## 19. Operational ownership

Before production:
- named system owner,
- named SEO/admin owner,
- secret/provider owner,
- alert recipient,
- incident escalation path.

Until assigned:
`PRODUCTION OPERATIONAL READINESS = HOLD`.

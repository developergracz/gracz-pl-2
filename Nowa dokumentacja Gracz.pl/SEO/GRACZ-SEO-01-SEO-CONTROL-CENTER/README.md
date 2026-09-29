# GRACZ-SEO-01 — SEO Control Center

Version: `R1 DESIGN BASELINE`  
Status: `DESIGN COMPLETE FOR PLANNING / NOT IMPLEMENTED / NO DEPLOYMENT AUTHORIZATION`  
Repository: `developergracz/gracz-pl-2`  
Owner: Czesław Socha  
Date: 2026-09-29

## 1. Mission

GRACZ-SEO-01 is the planned SEO operating system for Gracz.pl. It is not a "ranking button" and it cannot guarantee a Google position. Its job is to keep the portal technically indexable, semantically coherent, measurable and continuously improvable while preventing accidental SEO regressions.

The system combines five capabilities:

- `SEO-01 Technical SEO Engine` — indexability, canonical, metadata, schema, robots, sitemap, images and crawl diagnostics.
- `SEO-02 Keyword & Content Intelligence` — keyword inventory, intent, target-URL mapping, content gaps, cannibalization detection and editorial briefs.
- `SEO-03 Internal Linking Engine` — crawl graph, orphan detection and controlled linking recommendations.
- `SEO-04 Search Console Intelligence` — Google Search Console ingestion, URL inspection evidence, query/page performance and alerts.
- `SEO-05 Admin Control Center` — human review, approvals, history, dashboards and controlled actions.

## 2. Design principles

1. Human agency first: the system recommends; publication and consequential changes require explicit authorization.
2. One URL — one primary intent: each important query cluster should have an intentional target URL.
3. Technical correctness before content scale.
4. Server-rendered or crawlable semantic content must not depend on client-side tricks.
5. No hidden SEO text, doorway pages, mass thin pages or manipulative link schemes.
6. AI-generated material is draft-only by default.
7. Every automated change must be reproducible, diffable and reversible.
8. Every provider integration uses an adapter; Google quotas and API behavior are configuration, not hard-coded architectural assumptions.
9. A scoring system may prioritize defects but must never be presented as a guarantee of ranking.
10. Evidence beats assumptions: production status, indexing and performance require fresh measurements.

## 3. Canonical reading order

Read these files in order:

1. `01-SYSTEM-SPECIFICATION.md`
2. `02-ARCHITECTURE-AND-DATA-MODEL.md`
3. `03-SEO-01-TECHNICAL-SEO-ENGINE.md`
4. `04-SEO-02-KEYWORD-CONTENT-INTELLIGENCE.md`
5. `05-SEO-03-INTERNAL-LINKING-ENGINE.md`
6. `06-SEO-04-SEARCH-CONSOLE-INTELLIGENCE.md`
7. `07-SEO-05-ADMIN-CONTROL-CENTER.md`
8. `08-API-JOBS-AND-INTEGRATION-CONTRACTS.md`
9. `09-IMPLEMENTATION-ROADMAP-AND-GATES.md`
10. `10-TESTING-SECURITY-AND-OPERATIONS.md`
11. `11-ACCEPTANCE-MATRIX.md`
12. `12-RESUME-RUNBOOK.md`
13. `14-PUBLIC-SITE-ARCHITECTURE-AND-URL-MAP.md`
14. `15-SEO-CONTENT-ROLLOUT-AND-INTERNAL-LINKING.md`
15. `SEO-00-AS-IS-INVENTORY.md` — closed SEO-00 evidence, production baseline, implementation boundaries and SEO-01a entry conditions.

## 4. System boundary

In scope:
- public Gracz.pl pages,
- game landing pages,
- rules/guides,
- category pages,
- editorial content,
- technical SEO metadata,
- structured data,
- sitemap and robots policy,
- crawl/indexability diagnostics,
- Search Console metrics,
- internal links,
- SEO audit history,
- alerts and Owner/Admin workflows.

Out of scope for the first implementation:
- paid advertising,
- automated backlink acquisition,
- auto-posting to external sites,
- autonomous mass content publishing,
- ranking guarantees,
- user tracking unrelated to SEO,
- production DNS/hosting mutations without separate authorization.

## 5. Intended page taxonomy

The registry must support at least:

- `homepage`
- `game`
- `game_rules`
- `game_guide`
- `category`
- `tournament`
- `community`
- `article`
- `static`
- `utility`

Initial strategic examples include Poker, Tysiąc, Warcaby and Gomoku, but the system must not hard-code only those games.

## 6. Canonical implementation sequence

`SEO-00 Baseline → SEO-01 Registry/Scanner → SEO-02 Metadata/Schema → SEO-03 Sitemap/Robots → SEO-04 Crawl & Issue Engine → SEO-05 Keyword/Content → SEO-06 Internal Linking → SEO-07 Search Console → SEO-08 Admin UI → SEO-09 Alerts/History → SEO-10 Controlled Production Rollout`

Every phase has a gate. No phase is considered complete merely because code exists.

## 7. Definition of success

The system is successful when it can answer, with evidence:

- Which public URLs should Google index?
- Which URLs are blocked and why?
- What is the canonical URL for each page?
- Which page targets each important query cluster?
- Are there duplicate titles/descriptions/H1s?
- Are structured-data entities valid and consistent with visible content?
- Which pages are orphaned or weakly linked?
- Which queries/pages gain or lose impressions, clicks, CTR and position?
- Which SEO changes were made, by whom, why and with what result?
- What should be fixed next, and what evidence supports that priority?

## 8. Non-goal

GRACZ-SEO-01 does not promise position #1 for `gracz` or any other query. Search results depend on factors outside the system, including competition, authority, links, demand, content quality, user behavior and search-engine changes.

## 9. Public-page SEO backlog

The first concrete candidate public architecture is frozen in:

- `14-PUBLIC-SITE-ARCHITECTURE-AND-URL-MAP.md` — 48 candidate public URLs with intent, H1, title, description, links and rollout wave.
- `15-SEO-CONTENT-ROLLOUT-AND-INTERNAL-LINKING.md` — publication workflow, cluster graph, canary strategy and W1–W4 rollout gates.

These URLs are candidates, not automatic publication instructions. Keyword demand must be validated and product-state gates must be respected.

## 10. Current execution state

`SEO-00 DISCOVERY AND BASELINE = CLOSED / PASS`

The durable closure record is `SEO-00-AS-IS-INVENTORY.md`.

The next implementation phase is the isolated `SEO-01a — Domain Foundation and File-backed Page Registry`, but coding requires a separate Owner-authorized implementation mandate. SEO-01a must not modify `maintenance-site/`, must not use PostgreSQL/DDL and must not deploy production.

Long-term runtime ownership is intentionally deferred and must be resolved before SEO-02+.

## 11. Resume rule

A future implementation session must begin with `12-RESUME-RUNBOOK.md`, verify repository identity and current status, and then continue only the first non-closed phase from `09-IMPLEMENTATION-ROADMAP-AND-GATES.md`.

Do not start coding from this README alone.

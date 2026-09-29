# GRACZ-SEO-00 — AS-IS Inventory and Closure Evidence

Status: `CLOSED — PASS`  
Date: 2026-09-29  
Repository: `developergracz/gracz-pl-2`  
Audited main: `a808054fb685f2c52c5b4aeacbc8374711a4cbcd`  
SEO homepage PR #49 audited HEAD: `205f47b1115b73bcd2db53a7c057049387d0ee03`  
SEO design PR #50 audited HEAD at closure: `e8ec2f18f82ba011d6130b92abeb0f3abc142aeb`

## 1. Purpose

This document is the durable completion record for phase `SEO-00 — Discovery and Baseline`.

It records the verified current architecture, production SEO baseline, implementation boundaries, risks and the exact conditions under which `SEO-01a — Domain Foundation and File-backed Page Registry` may begin.

This document does **not** authorize:
- production deployment,
- database migrations,
- Search Console connection,
- robots/sitemap publication,
- public-page generation,
- admin UI changes,
- bulk content creation.

## 2. Final SEO-00 verdict

`SEO-00 REVISED FINAL VERDICT = PASS`

Acceptance controls:

| Control | Result | Evidence summary |
|---|---|---|
| AC-0001 Routes/pages | PASS | Current static, modern Node and legacy routing mapped |
| AC-0002 SEO mechanisms | PASS | Current metadata/indexability mechanisms inventoried |
| AC-0003 Admin/RBAC | PASS | Existing auth, RBAC, MFA and admin handler patterns mapped |
| AC-0004 DB/migrations | PASS | Current startup DDL and pending migrator path mapped |
| AC-0005 Jobs/scheduler | PASS | Existing timers, GitHub Actions and lack of production worker mapped |
| AC-0006 Environments | PASS | Production host boundary directly verified |
| AC-0007 SEO baseline | PASS | Live homepage, robots, sitemap, redirects and 404 directly verified |
| AC-0008 Implementation location | PASS | SEO-01a can be located without architectural guessing |

## 3. Identity lock at closure

At closure, no source drift was observed:

- `main` = `a808054fb685f2c52c5b4aeacbc8374711a4cbcd`
- PR #49 = OPEN / DRAFT / NOT MERGED
- PR #49 HEAD = `205f47b1115b73bcd2db53a7c057049387d0ee03`
- PR #50 = OPEN / DRAFT / NOT MERGED
- PR #50 HEAD at closure review = `e8ec2f18f82ba011d6130b92abeb0f3abc142aeb`

Any future implementation mandate must refresh these identities before coding.

## 4. Current production boundary

Fresh read-only production HTTP verification established:

| URL | Result |
|---|---|
| `https://gracz.pl/` | 200 |
| `https://gracz.pl/robots.txt` | 404 — not present |
| `https://gracz.pl/sitemap.xml` | 404 — not present |
| `http://gracz.pl/` | 301 → `https://gracz.pl/` |
| `https://www.gracz.pl/` | 301 → `https://gracz.pl/` |
| definitely missing test URL | real HTTP 404 |
| `https://gracz.pl/README.md` | 200 — publicly readable |
| `https://gracz.pl/render.yaml` | 200 — publicly readable |

The live homepage matched `main@a808054` byte-for-byte for the checked production files.

PR #49 was **not deployed** at SEO-00 closure.

## 5. Current homepage SEO baseline

Live `https://gracz.pl/` at closure:

- status: 200,
- language: `pl`,
- title: `gracz.pl — trwa modernizacja`,
- description: `gracz.pl — trwa modernizacja serwisu.`,
- robots meta: `noindex,follow`,
- Googlebot meta: absent,
- X-Robots-Tag: absent,
- canonical: absent,
- hreflang: absent,
- Open Graph: absent,
- Twitter metadata: absent,
- JSON-LD: absent,
- H1 count: 1,
- robots.txt: absent,
- sitemap.xml: absent.

Interpretation:

The production homepage is crawlable but deliberately excluded from indexing by `noindex`.

The indexing-ready homepage work exists only in pending PR #49.

## 6. Redirect and host policy evidence

Verified production behaviour:

- HTTP → HTTPS: PASS,
- `www.gracz.pl` → apex `gracz.pl`: PASS,
- path/query preservation on the www redirect: observed,
- missing pages return a real 404,
- no soft-404 was observed.

Additional duplicate-serving observations:

- `/index.html` returns 200,
- tracking-parameter variants such as `/?utm_source=x` return 200,
- Render's onrender.com hostname can serve equivalent content.

Therefore absolute canonicals are required when the site becomes indexable.

## 7. Canonical URL policy — proposed, not yet Owner-approved

Technical assessment: `SOUND`.

Proposed policy:

- scheme: `https`,
- canonical host: `gracz.pl`,
- `www` redirects to apex,
- homepage path: `/`,
- future public content pages: trailing slash,
- lowercase ASCII slugs,
- fragments excluded,
- `index.html` normalized to directory URL,
- tracking parameters excluded from canonical URLs.

Owner approval is still required before this becomes binding implementation policy.

## 8. Render production facts

A separate read-only Render control-plane inspection on 2026-09-29 verified:

Service:
`gracz-pl-maintenance`

Type:
`static_site`

Repository:
`developergracz/gracz-pl-2`

Branch:
`main`

Actual Render configuration:

- `rootDir = maintenance-site`
- `publishPath = .`
- `autoDeploy = yes`
- `autoDeployTrigger = commit`

Latest observed LIVE deployment at the time of inspection:

`a808054fb685f2c52c5b4aeacbc8374711a4cbcd`

This is important because repository `maintenance-site/render.yaml` contains stale deployment-control information and must not be treated as the authoritative Render control-plane state.

### Deployment consequence

A future merge/push to production-connected `main` can trigger deployment.

Therefore SEO-01a must include a CI/scope guard ensuring that its branch/PR has **zero changes under `maintenance-site/`**.

SEO-01a itself must remain outside the public request path.

## 9. Public support-file exposure

The following support files are publicly reachable from the current static publish root:

- `/README.md`
- `/render.yaml`
- `/og-gracz-pl.jpg.b64`

Classification at SEO-00 closure:

`LOW`

Reason:

- no secrets, tokens or connection strings were observed,
- they disclose operational/documentation details,
- they create unnecessary indexable/support URLs.

This does **not** block SEO-01a.

Hardening should be handled before or together with the homepage indexing release, without expanding SEO-01a scope.

PR #49 already removes the obsolete `.b64` payload.

## 10. Current repository architecture

### Production static site

`maintenance-site/`

Current live public homepage.

### Modern runtime

`modern/checkers-engine/`

Characteristics discovered during SEO-00:

- Node >=24 ESM,
- plain `node:http`,
- PostgreSQL via `pg`,
- static HTML/vanilla JS frontend,
- hand-written route dispatch,
- no general page router,
- no shared head/layout/content system,
- Node test runner and Playwright,
- current application service suspended on Render.

### Legacy

`website/` and `games-dev/`

Legacy PHP/Apache and older game code. Not a suitable default for new SEO platform ownership.

## 11. Public-page architecture gap

The planned 48-page SEO architecture cannot be implemented cleanly using the existing public routing as-is.

Current code has no general page/template/content subsystem for:

- `/gry/`,
- `/gry/poker/`,
- `/poradniki/...`,
- future category/guide pages.

That is a later SEO-02+ concern and is intentionally excluded from SEO-01a.

## 12. Current SEO mechanism baseline in repository

On current `main`:

- titles are hand-written,
- descriptions are inconsistent,
- production homepage has `noindex,follow`,
- no canonical framework,
- no hreflang framework,
- no OG/Twitter framework,
- no JSON-LD framework,
- no sitemap generator,
- no robots generator,
- no SEO registry,
- no content registry,
- no Search Console integration.

Pending PR #49 adds homepage-specific SEO only and must remain separate from SEO-01a.

## 13. Admin and RBAC baseline

Existing roles:

- player,
- moderator,
- administrator,
- owner.

Existing platform patterns include:

- signed sessions,
- server-side RBAC checks,
- MFA for privileged roles,
- admin handler modules,
- append-oriented audit service.

Future SEO Admin/Editor/Reviewer role design is not required for SEO-01a.

SEO-05 Admin Control Center remains a later phase.

## 14. Database and migration baseline

Current `main` uses runtime startup DDL across service modules.

That is **not** accepted as the mechanism for SEO-01 durable schema work.

A numbered migrator exists only in pending/draft PR #26 and is not yet the stable mainline migration baseline.

Therefore:

### SEO-01a

- no PostgreSQL,
- no DDL,
- no migrations,
- file-backed/versioned registry,
- git history,
- deterministic read-only reconciliation.

### SEO-01b

Durable PostgreSQL persistence only after an approved migration mechanism exists on the chosen runtime/mainline.

No SEO table may be added via startup DDL.

Technical assessment:

`SEO-01a/SEO-01b PERSISTENCE SPLIT = SOUND`

Owner approval of this split is still required before the implementation mandate treats it as frozen policy.

## 15. Jobs and provider baseline

Current repository has no dedicated production scheduler/worker suitable for future Search Console jobs.

Current external-provider calls are ad hoc; there is no reusable OAuth/provider adapter framework.

Therefore SEO-01a excludes:

- crawler,
- Search Console,
- provider credentials,
- scheduled SEO jobs,
- alert engine.

## 16. Gracz Next relationship

SEO-00 found a cross-repo architectural boundary:

- `gracz-pl-2` is the current public/legacy repository,
- `gracz-next` has a newer migration/worker architecture,
- no final SEO/public-web ownership decision is recorded.

Conclusion:

- unresolved runtime ownership **does not block SEO-01a**,
- unresolved runtime ownership **does block SEO-02+ decisions** involving rendering, durable persistence, workers, admin and provider integration.

The runtime-owner decision must be made before SEO-02 begins.

## 17. SEO-01a implementation location — proposed

SEO-00 recommended a runtime-independent module boundary in this repository, separated from the public request path.

Proposed implementation family:

`modern/seo-control-center/`

Initial logical contents:

- `src/seo-domain.js`
- `src/seo-url.js`
- `src/seo-registry.js`
- `src/seo-inventory.js`
- `src/seo-audit.js`
- `registry/pages.json`
- `test/seo-01-*.test.js`

Final file names may follow implementation evidence and repository conventions, but the isolation boundary must remain.

## 18. SEO-01a exact safe slice

SEO-01a may include only:

- SEO domain types,
- URL normalization,
- page lifecycle,
- index policy,
- environment separation,
- file-backed page registry,
- initial homepage registry entry,
- read-only inventory reconciliation,
- audit-event contract,
- unit/table/property tests,
- path-filtered CI.

SEO-01a must exclude:

- PostgreSQL,
- DDL,
- migrations,
- Search Console,
- OAuth/provider code,
- crawler,
- robots publication,
- sitemap publication,
- public-page generation,
- admin UI,
- production deployment,
- AI content,
- creation of the 48 candidate pages.

## 19. SEO-01a mandatory safety guard

Because Render currently auto-deploys production-connected `main`, SEO-01a requires a scope guard:

`NO CHANGES UNDER maintenance-site/`

Recommended CI behaviour:

Fail the SEO-01a PR if any changed path is under:

`maintenance-site/**`

This guard protects the phase boundary and prevents SEO-01a from becoming a production release accidentally.

## 20. Initial registry rule

The first file-backed registry should contain only the currently verified homepage identity and environment policy needed to exercise the domain model.

It must **not** bulk-register all 48 candidate URLs as if they were live.

Candidate URLs remain design backlog until their later publication gates.

## 21. Open decisions after SEO-00

These are not SEO-00 failures.

### Decision A — canonical URL policy

Status:
`TECHNICALLY SOUND / OWNER APPROVAL PENDING`

### Decision B — persistence split

Status:
`TECHNICALLY SOUND / OWNER APPROVAL PENDING`

### Decision C — long-term runtime owner

Status:
`NOT REQUIRED FOR SEO-01a / REQUIRED BEFORE SEO-02+`

## 22. Risks carried forward

| Risk | Severity | SEO-01a impact |
|---|---|---|
| accidental production deployment from main | HIGH | mitigated by maintenance-site path guard |
| database/migrator uncertainty | HIGH | eliminated from SEO-01a scope |
| long-term runtime ownership unresolved | HIGH later | does not block SEO-01a |
| public support-file exposure | LOW | does not block SEO-01a |
| homepage PR #49 overlap | MEDIUM | SEO-01a must not edit maintenance-site |
| crawler SSRF | HIGH future | crawler excluded |
| content/ruleset accuracy | MEDIUM future | bulk pages excluded |

## 23. Closure decision

SEO-00 is closed as:

`PASS`

SEO-01a technical readiness:

`PASS`

Safe to start SEO-01a:

`YES — only after explicit Owner authorization of the implementation mandate`

No production, database or repository mutation beyond this documentation record is authorized by this document.

## 24. Next action

After this closure record is merged into the documentation baseline:

1. obtain Owner authorization for the canonical URL policy and SEO-01a/SEO-01b persistence split,
2. refresh repository/main/PR identities,
3. create implementation branch:
   `feat/gracz-seo-01-page-registry`,
4. implement SEO-01a only,
5. run CI/self-check,
6. perform one fresh independent review,
7. merge only after PASS and Owner decision.

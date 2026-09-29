# GRACZ.PL SEO HOMEPAGE R1 — AUDIT MANIFEST

Status: READY FOR INDEPENDENT RE-REVIEW (Correction R1: M-01 single `<main>`, M-02 semantic content parity)  
Date: 2026-09-29  
Repository: `developergracz/gracz-pl-2`  
Branch: `seo/gracz-pl-homepage-r1-20260929`  
Target: static maintenance homepage published from `maintenance-site/`

## Scope

R1 prepares the existing maintenance homepage for deliberate Google indexing without starting the application runtime or touching production data.

Production-facing R1 changes:
- `maintenance-site/index.html`
- `maintenance-site/robots.txt`
- `maintenance-site/sitemap.xml`
- remove obsolete staging artifact `maintenance-site/og-gracz-pl.jpg.b64`

Existing/generated assets used by R1:
- `maintenance-site/approved-maintenance.png` — approved visual source
- `maintenance-site/approved-maintenance.webp` — optimized page asset generated from the approved PNG; Git blob `9eef5afdc800221b288e454ed1f37f76d1b7a12d`
- `maintenance-site/og-gracz-pl.jpg` — 1200x630 Open Graph image; Git blob `af38a18eac4ca8eb0344b9f2c15f8f1f5e632e9a`

## SEO controls

- descriptive `<title>` beginning with the `Gracz.pl` brand,
- natural meta description; no `meta keywords`,
- `index,follow` plus large image/snippet directives,
- canonical URL `https://gracz.pl/`,
- `hreflang` for `pl-PL`, `pl`, and `x-default`,
- Open Graph and Twitter large-image metadata,
- `WebSite`, `Organization`, `WebPage`, and `ImageObject` JSON-LD,
- `alternateName` values `Gracz` and `gracz.pl` for the WebSite entity,
- crawlable `robots.txt`,
- one-URL XML sitemap with accurate `lastmod`,
- one canonical semantic content block (single `<main>`, one H1, three H2) describing Gracz.pl and planned product scope, visible in every presentation,
- no SEO-only hidden text and no keyword-stuffing block.

## Performance / rendering controls

- the approved desktop artwork remains visually unchanged: the first viewport is pixel-identical to the approved rendering at 1440x900, 844x390 landscape and 390x844 portrait,
- one semantic `<main>` holds both presentations as non-landmark `div` containers: `.artwork` (desktop/landscape first screen) and `.content` (canonical H1/H2 content),
- desktop and landscape show the canonical content directly below the artwork (page scrolls); portrait (≤820px) hides only the decorative artwork container and shows the same content over the artwork background,
- WebP is preferred with PNG fallback,
- hero image is preloaded and marked high fetch priority,
- explicit image dimensions remain present to limit layout shift,
- no JavaScript, API calls, forms, database access, environment variables, or production runtime activation.

## Security note

`<meta http-equiv="Content-Security-Policy">` is ignored by browsers for `frame-ancestors`; the meta directive is **not** effective clickjacking protection. Effective protection requires an HTTP response header (`Content-Security-Policy: frame-ancestors 'none'` and/or `X-Frame-Options: DENY`) at the static host. That header change is out of R1 scope and is not claimed here.

## Safety / freeze invariants

This R1 must not:
- resume the suspended production Web Service,
- enable application Auto-Deploy,
- connect to PostgreSQL,
- mutate DDL/DCL/DML,
- add secrets or `DATABASE_URL`,
- start Gracz Next runtime work,
- merge to `main` before an independent review.

## Independent review gates

Reviewer should verify:
1. HTML syntax, exactly one `<main>`, exactly one H1, and H1/H2 content reachable in desktop, landscape and portrait presentations.
2. Title/description are factual and not misleading about features still in development.
3. `robots` permits indexing and conflicts with no other noindex directive.
4. canonical/hreflang all resolve to the intended HTTPS homepage.
5. JSON-LD parses and matches visible page content.
6. OG image path exists and is exactly 1200x630.
7. WebP asset exists and PNG fallback remains available.
8. `robots.txt` references the correct sitemap.
9. `sitemap.xml` is valid XML and contains only the canonical homepage.
10. No hidden SEO-only content or keyword stuffing was introduced.
11. No runtime/database/freeze boundary was crossed.

## Post-deploy validation (only after review + merge authorization)

- `https://gracz.pl/` -> HTTP 200 and canonical HTML,
- `https://gracz.pl/robots.txt` -> HTTP 200,
- `https://gracz.pl/sitemap.xml` -> HTTP 200 XML,
- `https://gracz.pl/og-gracz-pl.jpg` -> HTTP 200 image/jpeg, 1200x630,
- Google structured-data validation,
- Search Console URL Inspection for `https://gracz.pl/`,
- submit `https://gracz.pl/sitemap.xml` in Search Console,
- request recrawl only after the production response is confirmed.

## Ranking note

R1 improves technical crawlability, relevance signals, brand/entity clarity and share previews. It cannot guarantee a #1 Google position for the generic query `gracz`; ranking also depends on content quality, authority, links, user demand, competition, and time.

# GRACZ-SEO-01 — Acceptance Matrix

Status: `CANONICAL REQUIREMENT-TO-GATE MAP`

## 1. Purpose

This matrix prevents future sessions from declaring a phase complete without proving the required behavior.

Legend:
- `U` unit
- `C` contract
- `I` integration
- `E2E` end-to-end
- `B` browser/render
- `S` security
- `R` independent review

## 2. Cross-cutting acceptance

| ID | Requirement | Phase | Evidence |
|---|---|---|---|
| AC-001 | Repository/source identity locked before gate | all | R |
| AC-002 | No production action without explicit authorization | all | audit record |
| AC-003 | Public page runtime independent from external SEO providers | SEO-02/07 | I,E2E |
| AC-004 | Every SEO mutation audited | SEO-01/08 | I,E2E |
| AC-005 | Dangerous policy requires elevated approval | SEO-03/08 | S,E2E |
| AC-006 | Secrets absent from repo/log/UI | SEO-07 | S,CI |
| AC-007 | Provider/crawl evidence carries timestamps/source | SEO-04/07 | U,I |
| AC-008 | Rollback exists for versioned SEO configuration | SEO-08/10 | E2E |
| AC-009 | No mass AI auto-publish path | SEO-05 | code review,S |
| AC-010 | No hidden SEO text/link generation | SEO-02/06 | B,R |

## 3. SEO-00

| ID | Requirement | PASS evidence |
|---|---|---|
| AC-0001 | Current routes/page templates inventoried | file/path evidence |
| AC-0002 | Current SEO mechanisms inventoried | repo evidence |
| AC-0003 | Admin/RBAC mapped | code/config evidence |
| AC-0004 | DB migration mechanism mapped | repo evidence |
| AC-0005 | scheduler/jobs mapped | repo evidence |
| AC-0006 | environments/production host documented | fresh evidence |
| AC-0007 | baseline robots/sitemap/indexability captured | fresh HTTP/repo evidence |
| AC-0008 | implementation package locations decided | design record |

## 4. SEO-01 Registry

| ID | Requirement | Test |
|---|---|---|
| AC-0101 | URL normalization deterministic | U |
| AC-0102 | normalization idempotent | U/property |
| AC-0103 | environment separation | I |
| AC-0104 | registry reconciliation repeatable | I |
| AC-0105 | lifecycle/index policy represented | U/I |
| AC-0106 | registry cannot silently delete pages | I |
| AC-0107 | audit base exists | I |

## 5. SEO-02 Metadata/Schema

| ID | Requirement | Test |
|---|---|---|
| AC-0201 | one deterministic metadata output per approved input | U |
| AC-0202 | canonical rules tested | U |
| AC-0203 | hreflang consistency | U |
| AC-0204 | OG/Twitter complete on supported page types | U,golden |
| AC-0205 | JSON-LD parses | U |
| AC-0206 | @id refs resolve | U |
| AC-0207 | schema matches visible content | fixture/R |
| AC-0208 | no SEO-only hidden content | B |
| AC-0209 | existing public rendering shadow diff understood | B/R |

## 6. SEO-03 Robots/Sitemap

| ID | Requirement | Test |
|---|---|---|
| AC-0301 | robots deterministic | golden |
| AC-0302 | global production block detected as dangerous | U/S |
| AC-0303 | sitemap valid XML | U |
| AC-0304 | only eligible canonical URLs included | U/I |
| AC-0305 | lastmod uses meaningful provenance | U/I |
| AC-0306 | candidate generation separated from publication | I/E2E |
| AC-0307 | publish action approval-gated | S/E2E |

## 7. SEO-04 Crawl/Issues

| ID | Requirement | Test |
|---|---|---|
| AC-0401 | crawler host allowlist | S |
| AC-0402 | redirect destination revalidated | S |
| AC-0403 | private/local targets rejected | S |
| AC-0404 | timeout/body/concurrency bounded | I/S |
| AC-0405 | HTML extraction deterministic | fixture |
| AC-0406 | indexability evaluator evidence-backed | U/I |
| AC-0407 | issue upsert idempotent | I |
| AC-0408 | fixed issue reopens on recurrence | I |
| AC-0409 | public site survives crawler failure | architecture/I |

## 8. SEO-05 Keyword/Content

| ID | Requirement | Test |
|---|---|---|
| AC-0501 | raw and normalized keyword retained | U/I |
| AC-0502 | cluster review state exists | I |
| AC-0503 | one primary target invariant | I |
| AC-0504 | target history retained | I |
| AC-0505 | cannibalization includes evidence | U/I |
| AC-0506 | brief contains intent/evidence/risk | U/E2E |
| AC-0507 | AI output marked draft | I |
| AC-0508 | AI cannot publish directly | S/E2E |

## 9. SEO-06 Internal Links

| ID | Requirement | Test |
|---|---|---|
| AC-0601 | directed graph extracted | I |
| AC-0602 | orphan detection excludes configured exceptions | U/I |
| AC-0603 | broken/redirect link detection | I |
| AC-0604 | recommendation rationale/score components visible | U/E2E |
| AC-0605 | exact-match spam guard | U/R |
| AC-0606 | default mutation mode disabled | S |
| AC-0607 | applied link verified by recrawl | E2E |

## 10. SEO-07 Search Console

| ID | Requirement | Test |
|---|---|---|
| AC-0701 | secret only in approved secret store | S |
| AC-0702 | property/environment mapping explicit | I |
| AC-0703 | paginated import complete/partial explicit | C/I |
| AC-0704 | upsert idempotent | I |
| AC-0705 | provider freshness shown | E2E |
| AC-0706 | missing provider fields become UNKNOWN | C/U |
| AC-0707 | provider outage cannot affect public runtime | I |
| AC-0708 | sitemap submission explicit/audited | S/E2E |
| AC-0709 | no user-profile join | review/data test |

## 11. SEO-08 Admin

| ID | Requirement | Test |
|---|---|---|
| AC-0801 | Viewer read-only | S/E2E |
| AC-0802 | Editor cannot global-robots mutate | S/E2E |
| AC-0803 | Owner dangerous action path | S/E2E |
| AC-0804 | diff/preview before activation | E2E |
| AC-0805 | audit event after activation | I/E2E |
| AC-0806 | rollback | E2E |
| AC-0807 | critical mobile approval flow usable | B |
| AC-0808 | accessibility basics pass | B/a11y |

## 12. SEO-09 Alerts/Opportunities

| ID | Requirement | Test |
|---|---|---|
| AC-0901 | trend windows use complete data | U |
| AC-0902 | minimum-volume guard | U |
| AC-0903 | alert dedupe/cooldown | U/I |
| AC-0904 | stale provider data does not trigger false normal comparison | U |
| AC-0905 | opportunity score components explainable | U/E2E |
| AC-0906 | no ranking guarantee language | R |

## 13. SEO-10 Production rollout

| ID | Requirement | PASS evidence |
|---|---|---|
| AC-1001 | baseline captured | evidence pack |
| AC-1002 | Owner rollout authorization | record |
| AC-1003 | rollback tested | E2E/runbook |
| AC-1004 | canary pages pass | live smoke |
| AC-1005 | no accidental noindex/robots/canonical regression | live smoke |
| AC-1006 | schema parses in production response | live evidence |
| AC-1007 | key responsive semantic content reachable | B |
| AC-1008 | sitemap/robots public endpoints correct | HTTP evidence |
| AC-1009 | monitoring/alerts active | operations evidence |
| AC-1010 | fresh independent final review | R |

## 14. Final system completion

GRACZ-SEO-01 may be marked `IMPLEMENTED / OPERATIONAL` only when SEO-00 through required SEO-10 gates are closed and production evidence exists.

Documentation completeness alone never equals operational readiness.

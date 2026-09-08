# GRACZ.PL — PRODUCT / UX / SEO / DOMAINS MASTER

**Status:** LIVING CONSOLIDATION

## 1. Purpose

This volume captures user-facing product requirements and web-presence dependencies so that technical correctness and production readiness are not documented separately from actual user experience.

## 2. Product surfaces

Final documentation should cover at least:

- homepage,
- registration/login,
- profiles,
- game chooser,
- rooms/players,
- invitations,
- Checkers,
- Gomoku,
- future Thousand,
- messaging/chat,
- rankings/tournaments,
- Owner/Admin surfaces,
- maintenance mode.

## 3. UX requirements

Every primary user journey should be documented with:

- entry point,
- authenticated/guest state,
- expected success path,
- validation/errors,
- loading/reconnect state,
- mobile/responsive behavior,
- accessibility expectations,
- analytics/observability events where applicable.

## 4. Mobile and responsive behavior

Release-grade evidence should explicitly test:

- common phone widths,
- tablet widths,
- desktop,
- portrait/landscape,
- touch interaction,
- virtual keyboard interaction,
- game-board scaling,
- chat/side-panel layout,
- fullscreen behavior.

## 5. Accessibility

Target documentation should track:

- keyboard access,
- focus order,
- labels/ARIA where needed,
- contrast,
- text scaling,
- screen-reader semantics for critical flows,
- non-color-only status indicators.

## 6. SEO

SEO documentation should distinguish:

- design/metadata prepared,
- code merged,
- deployed state,
- indexing allowed/blocked,
- sitemap/robots state,
- Google Search Console verification/evidence.

Historical or draft SEO PRs must not be described as deployed merely because their code exists.

## 7. Domains and DNS

The master package should record, when verified:

- primary domain ownership/use,
- DNS provider,
- nameservers,
- TLS/certificate ownership,
- subdomain/service mapping,
- redirect/canonical rules,
- maintenance fallback,
- Cloudflare-specific dependencies if used.

Any DNS/Cloudflare change is operational and requires separate authorization; documentation work alone must not modify it.

## 8. Brand and visual continuity

User-facing documentation should preserve agreed brand rules for `gracz.pl`, including logo/wordmark decisions, layout principles and consistent game-console behavior.

## 9. Future FairPlay UX

FairPlay MAX adds user-facing surfaces that must eventually be designed and tested:

- FairPlay status indicator,
- Verify Hand / Verify Deal,
- proof download/export if adopted,
- understandable explanation of commitments/proofs,
- clear distinction between cryptographic verifiability and formal external certification.

## 10. Current status

```text
PRODUCT/UX MASTER = LIVING
SEO / DOMAIN STATE = MUST BE VERIFIED AT RELEASE GATE
MOBILE / ACCESSIBILITY FULL EVIDENCE = NOT YET COMPLETE
FAIRPLAY UX = PRE-DESIGN ONLY
NO DNS / CLOUDFLARE / DEPLOY CHANGE AUTHORIZED
```

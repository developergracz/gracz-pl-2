# Newsletter Admin R1 implementation plan

Mandate: issue #247 Owner decision 2026-10-15; isolated synthetic implementation now, authentication remains HOLD. Base bfbd5da5acd088430c2c3cb9d9b9fbc653bad30e.

1. Add tests and isolated `contact-api/admin-r1/` read-only provider/service modules. Inject transport; no default network client or environment configuration. Bound page size, provider calls, response size, timeout, cursors and handles. Never infer suppression or global counts. Use HMAC-only consent lookup and allowlisted evidence. Add permanently denied HTTP handler without an enable switch.
2. Add Polish HTML/CSS/JS in the private module, outside published site roots. A separate loopback-only synthetic harness exercises list, filters, pagination, details, failures and dashboard. Never wire into server.mjs or hosting.
3. Run new unit/HTTP tests through existing contact-api test glob, full backend regression and browser tests. Cover false-active classification, malformed pages, cursor scope/expiry, provider failure and PII leakage. Document A01–A16 honestly; authentication/session/DR remain HOLD.
4. Record concrete security proposal and overlap inventory; commit, push only new branch, create draft PR and inspect exact-head CI. No merge/deploy.

Interfaces: adapter.readPage({after,limit}) returns normalized contacts and provider cursor; service.list({cursor,query,state}) returns opaque handles and cursor, page-scoped counts, nullable global counts and quality; service.detail(handle) returns minimized consent. Production handler always denies; test harness exclusively owns synthetic routing.

Review focus: missing suppression proof; provider truncation and repeated cursor; expired/mismatched cursors; provider failures after prior success; raw error/consent metadata leaking into UI/logs.

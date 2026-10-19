# Newsletter #280: Option B containment and recovery design

Binding authority: issue #280, Owner-approved Option B at #279 decision SHA
c754e9a80d7a10484145d8556dae3b89e1b57fc5. Base main independently checked via
GitHub: 2e12e4d742db51b17e45e02013b538d69bfae933.

## Deliverable and limit

Implement defensible offline containment and future purpose-key primitives; keep
recovery activation HARD HOLD. This is deliberately not a working mailbox recovery
service. No reliable restricted mapping evidence source or operational withdrawal
service is supplied. Do not replace these with a caller-provided `verified: true`.
No new active identities, aliases, challenges or consent are written by this draft.
The detailed schema/transaction and operational plan is in
`contact-api/operations/NEWSLETTER_OPTION_B_280.md`.

Runtime: replace the server's newsletter manager with an inert held manager. It
accepts no key, store or provider dependency; readiness is always false. All old
and new newsletter actions fail before any ledger/provider work. Existing legacy
manager remains solely for characterization/regression and must not be imported by
business server. Keep CONTACT encryption and maintenance build/start unchanged.

UI: permanently reject n1/ns1 fragments before action rendering, discard token,
never POST them even after readiness or history navigation. Intake remains governed
by existing false readiness; preserve the Premium footer. Ordinary pause and token
revocation are distinct: future nonlegacy action behavior stays tested with
synthetic nonlegacy tokens. Resolve the outdated maintenance assertion by testing
revocation behavior, not removing the protection.

Crypto: offline n2 envelopes bind exact key ID, purpose, audience, version and
issued/expiry times using AES-256-GCM and random 96-bit nonce. Independent 32-byte
keys for confirm, unsubscribe, status and identity; prohibit key-byte reuse. Only
active keys can issue or verify in this conservative first implementation; retired,
compromised, unknown and missing keys fail closed. HMAC identity has a versioned
namespace and preserves current email canonicalization. No real material and no
runtime configuration wiring. Proof of possession is never proof of consent or
legacy mapping. Token replay requires the future durable challenge ledger.

Immutable legacy data: no SQL migration or historical modification. Tests seed
2 contacts/32 events/1 confirmation on disposable PG16/18 and compare complete
snapshots, including registry, reservations, proof and cutover state, around held
operations. Existing crash/replay/concurrency suites remain authoritative for the
legacy fences, not evidence of a finished recovery engine.

Acceptance: backend, maintenance/Premium, browser/security/SEO, PG16/18, independent
exact-HEAD review, DRAFT PR with explicit unimplemented items and activation gates.
NO MERGE / NO DEPLOY / NO PRODUCTION MUTATIONS / NO REAL EMAIL SENDS.

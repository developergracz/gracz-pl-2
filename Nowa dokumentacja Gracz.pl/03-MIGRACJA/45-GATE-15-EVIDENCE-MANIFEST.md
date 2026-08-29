# ETAP 3 — Gate 15: Final Evidence Manifest

Data: 29.08.2026  
Status: **BASELINE FOR ETAP 4 / PRODUCTION NO-GO**

## 1. Purpose

Ten manifest zamraża najważniejsze identyfikatory evidence, które ETAP 4 ma używać jako baseline do fresh reconciliation.

Nie zawiera sekretów ani danych osobowych.

## 2. Gate 14A code package

Repository:

`developergracz/gracz-pl-2`

Branch:

`audit/gate14a2-runtime-ddl-separation`

Head SHA:

`cb073bad3050ffc9726e0a1528c2ec4a4808f12e`

PR:

`#26 Gate 14A — Runtime DDL separation`

State at Gate 15:

- OPEN,
- DRAFT,
- NOT MERGED,
- mergeable=true.

Base branch:

`feature/homepage-game-center`

Base SHA recorded by PR:

`3dfb9ab9f1e069afc831d44b81e020c04c9a3466`

## 3. Final CI for Gate 14A head

### CheckersEngine

Run:

`33226265016`

Conclusion:

`success`

Recorded final result:

- tests 127,
- pass 127,
- fail 0,
- production dependency audit 0 vulnerabilities,
- browser journeys PASS.

### Security Gate

Run:

`33226264999`

Conclusion:

`success`

Recorded jobs:

- node-security `99030520357` SUCCESS,
- gitleaks `99030520499` SUCCESS,
- CodeQL `99030520433` SUCCESS.

## 4. Last fresh Gate 14 AS-IS runtime baseline

Capture timestamp:

`2026-08-29T00:40:12.972Z`

Database:

`gracz_pl_database`

Current user:

`gracz_pl_database_user`

PostgreSQL:

`18.4`

Workflow run:

`33222770175`

Job:

`99024402951`

Artifact:

`9706264073`

Artifact ZIP SHA256:

`14b5f14a05c2c5cbc5cfccf8bb617e207f15224084eb503511b5098965cd2366`

Collector properties:

- PASS-COLLECTOR,
- readOnly=true,
- normalApplicationStarted=false.

Important AS-IS blockers from this baseline:

- runtime role `CREATEDB=1`,
- runtime role `CREATEROLE=1`,
- database owner=true,
- public schema CREATE=true,
- 28/28 public tables owned,
- broad table DML + TRUNCATE/REFERENCES/TRIGGER,
- 8/8 sequences owned with USAGE/SELECT/UPDATE,
- dedicated message/attachment/MFA encryption keys absent,
- `NODE_ENV=production` false,
- `TURNSTILE_HOSTNAME` absent,
- explicit `PUBLIC_BASE_URL` absent,
- Turnstile pair complete,
- Resend key present,
- explicit mail sender present,
- Twilio fully disabled, not partial.

## 5. Gate 12 baseline

Final reconciliation run:

`33222059359`

Job:

`99017995909`

Capture:

`2026-08-28T23:58:14.581Z`

Artifact:

`9705540577`

Artifact ZIP SHA256:

`e12d1205a1104d747f8fa8190e6bfb092410441644b8800c38127188aa792195`

Decision:

PASS.

## 6. Gate 13 baseline

Fresh capture:

`2026-08-29T00:11:17.199Z`

Run:

`33222770175`

Job:

`99020147640`

Artifact:

`9705768051`

Decision:

PASS — PRE-CUTOVER READINESS.

ETAP 4 must NOT assume this state remained unchanged. It must execute fresh Gate 13 before mutations.

## 7. Gate 11 crypto baseline

Confirmed decryptability:

- private messages: 5/5,
- attachments: 2/2,
- MFA rows: 0.

Restore-side ciphertext SHA fingerprints recorded:

- messages: `b2c671d29bbe99956e054c71f747e72cff1ff71ef239f25c5aa14b07b49db31c`,
- attachments: `730fabeada8cfdf02ee0421d8abb31b8ef1f68554c14dc90e9c9bd1b03dda327`.

Caveat:

Exact original-runtime-vs-restore ciphertext SHA identity was not independently closed in Gate 11. ETAP 4 / final production GO evidence must not claim this as proven unless fresh exact comparison is collected.

## 8. Design package commits on main

### Gate 14B

- `32-GATE-14B-LEAST-PRIVILEGE-ROLE-DESIGN.md` — `14d35dc3e2fe876b4d6c835d7ecf44e72650faaf`
- `33-GATE-14B-ROLE-PROVISIONING-AND-ACL-TEMPLATE.sql` — `dcb3d592ce5eb75879077517030a9e862dee5d0b`
- `34-GATE-14B-LEAST-PRIVILEGE-READONLY-VERIFIER.sql` final update — `bb0cc344705bd5afe2692c8cfb95248394abbc5f`

### Gate 14C

- `35-GATE-14C-CRYPTO-KEYRING-V1-V2-DESIGN.md` — `a785ba3bfd063a452b543af5be5019ffeccb396a`
- `36-GATE-14C-PROPOSED-MIGRATION-015-CRYPTO-KEY-VERSIONS.sql` — `dff18ea0782b29e0b4ce55be6609ff963bc6c3e7`
- `37-GATE-14C-CRYPTO-VERSION-READONLY-VERIFIER.sql` — `bf389183b6033e0ef0a5cd73a9e52325c7b2b5ec`
- `38-GATE-14C-REKEY-RUNBOOK-AND-PASS-CRITERIA.md` — `c0201d7fab79f37ae903c2e862d70ac85e7e1423`

### Gate 14D

- `39-GATE-14D-PRODUCTION-SECURITY-CONFIG-DESIGN.md` — `c96fccf58da3ebe50247c3274731a77dd19a4758`
- `40-GATE-14D-PRODUCTION-ENV-CONTRACT.md` — `e78b50ea182ac6e97649af11e39a534130509200`
- `41-GATE-14D-READONLY-ENV-VERIFIER.mjs` — `d6ade414011b757f3418cac641ebeb854bd2e38c`
- `42-GATE-14D-APPLIED-PASS-AND-CUTOVER-CHECKLIST.md` — `42cde4d0bc850d41a5cad1296b4436c07b2a2784`

### Gate 15

- `43-GATE-15-FINAL-GO-NO-GO-DECISION.md` — `ba03ee6bd0029f6b583c6a4c5c10cfb84590c942`
- `44-GATE-15-ETAP4-ENTRY-CONTRACT.md` — `6ec4570cd4431ad5cc48280e6b0433c3341b5c49`

## 9. Reconciliation rules for ETAP 4

ETAP 4 must treat any divergence from this manifest as a review event.

Examples:

- PR head SHA changed,
- migration checksum changed,
- production DB role changed unexpectedly,
- active-state counts changed,
- crypto counts changed,
- new unknown public table/sequence exists,
- environment/provider state changed,
- CI exact target SHA differs.

Divergence does not automatically mean failure, but it requires fresh evidence and an explicit documented decision before proceeding.

## 10. Final baseline status

**ETAP 3 preflight/readiness package is complete.**

**ETAP 4 may start under the controlled entry contract.**

**Production V3 remains NO-GO.**

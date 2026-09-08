# GRACZ.PL — P8 / P1-U-01 — POST-AUDIT DECISION TEMPLATE

**Status:** READY FOR USE AFTER CLAUDE REPORT  
**Purpose:** deterministic Lead/Owner decision path after independent P8 audit  
**Repository:** `developergracz/gracz-pl-2`  
**PR:** `#43`  
**Expected audited HEAD:** `d7220f57d60779584048cc5c695d40dbb948b9cb`  
**Merge / deploy authorization:** NONE

---

## 1. Non-negotiable rule

Claude's verdict is an independent technical input, not an automatic merge command.

Required sequence:

`CLAUDE -> TOM 18 REGISTRATION -> LEAD VERIFICATION -> CORRECTION/NO-CORRECTION DECISION -> OWNER+LEAD MERGE GATE`

No code correction is authorized merely because Claude reports a finding.

---

## 2. Identity gate

Before using the audit result, verify:

```text
AUDITED REPOSITORY = developergracz/gracz-pl-2
AUDITED PR = #43
AUDITED BASE = ad0739190fe2f9d1657b2b77c8b5f8e825830c08
AUDITED HEAD = d7220f57d60779584048cc5c695d40dbb948b9cb
AUDITED TREE = 4cbb8504036d26ed2e257f52a475968f5d4cd827
```

If any identity differs, status becomes:

`AUDIT NOT APPLICABLE TO AUTHORIZED P8 SNAPSHOT — RECHECK REQUIRED`.

Do not merge from a mismatched audit.

---

# 3. PATH A — CLAUDE VERDICT: PASS

If Claude ends exactly:

`P8 / P1-U-01 — PASS`

perform:

1. store the complete report as audit evidence,
2. verify that no hidden findings/conditions exist in the body,
3. Lead independently checks the audited HEAD, diff and final CI evidence,
4. register audit result in Evidence Register and Implementation/Audit Register,
5. update TOM 18 with `NO P8 FINDINGS` rather than inventing finding IDs,
6. verify PR #43 remains on exact audited HEAD,
7. verify required CI/checks still pass for that head,
8. issue a separate Lead recommendation:
   `P8 TECHNICAL MERGE READINESS = PASS`,
9. request/record explicit Owner merge authorization,
10. only after Owner + Lead authorization may the exact PR be merged,
11. after merge, capture exact merge SHA/TREE and new main,
12. run/check required post-merge validation,
13. mark P8 `MERGED / CLOSED` only after those gates complete.

A Claude PASS by itself does **not** equal `MERGE AUTHORIZED`.

---

# 4. PATH B — PASS WITH NON-BLOCKING FINDINGS

If Claude ends exactly:

`P8 / P1-U-01 — PASS WITH NON-BLOCKING FINDINGS`

perform:

1. register every finding in TOM 18 as `P8-AUD-Fxx`,
2. preserve Claude's original severity and merge-blocking classification,
3. Lead verifies every finding independently,
4. for each finding assign Lead decision:
   - `ACCEPTED`,
   - `REJECTED`,
   - `SEVERITY CHANGED`,
   - `DUPLICATE`,
   - `DEFERRED`,
   - `NEEDS EVIDENCE`,
   - `RISK ACCEPTED` only with explicit rationale,
5. confirm that no accepted finding is actually merge-blocking,
6. decide whether non-blocking correction is:
   - required before merge,
   - permitted after merge as bounded backlog,
   - documentation-only,
7. if any correction changes the P8 HEAD, Claude's audit no longer automatically covers the new head; determine whether focused re-audit is required,
8. only after Lead final readiness decision may Owner be asked for merge authorization.

If Lead reclassifies any accepted issue as blocking, follow PATH C.

---

# 5. PATH C — FAIL / CORRECTION REQUIRED

If Claude ends exactly:

`P8 / P1-U-01 — FAIL — CORRECTION REQUIRED`

perform:

1. `MERGE = HOLD`,
2. register every finding in TOM 18,
3. Lead verifies each finding against exact code/evidence,
4. reject unsupported findings with explicit rationale; do not implement them blindly,
5. group accepted blocking findings into the smallest safe correction scope,
6. Lead writes a bounded correction mandate for GPT-2,
7. correction branch must preserve P8 scope and start from the authorized P8 lineage/base chosen by Lead,
8. no unrelated refactor, feature expansion, migration or production change,
9. implementation engineer reports exact branch/HEAD/TREE/diff/tests,
10. run focused P8 tests plus all affected regressions and security gates,
11. Lead reviews exact corrected head,
12. required independent re-audit is performed on the corrected head,
13. repeat until all blocking findings are closed,
14. only then return to PATH A or B merge-readiness procedure.

---

# 6. Finding decision worksheet

For each `P8-AUD-Fxx`:

```text
FINDING ID:
CLAUDE SEVERITY:
CLAUDE MERGE BLOCKING:
CLAUDE LOCATION:
CLAUDE CLAIM:

LEAD EVIDENCE CHECK:
LEAD DECISION:
LEAD FINAL SEVERITY:
LEAD MERGE BLOCKING:
ROOT CAUSE:
CORRECTION REQUIRED: YES/NO
CORRECTION SCOPE:
TESTS REQUIRED:
RE-AUDIT REQUIRED: YES/NO
RESIDUAL RISK:
TOM 18 STATUS:
```

---

# 7. Merge-readiness checklist

Before Lead may recommend merge, all must be true:

- [ ] Claude audit applies to exact intended snapshot or corrected snapshot,
- [ ] all audit findings are in TOM 18,
- [ ] Lead has verified every finding,
- [ ] zero accepted blocking findings remain open,
- [ ] exact-head CI is green,
- [ ] P8 focused tests pass,
- [ ] Checkers regression passes,
- [ ] Gomoku regression passes,
- [ ] Thousand regression passes,
- [ ] tournament concurrency regression passes,
- [ ] P5/P6/P7 regressions pass,
- [ ] browser regression passes,
- [ ] DR regression passes where required,
- [ ] npm audit/security gates pass,
- [ ] gitleaks passes,
- [ ] CodeQL passes,
- [ ] diff remains inside authorized P8 scope,
- [ ] no migration/deploy/production changes were introduced,
- [ ] Owner authorization is still separate and pending until explicitly given.

---

# 8. Post-merge capture

If Owner + Lead later authorize merge and it occurs, record:

```text
PR #43 MERGE TIME:
FINAL PR HEAD:
FINAL PR TREE:
MERGE COMMIT SHA:
MERGED MAIN SHA:
MERGED MAIN TREE:
GITHUB MERGE STATUS:
POST-MERGE CHECKS:
DEPLOY = NO unless separately authorized
PRODUCTION MIGRATION = NO unless separately authorized
```

Then update:

- Evidence Register,
- Implementation/Audit Register,
- Requirements Traceability Matrix,
- Findings/Remediation Register,
- ADR if architecture state changed,
- append-only project journal,
- FULL MAX index/checkpoint.

---

# 9. Next gate after P8 closure

Only after formal P8 closure:

`FULL PROJECT TECHNICAL AUDIT`

using:

- `45-FULL-AUDIT-PLAN-AND-CHECKLIST.md`,
- `46-FULL-AUDIT-EVIDENCE-MANIFEST.md`,
- `31-THREAT-CONTROL-TEST-MATRIX.md`,
- TOM 18 for all `FULL-AUD-Fxxx` findings.

FairPlay MAX implementation remains unauthorized until the full-project audit and controlled remediation establish a clean foundation.
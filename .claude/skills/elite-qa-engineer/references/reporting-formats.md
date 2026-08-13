# Reporting Formats, Classification, and Release Decisions

## Table of Contents

1. Evidence Collection Protocol
2. Bug Classification
3. Severity Rules
4. Priority Rules
5. Bug Report Format (required)
6. Test Case Format (required)
7. Coverage Matrix (required)
8. Auditable Deliverables
9. QA Report Format (required)
10. Release Readiness Decision Model

---

## 1. Evidence Collection Protocol

For every bug, collect evidence when possible: screenshot, screen recording, console error, network request, API response, URL, browser, viewport size, user role, test data, timestamp, build/version.

Never report a vague bug. Every bug must be reproducible or clearly marked as intermittent. A bug is only "confirmed" after being reproduced twice; otherwise report it as "Observed once — needs confirmation."

Every finding must carry an evidence tag: **[Verified]** (directly observed with evidence), **[Inferred]** (logical conclusion, never counts as tested), or **[Untested]** (in scope, not executed, reason given). Never fabricate evidence — if it could not be captured, say so.

---

## 2. Bug Classification

Classify every issue by type: Functional Bug, Validation Bug, UI Bug, UX Issue, Accessibility Issue, Performance Issue, Compatibility Issue, Security Concern, Data Issue, Permission Issue, Content/Text Issue, API/Response Issue, Regression Bug.

---

## 3. Severity Rules

**Critical** — main system unusable; login broken; data loss; payment/financial feature broken; security or privacy risk; admin cannot complete core work; application crashes.

**High** — major feature fails; user cannot complete an important workflow; incorrect data is saved; permission behavior is wrong; no reasonable workaround.

**Medium** — feature partially works; validation is incorrect; UX causes confusion; a workaround exists; non-critical workflow affected.

**Low** — minor issue; edge case; small inconvenience; rare scenario.

**Cosmetic** — alignment, spacing, font, or color inconsistency; minor design mismatch.

---

## 4. Priority Rules

- **P1** — fix immediately; release blocker.
- **P2** — fix before release if possible.
- **P3** — fix in an upcoming sprint.
- **P4** — nice-to-have improvement.

---

## 5. Bug Report Format

Every bug must follow this exact format:

```
## Bug Title
Clear one-line summary.

## Bug ID
BUG-001, BUG-002, BUG-003, ...

## Module/Page
Exact module, page, or feature.

## Bug Type
Functional, UI, UX, Validation, Accessibility, Security Concern,
Performance, Permission, API, or Data.

## Severity
Critical, High, Medium, Low, or Cosmetic.

## Priority
P1, P2, P3, or P4.

## Environment
- URL:
- Browser:
- Device:
- Screen size:
- User role:
- Build/version:

## Preconditions
Required login, data, role, or setup.

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Test Data Used
Exact test input.

## Actual Result
What happened.

## Expected Result
What should happen.

## Reproducibility
Always, Sometimes, Once, or Not Reproducible.

## Evidence
Screenshot, console log, network response, or observation.

## Suggested Fix
Brief recommendation.
```

---

## 6. Test Case Format

When creating test cases, use this format:

```
## Test Case ID
TC-001

## Module
Module name.

## Scenario
What is being tested.

## Test Type
Positive, Negative, Boundary, Regression, UI, Accessibility, etc.

## Preconditions
Required setup.

## Test Steps
1. Step one
2. Step two
3. Step three

## Test Data
Input data.

## Expected Result
Expected behavior.

## Actual Result
Observed behavior.

## Status
Pass, Fail, Blocked, Not Tested, or Needs Retest.

## Notes
Extra observations.
```

---

## 7. Coverage Matrix

Maintain this matrix *during* testing — fill each cell as the test happens, not from memory afterward. Include it in every QA report. Blank cells must be reported as Untested, never dropped.

Rows = features/modules. Columns = test types applied. Cell values: ✅ Pass, ❌ Fail, ⛔ Blocked, ⬜ Untested, 🔁 Needs Retest.

```
| Feature      | Functional | Negative | Boundary | UI | Responsive | A11y | Permissions |
|--------------|-----------|----------|----------|----|-----------|------|-------------|
| Login        | ✅        | ✅       | ✅       | ✅ | ⬜        | ✅   | n/a         |
| User CRUD    | ❌ BUG-002| ✅       | ⬜       | ✅ | ⬜        | ⬜   | ✅          |
| Reports      | ⬜        | ⬜       | ⬜       | ⬜ | ⬜        | ⬜   | ⬜          |
```

Failed cells reference the bug ID. The matrix is the single source of truth for what was and was not tested.

---

## 8. Auditable Deliverables

When file creation is available, produce alongside the report:

1. **Test case spreadsheet (.xlsx or .csv)** — one row per executed test case: TC ID, module, scenario, test type, test data, expected result, actual result, evidence tag, status, linked bug ID.
2. **Bug list (.csv)** — one row per bug: Bug ID, title, module, type, severity, priority, reproducibility, linked TC ID, status.

Traceability is required in both directions: every Fail in the test sheet links to a bug ID; every bug links back to the test case that found it (BUG-003 ← TC-017). This lets a human re-run any specific case and audit any finding.

---

## 9. QA Report Format

At the end of testing, generate this report:

```
# QA Test Report

## 1. Executive Summary
Overall quality, tested scope, major risks, release recommendation.

## 2. Test Scope
Tested pages, modules, workflows, and roles.

## 3. Out of Scope
What was not tested.

## 4. Test Environment
URL, browser, device, screen size, user role, build/version, date tested.

## 5. Testing Types Performed
Black-box, functional, positive, negative, boundary value analysis,
equivalence partitioning, exploratory, smoke, sanity, regression,
UI/UX, accessibility, responsive, compatibility, CRUD,
role-based access testing.

## 6. Feature Coverage
The completed Coverage Matrix (see section 7). Each tested feature
with status: Passed, Failed, Blocked, Not Tested, or Needs Retest.
Every finding carries its [Verified]/[Inferred]/[Untested] tag.

## 7. Passed Scenarios
Important scenarios that worked correctly.

## 8. Failed Scenarios
Scenarios that failed.

## 9. Bugs Found
Detailed bug reports (see Bug Report Format).

## 10. UI/UX Observations
Design, spacing, alignment, responsiveness, readability, usability.

## 11. Accessibility Observations
Keyboard, focus, contrast, labels, screen-reader concerns.

## 12. What I Did NOT Test and Why
Mandatory. Explicit list of untested areas, skipped scenarios,
and blocked items, each with the reason. Never omit this section.

## 13. Risk Areas
Features needing deeper testing.

## 14. Recommendations
Improvements for product, development, design, validation,
accessibility, and release readiness.

## 15. Final QA Status
Passed | Passed with Minor Issues | Failed | Blocked |
Needs Retesting | Not Ready for Release | Ready for Release
```

---

## 10. Release Readiness Decision Model

- **Ready for Release** — no Critical or High bugs; only minor Low/Cosmetic issues remain.
- **Passed with Minor Issues** — no release blockers, but some Low/Medium issues exist.
- **Needs Retesting** — fixes were made but not yet verified.
- **Not Ready for Release** — Critical or High bugs exist.
- **Blocked** — testing cannot continue due to environment, login, missing data, or system failure.

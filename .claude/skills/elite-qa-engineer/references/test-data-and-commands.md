# Test Data Bank and Browser-Agent Command Set

## Table of Contents

1. Default Test Data Bank
2. Browser Agent Command Set
3. QA Terminology Dictionary

---

## 1. Default Test Data Bank

Use this test data where relevant.

### Valid User

- Name: Test User
- Email: test.user@example.com
- Phone: +923001234567
- Password: Test@12345

### Invalid Emails

- test
- test@
- @example.com
- test..user@example.com
- test user@example.com

### Invalid Names

- Empty value
- One character
- 256 characters
- Numbers only
- Special characters only
- Spaces only

### Boundary Text

- 1 character
- Minimum allowed value
- Maximum allowed value
- One above maximum
- Very long paragraph

### Special Inputs

- Leading space
- Trailing space
- Multiple spaces
- Emoji
- HTML-like text
- SQL-like text for safe validation checking only
- Copy-pasted formatted text

---

## 2. Browser Agent Command Set

When acting as a browser QA agent, follow these internal routines. Each command defines what to do and what structured output to record.

### SCAN_PAGE

Identify all visible elements and classify them.
Output: page name, URL, buttons, links, forms, tables, modals, navigation items, risk areas.

### TEST_NAVIGATION

Click and verify all navigation paths.
Output per item: navigation item, expected page, actual page, status, issue if any.

### TEST_FORM

Test every field using valid, invalid, empty, boundary, and duplicate data.
Output per field: field name, input type, test data, expected validation, actual result, status.

### TEST_BUTTONS

Test all buttons and clickable elements.
Output per button: button name, action expected, action observed, status, issue if any.

### TEST_UI_LAYOUT

Inspect visual quality.
Output: alignment issues, spacing issues, color issues, text issues, responsive issues.

### TEST_TABLE

Test table search, filter, sort, pagination, row actions, and empty state.
Output per feature: feature, expected result, actual result, status.

### TEST_ACCESSIBILITY

Check keyboard, focus, labels, contrast, and accessibility basics.
Output per item: accessibility item, status, issue, recommendation.

### GENERATE_BUG_REPORT

Convert every failure into a professional bug report (see `reporting-formats.md`).

### GENERATE_QA_REPORT

Generate the final QA report with summary, coverage, bugs, risks, and release status (see `reporting-formats.md`).

---

## 3. QA Terminology Dictionary

Understand and use these terms correctly:

Test Plan, Test Strategy, Test Scenario, Test Case, Test Suite, Test Data, Test Execution, Test Coverage, Defect, Bug, Defect Lifecycle, Severity, Priority, Reproducibility, Actual Result, Expected Result, Acceptance Criteria, Traceability, Regression, Smoke Test, Sanity Test, Exploratory Testing, Black-Box Testing, White-Box Testing, Grey-Box Testing, Functional Testing, Non-Functional Testing, Boundary Value Analysis, Equivalence Partitioning, Positive Testing, Negative Testing, Edge Case, Corner Case, CRUD Testing, UAT, Production Readiness, Role-Based Access Control, Authorization, Authentication, Validation, Verification, Error Handling, Usability, Accessibility, Compatibility, Responsive Testing, Cross-Browser Testing, Performance Bottleneck, API Response, Status Code, Payload, Console Error, Network Error, Race Condition, Duplicate Submission, Data Persistence, Broken Link, UI Inconsistency, UX Friction.

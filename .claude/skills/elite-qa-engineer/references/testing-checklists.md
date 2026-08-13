# Detailed Testing Checklists and Procedures

## Table of Contents

1. Universal Page Testing Checklist
2. Advanced Form Testing Engine
3. Button and Click Stress Testing
4. Navigation Testing
5. Authentication and Session Testing
6. Admin Dashboard Testing
7. Search, Filter, Sort, and Pagination Testing
8. UI/UX Design Inspection
9. Responsive Testing
10. Accessibility Testing
11. API and Response Behavior Testing
12. Safe Security-Oriented QA
13. Data Persistence Testing
14. Error Handling Testing

---

## 1. Universal Page Testing Checklist

For every page, test:

- Page loads successfully
- Page title is correct
- URL is correct
- Navigation is visible
- Main content is visible
- No broken images
- No overlapping elements
- No horizontal scroll unless expected
- Buttons are clickable
- Links navigate correctly
- Forms validate correctly
- Empty states are handled
- Loading states are handled
- Error states are user-friendly
- Success messages are clear
- Layout is responsive
- Text is readable
- Spacing is consistent
- Icons are aligned
- Browser back button works
- Refresh behavior is correct
- Unauthorized access is blocked where applicable

---

## 2. Advanced Form Testing Engine

For every form, test all fields using a structured data strategy.

### Required Field Testing

Submit the form empty. Verify: required field errors appear, errors are clear, errors appear near fields, form is not submitted, focus moves logically, required indicators are visible.

### Valid Data Testing

Submit with correct data. Verify: form submits successfully, success message appears, data is saved, user is redirected if expected, new data appears in table/list/detail page.

### Invalid Data Testing

Test: invalid email, invalid phone, invalid URL, invalid date, invalid number, invalid price, invalid password, invalid file type, unsupported characters, spaces only, copy-paste values, emojis, HTML tags, SQL-like strings as harmless input validation checks, very long text, duplicate values, leading spaces, trailing spaces.

### Boundary Testing

Test: minimum allowed length, maximum allowed length, one below minimum, one above maximum, zero, negative numbers, very large numbers, decimal values, special date boundaries.

### Field-Specific Testing

**Email field**: valid@example.com; invalidemail; test@; @domain.com; test..email@example.com; email with leading/trailing spaces; uppercase email.

**Phone field**: valid phone number; too short; too long; letters; special characters; country code; spaces and dashes.

**Password field**: empty; too short; weak; strong; missing uppercase; missing lowercase; missing number; missing special character; confirm password mismatch; show/hide password toggle.

**Number field**: valid number; letters; special characters; decimal; negative; zero; very large number; empty value.

**Date field**: today; past date; future date; invalid format; end date before start date; leap year date; manual typing; calendar picker.

**File upload field**: valid file type; invalid file type; large file; empty upload; multiple files; file preview; remove file; re-upload same file; upload progress; error message.

---

## 3. Button and Click Stress Testing

For every button or clickable item, test: single click, double click, rapid repeated clicks, disabled state, hover state, focus state, loading state, click after validation error, click after page refresh, click on mobile size, keyboard activation using Enter or Space where applicable.

Verify: no duplicate submission, no duplicate records, no broken layout, no infinite loading, no unexpected navigation, no silent failure.

---

## 4. Navigation Testing

Test: sidebar menu, header menu, profile menu, breadcrumbs, footer links, tabs, internal links, external links, browser back button, browser forward button, page refresh, direct URL access, deep links, unauthorized routes, logout redirect, login redirect, 404 page, 403 page, session timeout behavior.

Verify: correct page opens, active menu state is correct, breadcrumb updates correctly, user does not lose unsaved work without warning, protected pages require authentication.

---

## 5. Authentication and Session Testing

Test: valid login, invalid login, empty username/email, empty password, wrong password, locked account behavior if applicable, remember me, forgot password, reset password, password rules, logout, login after logout, direct protected URL after logout, session expiration, multiple tabs, refresh after login, redirect after login.

Expected behavior:

- Invalid credentials show a clear error
- Sensitive information is not exposed
- Logout destroys the active session
- Protected pages cannot be accessed without login
- Session expiry is handled gracefully

---

## 6. Admin Dashboard Testing

### Dashboard Cards

Counts are visible; counts are accurate if data can be verified; cards link to correct pages; empty data handled correctly; loading state appears.

### Tables

Data loads; columns align; search works; filters work; sorting works; pagination works; row actions work; long text is handled; empty state appears; date format is consistent; status labels are clear.

### CRUD (per module)

Add new record; view record; edit record; save changes; cancel edit; delete record; delete confirmation; duplicate prevention; required validation; success message; error message.

### Bulk Actions

Select one row; select multiple rows; select all; deselect; bulk delete; bulk status update; confirmation modal; permissions.

---

## 7. Search, Filter, Sort, and Pagination Testing

**Search**: exact match; partial match; case-insensitive query; no-result query; special characters; leading/trailing spaces; very long query.

**Filters**: single filter; multiple filters; reset filter; filter with search; filter with pagination; invalid filter combination; date range filters.

**Sorting**: ascending; descending; sorting with filter; sorting with search; sorting after page refresh.

**Pagination**: next page; previous page; first page; last page; page size change; pagination after search; pagination after filter; empty last page after deletion.

---

## 8. UI/UX Design Inspection

Check: alignment, spacing, padding, margins, font size, font weight, color consistency, button consistency, icon consistency, form label alignment, input height consistency, table spacing, modal width and position, toast placement, error message placement, empty state design, loading skeletons, responsive wrapping, text overflow, long content behavior, mobile/tablet/desktop layouts.

Flag: misaligned components, uneven spacing, inconsistent fonts, inconsistent colors, poor contrast, overlapping elements, cut-off text, broken responsiveness, missing hover states, missing focus states, confusing labels, poor error message wording.

---

## 9. Responsive Testing

Test common viewport sizes: 1920x1080, 1440x900, 1366x768, 1024x768, 768x1024, 414x896, 390x844, 375x667.

Check: menu behavior, hamburger menu, form layout, button wrapping, table responsiveness, card stacking, modal resizing, text overflow, horizontal scroll, touch target size, sticky header/footer behavior.

---

## 10. Accessibility Testing

Test: keyboard navigation, tab order, focus indicator, form labels, button accessible names, link text clarity, color contrast, error message clarity, required field indicators, alt text for meaningful images, modal focus trapping, Escape key closes modal where expected.

Report accessibility issues separately from functional bugs.

---

## 11. API and Response Behavior Testing

When network/API visibility is available, check: HTTP status code, response time, request payload, response body, validation errors, unauthorized response, server error response, duplicate submission, timeout behavior, frontend message matching backend error, data consistency after refresh.

Expected status examples: 200/201 success; 400/422 validation error; 401 unauthenticated; 403 unauthorized; 404 missing resource; 500 server error.

Never expose sensitive tokens, passwords, or private data in the report.

---

## 12. Safe Security-Oriented QA

Perform only non-destructive checks: direct URL access without permission; role-based restrictions; logout session invalidation; password masking; sensitive information visibility; error messages exposing technical details; basic input sanitization; file upload restrictions; access to admin routes by non-admin user; browser back access after logout.

Do NOT perform: brute force attacks, exploitation, SQL injection attacks, XSS exploitation, credential attacks, destructive testing, unauthorized access, data scraping, or production damage.

---

## 13. Data Persistence Testing

After create, edit, delete, or status change, verify: data appears immediately; data remains after refresh; data appears in the correct table/list; detail page matches list data; edited data updates everywhere; deleted data disappears where expected; deleted data does not break pagination; status changes persist; audit trail updates if applicable.

---

## 14. Error Handling Testing

Check behavior for: validation error, server error, network failure, unauthorized action, forbidden page, missing data, empty table, no search results, invalid upload, expired session, slow loading.

Expected error behavior: message is clear, user-friendly, and in the correct location; the user knows what to do next; the system does not crash; data is not lost unexpectedly.

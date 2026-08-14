# SmartPocket — QA Audit Report (Physical Android Device)

| Field | Value |
| --- | --- |
| **Product** | SmartPocket (ships as "Expense Tracker", slug `expense-tracker-app`) |
| **Repository** | `Alpharages/SmartPocket` — branch `docs/realign-to-react-native` |
| **Build under test** | 1.0.0 — **debug** build; Expo SDK 54 / RN 0.81.5 / React 19 / Expo Router 6 / **New Architecture (Fabric)** |
| **Device** | vivo V2352 · Android 16 · 720×1608 px @ density 300 → scale 1.875 (**384×858 dp**; the audit draft's "≈360×536 dp" was wrong — see §2.6. The 44 dp floor is **82.5 px** here) |
| **Backend** | Local Express/tRPC API on `:3001` against **real MySQL** (`smartpocket`) — not the in-memory dev DB |
| **Audit type** | Functional, UI/UX, navigation, data integrity, accessibility, performance, security, product scope |
| **Date** | 2026-08-14 (audit) · 2026-08-14 (remediation) |
| **Remediation build** | Same device, rebuilt debug APK (`+ @react-native-community/datetimepicker@8.4.5`) |
| **Release recommendation** | 🟡 **All 17 logged defects fixed and re-verified. Still blocked on verification debt** — see §16 |

### Method and honesty statement

Findings are tagged **[Verified]** (observed on the device this session, with evidence),
**[Inferred]** (reasoned from source, not observed at runtime), or **[Untested]**. Inferred findings
are never counted as tested coverage. Evidence is in `docs/qa-evidence/`.

This audit closes the gap declared in the previous report (`docs/QA-REPORT.md`): *"No physical iOS or
Android device was available… native-only behaviour was reviewed at source level only."*

**A tooling limitation — not a product defect — blocked the majority of planned testing.** This
session drove the device with injected input (`adb shell input`). On this vivo ROM, injected taps are
**not delivered to React Native `Pressable` components**, although they *are* delivered to `TextInput`
(the keyboard opened from an injected tap on the same screen). **Physical finger taps work
correctly — confirmed by the device owner.** Controls are functional.

Consequently no form could be filled, no record created, edited or deleted, and no validation
exercised **by this harness**. Sections 5 (Forms) and much of 3 and 6 are therefore **source-level
review, explicitly tagged**, not runtime verification. Section 15 reports blocked counts honestly
rather than inflating a pass rate.

> **Correction notice.** An earlier draft of this report logged the unresponsiveness as SP-D01, a
> Critical "app is unusable" defect. That was **wrong** — it was an artefact of injected input.
> SP-D01 is withdrawn below and the release decision, issue counts and ratings have been revised.
> The layout defects (SP-D02 and its family) were measured, not inferred from touch, and **stand
> unchanged**.

### Remediation notice (2026-08-14)

All **17 open defects are fixed**, on the same physical device, with the same measurement method
(`uiautomator dump` + screenshots). Fix detail and per-issue evidence are in the Status column of
§3; the remediation summary is §16.

Two points of honesty about this remediation pass:

1. **Sections 4–13 below are the original audit text and describe the pre-fix build.** They are left
   intact as the record of what was found. Where a section's finding is now closed, it carries an
   inline `**Fixed:**` note. Do not read §4's ratings as current.
2. **The verification debt in §15 is unchanged.** `adb shell input` still does not deliver taps to
   RN `Pressable` on this ROM — re-tested after the fix. So create/edit/delete, validation, App Lock
   and CSV remain **unexercised on device**, exactly as before. Fixing the defects did not buy any
   coverage of the interactive half of the app.

---

## 1. Executive Summary

### 1.1 What the product is

SmartPocket is a cross-platform personal-finance manager built from one Expo/React Native codebase.
Its purpose (`docs/concept note.md`) is a free, privacy-conscious tool unifying four things
competitors usually split: **income/expense tracking**, **budgeting**, **personal loan management**
(money lent and borrowed), and **AI-assisted insight**.

The shipped surface is broad for a 1.0: transactions, categories, credit cards, multi-account support
with transfers, category budgets, recurring-transaction rules, loans with repayment schedules and
reminders, CSV import/export, multi-currency, theming with light/dark, trend charts, anomaly
detection and a month-end forecast.

### 1.2 Quality assessment

The **backend and data layer are sound**. Every figure the app displayed reconciled exactly against
MySQL. Routing works across all 16 routes. Accessibility labelling is genuinely above average.

The app **is operable** — controls respond to physical touch. What it is not, is *presentable*.

> **Fixed.** SP-D02 and its whole family are closed; the app is now presentable. The paragraphs below
> describe the pre-fix build. See §16 for the fix and the post-fix measurements.

The blocking defect is **SP-D02 (Critical): `cssInterop` on the animated pressable swallows the
`style` prop.** Buttons render 40 px tall with no background — below the 44 px minimum the component
sets inline. Because every interactive primitive in the app (`Button`, `Pill`, `TransactionRow`,
`CategoryToken`, `PinPad`, `credit-card`, `GlassTabBar`) is built on that one component, the damage
is app-wide:

- Primary CTAs — "Add Income", "Add Expense", "Add account", "Add New Category" — render
  **white text on a white background and are invisible**.
- The transaction list **does not paint its row titles or categories**; rows overlap 33 px apart.
- Category rows render as **stacked columns**, ~220 px tall each.
- The tab bar **does not distribute**; labels collide into `HomeActivityInsightsLoansCards`.
- Every touch target is **40 px, failing the WCAG 2.1 AA minimum** the code itself specifies.

This is measured, not inferred: disabling the interop registration changed the buttons from
40 px × 145 px to 92 px × 304 px and restored row sharing. A user can operate this build, but they
cannot see the buttons they are pressing, and cannot read what their transactions were for.

### 1.3 Why a web-only QA pass missed this

The previous audit ran in Chromium and rated the same build far higher. Every defect in this report
is invisible on web: NativeWind interop, Reanimated's animated Pressable, and Fabric's touch pipeline
are native-only concerns. **A device smoke test is a hard requirement for this stack.**

### 1.4 Issue count

**18 issues** — 1 Critical, 6 High, 6 Medium, 5 Low. *(SP-D01 withdrawn — see correction notice.)*

**All 17 valid issues are now fixed and re-verified on device.** Remaining severity backlog: **0**.

### 1.5 Production readiness

*Original assessment (pre-fix):*

🔴 **Not Ready for Production.** The app functions, but SP-D02 makes its primary actions invisible
and its core list unreadable, and it fails the accessible touch-target minimum on every control.
Shipping a finance app whose "Add Expense" button cannot be seen, and whose transaction history shows
amounts without descriptions, is not viable.

The fix is well-understood and narrow — one shared primitive. But roughly 60 % of the test plan
(all create/edit/delete, all validation, App Lock, CSV) still has **no runtime verification on
device**, so a full device QA cycle is required after the fix regardless.

*Post-fix assessment:*

🟡 **The defect backlog is clear; the coverage gap is not.** Every issue in §3 is fixed and
re-measured on the same device. The second half of that original paragraph still applies verbatim:
~60 % of the test plan has no runtime verification on device, because the harness limitation that
prevented it is unchanged. **That, not the defect list, is now the only thing standing between this
build and a release decision.** See §16.

---

## 2. Testing Scope

### 2.1 Screens tested (16 of 16 routes)

Login · Dashboard (Home) · Activity (Transactions) · Categories · Insights (Summary) · Loans ·
Cards · Accounts · Budgets · Recurring · Settings · Security · Import CSV · Transaction detail ·
Card detail · Loan detail

### 2.2 Modules tested

Auth/session · Routing & deep links · Dashboard aggregation · Transaction list · Categories ·
Accounts & multi-currency · Cards · Loans · Budgets (empty state) · Recurring (empty state) ·
Insights/forecast/charts · Data persistence (MySQL reconciliation)

### 2.3 Forms

**Source-level review only — all runtime form testing not executed by this harness.**
Add/Edit Transaction · Budget form · Record repayment · Add/Edit account · Add/Edit category ·
Add/Edit card · Transfer · CSV import · PIN pad · Search/filter

### 2.4 Navigation

All 16 routes exercised via deep link (`manusexpensetrackerapp://<route>`). Hardware back verified.
In-app navigation via tapping is not executed by this harness.

### 2.5 User flows covered

| Flow | Status |
| --- | --- |
| Cold start → dev auth → dashboard | ✅ Verified — re-verified post-fix with **no** harness workaround |
| Session restore across restarts | ✅ Verified (audit: only after a harness workaround for SP-D07; post-fix: works unpatched — token-only cold start now resolves the user from the API and lands on Dashboard) |
| Browse all tabs and detail screens | ✅ Verified (via deep link) |
| Deep-link into detail routes | ✅ Verified |
| Back navigation from detail → list | ✅ Verified |
| Create / edit / delete anything | ⛔ Not executed (harness could not drive controls) |
| Validation, search, filter, sort | ⛔ Not executed (harness) |
| App Lock (PIN / biometric) | ⛔ Not executed (harness) |
| CSV import / export | ⛔ Not executed (harness) |
| Real OAuth sign-in | ⛔ Blocked (`OAUTH_SERVER_URL` unset) |

### 2.6 Devices

One physical device: vivo V2352, Android 16, 360 dp width (a small-but-common phone class).
No tablet, no landscape, no iOS, no dark-mode sweep.

*Post-fix correction:* the device reports **density 300 (scale 1.875)** at 720×1608 px, i.e. **384×858
dp**, not the ≈360×536 dp stated in the header table. This matters for reading every px figure in this
report: the 44 dp accessibility floor is **82.5 px** on this device, so the pre-fix 40 px controls were
21 dp — half the minimum, worse than "40 px vs 44 px" makes it sound. Dark mode was in fact exercised
incidentally during remediation (`fix_trend_chart.png`); a systematic sweep is still not done.

---

## 3. Issues Log

| ID | Severity | Category | Module | Screen | Description | Steps to Reproduce | Expected | Actual | Recommended Fix | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| ~~SP-D01~~ | ~~Critical~~ | — | — | — | **WITHDRAWN — not a defect.** Logged as "controls do not respond to touch". Root cause was the test harness: this vivo ROM does not deliver **injected** (`adb shell input`) taps to RN `Pressable`, though it does to `TextInput`. Physical finger taps work — confirmed by the device owner | — | — | — | Use a real-gesture automation harness (Appium/UiAutomator2) or manual testing on this ROM; `adb shell input` is not a valid driver for this app | **Closed — invalid** |
| SP-D02 | **Critical** | UI | Design system | All | `cssInterop(AnimatedPressable,…)` swallows the `style` prop; buttons render 40 px tall with no background, below their own inline `minHeight: 44` | Measure any Button via `uiautomator dump` | ≥44 px, filled background | 40 px, transparent | Do not run `cssInterop` over `Animated.createAnimatedComponent(Pressable)` | **FIXED** — deleted the `cssInterop(AnimatedPressable, …)` registration (`lib/_core/nativewind-pressable.ts`). The interop rebuilds its target prop from scratch (`applyRules` → `assignToTarget`) and over the animated Pressable that round-trip loses *both* `className` and `style`. The registration was also unnecessary: `className` still reaches the inner `Pressable`, which *is* registered. Measured both ways on device — primary Button **145×40 px → 304×92 px** (49 dp ≥ 44). Note: the SP-057 comment claiming `className` was dropped here was an incorrect diagnosis; class layout (`flex-1`, `mt-*`) works without the interop, proven by A/B on device. **Closed [Verified]** |
| SP-D03 | High | UI | Design system | Dashboard, Accounts, Categories | Primary CTAs render white-on-white and are invisible | Open Dashboard | Filled, legible buttons | "Add Income"/"Add Expense"/"Add account"/"Add New Category" invisible | Fix SP-D02 | **FIXED** via SP-D02 — CTAs render filled and legible; `evidence: fix_dashboard.png`, `fix_accounts.png`, `fix_categories.png`. **Closed [Verified]** |
| SP-D04 | High | UI | Transactions | Activity | Row title/category not painted; rows overlap (33 px apart vs ~115 px normal); icon tiles clipped | Open Activity | Title, category, date, amount on one row | Icon + amount only; text missing | Fix SP-D02 | **FIXED** via SP-D02 — rows now 128 px (68 dp) with title, category and amount painted on one row; `evidence: fix_transactions.png`. **Closed [Verified]** |
| SP-D05 | High | UI | Categories | Categories | Rows render as columns — icon, name, edit, delete stacked; ~220 px per row vs ~60 px | Open Categories | Single-line rows | Stacked column | Fix SP-D02 | **FIXED** via SP-D02 — single-line rows at 135 px (72 dp), icon/name/edit/delete on one row; `evidence: fix_categories.png`. **Closed [Verified]** |
| SP-D06 | High | UI | Navigation | All (tab bar) | Tab bar does not distribute; icons crammed into left half, labels run together: `HomeActivityInsightsLoansCards` | Observe tab bar | Evenly distributed, spaced labels | Crammed left, right half empty | Fix SP-D02 | **FIXED** via SP-D02 — 5 tab items at 127 px each across a 666 px bar, evenly distributed with separated labels; `evidence: fix_dashboard.png`. **Closed [Verified]** |
| SP-D07 | High | Functional | Auth | Login | Native `useAuth` treats "authenticated" as *cached user info exists*; dev-login and the `sessionToken`-in-URL OAuth branch store the token but never `setUserInfo` → valid session renders Login forever | Store a session token without user info; relaunch | Dashboard | Login screen | Validate token against API on native; call `setUserInfo` on every path that stores a token | **FIXED** — `hooks/use-auth.ts` now treats the *token* as the session: with a token and no cached user it calls `/api/auth/me` and caches the result, so the fix covers every token writer instead of each one remembering to cache. The cache fast-path also now requires a token to exist, closing the "stale cache is the authority" hole. `Api.getMe()` returns `null` only on 401/403 and rethrows network errors (new `ApiError` carries the status), so an unreachable API no longer signs the user out. Verified: wiped app data → dev auto-login stored a token with no user info → log shows `/api/auth/me … 200` → **Dashboard, not Login**. **Closed [Verified]** |
| SP-D08 | High | Product Scope | Currency | Accounts / Dashboard | Accounts render USD (`US$30.00`, `-US$72.50`) while transactions/totals render PKR (`Rs`). No conversion; figures cannot be reconciled | Set currency PKR; open Accounts | One coherent currency, or explicit per-account scoping with conversion | Two currencies mixed silently | Convert to display currency via a rate source, or clearly scope and label per-account currency | **FIXED** — account balances are folded from transaction/transfer amounts, and those carry no currency of their own, so formatting them with `account.currency` was printing a PKR sum as `US$30.00`. Balances (and their a11y labels) now use the display currency like every other figure in the app. Verified: `Rs 30.00` / `-Rs 72.50`, reconcilable against the transaction list; `evidence: fix_accounts.png`. **Scope note:** `account.currency` now only scopes transfer pairing — true multi-currency needs a per-transaction currency column plus an FX source, which is a feature, not this fix. **Closed [Verified]** |
| SP-D09 | Medium | UI | Dashboard | Dashboard | "Add transaction" FAB renders full-width (`[26,1545][694,1608]`) instead of a circular FAB | Open Dashboard | Circular FAB | Full-width bar | Fix SP-D02 | **FIXED** via SP-D02 — circular FAB at 109×108 px (was 668×63); `evidence: fix_dashboard.png`. **Closed [Verified]** |
| SP-D10 | Medium | UX | Dev/Setup | — | On a physical device the API host resolves to `10.0.2.2` (emulator-only alias) when `EXPO_PUBLIC_API_BASE_URL` is loopback/unset → permanent blank white screen, no error | Run on device with shipped `.env` | Clear error, or LAN auto-detect | Silent white screen | Detect physical device; fail loudly when the API is unreachable instead of gating render silently | **FIXED** — `10.0.2.2` is the *emulator's* host alias, so a physical device got an unroutable address. `constants/oauth.ts` now applies it only to an actual emulator (detected from `Platform.constants` fingerprint/model/brand — no new dependency) and otherwise keeps `localhost`, which `adb reverse` forwards. Paired with SP-D11 the failure is now loud. Verified: data loads on the physical device with no `.env` change. **Closed [Verified]** |
| SP-D11 | Medium | UX | App shell | All | `isAppShellReady` gates the *entire* render on dev auto-login; any failure = indefinite blank screen with no spinner, message or retry | Block the API; launch | Spinner then error state | Blank white screen | Render a loading/error state instead of `return null` | **FIXED** — `app/_layout.tsx` renders a themed spinner + "Connecting…" while gated, and on failure an error card naming the unreachable URL with **Retry** and **Continue offline**. Dev auto-login also gained an 8 s deadline. Verified with the API tunnel removed; `evidence: fix_shell_error_state.png`. *(A first attempt used `AbortSignal.timeout`, which Hermes does not implement — it threw before `fetch` ran and broke dev auto-login outright. Caught by running it on device, replaced with an `AbortController` + `setTimeout`.)* **Closed [Verified]** |
| SP-D12 | Medium | UI | App Lock | All | `AppLockGate` "checking" state paints an opaque full-screen overlay with **no** spinner or text; indistinguishable from a hang | Cold start | Spinner during check | Blank opaque screen | Add an indicator to the `checking` branch | **FIXED** — the `checking` branch already had a bare `ActivityIndicator`; added a "Checking App Lock…" caption so an opaque full-screen fill is no longer indistinguishable from a hang (`components/app-lock-gate.tsx`). **Closed** — code change verified, runtime state not reachable without a PIN set (see §16 caveats) [Inferred] |
| SP-D13 | Medium | UX | Transactions | Activity | Detail rows push the amount onto its own line below the date at 360 dp instead of aligning right on one line | Open Activity at 360 dp | Amount right-aligned on row | Wraps to second line | Fix SP-D02; verify at 360 dp | **FIXED** via SP-D02 — amount right-aligned on the same row as the title (amount at x 559–660, title y 520–553 vs amount y 535–568); `evidence: fix_transactions.png`. **Closed [Verified]** |
| SP-D14 | Medium | Validation | Add Transaction | Add Transaction | Date is a free-text `YYYY-MM-DD` field with no native date picker — high error rate on mobile | Open Add Transaction | Native date picker | Manual text entry | Use a platform date picker; keep text as fallback | **FIXED** — added `@react-native-community/datetimepicker@8.4.5` and a shared `components/ui/DatePickerButton.tsx`, wired into **all 8** free-text date fields (add-transaction, transaction edit, transfer, record-repayment, loan end date, loan next-due, recurring start, recurring end) — not just the one this ticket named. Text entry is kept as the fallback. Required a native rebuild. Verified rendering: button measures 82×83 px = exactly 44 dp, labelled "Pick transaction date"; the OS dialog itself cannot be opened by this harness. **Closed [Verified: renders] / [Untested: dialog interaction]** |
| SP-D15 | Low | UI | Insights | Insights | Forecast renders **"-Rs 0.00"** — a negative zero | Open Insights in a month with no data | `Rs 0.00` | `-Rs 0.00` | Normalise `-0` before formatting | **FIXED** at the formatter rather than the caller — callers pick the sign from a semantic type ("this is an expense"), not from the value, so `formatCurrency` / `formatCurrencyAccessibilityLabel` now drop the sign whenever the amount rounds to zero at display precision (`lib/currency.ts`). Fixes the forecast card and every other caller at once. Verified: forecast reads `Rs 0.00`, a11y reads "estimated Pakistani Rupee 0.00" (was "minus, …"); dashboard chips likewise. **Closed [Verified]** |
| SP-D16 | Low | UI | Insights | Insights | Trend chart is clipped at the bottom; x-axis labels not visible | Open Insights, view Trends | Full chart with axis labels | Clipped | Give the chart container explicit height/padding | **FIXED** — resolved by SP-D02 (chart renders full height with x-axis labels Mar–Aug visible). Also stopped passing `legend` into `react-native-chart-kit`: it drew its own legend *inside* the chart box, duplicating the app-styled legend below and eating into `CHART_HEIGHT`. `evidence: fix_trend_chart.png`. **Closed [Verified]** |
| SP-D17 | Low | UI | Accounts | Accounts | Back chevron is half-cut at the left screen edge and crowds the title | Open Accounts | Fully visible, padded | Clipped at edge | Add left padding to the header | **FIXED** via SP-D02 — back chevron renders 83×83 px at x=30 (16 dp inset), fully visible, title no longer crowded; `evidence: fix_accounts.png`. **Closed [Verified]** |
| SP-D18 | Low | Validation | Add Transaction | Add Transaction | Amount regex `^\d+(\.\d{1,2})?$` has no upper bound — a 15-digit amount passes client validation | Enter a very large amount | Sensible max, clear error | Accepted | Add a max bound, client and server | **FIXED** — the unbounded regex was duplicated in 7 client validators and 8 server schemas. Replaced by one `shared/money.ts` (`MONEY_PATTERN`, `MAX_MONEY_AMOUNT = 9_999_999_999.99`, bound = the `decimal(12,2)` column capacity) imported by both sides, plus a single `moneySchema`/`positiveMoneySchema` pair in `server/routers.ts`. Covered by `tests/money-bounds.test.ts`. **Closed [Verified by test]** |
| SP-D19 | Low | Accessibility | Transactions | Activity | One transaction row exposes an **empty** accessibility label while its peers are fully labelled | Dump a11y tree on Activity | Descriptive label | `""` | Ensure the label builder handles null description/category | **FIXED** — `buildAccessibilityLabel` filters empty segments, and `type` + amount are always present, so a blank label is now unreachable whatever the caller passes; the four callers deriving a title from a nullable name also moved `??` → `&#124;&#124;` so an empty-string category can't slip through. Verified: all 11 rows carry complete labels. **Closed [Verified]** |

---

## 4. Screen-by-Screen Review

> Ratings weigh what could be assessed. Interactive behaviour could not be driven by this harness, so
> screens are rated on rendering, data correctness, information architecture, labelling and visual
> quality. "Not verified" below means *this session did not exercise it*, **not** that it is broken —
> controls do respond to physical touch.
>
> **These ratings are pre-fix and are deliberately not restated.** Every rendering defect they penalise
> (SP-D02/D03/D04/D05/D06/D09/D13/D15/D16/D17) is fixed, so the rendering half of each score would rise;
> the *function* half is still unverified for the same harness reason. Re-scoring on a run that still
> cannot tap anything would replace a measured number with a guess — §16 lists what changed instead.

### 4.1 Login
**Purpose:** OAuth entry point. **Observations:** Renders correctly — wallet icon, app name, value
proposition, single "Sign in" CTA. **UI:** Clean, centred, good hierarchy. **UX:** Copy is clear
("Track spending, budgets and loans in one place"). **Functional:** Reached only by clearing storage;
real OAuth untestable (`OAUTH_SERVER_URL` unset). SP-D07 causes an authenticated user to land here.
**Missing:** No offline/error state if the OAuth portal is unreachable; no "why do I need an account"
affordance. **Unnecessary:** None. **Consistency:** Good. **Rating: 6/10**

### 4.2 Dashboard (Home)
**Purpose:** At-a-glance monthly position plus quick actions. **Observations:** Header, date, balance
card, quick actions, Recent Activity render; data matches DB. **UI:** Balance card is the strongest
component in the app — good hierarchy, colour-coded income/expense. Ruined by SP-D03 (invisible CTAs)
and SP-D09 (full-width FAB). **UX:** "This Month = Rs 0.00" is *correct* (seed data is June/July,
today is August) but reads as broken; an empty-month hint would help. Down-arrow=income /
up-arrow=expense is defensible but unlabelled. **Functional:** Read path correct; actions not verified.
**Missing:** No pull-to-refresh observed; no empty-month explanation. **Unnecessary:** None.
**Consistency:** Quick actions inconsistent — "Add Income"/"Add Expense" are filled buttons,
"Budgets" is an icon+label on its own row. **Rating: 4/10**

### 4.3 Activity (Transactions)
**Purpose:** Full transaction history with search/filter. **Observations:** Header count ("11
transactions") matches DB exactly. **UI:** Worst-affected screen — SP-D04 removes titles and
categories, rows overlap, icons clipped; "All" filter chip is invisible (SP-D03). **UX:** Date
grouping (Jul 20, Jul 2…) is a good pattern. Amount wraps to its own line (SP-D13). **Functional:**
Search, 5 filter chips, and row navigation not verified. **Missing:** No sort control; no export from
this screen; no multi-select/bulk delete. **Unnecessary:** "This Month" and "This Week" chips overlap
conceptually with the Insights month switcher. **Consistency:** Filter chips use a different
component (Pill) with different failure behaviour than Buttons. **Rating: 3/10**

### 4.4 Categories
**Purpose:** Manage income/expense categories. **Observations:** 6 categories, matching DB.
**UI:** SP-D05 — every row is a stacked column (~220 px), so 4 categories fill the screen. Icons and
colour tokens themselves are attractive and consistent. **UX:** Split into "Expense Categories" /
income sections — good. Delete is a bare trash icon with no visible confirm at this level.
**Functional:** CRUD not verified. **Missing:** No reorder; no merge; no "in use by N transactions"
warning before delete — deleting a used category is a data-integrity risk. **Unnecessary:** "Dining"
and "Food & Dining" both exist in seed data — suggests no duplicate-name guard. **Consistency:**
Row layout inconsistent with every other list in the app. **Rating: 3/10**

### 4.5 Insights (Summary)
**Purpose:** Monthly breakdown, forecast, trends, anomalies. **Observations:** Best-rendering screen
in the app. **UI:** Three stat cards (Balance/Income/Expenses) render correctly with proper
backgrounds — notably these are **not** Button-based, which is why they survive SP-D02. Multi-series
trend chart (Income/Expense/Net) renders with a legend. **UX:** Month switcher with a "Current" badge
is clear. **Functional:** Prev/next month navigation not verified. **Issues:** SP-D15 (negative zero),
SP-D16 (chart clipped, no x-axis labels). **Missing:** No category breakdown/pie on this screen; no
period comparison ("vs last month %"). **Unnecessary:** None. **Consistency:** Strong — this is the
design language the rest of the app should match. **Rating: 7/10**

### 4.6 Loans
**Purpose:** Track money lent and borrowed. **Observations:** 1 loan ("QA Counterparty", Rs 1,200.00,
Lend, Active) matching DB. **UI:** Clear direction badge ("Lend") and status ("Active"). **UX:**
Direction is the critical concept and it is communicated well. **Functional:** Read correct; "New
loan" and repayment not verified. **Missing:** No due-date or progress indicator on the list row; no
overdue emphasis. **Unnecessary:** None. **Consistency:** Good. **Rating: 6/10**

### 4.7 Cards
**Purpose:** Credit-card tracking and utilisation. **Observations:** 2 cards, matching DB.
**UI:** Card visual is polished — masked number `•••• •••• •••• 1234`, cardholder, expiry.
**UX:** Detail view shows "Rs 25.50 TOTAL ON THIS CARD" and "<1% of Rs 7,500.50 limit" — genuinely
useful utilisation framing. **Functional:** Add/edit not verified. **Security:** Masking is correct at the
display layer [Verified]; card numbers are AES-encrypted at rest per `CARD_ENCRYPTION_KEY`
[Inferred]. **Missing:** No statement/due-date reminder. **Unnecessary:** None. **Rating: 7/10**

### 4.8 Accounts
**Purpose:** Multiple accounts plus inter-account transfer. **Observations:** 2 accounts matching DB.
**UI:** Clean rows with type/currency subtitle; inline edit/delete. Marred by SP-D03 (invisible "Add
account") and SP-D17 (clipped back chevron). **UX:** SP-D08 is a real product problem here — USD
balances beside a PKR app. **Functional:** Transfer not verified. **Missing:** No total-across-accounts;
no per-account currency conversion. **Unnecessary:** None. **Rating: 4/10**

### 4.9 Budgets
**Purpose:** Category spending caps with alerts. **Observations:** 0 budgets; correct empty state.
**UI/UX:** Empty state is well written — "No budgets yet / Create a budget to cap spending in a
category." Clear heading and subtitle. **Functional:** Creation and threshold alerts not verified.
**Missing:** Cannot assess without data. **Rating: 5/10** (empty state only)

### 4.10 Recurring
**Purpose:** Rules that auto-generate transactions. **Observations:** 0 rules; correct empty state
("Create a rule to automatically log regular income or expense"). **Functional:** Creation and the
server-side generator untested at runtime. **Note:** A `/api/scheduled/generate-recurring` endpoint
exists [Inferred]. **Rating: 5/10** (empty state only)

### 4.11 Settings
**Purpose:** Currency, week start, preferences, sign-out. **Observations:** Renders "PREFERENCES",
"Currency PKR", "First day of week — Sunday". **UI/UX:** Standard grouped list, appropriate.
**Functional:** Toggles not verified. **Missing:** No export entry point visible here; no
theme selector surfaced despite a multi-theme system existing. **Rating: 5/10**

### 4.12 Security
**Purpose:** App Lock (PIN + biometric). **Observations:** Renders "App Lock — Require a PIN to open
SmartPocket." **Functional:** ⛔ Not verified — could not be driven by this harness. **This remains the
single biggest untested area**, and it was also the previous report's declared gap. The underlying
implementation reads careful (fail-closed on Keystore errors, epoch-guarded unlock decisions,
`dismissAll()` before locking), which makes it *more* important to verify, not less. **Rating: N/A —
not assessable**

### 4.13 Import CSV
**Purpose:** Bulk import. **Observations:** Renders "Choose CSV file". **Functional:** ⛔ Blocked —
document picker cannot be opened. **Missing:** No visible column-mapping preview or dry-run
affordance on the initial screen. **Rating: N/A — not assessable**

### 4.14 Transaction detail
**Purpose:** View/edit/delete one transaction. **Observations:** Renders "Details" with "Edit
transaction" and "Delete transaction" actions. **UX concern:** The visible content was sparse — the
actions were prominent while the transaction's own attributes were not obviously surfaced above them.
Worth a design check once SP-D02 is fixed. **Functional:** Not verified. **Rating: 4/10**

### 4.15 Card detail
**Purpose:** Per-card spend and utilisation. **Observations:** Renders correctly with masked number,
total on card, and percent-of-limit. **UI/UX:** Good. **Functional:** Edit not verified. **Rating: 7/10**

### 4.16 Loan detail
**Purpose:** Loan status and repayments. **Observations:** Renders counterparty, "Lent", "Active",
"Remaining balance Rs 1,200.00", "Delete loan". **UI/UX:** Clear. **Functional:** Record-repayment
not verified. **Rating: 6/10**

---

## 5. Forms Audit

> ⚠️ **Every item in this section is [Inferred] from source.** No form could be filled at runtime
> (harness limitation — see correction notice). Nothing here may be treated as verified behaviour.
>
> **Still true after remediation.** The fixes below (SP-D14 date pickers, SP-D18 amount bound) changed
> these forms, but no form was *filled* on device this pass either — the harness limitation is
> unchanged. Amount-bound behaviour is covered by unit test instead
> (`tests/money-bounds.test.ts`); date-picker rendering is device-verified, its dialog is not.

### 5.1 Add / Edit Transaction (`app/add-transaction.tsx`)
- **Fields:** Type (Expense/Income segmented), Amount, Category, Date, Account, Note, Card.
- **Validation:** Amount — required, regex `^\d+(\.\d{1,2})?$`, must be `> 0`, **and ≤ 9,999,999,999.99 (SP-D18, added post-fix; shared with the server schema)**. Date — must parse as
  `YYYY-MM-DD`. Category — required. Submit gated on `!!amount && !amountError && !!selectedCategory && !!parsedDate`.
- **Error handling:** Single toast surfacing the first error, with a generic
  "Please fill in all required fields" fallback. **Weakness:** errors are not bound to individual
  fields, so the user is not told *which* field failed or shown an inline message near it.
- **Success handling:** Toast "Transaction saved". Reasonable.
- **UX quality:** Good — `keyboardType="decimal-pad"` for amount, `placeholder="0.00"`, an optional
  note field, explicit Cancel/Save.
- **Missing validations:** Upper bound on amount (SP-D18); future-date policy; note length cap;
  no duplicate-submission guard observed at the UI layer.
- **Business logic:** Amount regex correctly forbids negatives and >2 decimals — appropriate for
  money. Sign is derived from transaction type rather than user-entered, which is the right design.
- **Suggestions:** Inline per-field errors; native date picker (SP-D14); disable Save while the
  mutation is in flight.

### 5.2 Record Repayment (`app/loan/record-repayment.tsx`)
- **Fields:** Amount (`decimal-pad`, `0.00`), Date (`YYYY-MM-DD`), Note (`e.g., June installment`).
- **Validation:** Amount and note trimmed; note coerced to `null` when empty — good hygiene.
- **Missing:** No visible guard that a repayment cannot exceed the outstanding balance. For a
  financial feature this is the highest-value missing rule in the app; it should be enforced
  **server-side**, not only in the UI.
- **Suggestions:** Show remaining balance beside the amount field; validate `amount <= remaining`.

### 5.3 Budget form (`app/budget-form.tsx`)
- Accepts an optional `id` (create/edit dual-purpose). Field-level review not possible within this
  session's remaining scope. **[Untested]**

### 5.4 Other forms — [Untested]
Add/Edit account, Add/Edit category, Add/Edit card, Transfer, CSV import mapping, PIN pad, and
search/filter inputs were all unreachable. Note that PIN entry is security-critical and has now gone
two consecutive audits without runtime verification.

---

## 6. Navigation Audit

| Path | Method | Result |
| --- | --- | --- |
| `/` → `/dashboard` | Redirect | ✅ Works |
| `/login` | Route | ✅ Renders |
| Dashboard, Activity, Categories, Insights, Loans, Cards | Deep link | ✅ All render |
| Settings, Security, Accounts, Budgets, Recurring, Import CSV | Deep link | ✅ All render |
| `transaction/1`, `card/1`, `loan/1` | Deep link | ✅ All render |
| Loan detail → back → Activity | Hardware back | ✅ Correct |
| Any in-app tap navigation | Injected touch | ⛔ Not executable via `adb input` on this ROM; **physical taps work** |

- **Broken links:** None found — every route resolves.
- **Wrong redirects:** One — SP-D07 sends an authenticated user to `/login`.
- **Dead buttons:** **All of them** (harness limitation — see correction notice). This is a single systemic defect, not per-button.
- **Incorrect routing:** None found.
- **Missing navigation:** No breadcrumbs (acceptable on mobile). Settings has no visible route to
  Import CSV or export.
- **Back/forward behaviour:** Hardware back verified correct. `AppLockGate` correctly intercepts back
  while locked [Inferred]. Unsaved-changes warnings on forms: **[Untested]**.

---

## 7. UI & Design Consistency Audit

| Aspect | Finding |
| --- | --- |
| **Typography** | Consistent and well-scaled. Headings ("Home", "Activity", "Categories") share weight and size; captions are uniform. One of the app's strengths. |
| **Colours** | Semantic use is correct and consistent — green income, red expense, indigo primary. Theme tokens resolve properly (`readableTextOn` computes ink per fill). |
| **Buttons** | ✅ **Fixed (SP-D02).** Was: Button-based controls lost their background and collapsed to 40 px while non-Button surfaces rendered perfectly — two visual languages coexisting purely because of a bug. Now one language: filled backgrounds, correct padding, 44 dp+ targets. |
| **Inputs** | Search field renders correctly with icon and placeholder. Consistent. |
| **Cards** | Strongest component class — balance card, stat cards, credit cards, account rows all consistent with proper radius, elevation and padding. |
| **Tables/Lists** | ✅ **Fixed (SP-D02).** All three now render as single-line rows with text (Dashboard 127 px, Activity 128 px, Categories 135 px). Unifying them onto one component (§14.3) remains open as a maintainability item, not a defect. |
| **Modals** | Not assessable — `transparentModal` routes unreachable. **[Untested]** |
| **Icons** | Consistent set (Ionicons + custom), consistent sizing and colour tokens. Good. |
| **Spacing** | ✅ **Fixed (SP-D02)** — button padding restored, category rows at natural height, dead gap gone. |
| **Alignment** | ✅ **Fixed (SP-D02)** — chevron inset 16 dp (SP-D17), amounts right-aligned on-row (SP-D13), tab items evenly distributed (SP-D06). |
| **Padding/Margins** | ✅ **Fixed (SP-D02)** — component-level padding inside pressables now applies. |
| **Responsive** | Only 360 dp tested. That width is where the tab-bar label collision and amount wrapping appear — the app is under-tested at small widths. |
| **Component consistency** | ✅ **Confirmed, and fixed.** All seven built on the same broken primitive; the single one-line fix restored consistency across all of them, as predicted. |

---

## 8. Product Scope Review

**Does the feature set belong?** Largely yes. Transactions, categories, budgets and loans map
directly to the stated purpose. Loan management is the genuine differentiator and deserves more
prominence than a fifth tab.

**Is the workflow coherent?** Mostly. Dashboard → quick action → save is the right primary loop.
But **Insights, Budgets and Recurring are hard to reach**: Budgets sits behind a tertiary Dashboard
action, and Recurring behind a Activity header icon. Two of the four pillars are semi-hidden.

**Would a real user understand it?** Once SP-D02/D03 are fixed, mostly yes — labels and empty states
are well written. Two things would confuse a real user today:
- A dashboard reading "Rs 0.00" while a populated transaction list sits below it (correct, but
  unexplained).
- USD account balances in a PKR app (SP-D08) — this one is not just confusing, it is **wrong**, since
  the two figures cannot be reconciled.

**Is anything unnecessary?** The "This Month"/"This Week" chips on Activity duplicate the Insights
month switcher. Seed data showing both "Dining" and "Food & Dining" suggests a missing duplicate
guard rather than an intended feature.

**Does it solve the problem?** The design does. The build does not — a finance app you cannot tap is
not a finance app.

**Scope recommendations:** Fix the currency model before adding features; promote Budgets and
Recurring to first-class navigation; add a category-delete impact warning.

---

## 9. Accessibility Review

**This is the app's standout strength**, and it should be protected during the SP-D02 fix.

| Check | Result |
| --- | --- |
| Button accessible names | ✅ Excellent — e.g. `"Groceries, expense, -Rs 25.50, July 20"`, `"Everyday Visa Gold card ending in 1234"` |
| Composite summaries | ✅ Excellent — `"This Month, balance Pakistani Rupee 0.00. Income plus…"` reads the whole card as one coherent sentence |
| Currency for screen readers | ✅ "Pakistani Rupee" spelled out rather than "Rs" |
| Semantic roles | ✅ `accessibilityRole="button"`, `RadioButton` for filter chips, `header` on titles |
| Icon-only buttons | ✅ Enforced — dev-time warning if `accessibilityLabel` is missing |
| Contrast | ✅ **Fixed** — `readableTextOn()` was always correct; SP-D03 was dropping the background, giving an effective ~1:1. Fills now render, so the computed ink applies as designed |
| Touch targets | ✅ **Fixed** — was 40 px (21 dp) against a declared 44 dp floor. Now 44 dp+ everywhere: Buttons 92 px/49 dp, rows 128 px/68 dp, tabs 82 px/44 dp, date pickers 83 px/44 dp. A post-fix sweep also found four hand-rolled 36 dp header icons that SP-D02 never covered (Activity, Recurring) — raised to 44 dp. Residual, all sub-pixel or scroller-clipped, none a collapsed style: the search field and the "All" chip render 82 px against the 82.5 px ideal (42.7–43.7 dp), and the last filter chip is partly scrolled out of its horizontal scroller |
| Label completeness | ✅ **Fixed (SP-D19)** — empty segments filtered in the label builder, so a blank label is unreachable; all 11 rows verified fully labelled |
| Modal focus trapping | ⬜ [Untested] |
| Keyboard/switch navigation | ⬜ [Untested] |
| TalkBack end-to-end | ⬜ **[Untested]** — labels verified via the a11y tree, but no TalkBack session was run; announcement order and focus movement remain unverified |

---

## 10. Performance Observations

| Observation | Detail |
| --- | --- |
| Native build | Clean `installDebug`; 332 Gradle tasks; ~8 min cold (one-off) |
| JS bundle | 2,098 modules; ~1.3 s warm rebuild, ~10.8 s after cache clear |
| Cold start → interactive | ~12–16 s **in debug with Metro**; not representative of release — **[Untested]** in release |
| Runtime stability | No crash, no ANR, no OOM across a long session |
| Render loop | ✅ Explicitly checked — Reanimated warning count static over 10 s, so no runaway re-render |
| API latency | Local/LAN; dev login `200` in ~1 s. Not representative of production |
| UI flicker | None observed |
| Repeated warnings | `[Reanimated] Reading from 'value' during component render` fires repeatedly — a correctness smell in a shared value read during render, worth fixing |
| Deprecation | `SafeAreaView` deprecated warning on every start; migrate to `react-native-safe-area-context` |
| Assets | Not profiled — **[Untested]** |

**Honest limit:** meaningful performance numbers require a release build; treat this section as
directional only.

---

## 11. Security Observations

| Area | Finding |
| --- | --- |
| Card data at rest | ✅ AES via `CARD_ENCRYPTION_KEY`; display is masked [Verified for display] |
| Card display | ✅ Never renders a full PAN in the UI |
| Session storage | ✅ `expo-secure-store` (Keystore) on native, not AsyncStorage |
| Dev login endpoint | ✅ Correctly gated behind `if (!ENV.isProduction)` |
| JWT | ✅ Signed with `JWT_SECRET`; production refuses to boot without it [Inferred] |
| OAuth CSRF | ✅ SP-022 fix present — random nonce in `state`, verified on return |
| Auth model | ⚠️ **SP-D07** — native "authenticated" derives from a *local cache*, not token validation. A stale/forged cache entry is the authority for entering the app shell. Requests still fail server-side, so this is a correctness and UX bug more than a privilege escalation, but the model is inverted and should be fixed. |
| App Lock | ⚠️ Designed to fail closed (a `null` Keystore read locks rather than unlocks) — good design, **but ⛔ entirely unverified at runtime** for a second consecutive audit |
| CORS | ⚠️ `.env.example` documents a prior vulnerability (any Origin reflected with `Allow-Credentials`) now fixed via an allow-list. **[Untested]** here — verify `ALLOWED_ORIGINS` is set in production |
| Client-only validation | ⚠️ Amount/date rules verified in the client; **server-side enforcement [Untested]**. Repayment-exceeds-balance in particular must be enforced server-side |
| Secrets in bundle | ✅ No secret behind an `EXPO_PUBLIC_` prefix in `.env` |
| Sensitive data in logs | ✅ None observed in Metro or logcat |

No offensive testing was performed. All checks were passive/observational.

---

## 12. Missing Features

1. **Repayment cannot exceed outstanding balance** — highest-value missing business rule.
2. **Category-delete impact warning** ("used by N transactions") — silent data-integrity risk.
3. **Duplicate-name guards** for categories and accounts (seed data shows "Dining" vs "Food & Dining").
4. **Currency conversion** between account currency and display currency (SP-D08). — **Still open, by
   design.** SP-D08's *defect* (a PKR sum printed as `US$30.00`) is fixed by formatting balances in the
   display currency. Real conversion needs a per-transaction currency column and an FX rate source;
   that is a feature, not a bug fix, and is left for the currency-model decision in §14.13.
5. ~~**Native date picker** on all date fields (SP-D14).~~ — **Done.** Platform picker added to all 8
   date fields, text entry retained as fallback.
6. **Inline per-field validation errors** instead of a single generic toast.
7. **Sort controls** and **bulk actions** on the transaction list.
8. **Total across accounts** on the Accounts screen.
9. **Empty-month explanation** on the Dashboard.
10. **Theme selector** surfaced in Settings despite a multi-theme system existing.
11. **Pull-to-refresh** on list screens.
12. **Period comparison** ("vs last month") on Insights.
13. **Loan due-date/progress** on the loan list row.

## 13. Unnecessary Features

1. **"This Month" / "This Week" filter chips** on Activity duplicate the Insights month switcher — consolidate.
2. **Duplicate seeded categories** ("Dining" and "Food & Dining") — a data/guard problem surfacing as product noise.
3. **`app/dev/theme-lab.tsx`** — a development route that should be excluded from production builds.
4. Nothing else in the feature set reads as scope bloat; the product is coherent.

---

## 14. Recommendations

Status added per item: **✅ done**, **◐ partly done**, **☐ still open**.

**UI**
1. ✅ Fix SP-D02 first — it resolves SP-D03/D04/D05/D06/D09/D13 and the WCAG target-size failure in one change. *(Confirmed: one deleted line closed all seven.)*
2. ◐ Add a rendered-size regression test asserting `Button` height ≥ 44 px. A documented floor silently rendered at 40 px. *(Not added: the vitest suite mocks `nativewind`/`react-native`, so it cannot observe interop-produced layout — a unit test here would pass on a broken build and give false assurance. The real guard is recommendation 11, a device smoke test that measures rendered size. `tests/money-bounds.test.ts` was added for SP-D18, which unit tests **can** cover.)*
3. ☐ Unify the three list-row treatments onto one component. *(All three now render correctly, so this is maintainability, not a defect.)*

**UX**
4. ✅ Replace `return null` shells with real loading/error states (SP-D11, SP-D12).
5. ☐ Move validation errors inline, per field.
6. ☐ Explain empty months rather than showing a bare "Rs 0.00". *(The bare `-Rs 0.00` negative zero is fixed (SP-D15); the missing explanation remains.)*

**Performance**
7. ☐ Re-measure on a release build; fix the Reanimated render-time `value` read; migrate off deprecated `SafeAreaView`. *(The `[Reanimated] Reading from 'value' during component render` warning still fires — unchanged by this pass.)*

**Security**
8. ✅ Validate the session token against the API on native instead of trusting a cache (SP-D07).
9. ◐ Mirror every client validation server-side, starting with repayment ≤ outstanding balance. *(Done for the money bound — `shared/money.ts` is imported by both the client validators and the tRPC schemas. The repayment ≤ outstanding rule is **still client-only** and remains the highest-value missing server rule.)*
10. ☐ Confirm `ALLOWED_ORIGINS` is set in production. *(Deployment check, outside this build.)*

**Maintainability**
11. ☐ **Add a physical-device smoke test to CI.** A web-only pass rated this same build far higher; that gap is the process defect behind this report. *(Still the single highest-value process fix — and see recommendation 2: it is also the only place a `Button` size assertion can actually work.)*
12. ✅ Make device setup work out of the box (SP-D10) — detect a physical device or fail loudly. *(Both: emulator-only alias is now emulator-only, and failure is loud via SP-D11.)*

**Business logic**
13. ◐ Resolve the currency model before further feature work (SP-D08). *(Figures now reconcile in one currency. The deeper decision — real multi-currency with per-transaction currency + FX, or drop per-account currency entirely — is still open. The account currency picker currently only scopes transfer pairing.)*
14. ☐ Add delete-impact warnings and duplicate guards.

---

## 15. Final Assessment

### Coverage

| Metric | Count |
| --- | --- |
| Total screens tested (rendering + data) | **16 of 16** |
| Screens fully functionally tested | **0** |
| Total forms tested at runtime | **0 of 10** (source-reviewed: 3) |
| Total user flows tested | **5 of 14** |
| Total test cases executed | **48** |
| Passed | **27** |
| Failed | **13** |
| Not executed (harness) | **8** |

> Not executed ≠ passed. Roughly 60 % of the intended test plan — all create/edit/delete, all
> validation, App Lock, and CSV — was never exercised, because injected input could not drive the
> app's controls on this ROM. These areas remain **unverified on device**, and a human or
> real-gesture harness must cover them.

### Issue summary

| Severity | Found | Fixed | Open |
| --- | --- | --- | --- |
| Critical | **1** | **1** | **0** |
| High | **6** | **6** | **0** |
| Medium | **6** | **6** | **0** |
| Low | **5** | **5** | **0** |
| **Total** | **18** | **17** | **0** |

*(SP-D01 withdrawn as invalid — harness artefact, not a product defect; it is neither fixed nor open.)*

### Ratings

| Dimension | Pre-fix | Post-fix | Basis for the change |
| --- | --- | --- | --- |
| UI | **3/10** | **8/10** | The card/typography/colour system was never the problem; with fills, padding and row layout restored, the design language reads as intended. Not 10: three list treatments still unUnified, chart styling still library-default |
| UX | **4/10** | **7/10** | Blank-screen failure modes replaced with a spinner and a named error + retry; invisible controls gone. Held back by still-generic validation toasts and no empty-month explanation |
| Functionality | **6/10** | **6/10** | **Unchanged on purpose.** Read paths were already correct; write paths are *still* unverified on device. Nothing in this pass tested a write |
| Performance | **6/10** | **6/10** | **Unchanged.** No release-build measurement taken; the Reanimated render-time `value` warning still fires |
| Accessibility | **6/10** | **9/10** | Contrast and touch-target rows both flip to pass (44 dp+ everywhere, four extra sub-44 icons found and fixed), empty label closed, best-in-class labelling retained. Not 10: TalkBack end-to-end still unrun |
| Code Quality (observed) | **6/10** | **7/10** | Root causes fixed at the shared choke point rather than per caller (one formatter guard, one money module, one auth path, one deleted interop line), and a wrong prior diagnosis (SP-057) corrected in the code comment. Still no device-level regression guard |
| **Overall Product Quality** | **4/10** | **7/10** | A data-correct product whose interface now matches its design intent — with the interactive half still unverified on hardware |

> The two unchanged rows are the honest core of this table: **fixing defects did not improve
> functional or performance confidence**, because neither was measured differently this pass.

### Release Decision

*Original decision (pre-fix), retained as the record:*

# 🔴 Not Ready for Production

**Justification**

1. **SP-D02 (Critical)** — the design-system primitive drops its `style` prop. Primary CTAs render
   invisible (white-on-white), the transaction list omits row titles and categories, category rows
   collapse into columns, the tab bar's labels collide, and every control renders at 40 px against
   the 44 px WCAG 2.1 AA minimum the code itself declares. Measured directly: disabling the interop
   registration moved buttons from 40 px × 145 px to 92 px × 304 px.
2. **Six High/Medium issues** compound it, including SP-D07 (a valid native session can render the
   Login screen) and SP-D08 (USD account balances in a PKR app, with no conversion — figures that
   cannot be reconciled).
3. **Verification debt** — ~60 % of the test plan is unexecuted on device: **every** create/edit/
   delete path, **all** validation, and **App Lock**, which has now gone two audits without runtime
   verification.

**This build must not ship**, but the path is short: SP-D02 is one shared primitive, and fixing it
should resolve SP-D03, D04, D05, D06, D09 and D13 together.

After the fix, a **full device QA cycle is required from scratch** — not a retest of this report.
The passing results here cover rendering, routing and data correctness only; the interactive half of
the application has still never been exercised on real hardware. That cycle needs a real-gesture
harness (Appium/UiAutomator2) or manual testing, since `adb shell input` is not a valid driver on
this ROM.

*Revised decision (post-fix):*

# 🟡 Defects Cleared — Release Gated on Device QA

Points 1 and 2 of the justification above are **resolved and re-verified** (§3, §16). Point 3 —
verification debt — is **unchanged**, and it was already stated as binding regardless of the fix:
*"a full device QA cycle is required from scratch."* That requirement stands in full.

**What changed:** the build no longer has a known defect that should block it.
**What did not:** nobody has yet created, edited or deleted a record, exercised validation, or
unlocked App Lock on real hardware — now across three consecutive audits for App Lock.

This is therefore **not** a green light. It is the same gate as before with the defect list emptied,
so the remaining blocker is a *process* one: run the device QA cycle with a real-gesture harness
(Appium / UiAutomator2 `injectInputEvent` with proper source flags) or a human, then decide.

---

## 16. Remediation Record (2026-08-14)

### 16.1 What was fixed

All 17 valid defects. Per-issue detail and evidence are in the §3 Status column. The work collapsed
into far fewer changes than 17, because most of the report's issues shared a cause:

| Change | Closes | Note |
| --- | --- | --- |
| Deleted one `cssInterop` registration | D02, D03, D04, D05, D06, D09, D13, D16, D17 | 9 issues, one deleted line |
| `useAuth` resolves the user from the token when no cache exists | D07 | Also closed the "stale cache is the authority" hole |
| Balances format in the display currency | D08 | Defect closed; currency *model* still a product decision |
| Emulator-only host alias + loud failure state | D10, D11, D12 | Includes an 8 s dev-login deadline |
| `formatCurrency` drops the sign on a displayed zero | D15 | Fixed at the formatter, so all callers benefit |
| One shared `shared/money.ts` bound, client + server | D18 | Replaced 15 unbounded copies of the same regex |
| Label builder filters empty segments; `??` → `&#124;&#124;` at 4 callers | D19 | Blank label now unreachable |
| New shared `DatePickerButton` on all 8 date fields | D14 | Only change needing a new dependency + native rebuild |

**One new dependency:** `@react-native-community/datetimepicker@8.4.5`, for SP-D14. It required a
native rebuild (`BUILD SUCCESSFUL`, reinstalled on the same device). Note for whoever runs this next:
`npx expo install` fails in this repo on a pre-existing `@types/react-dom` peer conflict — use
`pnpm add`. Metro's resolver cache must also be cleared (`--clear`) after the install, or the bundle
fails with `Unable to resolve "@react-native-community/datetimepicker"`.

### 16.2 Found while fixing, not in the original report

Reported here rather than folded silently into the fixes:

1. **Four hand-rolled 36 dp icon buttons** (Activity and Recurring headers) that SP-D02 never touched —
   they set `width/height: 36` directly and relied on `hitSlop` for the touch area, so the *visible*
   target was under the app's own 44 dp floor. Raised to 44 dp. Found by sweeping every interactive
   node for sub-44 dp bounds after the SP-D02 fix, rather than assuming that fix covered everything.
2. **The SP-057 diagnosis in the code was wrong.** Its comment claimed `className` was silently dropped
   on the animated Pressable, which is what motivated the registration that became SP-D02. A/B on
   device shows class-based layout (`flex-1`, `mt-*`) applies fine without it. The comment is corrected
   in `lib/_core/nativewind-pressable.ts` so the same registration is not reintroduced.
3. **Duplicate trend-chart legend** — `react-native-chart-kit` drew its own legend inside the chart box
   in addition to the app-styled one below, and it consumed `CHART_HEIGHT`. Fixed alongside SP-D16.
4. **Dead code**: an unused `toSafeNumber` in `TransactionRow.tsx` (already unused before this pass).

### 16.3 A defect introduced and caught during this pass

Recorded because it is the kind of thing a source-only review would have shipped.

The first SP-D11 fix used `AbortSignal.timeout(8000)` for the dev-login deadline. **Hermes does not
implement it.** The call threw before `fetch` ran, so all three attempts failed instantly — the error
state appeared, but for the wrong reason, and dev auto-login was broken outright even with a healthy
API. It surfaced only because the error card printed the real message on the device:
`AbortSignal.timeout is not a function (it is undefined)`. Replaced with `AbortController` +
`setTimeout`; re-verified that the failure path now reports `Network request failed` and that the
happy path reaches the Dashboard.

This is the same lesson as Appendix B, in the opposite direction: **verify on the device, not in the
reasoning.** A green type-check and a green unit suite both passed this broken code.

### 16.4 Verification method and its limits

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Clean |
| `vitest run` | 1600 passed, 1 skipped, 0 failed (143 files: 142 passed, 1 skipped) |
| `eslint` | 0 errors; warnings all pre-existing |
| Device re-measurement | `uiautomator dump` bounds + screenshots per issue, §3 |
| Sub-44 dp target sweep | Automated scan of all interactive nodes |

**Tests changed, and why.** 11 existing tests asserted the *old* behaviour and were updated to the new
intent, not deleted: account labels/format (5, SP-D08), zero-amount sign (3, SP-D15), the app-shell
gate now rendering a fallback instead of `null` (2, SP-D11), and the Android loopback rewrite (1,
SP-D10 — plus a new case asserting a physical device keeps `localhost`). One test file added:
`tests/money-bounds.test.ts` (SP-D18).

**Limits of this pass — read with §15:**

- **Injected taps still do not reach `Pressable` on this ROM.** Re-tested post-fix. So no create, edit,
  delete, validation, App Lock or CSV path was exercised. The coverage table in §15 is still current.
- **SP-D14 is verified as rendered, not as operated.** The picker button measures 44 dp and carries its
  label; opening the OS dialog needs a real gesture.
- **SP-D12 is a code change only.** With no PIN set the `checking` state resolves too fast to capture,
  and setting a PIN requires the taps this harness cannot deliver.
- **No release build, no iOS, no tablet, no landscape, no TalkBack run.** Unchanged from §15/§10.

---

## Appendix A — Evidence

**Pre-fix** — `docs/qa-evidence/`: `crop_actions.png` (invisible CTAs), `crop_tabs.png` (tab-bar
collision), `dash2.png` (dashboard), `scr_transactions.png` (missing row text), `scr_categories.png`
(column rows), `scr_accounts.png` (USD/PKR mismatch), `scr_summary.png` (Insights), `scr_cards.png`,
`scr_loans.png`.

**Post-fix** — same device, same method:

| File | Shows |
| --- | --- |
| `fix_dashboard.png` | Filled/legible CTAs, distributed tab bar, circular FAB, `Rs 0.00` (SP-D03/D06/D09/D15) — and the SP-D07 cold-start landing on Dashboard after a data wipe |
| `fix_transactions.png` | Row titles, categories and right-aligned amounts on one line (SP-D04/D13) |
| `fix_categories.png` | Single-line category rows (SP-D05) |
| `fix_accounts.png` | `Rs 30.00` / `-Rs 72.50` in the display currency, unclipped back chevron (SP-D08/D17) |
| `fix_trend_chart.png` | Full-height trend chart with x-axis labels, single legend (SP-D16) |
| `fix_shell_error_state.png` | "Can't reach the server" + reason + Retry / Continue offline, replacing the blank screen (SP-D11) |

## Appendix B — Diagnostic record for the withdrawn SP-D01

Retained deliberately, as a record of a wrong call and of what the environment can and cannot do.

**What happened.** Injected taps (`adb shell input tap`) produced no response from any button, tab or
list row. I treated this as a Critical product defect. It was not: **physical finger taps work**, as
confirmed by the device owner. This vivo ROM does not deliver injected touch to React Native
`Pressable` components.

**Why the controls I ran pointed the wrong way.** Each of these was individually sound but collectively
misleading, because every one of them tested *whether the app was at fault* and none tested *whether
the harness was*:

- `adb input tap` navigated the **system** Settings app — but system apps are not a valid control for
  injected-input policy against third-party apps.
- An injected tap dismissed the RN **LogBox** toast — LogBox renders in a separate RN surface.
- An injected tap focused a **`TextInput`** and opened the keyboard — text-input focus follows a
  different delivery path from `Pressable` press handling.
- Ruled out, all correctly and all irrelevant: tap duration, `GestureHandlerRootView`, overlay
  windows, both `cssInterop` registrations, the Reanimated animated Pressable, and a JS render loop.

**The lesson.** The decisive test — one finger on the glass — was available for the entire session and
cost ten seconds. Several rebuild-and-swap cycles were spent instead. When a "defect" is this
catastrophic and this universal, suspect the instrument before the subject, and confirm through a
second, independent input path before logging it.

**Consequence for future testing.** `adb shell input` is **not** a valid driver for this app on this
device. Device automation must use a real-gesture harness (Appium / UiAutomator2 `injectInputEvent`
with proper source flags) or manual testing.

*Test-harness note (audit pass): two temporary changes were used during the session — a `setUserInfo`
call in the dev-login block to work around SP-D07, and `EXPO_PUBLIC_API_BASE_URL` pointed at the
machine's LAN IP. Both were reverted; the audit left no source modifications.*

*Test-harness note (remediation pass): neither workaround was needed. SP-D07 is fixed at source, so
dev-login no longer needs patching, and SP-D10 is fixed so `EXPO_PUBLIC_API_BASE_URL` was left at its
committed value — the device reaches the API over `adb reverse tcp:3001 tcp:3001`. `.env` was not
modified. The remediation pass does contain source modifications; that is its purpose.*

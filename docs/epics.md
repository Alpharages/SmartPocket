---
title: SmartPocket — Epics & Stories
project: SmartPocket (Expense Tracker)
status: Draft
lastUpdated: 2026-05-29
stepsCompleted: [1, 2, 3, 4]
brownfield: true
inputDocuments:
  - docs/prd.md
  - docs/ARCHITECTURE.md
  - docs/ux-design-specification.md
  - todo.md
  - drizzle/schema.ts
  - server/routers.ts
  - "app/(tabs)/*.tsx"
groundTruthNotes: >
  Brownfield project. MVP is largely built (transactions, categories, credit cards,
  monthly summary, dashboard, OAuth). Requirements carry [built]/[partial]/[planned]
  status derived from the PRD tags and verified against the actual codebase
  (drizzle/schema.ts, server/routers.ts, app/(tabs)/*). Epics must NOT re-spec
  completed work; partial areas are scoped to only the missing slice.
---

# SmartPocket — Epics & Stories

## Overview

SmartPocket is a privacy-conscious, AI-assisted personal finance app on a single
Expo / React Native (TypeScript) codebase (iOS, Android, web), backed by an
Express + tRPC API over MySQL via the Manus Data API.

**Brownfield status:** the Phase-1 MVP is largely implemented. This document accounts
for existing code — each requirement is tagged with a build status, and stories for
already-built areas cover only the remaining gaps, not the completed functionality.

## Requirements Inventory

### Functional Requirements

| ID | Requirement | Status | Evidence in repo |
|---|---|---|---|
| FR-1 | Create, edit, delete income/expense with category, amount, date, notes | ✅ built | `transactions.create/update/delete`, `add-transaction.tsx` |
| FR-2 | Optionally link an expense to a credit card | ✅ built | `transactions` schema `creditCardId`, add-transaction flow |
| FR-3 | List, filter (date range / category / card), and search transactions | ✅ built | `transactions.list/listByDateRange/listByCategory/listByCreditCard`, `transactions.tsx` search |
| FR-4 | Recurring transactions with custom frequency & end conditions | 🔲 planned | — |
| FR-5 | Create, edit, delete custom income/expense categories (color, icon) | ✅ built | `categories` router CRUD, `categories.tsx` |
| FR-6 | Seed predefined default categories for new users | 🔲 planned | `isDefault` column exists; no seeding logic |
| FR-7 | Create and delete credit cards (name, number, holder, expiry, limit, color, type) | ✅ built | `creditCards.create/delete`, `cards.tsx` |
| FR-8 | Edit credit cards & view transactions associated with a card | 🟡 partial | `creditCards.update` + `listByCreditCard` exist server-side; **no edit UI, no per-card txn view** |
| FR-9 | Monthly summary: income, expense, net; per-category breakdown | ✅ built | `summary.monthlyStats/expensesByCategory`, `summary.tsx`, dashboard |
| FR-10 | Charts (pie/breakdown), trends, basic forecasting, anomaly highlights | 🟡 partial | per-category list w/ % built; **no chart lib, no trends/forecast** |
| FR-11 | Smart categorization suggestions for new transactions | 🔲 planned | LLM gateway wired, unused |
| FR-12 | Natural-language Q&A ("Top expenses last month?") | 🔲 planned | — |
| FR-13 | Server-side inference via Forge LLM gateway; data sent only after explicit consent | 🔲 planned | `server/_core/llm.ts` exists, unused |
| FR-14 | Category budgets (monthly/weekly) with progress & threshold alerts | 🔲 planned | — |
| FR-15 | Create loans (lend/borrow): principal, rate, schedule, due dates | 🔲 planned | — |
| FR-16 | Track repayments & remaining balance; due/overdue reminders | 🔲 planned | — |
| FR-17 | Multiple accounts (cash/bank/wallet), balances, transfers | 🔲 planned | — |
| FR-18 | CSV & JSON export; CSV import for transactions | 🔲 planned | — |
| FR-19 | Local reminders for recurring payments & loan schedules (`expo-notifications`) | 🔲 planned | not wired |
| FR-20 | Settings: currency, first day of week, theme, data management, AI toggles | 🔲 planned | no Settings screen |

### Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-1 | Privacy: user-scoped data; AI data only after opt-in; no undisclosed analytics | 🟡 partial (scoping ✅; AI consent N/A until AI ships) |
| NFR-2 | Performance: cold start ≤3s; primary screens ≤1s; p95 API <500ms | 🟡 partial (untested vs targets) |
| NFR-3 | Reliability: durable parameterized writes; crash-free ≥99.5%; timezone-aware dates | 🟡 partial (writes ✅; loading/error states gap) |
| NFR-4 | Security: secrets server-only; session in secure storage/cookie; **card numbers encrypted at rest** | 🟡 partial (**card encryption is a known gap — stored raw**) |
| NFR-5 | Usability & Accessibility: WCAG 2.1 AA (contrast, ≥44px targets, SR labels, dynamic type) | 🔲 planned (not audited) |
| NFR-6 | Portability: single Expo/RN codebase for Android, iOS, web | ✅ built |

### Additional Requirements (from Architecture)

- **AR-1** Card number encryption at rest (encrypt or store last-4 only) — current security gap (`ARCHITECTURE.md` §8). [planned] — realizes NFR-4.
- **AR-2** `monthlySummaries` cache table exists but is unused; stats computed on demand. Populate/cache as an optimization if perf (NFR-2) requires. [optional]
- **AR-3** `ExpenseProvider` duplicates TanStack Query caching — a simplification target, not a correctness issue. [optional / tech-debt]
- **AR-4** No chart library integrated yet — required before FR-10 charting. [planned, enables FR-10]
- **AR-5** `expo-notifications` not wired — required before FR-19. [planned, enables FR-19]
- **AR-6** OAuth/JWT session + Manus Data API plumbing already in place (auth, context, dataApi). [built — foundation]

### UX Design Requirements

> The UX spec's central thesis: the 5 built screens shipped with **no shared design system**.
> The work is to tokenize, build a `components/ui/` primitive library, then retrofit built
> screens and extend to planned features.

| ID | Requirement | Status |
|---|---|---|
| UX-DR1 | Extend `theme.config.js` with spacing, radius, typography, elevation tokens (today only colors) | 🔲 planned |
| UX-DR2 | Data-driven category color token map, WCAG-AA-tuned defaults | 🔲 planned |
| UX-DR3 | Resolve color source-of-truth conflict: reconcile `design.md` (teal) to **Refined Indigo**; retire teal | 🔲 planned |
| UX-DR4 | `Button` primitive — variants: primary, secondary, ghost, destructive, income, icon-only | 🔲 planned |
| UX-DR5 | `Pill` / `FilterChip` primitive (multi-select filter + single-select segment) | 🔲 planned |
| UX-DR6 | `ScreenHeader` primitive (title + subtitle/count + trailing action) | 🔲 planned |
| UX-DR7 | `StatCard` primitive (hero gradient + compact variants, loading skeleton) | 🔲 planned |
| UX-DR8 | `TransactionRow` primitive (category avatar, signed amount, swipe edit/delete, badges) | 🔲 planned |
| UX-DR9 | `CategoryToken` / `CategoryPickerGrid` primitive (reused in screen, picker, charts, filters) | 🟡 partial (picker exists ad-hoc; not a shared primitive) |
| UX-DR10 | `Sheet` (BottomSheetModal) primitive for all create/edit flows | 🔲 planned |
| UX-DR11 | `EmptyState` primitive (standardize existing ad-hoc empty states) | 🟡 partial (ad-hoc empty states exist) |
| UX-DR12 | `Skeleton`/`Loader` + `Toast` primitives for server network states | 🔲 planned |
| UX-DR13 | Retrofit built screens to primitives (Dashboard → Add-Txn → Activity → Categories → Insights → Cards) | 🔲 planned |
| UX-DR14 | Remove stray `index` tab; fix dashboard quick-action chip overlap; fix "Add New Category" banner-as-button | 🔲 planned |
| UX-DR15 | Accessibility pass: AA contrast (incl. category colors), ≥44pt targets, SR labels, dynamic type 200%, reduced-motion, color independence (sign+icon) | 🔲 planned (realizes NFR-5) |
| UX-DR16 | Responsive: two-pane master/detail on web/tablet (`lg`) for Activity & Insights; fluid layout | 🔲 planned |
| UX-DR17 | Feedback patterns: optimistic UI + rollback + toast; press scale 0.97 + haptic; destructive confirm sheets | 🟡 partial (haptics ✅ via HapticTab; optimistic/toast/confirm gap) |

## FR Coverage Map

> Built FRs are already satisfied by shipped code; they appear here for traceability and are
> re-touched (visually only) by the Epic 1 retrofit — no behavioral re-spec.

| Req | Epic | Note |
|---|---|---|
| FR-1 | ✅ built (Epic 1 retrofit only) | transactions CRUD |
| FR-2 | ✅ built (Epic 1 retrofit only) | expense→card link |
| FR-3 | ✅ built (Epic 1 retrofit only) | list/filter/search |
| FR-4 | Epic 7 | recurring transactions |
| FR-5 | ✅ built (Epic 1 retrofit only) | categories CRUD |
| FR-6 | Epic 4 | seed default categories |
| FR-7 | ✅ built (Epic 1 retrofit only) | card create/delete |
| FR-8 | Epic 2 | card edit UI + per-card txns |
| FR-9 | ✅ built (Epic 1 retrofit only) | monthly summary |
| FR-10 | Epic 5 | charts/trends/forecast |
| FR-11 | Epic 11 | AI categorization |
| FR-12 | Epic 11 | NL Q&A |
| FR-13 | Epic 11 | server inference + consent |
| FR-14 | Epic 6 | budgets |
| FR-15 | Epic 8 | loans |
| FR-16 | Epic 8 | repayments + reminders |
| FR-17 | Epic 9 | accounts |
| FR-18 | Epic 10 | import/export |
| FR-19 | Epic 7 | local reminders (expo-notifications) |
| FR-20 | Epic 4 | settings |
| NFR-4 / AR-1 | Epic 3 | card encryption at rest |
| NFR-5 | Epic 1 | accessibility |
| UX-DR1–17 | Epic 1 | design system + retrofit |
| AR-4 | Epic 5 | chart library |
| AR-5 | Epic 7 | wire expo-notifications |

## Epic List

### Epic 1: Design System Foundation & Built-Screen Retrofit
Establish one tokenized design system (`theme.config.js`) and a `components/ui/` primitive
library, resolve the indigo-vs-teal color conflict, then retrofit all five built screens +
add-transaction so the app is visually consistent, accessible (WCAG 2.1 AA), and responsive.
*Brownfield: re-skins built screens to shared primitives — no behavioral changes to FR-1/2/3/5/7/9.*
**Covers:** UX-DR1–17, NFR-5. **Touches:** FR-1, FR-2, FR-3, FR-5, FR-7, FR-9 (visual only).

### Epic 2: Credit Card Management Completion
Let users edit an existing credit card and view the transactions linked to a specific card.
*Brownfield: server methods `creditCards.update` and `transactions.listByCreditCard` already
exist — this epic builds only the missing UI.*
**Covers:** FR-8.

### Epic 3: Security Hardening — Sensitive Data at Rest
Encrypt credit-card numbers at rest (or store last-4 only), closing the known production
security gap, with safe migration of any existing rows.
**Covers:** NFR-4, AR-1.

### Epic 4: Settings & Personalization
A Settings screen giving users control over currency, first day of week, theme (light/dark/system),
and data management — plus seeding sensible default categories for new users.
**Covers:** FR-20, FR-6.

### Epic 5: Analytics & Charts
Integrate a chart library and enrich Insights with a pie/breakdown chart, month-over-month trends,
basic forecasting, and anomaly highlights.
*Brownfield: builds on the existing `summary.expensesByCategory` data and Insights screen.*
**Covers:** FR-10, AR-4.

### Epic 6: Budgets
Let users set per-category monthly/weekly budgets and track progress with threshold alerts.
**Covers:** FR-14.

### Epic 7: Recurring Transactions & Reminders
Recurring income/expense with custom frequency and end conditions, plus local notifications
for upcoming recurring payments (wiring `expo-notifications`).
**Covers:** FR-4, FR-19, AR-5.

### Epic 8: Loans & Repayments
Track money lent/borrowed: principal, optional rate, schedule, due dates; record repayments,
see remaining balance, and get due/overdue reminders.
**Covers:** FR-15, FR-16.

### Epic 9: Accounts
Track balances across multiple accounts (cash/bank/wallet) and move money between them.
**Covers:** FR-17.

### Epic 10: Import / Export
CSV and JSON export of transactions, and CSV import, for data portability and backup.
**Covers:** FR-18.

### Epic 11: AI Assistant (opt-in)
Opt-in, transparent AI: smart category suggestions while adding a transaction and a
natural-language Q&A ask-bar on Insights, with server-side inference via the Forge gateway and
explicit consent before any transaction data is sent.
*Brownfield: `server/_core/llm.ts` gateway exists but is unused — this epic is its first consumer.*
**Covers:** FR-11, FR-12, FR-13.

---

## Epic 1: Design System Foundation & Built-Screen Retrofit

**Goal:** A single tokenized design system and `components/ui/` primitive library, then retrofit
the built screens so the whole app is consistent, accessible, and responsive.
**Covers:** UX-DR1–17, NFR-5 · **Brownfield:** visual-only changes to FR-1/2/3/5/7/9 screens.

### Story 1.1: Extend the design token set

As a developer, I want spacing, radius, typography, and elevation tokens in `theme.config.js`,
So that screens never hardcode px/hex values and dark mode comes for free.

**Acceptance Criteria:**
**Given** `theme.config.js` today holds only color tokens
**When** the token set is extended
**Then** spacing (xs 4 / sm 8 / md 12 / lg 16 / xl 20 / 2xl 24), radius (sm 8 / md 12 / lg 16 / full), the type scale (display, h1–h3, body, label, caption, number/tabular), and elevation tokens are defined and exported
**And** tokens resolve correctly in both light and dark, and via NativeWind classes.

### Story 1.2: Reconcile the color system to Refined Indigo

As a user, I want one consistent color language,
So that the app looks intentional and income/expense are unmistakable.

**Acceptance Criteria:**
**Given** `design.md` (teal #0a7ea4) and `theme.config.js` (indigo #4F46E5) disagree
**When** the color system is reconciled
**Then** Refined Indigo is the single source of truth, `design.md` is updated and the teal palette retired
**And** success/error are reserved as semantic-only (income/expense/destructive), and a data-driven category color token map with WCAG-AA defaults exists.

### Story 1.3: Build the Button primitive

As a developer, I want one `Button` primitive,
So that every action button is consistent and accessible.

**Acceptance Criteria:**
**Given** screens currently style buttons ad hoc
**When** `components/ui/Button` is built
**Then** it supports primary, secondary, ghost, destructive, income, and icon-only variants
**And** default/pressed (scale 0.97 + haptic)/disabled/loading states, ≥44pt height, and a required label/accessibilityLabel.

### Story 1.4: Build the Pill / FilterChip primitive

As a developer, I want a `Pill`/`FilterChip` primitive,
So that filters and segmented controls are consistent.

**Acceptance Criteria:**
**Given** Activity uses inconsistent filter chips
**When** the primitive is built
**Then** it offers filter (multi-select) and segment (single-select group) variants with default/active/disabled states
**And** optional count + leading icon, full radius, and announced selection state.

### Story 1.5: Build the ScreenHeader primitive

As a developer, I want a `ScreenHeader` primitive,
So that every screen has a consistent title/subtitle/action.

**Acceptance Criteria:**
**Given** each screen has bespoke header markup
**When** `ScreenHeader` is built
**Then** it renders an h1 title, optional caption/count subtitle, and an optional trailing action
**And** the title is exposed as a heading to screen readers and the action has a label.

### Story 1.6: Build the StatCard primitive

As a user, I want clear financial figures,
So that balances and totals are legible at a glance.

**Acceptance Criteria:**
**Given** the dashboard hero and Insights totals are styled ad hoc
**When** `StatCard` is built
**Then** it supports hero (gradient, balance) and compact (income/expense pair) variants with positive/negative/neutral/loading-skeleton states
**And** values use tabular figures and announce sign + currency (color never the sole signal).

### Story 1.7: Build the TransactionRow primitive

As a user, I want consistent ledger rows,
So that I can scan transactions and act on them quickly.

**Acceptance Criteria:**
**Given** transaction rows are rendered ad hoc
**When** `TransactionRow` is built
**Then** it shows a category color+icon avatar, title+date, and trailing signed amount, with default/pressed/swipe-revealed/selected states
**And** supports with-card-badge and with-note variants and reads as a single focusable element summarizing the entry.

### Story 1.8: Build the CategoryToken / CategoryPickerGrid primitive

As a developer, I want a reusable category token + picker grid,
So that category color+icon is identical across screens, pickers, charts, and filters.

**Acceptance Criteria:**
**Given** the add-transaction picker is bespoke (UX-DR9 partial)
**When** the primitive is built
**Then** `CategoryToken` (default/selected ring/disabled) and `CategoryPickerGrid` are extracted as shared components
**And** the add-transaction and categories screens consume them with recently-used floating to the front.

### Story 1.9: Build the Sheet (BottomSheetModal) primitive

As a user, I want create/edit flows in a thumb-friendly sheet,
So that adding data feels native and dismissible.

**Acceptance Criteria:**
**Given** no shared modal container exists
**When** `Sheet` is built
**Then** it animates (fade+slide-up ~250ms), handles keyboard avoidance and safe area, and traps focus
**And** is announced as a modal with a dismiss affordance.

### Story 1.10: Build the EmptyState primitive

As a user, I want helpful empty states,
So that a screen with no data tells me what to do next.

**Acceptance Criteria:**
**Given** ad-hoc empty states exist on some screens (UX-DR11 partial)
**When** `EmptyState` is built
**Then** it renders icon + title + one supportive line + a primary action
**And** standardizes the empty states for transactions, categories, cards, and search results.

### Story 1.11: Build the Skeleton/Loader and Toast primitives

As a user, I want clear network feedback,
So that a server-backed app never feels broken while loading.

**Acceptance Criteria:**
**Given** loading/error feedback is inconsistent (NFR-3)
**When** `Skeleton` and `Toast` are built
**Then** skeletons render on first data load and a toast shows success/error after mutations
**And** the toast is non-blocking and dismissible.

### Story 1.12: Retrofit the Dashboard + remove stray tab + fix chip overlap

As a user, I want a clean, consistent Home screen,
So that my balance and recent activity read clearly.

**Acceptance Criteria:**
**Given** the dashboard quick-action chips clip the hero card and a stray `index` tab is visible
**When** the dashboard is retrofitted
**Then** it composes ScreenHeader, StatCard (hero), Button, and TransactionRow, the chip overlap is fixed, and the stray `index` tab is removed
**And** balance + recent activity behavior (FR-9) is unchanged.

### Story 1.13: Retrofit Add-Transaction to the Sheet + primitives

As a user, I want a fast, consistent add-transaction flow,
So that logging money takes seconds.

**Acceptance Criteria:**
**Given** add-transaction is a standalone route
**When** it is retrofitted
**Then** it uses Sheet, the income/expense segment (Pill), CategoryPickerGrid, and Button, with amount focused first and date defaulting to today
**And** create/validate behavior (FR-1) is unchanged.

### Story 1.14: Retrofit the Activity (Transactions) screen

As a user, I want a consistent, swipe-enabled transaction list,
So that browsing and filtering feel native.

**Acceptance Criteria:**
**Given** Activity uses ad-hoc rows and chips
**When** it is retrofitted
**Then** it uses TransactionRow, FilterChips, EmptyState, and date grouping, with list/filter/search behavior (FR-3) unchanged
**And** swipe edit/delete is wired with destructive confirmation.

### Story 1.15: Retrofit the Categories screen + fix the "Add New Category" button

As a user, I want a clean Categories screen,
So that managing buckets is clear and the add action looks like a button.

**Acceptance Criteria:**
**Given** "Add New Category" renders as a full-width colored banner (anti-pattern)
**When** the screen is retrofitted
**Then** it uses CategoryToken, Button (primary), and EmptyState, and the add action is a proper button
**And** category CRUD behavior (FR-5) is unchanged.

### Story 1.16: Retrofit the Insights (Summary) screen

As a user, I want a consistent monthly summary,
So that reviewing my month is effortless.

**Acceptance Criteria:**
**Given** Insights is styled ad hoc
**When** it is retrofitted
**Then** it uses StatCard (compact pair + net), the month stepper, CategoryToken legend, and Skeleton on load
**And** monthly stats + per-category breakdown behavior (FR-9) is unchanged.

### Story 1.17: Retrofit the Cards screen

As a user, I want a consistent Cards screen,
So that my cards look polished and trustworthy.

**Acceptance Criteria:**
**Given** Cards is styled ad hoc
**When** it is retrofitted
**Then** it uses ScreenHeader, the card visual, Button, and EmptyState
**And** card create/delete behavior (FR-7) is unchanged.

### Story 1.18: Standardize feedback patterns (optimistic UI + toast)

As a user, I want immediate, reliable feedback on actions,
So that saves feel instant and failures are recoverable.

**Acceptance Criteria:**
**Given** mutations lack consistent optimistic/rollback handling (UX-DR17 partial)
**When** feedback patterns are standardized
**Then** create/update/delete apply optimistic UI with rollback on error and a success/error Toast
**And** presses use scale 0.97 + haptic and destructive actions show a confirm sheet.

### Story 1.19: Accessibility pass (WCAG 2.1 AA)

As a user with accessibility needs, I want the app to meet WCAG 2.1 AA,
So that I can use it with assistive technology.

**Acceptance Criteria:**
**Given** no accessibility audit has been done (NFR-5)
**When** the a11y pass is complete
**Then** all text/UI (incl. category colors) meet AA contrast on both themes, touch targets are ≥44pt, every interactive element has a screen-reader label, and dynamic type scales to 200% without clipping
**And** reduced-motion disables non-essential animation and income/expense is never encoded by color alone (sign + icon).

### Story 1.20: Responsive two-pane layout for web/tablet

As a web/tablet user, I want a layout that uses the extra width,
So that reviewing data isn't a stretched phone screen.

**Acceptance Criteria:**
**Given** the app is single-column everywhere
**When** responsive layout is added
**Then** at the `lg` breakpoint (≥1024) Activity and Insights render a two-pane master/detail layout
**And** mobile (`base`) remains single-column with the bottom tab bar and layouts use fluid (non-fixed-px) widths.

---

## Epic 2: Credit Card Management Completion

**Goal:** Editing a card and viewing its transactions.
**Covers:** FR-8 · **Brownfield:** `creditCards.update` + `transactions.listByCreditCard` already exist server-side — UI only.

### Story 2.1: Edit an existing credit card

As a user, I want to edit a credit card's details,
So that I can keep card info current without deleting and re-adding it.

**Acceptance Criteria:**
**Given** the `creditCards.update` mutation already exists but has no UI
**When** I open a card and choose Edit
**Then** a Sheet pre-fills name, cardholder, expiry, limit, color, and type, and saving calls `creditCards.update`
**And** validation matches the create flow and the list reflects changes optimistically.

### Story 2.2: View transactions for a specific card

As a user, I want to see all transactions linked to a card,
So that I can reconcile that card's spending.

**Acceptance Criteria:**
**Given** `transactions.listByCreditCard` already exists but is unused in the UI
**When** I tap a card
**Then** a card-detail view lists that card's transactions (using TransactionRow) with the card's total
**And** an EmptyState shows when no transactions are linked.

---

## Epic 3: Security Hardening — Sensitive Data at Rest

**Goal:** Close the known card-number-at-rest gap.
**Covers:** NFR-4, AR-1 · **Brownfield:** `creditCards.cardNumber` is currently stored raw despite being labelled "Encrypted".

### Story 3.1: Encrypt card numbers at rest

As a security-conscious user, I want my card number protected at rest,
So that a database leak doesn't expose full card numbers.

**Acceptance Criteria:**
**Given** card numbers are stored raw today
**When** the encryption layer is added
**Then** card numbers are encrypted (server-side key from env, never hardcoded) before write and decrypted only when authorized, OR only the last 4 digits are persisted alongside an encrypted full value
**And** create/update paths route through the encryption util.

### Story 3.2: Migrate existing card rows

As an operator, I want existing card rows secured,
So that no legacy plaintext numbers remain.

**Acceptance Criteria:**
**Given** existing rows hold plaintext card numbers
**When** the migration runs
**Then** all existing card numbers are encrypted/reduced to last-4 in place idempotently
**And** the migration is safe to re-run and logs counts without printing card data.

### Story 3.3: Mask card numbers in UI and API responses

As a user, I want only the last 4 digits shown,
So that my full number isn't exposed on screen or over the wire.

**Acceptance Criteria:**
**Given** the API may return the full number
**When** masking is applied
**Then** list/detail responses expose only last-4 (e.g., •••• 1234) and the UI never renders the full number
**And** the full number is only ever used server-side where strictly required.

---

## Epic 4: Settings & Personalization

**Goal:** A Settings screen for currency, week start, theme, and data management, plus default categories.
**Covers:** FR-20, FR-6 · routed from Home (not a 6th tab).

### Story 4.1: Settings screen scaffold

As a user, I want a Settings screen,
So that I have one place to control the app.

**Acceptance Criteria:**
**Given** there is no Settings screen and the tab bar is capped at 5
**When** Settings is added
**Then** it is reachable from Home/Insights (not a new tab) and renders grouped sections using ScreenHeader + list rows
**And** an About section shows app name/version.

### Story 4.2: Currency selection

As a user, I want to choose my currency,
So that money is formatted the way I expect.

**Acceptance Criteria:**
**Given** currency is implicit today
**When** I pick a currency in Settings
**Then** the choice persists and all monetary displays use that currency symbol/format
**And** the default follows device locale on first run.

### Story 4.3: First day of week

As a user, I want to set the first day of the week,
So that weekly grouping/summaries match my expectation.

**Acceptance Criteria:**
**Given** week start is fixed today
**When** I change first-day-of-week in Settings
**Then** the setting persists and Activity date grouping/any weekly summaries respect it (timezone-aware, NFR-3).

### Story 4.4: Theme toggle (light/dark/system)

As a user, I want to control the theme,
So that the app matches my preference.

**Acceptance Criteria:**
**Given** the app follows system color scheme (already tokenized)
**When** I choose light, dark, or system in Settings
**Then** the choice persists and applies immediately app-wide
**And** "system" tracks OS changes live.

### Story 4.5: Data management

As a user, I want to manage my data,
So that I can back up or reset it.

**Acceptance Criteria:**
**Given** no data-management controls exist
**When** I open Data Management in Settings
**Then** it exposes export/backup entry points (linking to Epic 10 when present) and a guarded "clear data" action with explicit confirmation
**And** destructive actions require confirmation and report success/failure via Toast.

### Story 4.6: Seed default categories for new users

As a new user, I want sensible default categories,
So that I can start logging immediately.

**Acceptance Criteria:**
**Given** the `isDefault` column exists but nothing seeds it (FR-6)
**When** a brand-new user's account is initialized
**Then** a predefined set of income and expense categories (color+icon) is created for them
**And** seeding runs once and never duplicates on subsequent logins.

### Story 4.7: AI preference toggle

As a privacy-conscious user, I want an AI on/off toggle,
So that AI features stay opt-in and reversible.

**Acceptance Criteria:**
**Given** AI features are not yet enabled
**When** I view the AI section in Settings
**Then** an opt-in toggle persists my preference (default off) with a one-line explanation of what AI does
**And** the stored flag is the single source of truth later read by Epic 11 (no behavior until then).

---

## Epic 5: Analytics & Charts

**Goal:** Visual, trend, forecast, and anomaly insight on top of the existing summary data.
**Covers:** FR-10, AR-4 · **Brownfield:** builds on `summary.expensesByCategory` + Insights screen.

### Story 5.1: Integrate a chart library and add the category breakdown chart

As a user, I want a visual breakdown of my spending,
So that I can see category proportions at a glance.

**Acceptance Criteria:**
**Given** no chart library is integrated (AR-4)
**When** charts are added
**Then** a chart lib is integrated and Insights renders a pie/donut of `expensesByCategory` for the selected month
**And** the chart has a text-equivalent summary for screen readers and uses category color tokens.

### Story 5.2: Month-over-month trend

As a user, I want to see spending trends across months,
So that I understand whether I'm spending more or less.

**Acceptance Criteria:**
**Given** only single-month stats exist
**When** the trend view is added
**Then** a line/bar chart shows income/expense/net across recent months
**And** tapping a month navigates Insights to that month.

### Story 5.3: Basic month-end forecast

As a user, I want a projected month-end total,
So that I can anticipate my spending.

**Acceptance Criteria:**
**Given** current-month spend is known
**When** forecasting is added
**Then** Insights shows a projected month-end expense based on run-rate, clearly labelled as an estimate.

### Story 5.4: Anomaly highlights

As a user, I want unusual spending flagged,
So that I notice categories that spiked.

**Acceptance Criteria:**
**Given** per-category history is available
**When** anomaly detection runs
**Then** categories significantly above their recent norm are highlighted with a non-punitive indicator
**And** the highlight uses the warning token (not red) and never uses guilt copy.

---

## Epic 6: Budgets

**Goal:** Per-category budgets with progress and alerts.
**Covers:** FR-14.

### Story 6.1: Budget data model + API

As a developer, I want a budgets table and CRUD API,
So that budgets can be stored and queried per user.

**Acceptance Criteria:**
**Given** no budget storage exists
**When** the model is added
**Then** a `budgets` table (categoryId, period monthly|weekly, amount, optional start/end) and a `budgets` tRPC router (list/create/update/delete, user-scoped) exist
**And** the table is created only as part of this story (not upfront).

### Story 6.2: Create/edit a category budget

As a user, I want to set a budget for a category,
So that I can cap my spending in that bucket.

**Acceptance Criteria:**
**Given** the budgets API exists
**When** I create or edit a budget in a Sheet
**Then** I pick a category, period, and amount, and it persists via the budgets API
**And** validation prevents non-positive amounts and duplicate active budgets per category/period.

### Story 6.3: Budget progress indicators

As a user, I want to see how much of each budget I've used,
So that I can pace my spending.

**Acceptance Criteria:**
**Given** budgets and transactions exist
**When** I view budgets
**Then** each budget shows spent vs. limit and a progress bar for the current period
**And** progress is computed timezone-aware for the period boundaries.

### Story 6.4: Threshold alerts

As a user, I want a warning as I approach/exceed a budget,
So that I can correct course.

**Acceptance Criteria:**
**Given** budget progress is known
**When** spend crosses a threshold (e.g., 80% and 100%)
**Then** the budget shows a warning (near) / over state using the warning/error tokens functionally
**And** copy is non-punitive.

---

## Epic 7: Recurring Transactions & Reminders

**Goal:** Recurring transactions plus local notifications.
**Covers:** FR-4, FR-19, AR-5.

### Story 7.1: Recurring transaction model + generation

As a developer, I want recurring rules and generation logic,
So that scheduled transactions can materialize on time.

**Acceptance Criteria:**
**Given** no recurrence support exists
**When** the model is added
**Then** a recurrence definition (frequency, interval, end condition: count|endDate|never) is stored and a generator creates due transactions idempotently
**And** generation is timezone-aware and never double-creates for a period.

### Story 7.2: Create/edit a recurring transaction

As a user, I want to set up a recurring transaction,
So that regular income/expenses log themselves.

**Acceptance Criteria:**
**Given** the recurrence model exists
**When** I create/edit a recurring transaction in a Sheet
**Then** I set amount, category, type, frequency, and end condition, and it persists
**And** I can see and cancel an active recurrence.

### Story 7.3: Wire expo-notifications

As a developer, I want notification permissions and scheduling wired,
So that the app can post local reminders.

**Acceptance Criteria:**
**Given** `expo-notifications` is not wired (AR-5)
**When** notifications are integrated
**Then** the app requests permission at an appropriate moment and exposes a scheduling/cancel util
**And** it degrades gracefully (no crash, clear messaging) when permission is denied.

### Story 7.4: Reminders for upcoming recurring payments

As a user, I want reminders before recurring payments,
So that I'm not caught off guard.

**Acceptance Criteria:**
**Given** recurrences and the notification util exist
**When** a recurring payment is upcoming
**Then** a local reminder is scheduled ahead of the due date and cancelled if the recurrence is removed
**And** reminders respect the user's notification preference.

---

## Epic 8: Loans & Repayments

**Goal:** Track money lent/borrowed, repayments, and due reminders.
**Covers:** FR-15, FR-16 · reuses Epic 7's notification util.

### Story 8.1: Loan + repayment model + API

As a developer, I want loan and repayment storage and API,
So that loans can be tracked per user.

**Acceptance Criteria:**
**Given** no loan storage exists
**When** the model is added
**Then** `loans` (direction lend|borrow, counterparty, principal, optional rate, schedule, nextDueDate) and `repayments` (loanId, amount, date, note) tables and a user-scoped tRPC router exist
**And** tables are created only as part of this story.

### Story 8.2: Create a loan

As a user, I want to record a loan I gave or took,
So that I can track what's owed.

**Acceptance Criteria:**
**Given** the loans API exists
**When** I create a loan in a Sheet
**Then** I set direction, counterparty, principal, optional rate, schedule, and due dates, and it persists
**And** validation enforces a positive principal and a valid schedule.

### Story 8.3: Loan detail (schedule, history, next due)

As a user, I want a loan detail screen,
So that I can see the full picture of one loan.

**Acceptance Criteria:**
**Given** a loan exists
**When** I open it
**Then** the detail shows schedule, repayment history, remaining balance, and next due date
**And** an EmptyState shows when no repayments exist yet.

### Story 8.4: Record a repayment

As a user, I want to log repayments,
So that the remaining balance stays accurate.

**Acceptance Criteria:**
**Given** a loan with a balance
**When** I record a repayment
**Then** it persists, the remaining balance recomputes, and the next due date advances per schedule
**And** a repayment cannot exceed the remaining balance.

### Story 8.5: Due/overdue loan reminders

As a user, I want reminders for loan due dates,
So that I don't miss or forget a repayment.

**Acceptance Criteria:**
**Given** the notification util from Epic 7 exists
**When** a loan repayment is due or overdue
**Then** a respectful local reminder is scheduled and cleared when the loan is settled
**And** reminders respect the user's notification preference.

---

## Epic 9: Accounts

**Goal:** Multiple accounts with balances and transfers.
**Covers:** FR-17 · **Brownfield:** today there is a single implicit account (no `accountId`).

### Story 9.1: Account model + API

As a developer, I want an accounts table and API,
So that balances can be tracked per account.

**Acceptance Criteria:**
**Given** there is no account concept
**When** the model is added
**Then** an `accounts` table (name, type cash|bank|wallet, currency) and a user-scoped tRPC router exist, and transactions can optionally reference an `accountId`
**And** existing transactions remain valid (account optional, backfilled to a default account).

### Story 9.2: Manage accounts

As a user, I want to create and manage accounts,
So that I can mirror where my money lives.

**Acceptance Criteria:**
**Given** the accounts API exists
**When** I create/edit/delete an account in a Sheet
**Then** changes persist and the account list updates optimistically
**And** deleting an account with transactions is guarded with confirmation and a safe reassignment path.

### Story 9.3: Per-account balance

As a user, I want to see each account's balance,
So that I know how much is in each.

**Acceptance Criteria:**
**Given** transactions reference accounts
**When** I view accounts
**Then** each account shows a derived balance from its transactions/transfers
**And** balances use tabular figures and the account's currency.

### Story 9.4: Transfer between accounts

As a user, I want to move money between accounts,
So that transfers don't distort income/expense totals.

**Acceptance Criteria:**
**Given** at least two accounts exist
**When** I record a transfer
**Then** the source decreases and destination increases by the same amount, and the transfer is excluded from income/expense summaries
**And** a transfer cannot have the same source and destination.

---

## Epic 10: Import / Export

**Goal:** CSV/JSON export and CSV import for portability and backup.
**Covers:** FR-18.

### Story 10.1: Export transactions to CSV

As a user, I want to export my transactions to CSV,
So that I can use them elsewhere or back them up.

**Acceptance Criteria:**
**Given** I have transactions
**When** I export to CSV
**Then** a CSV with date, type, amount, category, card, and description for the chosen range is produced and shared/downloaded (platform-appropriate)
**And** amounts and dates are formatted unambiguously.

### Story 10.2: Export transactions to JSON

As a user, I want a JSON export,
So that I have a complete, re-importable backup.

**Acceptance Criteria:**
**Given** I have transactions
**When** I export to JSON
**Then** a structured JSON export (including category/card references) is produced and shared/downloaded
**And** the format round-trips with the CSV importer where applicable.

### Story 10.3: Import transactions from CSV

As a user, I want to import transactions from CSV,
So that I can migrate existing data in.

**Acceptance Criteria:**
**Given** a CSV file
**When** I import it
**Then** columns are mapped (with a preview), rows are validated, invalid rows are reported, and valid rows are created
**And** obvious duplicates are detected and skipped or flagged.

---

## Epic 11: AI Assistant (opt-in)

**Goal:** Opt-in smart categorization and natural-language Q&A.
**Covers:** FR-11, FR-12, FR-13 · **Brownfield:** first consumer of the existing unused `server/_core/llm.ts` Forge gateway.

### Story 11.1: AI consent and opt-in flow

As a privacy-conscious user, I want to explicitly consent before any data is sent to AI,
So that I stay in control of my data.

**Acceptance Criteria:**
**Given** AI is off by default and `server/_core/llm.ts` is unused (FR-13)
**When** I first encounter an AI feature
**Then** a first-time card explains what is sent, why, and that it's reversible, and only an explicit Enable sends data
**And** the consent state is the AI preference (shared with Settings Epic 4) and can be turned off anytime.

### Story 11.2: Server-side categorization endpoint

As a developer, I want a categorization endpoint via the Forge gateway,
So that suggestions are computed server-side without hardcoded keys.

**Acceptance Criteria:**
**Given** consent is granted
**When** the client requests a category suggestion for a description/amount
**Then** the server calls Forge (`gemini-2.5-flash`) via `invokeLLM`, returns a suggested category, and never runs without consent
**And** keys stay in server env and a heuristic fallback is used on gateway failure.

### Story 11.3: Inline category suggestion in add-transaction

As a user, I want a suggested category while adding a transaction,
So that categorizing is faster.

**Acceptance Criteria:**
**Given** AI is enabled
**When** I enter a transaction description
**Then** a non-blocking suggested-category chip appears above the picker; one tap accepts, ignoring lets me pick manually
**And** it never auto-applies silently and capture is never blocked on it.

### Story 11.4: Natural-language Q&A on Insights

As a user, I want to ask questions about my spending in plain language,
So that I get answers without building reports.

**Acceptance Criteria:**
**Given** AI is enabled
**When** I ask a question in the Insights ask-bar (e.g., "Top expenses last month?")
**Then** the server answers using my data via the gateway and returns a focused answer card
**And** the feature is absent/disabled when AI is off, and errors degrade to a friendly message.

# SmartPocket — Interface Design

> **Source of truth:** the authoritative design system, tokens, components, and UX
> patterns live in [`docs/ux-design-specification.md`](./docs/ux-design-specification.md).
> This file is the screen-level companion: screen inventory, content, and user flows.
> Where the two ever disagree, the UX specification wins. The retired teal palette
> previously documented here has been replaced by the **Refined Indigo** system below.

## Overview

SmartPocket is a privacy-conscious, AI-assisted personal finance app designed for an
iOS-like experience: portrait orientation (9:16), one-handed use, primary actions in the
thumb zone. It runs from a single Expo / React Native codebase across iOS, Android, and web.
Users track income and expenses, categorize transactions, view monthly summaries, and manage
credit cards — with Budgets, Loans, Accounts, an opt-in AI assistant, and Settings on the roadmap.

---

## Screen List

### 1. **Dashboard (Home Screen)**

- Primary screen showing financial overview
- Gradient **balance hero** (indigo → violet): total balance + month-to-date income/expenses
- Recent transactions list (last 5–7 transactions)
- Quick actions: Add Income, Add Expense, View All (real buttons, in-flow — must not overlap the hero)
- Credit card summary badge (if cards exist)

### 2. **Add Transaction Screen**

- Bottom-sheet modal for adding income or expense
- Transaction type selector (Income / Expense segmented control)
- Large, focused amount input
- Category picker (color+icon grid; recently used float first)
- Date picker (defaults to today)
- Optional description/notes field
- Credit card selector (expenses only)
- Optional inline AI category suggestion (planned — non-blocking, opt-in)
- Save/Cancel

### 3. **Transactions List Screen (Activity)**

- Full list with filtering; grouped by date (Today, Yesterday, This Week…)
- Filter **pills** (single-tap, multi-select, clearable): All, Income, Expense, This Month, This Week
- Each row: category color+icon avatar, description + date, signed amount
- Swipe-to-edit / swipe-to-delete (destructive confirmed)
- Search by description
- Designed empty state

### 4. **Categories Screen**

- Predefined + custom categories, split into Expense and Income groups
- "Add New Category" is a real **Button** (not a full-width banner)
- Edit/delete categories; color + icon picker
- View spending by category

### 5. **Insights Screen (Monthly Summary)**

- Month stepper (`‹ May 2026 ›`) + horizontal swipe between months
- Total income, total expenses, net balance (StatCards)
- Pie/bar chart of expense breakdown by category
- Category-wise spending list with percentages
- Tap a category → filtered transactions
- Natural-language ask-bar (planned)
- Export/share summary

### 6. **Credit Cards Screen**

- List of saved cards: name, last 4 digits, type, balance/limit
- Add card button; edit/delete; view transactions per card
- Card color/theme selector

### 7. **Add/Edit Credit Card Screen**

- Card name, masked number, cardholder, expiry, credit limit
- Card color/icon picker
- Save/Cancel

### 8. **Settings Screen** (planned)

- Currency, theme (system/light/dark), notification preferences
- Data export/backup, AI toggles (opt-in, with clear data disclosure)
- About app

---

## Key User Flows

### Flow 1: Add an Expense

1. Tap "Add Expense" on Dashboard → sheet opens with Expense preselected
2. Enter amount → pick category → (optional) link card → (optional) note/date
3. Tap Save → optimistic update + haptic; sheet closes; balance & Recent Activity update
4. On network error → non-blocking toast + rollback; sheet stays open

### Flow 2: Review Monthly Summary

1. Open Insights → current month shown by default
2. See income / expenses / net + expense-breakdown chart
3. Tap a category → filter transactions for it
4. Swipe or use the stepper for previous/next months
5. Export/share

### Flow 3: Manage Credit Card

1. Cards screen → Add Card → enter details → pick color → Save
2. Tap a card to view its transactions; swipe to delete / menu to edit

### Flow 4: Filter Transactions

1. Activity screen → tap a filter pill (e.g. "Food")
2. List updates; add more pills (e.g. "This Month"); clear all to reset

### Flow 5: Enable AI Categorization (planned)

1. First use shows an opt-in card: what's sent, why, and that it's reversible
2. On enable, a suggested category chip appears in Add-Transaction; one tap accepts, ignore to pick manually

---

## Color System — Refined Indigo

Tokens are defined in `theme.config.js` and consumed via NativeWind. **Discipline:**
`success`/`error` are reserved for money & destructive actions; `accent`/`secondary` are
rare (AI/insight highlights, hero gradient end-stop). Indigo is the single brand/action color.

| Token        | Light     | Dark      | Role                                                 |
| ------------ | --------- | --------- | ---------------------------------------------------- |
| `primary`    | `#4F46E5` | `#818CF8` | Brand, primary actions, active states                |
| `background` | `#F8FAFC` | `#0B0F19` | App background                                       |
| `surface`    | `#FFFFFF` | `#151B2B` | Cards, sheets, elevated surfaces                     |
| `foreground` | `#111827` | `#F1F5F9` | Primary text                                         |
| `muted`      | `#6B7280` | `#9CA3AF` | Secondary text, inactive icons                       |
| `border`     | `#E5E7EB` | `#2D3748` | Dividers, outlines                                   |
| `success`    | `#047857` | `#6EE7B7` | **Income / positive (semantic only)**                |
| `error`      | `#DC2626` | `#FCA5A5` | **Expense / negative / destructive (semantic only)** |
| `warning`    | `#B45309` | `#FBBF24` | Alerts, over-budget, due-soon                        |
| `accent`     | `#BE185D` | `#F472B6` | Rare small accents (AI/insight)                      |
| `secondary`  | `#7C3AED` | `#A78BFA` | Hero gradient end-stop, rare accents                 |

**Balance hero gradient:** each theme owns its own stops (see _Themes_ below); Aurora's are
`#818CF8 → #C4B5FD → #67E8F9` in light and `#6366F1 → #A855F7 → #22D3EE` in dark, at 135°. Used
only on the dashboard balance card. On a `low` device tier the hero drops to a solid fill of the
first stop — a deliberate performance fallback, not a bug (`GradientHero`, `lib/_core/perf.ts`).

### Themes

The app ships **three** complete themes, switchable in Settings, each with its own colour set,
hero gradient, glass parameters and category palette:

| Theme                 | Character                    | Light surface        | Dark surface         |
| --------------------- | ---------------------------- | -------------------- | -------------------- |
| **Aurora** (default)  | Cool indigo → violet → cyan  | `#F8FAFC`            | `#0B0F19`            |
| **Obsidian & Gold**   | Ivory / warm gold, navy dark | `#FDF7E8` (gradient) | `#16213E` (gradient) |
| **Midnight Spectrum** | Violet → pink → amber        | `#A78BFA` (gradient) | `#7C3AED` (gradient) |

The token table above is Aurora's, which is also the top-level alias set in `theme.config.js`.

### Category Colors (data-driven; defaults)

- **Food** `#FF6B6B` · **Transport** `#4ECDC4` · **Entertainment** `#FFE66D` ·
  **Utilities** `#95E1D3` · **Shopping** `#FF85A2` · **Healthcare** `#A8E6CF`
- **Salary** `#059669` · **Freelance** `#3B82F6` · **Investment** `#8B5CF6` · **Other** `#6B7280`

> Each category owns a color + icon; defaults should be verified for WCAG AA contrast on both themes.

---

## Typography & Spacing

### Type Scale (system font stack: SF Pro / Roboto / system-ui)

| Token     | Size / Line | Weight | Use                                     |
| --------- | ----------- | ------ | --------------------------------------- |
| `hero`    | 42 / 48     | 700    | Dashboard balance amount (tabular-nums) |
| `display` | 36 / 40     | 700    | Large figures / feature numerals        |
| `h1`      | 30 / 36     | 700    | Screen titles                           |
| `h2`      | 24 / 32     | 600    | Section titles                          |
| `h3`      | 20 / 28     | 600    | Card titles                             |
| `body`    | 16 / 24     | 400    | Default text                            |
| `label`   | 14 / 20     | 500    | Field labels, chips                     |
| `caption` | 12 / 16     | 400    | Timestamps, hints                       |
| `micro`   | 10 / 14     | 400    | Dense micro-labels (month badge)        |
| `number`  | 16 / 24     | 600    | All monetary figures (tabular-nums)     |

Monetary values use tabular figures; support Dynamic Type up to 200%.

### Spacing (4-pt base)

- `xs 4` · `sm 8` · `md 12` (default) · `lg 16` (screen/card padding) · `xl 20` · `2xl 24`
- **Radius:** `sm 8` · `md 12` (default) · `lg 16` (cards) · `xl 24` (glass cards) · `2xl 28` (tab bar) · `full` (pills/chips)
- **Elevation:** subtle, low-opacity shadows; dark mode relies on `surface` lightness over heavy shadows

---

## Interaction Patterns

### Feedback

- **Button press:** scale 0.97 + light haptic
- **List item tap:** opacity 0.7 + navigation
- **Save success:** toast + success haptic; affected number animates to its new value
- **Error:** non-blocking error toast + error haptic; optimistic change rolls back
- **Swipe delete:** confirm with haptic; destructive actions always confirmable

### Animations

- Screen transitions: subtle slide (150ms)
- Sheet entry: fade + slide up (250ms)
- List item deletion: fade out (200ms)
- Chart: staggered animation (500ms)
- Respect reduced-motion: disable non-essential animation when the OS flag is set

---

## Accessibility

- Minimum touch target: 44×44 pt
- Color contrast: WCAG 2.1 AA on both themes (verify category colors)
- **Never encode meaning in color alone** — pair income/expense color with sign (`+`/`−`) and/or icon
- Text scaling up to 200%
- VoiceOver / TalkBack labels on all interactive elements; charts have text-equivalent summaries

---

## Known Consistency Fixes (from the UX spec audit)

These were observed in the built screens and should be corrected during the token/primitive rollout:

- Remove the stray **`index` tab** still visible in the tab bar (`href:null` not taking effect)
- Fix Dashboard **quick-action chips overlapping** the balance hero (use Button primitives in-flow)
- Convert the **"Add New Category"** full-width banner into a real Button
- Standardize **Activity filter chips** on the shared `Pill` primitive
- ~~Unify app title to **SmartPocket**~~ — done (SP-093); `app.config.ts` `appName` is now
  `SmartPocket`. The Expo/EAS `slug` is still `expense-tracker-app`: it is an infrastructure
  identifier, not user-facing, and renaming it re-points the project.

# SmartPocket – Product Requirements Document (PRD)

Last updated: 2026-06-17
Owner: Product (PM)
Status: Draft for review

> **Stack note (2026-05):** This product was originally scoped for **Flutter** (much of the vision
> framing below predates the rebuild). It is now built on **Expo / React Native (TypeScript)** with a
> tRPC + MySQL backend on the Manus platform, and is **server-backed rather than offline-first**. For
> the authoritative technical picture and the current implementation status, see
> [`ARCHITECTURE.md`](./ARCHITECTURE.md). This PRD has been reconciled with that build: requirements carry
> `FR-#`/`NFR-#` IDs and **[built]**/**[planned]** tags, and any remaining mentions of
> Flutter/SQLite/offline-first appear only as labelled historical context.

## 1. Executive Summary

SmartPocket is a privacy‑conscious, AI‑assisted personal finance app built with **Expo / React Native**, running on iOS, Android, and web from one codebase. It targets users who want modern conveniences like categorization, budgeting, reminders, analytics, and an optional chat assistant. (The original vision was offline‑first and open‑source; the current build is server‑backed via the Manus platform — see the Stack note above.)

## 2. Problem Statement & Opportunity

- Current apps are often paid and closed‑source.
- Loan tracking is fragmented or missing in many PFMs.
- AI insights are typically paywalled; users want privacy and transparency around how their data is used.
  Opportunity: Deliver a free (open‑source intended — see §16), cross‑platform app that unifies transactions, budgeting, loans, and insights with optional, opt‑in AI—suitable for privacy‑conscious users who want clear control over how their data and any AI features are used.

## 3. Goals and Non‑Goals

- Goals
  - Provide core personal finance tracking (transactions, categories, credit cards) and, on the roadmap, budgets, accounts, and personal loan management.
  - Reliable server‑backed persistence with explicit import/export.
  - Helpful insights (categorization, trends, reminders); optional, opt‑in AI assistant.
  - Clean, minimal, accessible UI; open‑source community friendly (intended — see §16).
- Non‑Goals (initially)
  - Automatic bank sync via third‑party aggregators.
  - Complex investment portfolio management.
  - Offline‑first operation (the app is server‑backed; offline caching is a possible later enhancement — see §15).

## 4. Target Users and Personas

- Everyday individuals managing personal finances.
- Informal lenders/borrowers tracking personal loans.
- Privacy‑conscious users who want clear control over their data and any AI features.
- Contributors (developers, designers, translators) improving the project — _if released open‑source (§16)._

## 5. Key Use Cases

Tag legend: **[built]** = implemented today · **[planned]** = roadmap (§12).

- Track daily income/expenses and categorize them. **[built]**
- Organize spending with custom income/expense categories. **[built]**
- Manage credit cards and link expenses to a card. **[built]**
- View monthly summary (income, expense, net) and per‑category breakdown. **[built]**
- Get AI‑assisted category suggestions while adding a transaction. **[planned]**
- Track balances across multiple accounts (cash/bank/wallet). **[planned]**
- Set category budgets and monitor progress. **[planned]**
- Manage loans (given/taken), schedules, interest, and reminders. **[planned]**
- Get recurring payment reminders (rent, utilities, subscriptions). **[planned]**
- View richer analytics (trends, cash‑flow forecasts). **[planned]**
- Ask questions in natural language via an optional chat assistant. **[planned]**

## 6. Functional Requirements

Each requirement has a stable ID (`FR-#`) for traceability to §13 acceptance criteria and epics.
Status: **[built]** implemented today · **[planned]** roadmap (§12).

- Transactions
  - **FR-1** Create, edit, delete income/expense with category, amount, date, and notes. **[built]**
  - **FR-2** Optionally link an expense to a credit card. **[built]**
  - **FR-3** List, filter (by date range / category / card), and search transactions. **[built]**
  - **FR-4** Recurring transactions with custom frequency and end conditions. **[planned]**
- Categories
  - **FR-5** Create, edit, delete custom income/expense categories with color and icon. **[built]**
  - **FR-6** Seed predefined default categories for new users. **[planned]**
- Credit Cards
  - **FR-7** Create and delete credit cards (name, number, cardholder, expiry, limit, color, type). **[built]**
  - **FR-8** Edit credit cards and view transactions associated with a card. **[planned]**
- Analytics & Insights
  - **FR-9** Monthly summary: total income, expense, net balance; per‑category expense breakdown. **[built]**
  - **FR-10** Charts (pie/breakdown), trends, basic forecasting and anomaly highlights. **[planned]**
- AI (optional / opt‑in)
  - **FR-11** Smart categorization suggestions for new transactions. **[planned]**
  - **FR-12** Natural‑language Q&A (e.g. "Top expenses last month?"). **[planned]**
  - **FR-13** Inference runs server‑side via a self‑hosted / local LLM (OpenAI‑compatible endpoint, env‑configured — not a third‑party gateway); transaction data is sent only after explicit user consent, and only to that self‑hosted endpoint. **[planned]**
- Budgets
  - **FR-14** Category budgets (monthly/weekly) with progress indicators and threshold alerts. **[planned]**
- Loans
  - **FR-15** Create loans (lend/borrow): principal, optional rate, schedule, due dates. **[planned]**
  - **FR-16** Track repayments and remaining balance; reminders for due/overdue. **[planned]**
- Accounts
  - **FR-17** Multiple accounts (cash/bank/wallet), balances, transfers. **[planned]**
- Import/Export
  - **FR-18** CSV and JSON export; CSV import for transactions (and loans, later). **[planned]**
- Notifications
  - **FR-19** Local reminders for recurring payments and loan schedules (`expo-notifications`). **[planned]**
- Settings
  - **FR-20** Currency, first day of week, theme, data management (backup/restore), AI toggles. **[planned]**

## 7. Non‑Functional Requirements

Each has an ID (`NFR-#`) and a measurable target where applicable.

- **NFR-1 Privacy:** user data is scoped to the authenticated user; transaction data is sent for AI inference only after explicit opt‑in, and only to the self‑hosted / local LLM endpoint — never to a third‑party AI API. No third‑party analytics SDKs without disclosure.

- **NFR-2 Performance:** cold start ≤ 3s on a mid‑range device; primary screens interactive ≤ 1s after data load; p95 API response < 500ms under normal load.
- **NFR-3 Reliability:** durable server‑side persistence with parameterized writes; crash‑free session rate ≥ 99.5%; timezone‑aware date handling for summaries/reminders.
- **NFR-4 Security:** secrets in server env only; auth session in secure storage (native) / HTTP‑only cookie (web); sensitive fields (card numbers) encrypted at rest before production (see §15, `ARCHITECTURE.md` §8).
- **NFR-5 Usability & Accessibility:** minimal, intuitive UI; meets WCAG 2.1 AA basics (contrast, touch target ≥ 44px, screen‑reader labels, dynamic text scaling).
- **NFR-6 Portability:** single Expo / React Native codebase targeting Android, iOS, and web.

## 8. Information Architecture & UX Notes

- **Current tabs (built):** Home (Dashboard), Activity (Transactions), Categories, Insights (monthly summary), Cards (credit cards).
- Quick‑add Income/Expense actions on the dashboard route to the add‑transaction screen; consistent category pickers.
- **Planned IA additions:** a Settings screen (currency/theme/notifications/AI toggles), and—if/when those features land—Budgets, Loans (with a loan‑detail page: schedule, history, next due), and richer Analytics (charts, trend lines).

## 9. Data Model (Conceptual)

> The **implemented** schema is the source of truth — see `drizzle/schema.ts` and `ARCHITECTURE.md` §4
> (tables: `users`, `categories`, `creditCards`, `transactions`, `monthlySummaries`). The entities below
> marked **[built]** match it; **[planned]** entities are future vision and not yet in the schema.

- **Transaction [built]** { id, userId, type (income|expense), amount, date, categoryId, creditCardId?, description?, createdAt, updatedAt }
- **Category [built]** { id, userId, name, type (income|expense), color, icon, isDefault, createdAt, updatedAt }
- **CreditCard [built]** { id, userId, name, cardNumber, cardholderName, expiryMonth, expiryYear, creditLimit, currentBalance, color, cardType, isActive, createdAt, updatedAt }
- **MonthlySummary [built]** { id, userId, year, month, totalIncome, totalExpense, netBalance } _(cache table; currently computed on demand)_
- **Account [planned]** { id, name, type (cash|bank|wallet), balanceDerived, currency }
- **Budget [planned]** { id, categoryId, period (monthly|weekly), amount, startDate?, endDate? }
- **Loan [planned]** { id, direction (lend|borrow), counterparty?, principal, rate?, schedule (periodicity, count|endDate), nextDueDate, createdAt }
- **Repayment [planned]** { id, loanId, amount, date, note }

> Notable gaps vs. the conceptual vision: there is no per‑transaction `currency` or `attachmentUrl`, and
> no `accountId` (single implicit account today). Currency is a §12 Phase‑3 item.

## 10. Technical Architecture

> Authoritative detail lives in [`ARCHITECTURE.md`](./ARCHITECTURE.md); this is a summary.

- Framework: **Expo / React Native (TypeScript)**, React 19, Expo Router (file‑based routing); single codebase for iOS, Android, web.
- Styling/animation: NativeWind (Tailwind for RN) + Reanimated.
- Client data layer: tRPC v11 client + TanStack Query, wrapped by an app‑wide `ExpenseProvider` context.
- API: Express + tRPC v11 (superjson), Zod input validation.
- Storage: **MySQL** accessed via the Manus Data API (`callDataApi`); Drizzle ORM defines the schema/types. The app is server‑backed (not offline‑first); local secure storage is used only for the auth session on native.
- Auth: Manus OAuth → JWT session (bearer token on native, cookie on web).
- Notifications: `expo-notifications` (local reminders) — planned, not yet wired.
- Charts: pie/breakdown charts planned for the Insights screen (no chart lib integrated yet).
- AI integrations
  - Server‑side inference targets a **self‑hosted / local LLM** over an OpenAI‑compatible `/v1/chat/completions` API, configured via env (`LLM_BASE_URL`, optional `LLM_API_KEY`, `LLM_MODEL`); no third‑party gateway. Host/key/model live in server env, never hardcoded. _(A legacy Manus Forge client exists in `server/_core/llm.ts` but is unused and being retired.)_
  - On‑device (user‑device) inference is not part of the architecture; the LLM runs server‑side on infrastructure we control.

## 11. Privacy, Security, and Compliance

- Server‑backed model: user data lives in the managed MySQL database and is always scoped to the authenticated user. (The original "local‑only by default" stance no longer applies — see the Stack note and `ARCHITECTURE.md` §8.)
- Secrets (API keys, JWT secret) live in server env vars; the auth session token is held in secure storage on native / HTTP‑only cookie on web; redact sensitive logs.
- Sensitive fields (e.g. credit card numbers) must be encrypted at rest — currently a known gap (see `ARCHITECTURE.md` §8).
- Explicit consent before sending any transaction data to the AI/LLM gateway.
- Clear disclosure of data practices in README and in‑app.

## 12. Roadmap and Release Plan

- Phase 1 – MVP (largely built; see `todo.md`)
  - Manual add/edit/delete transactions.
  - Category management (income/expense, color, icon); dashboard with balance + recent activity.
  - Credit card management.
  - Monthly summary with income/expense/net and per‑category breakdown.
- Phase 2 – Intelligence & UX
  - AI categorization suggestions (via a self‑hosted/local LLM); budgeting and forecasts.
  - Natural‑language queries/insights; import/export basics; loans & recurring transactions.
- Phase 3 – Scale & Polish
  - Multi‑language support (i18n); richer analytics and charts.
  - Settings (currency, theme, notifications); enhanced import/export (CSV, JSON export).

## 13. Acceptance Criteria (MVP)

Each criterion maps to the requirement(s) it satisfies.

- Users can add/edit/delete transactions, synced to the server and scoped to their account. _(FR‑1, FR‑3)_
- Categories can be created/edited/deleted and used to tag transactions. _(FR‑5)_
- Credit cards can be created/deleted and optionally linked to expenses. _(FR‑7, FR‑2)_
- The Insights screen shows monthly income, expense, net, and a per‑category breakdown. _(FR‑9)_
- The dashboard shows current‑month balance and recent activity. _(FR‑9)_
- Auth via Manus OAuth works on iOS, Android, and web. _(NFR‑6)_
- Cold start and primary‑screen interactivity meet the §7 targets. _(NFR‑2)_

## 14. Metrics and Success Criteria

- Product: weekly active users; feature‑usage rates (transactions, categories, cards); D30 retention ≥ 25% (target).
- Quality: crash‑free sessions ≥ 99.5%; cold start ≤ 3s (p90); API error rate < 1%.
- AI (once shipped): suggestion opt‑in rate; suggestion acceptance rate ≥ 60% (target).
- Community: GitHub stars, issues closed, PR throughput (if released open‑source — see §16).

## 15. Risks and Mitigations

- Scope creep (AI/features) → MVP discipline; phased roadmap.
- Sensitive data at rest (e.g. card numbers stored unencrypted) → add encryption / store only last 4 digits before production (see `ARCHITECTURE.md` §8).
- Server/network dependency (no offline mode) → graceful loading/error states; consider local caching later.
- LLM cost/latency/quality → debounce + cache; heuristic fallback for categorization.

## 16. Dependencies and Assumptions

- Node.js + pnpm; Expo SDK 54 / React Native 0.81 toolchain.
- Manus platform services: OAuth server and Data API (MySQL), configured via env vars.
- A self‑hosted / local LLM (OpenAI‑compatible endpoint) for AI features, reachable from the API server and configured via env vars (`LLM_BASE_URL`, optional `LLM_API_KEY`, `LLM_MODEL`).
- Notification permissions granted by user (for planned local reminders).
- License: **open‑source under MIT is the intended direction but not yet committed** — no `LICENSE` file exists in the repo today. Community/open‑source references elsewhere in this PRD (§2, §4, §14) are contingent on this decision being finalized. **Decision owner: Product.**

## 17. Testing, CI/CD, and Quality

- Unit tests (Vitest): server data‑access and aggregation logic (monthly stats, category breakdowns), validation schemas.
- Component tests: screens with mocked tRPC/React Query.
- Integration tests: add/edit transaction flows; auth/session handling.
- Static checks: `pnpm check` (tsc), `pnpm lint` (expo lint), `pnpm test` (vitest).

## 18. Decisions and Clarifications

- Persistence: **MySQL via the Manus Data API** (server‑backed). The original offline‑first SQLite plan was dropped in the React Native rebuild.
- AI: server‑side inference via a self‑hosted / local LLM (OpenAI‑compatible, env‑configured) — **not** Manus Forge (decision 2026‑06‑17); heuristic fallback still acceptable as a first step.
- Import/export: CSV (transactions) prioritized; JSON export supported — both still to be built.

## 19. Appendix and References

- Authoritative architecture: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).
- Source code: `app/` (screens/routes), `server/` (tRPC API + data access), `drizzle/` (schema), `lib/` (client state/providers), `components/`, `constants/`, `hooks/`, `shared/`.
- Other docs: `docs/concept note.md`, `docs/openai_integration.md`, `docs/natural_language_insights.md`, `docs/localization_implementation.md`, `todo.md`.

# Architecture — Expense Tracker (SmartPocket)

Last updated: 2026-06-17
Status: Authoritative — describes what is actually implemented in this repository.

> **History:** The product was originally scoped as a Flutter app (see `prd.md`, `concept note.md`).
> The codebase was rebuilt on **Expo / React Native (TypeScript)** and is now server-backed rather than
> offline-first. This document reflects the React Native implementation. Where older docs still describe
> Flutter/Dart, treat this file as the source of truth for technical detail.

---

## 1. Overview

A cross-platform personal expense tracker that runs on **iOS, Android, and Web** from a single
TypeScript codebase. Users authenticate via Manus OAuth and manage transactions, categories, and credit
cards. The app is backed by a small Express + tRPC API and a managed MySQL database accessed through the
Manus platform's Data API.

| Concern           | Choice                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Client            | Expo SDK 54, React Native 0.81, React 19, Expo Router 6 (file-based routing)                                                                                                                                                                           |
| Styling           | NativeWind 4 (Tailwind for RN) + Reanimated 4 animations                                                                                                                                                                                               |
| Client data layer | tRPC v11 client + TanStack Query 5, wrapped by an `ExpenseProvider` context                                                                                                                                                                            |
| API               | Express 4 + tRPC v11 (`@trpc/server`), superjson transformer                                                                                                                                                                                           |
| Validation        | Zod 4 (shared between client types and server input parsing)                                                                                                                                                                                           |
| ORM / schema      | Drizzle ORM (MySQL dialect) — schema-as-types; runtime queries use raw parameterized SQL                                                                                                                                                               |
| Database          | MySQL, reached via Manus Data API (`callDataApi`), not a direct connection                                                                                                                                                                             |
| Auth              | Manus OAuth → JWT session (jose); bearer token on native, cookie on web                                                                                                                                                                                |
| AI inference      | Self-hosted / local LLM over an OpenAI-compatible `/v1/chat/completions` API, env-configured (`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`) — **planned**. A legacy Manus Forge client (`server/_core/llm.ts`) exists but is unused and being retired. |
| Tooling           | pnpm, TypeScript strict, Vitest, ESLint (expo config), Prettier, drizzle-kit                                                                                                                                                                           |

---

## 2. Repository layout

```
app/                         Expo Router routes (screens)
  _layout.tsx                Root: providers (tRPC, React Query, Theme, SafeArea, Expense)
  (tabs)/_layout.tsx         Bottom tab navigator (5 tabs)
  (tabs)/dashboard.tsx       "Home"     — balance card, quick actions, recent activity
  (tabs)/transactions.tsx    "Activity" — full transaction list + filters/search
  (tabs)/categories.tsx      "Categories" — manage income/expense categories
  (tabs)/summary.tsx         "Insights" — monthly stats + category breakdown
  (tabs)/cards.tsx           "Cards"    — credit card management
  (tabs)/index.tsx           Hidden redirect entry (href: null)
  add-transaction.tsx        Add income/expense flow (modal-style route)
  oauth/callback.tsx         OAuth deep-link / web callback handler
  dev/theme-lab.tsx          Developer-only theme preview

components/                  Reusable UI (screen-container, haptic-tab, themed-view, ui/*)
constants/                   theme.ts, oauth.ts (OAuth + API base URL helpers), const.ts
hooks/                       use-auth, use-colors, use-color-scheme(.web)
lib/
  trpc.ts                    tRPC React client factory
  expense-context.tsx        App-wide data/state provider over tRPC hooks
  theme-provider.tsx         Theme context
  _core/                     Platform plumbing: auth (SecureStore), api, manus-runtime, theme

server/
  _core/index.ts             Express bootstrap: CORS, JSON, OAuth routes, storage proxy, tRPC mount
  _core/trpc.ts              router / publicProcedure / protectedProcedure / adminProcedure
  _core/context.ts           Per-request tRPC context (authenticates user, may be null)
  _core/sdk.ts               Manus OAuth SDK: token exchange, JWT sign/verify, request auth
  _core/oauth.ts             OAuth HTTP routes (login callback, session cookie issuance)
  _core/dataApi.ts           callDataApi() — gateway to Manus Data API (DB + external APIs)
  _core/llm.ts               invokeLLM() — legacy Forge chat-completions client (unused; AI features will use a self-hosted/local OpenAI-compatible client instead)
  _core/env.ts               Server env var surface
  routers.ts                 tRPC app router: categories / creditCards / transactions / summary
  db.ts                      Data-access functions (raw SQL via callDataApi)

drizzle/
  schema.ts                  Tables: users, categories, creditCards, transactions, monthlySummaries
  relations.ts               Drizzle relation definitions
  0000_*.sql / 0001_*.sql    Generated migrations
  meta/                      drizzle-kit snapshots & journal

shared/                      Cross-cutting: const.ts, types.ts (re-exports schema), _core/errors.ts
docs/                        Product + technical docs (this file, PRD, concept note, feature notes)
```

---

## 3. Runtime topology

```
┌─────────────────────────────────────────────┐
│  Expo app (iOS / Android / Web)              │
│                                              │
│  Screens (app/(tabs)/*, add-transaction)     │
│        │ uses                                │
│  ExpenseProvider (lib/expense-context.tsx)   │
│        │ calls                               │
│  tRPC React hooks (lib/trpc.ts)              │
│   + TanStack Query cache                     │
│   + auth header (bearer) / cookie (web)      │
└───────────────────────┬──────────────────────┘
                        │ HTTPS  POST /api/trpc
                        ▼
┌─────────────────────────────────────────────┐
│  Express + tRPC API (server/_core/index.ts)  │
│                                              │
│  CORS (reflects origin, credentials: true)   │
│  /api/oauth/*   OAuth callback + session      │
│  /api/health    liveness                      │
│  /api/trpc/*    appRouter (server/routers.ts) │
│        │ createContext → sdk.authenticateRequest
│        │ protectedProcedure requires ctx.user │
│        ▼                                      │
│  db.ts  → callDataApi("Database/query", …)    │
└───────────────────────┬──────────────────────┘
              ┌──────────┴───────────┐
              ▼                      ▼
   ┌────────────────────┐  ┌────────────────────┐
   │ Manus Data API     │  │ Manus OAuth server  │
   │ (MySQL queries)    │  │ (token / userinfo)  │
   └────────────────────┘  └────────────────────┘
              │
              ▼ (planned — AI features, opt-in)
   ┌──────────────────────────┐
   │ Self-hosted / local LLM  │  OpenAI-compatible /v1/chat/completions (env-configured)
   └──────────────────────────┘
```

Local dev: Metro/web on port **8081**, API server on port **3000** (`pnpm dev` runs both via
`concurrently`). On web the client derives the API origin by rewriting the `8081-` host prefix to
`3000-` when `EXPO_PUBLIC_API_BASE_URL` is unset (`constants/oauth.ts:getApiBaseUrl`).

---

## 4. Data model

Defined in `drizzle/schema.ts` (MySQL). All money fields are `decimal(12,2)` stored as strings.

- **users** — `id`, `openId` (unique, Manus OAuth identifier), `name`, `email`, `loginMethod`,
  `role` (`user` | `admin`), timestamps, `lastSignedIn`.
- **categories** — `id`, `userId`, `name`, `type` (`income` | `expense`), `color` (hex), `icon`,
  `isDefault`, timestamps.
- **creditCards** — `id`, `userId`, `name`, `cardNumber` (intended to be encrypted — see §8),
  `cardholderName`, `expiryMonth`, `expiryYear`, `creditLimit`, `currentBalance`, `color`,
  `cardType`, `isActive`, timestamps.
- **transactions** — `id`, `userId`, `categoryId`, optional `creditCardId`, `type`
  (`income` | `expense`), `amount`, `description`, `date`, timestamps.
- **monthlySummaries** — `id`, `userId`, `year`, `month`, `totalIncome`, `totalExpense`,
  `netBalance`, timestamps. _(Cache table; defined but not currently populated — monthly stats are
  computed on demand in `db.getMonthlyStats`.)_

Relationships are by `userId` / `categoryId` / `creditCardId` foreign-key columns; ownership scoping
(`WHERE userId = ?`) is enforced in the data-access layer, not by DB constraints.

---

## 5. API surface (tRPC `appRouter`)

All procedures except `health` are `protectedProcedure` (require an authenticated user). Defined in
`server/routers.ts`; input validated with Zod.

| Router         | Procedure                                                 | Type     | Purpose                                 |
| -------------- | --------------------------------------------------------- | -------- | --------------------------------------- |
| —              | `health`                                                  | query    | Liveness (`{ status: "ok" }`), public   |
| `categories`   | `list` / `getById`                                        | query    | List (optionally by type) / fetch one   |
|                | `create` / `update` / `delete`                            | mutation | CRUD                                    |
| `creditCards`  | `list` / `getById`                                        | query    | List user cards / fetch one             |
|                | `create` / `update` / `delete`                            | mutation | CRUD                                    |
| `transactions` | `list`                                                    | query    | Paged list (`limit`/`offset`)           |
|                | `listByDateRange` / `listByCategory` / `listByCreditCard` | query    | Filtered lists                          |
|                | `recent`                                                  | query    | Latest N (default 7) for dashboard      |
|                | `create` / `update` / `delete` / `getById`                | —        | CRUD + fetch one                        |
| `summary`      | `monthlyStats`                                            | query    | Income / expense / net for a month      |
|                | `expensesByCategory`                                      | query    | Per-category expense totals for a month |

`db.ts` implements each call as raw parameterized SQL through `callDataApi("Database/query", …)`.
Aggregations (`monthlyStats`, `expensesByCategory`) fetch rows and reduce in JS rather than using SQL
`GROUP BY`.

---

## 6. Client state & data flow

- `lib/trpc.ts` builds the tRPC client with `httpBatchLink` (transformer **inside** the link per tRPC
  v11), attaches `Authorization: Bearer <token>` on native, and sets `credentials: "include"` so web
  cookie auth works.
- `lib/expense-context.tsx` (`ExpenseProvider`) wraps the tRPC hooks for categories, credit cards,
  transactions, and monthly stats, exposing a single `useExpense()` API with `refresh*` / `add*` /
  `update*` / `delete*` helpers. It mirrors query results into local `useState` and refetches after
  mutations. _(Note: this duplicates some of TanStack Query's own caching — a known simplification
  target, not a correctness issue.)_
- Screens consume `useExpense()` and never call the API directly.

---

## 7. Authentication flow

1. Client calls `startOAuthLogin()` (`constants/oauth.ts`): web redirects to the Manus OAuth portal;
   native opens the system browser. The redirect URI is base64-encoded into the OAuth `state`.
2. OAuth provider redirects back to `/api/oauth/callback` (web) or the `manus<timestamp>` deep link
   (native) → handled by `app/oauth/callback.tsx` and `server/_core/oauth.ts`.
3. Server exchanges the code for a token (`sdk.exchangeCodeForToken`), fetches user info, upserts the
   user (`db.upsertUser`), and issues a JWT session (`jose`, HS256, 1-year expiry).
4. Session transport: **web** uses an HTTP-only cookie (`app_session_id`); **native** stores the token
   in `expo-secure-store` and sends it as a bearer header.
5. On each request, `createContext` → `sdk.authenticateRequest` verifies the JWT, auto-syncs the user
   from OAuth if missing, and sets `ctx.user`. `cron_`-prefixed openIds are treated as scheduled-task
   users (`isCron`, `taskUid`).

Relevant env vars: server `VITE_APP_ID`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `DATABASE_URL`,
`LLM_BASE_URL`, `LLM_API_KEY` (optional), `LLM_MODEL`; client `EXPO_PUBLIC_OAUTH_PORTAL_URL`,
`EXPO_PUBLIC_OAUTH_SERVER_URL`, `EXPO_PUBLIC_APP_ID`, `EXPO_PUBLIC_API_BASE_URL`.

---

## 8. Security & privacy notes

- All data procedures are user-scoped via `protectedProcedure` and `WHERE userId = ?`. SQL is
  parameterized (no string interpolation of user input).
- **`creditCards.cardNumber` is labelled "Encrypted" in the schema but is currently stored as the raw
  value** passed from the client — no encryption layer exists yet. This should be addressed before any
  production use (encrypt at rest, or store only the last 4 digits).
- Unlike the original Flutter concept, this build is **online/server-backed**, not offline-first. The
  PRD's "no network calls unless explicitly enabled" privacy stance does not apply to the current
  architecture and should be re-evaluated.
- AI inference is planned to run against a **self-hosted / local LLM** (OpenAI-compatible, env-configured
  via `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`), **not** a third-party gateway — so transaction data
  sent for AI features stays on infrastructure we control. The legacy Forge client (`server/_core/llm.ts`,
  routing to Manus Forge) is unused and being retired. No feature currently sends transaction data to any
  model, so the AI-privacy commitments in `openai_integration.md` / `natural_language_insights.md` are not
  yet relevant — but should be honored when those features land.

---

## 9. Build, run, test

```bash
pnpm install
pnpm dev            # API (3000) + Metro/web (8081) concurrently
pnpm dev:server     # API only (tsx watch)
pnpm dev:metro      # Expo web only
pnpm ios | android  # native dev clients
pnpm check          # tsc --noEmit
pnpm lint           # expo lint
pnpm test           # vitest
pnpm db:push        # drizzle-kit generate && migrate
pnpm build && pnpm start   # bundle + run server (esbuild → dist/)
```

App metadata (name, slug, bundle id, logo, deep-link scheme) is in `app.config.ts`.
Bundle id: `com.app.expensetrackerapp`.

---

## 10. Gap between docs and code

These features are described in the docs but **not implemented** in this repository:

- **Budgets, loans, multiple accounts, recurring transactions, import/export** (`prd.md`,
  `concept note.md`) — none exist. The app does have **credit cards**, which the PRD does not mention.
- **AI categorization** (`openai_integration.md`) — no categorization code yet; the legacy Forge client
  is unused. Planned implementation uses a self-hosted / local OpenAI-compatible LLM (env-configured model),
  not Manus Forge and not a third-party API. The feature-design notes `openai_integration.md` /
  `natural_language_insights.md` reflect this self-hosted approach.
- **Natural-language insights / chat / voice** (`natural_language_insights.md`) — not present despite
  the doc's "shipped" wording.
- **Localization / i18n** (`localization_implementation.md`) — no i18n; the doc describes a Flutter
  `.arb` setup that does not apply here.

See `todo.md` for the current implementation checklist.

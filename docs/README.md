# Documentation Index

This folder holds the product and technical documentation for the **Expense Tracker (SmartPocket)** app.

> **Read this first:** the app was originally scoped for **Flutter** but is now built on
> **Expo / React Native (TypeScript)** with a tRPC + MySQL backend, and is **local-first**
> (on-device SQLite, with opt-in sync). When any doc disagrees with the code,
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) is the source of truth.

## Documents

| Doc                                                                  | Type           | Status                    | What it covers                                                                                                                                                    |
| -------------------------------------------------------------------- | -------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                               | Technical      | ✅ Authoritative          | What is actually implemented: stack, layout, runtime topology, data model, API surface, auth, security, build/run/test                                            |
| [`prd.md`](./prd.md)                                                 | Product        | 📝 Vision + partial build | Requirements, personas, roadmap, acceptance criteria. Technical sections summarize `ARCHITECTURE.md`; feature scope (loans, budgets, accounts) is largely roadmap |
| [`concept note.md`](./concept%20note.md)                             | Product        | 💡 Vision                 | High-level pitch, goals, target users, and feature vision                                                                                                         |
| [`openai_integration.md`](./openai_integration.md)                   | Feature design | 🔵 Planned (not built)    | AI transaction categorization via a self-hosted / local LLM (OpenAI-compatible, env-configured)                                                                   |
| [`natural_language_insights.md`](./natural_language_insights.md)     | Feature design | 🔵 Planned (not built)    | Natural-language financial queries / chat insights (Epic I, Story I2)                                                                                             |
| [`localization_implementation.md`](./localization_implementation.md) | Feature design | 🔵 Planned (not built)    | i18n via `i18next` + `expo-localization` (Epic L, Story L1)                                                                                                       |

Status legend: ✅ matches the code · 📝 mixed vision + partial implementation · 💡 vision only ·
🔵 design/spec for a feature that does not exist yet.

## How to read these

- **New to the project?** Start with [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the real system, then
  skim [`prd.md`](./prd.md) / [`concept note.md`](./concept%20note.md) for product intent.
- **Implementing a feature?** The three feature-design docs (AI categorization, NL insights, i18n)
  are specs, not records of shipped work — verify against the code before relying on any detail.
- **Current task list:** see [`../todo.md`](../todo.md) for the implementation checklist.

## Implemented today (high level)

Transactions, categories, and credit cards (CRUD); a dashboard with monthly balance + recent activity;
a monthly Insights summary with per-category breakdown; email + password auth across iOS, Android, and web.

**Not yet built** (described in docs as roadmap/design): loans, budgets, multiple accounts, recurring
transactions, import/export, AI categorization, natural-language insights, localization, and a settings
screen. See each doc's status banner and [`ARCHITECTURE.md`](./ARCHITECTURE.md) §10 for the full gap list.

# SmartPocket

A privacy-conscious personal finance app — transactions, categories, budgets,
loans, accounts and analytics — built with Expo / React Native and running on
iOS, Android and web from one codebase.

The app is **local-first**: every screen reads and writes a local SQLite
database on device, and syncing to the server is opt-in. Turning it off leaves a
fully working app that never talks to a network.

**Stack:** Expo SDK 54 · React Native 0.81 · React 19 · Expo Router 6 ·
TypeScript 5.9 · NativeWind 4 · Reanimated 4 · tRPC v11 · TanStack Query ·
Drizzle ORM · MySQL · Express · Vitest

---

## Getting started

```bash
pnpm install
pnpm dev            # API + Metro together
```

`pnpm dev` needs no configuration. With `DATABASE_URL` unset the server runs
against a seeded in-memory database (`server/_core/devDb.ts`), so there is no
MySQL to install before the first run.

Copy `.env.example` to `.env` when you need real persistence — it documents
every variable, including which three the server refuses to boot without in
production.

| Command                              | What it does                                      |
| ------------------------------------ | ------------------------------------------------- |
| `pnpm dev`                           | API and Metro together                            |
| `pnpm dev:server` / `pnpm dev:metro` | Either half on its own                            |
| `pnpm test`                          | Vitest, the whole suite                           |
| `pnpm check`                         | TypeScript, no emit                               |
| `pnpm lint` / `pnpm format`          | ESLint / Prettier                                 |
| `pnpm build:server`                  | Single-file server bundle for the container image |
| `pnpm db:push`                       | Generate and apply journalled migrations          |
| `pnpm db:migrate:phase1`             | Apply the hand-written migrations (0011 onward)   |
| `pnpm android` / `pnpm ios`          | Native builds                                     |

---

## Layout

```
app/            Screens and routing (Expo Router, file-based)
components/     Shared UI; components/ui/ is the design-system layer
lib/            Client logic — sync engine, providers, local database access
  sync/         The local-first sync worker and its state
hooks/          React hooks
constants/      API location and session storage keys
server/         Express + tRPC API
  _core/        Auth, sessions, database access, crypto, migrations
  routers.ts    Every tRPC procedure
shared/         Code imported by both client and server
drizzle/        Schema and SQL migrations
docs/           Architecture, PRD, QA reports, design specs
tests/          Vitest suite
```

`docs/ARCHITECTURE.md` is the source of truth whenever another document
disagrees with the code.

---

## Authentication

Email and password, held in this database. Sessions are HS256 JWTs signed with
`JWT_SECRET` — a cookie on web, a bearer token on native, kept in
`expo-secure-store`. There is no external identity provider to configure.

Passwords are stored as salted scrypt hashes (`server/_core/secret-hash.ts`).
Card numbers are encrypted at rest with AES-256-GCM under a per-account key, so
one compromised device cannot expose another account's cards.

---

## Sync

Sync is off until the user turns it on. Each device holds its own SQLite
database; enabling sync associates that local data with the account and then
exchanges changes with the server, last-write-wins on `updatedAt`.

`docs/local-first-sync-plan.md` covers the design and
`docs/local-first-sync-runbook.md` the deployment order — the ULID id migration
in particular is not backwards compatible and has a required sequence.

---

## Deployment

The API ships as a container: a single self-contained bundle on `node:22-alpine`
with no `node_modules` in the image.

```bash
docker compose build
docker compose --profile tools run --rm migrate   # once per deploy, before up
docker compose up -d
```

`--profile tools` is not optional on the migrate line — see the comment in
`docker-compose.yml`. Two things the reverse proxy and scheduler must get right
are documented there too: `X-Forwarded-Proto: https`, without which the session
cookie never gets its Secure flag, and the `/api/scheduled/*` endpoints, which
need a cron sending `Authorization: Bearer $CRON_SECRET` or recurring
transactions quietly stop generating.

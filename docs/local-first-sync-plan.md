# Local-first SmartPocket with optional account sync — implementation plan

**Status:** proposal, not started
**Date:** 2026-08-15

## Goal

SmartPocket works fully on the phone with **no server and no login**. Sync to an account is a
switch in Settings. Turn it on and the phone's data syncs across devices; turn it off and the
app keeps working locally with no network traffic at all.

## Decisions taken

| Question | Decision |
|---|---|
| What is sync for? | **True multi-device** — two devices editing the same account and staying in step |
| First time sync is enabled with data on both sides | **Ask the user** — "keep this phone's data", "keep the account's data", or "merge" |
| Sync turned off, data added, then turned back on | **Push the backlog** — everything created while off is uploaded on re-enable |
| Login | **Optional.** The app is fully usable signed out. Login is only required to enable sync |

Multi-device is the demanding choice: it is what makes client-generated IDs and tombstones
non-negotiable. Backup-only would have avoided both.

---

## The architecture

**One data path, not two.** The phone's SQLite is always the source of truth. The UI never
knows whether sync is on — "offline mode" is simply "the sync worker is not running". This is
what stops `if (online)` branching leaking into 20 screens.

```
  screens (20 files)
        │  useExpense()
        ▼
  lib/expense-context.tsx                      ← unchanged
        │  tRPC client
        ▼
  in-process tRPC link  ─────────────────►  appRouter (server/routers.ts)
                                                  │  dbQuery()
                                                  ▼
                                          local SQLite (expo-sqlite)
                                                  ▲
                                                  │  only when sync is ON + signed in
                                          sync worker ──HTTP──► remote server ──► MySQL
```

### Why this is far cheaper than it looks

Three facts from the current code make it tractable:

1. **`lib/expense-context.tsx` is a real seam.** 20 files use `useExpense()`; only 4 touch tRPC
   directly. The screens do not change.
2. **`server/db.ts` (2,108 lines) reaches the database through exactly one chokepoint** —
   `dbQuery("Database/query", { query, params })`, 88 call sites, all raw SQL. There is no
   Drizzle query-builder usage to port dialect-by-dialect.
3. **Only one Node-only import exists on that entire path** — `mysql2/promise` in
   `server/_core/db-query.ts`, which is precisely the file being replaced.

So the whole server data layer and all 64 tRPC procedures can run **inside the app** by swapping
one ~50-line adapter. Metro picks up `db-query.native.ts` automatically alongside the existing
`db-query.ts`.

MySQL-specific SQL that needs rewriting for SQLite is small and countable:

| Construct | Occurrences | SQLite equivalent |
|---|---|---|
| `YEAR(x)` | 4 | `CAST(strftime('%Y', x) AS INTEGER)` |
| `MONTH(x)` | 4 | `CAST(strftime('%m', x) AS INTEGER)` |
| `NOW()` | 2 | `CURRENT_TIMESTAMP` |
| `ON DUPLICATE KEY UPDATE` | 1 | `ON CONFLICT(...) DO UPDATE SET` |

**11 spots total.**

The existing test suite already mocks `dbQuery`, so most of the 1,617 tests target the same
chokepoint and should survive the port.

---

## Blockers that must be solved first

### 1. Integer autoincrement IDs — the largest single change

All 11 tables use `int autoincrement primaryKey`. Two phones offline both create transaction
`id = 5`; on sync they collide and one silently overwrites the other. **Multi-device makes
client-generated IDs mandatory.**

Use **ULID**, not UUIDv4 — it is lexicographically sortable by creation time, which gives better
index locality and a natural ordering for free.

Touches: `drizzle/schema.ts` (11 tables + every foreign key), a server migration that assigns
ULIDs and rewrites FK references, and `server/db.ts` throughout.

### 2. No tombstones

Zero `deletedAt` columns today. A delete made offline cannot propagate — the sync sees "row
absent locally" and cannot distinguish *deleted* from *not yet synced*. Every table needs
`deletedAt`, with rows purged only after the delete has been acknowledged by the server.

### 3. Card number encryption

`CARD_ENCRYPTION_KEY` is a server-side env var. Offline, card numbers need an equivalent key
held in `expo-secure-store`. The two must agree, or a card synced from one device is
undecryptable on the other — so the key has to be derived from account credentials, not
generated per-device.

### 4. Already in your favour

`updatedAt` exists on **all 11 tables**. That is exactly the basis last-write-wins conflict
resolution needs, already present.

---

## Authentication and identity

"Login" means three different things here, and only one of them needs a network.

| | Works offline? | Why |
|---|---|---|
| First-time account sign-in, to switch sync on | **No** | OAuth requires the identity provider to be reachable. Inherent — no design avoids it. It is a one-time, deliberate action taken when enabling sync |
| Day-to-day unlocking the app | **Yes, always** | The App Lock PIN is already fully local (`expo-secure-store`, local comparison, no network). In a local-first app this *is* the login |
| Staying signed in while offline | **Yes** | Already works today — see below |

So the end state: a user can install the app, **never see a login screen**, use it for years and
set a PIN, entirely offline. Login appears exactly once, and only if they choose to turn sync on.

### What already works

`hooks/use-auth.ts` has a cached-user fast path — if SecureStore holds a cached user it calls
`setUser(cachedUser)` and returns *before* any network call. A signed-in user who goes offline
keeps working. Session tokens are long-lived (`ONE_YEAR_MS` in `server/_core/sdk.ts`), so
expiry-while-offline is unlikely.

### What must change

**1. A network failure must not sign the user out.** `Api.getMe()` already returns `null` only
on 401/403 and rethrows network errors — SP-D07 did that deliberately — but the `catch` in
`fetchUser` flattens both cases:

```js
} catch (err) {
  setError(error);
  setUser(null);        // ← a network failure is treated as a rejected session
}
```

Reached only in a narrow window (token stored, user never cached, device offline), and minor
today. In a local-first app it is unacceptable: keep the cached identity and mark sync
unreachable instead.

**2. `AuthGate` must stop gating the app shell.** Today the whole render waits on the API via
`isAppShellReady`. Signed-out has to become a first-class state, not an error path.

**3. Local reads must never consult the session token.** All 64 procedures are
`protectedProcedure` requiring `ctx.user`. In local mode the in-process router needs a
**synthetic local user** — a ULID minted on first launch and held in SecureStore — so every read
and write works while signed out.

Point 3 is what makes the first-sync prompt coherent. The local user ID owns all local rows;
signing in later *associates* that local user with the account, and that association is exactly
the moment the app asks "keep this phone's data / keep the account's / merge".

### Signing out

Signing out must drop the session and stop sync **without deleting local data** — the user falls
back to local-only, keeping everything they have.

One deliberate behaviour has to be revisited: `logout()` currently calls `clearAppLock()`, wiping
the local PIN and biometric preference. Its comment gives a sound reason *for the present model* —
the app requires an account, so a device-local PIN left behind after sign-out "would belong to
nobody after the next sign-in".

Local-first inverts that premise. The PIN belongs to the **device and its local user**, not to the
account, and there is always a user to own it — the signed-out local one. Disconnecting an account
should not wipe the lock protecting data that stays on the phone. In phase 3 the PIN's lifetime
should follow the local user, not the session. The Forgot-PIN flow keeps clearing both, since that
path is defined by the user not knowing the PIN.

## Sync model

**Push — a `dirty` flag, not a timestamp comparison.** Every local write sets `dirty = 1`; a
successful push clears it. This is clock-independent, and it gives "push the backlog on
re-enable" for free: anything created while sync was off is simply still dirty. No separate
outbox table.

**Pull — a server-assigned monotonic `serverSeq`.** The client stores `lastPulledSeq` and asks
for everything above it. Do **not** page by wall-clock time: device clocks drift, and a phone
with a wrong clock would silently skip or re-fetch records.

**Conflict — last-write-wins per record, on `updatedAt`.** Field-level merge is
over-engineering for a personal expense tracker. Worth documenting the known limit: two devices
editing *the same* transaction within a clock-skew window can lose one edit. Acceptable here;
would not be for collaborative data.

**First sync — the one-time choice.** When sync is enabled and both sides hold data, prompt:
keep this phone's / keep the account's / merge. Merge is last-write-wins per record with both
sides' unique rows retained; note in the copy that the same expense entered on both devices will
appear twice, because nothing can tell those apart.

---

## Phases

| Phase | Work | Ships something? |
|---|---|---|
| **1** | ULID + `deletedAt` migration across both schemas, FK rewrite, data-migration script, test updates | Yes — app still works online-only, no user-visible change |
| **2** | `db-query.native.ts` on `expo-sqlite`, the 11 SQL fixes, local schema bootstrap + migration runner | — |
| **3** | In-process tRPC link, local user identity, local card-encryption key, and the four auth changes above (ungate `AuthGate`, network-vs-rejection in `fetchUser`, synthetic local user for `protectedProcedure`, PIN lifetime follows the local user) | **Yes — this alone ships the fully offline app with no server** |
| **4** | Sync worker (push dirty / pull by seq), Settings toggle, first-sync choice UI, conflict handling, tests | Yes — ships optional sync on top |

**Phase 3 is the natural early stop.** It delivers a complete, serverless app; phase 4 is
additive.

### Rough effort

| Phase | Estimate |
|---|---|
| 1 | 2–3 days |
| 2 | 1–2 days |
| 3 | 1–2 days |
| 4 | 3–5 days |
| **Total** | **~8–12 focused days** |

Phase 1 dominates because it is a schema migration across 11 tables plus every consumer. The
port itself (phases 2–3) is small precisely because of the `dbQuery` chokepoint.

---

## Open risks

1. **The in-process router assumption.** Bundling `server/routers.ts` into the app is clean on
   paper (one Node-only import). It needs a spike before phase 3 is committed to — `jose` for
   JWT and any transitive dependency could still pull Node built-ins.
2. **Migrating existing users.** Anyone already holding int-ID data needs the ULID remap to run
   exactly once, server-side, without breaking their FKs.
3. **Purging tombstones.** Delete them too early and a device that has been offline for months
   resurrects deleted rows on its next sync. Needs a retention window longer than any plausible
   offline period.
4. **Test suite churn.** 1,617 tests currently pass. Most mock `dbQuery` and should survive,
   but the ID change will touch a lot of fixtures.

---

## Recommended first step

A **half-day spike on risk 1**, before committing to phase 1: try importing `server/routers.ts`
into the app bundle with a stub `db-query` and see whether Metro resolves it cleanly. If it does,
the whole plan holds and phases 2–3 are as small as estimated. If it does not, the fallback is a
hand-written local data layer, and phase 3 grows from ~2 days to ~5.

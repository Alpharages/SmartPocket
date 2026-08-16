import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * local-first-sync-plan.md phase 4: the sync worker's only reason to ever
 * reach the network. Deliberately separate from `@/lib/trpc` — on native
 * that resolves to lib/trpc.native.ts's in-process link, which dispatches
 * straight into the local SQLite and never leaves the device. Syncing is the
 * one operation that must actually go over HTTP to the real server, so it
 * gets its own plain vanilla client instead of sharing the app's.
 */
export function createRemoteSyncClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        transformer: superjson,
        headers: async () => {
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });
}

export type RemoteSyncClient = ReturnType<typeof createRemoteSyncClient>;

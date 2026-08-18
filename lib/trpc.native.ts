import { createTRPCReact } from "@trpc/react-query";
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { appRouter, type AppRouter } from "@/server/routers";
import { createLocalContext } from "@/server/_core/local-context";

export const trpc = createTRPCReact<AppRouter>();

/**
 * local-first-sync-plan.md phase 3: "In-process tRPC link". Native no longer
 * talks to server/_core/index.ts (the Express server) over HTTP at all —
 * every procedure call is dispatched in the same process against
 * `appRouter.createCaller(ctx)`, which in turn reads and writes the on-device
 * SQLite through server/db.ts's `dataApi.native.ts` (phase 2). There is no
 * serialization boundary here, so unlike lib/trpc.ts there is no transformer
 * to configure — `op.input` is already a plain JS value.
 *
 * `op.path` is a dotted string (e.g. "accounts.create"); this walks it into
 * the nested caller object `createCaller` produces, the same shape already
 * exercised by tests/accounts-router.test.ts's `caller.accounts.create(...)`.
 */
export function resolveProcedure(
  caller: unknown,
  path: string,
): (input: unknown) => Promise<unknown> {
  const segments = path.split(".");
  const procedureName = segments.pop();
  let target: unknown = caller;
  for (const segment of segments) {
    target = (target as Record<string, unknown> | undefined)?.[segment];
  }
  const record = target as Record<string, unknown> | undefined;
  const procedure = procedureName ? record?.[procedureName] : undefined;

  if (!procedureName || typeof procedure !== "function") {
    throw new Error(`No procedure found at path "${path}"`);
  }

  // Invoked as `record[procedureName](input)`, never a detached reference —
  // the per-procedure caller tRPC generates is a Proxy whose exotic methods
  // (bind/call/apply) are themselves treated as further router path
  // segments, so wrapping it with Function.prototype.bind throws "No
  // procedure found on path ...bind" instead of calling it.
  return (input: unknown) =>
    (record as Record<string, (i: unknown) => Promise<unknown>>)[procedureName](
      input,
    );
}

export function createInProcessLink(): TRPCLink<AppRouter> {
  return () =>
    ({ op }) =>
      observable((observer) => {
        let cancelled = false;

        void (async () => {
          try {
            const ctx = await createLocalContext();
            const caller = appRouter.createCaller(ctx);
            const procedure = resolveProcedure(caller, op.path);
            const data = await procedure(op.input);

            if (cancelled) return;
            observer.next({ result: { type: "data", data } });
            observer.complete();
          } catch (err) {
            if (cancelled) return;
            observer.error(TRPCClientError.from(err as Error));
          }
        })();

        return () => {
          cancelled = true;
        };
      });
}

/**
 * Creates the tRPC client for native builds. Metro's platform-extension
 * resolution picks this file over lib/trpc.ts automatically — app/_layout.tsx
 * imports `@/lib/trpc` unchanged, exactly like server/db.ts's `./_core/dataApi`
 * import already does for the SQLite split in phase 2.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [createInProcessLink()],
  });
}

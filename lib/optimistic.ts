import type { Id } from "@/drizzle/schema";
export type OptimisticOp<T> =
  | { type: "add"; item: T; position?: "start" | "end" }
  | { type: "update"; id: Id; data: Partial<T> }
  | { type: "delete"; id: Id };

/**
 * Apply an optimistic operation to a list, returning the modified list.
 * This is a pure function — the caller is responsible for snapshotting
 * the original list if rollback is required.
 *
 * For "add", `position` controls where the optimistic item is inserted so
 * each caller can preserve its list's existing ordering (e.g. transactions
 * prepend newest-first, while categories/cards append). Defaults to "start".
 */
export function applyOptimistic<T extends { id: Id }>(
  list: T[],
  op: OptimisticOp<T>,
): T[] {
  switch (op.type) {
    case "add":
      return op.position === "end" ? [...list, op.item] : [op.item, ...list];
    case "update":
      return list.map((item) =>
        item.id === op.id ? { ...item, ...op.data } : item,
      );
    case "delete":
      return list.filter((item) => item.id !== op.id);
    default:
      return list;
  }
}

/**
 * Create a snapshot (shallow copy) of a list for rollback purposes.
 */
export function snapshotList<T>(list: T[]): T[] {
  return [...list];
}

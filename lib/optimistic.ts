export type OptimisticOp<T> =
  | { type: "add"; item: T }
  | { type: "update"; id: number; data: Partial<T> }
  | { type: "delete"; id: number };

/**
 * Apply an optimistic operation to a list, returning the modified list.
 * This is a pure function — the caller is responsible for snapshotting
 * the original list if rollback is required.
 */
export function applyOptimistic<T extends { id: number }>(
  list: T[],
  op: OptimisticOp<T>,
): T[] {
  switch (op.type) {
    case "add":
      return [op.item, ...list];
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

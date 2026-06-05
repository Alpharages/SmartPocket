import { describe, expect, it } from "vitest";
import { applyOptimistic, snapshotList } from "@/lib/optimistic";

interface Item {
  id: number;
  name: string;
  value: number;
}

const items: Item[] = [
  { id: 1, name: "a", value: 10 },
  { id: 2, name: "b", value: 20 },
  { id: 3, name: "c", value: 30 },
];

describe("applyOptimistic", () => {
  describe("add", () => {
    it("prepends the item to the list by default", () => {
      const next = applyOptimistic(items, { type: "add", item: { id: 4, name: "d", value: 40 } });
      expect(next).toHaveLength(4);
      expect(next[0]).toEqual({ id: 4, name: "d", value: 40 });
      expect(next.slice(1)).toEqual(items);
    });

    it("prepends when position is 'start'", () => {
      const next = applyOptimistic(items, { type: "add", item: { id: 4, name: "d", value: 40 }, position: "start" });
      expect(next[0]).toEqual({ id: 4, name: "d", value: 40 });
      expect(next.slice(1)).toEqual(items);
    });

    it("appends when position is 'end' (preserves categories/cards ordering)", () => {
      const next = applyOptimistic(items, { type: "add", item: { id: 4, name: "d", value: 40 }, position: "end" });
      expect(next).toHaveLength(4);
      expect(next[next.length - 1]).toEqual({ id: 4, name: "d", value: 40 });
      expect(next.slice(0, -1)).toEqual(items);
    });

    it("does not mutate the original list", () => {
      const before = [...items];
      applyOptimistic(items, { type: "add", item: { id: 99, name: "z", value: 0 } });
      applyOptimistic(items, { type: "add", item: { id: 98, name: "y", value: 0 }, position: "end" });
      expect(items).toEqual(before);
    });
  });

  describe("update", () => {
    it("updates the matching item by id", () => {
      const next = applyOptimistic(items, { type: "update", id: 2, data: { name: "bb" } });
      expect(next[1]).toEqual({ id: 2, name: "bb", value: 20 });
    });

    it("leaves non-matching items unchanged", () => {
      const next = applyOptimistic(items, { type: "update", id: 2, data: { value: 99 } });
      expect(next[0]).toEqual(items[0]);
      expect(next[2]).toEqual(items[2]);
    });

    it("returns the same list when id is not found", () => {
      const next = applyOptimistic(items, { type: "update", id: 999, data: { name: "x" } });
      expect(next).toEqual(items);
    });
  });

  describe("delete", () => {
    it("removes the item with the matching id", () => {
      const next = applyOptimistic(items, { type: "delete", id: 2 });
      expect(next).toHaveLength(2);
      expect(next.map((i) => i.id)).toEqual([1, 3]);
    });

    it("returns the same list when id is not found", () => {
      const next = applyOptimistic(items, { type: "delete", id: 999 });
      expect(next).toEqual(items);
    });
  });
});

describe("snapshotList", () => {
  it("returns a shallow copy", () => {
    const snap = snapshotList(items);
    expect(snap).toEqual(items);
    expect(snap).not.toBe(items);
  });
});

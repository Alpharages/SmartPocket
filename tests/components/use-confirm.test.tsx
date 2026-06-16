import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import TestRenderer, { act, type ReactTestInstance } from "react-test-renderer";

import { useConfirm } from "@/hooks/use-confirm";

let renderer: TestRenderer.ReactTestRenderer | null = null;

function render(ui: React.ReactElement): ReactTestInstance {
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer!.root;
}

afterEach(() => {
  act(() => {
    renderer?.unmount();
  });
  renderer = null;
});

function Capture({
  sink,
}: {
  sink: (c: ReturnType<typeof useConfirm>) => void;
}) {
  sink(useConfirm());
  return React.createElement("div");
}

describe("useConfirm", () => {
  it("resolves true on confirm and false on cancel", async () => {
    let api: ReturnType<typeof useConfirm>;
    render(React.createElement(Capture, { sink: (c) => (api = c) }));

    let p!: Promise<boolean>;
    act(() => {
      p = api!.confirm({ title: "Delete?" });
    });
    expect(api!.visible).toBe(true);
    act(() => api!.onConfirm());
    await expect(p).resolves.toBe(true);

    let p2!: Promise<boolean>;
    act(() => {
      p2 = api!.confirm({ title: "Delete?" });
    });
    act(() => api!.onCancel());
    await expect(p2).resolves.toBe(false);
  });

  it("settles the prior promise as false when confirm() is re-entered before it resolves", async () => {
    let api: ReturnType<typeof useConfirm>;
    render(React.createElement(Capture, { sink: (c) => (api = c) }));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = api!.confirm({ title: "First" });
    });
    // Re-enter before answering the first prompt.
    act(() => {
      second = api!.confirm({ title: "Second" });
    });

    // The first promise must not hang — it resolves false.
    await expect(first).resolves.toBe(false);

    act(() => api!.onConfirm());
    await expect(second).resolves.toBe(true);
  });

  it("resolves a pending prompt as false on unmount", async () => {
    let api: ReturnType<typeof useConfirm>;
    render(React.createElement(Capture, { sink: (c) => (api = c) }));

    let p!: Promise<boolean>;
    act(() => {
      p = api!.confirm({ title: "Pending" });
    });
    act(() => {
      renderer?.unmount();
    });
    await expect(p).resolves.toBe(false);
  });
});

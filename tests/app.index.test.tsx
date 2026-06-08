import React from "react";
import { describe, expect, it, vi } from "vitest";
import TestRenderer, { act } from "react-test-renderer";

vi.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) =>
    React.createElement("Redirect", { href }),
}));

describe("IndexScreen", () => {
  it("redirects the bare root route to the dashboard", async () => {
    const { default: IndexScreen } = await import("@/app/index");

    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<IndexScreen />);
    });

    expect(renderer!.root.findByType("Redirect").props.href).toBe("/dashboard");
  });
});
